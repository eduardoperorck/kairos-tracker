import type { Session } from './timer'
import { computeHourDistribution } from './history'

/** Returns the top 1-2 focus hours as human-readable ranges, e.g. "9am–11am".
 *  Returns null if there are fewer than 7 distinct session days (not enough data). */
export function computePeakHoursLabel(sessions: Session[]): string | null {
  const days = new Set(sessions.map(s => s.date))
  if (days.size < 7) return null
  const dist = computeHourDistribution(sessions)
  if (dist.length === 0) return null
  const sorted = [...dist].sort((a, b) => b.totalMs - a.totalMs)
  const top = sorted[0]
  const start = top.hour
  const end = start + 2
  function fmt(h: number) {
    if (h === 0) return '12am'
    if (h < 12) return `${h}am`
    if (h === 12) return '12pm'
    return `${h - 12}pm`
  }
  return `${fmt(start)}–${fmt(end)}`
}

export interface DailyInsights {
  todayMs: number
  averageDailyMs: number
  aboveAverage: boolean
  topStreak: { categoryId: string; days: number } | null
  peakHoursLabel: string | null
}

export function computeDailyInsights(
  sessions: Session[],
  today: string,
  streaks: Record<string, number> = {},
): DailyInsights {
  const todaySessions = sessions.filter(s => s.date === today)
  const todayMs = todaySessions.reduce((sum, s) => sum + (s.endedAt - s.startedAt), 0)

  // Average from 7 days prior to today
  const todayTime = new Date(today + 'T12:00:00Z').getTime()
  const pastSessions = sessions.filter(s => {
    const d = new Date(s.date + 'T12:00:00Z').getTime()
    return d < todayTime && d >= todayTime - 7 * 86_400_000
  })
  const pastTotal = pastSessions.reduce((sum, s) => sum + (s.endedAt - s.startedAt), 0)
  const averageDailyMs = pastTotal / 7

  const topEntry = Object.entries(streaks)
    .filter(([, days]) => days > 0)
    .sort(([, a], [, b]) => b - a)[0]
  const topStreak = topEntry ? { categoryId: topEntry[0], days: topEntry[1] } : null

  const peakHoursLabel = computePeakHoursLabel(sessions)

  return { todayMs, averageDailyMs, aboveAverage: todayMs > averageDailyMs, topStreak, peakHoursLabel }
}
