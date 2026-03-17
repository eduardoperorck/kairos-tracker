import { describe, it, expect, beforeEach } from 'vitest'
import { createInMemoryStorage } from './inMemoryStorage'
import type { Storage } from './storage'
import type { Session } from '../domain/timer'

let storage: Storage

beforeEach(() => {
  storage = createInMemoryStorage()
})

describe('loadCategories', () => {
  it('returns empty array on fresh storage', async () => {
    const categories = await storage.loadCategories()
    expect(categories).toEqual([])
  })

  it('returns saved categories', async () => {
    await storage.saveCategory('id-1', 'Work')
    const categories = await storage.loadCategories()
    expect(categories).toHaveLength(1)
    expect(categories[0]).toEqual({ id: 'id-1', name: 'Work', accumulatedMs: 0 })
  })

  it('returns multiple categories', async () => {
    await storage.saveCategory('id-1', 'Work')
    await storage.saveCategory('id-2', 'Study')
    const categories = await storage.loadCategories()
    expect(categories).toHaveLength(2)
  })
})

describe('saveCategory', () => {
  it('persists a category with zero accumulated time', async () => {
    await storage.saveCategory('id-1', 'Work')
    const [cat] = await storage.loadCategories()
    expect(cat.accumulatedMs).toBe(0)
  })

  it('saving the same id twice does not duplicate it', async () => {
    await storage.saveCategory('id-1', 'Work')
    await storage.saveCategory('id-1', 'Work')
    const categories = await storage.loadCategories()
    expect(categories).toHaveLength(1)
  })
})

describe('renameCategory', () => {
  it('updates the name in storage', async () => {
    await storage.saveCategory('id-1', 'Work')
    await storage.renameCategory('id-1', 'Deep Work')
    const [cat] = await storage.loadCategories()
    expect(cat.name).toBe('Deep Work')
  })

  it('only renames the target category', async () => {
    await storage.saveCategory('id-1', 'Work')
    await storage.saveCategory('id-2', 'Study')
    await storage.renameCategory('id-1', 'Deep Work')
    const categories = await storage.loadCategories()
    expect(categories.find(c => c.id === 'id-2')!.name).toBe('Study')
  })
})

describe('saveSession / loadSessionsByDate', () => {
  const today = '2026-03-15'

  function makeSession(overrides: Partial<Session> = {}): Session {
    return { id: 's-1', categoryId: 'cat-1', startedAt: 0, endedAt: 3000, date: today, ...overrides }
  }

  it('returns empty array when no sessions saved', async () => {
    expect(await storage.loadSessionsByDate(today)).toEqual([])
  })

  it('saves and loads a session', async () => {
    const s = makeSession()
    await storage.saveSession(s)
    const loaded = await storage.loadSessionsByDate(today)
    expect(loaded).toHaveLength(1)
    expect(loaded[0]).toEqual(s)
  })

  it('only returns sessions for the requested date', async () => {
    await storage.saveSession(makeSession({ id: 's-1', date: today }))
    await storage.saveSession(makeSession({ id: 's-2', date: '2026-03-14' }))
    const loaded = await storage.loadSessionsByDate(today)
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('s-1')
  })

  it('returns sessions from multiple categories for the same date', async () => {
    await storage.saveSession(makeSession({ id: 's-1', categoryId: 'cat-1' }))
    await storage.saveSession(makeSession({ id: 's-2', categoryId: 'cat-2' }))
    expect(await storage.loadSessionsByDate(today)).toHaveLength(2)
  })
})

describe('deleteCategory', () => {
  it('removes the category from storage', async () => {
    await storage.saveCategory('id-1', 'Work')
    await storage.deleteCategory('id-1')
    expect(await storage.loadCategories()).toHaveLength(0)
  })

  it('only removes the target category', async () => {
    await storage.saveCategory('id-1', 'Work')
    await storage.saveCategory('id-2', 'Study')
    await storage.deleteCategory('id-1')
    const categories = await storage.loadCategories()
    expect(categories).toHaveLength(1)
    expect(categories[0].id).toBe('id-2')
  })

  it('is a no-op for a non-existent id', async () => {
    await storage.saveCategory('id-1', 'Work')
    await storage.deleteCategory('nonexistent')
    expect(await storage.loadCategories()).toHaveLength(1)
  })
})

describe('setWeeklyGoal', () => {
  it('sets weeklyGoalMs on a category', async () => {
    await storage.saveCategory('id-1', 'Work')
    await storage.setWeeklyGoal('id-1', 7_200_000)
    const [cat] = await storage.loadCategories()
    expect(cat.weeklyGoalMs).toBe(7_200_000)
  })

  it('is a no-op for non-existent id', async () => {
    await storage.setWeeklyGoal('nonexistent', 3_600_000)
    expect(await storage.loadCategories()).toHaveLength(0)
  })
})

