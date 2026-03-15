import { describe, it, expect } from 'vitest'
import { computeStats } from './stats'

const cat = (id: string, name: string, accumulatedMs: number) => ({
  id,
  name,
  accumulatedMs,
  activeEntry: null,
})

describe('computeStats', () => {
  it('returns empty array for no categories', () => {
    expect(computeStats([])).toEqual([])
  })

  it('returns one entry per category', () => {
    const result = computeStats([cat('1', 'Work', 1000)])
    expect(result).toHaveLength(1)
  })

  it('maps name and totalMs', () => {
    const result = computeStats([cat('1', 'Work', 5000)])
    expect(result[0].name).toBe('Work')
    expect(result[0].totalMs).toBe(5000)
  })

  it('includes accumulated time from an active entry', () => {
    const category = {
      id: '1',
      name: 'Work',
      accumulatedMs: 3000,
      activeEntry: { startedAt: Date.now() - 2000, endedAt: null },
    }
    const result = computeStats([category])
    expect(result[0].totalMs).toBeGreaterThanOrEqual(5000)
  })

  it('gives 100% to a single category', () => {
    const result = computeStats([cat('1', 'Work', 5000)])
    expect(result[0].percentage).toBe(100)
  })

  it('splits percentage proportionally', () => {
    const result = computeStats([
      cat('1', 'Work', 3000),
      cat('2', 'Study', 1000),
    ])
    expect(result[0].percentage).toBe(75)
    expect(result[1].percentage).toBe(25)
  })

  it('gives 0% to all when total is zero', () => {
    const result = computeStats([cat('1', 'Work', 0), cat('2', 'Study', 0)])
    expect(result[0].percentage).toBe(0)
    expect(result[1].percentage).toBe(0)
  })

  it('sorts by totalMs descending', () => {
    const result = computeStats([
      cat('1', 'Work', 1000),
      cat('2', 'Study', 5000),
      cat('3', 'Exercise', 2000),
    ])
    expect(result.map(r => r.name)).toEqual(['Study', 'Exercise', 'Work'])
  })
})
