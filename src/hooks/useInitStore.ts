import { useEffect } from 'react'
import { useTimerStore } from '../store/useTimerStore'
import type { Storage } from '../persistence/storage'

export function useInitStore(storage: Storage) {
  useEffect(() => {
    storage.loadCategories().then(persisted => {
      if (persisted.length === 0) return
      useTimerStore.setState({
        categories: persisted.map(cat => ({
          id: cat.id,
          name: cat.name,
          accumulatedMs: cat.accumulatedMs,
          activeEntry: null,
        })),
      })
    })
  }, [])
}
