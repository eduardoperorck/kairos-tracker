import { useReducer, useState, useEffect, useRef, useCallback } from 'react'
import type { InputActivity } from '../domain/inputIntelligence'
import { aggregateBlocks, needsClassification, needsWorkspaceClassification, matchRule, DEFAULT_DEV_RULES, getFriendlyProcessName } from '../domain/passiveCapture'
import type { CaptureBlock, RawPollEvent, WindowRule, UnclassifiedApp } from '../domain/passiveCapture'
import {
  extractDomainFromTitle, extractVsCodeWorkspace, workspaceFolderFromFilePath, stripFileFromWorkspaceName, scoreWindow,
  SCORE_THRESHOLD_AUTO, computeTimeOfDayPrior,
} from '../domain/classifier'
import type { DomainRule, SignalSet } from '../domain/classifier'
import type { Storage, CorrectionRecord } from '../persistence/storage'
import { migrateLocalStorageRules } from '../persistence/localStorageMigration'

const POLL_INTERVAL_MS = 5_000
const MAX_EVENTS = 1440
const DEBOUNCE_DIRECT_MS = 2_000   // Task 4: fast path for explicit rules
const DEBOUNCE_SCORED_MS = 5_000   // Task 4: slower path for heuristic scoring
const IDLE_THRESHOLD_MS = 5 * 60_000  // Task 8: 5 minutes of no input → idle pause

const STORAGE_KEY = 'user_window_rules'
const DOMAIN_RULES_KEY = 'user_domain_rules'
const CORRECTION_KEY = 'correction_records'

// ─── Persistence helpers ──────────────────────────────────────────────────────

function loadUserRules(): WindowRule[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}
function saveUserRules(rules: WindowRule[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}

function loadDomainRules(): DomainRule[] {
  try { return JSON.parse(localStorage.getItem(DOMAIN_RULES_KEY) ?? '[]') } catch { return [] }
}
function saveDomainRules(rules: DomainRule[]) {
  localStorage.setItem(DOMAIN_RULES_KEY, JSON.stringify(rules))
}

// Task 10 / M-B2: Correction learning ─────────────────────────────────────────
// A "context key" is `process::workspace::domain`. We track corrections per context key
// so that workspace-specific corrections don't pollute the general process rule.
type CorrectionRecord = {
  contextKey: string  // Task 10: was just "process", now full context key
  categoryId: string
  count: number
}

function loadCorrections(): CorrectionRecord[] {
  try { return JSON.parse(localStorage.getItem(CORRECTION_KEY) ?? '[]') } catch { return [] }
}
function saveCorrections(records: CorrectionRecord[]) {
  localStorage.setItem(CORRECTION_KEY, JSON.stringify(records))
}

/**
 * Increments the correction counter for (contextKey, categoryId).
 * Returns true when the count reaches the threshold — caller should auto-create a rule.
 * Task 10: contextKey replaces the bare process name so workspace-specific overrides
 * don't create overly broad rules.
 */
function trackCorrection(contextKey: string, categoryId: string, threshold = 3): boolean {
  const records = loadCorrections()
  const existing = records.find(r => r.contextKey === contextKey && r.categoryId === categoryId)
  if (existing) {
    existing.count++
    saveCorrections(records)
    return existing.count >= threshold
  }
  records.push({ contextKey, categoryId, count: 1 })
  saveCorrections(records)
  return false
}

// ─── Tauri bridge ─────────────────────────────────────────────────────────────

// Payload emitted by the Rust background thread (matches CaptureTickPayload in lib.rs)
type CaptureTickPayload = {
  ts: number
  process: string
  title: string
  hostname: string | null
  category_id: string | null
  display_name: string
}

type TauriEditorCtx = { workspace: string; file: string; language: string } | null

async function fetchEditorContext(): Promise<TauriEditorCtx> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<TauriEditorCtx>('get_editor_context')
  } catch { return null }
}

async function syncRulesToRust(rulesJson: string): Promise<void> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('sync_window_rules', { rulesJson })
  } catch { /* not in Tauri */ }
}

