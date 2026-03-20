import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useInitStore } from './useInitStore'
import { useTimerStore } from '../store/useTimerStore'
import { createInMemoryStorage } from '../persistence/inMemoryStorage'
import { toDateString } from '../domain/timer'

const today = toDateString(Date.now())

beforeEach(() => {
  useTimerStore.setState({ categories: [], sessions: [], historySessions: [] })
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

  it('derives accumulatedMs from today sessions', async () => {
    const storage = createInMemoryStorage()
    await storage.saveCategory('id-1', 'Work')
    await storage.saveSession({ id: 's-1', categoryId: 'id-1', startedAt: 0, endedAt: 30_000, date: today })
    await storage.saveSession({ id: 's-2', categoryId: 'id-1', startedAt: 0, endedAt: 12_000, date: today })

    renderHook(() => useInitStore(storage))

    await waitFor(() => {
      expect(useTimerStore.getState().categories[0].accumulatedMs).toBe(42_000)
    })
  })

  it('ignores sessions from other days', async () => {
    const storage = createInMemoryStorage()
    await storage.saveCategory('id-1', 'Work')
    await storage.saveSession({ id: 's-1', categoryId: 'id-1', startedAt: 0, endedAt: 99_000, date: '2020-01-01' })

    renderHook(() => useInitStore(storage))

    await waitFor(() => {
      expect(useTimerStore.getState().categories[0].accumulatedMs).toBe(0)
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

  it('populates historySessions from loadSessionsSince', async () => {
    const storage = createInMemoryStorage()
    await storage.saveCategory('id-1', 'Work')
    const oldDate = '2026-01-01'
    await storage.saveSession({ id: 's-old', categoryId: 'id-1', startedAt: 0, endedAt: 1000, date: oldDate })
    await storage.saveSession({ id: 's-today', categoryId: 'id-1', startedAt: 0, endedAt: 2000, date: today })

    renderHook(() => useInitStore(storage))

    await waitFor(() => {
      const { historySessions } = useTimerStore.getState()
      expect(historySessions.some(s => s.id === 's-today')).toBe(true)
    })
  })

  it('sessions only includes sessions within the current week', async () => {
    const storage = createInMemoryStorage()
    await storage.saveCategory('id-1', 'Work')
    // Use a date 14 days ago — within 60-day history window but outside current week
    const twoWeeksAgo = toDateString(Date.now() - 14 * 86_400_000)
    await storage.saveSession({ id: 's-today', categoryId: 'id-1', startedAt: 0, endedAt: 1000, date: today })
    await storage.saveSession({ id: 's-old', categoryId: 'id-1', startedAt: 0, endedAt: 1000, date: twoWeeksAgo })

    renderHook(() => useInitStore(storage))

    await waitFor(() => {
      const { sessions } = useTimerStore.getState()
      expect(sessions.some(s => s.id === 's-today')).toBe(true)
      expect(sessions.some(s => s.id === 's-old')).toBe(false)
    })
  })

  it('sessions outside the current week go to historySessions but not sessions', async () => {
    const storage = createInMemoryStorage()
    await storage.saveCategory('id-1', 'Work')
    // Use a date 5 days ago — within 7-day history window but outside current week
    const twoWeeksAgo = toDateString(Date.now() - 5 * 86_400_000)
    await storage.saveSession({ id: 's-old', categoryId: 'id-1', startedAt: 0, endedAt: 1000, date: twoWeeksAgo })

    renderHook(() => useInitStore(storage))

    await waitFor(() => {
      const state = useTimerStore.getState()
      expect(state.sessions.some(s => s.id === 's-old')).toBe(false)
      expect(state.historySessions.some(s => s.id === 's-old')).toBe(true)
    })
  })

  it('background load merges sessions older than 7 days into historySessions', async () => {
    const storage = createInMemoryStorage()
    await storage.saveCategory('id-1', 'Work')
    // Session 60 days ago — outside 7-day window, inside 91-day window
    const sixtyDaysAgo = toDateString(Date.now() - 60 * 86_400_000)
    await storage.saveSession({ id: 's-old-60', categoryId: 'id-1', startedAt: 0, endedAt: 5000, date: sixtyDaysAgo })
    await storage.saveSession({ id: 's-today', categoryId: 'id-1', startedAt: 0, endedAt: 1000, date: today })

    renderHook(() => useInitStore(storage))

    await waitFor(() => {
      const { historySessions } = useTimerStore.getState()
      expect(historySessions.some(s => s.id === 's-old-60')).toBe(true)
      expect(historySessions.some(s => s.id === 's-today')).toBe(true)
    })
  })

  it('loads historySessions even when there are no categories', async () => {
    const storage = createInMemoryStorage()
    await storage.saveSession({ id: 's-1', categoryId: 'orphan', startedAt: 0, endedAt: 1000, date: today })

    renderHook(() => useInitStore(storage))

    await waitFor(() => {
      const { historySessions } = useTimerStore.getState()
      expect(historySessions.some(s => s.id === 's-1')).toBe(true)
    })
  })

  it('does not re-run initialization when re-rendered with a new storage instance (initializedRef guard)', async () => {
    // First storage — empty, so categories stay [].
    const storageA = createInMemoryStorage()

    // Second storage — has a category; if init ran again it would load it.
    const storageB = createInMemoryStorage()
    await storageB.saveCategory('id-x', 'ShouldNotAppear')

    // Render with storageA first — initializedRef becomes true after first effect.
    const { rerender } = renderHook(({ s }) => useInitStore(s), {
      initialProps: { s: storageA as Parameters<typeof useInitStore>[0] },
    })

    // Wait for the first init to finish (store is stable with 0 categories).
    await waitFor(() => {
      expect(useTimerStore.getState().categories).toHaveLength(0)
    })

    // Re-render with storageB — initializedRef is already true, so storage.loadCategories
    // on storageB must NOT be called.
    rerender({ s: storageB as Parameters<typeof useInitStore>[0] })

    // Give any potential async effect time to run.
    await new Promise(r => setTimeout(r, 50))

    expect(useTimerStore.getState().categories).toHaveLength(0)
  })
})
