import { describe, it, expect } from 'vitest'
import {
  createStore,
  addCategory,
  startCategoryTimer,
  stopCategoryTimer,
  removeCategory,
  renameCategory,
  setWeeklyGoal,
  setPendingTag,
} from './store'

describe('createStore', () => {
  it('creates an empty store', () => {
    const store = createStore()
    expect(store.categories).toEqual([])
  })

  it('initialises with an empty sessions list', () => {
    const store = createStore()
    expect(store.sessions).toEqual([])
  })
})

describe('setWeeklyGoal', () => {
  it('sets weeklyGoalMs on the target category', () => {
    let store = addCategory(createStore(), 'Work')
    const id = store.categories[0].id
    store = setWeeklyGoal(store, id, 10 * 3600_000)
    expect(store.categories[0].weeklyGoalMs).toBe(10 * 3600_000)
  })

  it('does not affect other categories', () => {
    let store = addCategory(createStore(), 'Work')
    store = addCategory(store, 'Study')
    const id = store.categories[0].id
    store = setWeeklyGoal(store, id, 5 * 3600_000)
    expect(store.categories[1].weeklyGoalMs).toBeUndefined()
  })

  it('throws if category does not exist', () => {
    expect(() => setWeeklyGoal(createStore(), 'nonexistent', 1000)).toThrow()
  })
})

