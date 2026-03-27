import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToast } from './useToast'

describe('useToast', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('starts with no toast', () => {
    const { result } = renderHook(() => useToast())
    expect(result.current.toast).toBeNull()
  })

  it('showToast sets a message', () => {
    const { result } = renderHook(() => useToast())
    act(() => { result.current.showToast('Rule created') })
    expect(result.current.toast).toBe('Rule created')
  })

  it('toast auto-clears after 3 seconds', () => {
    const { result } = renderHook(() => useToast())
    act(() => { result.current.showToast('Session logged') })
    expect(result.current.toast).toBe('Session logged')
    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current.toast).toBeNull()
  })

  it('showing a new toast replaces the previous one', () => {
    const { result } = renderHook(() => useToast())
    act(() => { result.current.showToast('First') })
    act(() => { result.current.showToast('Second') })
    expect(result.current.toast).toBe('Second')
  })
})
