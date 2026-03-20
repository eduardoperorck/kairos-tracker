import { useEffect } from 'react'
import { translations } from '../i18n'
import type { Lang } from '../i18n'

async function invokeUpdateTray(category: string, elapsed: string): Promise<void> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('update_tray_status', { category, elapsed })
  } catch {
    // noop in browser mode
  }
}

function getCurrentLang(): Lang {
  return localStorage.getItem('lang') === 'pt' ? 'pt' : 'en'
}

export function useTrayStatus(activeCategory: string | null, elapsed: string) {
  useEffect(() => {
    if (activeCategory) {
      invokeUpdateTray(activeCategory, elapsed)
    } else {
      const lang = getCurrentLang()
      invokeUpdateTray('', translations[lang]['tray.noTimer'])
    }
  }, [activeCategory, elapsed])
}
