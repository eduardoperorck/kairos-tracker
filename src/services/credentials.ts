/**
 * Secure credential storage backed by the OS credential manager (Windows).
 * Falls back to a Storage setSetting/getSetting on non-Tauri builds.
 *
 * Usage:
 *   await saveCredential('anthropic_api_key', key)
 *   const key = await loadCredential('anthropic_api_key')
 */

async function isTauri(): Promise<boolean> {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function saveCredential(service: string, value: string): Promise<void> {
  if (await isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('save_secret', { service, value })
  }
  // Non-Tauri fallback: plaintext (browser/dev environment only)
}

export async function loadCredential(service: string): Promise<string | null> {
  if (await isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<string | null>('load_secret', { service })
  }
  return null
}

export async function deleteCredential(service: string): Promise<void> {
  if (await isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('delete_secret', { service })
  }
}