// Fallback polling when Tauri events are unavailable (browser / dev mode)
async function fetchWindowFallback(): Promise<CaptureTickPayload | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    type TauriWindow = { title: string; process: string; display_name: string; icon_base64?: string }
    const wins = await invoke<TauriWindow[]>('get_visible_windows')
    const win = wins?.[0] ?? await invoke<TauriWindow | null>('get_active_window')
    if (!win) return null
    type BrowserCtx = { hostname: string; title: string } | null
    const browserCtx = await invoke<BrowserCtx>('get_browser_context').catch(() => null)
    return {
      ts: Date.now(),
      process: win.process,
      title: win.title,
      hostname: browserCtx?.hostname ?? null,
      category_id: null,
      display_name: win.display_name,
    }
  } catch { return null }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ElevationSuggestion = {
  process: string
  displayName: string
  categoryId: string
}

export type PassiveCaptureResult = {
  blocks: CaptureBlock[]
  unclassifiedProcess: UnclassifiedApp | null
  unclassifiedWorkspace: string | null
  suggestedCategoryId: string | null
  recentTitles: string[]
  elevationSuggestion: ElevationSuggestion | null
  /** Task 8: idle pause — set when 5+ min of no input detected while a timer is active */
  idlePauseMs: number | null
  /** M79: human-readable reason for the current classification (e.g. "via rule: code.exe") */
  classificationReason: string | null
  /** M-UX3: the window the passive capture is currently watching */
  currentWindow: { process: string; workspace: string | null; domain: string | null } | null
  assignProcess: (process: string, categoryId: string) => void
  dismissProcess: (process: string) => void
  elevateProcess: (process: string, categoryId: string) => void
  dismissElevation: (process: string) => void
  assignDomain: (domain: string, categoryId: string) => void
  assignWorkspace: (workspace: string, categoryId: string) => void
  dismissWorkspace: (workspace: string) => void
  resetAutoStart: () => void
  /** Task 8: dismiss idle pause banner (keep or discard the idle time) */
  dismissIdlePause: () => void
}

const MAX_TITLES = 20

// ─── M74: useReducer state ─────────────────────────────────────────────────────

type CaptureState = {
  blocks: CaptureBlock[]
  pendingQueue: UnclassifiedApp[]
  unclassifiedWorkspace: string | null
  suggestedCategoryId: string | null
  recentTitles: string[]
  elevationSuggestion: ElevationSuggestion | null
  idlePauseMs: number | null
}

type CaptureAction =
  | { type: 'TICK'; blocks: CaptureBlock[]; title: string | null }
  | { type: 'SUGGEST_CATEGORY'; id: string | null }
  | { type: 'ADD_UNCLASSIFIED'; app: UnclassifiedApp }
  | { type: 'REMOVE_UNCLASSIFIED'; process: string }
  | { type: 'SET_WORKSPACE'; ws: string | null }
  | { type: 'SET_ELEVATION'; suggestion: ElevationSuggestion | null }
  | { type: 'SET_IDLE'; ms: number }
  | { type: 'DISMISS_IDLE' }

const INITIAL_CAPTURE_STATE: CaptureState = {
  blocks: [],
  pendingQueue: [],
  unclassifiedWorkspace: null,
  suggestedCategoryId: null,
  recentTitles: [],
  elevationSuggestion: null,
  idlePauseMs: null,
}

