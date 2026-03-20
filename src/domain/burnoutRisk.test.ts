import { describe, it, expect } from 'vitest'
import { computeBurnoutRisk } from './burnoutRisk'
import type { Session } from './timer'

const today = '2026-03-17'

function makeSession(overrides: Partial<Session> & { date: string }): Session {
  return {
    id: 's1',
    categoryId: 'c1',
    startedAt: new Date(overrides.date + 'T09:00:00Z').getTime(),
    endedAt: new Date(overrides.date + 'T10:00:00Z').getTime(),
    ...overrides,
  }
}

describe('computeBurnoutRisk', () => {
  it('returns low risk with no sessions', () => {
    const result = computeBurnoutRisk([], today)
    expect(result.level).toBe('low')
    expect(result.score).toBe(0)
    expect(result.signals).toHaveLength(0)
  })

  it('detects late night sessions', () => {
    const lateSessions = Array.from({ length: 3 }, (_, i) => {
      const date = `2026-03-${String(15 + i).padStart(2, '0')}`
      return makeSession({
        date,
        startedAt: new Date(date + 'T22:30:00').getTime(),
        endedAt: new Date(date + 'T23:30:00').getTime(),
      })
    })
    const result = computeBurnoutRisk(lateSessions, today)
    expect(result.signals).toContain('burnout.signal.lateNight')
    expect(result.score).toBeGreaterThan(0)
  })

  it('detects weekend work', () => {
    // 2026-03-14 = Saturday, 2026-03-15 = Sunday
    const sessions = [
      makeSession({ date: '2026-03-14' }),
      makeSession({ date: '2026-03-15' }),
    ]
    const result = computeBurnoutRisk(sessions, today)
    expect(result.signals).toContain('burnout.signal.weekendBoth')
  })

  it('does NOT count a short Sunday session (5 min) as weekend work', () => {
    // 2026-03-15 = Sunday; session is only 5 minutes (below 20-min threshold)
    const shortSession = makeSession({
      date: '2026-03-15',
      startedAt: new Date('2026-03-15T10:00:00Z').getTime(),
      endedAt: new Date('2026-03-15T10:05:00Z').getTime(),
    })
    const result = computeBurnoutRisk([shortSession], today)
    expect(result.signals).not.toContain('burnout.signal.weekendBoth')
  })

  it('counts a 30-min Sunday session as weekend work', () => {
    // 2026-03-15 = Sunday; session is 30 minutes (above threshold)
    const longSession = makeSession({
      date: '2026-03-15',
      startedAt: new Date('2026-03-15T10:00:00Z').getTime(),
      endedAt: new Date('2026-03-15T10:30:00Z').getTime(),
    })
    const result = computeBurnoutRisk([longSession], today)
    // weekendDays === 1 → score += 8 (no signal text for single day, but score > 0)
    expect(result.score).toBeGreaterThan(0)
  })

  it('critical debt increases score', () => {
    const noRisk = computeBurnoutRisk([], today, 'minimal')
    const highRisk = computeBurnoutRisk([], today, 'critical')
    expect(highRisk.score).toBeGreaterThan(noRisk.score)
    expect(highRisk.signals).toContain('burnout.signal.focusDebt')
  })

  it('returns higher level when score is high', () => {
    // Overwork + late nights + weekend + critical debt
    const sessions: Session[] = []
    // 3 late nights
    for (let i = 0; i < 3; i++) {
      const date = `2026-03-${String(14 + i).padStart(2, '0')}`
      sessions.push(makeSession({
        date,
        startedAt: new Date(date + 'T22:00:00').getTime(),
        endedAt: new Date(date + 'T23:30:00').getTime(),
      }))
    }
    // weekend both days
    sessions.push(makeSession({ date: '2026-03-14' }))
    sessions.push(makeSession({ date: '2026-03-15' }))

    const result = computeBurnoutRisk(sessions, today, 'critical')
    expect(['high', 'critical']).toContain(result.level)
  })

  it('counts a session of exactly 20 minutes as a significant weekend session (boundary)', () => {
    // 2026-03-15 = Sunday; exactly 20 minutes = MIN_WORK_SESSION_MS boundary → counts
    const exactBoundarySession = makeSession({
      date: '2026-03-15',
      startedAt: new Date('2026-03-15T10:00:00Z').getTime(),
      endedAt: new Date('2026-03-15T10:00:00Z').getTime() + 20 * 60_000,
    })
    const result = computeBurnoutRisk([exactBoundarySession], today)
    expect(result.score).toBeGreaterThan(0)
  })

  it('does NOT count a session of 19 minutes as a significant weekend session', () => {
    // 2026-03-15 = Sunday; 19 minutes is below the 20-min threshold
    const shortSession = makeSession({
      date: '2026-03-15',
      startedAt: new Date('2026-03-15T10:00:00Z').getTime(),
      endedAt: new Date('2026-03-15T10:00:00Z').getTime() + 19 * 60_000,
    })
    const result = computeBurnoutRisk([shortSession], today)
    // weekendDays === 0 → score += 0 from weekend signal
    expect(result.signals).not.toContain('burnout.signal.weekendBoth')
    expect(result.score).toBe(0)
  })

  it('counts 7 days with significant sessions (>= 20 min each) as no rest days', () => {
    const sessions: Session[] = []
    for (let i = 0; i < 7; i++) {
      const date = `2026-03-${String(11 + i).padStart(2, '0')}`
      sessions.push(makeSession({
        date,
        startedAt: new Date(date + 'T09:00:00Z').getTime(),
        endedAt: new Date(date + 'T09:00:00Z').getTime() + 30 * 60_000,
      }))
    }
    const result = computeBurnoutRisk(sessions, today)
    expect(result.signals).toContain('burnout.signal.noRest')
  })

  it('does NOT trigger no-rest-days signal when all 7 days have only short sessions (< 20 min)', () => {
    const sessions: Session[] = []
    for (let i = 0; i < 7; i++) {
      const date = `2026-03-${String(11 + i).padStart(2, '0')}`
      sessions.push(makeSession({
        date,
        startedAt: new Date(date + 'T09:00:00Z').getTime(),
        endedAt: new Date(date + 'T09:00:00Z').getTime() + 5 * 60_000, // 5 min < 20 min threshold
      }))
    }
    const result = computeBurnoutRisk(sessions, today)
    expect(result.signals).not.toContain('burnout.signal.noRest')
  })

  it('score does not exceed 100', () => {
    const sessions: Session[] = []
    for (let i = 0; i < 7; i++) {
      const date = `2026-03-${String(11 + i).padStart(2, '0')}`
      // 10-hour days + late night
      sessions.push(makeSession({
        date,
        startedAt: new Date(date + 'T08:00:00').getTime(),
        endedAt: new Date(date + 'T18:00:00').getTime(),
      }))
      sessions.push(makeSession({
        date,
        startedAt: new Date(date + 'T22:00:00').getTime(),
        endedAt: new Date(date + 'T23:30:00').getTime(),
      }))
    }
    const result = computeBurnoutRisk(sessions, today, 'critical')
    expect(result.score).toBeLessThanOrEqual(100)
  })
})
