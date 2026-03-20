import { describe, it, expect } from 'vitest'
import { computeFocusDebt, getDebtLevel, getDebtColor, getDebtDescription, buildDebtEventsFromSessions } from './focusDebt'

describe('computeFocusDebt', () => {
  it('returns 0 for no events', () => {
    expect(computeFocusDebt([])).toBe(0)
  })

  it('accumulates debt correctly', () => {
    const events = [
      { type: 'breakSkipped' as const, timestamp: 0 },
      { type: 'breakSkipped' as const, timestamp: 1 },
      { type: 'flowSession' as const, timestamp: 2 },
    ]
    expect(computeFocusDebt(events)).toBe(15 + 15 - 20)
  })

  it('can go negative', () => {
    const events = [
      { type: 'flowSession' as const, timestamp: 0 },
      { type: 'flowSession' as const, timestamp: 1 },
      { type: 'restDay' as const, timestamp: 2 },
    ]
    expect(computeFocusDebt(events)).toBe(-20 - 20 - 25)
  })
})

describe('getDebtLevel', () => {
  it('categorizes correctly', () => {
    expect(getDebtLevel(0)).toBe('minimal')
    expect(getDebtLevel(50)).toBe('moderate')
    expect(getDebtLevel(80)).toBe('high')
    expect(getDebtLevel(150)).toBe('critical')
  })
})

describe('getDebtColor', () => {
  it('returns emerald for minimal', () => {
    expect(getDebtColor('minimal')).toContain('emerald')
  })

  it('returns yellow for moderate', () => {
    expect(getDebtColor('moderate')).toContain('yellow')
  })

  it('returns orange for high', () => {
    expect(getDebtColor('high')).toContain('orange')
  })

  it('returns red for critical', () => {
    expect(getDebtColor('critical')).toContain('red')
  })
})

describe('getDebtDescription', () => {
  it('returns healthy message for minimal', () => {
    expect(getDebtDescription('minimal')).toContain('healthy')
  })

  it('returns accumulating message for moderate', () => {
    expect(getDebtDescription('moderate')).toContain('accumulating')
  })

  it('returns high debt message for high', () => {
    expect(getDebtDescription('high')).toContain('High')
  })

  it('returns critical message for critical', () => {
    expect(getDebtDescription('critical')).toContain('Critical')
  })
})

