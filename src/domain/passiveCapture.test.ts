import { describe, it, expect } from 'vitest'
import { matchRule, aggregateBlocks, pendingSuggestions, needsClassification, getAutoStartCategory, type WindowRule, type RawPollEvent } from './passiveCapture'

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

describe('needsClassification', () => {
  const baseRules: WindowRule[] = [
    { id: 'vscode', matchType: 'process', pattern: 'Code.exe', categoryId: null, mode: 'suggest', enabled: true },
    { id: 'spotify', matchType: 'process', pattern: 'Spotify.exe', categoryId: null, mode: 'ignore', enabled: true },
    { id: 'work', matchType: 'process', pattern: 'slack.exe', categoryId: 'cat-1', mode: 'auto', enabled: true },
  ]

  it('returns true for unknown process with no rules', () => {
    expect(needsClassification('unknown.exe', baseRules)).toBe(true)
  })

  it('returns true for process with suggest rule and no categoryId (DEFAULT_DEV_RULES pattern)', () => {
    // Code.exe has a suggest rule but categoryId is null → user never assigned it
    expect(needsClassification('Code.exe', baseRules)).toBe(true)
  })

  it('returns false for process with ignore rule', () => {
    expect(needsClassification('Spotify.exe', baseRules)).toBe(false)
  })

  it('returns false for process already assigned to a category', () => {
    expect(needsClassification('slack.exe', baseRules)).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(needsClassification('code.exe', baseRules)).toBe(true)
    expect(needsClassification('SPOTIFY.EXE', baseRules)).toBe(false)
  })

  it('returns false for disabled rule (process is unrecognized → should prompt)', () => {
    const rules: WindowRule[] = [
      { id: 'x', matchType: 'process', pattern: 'app.exe', categoryId: null, mode: 'ignore', enabled: false },
    ]
    // Disabled rule doesn't count → still needs classification
    expect(needsClassification('app.exe', rules)).toBe(true)
  })
})

describe('getAutoStartCategory', () => {
  const rules: WindowRule[] = [
    { id: 'a', matchType: 'process', pattern: 'chrome.exe', categoryId: 'work', mode: 'auto', enabled: true },
    { id: 'b', matchType: 'process', pattern: 'Code.exe',   categoryId: null,   mode: 'suggest', enabled: true },
    { id: 'c', matchType: 'process', pattern: 'game.exe',   categoryId: null,   mode: 'ignore', enabled: true },
  ]

  it('returns categoryId for auto rule', () => {
    expect(getAutoStartCategory({ process: 'chrome.exe', title: '' }, rules)).toBe('work')
  })

  it('returns null for suggest rule without categoryId', () => {
    expect(getAutoStartCategory({ process: 'Code.exe', title: '' }, rules)).toBeNull()
  })

  it('returns null for ignore rule', () => {
    expect(getAutoStartCategory({ process: 'game.exe', title: '' }, rules)).toBeNull()
  })

  it('returns null for unknown process', () => {
    expect(getAutoStartCategory({ process: 'notepad.exe', title: '' }, rules)).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(getAutoStartCategory({ process: 'CHROME.EXE', title: '' }, rules)).toBe('work')
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
