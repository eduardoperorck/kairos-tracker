import { describe, it, expect } from 'vitest'
import { computeDistractionBudget } from './distractionBudget'
import type { CaptureBlock } from './passiveCapture'

function makeBlock(process: string, title: string, durationMinutes: number): CaptureBlock {
  return {
    process,
    title,
    startedAt: 0,
    endedAt: durationMinutes * 60_000,
    categoryId: null,
    confirmed: false,
  }
}

describe('computeDistractionBudget', () => {
  it('returns zero usage for empty blocks', () => {
    const result = computeDistractionBudget([])
    expect(result.usedMs).toBe(0)
    expect(result.overBudget).toBe(false)
  })

  it('counts YouTube time', () => {
    const blocks = [makeBlock('chrome.exe', 'YouTube - video', 20)]
    const result = computeDistractionBudget(blocks)
    expect(result.usedMs).toBe(20 * 60_000)
  })

  it('marks overBudget when used exceeds budget', () => {
    const blocks = [makeBlock('chrome.exe', 'Reddit - r/programming', 45)]
    const result = computeDistractionBudget(blocks, undefined, 30 * 60_000)
    expect(result.overBudget).toBe(true)
  })

  it('computes pctUsed correctly', () => {
    const blocks = [makeBlock('chrome.exe', 'twitter.com', 15)]
    const result = computeDistractionBudget(blocks, undefined, 30 * 60_000)
    expect(result.pctUsed).toBe(50)
  })

  it('pctUsed is capped at 100', () => {
    const blocks = [makeBlock('chrome.exe', 'netflix.com', 120)]
    const result = computeDistractionBudget(blocks, undefined, 30 * 60_000)
    expect(result.pctUsed).toBe(100)
  })

  it('returns top 3 distractors', () => {
    const blocks = [
      makeBlock('chrome.exe', 'youtube.com', 30),
      makeBlock('chrome.exe', 'reddit.com', 20),
      makeBlock('chrome.exe', 'twitter.com', 10),
      makeBlock('chrome.exe', 'instagram.com', 5),
    ]
    const result = computeDistractionBudget(blocks)
    expect(result.topDistractors.length).toBeLessThanOrEqual(3)
  })

  it('does not double-count a block matching multiple rules', () => {
    // A block with "youtube" in title should only count once
    const blocks = [makeBlock('chrome.exe', 'YouTube - netflix', 10)]
    const result = computeDistractionBudget(blocks)
    expect(result.usedMs).toBe(10 * 60_000)
  })

  it('uses custom rules', () => {
    const rules = [{ pattern: 'mygame', label: 'My Game' }]
    const blocks = [makeBlock('mygame.exe', 'MyGame', 20)]
    const result = computeDistractionBudget(blocks, rules)
    expect(result.usedMs).toBe(20 * 60_000)
  })

  it('respects remainingMs', () => {
    const blocks = [makeBlock('chrome.exe', 'reddit.com', 10)]
    const result = computeDistractionBudget(blocks, undefined, 30 * 60_000)
    expect(result.remainingMs).toBe(20 * 60_000)
  })
})
