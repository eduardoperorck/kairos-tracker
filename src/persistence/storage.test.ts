import { describe, it, expect, beforeEach } from 'vitest'
import { createInMemoryStorage } from './inMemoryStorage'
import type { Storage } from './storage'

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

describe('updateAccumulatedMs', () => {
  it('updates the accumulated time for a category', async () => {
    await storage.saveCategory('id-1', 'Work')
    await storage.updateAccumulatedMs('id-1', 5000)
    const [cat] = await storage.loadCategories()
    expect(cat.accumulatedMs).toBe(5000)
  })

  it('accumulates across multiple updates', async () => {
    await storage.saveCategory('id-1', 'Work')
    await storage.updateAccumulatedMs('id-1', 3000)
    await storage.updateAccumulatedMs('id-1', 7000)
    const [cat] = await storage.loadCategories()
    expect(cat.accumulatedMs).toBe(7000)
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
