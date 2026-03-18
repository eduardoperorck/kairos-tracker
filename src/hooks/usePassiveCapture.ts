import { useState, useEffect, useRef, useCallback } from 'react'
import { aggregateBlocks, DEFAULT_DEV_RULES } from '../domain/passiveCapture'
import type { CaptureBlock, RawPollEvent, WindowRule } from '../domain/passiveCapture'

const POLL_INTERVAL_MS = 5_000
const MAX_EVENTS = 1440

const STORAGE_KEY = 'user_window_rules'

function loadUserRules(): WindowRule[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch { return [] }
}

function saveUserRules(rules: WindowRule[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}

async function fetchActiveWindow(): Promise<{ title: string; process: string } | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<{ title: string; process: string } | null>('get_active_window')
  } catch {
    return null
  }
}

export type PassiveCaptureResult = {
  blocks: CaptureBlock[]
  unclassifiedProcess: string | null  // most recent unclassified process
  assignProcess: (process: string, categoryId: string) => void
  dismissProcess: (process: string) => void
}

export function usePassiveCapture(): PassiveCaptureResult {
  const [blocks, setBlocks] = useState<CaptureBlock[]>([])
  const [userRules, setUserRules] = useState<WindowRule[]>(() => loadUserRules())
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const eventsRef = useRef<RawPollEvent[]>([])

  const allRules = [...DEFAULT_DEV_RULES, ...userRules]

  useEffect(() => {
    const interval = setInterval(async () => {
      const window = await fetchActiveWindow()
      if (!window) return

      const event: RawPollEvent = {
        window: { ...window, timestamp: Date.now() },
        timestamp: Date.now(),
      }

      eventsRef.current = [...eventsRef.current.slice(-MAX_EVENTS), event]
      setBlocks(aggregateBlocks(eventsRef.current, allRules))
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [userRules])

  // Most recent unclassified process (not dismissed, not in any rule)
  const unclassifiedProcess = (() => {
    if (eventsRef.current.length === 0) return null
    const last = eventsRef.current[eventsRef.current.length - 1]
    const proc = last.window.process
    if (dismissed.has(proc)) return null
    const hasRule = allRules.some(r => r.matchType === 'process' && r.pattern.toLowerCase() === proc.toLowerCase())
    return hasRule ? null : proc
  })()

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
  }, [])

  const dismissProcess = useCallback((process: string) => {
    // Add as 'ignore' rule so it never prompts again
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
    setDismissed(prev => new Set([...prev, process]))
  }, [])

  return { blocks, unclassifiedProcess, assignProcess, dismissProcess }
}
