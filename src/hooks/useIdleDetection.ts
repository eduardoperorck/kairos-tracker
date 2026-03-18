import { useEffect, useRef, useCallback } from 'react'

function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function getIdleSeconds(): Promise<number> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<number>('get_idle_seconds')
  } catch {
    return 0
  }
}

function useBrowserIdleDetection(
  thresholdMinutes: number,
  onIdle: () => void,
  onReturn: (idleMs: number) => void,
  disabled: boolean
) {
  const lastActivityRef = useRef(Date.now())
  const isIdleRef = useRef(false)

  const resetActivity = useCallback(() => {
    if (isIdleRef.current) {
      const idleMs = Date.now() - lastActivityRef.current
      isIdleRef.current = false
      onReturn(idleMs)
    }
    lastActivityRef.current = Date.now()
  }, [onReturn])

  useEffect(() => {
    if (disabled) return

    const events = ['mousemove', 'keypress', 'click', 'touchstart']
    events.forEach(e => window.addEventListener(e, resetActivity, { passive: true }))

    const interval = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current
      if (!isIdleRef.current && idleMs >= thresholdMinutes * 60_000) {
        isIdleRef.current = true
        onIdle()
      }
    }, 30_000)

    return () => {
      events.forEach(e => window.removeEventListener(e, resetActivity))
      clearInterval(interval)
    }
  }, [thresholdMinutes, onIdle, resetActivity, disabled])
}

export function useIdleDetection(
  thresholdMinutes: number,
  onIdle: () => void,
  onReturn: (idleMs: number) => void
) {
  const isIdleRef = useRef(false)
  const idleStartRef = useRef<number | null>(null)
  const tauriAvailable = isTauriAvailable()

  useBrowserIdleDetection(thresholdMinutes, onIdle, onReturn, tauriAvailable)

  useEffect(() => {
    const interval = setInterval(async () => {
      const idleSeconds = await getIdleSeconds()
      const idleMs = idleSeconds * 1000

      if (!isIdleRef.current && idleMs >= thresholdMinutes * 60_000) {
        isIdleRef.current = true
        idleStartRef.current = Date.now() - idleMs
        onIdle()
      } else if (isIdleRef.current && idleMs < thresholdMinutes * 60_000) {
        const totalIdleMs = idleStartRef.current ? Date.now() - idleStartRef.current : 0
        isIdleRef.current = false
        idleStartRef.current = null
        onReturn(totalIdleMs)
      }
    }, 30_000)

    return () => clearInterval(interval)
  }, [thresholdMinutes, onIdle, onReturn])
}
