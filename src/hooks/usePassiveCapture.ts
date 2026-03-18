import { useState, useEffect, useRef, useCallback } from 'react'
import { aggregateBlocks, needsClassification, getAutoStartCategory, DEFAULT_DEV_RULES } from '../domain/passiveCapture'
import type { CaptureBlock, RawPollEvent, WindowRule, UnclassifiedApp } from '../domain/passiveCapture'

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

type TauriWindow = { title: string; process: string; display_name: string; icon_base64?: string }

async function fetchActiveWindow(): Promise<TauriWindow | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<TauriWindow | null>('get_active_window')
  } catch {
    return null
  }
}

export type PassiveCaptureResult = {
  blocks: CaptureBlock[]
  unclassifiedProcess: UnclassifiedApp | null
  suggestedCategoryId: string | null   // non-null when active window matches an auto rule
  assignProcess: (process: string, categoryId: string) => void
  dismissProcess: (process: string) => void
}

export function usePassiveCapture(): PassiveCaptureResult {
  const [blocks, setBlocks] = useState<CaptureBlock[]>([])
  const [userRules, setUserRules] = useState<WindowRule[]>(() => loadUserRules())
  const [pendingQueue, setPendingQueue] = useState<UnclassifiedApp[]>([])
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string | null>(null)
  const eventsRef = useRef<RawPollEvent[]>([])
  const lastProcessRef = useRef<string | null>(null)

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

      const proc = win.process

      // Auto-start: only recalculate when the active process changes
      if (proc !== lastProcessRef.current) {
        lastProcessRef.current = proc
        const catId = getAutoStartCategory({ process: proc, title: win.title }, allRules)
        setSuggestedCategoryId(catId)
      }

      if (needsClassification(proc, allRules)) {
        const displayName = win.display_name || proc.replace(/\.exe$/i, '')
        const iconBase64  = win.icon_base64
        setPendingQueue(prev =>
          prev.some(a => a.process === proc) ? prev : [...prev, { process: proc, displayName, iconBase64 }]
        )
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

  return { blocks, unclassifiedProcess, suggestedCategoryId, assignProcess, dismissProcess }
}
