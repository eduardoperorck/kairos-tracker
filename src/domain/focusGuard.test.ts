import { describe, it, expect } from 'vitest'
import {
  shouldBreakNow,
  getSessionMs,
  computeFocusStats,
  PRESETS,
  type FocusGuardConfig,
} from './focusGuard'
import type { TimerEntry, Session } from './timer'

function makeConfig(overrides: Partial<FocusGuardConfig> = {}): FocusGuardConfig {
  return {
    enabled: true,
    mode: 'pomodoro',
    focusMinutes: 25,
    breakMinutes: 5,
    strictMode: false,
    postponeAllowed: true,
    ...overrides,
  }
}

function makeEntry(startedAt: number, endedAt: number | null = null): TimerEntry {
  return { startedAt, endedAt }
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's-1',
    categoryId: 'cat-1',
    startedAt: 0,
    endedAt: 25 * 60 * 1000,
    date: '2026-03-10',
    ...overrides,
  }
}

// ─── PRESETS ─────────────────────────────────────────────────────────────────

describe('PRESETS', () => {
  it('pomodoro has 25 min focus and 5 min break', () => {
    expect(PRESETS.pomodoro.focusMinutes).toBe(25)
    expect(PRESETS.pomodoro.breakMinutes).toBe(5)
  })

  it('52-17 has 52 min focus and 17 min break', () => {
    expect(PRESETS['52-17'].focusMinutes).toBe(52)
    expect(PRESETS['52-17'].breakMinutes).toBe(17)
  })

  it('ultradian has 90 min focus and 20 min break', () => {
    expect(PRESETS.ultradian.focusMinutes).toBe(90)
    expect(PRESETS.ultradian.breakMinutes).toBe(20)
  })
})

// ─── getSessionMs ────────────────────────────────────────────────────────────

describe('getSessionMs', () => {
  it('returns 0 for null entry', () => {
    expect(getSessionMs(null, 1000)).toBe(0)
  })

  it('returns elapsed ms for running entry', () => {
    const entry = makeEntry(0)
    const result = getSessionMs(entry, 5000)
    expect(result).toBe(5000)
  })

  it('returns elapsed ms for stopped entry', () => {
    const entry = makeEntry(0, 3000)
    expect(getSessionMs(entry, 9999)).toBe(3000)
  })
})

// ─── shouldBreakNow ──────────────────────────────────────────────────────────

describe('shouldBreakNow', () => {
  it('returns false when no active entry', () => {
    expect(shouldBreakNow(null, makeConfig(), 10000)).toBe(false)
  })

  it('returns false when enabled is false', () => {
    const entry = makeEntry(0)
    expect(shouldBreakNow(entry, makeConfig({ enabled: false }), 30 * 60 * 1000)).toBe(false)
  })

  it('returns false when session is shorter than focusMinutes', () => {
    const entry = makeEntry(0)
    expect(shouldBreakNow(entry, makeConfig({ focusMinutes: 25 }), 24 * 60 * 1000)).toBe(false)
  })

  it('returns true when session has run for >= focusMinutes', () => {
    const entry = makeEntry(0)
    expect(shouldBreakNow(entry, makeConfig({ focusMinutes: 25 }), 25 * 60 * 1000)).toBe(true)
  })

  it('returns true when session exceeds focusMinutes', () => {
    const entry = makeEntry(0)
    expect(shouldBreakNow(entry, makeConfig({ focusMinutes: 25 }), 30 * 60 * 1000)).toBe(true)
  })
})

// ─── computeFocusStats ───────────────────────────────────────────────────────

describe('computeFocusStats', () => {
  it('returns zero stats for empty sessions', () => {
    const result = computeFocusStats([], makeConfig())
    expect(result.compliance).toBe(0)
    expect(result.longestSessionMs).toBe(0)
    expect(result.avgSessionMs).toBe(0)
  })

  it('computes longest session', () => {
    const sessions = [
      makeSession({ startedAt: 0, endedAt: 30 * 60 * 1000 }),
      makeSession({ id: 's-2', startedAt: 0, endedAt: 60 * 60 * 1000 }),
    ]
    const result = computeFocusStats(sessions, makeConfig())
    expect(result.longestSessionMs).toBe(60 * 60 * 1000)
  })

  it('computes average session ms', () => {
    const sessions = [
      makeSession({ startedAt: 0, endedAt: 20 * 60 * 1000 }),
      makeSession({ id: 's-2', startedAt: 0, endedAt: 30 * 60 * 1000 }),
    ]
    const result = computeFocusStats(sessions, makeConfig())
    expect(result.avgSessionMs).toBe(25 * 60 * 1000)
  })

  it('counts compliant sessions (within focusMinutes)', () => {
    const config = makeConfig({ focusMinutes: 25 })
    const sessions = [
      makeSession({ startedAt: 0, endedAt: 25 * 60 * 1000 }),  // compliant
      makeSession({ id: 's-2', startedAt: 0, endedAt: 50 * 60 * 1000 }),  // over by 2x
    ]
    const result = computeFocusStats(sessions, config)
    // 1 of 2 sessions compliant = 50%
    expect(result.compliance).toBe(50)
  })
})
