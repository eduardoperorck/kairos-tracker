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
    expect(result.signals.some(s => s.includes('late-night'))).toBe(true)
    expect(result.score).toBeGreaterThan(0)
  })

  it('detects weekend work', () => {
    // 2026-03-14 = Saturday, 2026-03-15 = Sunday
    const sessions = [
      makeSession({ date: '2026-03-14' }),
      makeSession({ date: '2026-03-15' }),
    ]
    const result = computeBurnoutRisk(sessions, today)
    expect(result.signals.some(s => s.includes('weekend'))).toBe(true)
  })

  it('critical debt increases score', () => {
    const noRisk = computeBurnoutRisk([], today, 'minimal')
    const highRisk = computeBurnoutRisk([], today, 'critical')
    expect(highRisk.score).toBeGreaterThan(noRisk.score)
    expect(highRisk.signals.some(s => s.includes('focus debt'))).toBe(true)
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
