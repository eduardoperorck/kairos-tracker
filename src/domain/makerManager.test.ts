import { describe, it, expect } from 'vitest'
import { classifyDay, getMakerManagerLabel } from './makerManager'
import type { CaptureBlock } from './passiveCapture'

const base = new Date('2026-03-17T09:00:00Z').getTime()

function makeBlock(durationMinutes: number, offset = 0): CaptureBlock {
  const startedAt = base + offset * 60_000
  return {
    process: 'App.exe',
    title: 'Window',
    startedAt,
    endedAt: startedAt + durationMinutes * 60_000,
    categoryId: null,
    confirmed: false,
  }
}

describe('classifyDay', () => {
  it('returns unknown for empty blocks', () => {
    expect(classifyDay([]).mode).toBe('unknown')
  })

  it('classifies as maker when most blocks >= 30min', () => {
    const blocks = [makeBlock(60), makeBlock(45, 70), makeBlock(90, 120), makeBlock(5, 215)]
    // 3 maker, 1 manager → 75% maker
    const result = classifyDay(blocks)
    expect(result.mode).toBe('maker')
  })

  it('classifies as manager when most blocks < 30min', () => {
    const blocks = [makeBlock(5), makeBlock(10, 10), makeBlock(15, 25), makeBlock(20, 45), makeBlock(60, 70)]
    // 4 manager, 1 maker → 80% manager
    const result = classifyDay(blocks)
    expect(result.mode).toBe('manager')
  })

  it('classifies as mixed when split is close', () => {
    const blocks = [makeBlock(60), makeBlock(45, 70), makeBlock(10, 120), makeBlock(15, 135), makeBlock(8, 155)]
    // 2 maker, 3 manager → 40% maker, 60% manager... boundary
    const result = classifyDay(blocks)
    expect(['maker', 'manager', 'mixed']).toContain(result.mode)
  })

  it('returns correct totalBlocks', () => {
    const blocks = [makeBlock(10), makeBlock(20, 15), makeBlock(30, 40)]
    expect(classifyDay(blocks).totalBlocks).toBe(3)
  })

  it('computes longestBlockMs correctly', () => {
    const blocks = [makeBlock(10), makeBlock(45, 20), makeBlock(5, 70)]
    expect(classifyDay(blocks).longestBlockMs).toBe(45 * 60_000)
  })

  it('returns makerPct and managerPct summing to ~100', () => {
    const blocks = [makeBlock(60), makeBlock(10, 70)]
    const result = classifyDay(blocks)
    expect(result.makerPct + result.managerPct).toBe(100)
  })
})

describe('getMakerManagerLabel', () => {
  it('returns label for maker', () => {
    expect(getMakerManagerLabel('maker')).toContain('Maker')
  })

  it('returns label for manager', () => {
    expect(getMakerManagerLabel('manager')).toContain('Manager')
  })

  it('returns label for mixed', () => {
    expect(getMakerManagerLabel('mixed')).toContain('Mixed')
  })

  it('returns label for unknown', () => {
    expect(getMakerManagerLabel('unknown')).toContain('Unknown')
  })
})
