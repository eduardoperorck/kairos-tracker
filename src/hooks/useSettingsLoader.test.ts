import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSettingsLoader } from './useSettingsLoader'
import { FOCUS_PRESETS } from '../domain/focusGuard'

vi.mock('../services/credentials', () => ({
  loadCredential: vi.fn().mockResolvedValue(null),
}))

function makeStorage(overrides: Record<string, any> = {}) {
  return {
    getSetting: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as any
}

describe('useSettingsLoader', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('initialises with null values', () => {
    const { result } = renderHook(() => useSettingsLoader({ storage: makeStorage() }))
    expect(result.current.claudeApiKey).toBeNull()
    expect(result.current.githubUsername).toBeNull()
    expect(result.current.workspaceRoot).toBeNull()
    expect(result.current.screenshotsEnabled).toBe(false)
  })

  it('loads github username from storage', async () => {
    const storage = makeStorage({
      getSetting: vi.fn().mockImplementation((key: string) => {
        if (key === 'github_username') return Promise.resolve('octocat')
        return Promise.resolve(null)
      }),
    })
    const { result } = renderHook(() => useSettingsLoader({ storage }))
    await waitFor(() => expect(result.current.githubUsername).toBe('octocat'))
  })

  it('loads screenshotsEnabled from storage', async () => {
    const storage = makeStorage({
      getSetting: vi.fn().mockImplementation((key: string) => {
        if (key === 'screenshots_enabled') return Promise.resolve('true')
        return Promise.resolve(null)
      }),
    })
    const { result } = renderHook(() => useSettingsLoader({ storage }))
    await waitFor(() => expect(result.current.screenshotsEnabled).toBe(true))
  })

  it('calls setFocusPreset when a valid preset is found in storage', async () => {
    const presetName = FOCUS_PRESETS[1].name
    const storage = makeStorage({
      getSetting: vi.fn().mockImplementation((key: string) => {
        if (key === 'focus_preset') return Promise.resolve(presetName)
        return Promise.resolve(null)
      }),
    })
    const setFocusPreset = vi.fn()
    renderHook(() => useSettingsLoader({ storage, setFocusPreset }))
    await waitFor(() => expect(setFocusPreset).toHaveBeenCalledWith(FOCUS_PRESETS[1]))
  })

  it('calls setFocusStrictMode when strict mode is enabled in storage', async () => {
    const storage = makeStorage({
      getSetting: vi.fn().mockImplementation((key: string) => {
        if (key === 'focus_strict_mode') return Promise.resolve('true')
        return Promise.resolve(null)
      }),
    })
    const setFocusStrictMode = vi.fn()
    renderHook(() => useSettingsLoader({ storage, setFocusStrictMode }))
    await waitFor(() => expect(setFocusStrictMode).toHaveBeenCalledWith(true))
  })
})
