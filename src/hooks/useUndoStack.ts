import { useState, useCallback } from 'react'

export interface UndoOperation {
  label: string
  undo: () => void | Promise<void>
}

const MAX_STACK = 5

export function useUndoStack() {
  const [stack, setStack] = useState<UndoOperation[]>([])

  const push = useCallback((op: UndoOperation) => {
    setStack(prev => [...prev.slice(-(MAX_STACK - 1)), op])
  }, [])

  const undo = useCallback(async () => {
    setStack(prev => {
      if (prev.length === 0) return prev
      const top = prev[prev.length - 1]
      void Promise.resolve(top.undo())
      return prev.slice(0, -1)
    })
  }, [])

  const clear = useCallback(() => {
    setStack([])
  }, [])

  const lastOperation = stack.length > 0 ? stack[stack.length - 1] : null
  const canUndo = stack.length > 0

  return { push, undo, clear, canUndo, lastOperation }
}
