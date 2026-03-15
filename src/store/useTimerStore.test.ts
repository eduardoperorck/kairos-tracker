import { describe, it, expect, beforeEach } from 'vitest'
import { useTimerStore } from './useTimerStore'

beforeEach(() => {
  useTimerStore.setState({ categories: [] })
})

describe('useTimerStore', () => {
  it('starts with no categories', () => {
    const { categories } = useTimerStore.getState()
    expect(categories).toHaveLength(0)
  })

  it('addCategory adds a new category', () => {
    useTimerStore.getState().addCategory('Work')
    const { categories } = useTimerStore.getState()
    expect(categories).toHaveLength(1)
    expect(categories[0].name).toBe('Work')
  })

  it('addCategory twice adds two categories', () => {
    useTimerStore.getState().addCategory('Work')
    useTimerStore.getState().addCategory('Study')
    expect(useTimerStore.getState().categories).toHaveLength(2)
  })

  it('startTimer sets an active entry on the category', () => {
    useTimerStore.getState().addCategory('Work')
    const id = useTimerStore.getState().categories[0].id
    useTimerStore.getState().startTimer(id)
    expect(useTimerStore.getState().categories[0].activeEntry).not.toBeNull()
  })

  it('startTimer pauses a running timer when switching', () => {
    useTimerStore.getState().addCategory('Work')
    useTimerStore.getState().addCategory('Study')
    const [workId, studyId] = useTimerStore.getState().categories.map(c => c.id)

    useTimerStore.getState().startTimer(workId)
    useTimerStore.getState().startTimer(studyId)

    const { categories } = useTimerStore.getState()
    const work = categories.find(c => c.id === workId)!
    expect(work.activeEntry).toBeNull()
    expect(work.accumulatedMs).toBeGreaterThanOrEqual(0)
    expect(categories.find(c => c.id === studyId)!.activeEntry).not.toBeNull()
  })

  it('stopTimer clears active entry and accumulates time', () => {
    useTimerStore.getState().addCategory('Work')
    const id = useTimerStore.getState().categories[0].id
    useTimerStore.getState().startTimer(id)
    useTimerStore.getState().stopTimer(id)

    const category = useTimerStore.getState().categories[0]
    expect(category.activeEntry).toBeNull()
    expect(category.accumulatedMs).toBeGreaterThanOrEqual(0)
  })

  it('renameCategory updates the category name', () => {
    useTimerStore.getState().addCategory('Work')
    const id = useTimerStore.getState().categories[0].id
    useTimerStore.getState().renameCategory(id, 'Deep Work')
    expect(useTimerStore.getState().categories[0].name).toBe('Deep Work')
  })

  it('deleteCategory removes the category from the store', () => {
    useTimerStore.getState().addCategory('Work')
    const id = useTimerStore.getState().categories[0].id
    useTimerStore.getState().deleteCategory(id)
    expect(useTimerStore.getState().categories).toHaveLength(0)
  })
})
