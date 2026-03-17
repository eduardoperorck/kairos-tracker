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
    expect(buildDebtEventsFromSessions([], 0)).toHaveLength(0)
  })
})
