import { useEffect, useRef } from 'react'
import { useTimerStore } from '../store/useTimerStore'
import { computeTodayMs, toDateString, getWeekDates } from '../domain/timer'
import type { Storage } from '../persistence/storage'

function daysAgo(n: number, today: string): string {
  const d = new Date(today + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

export function useInitStore(storage: Storage) {
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    const today = toDateString(Date.now())
    const weekDates = getWeekDates(today)
    const historyStart = daysAgo(7, today)
    const since91 = daysAgo(91, today)
    const since14 = daysAgo(14, today)

    Promise.all([
      storage.loadCategories(),
      storage.loadSessionsSince(historyStart),
      storage.loadActiveEntry(),
      storage.loadDailyCaptureStatsSince(since14),
    ]).then(([persisted, allSessions, activeEntry, _captureStats]) => {
      // _captureStats loaded for future use (M67 display). Suppressing lint warning intentionally.
      void _captureStats
      const todaySessions = allSessions.filter(s => s.date === today)
      const weekSet = new Set(weekDates)
      const weekSessions = allSessions.filter(s => weekSet.has(s.date))

      const categories = persisted.length > 0
        ? persisted.map(cat => ({
            id: cat.id,
            name: cat.name,
            weeklyGoalMs: cat.weeklyGoalMs,
            color: cat.color,
            archived: cat.archived,
            accumulatedMs: computeTodayMs(todaySessions, cat.id, today),
            // Restore active timer if this category was running when app last closed/crashed
            activeEntry: activeEntry?.categoryId === cat.id
              ? { startedAt: activeEntry.startedAt, endedAt: null }
              : null,
          }))
        : undefined

      useTimerStore.setState({
        sessions: weekSessions,
        historySessions: allSessions,
        ...(categories ? { categories } : {}),
      })

      // Background: load full 91-day history for heatmap (after first render)
      storage.loadSessionsSince(since91).then(fullHistory => {
        useTimerStore.setState(state => {
          const existingIds = new Set(state.historySessions.map(s => s.id))
          const newSessions = fullHistory.filter(s => !existingIds.has(s.id))
          if (newSessions.length === 0) return state
          return { historySessions: [...state.historySessions, ...newSessions] }
        })
      }).catch(err => {
        console.warn('[useInitStore] Background history load failed:', err)
      })
    }).catch(err => {
      console.error('[useInitStore] Storage init failed:', err)
      useTimerStore.setState({ initError: true })
    })
  }, [storage])
}
