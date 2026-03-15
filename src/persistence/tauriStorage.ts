import Database from '@tauri-apps/plugin-sql'
import type { Storage, PersistedCategory } from './storage'

const DB_PATH = 'sqlite:timetracker.db'

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS categories (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    accumulated_ms INTEGER NOT NULL DEFAULT 0
  );
`

export async function createTauriStorage(): Promise<Storage> {
  const db = await Database.load(DB_PATH)
  await db.execute(INIT_SQL)

  return {
    async loadCategories(): Promise<PersistedCategory[]> {
      const rows = await db.select<{ id: string; name: string; accumulated_ms: number }[]>(
        'SELECT id, name, accumulated_ms FROM categories ORDER BY rowid'
      )
      return rows.map(r => ({ id: r.id, name: r.name, accumulatedMs: r.accumulated_ms }))
    },

    async saveCategory(id, name): Promise<void> {
      await db.execute(
        'INSERT OR IGNORE INTO categories (id, name, accumulated_ms) VALUES (?, ?, 0)',
        [id, name]
      )
    },

    async updateAccumulatedMs(id, ms): Promise<void> {
      await db.execute(
        'UPDATE categories SET accumulated_ms = ? WHERE id = ?',
        [ms, id]
      )
    },

    async renameCategory(id, newName): Promise<void> {
      await db.execute('UPDATE categories SET name = ? WHERE id = ?', [newName, id])
    },

    async deleteCategory(id): Promise<void> {
      await db.execute('DELETE FROM categories WHERE id = ?', [id])
    },
  }
}
