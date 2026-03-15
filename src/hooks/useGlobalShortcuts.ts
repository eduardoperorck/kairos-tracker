type ShortcutConfig = {
  toggleTimer: string  // default: 'Ctrl+Shift+T'
  focusWindow: string  // default: 'Ctrl+Shift+Space'
}

const DEFAULT_SHORTCUTS: ShortcutConfig = {
  toggleTimer: 'Ctrl+Shift+T',
  focusWindow: 'Ctrl+Shift+Space',
}

export async function registerGlobalShortcuts(
  config: Partial<ShortcutConfig>,
  onToggleTimer: () => void
): Promise<() => void> {
  const shortcuts = { ...DEFAULT_SHORTCUTS, ...config }

  try {
    const { register } = await import(/* @vite-ignore */ '@tauri-apps/plugin-global-shortcut')

    await register(shortcuts.toggleTimer, () => {
      onToggleTimer()
    })

    return async () => {
      try {
        const { unregister } = await import(/* @vite-ignore */ '@tauri-apps/plugin-global-shortcut')
        await unregister(shortcuts.toggleTimer)
      } catch {
        // noop
      }
    }
  } catch {
    // noop in browser mode
    return () => {}
  }
}

export function useGlobalShortcuts(onToggleTimer: () => void, config?: Partial<ShortcutConfig>) {
  // Returns a cleanup function; call in useEffect
  return () => registerGlobalShortcuts(config ?? {}, onToggleTimer)
}
