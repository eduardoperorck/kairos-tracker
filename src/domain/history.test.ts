import { describe, it, expect } from 'vitest'
import {
  groupSessionsByDate,
  computeHourDistribution,
  exportSessionsToCSV,
  getLastSessionDate,
  computeDayTotals,
  computeEnergyPattern,
  isFlowSession,
  exportSessionsToJSON,
  exportSessionsToHTML,
  parseTogglCSV,
} from './history'
import type { Session, Category } from './timer'

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's-1',
    categoryId: 'cat-1',
    startedAt: new Date('2026-03-10T09:00:00Z').getTime(),
    endedAt: new Date('2026-03-10T11:00:00Z').getTime(),
    date: '2026-03-10',
    ...overrides,
  }
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    name: 'Work',
    activeEntry: null,
    ...overrides,
  }
}

// ─── groupSessionsByDate ──────────────────────────────────────────────────────

describe('groupSessionsByDate', () => {
  it('returns empty array for no sessions', () => {
    expect(groupSessionsByDate([], [])).toEqual([])
  })

  it('groups sessions by date descending', () => {
    const sessions = [
      makeSession({ id: 's-1', date: '2026-03-09', startedAt: new Date('2026-03-09T09:00:00Z').getTime(), endedAt: new Date('2026-03-09T10:00:00Z').getTime() }),
      makeSession({ id: 's-2', date: '2026-03-10', startedAt: new Date('2026-03-10T09:00:00Z').getTime(), endedAt: new Date('2026-03-10T10:00:00Z').getTime() }),
    ]
    const cats = [makeCategory()]
    const result = groupSessionsByDate(sessions, cats)
    expect(result).toHaveLength(2)
    expect(result[0].date).toBe('2026-03-10')
    expect(result[1].date).toBe('2026-03-09')
  })

  it('includes category name in sessions', () => {
    const sessions = [makeSession()]
    const cats = [makeCategory({ id: 'cat-1', name: 'Work' })]
    const result = groupSessionsByDate(sessions, cats)
    expect(result[0].sessions[0].categoryName).toBe('Work')
  })

  it('uses unknown for missing category', () => {
    const sessions = [makeSession({ categoryId: 'missing' })]
    const result = groupSessionsByDate(sessions, [])
    expect(result[0].sessions[0].categoryName).toBe('Unknown')
  })

  it('computes totalMs per day', () => {
    const sessions = [
      makeSession({ id: 's-1', startedAt: 0, endedAt: 3_600_000, date: '2026-03-10' }),
      makeSession({ id: 's-2', startedAt: 0, endedAt: 1_800_000, date: '2026-03-10' }),
    ]
    const result = groupSessionsByDate(sessions, [makeCategory()])
    expect(result[0].totalMs).toBe(5_400_000)
  })

  it('groups multiple sessions on same date', () => {
    const sessions = [
      makeSession({ id: 's-1', date: '2026-03-10' }),
      makeSession({ id: 's-2', date: '2026-03-10' }),
      makeSession({ id: 's-3', date: '2026-03-09' }),
    ]
    const result = groupSessionsByDate(sessions, [makeCategory()])
    expect(result[0].sessions).toHaveLength(2)
    expect(result[1].sessions).toHaveLength(1)
  })
})

// ─── computeHourDistribution ─────────────────────────────────────────────────

describe('computeHourDistribution', () => {
  it('returns empty for no sessions', () => {
    expect(computeHourDistribution([])).toEqual([])
  })

  it('assigns session duration to its start hour', () => {
    const s = makeSession({
      startedAt: new Date('2026-03-10T10:00:00Z').getTime(),
      endedAt: new Date('2026-03-10T11:00:00Z').getTime(),
    })
    const result = computeHourDistribution([s])
    const slot = result.find(h => h.hour === 10)
    expect(slot).toBeDefined()
    expect(slot!.totalMs).toBe(3_600_000)
  })

  it('aggregates multiple sessions in the same hour', () => {
    const s1 = makeSession({ id: 's-1', startedAt: new Date('2026-03-10T10:00:00Z').getTime(), endedAt: new Date('2026-03-10T10:30:00Z').getTime() })
    const s2 = makeSession({ id: 's-2', startedAt: new Date('2026-03-10T10:30:00Z').getTime(), endedAt: new Date('2026-03-10T11:00:00Z').getTime() })
    const result = computeHourDistribution([s1, s2])
    const slot = result.find(h => h.hour === 10)
    expect(slot!.totalMs).toBe(3_600_000)
  })

  it('only returns hours with data', () => {
    const s = makeSession({
      startedAt: new Date('2026-03-10T14:00:00Z').getTime(),
      endedAt: new Date('2026-03-10T15:00:00Z').getTime(),
    })
    const result = computeHourDistribution([s])
    expect(result.every(h => h.totalMs > 0)).toBe(true)
    expect(result).toHaveLength(1)
  })
})

