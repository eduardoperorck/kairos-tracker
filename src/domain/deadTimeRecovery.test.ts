import { describe, it, expect } from 'vitest'
import { computeDeadTime, formatIdleTime } from './deadTimeRecovery'

describe('computeDeadTime', () => {
  it('returns dead=false when below threshold', () => {
    const result = computeDeadTime(5 * 60_000) // 5 min < 10 min threshold
    expect(result.dead).toBe(false)
  })

  it('returns dead=true when above threshold', () => {
    const result = computeDeadTime(15 * 60_000)
    expect(result.dead).toBe(true)
  })

  it('includes suggestions when dead', () => {
    const result = computeDeadTime(15 * 60_000)
    if (result.dead) {
      expect(result.suggestions.length).toBeGreaterThan(0)
    }
  })

  it('limits suggestions to 3', () => {
    const result = computeDeadTime(60 * 60_000) // 1 hour
    if (result.dead) {
      expect(result.suggestions.length).toBeLessThanOrEqual(3)
    }
  })

  it('returns dead=false at exact threshold', () => {
    const result = computeDeadTime(10 * 60_000, 10 * 60_000)
    expect(result.dead).toBe(false)
  })

  it('uses custom threshold', () => {
    const result = computeDeadTime(3 * 60_000, 2 * 60_000)
    expect(result.dead).toBe(true)
  })

  it('uses custom tasks when provided', () => {
    const customTasks = [{ id: 'custom', text: 'Custom task', estimatedMinutes: 5 }]
    const result = computeDeadTime(15 * 60_000, 10 * 60_000, customTasks)
    if (result.dead) {
      expect(result.suggestions.some(t => t.id === 'custom')).toBe(true)
    }
  })

  it('only suggests tasks fitting within idle time', () => {
    // Only 12 minutes idle — should not suggest 10+ minute tasks if threshold is met
    const result = computeDeadTime(12 * 60_000, 10 * 60_000)
    if (result.dead) {
      result.suggestions.forEach(t => {
        expect(t.estimatedMinutes).toBeLessThanOrEqual(12)
      })
    }
  })
})

describe('formatIdleTime', () => {
  it('formats minutes only', () => {
    expect(formatIdleTime(15 * 60_000)).toBe('15m')
  })

  it('formats hours and minutes', () => {
    expect(formatIdleTime(90 * 60_000)).toBe('1h 30m')
  })

  it('formats exact hours', () => {
    expect(formatIdleTime(2 * 3_600_000)).toBe('2h')
  })
})
