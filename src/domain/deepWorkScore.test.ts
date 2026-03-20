import { describe, it, expect } from 'vitest'
import { computeDWS, getDWSLabel } from './deepWorkScore'
import type { CaptureBlock } from './passiveCapture'

function makeBlock(startedAt: number, endedAt: number, process = 'Code.exe', title = ''): CaptureBlock {
  return { process, title, startedAt, endedAt, categoryId: 'work', confirmed: true }
}

describe('computeDWS', () => {
  it('returns zero score for empty blocks', () => {
    const now = Date.now()
    const dws = computeDWS([], now - 3600000, now)
    expect(dws.total).toBe(0)
  })

  it('returns perfect score for ideal session', () => {
    const now = Date.now()
    const start = now - 60 * 60_000
    const blocks = [makeBlock(start, now, 'Code.exe')]
    const dws = computeDWS(blocks, start, now)
    expect(dws.continuousBlock).toBe(25) // single block > 25min → capped at 25
    expect(dws.lowSwitches).toBe(25)     // 0 switches
    expect(dws.flowSession).toBe(25)     // 60min >= 45min → capped at 25
    expect(dws.noDistractions).toBe(25)  // no distractions
    expect(dws.total).toBe(100)
  })

  it('penalizes distraction apps (Spotify.exe — ignore-mode process)', () => {
    const now = Date.now()
    const start = now - 60 * 60_000
    const blocks = [
      makeBlock(start, start + 30 * 60_000, 'Code.exe'),
      makeBlock(start + 30 * 60_000, now, 'Spotify.exe'),
    ]
    const dws = computeDWS(blocks, start, now)
    expect(dws.noDistractions).toBe(0)
  })

  it('penalizes too many switches per hour', () => {
    const now = Date.now()
    const start = now - 60 * 60_000
    const blocks = []
    for (let i = 0; i < 10; i++) {
      blocks.push(makeBlock(
        start + i * 6 * 60_000,
        start + (i + 1) * 6 * 60_000,
        i % 2 === 0 ? 'Code.exe' : 'slack.exe'
      ))
    }
    const dws = computeDWS(blocks, start, now)
    expect(dws.lowSwitches).toBe(0)
  })

  // M75: continuous subscore is proportional (not binary)
  it('gives partial continuousBlock score for block shorter than 25min', () => {
    const now = Date.now()
    const start = now - 60 * 60_000
    // Single block of 12.5 min = half of 25min target → expect ~12.5
    const blockEnd = start + 12.5 * 60_000
    const blocks = [makeBlock(start, blockEnd, 'Code.exe')]
    const dws = computeDWS(blocks, start, now)
    expect(dws.continuousBlock).toBeGreaterThan(0)
    expect(dws.continuousBlock).toBeLessThan(25)
    expect(dws.continuousBlock).toBeCloseTo(12.5, 1)
  })

  // M75: flow score is proportional (not binary)
  it('gives partial flowSession score for session shorter than 45min', () => {
    const now = Date.now()
    const start = now - 22.5 * 60_000 // 22.5 min session = half of 45min target
    const blocks = [makeBlock(start, now, 'Code.exe')]
    const dws = computeDWS(blocks, start, now)
    expect(dws.flowSession).toBeGreaterThan(0)
    expect(dws.flowSession).toBeLessThan(25)
    expect(dws.flowSession).toBeCloseTo(12.5, 1)
  })

  // M77: browser tab with YouTube title triggers distraction
  it('detects distraction via browser tab title containing YouTube', () => {
    const now = Date.now()
    const start = now - 60 * 60_000
    const blocks = [
      makeBlock(start, start + 50 * 60_000, 'Code.exe'),
      makeBlock(start + 50 * 60_000, now, 'chrome.exe', 'YouTube - Funny Cat Videos'),
    ]
    const dws = computeDWS(blocks, start, now)
    expect(dws.noDistractions).toBe(0)
  })

  // M76: switches-per-hour normalisation
  it('grants lowSwitches credit for 4 switches in a 4-hour session (1/h < 5/h)', () => {
    const sessionMs = 4 * 3_600_000
    const now = Date.now()
    const start = now - sessionMs
    const slotMs = sessionMs / 5
    // 5 blocks → 4 switches in 4 hours → 1 switch/h → well below threshold
    const blocks = Array.from({ length: 5 }, (_, i) =>
      makeBlock(start + i * slotMs, start + (i + 1) * slotMs, i % 2 === 0 ? 'Code.exe' : 'chrome.exe')
    )
    const dws = computeDWS(blocks, start, now)
    expect(dws.lowSwitches).toBeGreaterThan(0)
  })

  it('continuousBlock is exactly 25 when max block equals exactly 25 minutes', () => {
    const start = 0
    const end = 60 * 60_000 // 1-hour session
    // Single block of exactly 25 min = MIN_CONTINUOUS_MS → score = (25min / 25min) * 25 = 25
    const blocks = [makeBlock(start, start + 25 * 60_000, 'Code.exe')]
    const dws = computeDWS(blocks, start, end)
    expect(dws.continuousBlock).toBe(25)
  })

  it('continuousBlock is approximately 12.5 when max block is 12.5 minutes', () => {
    const start = 0
    const end = 60 * 60_000
    // 12.5 min block = half of 25 min → score = (12.5 / 25) * 25 = 12.5
    const blocks = [makeBlock(start, start + 12.5 * 60_000, 'Code.exe')]
    const dws = computeDWS(blocks, start, end)
    expect(dws.continuousBlock).toBeCloseTo(12.5, 1)
  })

  it('flowSession is exactly 25 when session duration equals exactly 45 minutes', () => {
    const start = 0
    const end = 45 * 60_000 // exactly 45 min = FLOW_SESSION_MS
    const blocks = [makeBlock(start, end, 'Code.exe')]
    const dws = computeDWS(blocks, start, end)
    expect(dws.flowSession).toBe(25)
  })

  it('lowSwitches is 25 for a 2-hour session with a single block (0 switches)', () => {
    const start = 0
    const end = 2 * 3_600_000 // 2 hours
    // Single block → 0 switches → lowSwitches = 25 * (1 - 0 / 5) = 25
    const blocks = [makeBlock(start, end, 'Code.exe')]
    const dws = computeDWS(blocks, start, end)
    expect(dws.lowSwitches).toBe(25)
  })

  it('gives no lowSwitches credit for 6 switches in a 20-min session (6/h > 5/h threshold with 1h floor)', () => {
    const sessionMs = 20 * 60_000
    const now = Date.now()
    const start = now - sessionMs
    const slotMs = sessionMs / 7
    // 7 blocks → 6 switches in 20 min; with sessionHours clamped to 1h floor,
    // switchesPerHour = 6 / 1 = 6 → above 5/h threshold → lowSwitches = 0
    const blocks = Array.from({ length: 7 }, (_, i) =>
      makeBlock(start + i * slotMs, start + (i + 1) * slotMs, i % 2 === 0 ? 'Code.exe' : 'chrome.exe')
    )
    const dws = computeDWS(blocks, start, now)
    expect(dws.lowSwitches).toBe(0)
  })
})

describe('getDWSLabel', () => {
  it('returns Deep Work for score >= 75', () => {
    expect(getDWSLabel(100)).toBe('Deep Work')
    expect(getDWSLabel(75)).toBe('Deep Work')
  })
  it('returns Fragmented for score < 25', () => {
    expect(getDWSLabel(0)).toBe('Fragmented')
  })
})
