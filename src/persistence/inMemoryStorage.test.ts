import { describe, it, expect, beforeEach } from 'vitest'
import { createInMemoryStorage } from './inMemoryStorage'
import type { Storage } from './storage'

describe('inMemoryStorage — CaptureStorage', () => {
  let storage: Storage

  beforeEach(() => {
    storage = createInMemoryStorage()
  })

  it('saveDailyCaptureStat stores a row', async () => {
    await storage.saveDailyCaptureStat({
      date: '2026-03-20',
      process: 'code.exe',
      total_ms: 60_000,
      block_count: 2,
      category_id: 'cat-1',
    })

    const rows = await storage.loadDailyCaptureStatsSince('2026-03-20')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      date: '2026-03-20',
      process: 'code.exe',
      total_ms: 60_000,
      block_count: 2,
      category_id: 'cat-1',
    })
  })

  it('loadDailyCaptureStatsSince returns only rows on or after the given date', async () => {
    await storage.saveDailyCaptureStat({ date: '2026-03-18', process: 'chrome.exe', total_ms: 10_000, block_count: 1, category_id: null })
    await storage.saveDailyCaptureStat({ date: '2026-03-19', process: 'chrome.exe', total_ms: 20_000, block_count: 1, category_id: null })
    await storage.saveDailyCaptureStat({ date: '2026-03-20', process: 'chrome.exe', total_ms: 30_000, block_count: 1, category_id: null })

    const rows = await storage.loadDailyCaptureStatsSince('2026-03-19')
    expect(rows).toHaveLength(2)
    expect(rows.map(r => r.date).sort()).toEqual(['2026-03-19', '2026-03-20'])
  })

  it('duplicate date+process upserts by summing total_ms and block_count', async () => {
    await storage.saveDailyCaptureStat({ date: '2026-03-20', process: 'code.exe', total_ms: 30_000, block_count: 1, category_id: 'cat-1' })
    await storage.saveDailyCaptureStat({ date: '2026-03-20', process: 'code.exe', total_ms: 20_000, block_count: 1, category_id: 'cat-1' })

    const rows = await storage.loadDailyCaptureStatsSince('2026-03-20')
    expect(rows).toHaveLength(1)
    expect(rows[0].total_ms).toBe(50_000)
    expect(rows[0].block_count).toBe(2)
  })

  it('different processes on the same date are stored independently', async () => {
    await storage.saveDailyCaptureStat({ date: '2026-03-20', process: 'code.exe', total_ms: 10_000, block_count: 1, category_id: 'cat-1' })
    await storage.saveDailyCaptureStat({ date: '2026-03-20', process: 'chrome.exe', total_ms: 5_000, block_count: 1, category_id: null })

    const rows = await storage.loadDailyCaptureStatsSince('2026-03-20')
    expect(rows).toHaveLength(2)
  })

  it('loadDailyCaptureStatsSince returns empty array when no rows exist', async () => {
    const rows = await storage.loadDailyCaptureStatsSince('2026-03-20')
    expect(rows).toHaveLength(0)
  })
})

describe('inMemoryStorage — WindowRuleStorage', () => {
  let storage: Storage

  beforeEach(() => {
    storage = createInMemoryStorage()
  })

  it('starts with no window rules', async () => {
    const rules = await storage.loadWindowRules()
    expect(rules).toEqual([])
  })

  it('saves a rule and loads it back', async () => {
    const rule = {
      id: 'rule-1',
      matchType: 'process' as const,
      pattern: 'code.exe',
      categoryId: 'cat-abc',
      mode: 'auto' as const,
      enabled: true,
    }
    await storage.saveWindowRule(rule)
    const rules = await storage.loadWindowRules()
    expect(rules).toHaveLength(1)
    expect(rules[0]).toEqual(rule)
  })

  it('overwrites a rule with the same id on save', async () => {
    const rule = {
      id: 'rule-1',
      matchType: 'process' as const,
      pattern: 'code.exe',
      categoryId: 'cat-abc',
      mode: 'auto' as const,
      enabled: true,
    }
    await storage.saveWindowRule(rule)
    await storage.saveWindowRule({ ...rule, mode: 'suggest' })
    const rules = await storage.loadWindowRules()
    expect(rules).toHaveLength(1)
    expect(rules[0].mode).toBe('suggest')
  })

  it('deletes a rule by id', async () => {
    const rule = {
      id: 'rule-1',
      matchType: 'process' as const,
      pattern: 'code.exe',
      categoryId: null,
      mode: 'ignore' as const,
      enabled: true,
    }
    await storage.saveWindowRule(rule)
    await storage.deleteWindowRule('rule-1')
    const rules = await storage.loadWindowRules()
    expect(rules).toHaveLength(0)
  })

  it('only deletes the targeted rule when multiple exist', async () => {
    const r1 = { id: 'r1', matchType: 'process' as const, pattern: 'a.exe', categoryId: null, mode: 'ignore' as const, enabled: true }
    const r2 = { id: 'r2', matchType: 'process' as const, pattern: 'b.exe', categoryId: 'cat-1', mode: 'auto' as const, enabled: true }
    await storage.saveWindowRule(r1)
    await storage.saveWindowRule(r2)
    await storage.deleteWindowRule('r1')
    const rules = await storage.loadWindowRules()
    expect(rules).toHaveLength(1)
    expect(rules[0].id).toBe('r2')
  })

  it('deleting a non-existent id is a no-op', async () => {
    const rule = { id: 'r1', matchType: 'process' as const, pattern: 'a.exe', categoryId: null, mode: 'ignore' as const, enabled: true }
    await storage.saveWindowRule(rule)
    await storage.deleteWindowRule('does-not-exist')
    const rules = await storage.loadWindowRules()
    expect(rules).toHaveLength(1)
  })
})

