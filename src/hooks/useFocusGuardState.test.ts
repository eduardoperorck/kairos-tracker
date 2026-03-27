import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFocusGuardState } from './useFocusGuardState'
import { FOCUS_PRESETS } from '../domain/focusGuard'

const NOW = 1_700_000_000_000
const WORK_MS = FOCUS_PRESETS[0].workMs // default preset work duration

describe('useFocusGuardState', () => {
  beforeEach(() => {
    vi.setSystemTime(NOW)
  })

  it('initialises with default focus preset and no break', () => {
    const { result } = renderHook(() =>
      useFocusGuardState({ activeStartedAt: null, activeCategoryId: null })
    )
    expect(result.current.focusPreset).toEqual(FOCUS_PRESETS[0])
    expect(result.current.breakActive).toBe(false)
    expect(result.current.shouldShowBreak).toBe(false)
  })

  it('shouldShowBreak is false when session is too short', () => {
    const { result } = renderHook(() =>
      useFocusGuardState({ activeStartedAt: NOW - 1_000, activeCategoryId: 'c1' })
    )
    expect(result.current.shouldShowBreak).toBe(false)
  })

  it('shouldShowBreak is true after work interval elapses', () => {
    const { result } = renderHook(() =>
      useFocusGuardState({ activeStartedAt: NOW - WORK_MS - 1_000, activeCategoryId: 'c1' })
    )
    expect(result.current.shouldShowBreak).toBe(true)
  })

  it('shouldShowBreak is false when breakActive is true', () => {
    const { result } = renderHook(() =>
      useFocusGuardState({ activeStartedAt: NOW - WORK_MS - 1_000, activeCategoryId: 'c1' })
    )
    act(() => { result.current.setBreakActive(true) })
    expect(result.current.shouldShowBreak).toBe(false)
  })

  it('handlePostpone blocks break for POSTPONE_MS and marks postponeUsed', () => {
    const { result } = renderHook(() =>
      useFocusGuardState({ activeStartedAt: NOW - WORK_MS - 1_000, activeCategoryId: 'c1' })
    )
    expect(result.current.postponeUsed).toBe(false)
    act(() => { result.current.handlePostpone() })
    expect(result.current.postponeUsed).toBe(true)
    expect(result.current.shouldShowBreak).toBe(false) // blocked by postpone
  })

  it('resets break state when activeCategoryId changes', () => {
    let activeCategoryId = 'c1'
    const { result, rerender } = renderHook(() =>
      useFocusGuardState({ activeStartedAt: NOW - WORK_MS - 1_000, activeCategoryId })
    )
    act(() => { result.current.setBreakActive(true) })
    expect(result.current.breakActive).toBe(true)
    activeCategoryId = 'c2'
    rerender()
    expect(result.current.breakActive).toBe(false)
  })

  it('setFocusPreset updates the preset state', () => {
    const { result } = renderHook(() =>
      useFocusGuardState({ activeStartedAt: null, activeCategoryId: null })
    )
    const newPreset = FOCUS_PRESETS[1]
    act(() => { result.current.setFocusPreset(newPreset) })
    expect(result.current.focusPreset).toEqual(newPreset)
  })
})
