import { describe, it, expect } from 'vitest'
import { computeDailyFocusScore, getDailyFocusLabel } from './dailyFocusScore'
import type { Session } from './timer'

function session(startedAt: number, durationMs: number): Session {
  return {
    id: `s-${startedAt}`,
    categoryId: 'cat-1',
    startedAt,
    endedAt: startedAt + durationMs,
    date: '2026-03-19',
  }
}

describe('computeDailyFocusScore', () => {
  it('returns 0 for no sessions', () => {
    expect(computeDailyFocusScore([])).toBe(0)
  })

  it('returns high score for long focused sessions', () => {
    // 4 hours of work in 2 sessions of 2h each
    const sessions = [
      session(9 * 3_600_000,  2 * 3_600_000),
      session(12 * 3_600_000, 2 * 3_600_000),
    ]
    const score = computeDailyFocusScore(sessions)
    expect(score).toBeGreaterThan(60)
  })

  it('returns lower score for many short sessions', () => {
    // 20 sessions of 5 min = 100 min total (same total time as 2 × 50min)
    const shorts = Array.from({ length: 20 }, (_, i) =>
      session(i * 6 * 60_000, 5 * 60_000)
    )
    const longs = [
      session(0, 50 * 60_000),
      session(60 * 60_000, 50 * 60_000),
    ]
    expect(computeDailyFocusScore(shorts)).toBeLessThan(computeDailyFocusScore(longs))
  })

  it('caps at 100', () => {
    const sessions = Array.from({ length: 3 }, (_, i) =>
      session(i * 4 * 3_600_000, 3 * 3_600_000)
    )
    expect(computeDailyFocusScore(sessions)).toBeLessThanOrEqual(100)
  })

  it('getDailyFocusLabel returns label for 0', () => {
    expect(getDailyFocusLabel(0)).toBe('No sessions')
  })

  it('getDailyFocusLabel returns label for 80', () => {
    expect(getDailyFocusLabel(80)).toBe('Excellent')
  })
})
