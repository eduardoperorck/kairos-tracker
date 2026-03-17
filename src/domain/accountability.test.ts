import { describe, it, expect } from 'vitest'
import { buildPartnerCard, validatePartnerCard } from './accountability'
import type { Session, Category } from './timer'

const categories: Category[] = [
  { id: 'c1', name: 'Work', activeEntry: null },
]

function makeSession(overrides: Partial<Session> = {}): Session {
  const now = Date.now()
  return {
    id: 's1',
    categoryId: 'c1',
    date: new Date().toISOString().slice(0, 10),
    startedAt: now - 3_600_000,
    endedAt: now,
    ...overrides,
  }
}

describe('buildPartnerCard', () => {
  it('builds a card with version 1', () => {
    const card = buildPartnerCard('Alice', [], categories, 0)
    expect(card.version).toBe(1)
  })

  it('includes the nickname', () => {
    const card = buildPartnerCard('Bob', [], categories, 0)
    expect(card.nickname).toBe('Bob')
  })

  it('sets weeklyGoalPct to 0 when no sessions', () => {
    const card = buildPartnerCard('Alice', [], categories, 36_000_000)
    expect(card.weeklyGoalPct).toBe(0)
  })

  it('caps weeklyGoalPct at 100', () => {
    // 2 sessions × 1h = 2h; goal = 1h → 200% → capped at 100
    const sessions = [makeSession(), makeSession({ id: 's2' })]
    const card = buildPartnerCard('Alice', sessions, categories, 3_600_000)
    expect(card.weeklyGoalPct).toBe(100)
  })

  it('sets topCategory to the category with most time this week', () => {
    const card = buildPartnerCard('Alice', [makeSession()], categories, 0)
    expect(card.topCategory).toBe('Work')
  })

  it('sets topCategory to null when no sessions', () => {
    const card = buildPartnerCard('Alice', [], categories, 0)
    expect(card.topCategory).toBeNull()
  })

  it('includes focusDebtLevel', () => {
    const card = buildPartnerCard('Alice', [], categories, 0)
    expect(['minimal', 'moderate', 'high', 'critical']).toContain(card.focusDebtLevel)
  })

  it('includes exportedAt as ISO string', () => {
    const card = buildPartnerCard('Alice', [], categories, 0)
    expect(card.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('validatePartnerCard', () => {
  function validCard() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      nickname: 'Alice',
      streaks: {},
      dwsAvgThisWeek: 72,
      weeklyGoalPct: 85,
      focusDebtLevel: 'minimal',
      topCategory: 'Work',
    }
  }

  it('accepts a valid card', () => {
    expect(validatePartnerCard(validCard())).not.toBeNull()
  })

  it('rejects null', () => {
    expect(validatePartnerCard(null)).toBeNull()
  })

  it('rejects wrong version', () => {
    expect(validatePartnerCard({ ...validCard(), version: 2 })).toBeNull()
  })

  it('rejects missing nickname', () => {
    expect(validatePartnerCard({ ...validCard(), nickname: '' })).toBeNull()
  })

  it('rejects invalid debtLevel', () => {
    expect(validatePartnerCard({ ...validCard(), focusDebtLevel: 'unknown' })).toBeNull()
  })

  it('rejects non-object input', () => {
    expect(validatePartnerCard('not a card')).toBeNull()
    expect(validatePartnerCard(42)).toBeNull()
  })
})
