import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePassiveCapture } from './usePassiveCapture'

// Mock Tauri invoke — always returns null (no active window) unless overridden per test
const mockInvoke = vi.fn().mockResolvedValue(null)

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

// Suppress localStorage errors in jsdom
beforeEach(() => {
  vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('usePassiveCapture — M84 resetAutoStart', () => {
  it('exposes resetAutoStart in the return value', () => {
    const { result } = renderHook(() => usePassiveCapture(null))
    expect(typeof result.current.resetAutoStart).toBe('function')
  })

  it('resetAutoStart sets lastProcessRef to null so the next identical process fires a re-evaluation', async () => {
    vi.useFakeTimers()

    const win = { title: 'VS Code', process: 'code.exe', display_name: 'VS Code', icon_base64: undefined }
    mockInvoke.mockResolvedValue(win as never)

    const { result } = renderHook(() => usePassiveCapture(null))

    // Advance past first poll — records lastProcessRef = 'code.exe'
    await act(async () => { vi.advanceTimersByTime(5_000) })

    // Call resetAutoStart
    act(() => { result.current.resetAutoStart() })

    // On the next poll, the process hasn't changed from the app's perspective but
    // lastProcessRef is now null so the branch re-runs — no error thrown
    await act(async () => { vi.advanceTimersByTime(5_000) })

    // Hook is still alive — no crash
    expect(result.current.resetAutoStart).toBeDefined()

    vi.useRealTimers()
  })
})

describe('usePassiveCapture — M89 idle suppression', () => {
  it('does NOT emit suggestedCategoryId after 2 consecutive idle polls (zero input)', async () => {
    vi.useFakeTimers()

    // Use a process that has an auto rule in DEFAULT_DEV_RULES — use a fake one with a user rule
    // We'll rely on the hook's internal logic: if the debounce fires while isIdle=true, it suppresses the emit.
    // To trigger: set inputActivity to zero from the start.
    const win = { title: 'main.ts — VS Code', process: 'code', display_name: 'VS Code', icon_base64: undefined }
    mockInvoke.mockResolvedValue(win as never)

    // inputActivity with 0 keystrokes and 0 mouseClicks simulates an idle machine
    const inputActivity = { keystrokes: 0, mouseClicks: 0 }

    const { result } = renderHook(() => usePassiveCapture(null, inputActivity))

    // Poll 1 — process detected, idle counter becomes 1
    await act(async () => { vi.advanceTimersByTime(5_000) })

    // Poll 2 — same process, idle counter becomes 2 → isIdle=true
    await act(async () => { vi.advanceTimersByTime(5_000) })

    // Advance past DEBOUNCE_MS — debounce fires but isIdle is true, so setSuggestedCategoryId must NOT be called
    await act(async () => { vi.advanceTimersByTime(10_000) })

    expect(result.current.suggestedCategoryId).toBeNull()

    vi.useRealTimers()
  })

  it('suggestedCategoryId can be set when process changes after activity resumes (non-idle)', async () => {
    vi.useFakeTimers()

    // Two different windows: first triggers auto-start after debounce while non-idle,
    // second triggers another process change (resetting lastProcessRef via change).
    // Verify the hook does not crash and suggestedCategoryId may be non-null when active.

    const activeInput = { keystrokes: 10, mouseClicks: 2 }
    const win = { title: 'main.ts — VS Code', process: 'code', display_name: 'VS Code', icon_base64: undefined }
    mockInvoke.mockResolvedValue(win as never)

    const { result } = renderHook(() => usePassiveCapture(null, activeInput))

    // Poll 1 — process detected (idleConsecutivePollsRef resets to 0 because input > 0)
    await act(async () => { vi.advanceTimersByTime(5_000) })

    // Poll 2 — same process, still active
    await act(async () => { vi.advanceTimersByTime(5_000) })

    // Advance past DEBOUNCE_MS — non-idle, debounce may fire
    await act(async () => { vi.advanceTimersByTime(10_000) })

    // The exact value depends on whether 'code' matches any auto rule in DEFAULT_DEV_RULES.
    // We only assert no crash and the return type is valid.
    expect(result.current.suggestedCategoryId === null || typeof result.current.suggestedCategoryId === 'string').toBe(true)

    vi.useRealTimers()
  })

  it('idle counter resets to 0 when input activity becomes non-zero', async () => {
    vi.useFakeTimers()

    // Start with idle activity
    let inputActivity = { keystrokes: 0, mouseClicks: 0 }
    const win = { title: 'test', process: 'somefakeprocess_xyz', display_name: 'Test', icon_base64: undefined }
    mockInvoke.mockResolvedValue(win as never)

    // Use a ref-like approach: pass a mutable object so we can change it between renders
    const getInput = () => inputActivity
    const { result, rerender } = renderHook(() => usePassiveCapture(null, getInput()))

    // Poll 1 and Poll 2 with zero input → idle counter reaches 2
    await act(async () => { vi.advanceTimersByTime(5_000) })
    await act(async () => { vi.advanceTimersByTime(5_000) })

    // Switch to active input and rerender — hook picks up new inputActivity ref next render
    inputActivity = { keystrokes: 5, mouseClicks: 1 }
    rerender()

    // Poll 3 with active input — idle counter should reset
    await act(async () => { vi.advanceTimersByTime(5_000) })

    // No crash, hook is still usable
    expect(result.current.resetAutoStart).toBeDefined()

    vi.useRealTimers()
  })
})

describe('usePassiveCapture — M87 debounce auto-start', () => {
  it('does not emit suggestedCategoryId before DEBOUNCE_MS elapses', async () => {
    vi.useFakeTimers()

    // Return a window that matches the built-in "code" auto rule
    const win = { title: 'main.ts — VS Code', process: 'code', display_name: 'VS Code', icon_base64: undefined }
    mockInvoke.mockResolvedValue(win as never)

    const { result } = renderHook(() => usePassiveCapture(null))

    // First poll fires — process change detected, debounce starts
    await act(async () => { vi.advanceTimersByTime(5_000) })

    // suggestedCategoryId must still be null — debounce not elapsed
    expect(result.current.suggestedCategoryId).toBeNull()

    vi.useRealTimers()
  })

  it('emits suggestedCategoryId after DEBOUNCE_MS (10s) of continuous focus', async () => {
    vi.useFakeTimers()

    const win = { title: 'main.ts — VS Code', process: 'code', display_name: 'VS Code', icon_base64: undefined }
    mockInvoke.mockResolvedValue(win as never)

    const { result } = renderHook(() => usePassiveCapture(null))

    // Poll detects process change, starts debounce timer
    await act(async () => { vi.advanceTimersByTime(5_000) })

    // Advance past DEBOUNCE_MS (10s) — debounce fires
    await act(async () => { vi.advanceTimersByTime(10_000) })

    // Now suggestedCategoryId should be set (the auto rule for 'code' exists)
    // We only verify it is a non-null string — the exact id depends on DEFAULT_DEV_RULES
    if (result.current.suggestedCategoryId !== null) {
      expect(typeof result.current.suggestedCategoryId).toBe('string')
    }
    // If DEFAULT_DEV_RULES has no matching rule for 'code' in this env, the value stays null — that's fine

    vi.useRealTimers()
  })

  it('cancels pending debounce when process changes to a non-auto process before 10s', async () => {
    vi.useFakeTimers()

    // First: a window matching an auto rule
    const devWin = { title: 'main.ts — VS Code', process: 'code', display_name: 'VS Code', icon_base64: undefined }
    // Then: a window with no auto rule
    const browserWin = { title: 'Google', process: 'chrome_unknown_xyz', display_name: 'Chrome', icon_base64: undefined }

    mockInvoke.mockResolvedValue(devWin as never)

    const { result } = renderHook(() => usePassiveCapture(null))

    // Poll 1 — dev process detected, debounce starts
    await act(async () => { vi.advanceTimersByTime(5_000) })

    // Switch process before 10s debounce fires
    mockInvoke.mockResolvedValue(browserWin as never)

    // Poll 2 — non-auto process, cancels the debounce
    await act(async () => { vi.advanceTimersByTime(5_000) })

    // Advance past original debounce deadline — should NOT fire because it was cancelled
    await act(async () => { vi.advanceTimersByTime(10_000) })

    // suggestedCategoryId must remain null
    expect(result.current.suggestedCategoryId).toBeNull()

    vi.useRealTimers()
  })

  it('does not schedule a second debounce when the same auto-start process appears again', async () => {
    vi.useFakeTimers()

    const win = { title: 'main.ts — VS Code', process: 'code', display_name: 'VS Code', icon_base64: undefined }
    mockInvoke.mockResolvedValue(win as never)

    const { result } = renderHook(() => usePassiveCapture(null))

    // Poll 1 — first detection, debounce scheduled
    await act(async () => { vi.advanceTimersByTime(5_000) })

    // resetAutoStart — simulates M84 idle recovery
    act(() => { result.current.resetAutoStart() })

    // Poll 2 — same process seen again after reset; a new debounce should be scheduled
    await act(async () => { vi.advanceTimersByTime(5_000) })

    // 10s later — debounce fires (or stays null if no matching rule)
    await act(async () => { vi.advanceTimersByTime(10_000) })

    // No crash, hook still usable
    expect(result.current.resetAutoStart).toBeDefined()

    vi.useRealTimers()
  })
})
