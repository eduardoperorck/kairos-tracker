import { useEffect } from 'react'

async function invokeUpdateTray(category: string, elapsed: string): Promise<void> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('update_tray_status', { category, elapsed })
  } catch {
    // noop in browser mode
  }
}

export function useTrayStatus(activeCategory: string | null, elapsed: string) {
  useEffect(() => {
    if (activeCategory) {
      invokeUpdateTray(activeCategory, elapsed)
    } else {
      invokeUpdateTray('', 'No active timer')
    }
  }, [activeCategory, elapsed])
}