describe('buildDebtEventsFromSessions', () => {
  it('detects flow sessions', () => {
    const now = Date.now()
    const sessions = [
      { startedAt: now - 60 * 60_000, endedAt: now, date: '2026-01-01' }
    ]
    const events = buildDebtEventsFromSessions(sessions, 0)
    expect(events.some(e => e.type === 'flowSession')).toBe(true)
  })

  it('adds break skips', () => {
    const events = buildDebtEventsFromSessions([], 3)
    expect(events.filter(e => e.type === 'breakSkipped').length).toBe(3)
  })

  it('detects sessionOver3h', () => {
    const now = Date.now()
    const sessions = [
      { startedAt: now - 4 * 3_600_000, endedAt: now, date: '2026-01-01' }
    ]
    const events = buildDebtEventsFromSessions(sessions, 0)
    expect(events.some(e => e.type === 'sessionOver3h')).toBe(true)
  })

  it('detects late night session', () => {
    // Create a timestamp at 23:00 local time today
    const now = new Date()
    now.setHours(23, 0, 0, 0)
    const startedAt = now.getTime()
    const sessions = [
      { startedAt, endedAt: startedAt + 30 * 60_000, date: '2026-01-01' }
    ]
    const events = buildDebtEventsFromSessions(sessions, 0)
    expect(events.some(e => e.type === 'lateNightSession')).toBe(true)
  })

  it('returns no events for empty sessions and zero skips', () => {
    // New user with no sessions: rest-day credits are not awarded (no recent activity guard)
    expect(buildDebtEventsFromSessions([], 0, 0, '2026-01-08')).toHaveLength(0)
  })

  it('adds break completed events', () => {
    const events = buildDebtEventsFromSessions([], 0, 3, '2026-01-08')
    expect(events.filter(e => e.type === 'breakCompleted').length).toBe(3)
  })

  it('emits restDay for days with no sessions in last 7 days', () => {
    // Sessions on 2026-01-07 and 2026-01-06 (two distinct days within the window)
    // Days checked: 2026-01-07, 2026-01-06, ..., 2026-01-01 (7 days)
    // 2026-01-07 and 2026-01-06 have sessions → 5 rest days
    const t1 = new Date('2026-01-07T12:00:00Z').getTime()
    const t2 = new Date('2026-01-06T12:00:00Z').getTime()
    const sessions = [
      { startedAt: t1, endedAt: t1 + 45 * 60_000, date: '2026-01-07' },
      { startedAt: t2, endedAt: t2 + 45 * 60_000, date: '2026-01-06' },
    ]
    const events = buildDebtEventsFromSessions(sessions, 0, 0, '2026-01-08')
    const restDays = events.filter(e => e.type === 'restDay')
    expect(restDays.length).toBe(5)
  })

  it('debt decreases after break completions', () => {
    const baseEvents = buildDebtEventsFromSessions([], 2, 0, '2026-01-08')
    const creditedEvents = buildDebtEventsFromSessions([], 2, 2, '2026-01-08')
    const baseDebt = computeFocusDebt(baseEvents)
    const creditedDebt = computeFocusDebt(creditedEvents)
    expect(creditedDebt).toBeLessThan(baseDebt)
  })

  it('debt decreases when rest days are present', () => {
    // Sessions on 2026-01-07 and 2026-01-06 (two distinct days, satisfies >= 2 guard)
    // 5 rest days × -25 = -125, no flowSession (only 30 min each)
    const t1 = new Date('2026-01-07T12:00:00Z').getTime()
    const t2 = new Date('2026-01-06T12:00:00Z').getTime()
    const sessions = [
      { startedAt: t1, endedAt: t1 + 30 * 60_000, date: '2026-01-07' },
      { startedAt: t2, endedAt: t2 + 30 * 60_000, date: '2026-01-06' },
    ]
    const events = buildDebtEventsFromSessions(sessions, 0, 0, '2026-01-08')
    const debt = computeFocusDebt(events)
    const restDayCount = events.filter(e => e.type === 'restDay').length
    expect(restDayCount).toBe(5)
    expect(debt).toBeLessThan(0)
  })

  it('emits 0 restDay events when all 7 days have sessions', () => {
    // today = 2026-01-08, checking days 2026-01-01 through 2026-01-07 (7 days back)
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date('2026-01-08T12:00:00Z')
      d.setUTCDate(d.getUTCDate() - (i + 1))
      return d.toISOString().slice(0, 10)
    })
    const sessions = days.map(date => {
      const t = new Date(date + 'T10:00:00Z').getTime()
      return { startedAt: t, endedAt: t + 30 * 60_000, date }
    })
    const events = buildDebtEventsFromSessions(sessions, 0, 0, '2026-01-08')
    const restDays = events.filter(e => e.type === 'restDay')
    expect(restDays.length).toBe(0)
  })

  it('emits 0 restDay events when sessions array is empty (new user — no recent activity)', () => {
    // Guard: do not award rest-day credits before the user has any sessions in the last 7 days.
    // Emitting them for a brand-new user would give an unearned negative-debt bonus.
    const events = buildDebtEventsFromSessions([], 0, 0, '2026-01-08')
    const restDays = events.filter(e => e.type === 'restDay')
    expect(restDays.length).toBe(0)
  })

  it('emits restDay credits when exactly 2 distinct session days are in the 7-day window (boundary >= 2)', () => {
    // today = 2026-01-08; sessions on 2026-01-07 and 2026-01-06 → datesInWindow.size === 2
    // That equals the threshold, so rest day credits MUST be emitted.
    const t1 = new Date('2026-01-07T10:00:00Z').getTime()
    const t2 = new Date('2026-01-06T10:00:00Z').getTime()
    const sessions = [
      { startedAt: t1, endedAt: t1 + 20 * 60_000, date: '2026-01-07' },
      { startedAt: t2, endedAt: t2 + 20 * 60_000, date: '2026-01-06' },
    ]
    const events = buildDebtEventsFromSessions(sessions, 0, 0, '2026-01-08')
    const restDays = events.filter(e => e.type === 'restDay')
    // 7 days checked (2026-01-01 to 2026-01-07); 2 have sessions → 5 rest days
    expect(restDays.length).toBe(5)
  })

  it('does NOT emit restDay credits when exactly 1 distinct session day is in the 7-day window (below threshold)', () => {
    // today = 2026-01-08; only one session on 2026-01-07 → datesInWindow.size === 1
    // That is below the >= 2 threshold, so NO rest day credits should be emitted.
    const t1 = new Date('2026-01-07T10:00:00Z').getTime()
    const sessions = [
      { startedAt: t1, endedAt: t1 + 20 * 60_000, date: '2026-01-07' },
    ]
    const events = buildDebtEventsFromSessions(sessions, 0, 0, '2026-01-08')
    const restDays = events.filter(e => e.type === 'restDay')
    expect(restDays.length).toBe(0)
  })

  it('detects late night session starting at 21:xx', () => {
    const d = new Date()
    d.setHours(21, 30, 0, 0)
    const startedAt = d.getTime()
    const sessions = [
      { startedAt, endedAt: startedAt + 30 * 60_000, date: '2026-01-01' }
    ]
    const events = buildDebtEventsFromSessions(sessions, 0)
    expect(events.some(e => e.type === 'lateNightSession')).toBe(true)
  })

  it('does NOT detect late night for session starting at 20:xx', () => {
    const d = new Date()
    d.setHours(20, 59, 0, 0)
    const startedAt = d.getTime()
    const sessions = [
      { startedAt, endedAt: startedAt + 30 * 60_000, date: '2026-01-01' }
    ]
    const events = buildDebtEventsFromSessions(sessions, 0)
    expect(events.some(e => e.type === 'lateNightSession')).toBe(false)
  })

  it('M66/M78: emits highDwsDay for days with score >= 70', () => {
    const scores = { '2026-01-07': 72, '2026-01-06': 55, '2026-01-05': 80 }
    const events = buildDebtEventsFromSessions([], 0, 0, undefined, scores)
    const highDws = events.filter(e => e.type === 'highDwsDay')
    expect(highDws).toHaveLength(2) // 72 and 80 qualify; 55 does not
  })

  it('M66/M78: debt decreases when high-DWS days are provided', () => {
    const baseEvents = buildDebtEventsFromSessions([], 1, 0) // breakSkipped +15
    const withDws = buildDebtEventsFromSessions([], 1, 0, undefined, { '2026-01-07': 85 })
    expect(computeFocusDebt(withDws)).toBeLessThan(computeFocusDebt(baseEvents))
  })

  it('M66/M78: does not emit highDwsDay when dailyDwsScores is undefined', () => {
    const events = buildDebtEventsFromSessions([], 0, 0)
    expect(events.some(e => e.type === 'highDwsDay')).toBe(false)
  })
})
