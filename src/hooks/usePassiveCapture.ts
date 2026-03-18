import { useState, useEffect, useRef, useCallback } from 'react'
import { aggregateBlocks, needsClassification, DEFAULT_DEV_RULES } from '../domain/passiveCapture'
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
  // Queue of processes seen but not yet classified, in order of first appearance
  const [pendingQueue, setPendingQueue] = useState<string[]>([])
  const eventsRef = useRef<RawPollEvent[]>([])

  const allRules = [...DEFAULT_DEV_RULES, ...userRules]

  useEffect(() => {
    const interval = setInterval(async () => {
      const win = await fetchActiveWindow()
      if (!win) return

      const event: RawPollEvent = {
        window: { ...win, timestamp: Date.now() },
        timestamp: Date.now(),
      }

      eventsRef.current = [...eventsRef.current.slice(-MAX_EVENTS), event]
      setBlocks(aggregateBlocks(eventsRef.current, allRules))

      const proc = win.process
      if (needsClassification(proc, allRules)) {
        setPendingQueue(prev => prev.includes(proc) ? prev : [...prev, proc])
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
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
    setPendingQueue(prev => prev.filter(p => p !== process))
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
    setPendingQueue(prev => prev.filter(p => p !== process))
  }, [])

  return { blocks, unclassifiedProcess, assignProcess, dismissProcess }
}
