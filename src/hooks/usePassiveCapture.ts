import { useState, useEffect, useRef, useCallback } from 'react'
import type { InputActivity } from '../domain/inputIntelligence'
import { aggregateBlocks, needsClassification, getAutoStartCategory, matchRule, DEFAULT_DEV_RULES } from '../domain/passiveCapture'
import type { CaptureBlock, RawPollEvent, WindowRule, UnclassifiedApp } from '../domain/passiveCapture'

const POLL_INTERVAL_MS = 5_000
const MAX_EVENTS = 1440
const DEBOUNCE_MS = 10_000

const STORAGE_KEY = 'user_window_rules'

function loadUserRules(): WindowRule[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch { return [] }
}

function saveUserRules(rules: WindowRule[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}

type TauriWindow = { title: string; process: string; display_name: string; icon_base64?: string }

async function fetchActiveWindow(): Promise<TauriWindow | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<TauriWindow | null>('get_active_window')
  } catch {
    return null
  }
}

export type ElevationSuggestion = {
  process: string
  displayName: string
  categoryId: string  // category that is currently running
}

export type PassiveCaptureResult = {
  blocks: CaptureBlock[]
  unclassifiedProcess: UnclassifiedApp | null
  suggestedCategoryId: string | null   // non-null when active window matches an auto rule
  recentTitles: string[]               // last MAX_TITLES unique window titles (newest first)
  elevationSuggestion: ElevationSuggestion | null  // offer to elevate suggest → auto
  assignProcess: (process: string, categoryId: string) => void
  dismissProcess: (process: string) => void
  elevateProcess: (process: string, categoryId: string) => void
  dismissElevation: (process: string) => void
  resetAutoStart: () => void
}

const MAX_TITLES = 20

export function usePassiveCapture(
  activeCategoryId: string | null = null,
  inputActivity?: Pick<InputActivity, 'keystrokes' | 'mouseClicks'>
): PassiveCaptureResult {
  const [blocks, setBlocks] = useState<CaptureBlock[]>([])
  const [userRules, setUserRules] = useState<WindowRule[]>(() => loadUserRules())
  const [pendingQueue, setPendingQueue] = useState<UnclassifiedApp[]>([])
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string | null>(null)
  const [recentTitles, setRecentTitles] = useState<string[]>([])
  const [elevationSuggestion, setElevationSuggestion] = useState<ElevationSuggestion | null>(null)
  const [dismissedElevations, setDismissedElevations] = useState<Set<string>>(new Set())
  const eventsRef = useRef<RawPollEvent[]>([])
  const lastProcessRef = useRef<string | null>(null)
  const pendingAutoStartRef = useRef<{ categoryId: string; timeout: ReturnType<typeof setTimeout> } | null>(null)
  const idleConsecutivePollsRef = useRef(0)
  const inputActivityRef = useRef(inputActivity)
  useEffect(() => { inputActivityRef.current = inputActivity }, [inputActivity])

  const activeCategoryIdRef = useRef(activeCategoryId)
  useEffect(() => { activeCategoryIdRef.current = activeCategoryId }, [activeCategoryId])

  const allRules = [...DEFAULT_DEV_RULES, ...userRules]

  useEffect(() => {
    const interval = setInterval(async () => {
      const win = await fetchActiveWindow()
      if (!win) return

      const event: RawPollEvent = {
        window: { title: win.title, process: win.process, timestamp: Date.now() },
        timestamp: Date.now(),
      }

      eventsRef.current = [...eventsRef.current.slice(-MAX_EVENTS), event]
      setBlocks(aggregateBlocks(eventsRef.current, allRules))

      // Keep a deduplicated list of recent titles (newest first)
      if (win.title) {
        setRecentTitles(prev => {
          const without = prev.filter(t => t !== win.title)
          return [win.title, ...without].slice(0, MAX_TITLES)
        })
      }

      const proc = win.process

      // M89: track consecutive idle polls (no keystrokes or mouse clicks)
      if (inputActivityRef.current) {
        if (inputActivityRef.current.keystrokes === 0 && inputActivityRef.current.mouseClicks === 0) {
          idleConsecutivePollsRef.current++
        } else {
          idleConsecutivePollsRef.current = 0
        }
      }
      // Auto-start: only recalculate when the active process changes
      if (proc !== lastProcessRef.current) {
        lastProcessRef.current = proc
        const catId = getAutoStartCategory({ process: proc, title: win.title }, allRules)

        // M87: debounce auto-start — require 10s of continuous focus before firing
        if (catId) {
          if (pendingAutoStartRef.current?.categoryId !== catId) {
            // Different category (or no pending) — cancel existing and schedule new
            if (pendingAutoStartRef.current) {
              clearTimeout(pendingAutoStartRef.current.timeout)
            }
            const timeout = setTimeout(() => {
              // M89: suppress auto-start when the foreground app has been idle.
              // Read ref at fire-time (not at schedule-time) to avoid stale closure.
              const currentlyIdle = inputActivityRef.current !== undefined && idleConsecutivePollsRef.current >= 2
              if (!currentlyIdle) {
                setSuggestedCategoryId(catId)
              }
              pendingAutoStartRef.current = null
            }, DEBOUNCE_MS)
            pendingAutoStartRef.current = { categoryId: catId, timeout }
          }
          // else: same category already pending — do nothing, let it fire
        } else {
          // No auto-rule for this process — cancel any pending auto-start
          if (pendingAutoStartRef.current) {
            clearTimeout(pendingAutoStartRef.current.timeout)
            pendingAutoStartRef.current = null
          }
          setSuggestedCategoryId(null)
        }

        // Elevation suggestion: process matches a suggest rule with no categoryId
        // AND a timer is running AND no user rule already covers this process
        if (activeCategoryIdRef.current) {
          const matchedRule = matchRule({ title: win.title, process: proc, timestamp: 0 }, allRules)
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

      if (needsClassification(proc, allRules)) {
        const displayName = win.display_name || proc.replace(/\.exe$/i, '')
        const iconBase64  = win.icon_base64
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
  }, [userRules])

  // First in queue is the one shown to the user
  const unclassifiedProcess = pendingQueue[0] ?? null

  const assignProcess = useCallback((process: string, categoryId: string) => {
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

  const resetAutoStart = useCallback(() => {
    lastProcessRef.current = null
  }, [])

  return { blocks, unclassifiedProcess, suggestedCategoryId, recentTitles, elevationSuggestion, assignProcess, dismissProcess, elevateProcess, dismissElevation, resetAutoStart }
}
