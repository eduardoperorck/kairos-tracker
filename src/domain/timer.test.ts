import { describe, it, expect } from 'vitest'
import { createCategory, startTimer, stopTimer, getElapsed } from './timer'

describe('createCategory', () => {
  it('creates a category with a name', () => {
    const category = createCategory('Work')
    expect(category.name).toBe('Work')
  })

  it('creates a category with a unique id', () => {
    const a = createCategory('Work')
    const b = createCategory('Study')
    expect(a.id).not.toBe(b.id)
  })

  it('creates a category with no active timer', () => {
    const category = createCategory('Work')
    expect(category.activeEntry).toBeNull()
  })
})

describe('startTimer', () => {
  it('returns an entry with a start timestamp', () => {
    const entry = startTimer()
    expect(entry.startedAt).toBeTypeOf('number')
    expect(entry.endedAt).toBeNull()
  })

  it('records the current time as startedAt', () => {
    const before = Date.now()
    const entry = startTimer()
    const after = Date.now()
    expect(entry.startedAt).toBeGreaterThanOrEqual(before)
    expect(entry.startedAt).toBeLessThanOrEqual(after)
  })
})

describe('stopTimer', () => {
  it('returns an entry with an end timestamp', () => {
    const entry = startTimer()
    const stopped = stopTimer(entry)
    expect(stopped.endedAt).toBeTypeOf('number')
  })

  it('does not change the startedAt timestamp', () => {
    const entry = startTimer()
    const stopped = stopTimer(entry)
    expect(stopped.startedAt).toBe(entry.startedAt)
  })
})

describe('getElapsed', () => {
  it('returns elapsed ms for a stopped entry', () => {
    const entry = startTimer()
    const stopped = stopTimer(entry)
    const elapsed = getElapsed(stopped)
    expect(elapsed).toBeGreaterThanOrEqual(0)
  })

  it('returns elapsed ms for a running entry using current time', () => {
    const entry = startTimer()
    const elapsed = getElapsed(entry)
    expect(elapsed).toBeGreaterThanOrEqual(0)
  })

  it('returns correct duration', () => {
    const entry = { startedAt: 1000, endedAt: 4000 }
    const elapsed = getElapsed(entry)
    expect(elapsed).toBe(3000)
  })
})
