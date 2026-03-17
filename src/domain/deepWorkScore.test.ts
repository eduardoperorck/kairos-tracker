import { describe, it, expect } from 'vitest'
import { computeDWS, getDWSLabel } from './deepWorkScore'
import type { CaptureBlock } from './passiveCapture'

function makeBlock(startedAt: number, endedAt: number, process = 'Code.exe'): CaptureBlock {
  return { process, title: '', startedAt, endedAt, categoryId: 'work', confirmed: true }
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
    expect(dws.continuousBlock).toBe(25) // single block > 25min
    expect(dws.lowSwitches).toBe(25)     // 0 switches
    expect(dws.flowSession).toBe(25)     // 60min >= 45min
    expect(dws.noDistractions).toBe(25)  // no distractions
    expect(dws.total).toBe(100)
  })

  it('penalizes distraction apps', () => {
    const now = Date.now()
    const start = now - 60 * 60_000
    const blocks = [
      makeBlock(start, start + 30 * 60_000, 'Code.exe'),
      makeBlock(start + 30 * 60_000, now, 'Spotify.exe'),
    ]
    const dws = computeDWS(blocks, start, now)
    expect(dws.noDistractions).toBe(0)
  })

  it('penalizes too many switches', () => {
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