function captureReducer(state: CaptureState, action: CaptureAction): CaptureState {
  switch (action.type) {
    case 'TICK': {
      const recentTitles = action.title
        ? [action.title, ...state.recentTitles.filter(t => t !== action.title)].slice(0, MAX_TITLES)
        : state.recentTitles
      return { ...state, blocks: action.blocks, recentTitles }
    }
    case 'SUGGEST_CATEGORY':
      return { ...state, suggestedCategoryId: action.id }
    case 'ADD_UNCLASSIFIED':
      return state.pendingQueue.some(a => a.process === action.app.process)
        ? state
        : { ...state, pendingQueue: [...state.pendingQueue, action.app] }
    case 'REMOVE_UNCLASSIFIED':
      return { ...state, pendingQueue: state.pendingQueue.filter(a => a.process !== action.process) }
    case 'SET_WORKSPACE':
      return { ...state, unclassifiedWorkspace: action.ws }
    case 'SET_ELEVATION':
      return { ...state, elevationSuggestion: action.suggestion }
    case 'SET_IDLE':
      return { ...state, idlePauseMs: action.ms }
    case 'DISMISS_IDLE':
      return { ...state, idlePauseMs: null }
    default:
      return state
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePassiveCapture(
  activeCategoryId: string | null = null,
  inputActivity?: Pick<InputActivity, 'keystrokes' | 'mouseClicks'>,
  /** Task 7: called immediately (no debounce) when a rule with autoSwitch=true matches */
  onAutoStart?: (categoryId: string) => void,
  storage?: Storage,
  /** M78: historical sessions used to compute time-of-day prior for scoring */
  sessions?: ReadonlyArray<{ startedAt: number; categoryId: string }>,
): PassiveCaptureResult {
  const storageRef = useRef(storage)
  useEffect(() => { storageRef.current = storage }, [storage])
  const sessionsRef = useRef(sessions)
  useEffect(() => { sessionsRef.current = sessions }, [sessions])

  // M74: single reducer for all tick-driven state (one re-render per tick)
  const [captureState, dispatch] = useReducer(captureReducer, INITIAL_CAPTURE_STATE)
  const { blocks, pendingQueue, unclassifiedWorkspace, suggestedCategoryId, recentTitles, elevationSuggestion, idlePauseMs } = captureState

  const [userRules, setUserRules] = useState<WindowRule[]>(() => loadUserRules())
  const [domainRules, setDomainRules] = useState<DomainRule[]>(() => loadDomainRules())
  const [corrections, setCorrections] = useState<CorrectionRecord[]>(() => loadCorrections())
  const correctionsRef = useRef(corrections)
  useEffect(() => { correctionsRef.current = corrections }, [corrections])
  const [dismissedElevations, setDismissedElevations] = useState<Set<string>>(new Set())
  const [currentWindow, setCurrentWindow] = useState<{ process: string; workspace: string | null; domain: string | null } | null>(null)

  // Task 6: ContextState machine — single ref consolidates context-related tracking
  type ContextState = {
    key: string              // last seen context key (proc::workspace::domain)
    catId: string | null     // resolved category for this context
    matchType: 'direct' | 'domain' | 'scored' | 'none'
  }
  const contextStateRef = useRef<ContextState | null>(null)

  const eventsRef = useRef<RawPollEvent[]>([])
  const lastProcessRef = useRef<string | null>(null)
  const processTickCountRef = useRef<Map<string, number>>(new Map())
  const pendingAutoStartRef = useRef<{ categoryId: string; timeout: ReturnType<typeof setTimeout> } | null>(null)
  const idleConsecutivePollsRef = useRef(0)
  const idleStartedAtRef = useRef<number | null>(null)  // Task 8
  const idleFiredRef = useRef(false)                    // Task 8: prevent repeated firing

  // Task 3: context memory — store the context key where the category was active,
  // not a timestamp. Momentum applies only when we return to that same context.
  const momentumRef = useRef<{ categoryId: string; contextKey: string } | null>(null)

  const inputActivityRef = useRef(inputActivity)
  useEffect(() => { inputActivityRef.current = inputActivity }, [inputActivity])
  const onAutoStartRef = useRef(onAutoStart)
  useEffect(() => { onAutoStartRef.current = onAutoStart }, [onAutoStart])

  // M64/M65: migrate localStorage → storage (once), then load from storage
  useEffect(() => {
    const s = storageRef.current
    if (!s) return
    void migrateLocalStorageRules(s).then(() => {
      void s.loadWindowRules().then(rules => setUserRules(rules))
      void s.loadDomainRules().then(rules => setDomainRules(rules))
      void s.loadCorrections().then(records => setCorrections(records))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeCategoryIdRef = useRef(activeCategoryId)
  useEffect(() => {
    // Task 3: record momentum when category changes — capture current context key
    const prev = activeCategoryIdRef.current
    if (prev && prev !== activeCategoryId) {
      momentumRef.current = { categoryId: prev, contextKey: lastProcessRef.current ?? '' }
    }
    activeCategoryIdRef.current = activeCategoryId
  }, [activeCategoryId])

  const allRules = [...DEFAULT_DEV_RULES, ...userRules]
  const allRulesRef = useRef(allRules)
  const domainRulesRef = useRef(domainRules)
  useEffect(() => { allRulesRef.current = [...DEFAULT_DEV_RULES, ...userRules] }, [userRules])
  useEffect(() => { domainRulesRef.current = domainRules }, [domainRules])

  // Sync rules to Rust whenever user rules change (M-BG2)
  useEffect(() => {
    syncRulesToRust(JSON.stringify([...DEFAULT_DEV_RULES, ...userRules]))
  }, [userRules])

  // Core tick handler — runs on every window poll (from Tauri event or fallback interval)
  const handleTick = useCallback(async (payload: CaptureTickPayload) => {
    const proc = payload.process
    const title = payload.title

    // M-C2: editor context from VS Code extension (only available via invoke)
    const editorCtx = await fetchEditorContext()
    const domain = payload.hostname ?? extractDomainFromTitle(title, proc)
    // Workspace resolution order:
    // 1. workspace field from VS Code extension (most reliable)
    // 2. parent folder of the open file (covers single-file-open scenario)
    // 3. title parsing (fallback when extension isn't running)
    const rawWorkspace =
      (editorCtx?.workspace || null) ??
      workspaceFolderFromFilePath(editorCtx?.file ?? '') ??
      extractVsCodeWorkspace(title, proc)
    // Strip leading filename if the workspace string looks like "file.ext - FolderName"
    const vsWorkspace = rawWorkspace ? stripFileFromWorkspaceName(rawWorkspace) : null

    const event: RawPollEvent = {
      window: { title, process: proc, timestamp: payload.ts },
      domain,
      timestamp: payload.ts,
    }

    eventsRef.current = [...eventsRef.current.slice(-MAX_EVENTS), event]
    dispatch({ type: 'TICK', blocks: aggregateBlocks(eventsRef.current, allRulesRef.current), title: title || null })
    setCurrentWindow({ process: proc, workspace: vsWorkspace ?? null, domain: domain ?? null })

    // Task 8: time-based idle tracking
    if (inputActivityRef.current) {
      const { keystrokes, mouseClicks } = inputActivityRef.current
      if (keystrokes === 0 && mouseClicks === 0) {
        idleConsecutivePollsRef.current++
        // Also set idleStartedAt if not already set
        if (!idleStartedAtRef.current) {
          idleStartedAtRef.current = payload.ts - POLL_INTERVAL_MS
        }
        // Fire idle pause once when threshold is crossed and a timer is active
        const idleDuration = payload.ts - idleStartedAtRef.current
        if (idleDuration >= IDLE_THRESHOLD_MS && activeCategoryIdRef.current && !idleFiredRef.current) {
          idleFiredRef.current = true
          dispatch({ type: 'SET_IDLE', ms: idleDuration })
        }
      } else {
        idleConsecutivePollsRef.current = 0
        idleStartedAtRef.current = null
        idleFiredRef.current = false
      }
    }

    // Task 2: include VS Code workspace in context key for accurate context identity
    const contextKey = `${proc}::${vsWorkspace ?? ''}::${domain ?? ''}`
    if (contextKey !== lastProcessRef.current) {
      lastProcessRef.current = contextKey

      const momentum = momentumRef.current
      // Task 3: momentum applies when we return to the same context key (not time-based)
      const momentumActive = momentum && momentum.contextKey === contextKey

      const ia = inputActivityRef.current
      const inputRate: SignalSet['inputRate'] =
        ia ? (ia.keystrokes > 0 || ia.mouseClicks > 0 ? 'high' : 'none') : 'none'

      const signals: SignalSet = { process: proc, title, domain, vsWorkspace, inputRate }

      const scores = scoreWindow(
        signals,
        allRulesRef.current,
        domainRulesRef.current,
        activeCategoryIdRef.current ?? undefined,
      )

      // M78: apply time-of-day prior (weight 0.05) from historical sessions
      if (sessionsRef.current && sessionsRef.current.length > 0) {
        const prior = computeTimeOfDayPrior(sessionsRef.current)
        for (const s of scores) {
          const p = prior.get(s.categoryId) ?? 0
          s.score = Math.min(1.0, s.score + p * 0.05)
        }
        scores.sort((a, b) => b.score - a.score)
      }

      // M-B4: apply momentum bonus to recently-active category
      if (momentumActive && momentum) {
        const entry = scores.find(s => s.categoryId === momentum.categoryId)
        if (entry) entry.score = Math.min(1.0, entry.score + 0.10)
        scores.sort((a, b) => b.score - a.score)
      }

      // Direct rule match takes priority over heuristic scoring
      const directRule = matchRule({ title, process: proc, timestamp: payload.ts, vsWorkspace }, allRulesRef.current)
      const directCatId = directRule?.mode === 'auto' && directRule.categoryId ? directRule.categoryId : null

      // Task 7: autoSwitch rules bypass debounce and trigger immediately
      if (directRule?.autoSwitch && directCatId && directCatId !== activeCategoryIdRef.current) {
        onAutoStartRef.current?.(directCatId)
      }

      // M-B: domain rules as direct match (bypass threshold when user explicitly assigned a domain)
      const domainDirectCatId = domain
        ? (domainRulesRef.current.find(dr => domain === dr.domain || domain.endsWith('.' + dr.domain))?.categoryId ?? null)
        : null

      const topScore = scores[0]
      const scoredCatId = topScore && topScore.score >= SCORE_THRESHOLD_AUTO ? topScore.categoryId : null
      const catId = directCatId ?? domainDirectCatId ?? scoredCatId

      // Task 6: update ContextState machine
      const matchType = directCatId ? 'direct' : domainDirectCatId ? 'domain' : scoredCatId ? 'scored' : 'none'
      contextStateRef.current = { key: contextKey, catId, matchType }

      // Task 4: two-tier debounce — fast for direct rules, slower for scored
      const debounceMs = (directCatId ?? domainDirectCatId) ? DEBOUNCE_DIRECT_MS : DEBOUNCE_SCORED_MS
      if (catId) {
        if (pendingAutoStartRef.current?.categoryId !== catId) {
          if (pendingAutoStartRef.current) clearTimeout(pendingAutoStartRef.current.timeout)
          const timeout = setTimeout(() => {
            const currentlyIdle = inputActivityRef.current !== undefined && idleConsecutivePollsRef.current >= 2
            if (!currentlyIdle) dispatch({ type: 'SUGGEST_CATEGORY', id: catId })
            pendingAutoStartRef.current = null
          }, debounceMs)
          pendingAutoStartRef.current = { categoryId: catId, timeout }
        }
      } else {
        if (pendingAutoStartRef.current) {
          clearTimeout(pendingAutoStartRef.current.timeout)
          pendingAutoStartRef.current = null
        }
        dispatch({ type: 'SUGGEST_CATEGORY', id: null })
      }

      // Elevation suggestion
      if (activeCategoryIdRef.current) {
        const matchedRule = matchRule({ title, process: proc, timestamp: 0 }, allRulesRef.current)
        const hasUserRule = userRulesRef.current.some(r => r.pattern.toLowerCase() === proc.toLowerCase())
        const isSuggestOnly = matchedRule?.mode === 'suggest' && matchedRule?.categoryId === null
        if (isSuggestOnly && !hasUserRule && !dismissedElevationsRef.current.has(proc)) {
          dispatch({ type: 'SET_ELEVATION', suggestion: {
            process: proc,
            displayName: getFriendlyProcessName(proc, payload.display_name),
            categoryId: activeCategoryIdRef.current,
          }})
        } else {
          dispatch({ type: 'SET_ELEVATION', suggestion: null })
        }
      } else {
        dispatch({ type: 'SET_ELEVATION', suggestion: null })
      }
    }

    if (needsClassification(proc, allRulesRef.current)) {
      const displayName = getFriendlyProcessName(proc, payload.display_name, title)
      // Only prompt after 5 minutes of continuous activity (60 ticks × 5s)
      const prevCount = processTickCountRef.current.get(proc) ?? 0
      const nextCount = prevCount + 1
      if (lastProcessRef.current !== null && !contextKey.startsWith(lastProcessRef.current.split('::')[0])) {
        processTickCountRef.current.clear()
      }
      processTickCountRef.current.set(proc, nextCount)
      if (nextCount >= 60) {
        dispatch({ type: 'ADD_UNCLASSIFIED', app: { process: proc, displayName, title } })
      }
    }

    // Workspace classification prompt — set when detected, never cleared by focus loss.
    // Only assignWorkspace() or dismissWorkspace() clear it (user action).
    if (vsWorkspace && needsWorkspaceClassification(vsWorkspace, allRulesRef.current)) {
      dispatch({ type: 'SET_WORKSPACE', ws: vsWorkspace })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refs for values accessed inside handleTick (avoids stale closures without re-subscribing)
  const userRulesRef = useRef(userRules)
  const dismissedElevationsRef = useRef(dismissedElevations)
  useEffect(() => { userRulesRef.current = userRules }, [userRules])
  useEffect(() => { dismissedElevationsRef.current = dismissedElevations }, [dismissedElevations])

  // M-BG1/BG3: Subscribe to Tauri background capture events.
  // Falls back to a polling interval when running outside Tauri (dev/browser).
  useEffect(() => {
    let cleanup: (() => void) | null = null

    async function setup() {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        const unlisten = await listen<CaptureTickPayload>('capture_tick', (ev) => {
          void handleTick(ev.payload)
        })
        cleanup = unlisten

        // M-BG3: replay events buffered while the webview was initializing
        try {
          const { invoke } = await import('@tauri-apps/api/core')
          const buffered = await invoke<CaptureTickPayload[]>('drain_capture_buffer')
          for (const p of buffered) void handleTick(p)
        } catch { /* not in Tauri or buffer empty */ }
      } catch {
        // Not in Tauri — fall back to polling
        const id = setInterval(async () => {
          const payload = await fetchWindowFallback()
          if (payload) void handleTick(payload)
        }, POLL_INTERVAL_MS)
        cleanup = () => clearInterval(id)
      }
    }

    void setup()

    return () => {
      cleanup?.()
      if (pendingAutoStartRef.current) {
        clearTimeout(pendingAutoStartRef.current.timeout)
        pendingAutoStartRef.current = null
      }
    }
  // handleTick is stable (useCallback with no deps)
  }, [handleTick])

  const unclassifiedProcess = pendingQueue[0] ?? null

  // M79: derive classification reason at render time from contextStateRef
  const classificationReason: string | null = (() => {
    const ctx = contextStateRef.current
    if (!ctx || ctx.matchType === 'none') return null
    const parts = ctx.key.split('::')
    const proc = parts[0] ?? ''
    const domain = parts[2] ?? ''
    switch (ctx.matchType) {
      case 'direct': return proc ? `via rule: ${proc}` : null
      case 'domain': return domain ? `via domain: ${domain}` : null
      case 'scored': return 'via heuristic'
      default: return null
    }
  })()

  // Task 10 / M-B2: assign process with correction learning (M64: uses state + storage)
  const assignProcess = useCallback((process: string, categoryId: string) => {
    const ctxKey = contextStateRef.current?.key ?? process
    const records = correctionsRef.current
    const existing = records.find(r => r.contextKey === ctxKey && r.categoryId === categoryId)
    const updated: CorrectionRecord = existing
      ? { ...existing, count: existing.count + 1 }
      : { contextKey: ctxKey, categoryId, count: 1 }
    const nextCorrections = existing
      ? records.map(r => r === existing ? updated : r)
      : [...records, updated]
    setCorrections(nextCorrections)
    if (storageRef.current) void storageRef.current.saveCorrection(updated)
    else saveCorrections(nextCorrections)
    const promoted = updated.count >= 3

    // Task 10: if promoted AND the context key contains a workspace segment, create a
    // workspace rule (more precise) instead of a bare process rule.
    const parts = ctxKey.split('::')
    const workspace = parts[1] ?? ''
    const shouldUseWorkspaceRule = promoted && workspace.length > 0

    const rule: WindowRule = shouldUseWorkspaceRule
      ? {
          id: `ws-auto-${Date.now()}`,
          matchType: 'workspace',
          pattern: workspace,
          categoryId,
          mode: 'auto',
          enabled: true,
          autoSwitch: true,
        }
      : {
          id: `user-${Date.now()}`,
          matchType: 'process',
          pattern: process,
          categoryId,
          mode: 'auto',
          enabled: true,
        }

    setUserRules(prev => {
      const next = [...prev, rule]
      if (storageRef.current) void storageRef.current.saveWindowRule(rule)
      else saveUserRules(next)
      return next
    })
    dispatch({ type: 'REMOVE_UNCLASSIFIED', process })
  }, [])

  const dismissProcess = useCallback((process: string) => {
    const rule: WindowRule = {
      id: `ignore-${Date.now()}`,
      matchType: 'process',
      pattern: process,
      categoryId: null,
      mode: 'ignore',
      enabled: true,
    }
    setUserRules(prev => {
      const next = [...prev, rule]
      if (storageRef.current) void storageRef.current.saveWindowRule(rule)
      else saveUserRules(next)
      return next
    })
    dispatch({ type: 'REMOVE_UNCLASSIFIED', process })
  }, [])

  const elevateProcess = useCallback((process: string, categoryId: string) => {
    const rule: WindowRule = {
      id: `auto-${Date.now()}`,
      matchType: 'process',
      pattern: process,
      categoryId,
      mode: 'auto',
      enabled: true,
    }
    setUserRules(prev => {
      const next = [...prev, rule]
      if (storageRef.current) void storageRef.current.saveWindowRule(rule)
      else saveUserRules(next)
      return next
    })
    dispatch({ type: 'SET_ELEVATION', suggestion: null })
  }, [])

  const dismissElevation = useCallback((process: string) => {
    setDismissedElevations(prev => new Set([...prev, process]))
    setElevationSuggestion(null)
  }, [])

  // Workspace rule assignment — creates a workspace-type auto rule
  const assignWorkspace = useCallback((workspace: string, categoryId: string) => {
    const rule: WindowRule = {
      id: `ws-${Date.now()}`,
      matchType: 'workspace',
      pattern: workspace,
      categoryId,
      mode: 'auto',
      enabled: true,
    }
    setUserRules(prev => {
      const next = [...prev, rule]
      if (storageRef.current) void storageRef.current.saveWindowRule(rule)
      else saveUserRules(next)
      return next
    })

    // M89: Retroactive reclassification — update past 7 days of capture stats
    if (storageRef.current) {
      const storage = storageRef.current
      const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
      storage.loadDailyCaptureStatsSince(sevenDaysAgo).then(rows => {
        for (const row of rows) {
          // Workspace context is stored in process name for workspace rules
          if (row.process.toLowerCase() === workspace.toLowerCase()) {
            void storage.updateCaptureStatCategory(row.date, row.process, categoryId)
          }
        }
      }).catch(() => {})
    }

    dispatch({ type: 'SET_WORKSPACE', ws: null })
  }, [])

  const dismissWorkspace = useCallback((workspace: string) => {
    const rule: WindowRule = {
      id: `ws-ignore-${Date.now()}`,
      matchType: 'workspace',
      pattern: workspace,
      categoryId: null,
      mode: 'ignore',
      enabled: true,
    }
    setUserRules(prev => {
      const next = [...prev, rule]
      if (storageRef.current) void storageRef.current.saveWindowRule(rule)
      else saveUserRules(next)
      return next
    })
    dispatch({ type: 'SET_WORKSPACE', ws: null })
  }, [])

  // M-A1 / M-A2: domain rule assignment
  const assignDomain = useCallback((domain: string, categoryId: string) => {
    const rule: DomainRule = { id: `domain-${Date.now()}`, domain, categoryId }
    setDomainRules(prev => {
      const next = [...prev.filter(r => r.domain !== domain), rule]
      if (storageRef.current) void storageRef.current.saveDomainRule(rule)
      else saveDomainRules(next)
      return next
    })
  }, [])

  const resetAutoStart = useCallback(() => {
    lastProcessRef.current = null
  }, [])

  // Task 8: dismiss idle pause banner
  const dismissIdlePause = useCallback(() => {
    dispatch({ type: 'DISMISS_IDLE' })
    idleFiredRef.current = false
    idleStartedAtRef.current = null
  }, [])

  return {
    blocks, unclassifiedProcess, unclassifiedWorkspace, suggestedCategoryId, recentTitles, elevationSuggestion,
    idlePauseMs, classificationReason, currentWindow,
    assignProcess, dismissProcess, elevateProcess, dismissElevation, assignDomain,
    assignWorkspace, dismissWorkspace, resetAutoStart, dismissIdlePause,
  }
}
