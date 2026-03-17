import { describe, it, expect } from 'vitest'
import { computeFocusDebt, getDebtLevel, buildDebtEventsFromSessions } from './focusDebt'

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
})
