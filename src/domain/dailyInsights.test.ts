import { describe, it, expect } from 'vitest'
import { computeDailyInsights, computePeakHoursLabel } from './dailyInsights'
import type { Session } from './timer'

function makeSession(date: string, durationMs: number, categoryId = 'cat-work'): Session {
  const startedAt = new Date(date + 'T09:00:00').getTime()
  return { id: `s-${date}-${durationMs}`, categoryId, startedAt, endedAt: startedAt + durationMs, date }
}

describe('computeDailyInsights', () => {
  const today = '2026-03-26'

  it('returns zero todayMs when no sessions today', () => {
    const result = computeDailyInsights([], today)
    expect(result.todayMs).toBe(0)
  })

  it('sums sessions for today correctly', () => {
    const sessions = [
      makeSession(today, 2 * 3_600_000),
      makeSession(today, 1 * 3_600_000),
    ]
    const result = computeDailyInsights(sessions, today)
    expect(result.todayMs).toBe(3 * 3_600_000)
  })

  it('does not include sessions from other days', () => {
    const sessions = [
      makeSession(today, 2 * 3_600_000),
      makeSession('2026-03-25', 3 * 3_600_000),
    ]
    const result = computeDailyInsights(sessions, today)
    expect(result.todayMs).toBe(2 * 3_600_000)
  })

  it('computes averageDailyMs from last 7 days excluding today', () => {
    const sessions = [
      makeSession('2026-03-25', 2 * 3_600_000),
      makeSession('2026-03-24', 4 * 3_600_000),
      makeSession(today, 1 * 3_600_000),
    ]
    const result = computeDailyInsights(sessions, today)
    // average of 2h + 4h = 6h over 7 days = 6/7h ≈ 51min
    expect(result.averageDailyMs).toBeCloseTo((6 * 3_600_000) / 7, -3)
  })

  it('returns aboveAverage true when today > average', () => {
    const sessions = [
      makeSession('2026-03-25', 1 * 3_600_000),
      makeSession(today, 4 * 3_600_000),
    ]
    const result = computeDailyInsights(sessions, today)
    expect(result.aboveAverage).toBe(true)
  })

  it('returns aboveAverage false when today <= average', () => {
    const sessions = [
      makeSession('2026-03-25', 8 * 3_600_000),
      makeSession(today, 1 * 3_600_000),
    ]
    const result = computeDailyInsights(sessions, today)
    expect(result.aboveAverage).toBe(false)
  })

  it('returns topStreak from provided streaks map', () => {
    const streaks = { 'cat-work': 5, 'cat-study': 3 }
    const result = computeDailyInsights([], today, streaks)
    expect(result.topStreak).toEqual({ categoryId: 'cat-work', days: 5 })
  })

  it('returns null topStreak when all streaks are 0', () => {
    const streaks = { 'cat-work': 0 }
    const result = computeDailyInsights([], today, streaks)
    expect(result.topStreak).toBeNull()
  })

  it('returns null topStreak when no streaks provided', () => {
    const result = computeDailyInsights([], today)
    expect(result.topStreak).toBeNull()
  })
})

describe('computePeakHoursLabel', () => {
  it('returns null when fewer than 7 distinct days', () => {
    const sessions = [makeSession('2026-03-25', 1 * 3_600_000)]
    expect(computePeakHoursLabel(sessions)).toBeNull()
  })

  it('returns a peak hours label when 7+ distinct days', () => {
    const sessions = Array.from({ length: 7 }, (_, i) => {
      const d = `2026-03-${String(19 + i).padStart(2, '0')}`
      // 9am sessions are 2h long — should be top hour
      const startedAt = new Date(`${d}T09:00:00`).getTime()
      return { id: `s-${i}`, categoryId: 'cat-work', startedAt, endedAt: startedAt + 2 * 3_600_000, date: d }
    })
    const label = computePeakHoursLabel(sessions)
    expect(label).toBe('9am–11am')
  })
})