describe('session log', () => {
  it('stopping a timer appends a completed session', () => {
    let store = createStore()
    store = addCategory(store, 'Work')
    const id = store.categories[0].id
    store = startCategoryTimer(store, id)
    store = stopCategoryTimer(store, id)

    expect(store.sessions).toHaveLength(1)
    const s = store.sessions[0]
    expect(s.categoryId).toBe(id)
    expect(s.startedAt).toBeGreaterThan(0)
    expect(s.endedAt).toBeGreaterThanOrEqual(s.startedAt)
    expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('switching categories appends a session for the paused category', () => {
    let store = createStore()
    store = addCategory(store, 'Work')
    store = addCategory(store, 'Study')
    const workId = store.categories[0].id
    const studyId = store.categories[1].id

    store = startCategoryTimer(store, workId)
    store = startCategoryTimer(store, studyId)

    expect(store.sessions).toHaveLength(1)
    expect(store.sessions[0].categoryId).toBe(workId)
  })

  it('accumulates sessions across multiple cycles', () => {
    let store = createStore()
    store = addCategory(store, 'Work')
    const id = store.categories[0].id

    store = startCategoryTimer(store, id)
    store = stopCategoryTimer(store, id)
    store = startCategoryTimer(store, id)
    store = stopCategoryTimer(store, id)

    expect(store.sessions).toHaveLength(2)
  })

  it('each session has a unique id', () => {
    let store = createStore()
    store = addCategory(store, 'Work')
    const id = store.categories[0].id

    store = startCategoryTimer(store, id)
    store = stopCategoryTimer(store, id)
    store = startCategoryTimer(store, id)
    store = stopCategoryTimer(store, id)

    const ids = store.sessions.map(s => s.id)
    expect(new Set(ids).size).toBe(2)
  })
})

describe('addCategory', () => {
  it('adds a category to the store', () => {
    const store = addCategory(createStore(), 'Work')
    expect(store.categories).toHaveLength(1)
    expect(store.categories[0].name).toBe('Work')
  })

  it('adding two categories produces two entries', () => {
    let store = createStore()
    store = addCategory(store, 'Work')
    store = addCategory(store, 'Study')
    expect(store.categories).toHaveLength(2)
  })

  it('does not mutate the original store', () => {
    const original = createStore()
    addCategory(original, 'Work')
    expect(original.categories).toHaveLength(0)
  })
})

describe('startCategoryTimer', () => {
  it('sets an active entry on the target category', () => {
    let store = createStore()
    store = addCategory(store, 'Work')
    const id = store.categories[0].id
    store = startCategoryTimer(store, id)
    expect(store.categories[0].activeEntry).not.toBeNull()
  })

  it('pauses a running timer when switching categories', () => {
    let store = createStore()
    store = addCategory(store, 'Work')
    store = addCategory(store, 'Study')
    const workId = store.categories[0].id
    const studyId = store.categories[1].id

    store = startCategoryTimer(store, workId)
    store = startCategoryTimer(store, studyId)

    const work = store.categories.find(c => c.id === workId)!
    expect(work.activeEntry).toBeNull()
    expect(work.accumulatedMs).toBeGreaterThanOrEqual(0)
  })

  it('only one category can have an active entry at a time', () => {
    let store = createStore()
    store = addCategory(store, 'Work')
    store = addCategory(store, 'Study')
    store = addCategory(store, 'Exercise')

    store = startCategoryTimer(store, store.categories[0].id)
    store = startCategoryTimer(store, store.categories[1].id)

    const running = store.categories.filter(c => c.activeEntry !== null)
    expect(running).toHaveLength(1)
  })

  it('throws if category id does not exist', () => {
    const store = createStore()
    expect(() => startCategoryTimer(store, 'nonexistent')).toThrow()
  })
})

describe('stopCategoryTimer', () => {
  it('clears the active entry and accumulates duration', () => {
    let store = createStore()
    store = addCategory(store, 'Work')
    const id = store.categories[0].id
    store = startCategoryTimer(store, id)
    store = stopCategoryTimer(store, id)

    const category = store.categories.find(c => c.id === id)!
    expect(category.activeEntry).toBeNull()
    expect(category.accumulatedMs).toBeGreaterThanOrEqual(0)
  })

  it('accumulates duration across multiple start/stop cycles', () => {
    let store = createStore()
    store = addCategory(store, 'Work')
    const id = store.categories[0].id

    store = startCategoryTimer(store, id)
    store = stopCategoryTimer(store, id)
    const first = store.categories[0].accumulatedMs

    store = startCategoryTimer(store, id)
    store = stopCategoryTimer(store, id)
    const second = store.categories[0].accumulatedMs

    expect(second).toBeGreaterThanOrEqual(first)
  })

  it('throws if category id does not exist', () => {
    const store = createStore()
    expect(() => stopCategoryTimer(store, 'nonexistent')).toThrow()
  })
})

describe('renameCategory', () => {
  it('updates the name of the target category', () => {
    let store = addCategory(createStore(), 'Work')
    const id = store.categories[0].id
    store = renameCategory(store, id, 'Deep Work')
    expect(store.categories[0].name).toBe('Deep Work')
  })

  it('does not affect other categories', () => {
    let store = addCategory(createStore(), 'Work')
    store = addCategory(store, 'Study')
    const id = store.categories[0].id
    store = renameCategory(store, id, 'Deep Work')
    expect(store.categories[1].name).toBe('Study')
  })

  it('does not mutate the original store', () => {
    const original = addCategory(createStore(), 'Work')
    const id = original.categories[0].id
    renameCategory(original, id, 'Deep Work')
    expect(original.categories[0].name).toBe('Work')
  })

  it('throws if category id does not exist', () => {
    const store = createStore()
    expect(() => renameCategory(store, 'nonexistent', 'Name')).toThrow()
  })
})

describe('setPendingTag', () => {
  it('sets pendingTag on the target category', () => {
    let store = addCategory(createStore(), 'Work')
    const id = store.categories[0].id
    store = setPendingTag(store, id, 'deep-work')
    expect(store.categories[0].pendingTag).toBe('deep-work')
  })

  it('stopCategoryTimer uses pendingTag on the created session', () => {
    let store = addCategory(createStore(), 'Work')
    const id = store.categories[0].id
    store = startCategoryTimer(store, id)
    store = setPendingTag(store, id, 'coding')
    store = stopCategoryTimer(store, id)
    expect(store.sessions[0].tag).toBe('coding')
  })
})

describe('removeCategory', () => {
  it('removes the category from the list', () => {
    let store = addCategory(createStore(), 'Work')
    const id = store.categories[0].id
    store = removeCategory(store, id)
    expect(store.categories).toHaveLength(0)
  })

  it('only removes the target category', () => {
    let store = addCategory(createStore(), 'Work')
    store = addCategory(store, 'Study')
    const id = store.categories[0].id
    store = removeCategory(store, id)
    expect(store.categories).toHaveLength(1)
    expect(store.categories[0].name).toBe('Study')
  })

  it('does not mutate the original store', () => {
    const original = addCategory(createStore(), 'Work')
    const id = original.categories[0].id
    removeCategory(original, id)
    expect(original.categories).toHaveLength(1)
  })

  it('throws if category id does not exist', () => {
    const store = createStore()
    expect(() => removeCategory(store, 'nonexistent')).toThrow()
  })
})
