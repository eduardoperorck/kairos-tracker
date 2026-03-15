import { describe, it, expect } from 'vitest'
import { buildDigestPayload, formatDigestPrompt } from './digest'
import type { Category, Session } from './timer'

const today = '2026-03-15' // Sunday — part of week Mon 2026-03-09

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    name: 'Work',
    activeEntry: null,
    ...overrides,
  }
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's-1',
    categoryId: 'cat-1',
    startedAt: 0,
    endedAt: 3_600_000, // 1h
    date: '2026-03-10', // Monday of week
    ...overrides,
  }
}

describe('buildDigestPayload', () => {
  it('returns week key as Monday of current week', () => {
    const payload = buildDigestPayload([makeCategory()], [], [], today)
    expect(payload.week).toBe('2026-03-09') // Monday
  })

  it('sums weeklyMs correctly for a category', () => {
    const cat = makeCategory()
    const sessions = [
      makeSession({ date: '2026-03-10', startedAt: 0, endedAt: 3_600_000 }),
      makeSession({ id: 's-2', date: '2026-03-11', startedAt: 0, endedAt: 1_800_000 }),
    ]
    const payload = buildDigestPayload([cat], sessions, sessions, today)
    expect(payload.categories[0].weeklyMs).toBe(5_400_000)
  })

  it('counts flow sessions (>= 45 min)', () => {
    const cat = makeCategory()
    const sessions = [
      makeSession({ date: '2026-03-10', startedAt: 0, endedAt: 46 * 60_000 }), // flow
      makeSession({ id: 's-2', date: '2026-03-10', startedAt: 0, endedAt: 10 * 60_000 }), // not flow
    ]
    const payload = buildDigestPayload([cat], sessions, sessions, today)
    expect(payload.categories[0].flowSessions).toBe(1)
  })

  it('computes totalMs across all categories', () => {
    const cats = [makeCategory(), makeCategory({ id: 'cat-2', name: 'Study' })]
    const sessions = [
      makeSession({ categoryId: 'cat-1', date: '2026-03-10', endedAt: 3_600_000 }),
      makeSession({ id: 's-2', categoryId: 'cat-2', date: '2026-03-10', endedAt: 1_800_000 }),
    ]
    const payload = buildDigestPayload(cats, sessions, sessions, today)
    expect(payload.totalMs).toBe(5_400_000)
  })
})

describe('formatDigestPrompt', () => {
  it('includes week and total tracked hours', () => {
    const payload = buildDigestPayload(
      [makeCategory()],
      [makeSession({ endedAt: 7_200_000 })],
      [makeSession({ endedAt: 7_200_000 })],
      today
    )
    const prompt = formatDigestPrompt(payload)
    expect(prompt).toContain('2026-03-09')
    expect(prompt).toContain('2.0h')
  })

  it('includes category name and tracked hours', () => {
    const payload = buildDigestPayload(
      [makeCategory({ name: 'Study' })],
      [makeSession({ categoryId: 'cat-1', endedAt: 3_600_000 })],
      [],
      today
    )
    const prompt = formatDigestPrompt(payload)
    expect(prompt).toContain('Study')
    expect(prompt).toContain('1.0h tracked')
  })
})