// ─── exportSessionsToCSV ─────────────────────────────────────────────────────

describe('exportSessionsToCSV', () => {
  it('returns header row', () => {
    const result = exportSessionsToCSV([], [])
    expect(result.startsWith('category,date,started_at,ended_at,duration_minutes,tag')).toBe(true)
  })

  it('includes a session row', () => {
    const s = makeSession({ startedAt: new Date('2026-03-10T09:00:00Z').getTime(), endedAt: new Date('2026-03-10T10:00:00Z').getTime(), date: '2026-03-10' })
    const cats = [makeCategory({ name: 'Work' })]
    const result = exportSessionsToCSV([s], cats)
    expect(result).toContain('Work')
    expect(result).toContain('2026-03-10')
    expect(result).toContain('60')
  })

  it('includes tag if present', () => {
    const s = makeSession({ tag: 'deep work' })
    const result = exportSessionsToCSV([s], [makeCategory()])
    expect(result).toContain('deep work')
  })
})

// ─── getLastSessionDate ───────────────────────────────────────────────────────

describe('getLastSessionDate', () => {
  it('returns null when no sessions exist', () => {
    expect(getLastSessionDate([], 'cat-1')).toBeNull()
  })

  it('returns null when no sessions for this category', () => {
    const s = makeSession({ categoryId: 'cat-2' })
    expect(getLastSessionDate([s], 'cat-1')).toBeNull()
  })

  it('returns the most recent endedAt for the category', () => {
    const s1 = makeSession({ id: 's-1', categoryId: 'cat-1', endedAt: 1000 })
    const s2 = makeSession({ id: 's-2', categoryId: 'cat-1', endedAt: 5000 })
    expect(getLastSessionDate([s1, s2], 'cat-1')).toBe(5000)
  })
})

// ─── computeDayTotals ────────────────────────────────────────────────────────

describe('computeDayTotals', () => {
  it('returns empty for no sessions', () => {
    expect(computeDayTotals([], [], '2026-01-01')).toEqual([])
  })

  it('aggregates totalMs per date', () => {
    const sessions = [
      makeSession({ id: 's-1', date: '2026-03-10', startedAt: 0, endedAt: 3_600_000, categoryId: 'cat-1' }),
      makeSession({ id: 's-2', date: '2026-03-10', startedAt: 0, endedAt: 1_800_000, categoryId: 'cat-1' }),
    ]
    const result = computeDayTotals(sessions, [makeCategory()], '2026-01-01')
    expect(result[0].totalMs).toBe(5_400_000)
  })

  it('filters out dates before since', () => {
    const sessions = [
      makeSession({ date: '2025-01-01', startedAt: 0, endedAt: 1000 }),
    ]
    const result = computeDayTotals(sessions, [makeCategory()], '2026-01-01')
    expect(result).toHaveLength(0)
  })

  it('identifies top category per day', () => {
    const sessions = [
      makeSession({ id: 's-1', date: '2026-03-10', categoryId: 'cat-1', startedAt: 0, endedAt: 7200_000 }),
      makeSession({ id: 's-2', date: '2026-03-10', categoryId: 'cat-2', startedAt: 0, endedAt: 1800_000 }),
    ]
    const cats = [makeCategory({ id: 'cat-1' }), makeCategory({ id: 'cat-2', name: 'Study' })]
    const result = computeDayTotals(sessions, cats, '2026-01-01')
    expect(result[0].topCategoryId).toBe('cat-1')
  })
})

// ─── computeEnergyPattern ────────────────────────────────────────────────────

