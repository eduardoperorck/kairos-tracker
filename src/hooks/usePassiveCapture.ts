import { useState, useEffect, useRef, useCallback } from 'react'
import type { InputActivity } from '../domain/inputIntelligence'
import { aggregateBlocks, needsClassification, matchRule, DEFAULT_DEV_RULES } from '../domain/passiveCapture'
import type { CaptureBlock, RawPollEvent, WindowRule, UnclassifiedApp } from '../domain/passiveCapture'
import {
  extractDomainFromTitle, extractVsCodeWorkspace, scoreWindow,
  SCORE_THRESHOLD_AUTO,
} from '../domain/classifier'
import type { DomainRule, SignalSet } from '../domain/classifier'

const POLL_INTERVAL_MS = 5_000
const MAX_EVENTS = 1440
const DEBOUNCE_MS = 10_000
const MOMENTUM_WINDOW_MS = 30 * 60_000  // M-B4: 30-minute context memory

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

// M-B2: Correction learning ────────────────────────────────────────────────────
type CorrectionRecord = { process: string; categoryId: string; count: number }

function loadCorrections(): CorrectionRecord[] {
  try { return JSON.parse(localStorage.getItem(CORRECTION_KEY) ?? '[]') } catch { return [] }
}
function saveCorrections(records: CorrectionRecord[]) {
  localStorage.setItem(CORRECTION_KEY, JSON.stringify(records))
}

/**
 * Increments the correction counter for (process, categoryId).
 * Returns true if the count reached the threshold (≥ 3) — caller should auto-promote.
 */
function trackCorrection(process: string, categoryId: string, threshold = 3): boolean {
  const records = loadCorrections()
  const existing = records.find(r => r.process === process && r.categoryId === categoryId)
  if (existing) {
    existing.count++
    saveCorrections(records)
    return existing.count >= threshold
  }
  records.push({ process, categoryId, count: 1 })
  saveCorrections(records)
  return false
}

// ─── Tauri bridge ─────────────────────────────────────────────────────────────

type TauriWindow = { title: string; process: string; display_name: string; icon_base64?: string }

async function fetchActiveWindow(): Promise<TauriWindow | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<TauriWindow | null>('get_active_window')
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
  suggestedCategoryId: string | null
  recentTitles: string[]
  elevationSuggestion: ElevationSuggestion | null
  assignProcess: (process: string, categoryId: string) => void
  dismissProcess: (process: string) => void
  elevateProcess: (process: string, categoryId: string) => void
  dismissElevation: (process: string) => void
  assignDomain: (domain: string, categoryId: string) => void
  resetAutoStart: () => void
}

