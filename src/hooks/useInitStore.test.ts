import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useInitStore } from './useInitStore'
import { useTimerStore } from '../store/useTimerStore'
import { createInMemoryStorage } from '../persistence/inMemoryStorage'

beforeEach(() => {
  useTimerStore.setState({ categories: [] })
})

describe('useInitStore', () => {
  it('does nothing when storage is empty', async () => {
    const storage = createInMemoryStorage()
    renderHook(() => useInitStore(storage))
    await waitFor(() => {
      expect(useTimerStore.getState().categories).toHaveLength(0)
    })
  })

  it('loads categories from storage into the store', async () => {
    const storage = createInMemoryStorage()
    await storage.saveCategory('id-1', 'Work')
    await storage.saveCategory('id-2', 'Study')

    renderHook(() => useInitStore(storage))

    await waitFor(() => {
      expect(useTimerStore.getState().categories).toHaveLength(2)
    })
  })

  it('restores category names and ids', async () => {
    const storage = createInMemoryStorage()
    await storage.saveCategory('id-abc', 'Work')

    renderHook(() => useInitStore(storage))

    await waitFor(() => {
      const cat = useTimerStore.getState().categories[0]
      expect(cat.id).toBe('id-abc')
      expect(cat.name).toBe('Work')
    })
  })

  it('restores accumulated time', async () => {
    const storage = createInMemoryStorage()
    await storage.saveCategory('id-1', 'Work')
    await storage.updateAccumulatedMs('id-1', 42_000)

    renderHook(() => useInitStore(storage))

    await waitFor(() => {
      expect(useTimerStore.getState().categories[0].accumulatedMs).toBe(42_000)
    })
  })

  it('restores categories with no active entry', async () => {
    const storage = createInMemoryStorage()
    await storage.saveCategory('id-1', 'Work')

    renderHook(() => useInitStore(storage))

    await waitFor(() => {
      expect(useTimerStore.getState().categories[0].activeEntry).toBeNull()
    })
  })
})
