import { useState, useEffect, useCallback } from 'react'

async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

export function useScreenshots(date: string, enabled: boolean) {
  const [paths, setPaths] = useState<string[]>([])

  const refresh = useCallback(async () => {
    if (!enabled || !date) return
    try {
      const result = await invokeTauri<string[]>('list_screenshots', { date })
      setPaths(result)
    } catch {
      // Not in Tauri or not Windows — silently ignore
    }
  }, [date, enabled])

  useEffect(() => { refresh() }, [refresh])

  async function capture(outputPath: string): Promise<void> {
    await invokeTauri('capture_screenshot', { outputPath })
    await refresh()
  }

  return { paths, capture, refresh }
}
