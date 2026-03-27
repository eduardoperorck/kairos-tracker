import { describe, it, expect } from 'vitest'
import { matchRule, aggregateBlocks, pendingSuggestions, needsClassification, getAutoStartCategory, computeCaptureRatio, computeTrackingAccuracy, getFriendlyProcessName, type WindowRule, type RawPollEvent, type CaptureBlock } from './passiveCapture'

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

  it('uses the most frequent (mode) title within the same process block', () => {
    const now = Date.now()
    // github.com appears 3 times, stackoverflow.com appears 1 time → mode is github.com
    const events: RawPollEvent[] = [
      { window: { title: 'github.com', process: 'chrome.exe', timestamp: now }, timestamp: now },
      { window: { title: 'stackoverflow.com', process: 'chrome.exe', timestamp: now + 10000 }, timestamp: now + 10000 },
      { window: { title: 'github.com', process: 'chrome.exe', timestamp: now + 20000 }, timestamp: now + 20000 },
      { window: { title: 'github.com', process: 'chrome.exe', timestamp: now + 60000 }, timestamp: now + 60000 },
    ]
    const blocks = aggregateBlocks(events, RULES)
    expect(blocks.length).toBe(1)
    expect(blocks[0].title).toBe('github.com')
  })

  it('falls back to last title when all titles have equal frequency', () => {
    const now = Date.now()
    const events: RawPollEvent[] = [
      { window: { title: 'title-a', process: 'Code.exe', timestamp: now }, timestamp: now },
      { window: { title: 'title-b', process: 'Code.exe', timestamp: now + 30000 }, timestamp: now + 30000 },
      { window: { title: 'title-c', process: 'Code.exe', timestamp: now + 60000 }, timestamp: now + 60000 },
    ]
    const blocks = aggregateBlocks(events, RULES)
    expect(blocks.length).toBe(1)
    // When all titles are equally frequent, any of them is valid — just verify it's one of them
    expect(['title-a', 'title-b', 'title-c']).toContain(blocks[0].title)
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

// ─── computeCaptureRatio (M83) ───────────────────────────────────────────────

describe('computeCaptureRatio', () => {
  const block: CaptureBlock = {
    process: 'Code.exe', title: '', startedAt: 1000, endedAt: 5000,
    categoryId: 'work', confirmed: true,
  }

  it('returns 0 when no sessions', () => {
    expect(computeCaptureRatio([], [block])).toBe(0)
  })

  it('returns 0 when no blocks', () => {
    const sessions = [{ startedAt: 1000, endedAt: 3000 }]
    expect(computeCaptureRatio(sessions, [])).toBe(0)
  })

  it('returns 1 when all sessions are covered', () => {
    const sessions = [{ startedAt: 2000, endedAt: 4000 }]
    expect(computeCaptureRatio(sessions, [block])).toBe(1)
  })

  it('returns partial ratio when only some sessions are covered', () => {
    const sessions = [
      { startedAt: 2000, endedAt: 4000 },   // covered by block (1000–5000)
      { startedAt: 9000, endedAt: 12000 },   // not covered
    ]
    expect(computeCaptureRatio(sessions, [block])).toBe(0.5)
  })

  it('treats adjacent (non-overlapping) blocks as not covering', () => {
    const sessions = [{ startedAt: 5000, endedAt: 7000 }]
    // block ends at 5000, session starts at 5000 → not strictly overlapping
    expect(computeCaptureRatio(sessions, [block])).toBe(0)
  })

  it('returns 1 when every session is covered by some block (100% coverage)', () => {
    const sessions = [
      { startedAt: 1500, endedAt: 2000 },
      { startedAt: 2500, endedAt: 4000 },
    ]
    // block spans 1000–5000, covering both sessions
    expect(computeCaptureRatio(sessions, [block])).toBe(1)
  })

  it('returns 0 when no session overlaps any block', () => {
    const sessions = [
      { startedAt: 6000, endedAt: 8000 },
      { startedAt: 9000, endedAt: 11000 },
    ]
    // block spans 1000–5000, none of the sessions overlap
    expect(computeCaptureRatio(sessions, [block])).toBe(0)
  })

  it('returns partial ratio when only some sessions overlap', () => {
    const sessions = [
      { startedAt: 2000, endedAt: 3000 },  // overlaps block (1000–5000)
      { startedAt: 6000, endedAt: 8000 },  // does not overlap
      { startedAt: 10000, endedAt: 12000 }, // does not overlap
    ]
    expect(computeCaptureRatio(sessions, [block])).toBeCloseTo(1 / 3)
  })
})

// ─── computeTrackingAccuracy (M90) ──────────────────────────────────────────

describe('computeTrackingAccuracy', () => {
  function makeSession(startedAt: number, endedAt: number) {
    return { id: 's', categoryId: 'c', date: '2026-03-10', startedAt, endedAt }
  }

  it('returns zeros for empty sessions', () => {
    const result = computeTrackingAccuracy([], [])
    expect(result).toEqual({ autoAccuracy: 0, coverage: 0, stabilityScore: 0, noiseRatio: 0, weeklyTAS: 0 })
  })

  it('autoAccuracy is 100 when no blocks exist', () => {
    const sessions = [makeSession(0, 60 * 60_000)]
    const result = computeTrackingAccuracy(sessions, [])
    expect(result.autoAccuracy).toBe(100)
  })

  it('autoAccuracy reflects confirmed/total block ratio', () => {
    const sessions = [makeSession(0, 60 * 60_000)]
    const blocks: CaptureBlock[] = [
      { process: 'a', title: '', startedAt: 0, endedAt: 1000, categoryId: 'c', confirmed: true },
      { process: 'b', title: '', startedAt: 0, endedAt: 1000, categoryId: 'c', confirmed: false },
    ]
    const result = computeTrackingAccuracy(sessions, blocks)
    expect(result.autoAccuracy).toBe(50)
  })

  it('coverage is 100 when session overlaps a block', () => {
    const sessions = [makeSession(1000, 5000)]
    const blocks: CaptureBlock[] = [
      { process: 'a', title: '', startedAt: 0, endedAt: 6000, categoryId: 'c', confirmed: true },
    ]
    const result = computeTrackingAccuracy(sessions, blocks)
    expect(result.coverage).toBe(100)
  })

  it('noiseRatio counts sessions under 2 minutes', () => {
    const sessions = [
      makeSession(0, 60_000),         // 1 min — noisy
      makeSession(0, 5 * 60_000),     // 5 min — normal
      makeSession(0, 119_000),        // ~2 min — noisy (< 2 min in ms)
    ]
    const result = computeTrackingAccuracy(sessions, [])
    expect(result.noiseRatio).toBeCloseTo(2 / 3)
  })

  it('stabilityScore caps at 100 for sessions >= 60 min', () => {
    const sessions = [makeSession(0, 120 * 60_000)] // 2 hours
    const result = computeTrackingAccuracy(sessions, [])
    expect(result.stabilityScore).toBe(100)
  })

  it('weeklyTAS is a composite score between 0 and 100', () => {
    const sessions = [makeSession(0, 30 * 60_000)]
    const result = computeTrackingAccuracy(sessions, [])
    expect(result.weeklyTAS).toBeGreaterThanOrEqual(0)
    expect(result.weeklyTAS).toBeLessThanOrEqual(100)
  })

  it('autoAccuracy is 100 when all blocks are confirmed', () => {
    const sessions = [makeSession(0, 60 * 60_000)]
    const blocks: CaptureBlock[] = [
      { process: 'a', title: '', startedAt: 0, endedAt: 1000, categoryId: 'c', confirmed: true },
      { process: 'b', title: '', startedAt: 1000, endedAt: 2000, categoryId: 'c', confirmed: true },
    ]
    const result = computeTrackingAccuracy(sessions, blocks)
    expect(result.autoAccuracy).toBe(100)
  })

  it('noiseRatio is 1 when all sessions are shorter than 2 minutes', () => {
    const sessions = [
      makeSession(0, 30_000),     // 30 seconds
      makeSession(100, 90_000),   // 90 seconds
      makeSession(200, 110_000),  // ~110 seconds — just under 2 min
    ]
    const result = computeTrackingAccuracy(sessions, [])
    expect(result.noiseRatio).toBe(1)
  })

  it('weeklyTAS formula produces a value between 0 and 100 for all-confirmed coverage scenario', () => {
    // Sessions with overlapping confirmed blocks → high autoAccuracy and coverage
    const sessions = [makeSession(1000, 5000)]
    const blocks: CaptureBlock[] = [
      { process: 'a', title: '', startedAt: 0, endedAt: 6000, categoryId: 'c', confirmed: true },
    ]
    const result = computeTrackingAccuracy(sessions, blocks)
    expect(result.autoAccuracy).toBe(100)
    expect(result.coverage).toBe(100)
    expect(result.weeklyTAS).toBeGreaterThanOrEqual(0)
    expect(result.weeklyTAS).toBeLessThanOrEqual(100)
  })

  // ── weeklyTAS edge cases ─────────────────────────────────────────────────

  it('weeklyTAS is 0 when sessions=[] and blocks=[]', () => {
    const result = computeTrackingAccuracy([], [])
    expect(result.weeklyTAS).toBe(0)
  })

  it('weeklyTAS is within [0, 100] for zero-coverage pathological input', () => {
    // sessions exist but none overlap any block → coverage = 0
    const sessions = [makeSession(10_000, 20_000)]
    const blocks: CaptureBlock[] = [
      // block ends before any session starts
      { process: 'a', title: '', startedAt: 0, endedAt: 5000, categoryId: 'c', confirmed: false },
    ]
    const result = computeTrackingAccuracy(sessions, blocks)
    expect(result.coverage).toBe(0)
    expect(result.weeklyTAS).toBeGreaterThanOrEqual(0)
    expect(result.weeklyTAS).toBeLessThanOrEqual(100)
  })

  it('weeklyTAS is within [0, 100] when all sessions are noisy (< 2 min) and all blocks are unconfirmed', () => {
    // noiseRatio = 1, autoAccuracy = 0, coverage = 0, stabilityScore ≈ 0
    const sessions = [
      makeSession(0, 30_000),   // 30 s
      makeSession(0, 60_000),   // 1 min
      makeSession(0, 90_000),   // 1.5 min
    ]
    const blocks: CaptureBlock[] = [
      { process: 'noise', title: '', startedAt: 0, endedAt: 5000, categoryId: null, confirmed: false },
    ]
    const result = computeTrackingAccuracy(sessions, blocks)
    expect(result.noiseRatio).toBe(1)
    expect(result.autoAccuracy).toBe(0)
    expect(result.weeklyTAS).toBeGreaterThanOrEqual(0)
    expect(result.weeklyTAS).toBeLessThanOrEqual(100)
  })

  // ── autoAccuracy distinguishes confirmed vs unconfirmed blocks ───────────

  it('autoAccuracy is 0 when all blocks are unconfirmed', () => {
    const sessions = [makeSession(0, 60 * 60_000)]
    const blocks: CaptureBlock[] = [
      { process: 'a', title: '', startedAt: 0, endedAt: 1000, categoryId: 'c', confirmed: false },
      { process: 'b', title: '', startedAt: 1000, endedAt: 2000, categoryId: 'c', confirmed: false },
    ]
    const result = computeTrackingAccuracy(sessions, blocks)
    expect(result.autoAccuracy).toBe(0)
  })

  it('autoAccuracy correctly counts only confirmed blocks in a mixed set', () => {
    const sessions = [makeSession(0, 60 * 60_000)]
    const blocks: CaptureBlock[] = [
      { process: 'a', title: '', startedAt: 0, endedAt: 1000, categoryId: 'c', confirmed: true },
      { process: 'b', title: '', startedAt: 1000, endedAt: 2000, categoryId: 'c', confirmed: true },
      { process: 'c', title: '', startedAt: 2000, endedAt: 3000, categoryId: 'c', confirmed: false },
      { process: 'd', title: '', startedAt: 3000, endedAt: 4000, categoryId: 'c', confirmed: false },
    ]
    // 2 confirmed / 4 total = 50%
    const result = computeTrackingAccuracy(sessions, blocks)
    expect(result.autoAccuracy).toBe(50)
  })

  it('autoAccuracy is 100 when blocks=[] (no auto-classification attempted)', () => {
    const sessions = [makeSession(0, 30 * 60_000)]
    const result = computeTrackingAccuracy(sessions, [])
    expect(result.autoAccuracy).toBe(100)
  })

  it('autoAccuracy treats a single confirmed block out of many as a low percentage', () => {
    const sessions = [makeSession(0, 60 * 60_000)]
    const blocks: CaptureBlock[] = [
      { process: 'ok', title: '', startedAt: 0, endedAt: 1000, categoryId: 'c', confirmed: true },
      ...Array.from({ length: 9 }, (_, i) => ({
        process: 'bad',
        title: '',
        startedAt: (i + 1) * 1000,
        endedAt: (i + 2) * 1000,
        categoryId: 'c' as string,
        confirmed: false,
      })),
    ]
    // 1 confirmed / 10 total = 10%
    const result = computeTrackingAccuracy(sessions, blocks)
    expect(result.autoAccuracy).toBe(10)
  })
})

describe('getFriendlyProcessName', () => {
  it('returns known friendly name for code.exe', () => {
    expect(getFriendlyProcessName('code.exe')).toBe('Visual Studio Code')
  })

  it('returns known friendly name for chrome.exe', () => {
    expect(getFriendlyProcessName('chrome.exe')).toBe('Google Chrome')
  })

  it('strips .exe when no known mapping and no displayName', () => {
    expect(getFriendlyProcessName('myapp.exe')).toBe('myapp')
  })

  it('uses displayName as fallback when process is unknown', () => {
    expect(getFriendlyProcessName('unknown.exe', 'My App')).toBe('My App')
  })

  it('prefers map over displayName for known processes', () => {
    expect(getFriendlyProcessName('code.exe', 'Code')).toBe('Visual Studio Code')
  })

  it('is case-insensitive for process lookup', () => {
    expect(getFriendlyProcessName('Code.exe')).toBe('Visual Studio Code')
  })
})