const MAX_TITLES = 20

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePassiveCapture(
  activeCategoryId: string | null = null,
  inputActivity?: Pick<InputActivity, 'keystrokes' | 'mouseClicks'>
): PassiveCaptureResult {
  const [blocks, setBlocks] = useState<CaptureBlock[]>([])
  const [userRules, setUserRules] = useState<WindowRule[]>(() => loadUserRules())
  const [domainRules, setDomainRules] = useState<DomainRule[]>(() => loadDomainRules())
  const [pendingQueue, setPendingQueue] = useState<UnclassifiedApp[]>([])
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string | null>(null)
  const [recentTitles, setRecentTitles] = useState<string[]>([])
  const [elevationSuggestion, setElevationSuggestion] = useState<ElevationSuggestion | null>(null)
  const [dismissedElevations, setDismissedElevations] = useState<Set<string>>(new Set())

  const eventsRef = useRef<RawPollEvent[]>([])
  const lastProcessRef = useRef<string | null>(null)
  const pendingAutoStartRef = useRef<{ categoryId: string; timeout: ReturnType<typeof setTimeout> } | null>(null)
  const idleConsecutivePollsRef = useRef(0)

  // M-B4: context memory — track when the active category last changed
  const momentumRef = useRef<{ categoryId: string; changedAt: number } | null>(null)

  const inputActivityRef = useRef(inputActivity)
  useEffect(() => { inputActivityRef.current = inputActivity }, [inputActivity])

  const activeCategoryIdRef = useRef(activeCategoryId)
  useEffect(() => {
    // M-B4: record momentum when category changes
    const prev = activeCategoryIdRef.current
    if (prev && prev !== activeCategoryId) {
      momentumRef.current = { categoryId: prev, changedAt: Date.now() }
    }
    activeCategoryIdRef.current = activeCategoryId
  }, [activeCategoryId])

  const allRules = [...DEFAULT_DEV_RULES, ...userRules]
  const allRulesRef = useRef(allRules)
  const domainRulesRef = useRef(domainRules)
  useEffect(() => { allRulesRef.current = [...DEFAULT_DEV_RULES, ...userRules] }, [userRules])
  useEffect(() => { domainRulesRef.current = domainRules }, [domainRules])

  useEffect(() => {
    const interval = setInterval(async () => {
      const win = await fetchActiveWindow()
      if (!win) return

      const domain = extractDomainFromTitle(win.title, win.process)
      const vsWorkspace = extractVsCodeWorkspace(win.title, win.process)

      const event: RawPollEvent = {
        window: { title: win.title, process: win.process, timestamp: Date.now() },
        domain,
        timestamp: Date.now(),
      }

      eventsRef.current = [...eventsRef.current.slice(-MAX_EVENTS), event]
      setBlocks(aggregateBlocks(eventsRef.current, allRulesRef.current))

      if (win.title) {
        setRecentTitles(prev => {
          const without = prev.filter(t => t !== win.title)
          return [win.title, ...without].slice(0, MAX_TITLES)
        })
      }

      const proc = win.process

      // Idle tracking
      if (inputActivityRef.current) {
        const { keystrokes, mouseClicks } = inputActivityRef.current
        if (keystrokes === 0 && mouseClicks === 0) {
          idleConsecutivePollsRef.current++
        } else {
          idleConsecutivePollsRef.current = 0
        }
      }

      // Recalculate when process changes
      if (proc !== lastProcessRef.current) {
        lastProcessRef.current = proc

        // M-B4: momentum bonus — recently active category gets +0.10 for 30 min
        const momentum = momentumRef.current
        const momentumActive = momentum && Date.now() - momentum.changedAt < MOMENTUM_WINDOW_MS

        // Determine inputRate from recent poll data
        const ia = inputActivityRef.current
        const inputRate: SignalSet['inputRate'] =
          ia ? (ia.keystrokes > 0 || ia.mouseClicks > 0 ? 'high' : 'none') : 'none'

        const signals: SignalSet = {
          process: proc,
          title: win.title,
          domain,
          vsWorkspace,
          inputRate,
        }

        const scores = scoreWindow(
          signals,
          allRulesRef.current,
          domainRulesRef.current,
          activeCategoryIdRef.current ?? undefined,
        )

        // Apply momentum bonus to recently-active category (M-B4)
        if (momentumActive && momentum) {
          const entry = scores.find(s => s.categoryId === momentum.categoryId)
          if (entry) entry.score = Math.min(1.0, entry.score + 0.10)
          scores.sort((a, b) => b.score - a.score)
        }

        const topScore = scores[0]
        const catId = topScore && topScore.score >= SCORE_THRESHOLD_AUTO ? topScore.categoryId : null

        if (catId) {
          if (pendingAutoStartRef.current?.categoryId !== catId) {
            if (pendingAutoStartRef.current) clearTimeout(pendingAutoStartRef.current.timeout)
            const timeout = setTimeout(() => {
              const currentlyIdle = inputActivityRef.current !== undefined && idleConsecutivePollsRef.current >= 2
              if (!currentlyIdle) setSuggestedCategoryId(catId)
              pendingAutoStartRef.current = null
            }, DEBOUNCE_MS)
            pendingAutoStartRef.current = { categoryId: catId, timeout }
          }
        } else {
          if (pendingAutoStartRef.current) {
            clearTimeout(pendingAutoStartRef.current.timeout)
            pendingAutoStartRef.current = null
          }
          setSuggestedCategoryId(null)
        }

        // Elevation suggestion
        if (activeCategoryIdRef.current) {
          const matchedRule = matchRule({ title: win.title, process: proc, timestamp: 0 }, allRulesRef.current)
          const hasUserRule = userRules.some(r => r.pattern.toLowerCase() === proc.toLowerCase())
          const isSuggestOnly = matchedRule?.mode === 'suggest' && matchedRule?.categoryId === null
          if (isSuggestOnly && !hasUserRule && !dismissedElevations.has(proc)) {
            setElevationSuggestion({
              process: proc,
              displayName: win.display_name || proc.replace(/\.exe$/i, ''),
              categoryId: activeCategoryIdRef.current,
            })
          } else {
            setElevationSuggestion(null)
          }
        } else {
          setElevationSuggestion(null)
        }
      }

      if (needsClassification(proc, allRulesRef.current)) {
        const displayName = win.display_name || proc.replace(/\.exe$/i, '')
        const iconBase64 = win.icon_base64
        setPendingQueue(prev =>
          prev.some(a => a.process === proc) ? prev : [...prev, { process: proc, displayName, iconBase64 }]
        )
      }
    }, POLL_INTERVAL_MS)

    return () => {
      clearInterval(interval)
      if (pendingAutoStartRef.current) {
        clearTimeout(pendingAutoStartRef.current.timeout)
        pendingAutoStartRef.current = null
      }
    }
  }, [userRules, dismissedElevations])

  const unclassifiedProcess = pendingQueue[0] ?? null

  // M-B2: assign process with correction learning
  const assignProcess = useCallback((process: string, categoryId: string) => {
    // Track correction; if threshold reached, rule is already auto — no extra action needed
    trackCorrection(process, categoryId)

    const rule: WindowRule = {
      id: `user-${Date.now()}`,
      matchType: 'process',
      pattern: process,
      categoryId,
      mode: 'auto',
      enabled: true,
    }
    setUserRules(prev => {
      const next = [...prev, rule]
      saveUserRules(next)
      return next
    })
    setPendingQueue(prev => prev.filter(a => a.process !== process))
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
      saveUserRules(next)
      return next
    })
    setPendingQueue(prev => prev.filter(a => a.process !== process))
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
      saveUserRules(next)
      return next
    })
    setElevationSuggestion(null)
  }, [])

  const dismissElevation = useCallback((process: string) => {
    setDismissedElevations(prev => new Set([...prev, process]))
    setElevationSuggestion(null)
  }, [])

  // M-A1 / M-A2: domain rule assignment
  const assignDomain = useCallback((domain: string, categoryId: string) => {
    const rule: DomainRule = { id: `domain-${Date.now()}`, domain, categoryId }
    setDomainRules(prev => {
      const next = [...prev.filter(r => r.domain !== domain), rule]
      saveDomainRules(next)
      return next
    })
  }, [])

  const resetAutoStart = useCallback(() => {
    lastProcessRef.current = null
  }, [])

  return {
    blocks, unclassifiedProcess, suggestedCategoryId, recentTitles, elevationSuggestion,
    assignProcess, dismissProcess, elevateProcess, dismissElevation, assignDomain, resetAutoStart,
  }
}
