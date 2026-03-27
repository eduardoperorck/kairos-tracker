import { useState, useEffect } from 'react'
import { shouldTriggerBreak, FOCUS_PRESETS, type FocusPreset } from '../domain/focusGuard'

const POSTPONE_MS = 5 * 60_000

interface Deps {
  activeStartedAt: number | null
  activeCategoryId: string | null
}

export function useFocusGuardState({ activeStartedAt, activeCategoryId }: Deps) {
  const [focusPreset, setFocusPreset] = useState<FocusPreset>(FOCUS_PRESETS[0])
  const [focusStrictMode, setFocusStrictMode] = useState(false)
  const [breakActive, setBreakActive] = useState(false)
  const [postponedUntil, setPostponedUntil] = useState<number | null>(null)
  const [postponeUsed, setPostponeUsed] = useState(false)
  const [breakSkipCount, setBreakSkipCount] = useState(0)
  const [breakCompletedCount, setBreakCompletedCount] = useState(0)
  const [tick, setTick] = useState(0)

  // Reset break state when active category changes
  useEffect(() => {
    setBreakActive(false)
    setPostponedUntil(null)
    setPostponeUsed(false)
  }, [activeCategoryId])

  // 30-second tick to re-evaluate shouldShowBreak
  useEffect(() => {
    if (!activeStartedAt) return
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [activeStartedAt])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void tick // consumed to trigger re-render

  const now = Date.now()
  const postponeBlocked = postponedUntil !== null && now < postponedUntil
  const shouldShowBreak = !breakActive
    && !postponeBlocked
    && activeStartedAt !== null
    && shouldTriggerBreak(activeStartedAt, now, focusPreset.workMs)

  function handlePostpone() {
    setPostponedUntil(Date.now() + POSTPONE_MS)
    setPostponeUsed(true)
  }

  return {
    focusPreset, setFocusPreset,
    focusStrictMode,
    setFocusStrictMode,
    breakActive,
    setBreakActive,
    postponeUsed,
    breakSkipCount,
    setBreakSkipCount,
    breakCompletedCount,
    setBreakCompletedCount,
    shouldShowBreak,
    handlePostpone,
  }
}
