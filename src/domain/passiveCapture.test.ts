import { describe, it, expect } from 'vitest'
import { matchRule, aggregateBlocks, pendingSuggestions, type WindowRule, type RawPollEvent } from './passiveCapture'

const RULES: WindowRule[] = [
  { id: '1', matchType: 'process', pattern: 'Code.exe', categoryId: 'work', mode: 'suggest', enabled: true },
  { id: '2', matchType: 'title', pattern: 'GitHub', categoryId: 'work', mode: 'auto', enabled: true },
  { id: '3', matchType: 'process', pattern: 'Spotify.exe', categoryId: null, mode: 'ignore', enabled: true },
  { id: '4', matchType: 'process', pattern: 'Disabled.exe', categoryId: 'work', mode: 'auto', enabled: false },
]

describe('matchRule', () => {
  it('matches process rule', () => {
    const w = { title: 'index.ts', process: 'Code.exe', timestamp: 0 }
    expect(matchRule(w, RULES)?.id).toBe('1')
  })

  it('matches title rule', () => {
    const w = { title: 'GitHub Pull Request', process: 'chrome.exe', timestamp: 0 }
    expect(matchRule(w, RULES)?.id).toBe('2')
  })

  it('returns null for no match', () => {
    const w = { title: 'Slack', process: 'slack.exe', timestamp: 0 }
    expect(matchRule(w, RULES)).toBeNull()
  })

  it('ignores disabled rules', () => {
    const w = { title: '', process: 'Disabled.exe', timestamp: 0 }
    expect(matchRule(w, RULES)).toBeNull()
  })
})

describe('aggregateBlocks', () => {
  it('returns empty array for empty events', () => {
    expect(aggregateBlocks([], RULES)).toEqual([])
  })

  it('aggregates continuous events into blocks', () => {
    const now = Date.now()
    const events: RawPollEvent[] = [
      { window: { title: '', process: 'Code.exe', timestamp: now }, timestamp: now },
      { window: { title: '', process: 'Code.exe', timestamp: now + 10000 }, timestamp: now + 10000 },
      { window: { title: '', process: 'Code.exe', timestamp: now + 60000 }, timestamp: now + 60000 },
    ]
    const blocks = aggregateBlocks(events, RULES)
    expect(blocks.length).toBe(1)
    expect(blocks[0].process).toBe('Code.exe')
    expect(blocks[0].categoryId).toBe('work')
  })

  it('splits on process change', () => {
    const now = Date.now()
    const events: RawPollEvent[] = [
      { window: { title: '', process: 'Code.exe', timestamp: now }, timestamp: now },
      { window: { title: '', process: 'Code.exe', timestamp: now + 40000 }, timestamp: now + 40000 },
      { window: { title: '', process: 'chrome.exe', timestamp: now + 50000 }, timestamp: now + 50000 },
      { window: { title: '', process: 'chrome.exe', timestamp: now + 100000 }, timestamp: now + 100000 },
    ]
    const blocks = aggregateBlocks(events, RULES)
    expect(blocks.length).toBe(2)
  })
})

describe('pendingSuggestions', () => {
  it('returns unconfirmed blocks with category', () => {
    const blocks = [
      { process: 'Code.exe', title: '', startedAt: 0, endedAt: 1, categoryId: 'work', confirmed: false },
      { process: 'Code.exe', title: '', startedAt: 0, endedAt: 1, categoryId: 'work', confirmed: true },
      { process: 'Spotify.exe', title: '', startedAt: 0, endedAt: 1, categoryId: null, confirmed: false },
    ]
    const pending = pendingSuggestions(blocks)
    expect(pending.length).toBe(1)
    expect(pending[0].process).toBe('Code.exe')
  })
})
