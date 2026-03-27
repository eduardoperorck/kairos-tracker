import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { migrateLocalStorageRules } from './localStorageMigration'
import { createInMemoryStorage } from './inMemoryStorage'

const WINDOW_RULES_KEY = 'user_window_rules'
const DOMAIN_RULES_KEY = 'user_domain_rules'
const CORRECTION_KEY = 'correction_records'

// jsdom provides localStorage; use real implementation for these tests.
beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

afterEach(() => {
  localStorage.clear()
})

describe('migrateLocalStorageRules', () => {
  it('is a no-op when localStorage has no data', async () => {
    const storage = createInMemoryStorage()
    await migrateLocalStorageRules(storage)

    expect(await storage.loadWindowRules()).toHaveLength(0)
    expect(await storage.loadDomainRules()).toHaveLength(0)
    expect(await storage.loadCorrections()).toHaveLength(0)
  })

  it('migrates window rules from localStorage to storage', async () => {
    const rules = [
      { id: 'r1', matchType: 'process', pattern: 'code.exe', categoryId: 'work', mode: 'auto', enabled: true },
    ]
    localStorage.setItem(WINDOW_RULES_KEY, JSON.stringify(rules))

    const storage = createInMemoryStorage()
    await migrateLocalStorageRules(storage)

    const stored = await storage.loadWindowRules()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ id: 'r1', pattern: 'code.exe', categoryId: 'work' })
  })

  it('removes window rules key from localStorage after migration', async () => {
    localStorage.setItem(WINDOW_RULES_KEY, JSON.stringify([
      { id: 'r1', matchType: 'process', pattern: 'code.exe', categoryId: 'work', mode: 'auto', enabled: true },
    ]))

    const storage = createInMemoryStorage()
    await migrateLocalStorageRules(storage)

    expect(localStorage.getItem(WINDOW_RULES_KEY)).toBeNull()
  })

  it('migrates domain rules from localStorage to storage', async () => {
    const rules = [{ id: 'dr1', domain: 'github.com', categoryId: 'work' }]
    localStorage.setItem(DOMAIN_RULES_KEY, JSON.stringify(rules))

    const storage = createInMemoryStorage()
    await migrateLocalStorageRules(storage)

    const stored = await storage.loadDomainRules()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ domain: 'github.com', categoryId: 'work' })
    expect(localStorage.getItem(DOMAIN_RULES_KEY)).toBeNull()
  })

  it('migrates correction records from localStorage to storage', async () => {
    const records = [{ contextKey: 'code.exe::proj::', categoryId: 'work', count: 2 }]
    localStorage.setItem(CORRECTION_KEY, JSON.stringify(records))

    const storage = createInMemoryStorage()
    await migrateLocalStorageRules(storage)

    const stored = await storage.loadCorrections()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ contextKey: 'code.exe::proj::', categoryId: 'work', count: 2 })
    expect(localStorage.getItem(CORRECTION_KEY)).toBeNull()
  })

  it('migrates all three stores in one call', async () => {
    localStorage.setItem(WINDOW_RULES_KEY, JSON.stringify([
      { id: 'r1', matchType: 'process', pattern: 'figma.exe', categoryId: 'design', mode: 'auto', enabled: true },
    ]))
    localStorage.setItem(DOMAIN_RULES_KEY, JSON.stringify([
      { id: 'dr1', domain: 'notion.so', categoryId: 'work' },
    ]))
    localStorage.setItem(CORRECTION_KEY, JSON.stringify([
      { contextKey: 'slack.exe::', categoryId: 'work', count: 3 },
    ]))

    const storage = createInMemoryStorage()
    await migrateLocalStorageRules(storage)

    expect(await storage.loadWindowRules()).toHaveLength(1)
    expect(await storage.loadDomainRules()).toHaveLength(1)
    expect(await storage.loadCorrections()).toHaveLength(1)
    expect(localStorage.getItem(WINDOW_RULES_KEY)).toBeNull()
    expect(localStorage.getItem(DOMAIN_RULES_KEY)).toBeNull()
    expect(localStorage.getItem(CORRECTION_KEY)).toBeNull()
  })

  it('handles malformed JSON gracefully (does not throw)', async () => {
    localStorage.setItem(WINDOW_RULES_KEY, 'not-json')
    localStorage.setItem(DOMAIN_RULES_KEY, '{bad}')

    const storage = createInMemoryStorage()
    await expect(migrateLocalStorageRules(storage)).resolves.not.toThrow()
  })

  it('does not overwrite existing storage rules when localStorage is empty', async () => {
    const storage = createInMemoryStorage()
    await storage.saveWindowRule({
      id: 'existing', matchType: 'process', pattern: 'chrome.exe', categoryId: 'browse', mode: 'auto', enabled: true,
    })

    await migrateLocalStorageRules(storage)

    const rules = await storage.loadWindowRules()
    expect(rules).toHaveLength(1)
    expect(rules[0].id).toBe('existing')
  })
})