describe('computeEnergyPattern', () => {
  it('returns empty slots for no sessions', () => {
    const result = computeEnergyPattern([], 30)
    expect(result.slots).toEqual([])
  })

  it('computes average ms per hour', () => {
    const s = makeSession({
      startedAt: new Date('2026-03-10T09:00:00Z').getTime(),
      endedAt: new Date('2026-03-10T10:00:00Z').getTime(),
    })
    const result = computeEnergyPattern([s], 30)
    const slot = result.slots.find(s => s.hour === 9)
    expect(slot).toBeDefined()
    expect(slot!.avgMs).toBeGreaterThan(0)
  })

  it('identifies peak hours', () => {
    const sessions = [
      makeSession({ id: 's-1', startedAt: new Date('2026-03-10T09:00:00Z').getTime(), endedAt: new Date('2026-03-10T11:00:00Z').getTime() }),
      makeSession({ id: 's-2', startedAt: new Date('2026-03-10T14:00:00Z').getTime(), endedAt: new Date('2026-03-10T14:30:00Z').getTime() }),
    ]
    const result = computeEnergyPattern(sessions, 30)
    expect(result.peakHours.length).toBeGreaterThan(0)
  })

  it('generates an insight string', () => {
    const s = makeSession()
    const result = computeEnergyPattern([s], 30)
    expect(typeof result.insight).toBe('string')
    expect(result.insight.length).toBeGreaterThan(0)
  })
})

// ─── isFlowSession ───────────────────────────────────────────────────────────

describe('isFlowSession', () => {
  it('returns false for sessions below 45 min threshold', () => {
    const s = makeSession({ startedAt: 0, endedAt: 44 * 60 * 1000 })
    expect(isFlowSession(s)).toBe(false)
  })

  it('returns true for sessions >= 45 min', () => {
    const s = makeSession({ startedAt: 0, endedAt: 45 * 60 * 1000 })
    expect(isFlowSession(s)).toBe(true)
  })

  it('respects custom threshold', () => {
    const s = makeSession({ startedAt: 0, endedAt: 30 * 60 * 1000 })
    expect(isFlowSession(s, 30 * 60 * 1000)).toBe(true)
    expect(isFlowSession(s, 31 * 60 * 1000)).toBe(false)
  })
})

// ─── exportSessionsToJSON ────────────────────────────────────────────────────

describe('exportSessionsToJSON', () => {
  it('returns valid JSON string', () => {
    const s = makeSession()
    const result = exportSessionsToJSON([s], [makeCategory()])
    const parsed = JSON.parse(result)
    expect(Array.isArray(parsed)).toBe(true)
  })

  it('includes category name', () => {
    const result = exportSessionsToJSON([makeSession()], [makeCategory({ name: 'Work' })])
    expect(result).toContain('Work')
  })
})

// ─── exportSessionsToHTML ────────────────────────────────────────────────────

describe('exportSessionsToHTML', () => {
  it('returns an HTML string', () => {
    const result = exportSessionsToHTML([makeSession()], [makeCategory()], [])
    expect(result).toContain('<!DOCTYPE html>')
    expect(result).toContain('<html')
  })

  it('includes session data', () => {
    const result = exportSessionsToHTML([makeSession()], [makeCategory({ name: 'Work' })], [])
    expect(result).toContain('Work')
  })
})

// ─── parseTogglCSV ───────────────────────────────────────────────────────────

describe('parseTogglCSV', () => {
  const header = 'User,Email,Client,Project,Task,Description,Start date,Start time,End date,End time,Duration'
  const row = '"Alice","alice@example.com","","Work","","Deep session","2026-03-10","09:00:00","2026-03-10","11:00:00","02:00:00"'

  it('parses a valid row', () => {
    const raw = [header, row].join('\n')
    const { sessions } = parseTogglCSV(raw, [])
    expect(sessions).toHaveLength(1)
  })

  it('maps Project to categoryId', () => {
    const raw = [header, row].join('\n')
    const cats = [makeCategory({ name: 'Work' })]
    const { sessions } = parseTogglCSV(raw, cats)
    expect(sessions[0].categoryId).toBe('cat-1')
  })

  it('identifies new categories not in existing list', () => {
    const raw = [header, row].join('\n')
    const { newCategories } = parseTogglCSV(raw, [])
    expect(newCategories).toContain('Work')
  })

  it('computes correct date from start date', () => {
    const raw = [header, row].join('\n')
    const { sessions } = parseTogglCSV(raw, [])
    expect(sessions[0].date).toBe('2026-03-10')
  })

  it('handles empty input', () => {
    const { sessions, newCategories } = parseTogglCSV(header, [])
    expect(sessions).toHaveLength(0)
    expect(newCategories).toHaveLength(0)
  })
})