describe('setColor', () => {
  it('sets color on a category', async () => {
    await storage.saveCategory('id-1', 'Work')
    await storage.setColor('id-1', '#ff0000')
    const [cat] = await storage.loadCategories()
    expect(cat.color).toBe('#ff0000')
  })

  it('is a no-op for non-existent id', async () => {
    await storage.setColor('nonexistent', '#ff0000')
    expect(await storage.loadCategories()).toHaveLength(0)
  })
})

describe('loadSessionsSince', () => {
  const makeSession = (overrides: Partial<Session> = {}): Session => ({
    id: 's-1', categoryId: 'cat-1', startedAt: 0, endedAt: 3000, date: '2026-03-15', ...overrides,
  })

  it('returns all sessions on or after the given date', async () => {
    await storage.saveSession(makeSession({ id: 's-1', date: '2026-03-14' }))
    await storage.saveSession(makeSession({ id: 's-2', date: '2026-03-15' }))
    await storage.saveSession(makeSession({ id: 's-3', date: '2026-03-16' }))
    const result = await storage.loadSessionsSince('2026-03-15')
    expect(result).toHaveLength(2)
    expect(result.map(s => s.id).sort()).toEqual(['s-2', 's-3'])
  })

  it('returns empty when no sessions match', async () => {
    await storage.saveSession(makeSession({ date: '2026-03-10' }))
    expect(await storage.loadSessionsSince('2026-03-15')).toHaveLength(0)
  })
})

describe('getSetting / setSetting', () => {
  it('returns null for unknown key', async () => {
    expect(await storage.getSetting('nonexistent')).toBeNull()
  })

  it('stores and retrieves a setting', async () => {
    await storage.setSetting('theme', 'dark')
    expect(await storage.getSetting('theme')).toBe('dark')
  })

  it('overwrites an existing setting', async () => {
    await storage.setSetting('theme', 'dark')
    await storage.setSetting('theme', 'light')
    expect(await storage.getSetting('theme')).toBe('light')
  })
})

describe('saveIntention / loadIntentionsByDate', () => {
  it('returns empty for a date with no intentions', async () => {
    expect(await storage.loadIntentionsByDate('2026-03-15')).toHaveLength(0)
  })

  it('saves and loads an intention', async () => {
    const intention = { date: '2026-03-15', text: 'deep work', createdAt: 0 }
    await storage.saveIntention(intention)
    const loaded = await storage.loadIntentionsByDate('2026-03-15')
    expect(loaded).toHaveLength(1)
    expect(loaded[0]).toEqual(intention)
  })

  it('only returns intentions for the requested date', async () => {
    await storage.saveIntention({ date: '2026-03-15', text: 'task a', createdAt: 0 })
    await storage.saveIntention({ date: '2026-03-16', text: 'task b', createdAt: 0 })
    expect(await storage.loadIntentionsByDate('2026-03-15')).toHaveLength(1)
  })
})

describe('saveEveningReview / loadEveningReviewByDate', () => {
  it('returns null when no review saved', async () => {
    expect(await storage.loadEveningReviewByDate('2026-03-15')).toBeNull()
  })

  it('saves and loads an evening review', async () => {
    const review = { date: '2026-03-15', mood: 4 as const, notes: 'shipped feature', createdAt: 0 }
    await storage.saveEveningReview(review)
    const loaded = await storage.loadEveningReviewByDate('2026-03-15')
    expect(loaded).toEqual(review)
  })

  it('overwrites review for the same date', async () => {
    const r1 = { date: '2026-03-15', mood: 3 as const, notes: 'first', createdAt: 0 }
    const r2 = { date: '2026-03-15', mood: 5 as const, notes: 'second', createdAt: 1 }
    await storage.saveEveningReview(r1)
    await storage.saveEveningReview(r2)
    const loaded = await storage.loadEveningReviewByDate('2026-03-15')
    expect(loaded?.mood).toBe(5)
    expect(loaded?.notes).toBe('second')
  })
})

describe('importSessions', () => {
  const makeSession = (overrides: Partial<Session> = {}): Session => ({
    id: 's-1', categoryId: 'cat-1', startedAt: 0, endedAt: 3000, date: '2026-03-15', ...overrides,
  })

  it('imports sessions that do not already exist', async () => {
    await storage.importSessions([makeSession({ id: 's-import-1' }), makeSession({ id: 's-import-2', date: '2026-03-16' })])
    const all = await storage.loadSessionsSince('2026-03-15')
    expect(all).toHaveLength(2)
  })

  it('does not duplicate sessions with the same id', async () => {
    const s = makeSession({ id: 's-dup' })
    await storage.saveSession(s)
    await storage.importSessions([s])
    const loaded = await storage.loadSessionsByDate('2026-03-15')
    expect(loaded).toHaveLength(1)
  })

  it('handles empty array without error', async () => {
    await expect(storage.importSessions([])).resolves.not.toThrow()
  })
})
