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
