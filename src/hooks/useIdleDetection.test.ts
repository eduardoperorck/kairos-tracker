import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIdleDetection } from './useIdleDetection'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(0),
}))

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  delete (window as Record<string, unknown>)['__TAURI_INTERNALS__']
})

function setTauriAvailable(value: boolean) {
  if (value) {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true, writable: true })
  } else {
    delete (window as Record<string, unknown>)['__TAURI_INTERNALS__']
  }
}

describe('useIdleDetection — browser fallback (no Tauri)', () => {
  beforeEach(() => setTauriAvailable(false))

  it('triggers onIdle after threshold with no browser events', async () => {
    const onIdle = vi.fn()
    renderHook(() => useIdleDetection(1, onIdle, vi.fn()))

    await act(async () => { vi.advanceTimersByTime(90_000) }) // 1.5 min

    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('does NOT trigger onIdle when user is active (events reset timer)', async () => {
    const onIdle = vi.fn()
    renderHook(() => useIdleDetection(1, onIdle, vi.fn()))

    // Simulate activity every 20 seconds
    for (let i = 0; i < 5; i++) {
      await act(async () => { vi.advanceTimersByTime(20_000) })
      window.dispatchEvent(new Event('mousemove'))
    }

    expect(onIdle).not.toHaveBeenCalled()
  })
})

describe('useIdleDetection — OS layer (Tauri available)', () => {
  beforeEach(() => setTauriAvailable(true))

  it('does NOT fire onIdle from lack of browser events alone', async () => {
    // OS says user is active (0 seconds idle)
    const { invoke } = await import('@tauri-apps/api/core')
    vi.mocked(invoke).mockResolvedValue(0)

    const onIdle = vi.fn()
    renderHook(() => useIdleDetection(10, onIdle, vi.fn()))

    // 11 minutes with no browser events — would trigger browser layer
    await act(async () => { vi.advanceTimersByTime(11 * 60_000) })

    expect(onIdle).not.toHaveBeenCalled()
  })

  it('fires onIdle when OS reports idle >= threshold', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    vi.mocked(invoke).mockResolvedValue(600) // 10 minutes in seconds

    const onIdle = vi.fn()
    renderHook(() => useIdleDetection(10, onIdle, vi.fn()))

    await act(async () => { vi.advanceTimersByTime(30_001) })

    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('fires onReturn when OS idle drops below threshold after being idle', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    vi.mocked(invoke).mockResolvedValue(600) // initially idle

    const onReturn = vi.fn()
    renderHook(() => useIdleDetection(10, vi.fn(), onReturn))

    await act(async () => { vi.advanceTimersByTime(30_001) }) // trigger idle

    vi.mocked(invoke).mockResolvedValue(5) // user returned
    await act(async () => { vi.advanceTimersByTime(30_001) })

    expect(onReturn).toHaveBeenCalledTimes(1)
  })
})