describe('inMemoryStorage — DomainRuleStorage', () => {
  let storage: Storage

  beforeEach(() => {
    storage = createInMemoryStorage()
  })

  it('starts with no domain rules', async () => {
    expect(await storage.loadDomainRules()).toEqual([])
  })

  it('saves a domain rule and loads it back', async () => {
    await storage.saveDomainRule({ id: 'dr-1', domain: 'github.com', categoryId: 'work' })
    const rules = await storage.loadDomainRules()
    expect(rules).toHaveLength(1)
    expect(rules[0]).toEqual({ id: 'dr-1', domain: 'github.com', categoryId: 'work' })
  })

  it('overwrites a rule with the same id', async () => {
    await storage.saveDomainRule({ id: 'dr-1', domain: 'github.com', categoryId: 'work' })
    await storage.saveDomainRule({ id: 'dr-1', domain: 'github.com', categoryId: 'study' })
    const rules = await storage.loadDomainRules()
    expect(rules).toHaveLength(1)
    expect(rules[0].categoryId).toBe('study')
  })

  it('deletes a domain rule by id', async () => {
    await storage.saveDomainRule({ id: 'dr-1', domain: 'github.com', categoryId: 'work' })
    await storage.deleteDomainRule('dr-1')
    expect(await storage.loadDomainRules()).toHaveLength(0)
  })

  it('deleting a non-existent domain rule is a no-op', async () => {
    await storage.saveDomainRule({ id: 'dr-1', domain: 'github.com', categoryId: 'work' })
    await storage.deleteDomainRule('does-not-exist')
    expect(await storage.loadDomainRules()).toHaveLength(1)
  })
})

describe('inMemoryStorage — CorrectionStorage', () => {
  let storage: Storage

  beforeEach(() => {
    storage = createInMemoryStorage()
  })

  it('starts with no corrections', async () => {
    expect(await storage.loadCorrections()).toEqual([])
  })

  it('saves a correction and loads it back', async () => {
    await storage.saveCorrection({ contextKey: 'code.exe::proj::', categoryId: 'work', count: 1 })
    const records = await storage.loadCorrections()
    expect(records).toHaveLength(1)
    expect(records[0]).toEqual({ contextKey: 'code.exe::proj::', categoryId: 'work', count: 1 })
  })

  it('overwrites a correction with the same contextKey+categoryId', async () => {
    await storage.saveCorrection({ contextKey: 'code.exe::proj::', categoryId: 'work', count: 1 })
    await storage.saveCorrection({ contextKey: 'code.exe::proj::', categoryId: 'work', count: 3 })
    const records = await storage.loadCorrections()
    expect(records).toHaveLength(1)
    expect(records[0].count).toBe(3)
  })

  it('stores corrections for different contextKeys independently', async () => {
    await storage.saveCorrection({ contextKey: 'code.exe::proj-a::', categoryId: 'work', count: 2 })
    await storage.saveCorrection({ contextKey: 'code.exe::proj-b::', categoryId: 'study', count: 1 })
    expect(await storage.loadCorrections()).toHaveLength(2)
  })
})

describe('inMemoryStorage — deleteSession / updateSessionTime', () => {
  let storage: Storage

  beforeEach(() => {
    storage = createInMemoryStorage()
  })

  it('deleteSession removes a session by id', async () => {
    await storage.saveSession({ id: 's1', categoryId: 'c1', startedAt: 0, endedAt: 3600000, date: '2026-03-26' })
    await storage.saveSession({ id: 's2', categoryId: 'c1', startedAt: 0, endedAt: 1800000, date: '2026-03-26' })
    await storage.deleteSession('s1')
    const sessions = await storage.loadSessionsByDate('2026-03-26')
    expect(sessions).toHaveLength(1)
    expect(sessions[0].id).toBe('s2')
  })

  it('deleteSession is a no-op when id does not exist', async () => {
    await storage.saveSession({ id: 's1', categoryId: 'c1', startedAt: 0, endedAt: 3600000, date: '2026-03-26' })
    await storage.deleteSession('nonexistent')
    const sessions = await storage.loadSessionsByDate('2026-03-26')
    expect(sessions).toHaveLength(1)
  })

  it('updateSessionTime changes startedAt and endedAt', async () => {
    await storage.saveSession({ id: 's1', categoryId: 'c1', startedAt: 0, endedAt: 3600000, date: '2026-03-26' })
    await storage.updateSessionTime('s1', 1800000, 5400000)
    const sessions = await storage.loadSessionsByDate('2026-03-26')
    expect(sessions[0].startedAt).toBe(1800000)
    expect(sessions[0].endedAt).toBe(5400000)
  })

  it('updateSessionTime preserves other session fields', async () => {
    await storage.saveSession({ id: 's1', categoryId: 'c1', startedAt: 0, endedAt: 3600000, date: '2026-03-26', tag: 'deep work' })
    await storage.updateSessionTime('s1', 100, 200)
    const sessions = await storage.loadSessionsByDate('2026-03-26')
    expect(sessions[0].tag).toBe('deep work')
    expect(sessions[0].categoryId).toBe('c1')
  })
})
