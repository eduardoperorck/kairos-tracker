import { describe, it, expect } from 'vitest'
import { buildDigestPayload, formatDigestPrompt, parseTimeEntryLocally } from './digest'
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

describe('parseTimeEntryLocally', () => {
  const cats = [
    { id: 'w', name: 'Work' },
    { id: 's', name: 'Study' },
    { id: 'd', name: 'Deep Work' },
  ]
  const today = '2026-03-19'

  it('parses "2h work"', () => {
    const result = parseTimeEntryLocally('2h work', cats, today)
    expect(result?.categoryId).toBe('w')
    expect(result?.durationMs).toBe(7_200_000)
  })

  it('parses "45m study coding"', () => {
    const result = parseTimeEntryLocally('45m study coding', cats, today)
    expect(result?.categoryId).toBe('s')
    expect(result?.durationMs).toBe(2_700_000)
    expect(result?.tag).toBe('coding')
  })

  it('parses "1h30m work"', () => {
    const result = parseTimeEntryLocally('1h30m work', cats, today)
    expect(result?.durationMs).toBe(5_400_000)
  })

  it('parses "work 2h yesterday" and resolves date', () => {
    const result = parseTimeEntryLocally('work 2h yesterday', cats, today)
    expect(result?.categoryId).toBe('w')
    expect(result?.date).toBe('2026-03-18')
  })

  it('returns null when no duration found', () => {
    expect(parseTimeEntryLocally('just work', cats, today)).toBeNull()
  })

  it('returns null when no category matches', () => {
    expect(parseTimeEntryLocally('2h gaming', cats, today)).toBeNull()
  })

  // PT keyword tests (M98)
  // Category names are user-defined and may be in any language — the PT keywords being
  // tested are the date/time modifiers ("ontem", "esta manhã", "esta tarde"), not the
  // category name itself. We use English category names as they appear in `cats`.
  it('parses "work 2h ontem" — date is yesterday (pt)', () => {
    const result = parseTimeEntryLocally('work 2h ontem', cats, today, 'pt')
    expect(result?.durationMs).toBe(7_200_000)
    expect(result?.date).toBe('2026-03-18')
  })

  it('parses "1h esta manhã work código" — startHour is 9 (pt)', () => {
    const result = parseTimeEntryLocally('1h esta manhã work código', cats, today, 'pt')
    expect(result?.durationMs).toBe(3_600_000)
    expect(result?.startHour).toBe(9)
  })

  it('parses "45m esta tarde study reunião" — startHour is 14 (pt)', () => {
    const result = parseTimeEntryLocally('45m esta tarde study reunião', cats, today, 'pt')
    expect(result?.durationMs).toBe(2_700_000)
    expect(result?.startHour).toBe(14)
  })

  it('"ontem" in pt mode does not affect date when lang is en', () => {
    // "ontem" should not be treated as "yesterday" in EN mode
    const result = parseTimeEntryLocally('2h work ontem', cats, today, 'en')
    expect(result?.date).toBe(today)
  })
})

describe('formatDigestPrompt — language enforcement (M94)', () => {
  const basePayload = buildDigestPayload(
    [{ id: 'cat-1', name: 'Work', activeEntry: null }],
    [{ id: 's-1', categoryId: 'cat-1', startedAt: 0, endedAt: 3_600_000, date: '2026-03-10' }],
    [{ id: 's-1', categoryId: 'cat-1', startedAt: 0, endedAt: 3_600_000, date: '2026-03-10' }],
    '2026-03-15'
  )

  it('includes "Respond ONLY in Brazilian Portuguese." when lang is pt', () => {
    const prompt = formatDigestPrompt(basePayload, 'pt')
    expect(prompt).toContain('Respond ONLY in Brazilian Portuguese.')
  })

  it('includes "Respond ONLY in English." when lang is en', () => {
    const prompt = formatDigestPrompt(basePayload, 'en')
    expect(prompt).toContain('Respond ONLY in English.')
  })

  it('defaults to English when no lang argument is passed', () => {
    const prompt = formatDigestPrompt(basePayload)
    expect(prompt).toContain('Respond ONLY in English.')
  })

  it('does not include Portuguese instruction when lang is en', () => {
    const prompt = formatDigestPrompt(basePayload, 'en')
    expect(prompt).not.toContain('Brazilian Portuguese')
  })

  it('does not include English instruction when lang is pt', () => {
    const prompt = formatDigestPrompt(basePayload, 'pt')
    expect(prompt).not.toContain('Respond ONLY in English.')
  })
})

describe('parseTimeEntryLocally — LLM validation guard (Fix 3)', () => {
  const cats = [{ id: 'w', name: 'Work' }]
  const today = '2026-03-19'

  it('returns null when no duration is present (would fail API validation too)', () => {
    expect(parseTimeEntryLocally('work this morning', cats, today)).toBeNull()
  })

  it('returns null for zero-duration input "0h work"', () => {
    expect(parseTimeEntryLocally('0h work', cats, today)).toBeNull()
  })

  it('returns null when category list is empty', () => {
    expect(parseTimeEntryLocally('2h work', [], today)).toBeNull()
  })

  it('returns a result with a valid YYYY-MM-DD date', () => {
    const result = parseTimeEntryLocally('1h work', cats, today)
    expect(result?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns a startHour in 0-23 range', () => {
    const result = parseTimeEntryLocally('1h work', cats, today)
    expect(result?.startHour).toBeGreaterThanOrEqual(0)
    expect(result?.startHour).toBeLessThanOrEqual(23)
  })

  it('returns a positive durationMs', () => {
    const result = parseTimeEntryLocally('1h work', cats, today)
    expect(result?.durationMs).toBeGreaterThan(0)
  })
})
