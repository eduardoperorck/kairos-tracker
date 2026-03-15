import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useElapsed } from './useElapsed'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useElapsed', () => {
  it('returns 0 when not running', () => {
    const { result } = renderHook(() => useElapsed(null))
    expect(result.current).toBe(0)
  })

  it('returns elapsed ms when given a startedAt timestamp', () => {
    const startedAt = Date.now()
    const { result } = renderHook(() => useElapsed(startedAt))
    expect(result.current).toBeGreaterThanOrEqual(0)
  })

  it('increments over time when running', () => {
    const startedAt = Date.now()
    const { result } = renderHook(() => useElapsed(startedAt))

    act(() => { vi.advanceTimersByTime(3000) })

    expect(result.current).toBeGreaterThanOrEqual(3000)
  })

  it('stops ticking when startedAt becomes null', () => {
    const startedAt = Date.now()
    const { result, rerender } = renderHook(
      ({ start }: { start: number | null }) => useElapsed(start),
      { initialProps: { start: startedAt as number | null } }
    )

    act(() => { vi.advanceTimersByTime(2000) })
    const snapshot = result.current

    rerender({ start: null })
    act(() => { vi.advanceTimersByTime(2000) })

    expect(result.current).toBe(0)
    expect(snapshot).toBeGreaterThanOrEqual(2000)
  })
})
