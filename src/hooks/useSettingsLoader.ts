import { useState, useEffect } from 'react'
import { FOCUS_PRESETS, type FocusPreset } from '../domain/focusGuard'
import { SettingKey } from '../persistence/storage'
import type { Storage } from '../persistence/storage'
import { loadCredential } from '../services/credentials'

interface Deps {
  storage: Pick<Storage, 'getSetting'>
  setFocusPreset?: (preset: FocusPreset) => void
  setFocusStrictMode?: (strict: boolean) => void
}

export function useSettingsLoader({ storage, setFocusPreset, setFocusStrictMode }: Deps) {
  const [claudeApiKey, setClaudeApiKey] = useState<string | null>(null)
  const [githubUsername, setGithubUsername] = useState<string | null>(null)
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null)
  const [screenshotsEnabled, setScreenshotsEnabled] = useState(false)

  useEffect(() => {
    Promise.all([
      storage.getSetting(SettingKey.FocusPreset),
      storage.getSetting(SettingKey.FocusStrictMode),
      loadCredential(SettingKey.AnthropicApiKey),
      storage.getSetting(SettingKey.GithubUsername),
      storage.getSetting(SettingKey.ScreenshotsEnabled),
      storage.getSetting(SettingKey.WorkspaceRoot),
    ]).then(([preset, strict, apiKey, ghUser, screenshots, wsRoot]) => {
      setClaudeApiKey(apiKey)
      setGithubUsername(ghUser)
      setScreenshotsEnabled(screenshots === 'true')
      setWorkspaceRoot(wsRoot)
      if (preset) {
        const found = FOCUS_PRESETS.find(p => p.name === preset)
        if (found) setFocusPreset?.(found)
      }
      if (strict === 'true') setFocusStrictMode?.(true)
    }).catch(err => {
      console.error('[useSettingsLoader] Failed to load settings:', err)
    })
  }, [])

  return { claudeApiKey, setClaudeApiKey, githubUsername, setGithubUsername, workspaceRoot, setWorkspaceRoot, screenshotsEnabled, setScreenshotsEnabled }
}
