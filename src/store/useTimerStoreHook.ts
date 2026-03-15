import { useStore } from 'zustand'
import { useTimerStore, type TimerStore } from './useTimerStore'

export function useTimerState(): TimerStore {
  return useStore(useTimerStore)
}
