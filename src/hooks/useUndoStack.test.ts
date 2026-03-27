import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUndoStack } from './useUndoStack'

describe('useUndoStack', () => {
  it('starts with an empty stack', () => {
    const { result } = renderHook(() => useUndoStack())
    expect(result.current.canUndo).toBe(false)
    expect(result.current.lastOperation).toBeNull()
  })

  it('push adds an operation and canUndo becomes true', () => {
    const { result } = renderHook(() => useUndoStack())
    const undo = vi.fn()
    act(() => { result.current.push({ label: 'Category archived', undo }) })
    expect(result.current.canUndo).toBe(true)
    expect(result.current.lastOperation?.label).toBe('Category archived')
  })

  it('undo calls the undo function and pops the stack', async () => {
    const { result } = renderHook(() => useUndoStack())
    const undo = vi.fn().mockResolvedValue(undefined)
    act(() => { result.current.push({ label: 'Category archived', undo }) })
    await act(async () => { await result.current.undo() })
    expect(undo).toHaveBeenCalledOnce()
    expect(result.current.canUndo).toBe(false)
  })

  it('keeps at most 5 operations', () => {
    const { result } = renderHook(() => useUndoStack())
    act(() => {
      for (let i = 0; i < 7; i++) {
        result.current.push({ label: `Op ${i}`, undo: vi.fn() })
      }
    })
    // Undo 5 times should succeed, 6th should be no-op
    expect(result.current.canUndo).toBe(true)
    // The last operation should be the most recent one (Op 6)
    expect(result.current.lastOperation?.label).toBe('Op 6')
  })

  it('undo is a no-op when stack is empty', async () => {
    const { result } = renderHook(() => useUndoStack())
    await act(async () => { await result.current.undo() }) // should not throw
    expect(result.current.canUndo).toBe(false)
  })

  it('clear empties the stack', () => {
    const { result } = renderHook(() => useUndoStack())
    act(() => { result.current.push({ label: 'Test', undo: vi.fn() }) })
    act(() => { result.current.clear() })
    expect(result.current.canUndo).toBe(false)
  })
})
