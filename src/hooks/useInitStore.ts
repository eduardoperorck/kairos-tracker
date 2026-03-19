import { useEffect } from 'react'
import { useTimerStore } from '../store/useTimerStore'
import { computeTodayMs, toDateString, getWeekDates } from '../domain/timer'
import type { Storage } from '../persistence/storage'

function daysAgo(n: number, today: string): string {
  const d = new Date(today + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

export function useInitStore(storage: Storage) {
  useEffect(() => {
    const today = toDateString(Date.now())
    const weekDates = getWeekDates(today)
    const historyStart = daysAgo(7, today)

    Promise.all([
      storage.loadCategories(),
      storage.loadSessionsSince(historyStart),
      storage.loadActiveEntry(),
    ]).then(([persisted, allSessions, activeEntry]) => {
      const todaySessions = allSessions.filter(s => s.date === today)
      const weekSet = new Set(weekDates)
      const weekSessions = allSessions.filter(s => weekSet.has(s.date))

      const categories = persisted.length > 0
        ? persisted.map(cat => ({
            id: cat.id,
            name: cat.name,
            weeklyGoalMs: cat.weeklyGoalMs,
            color: cat.color,
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
    }).catch(err => {
      console.error('[useInitStore] Storage init failed:', err)
      useTimerStore.setState({ initError: true })
    })
  }, [])
}
