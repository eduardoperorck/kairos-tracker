import type { Storage, PersistedCategory } from './storage'

export function createInMemoryStorage(): Storage {
  const rows = new Map<string, PersistedCategory>()

  return {
    async loadCategories() {
      return Array.from(rows.values())
    },

    async saveCategory(id, name) {
      if (!rows.has(id)) {
        rows.set(id, { id, name, accumulatedMs: 0 })
      }
    },

    async updateAccumulatedMs(id, ms) {
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, accumulatedMs: ms })
    },

    async renameCategory(id, newName) {
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, name: newName })
    },

    async deleteCategory(id) {
      rows.delete(id)
    },
  }
}
