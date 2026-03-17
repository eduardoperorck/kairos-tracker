import { describe, it, expect } from 'vitest'
import {
  createMVDItem,
  toggleMVDItem,
  isMVDAchieved,
  canAddMVDItem,
  getMVDProgress,
  removeMVDItem,
  MAX_MVD_ITEMS,
} from './minimumViableDay'

describe('createMVDItem', () => {
  it('creates an item with done=false', () => {
    const item = createMVDItem('Write tests')
    expect(item.done).toBe(false)
  })

  it('trims whitespace from text', () => {
    const item = createMVDItem('  Write tests  ')
    expect(item.text).toBe('Write tests')
  })

  it('assigns a unique id', () => {
    const a = createMVDItem('Task A')
    const b = createMVDItem('Task B')
    expect(a.id).not.toBe(b.id)
  })

  it('sets createdAt timestamp', () => {
    const before = Date.now()
    const item = createMVDItem('task')
    expect(item.createdAt).toBeGreaterThanOrEqual(before)
  })
})

describe('toggleMVDItem', () => {
  it('toggles done to true', () => {
    const items = [createMVDItem('task')]
    const toggled = toggleMVDItem(items, items[0].id)
    expect(toggled[0].done).toBe(true)
  })

  it('toggles done back to false', () => {
    const item = { ...createMVDItem('task'), done: true }
    const toggled = toggleMVDItem([item], item.id)
    expect(toggled[0].done).toBe(false)
  })

  it('does not mutate original', () => {
    const items = [createMVDItem('task')]
    toggleMVDItem(items, items[0].id)
    expect(items[0].done).toBe(false)
  })

  it('only toggles the matching item', () => {
    const items = [createMVDItem('A'), createMVDItem('B')]
    const toggled = toggleMVDItem(items, items[0].id)
    expect(toggled[1].done).toBe(false)
  })
})

describe('isMVDAchieved', () => {
  it('returns false for empty list', () => {
    expect(isMVDAchieved([])).toBe(false)
  })

  it('returns false when not all done', () => {
    const items = [createMVDItem('A'), { ...createMVDItem('B'), done: true }]
    expect(isMVDAchieved(items)).toBe(false)
  })

  it('returns true when all done', () => {
    const items = [{ ...createMVDItem('A'), done: true }, { ...createMVDItem('B'), done: true }]
    expect(isMVDAchieved(items)).toBe(true)
  })
})

describe('canAddMVDItem', () => {
  it('returns true for empty list', () => {
    expect(canAddMVDItem([])).toBe(true)
  })

  it('returns false when at MAX_MVD_ITEMS', () => {
    const items = Array.from({ length: MAX_MVD_ITEMS }, () => createMVDItem('task'))
    expect(canAddMVDItem(items)).toBe(false)
  })
})

describe('getMVDProgress', () => {
  it('returns zeros for empty', () => {
    expect(getMVDProgress([])).toEqual({ done: 0, total: 0, pct: 0 })
  })

  it('returns correct progress', () => {
    const items = [
      { ...createMVDItem('A'), done: true },
      createMVDItem('B'),
    ]
    const p = getMVDProgress(items)
    expect(p.done).toBe(1)
    expect(p.total).toBe(2)
    expect(p.pct).toBe(50)
  })
})

describe('removeMVDItem', () => {
  it('removes the matching item', () => {
    const items = [createMVDItem('A'), createMVDItem('B')]
    const removed = removeMVDItem(items, items[0].id)
    expect(removed).toHaveLength(1)
    expect(removed[0].text).toBe('B')
  })

  it('is a no-op for nonexistent id', () => {
    const items = [createMVDItem('A')]
    expect(removeMVDItem(items, 'nonexistent')).toHaveLength(1)
  })
})
