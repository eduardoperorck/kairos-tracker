import Database from '@tauri-apps/plugin-sql'
import type { Storage, PersistedCategory } from './storage'
import type { Session } from '../domain/timer'
import type { Intention, EveningReview } from '../domain/intentions'

const DB_PATH = 'sqlite:timetracker.db'

// Each entry is applied once, in order, when user_version < its index+1.
const MIGRATIONS: string[] = [
  // v1 — initial schema (idempotent: CREATE IF NOT EXISTS)
  `CREATE TABLE IF NOT EXISTS categories (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    accumulated_ms INTEGER NOT NULL DEFAULT 0,
    weekly_goal_ms INTEGER,
    color          TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    started_at  INTEGER NOT NULL,
    ended_at    INTEGER NOT NULL,
    date        TEXT NOT NULL,
    tag         TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS intentions (
    date        TEXT NOT NULL,
    text        TEXT NOT NULL,
    created_at  INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS evening_reviews (
    date        TEXT PRIMARY KEY,
    mood        INTEGER NOT NULL,
    notes       TEXT NOT NULL,
    created_at  INTEGER NOT NULL
  )`,
  // v2 — active_entries: shared between CLI and app for in-progress timer state
  `CREATE TABLE IF NOT EXISTS active_entries (
    category_id TEXT NOT NULL,
    started_at  INTEGER NOT NULL
  )`,
]

async function runMigrations(db: InstanceType<typeof Database>): Promise<void> {
  const versionRows = await db.select<{ user_version: number }[]>('PRAGMA user_version')
  let version = versionRows[0]?.user_version ?? 0
  for (let i = version; i < MIGRATIONS.length; i++) {
    await db.execute(MIGRATIONS[i])
    version = i + 1
    await db.execute(`PRAGMA user_version = ${version}`)
  }
}

export async function createTauriStorage(): Promise<Storage> {
  const db = await Database.load(DB_PATH)
  await runMigrations(db)

  return {
    async loadCategories(): Promise<PersistedCategory[]> {
      // accumulated_ms is kept in the schema for backwards-compat but is always
      // recomputed from sessions in useInitStore — never read or written here.
      const rows = await db.select<{ id: string; name: string; weekly_goal_ms: number | null; color: string | null }[]>(
        'SELECT id, name, weekly_goal_ms, color FROM categories ORDER BY rowid'
      )
      return rows.map(r => ({
        id: r.id,
        name: r.name,
        accumulatedMs: 0, // always overridden by computeTodayMs in useInitStore
        weeklyGoalMs: r.weekly_goal_ms ?? undefined,
        color: r.color ?? undefined,
      }))
    },

    async saveCategory(id, name): Promise<void> {
      await db.execute(
        'INSERT OR IGNORE INTO categories (id, name, accumulated_ms) VALUES (?, ?, 0)',
        [id, name]
      )
    },

    async renameCategory(id, newName): Promise<void> {
      await db.execute('UPDATE categories SET name = ? WHERE id = ?', [newName, id])
    },

    async deleteCategory(id): Promise<void> {
      await db.execute('DELETE FROM categories WHERE id = ?', [id])
    },

    async setWeeklyGoal(id: string, ms: number): Promise<void> {
      await db.execute('UPDATE categories SET weekly_goal_ms = ? WHERE id = ?', [ms, id])
    },

    async saveSession(session: Session): Promise<void> {
      await db.execute(
        'INSERT OR IGNORE INTO sessions (id, category_id, started_at, ended_at, date, tag) VALUES (?, ?, ?, ?, ?, ?)',
        [session.id, session.categoryId, session.startedAt, session.endedAt, session.date, session.tag ?? null]
      )
    },

    async loadSessionsByDate(date: string): Promise<Session[]> {
      const rows = await db.select<{
        id: string; category_id: string; started_at: number; ended_at: number; date: string; tag: string | null
      }[]>(
        'SELECT id, category_id, started_at, ended_at, date, tag FROM sessions WHERE date = ? ORDER BY started_at',
        [date]
      )
      return rows.map(r => ({
        id: r.id, categoryId: r.category_id, startedAt: r.started_at, endedAt: r.ended_at, date: r.date, tag: r.tag ?? undefined,
      }))
    },

    async loadSessionsSince(date: string): Promise<Session[]> {
      const rows = await db.select<{
        id: string; category_id: string; started_at: number; ended_at: number; date: string; tag: string | null
      }[]>(
        'SELECT id, category_id, started_at, ended_at, date, tag FROM sessions WHERE date >= ? ORDER BY date, started_at',
        [date]
      )
      return rows.map(r => ({
        id: r.id, categoryId: r.category_id, startedAt: r.started_at, endedAt: r.ended_at, date: r.date, tag: r.tag ?? undefined,
      }))
    },

    async setActiveEntry(categoryId: string, startedAt: number) {
      await db.execute('DELETE FROM active_entries')
      await db.execute(
        'INSERT INTO active_entries (category_id, started_at) VALUES (?, ?)',
        [categoryId, startedAt]
      )
    },

    async loadActiveEntry() {
      const rows = await db.select<{ category_id: string; started_at: number }[]>(
        'SELECT category_id, started_at FROM active_entries LIMIT 1'
      )
      if (rows.length === 0) return null
      // Stale guard: discard entries older than 16 hours (likely a crash)
      const r = rows[0]
      if (Date.now() - r.started_at > 16 * 3_600_000) {
        await db.execute('DELETE FROM active_entries')
        return null
      }
      return { categoryId: r.category_id, startedAt: r.started_at }
    },

    async clearActiveEntry() {
      await db.execute('DELETE FROM active_entries')
    },

    async setColor(id: string, color: string): Promise<void> {
      await db.execute('UPDATE categories SET color = ? WHERE id = ?', [color, id])
    },

    async getSetting(key: string): Promise<string | null> {
      const rows = await db.select<{ value: string }[]>('SELECT value FROM settings WHERE key = ?', [key])
      return rows[0]?.value ?? null
    },

    async setSetting(key: string, value: string): Promise<void> {
      await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value])
    },

    async saveIntention(intention: Intention): Promise<void> {
      await db.execute(
        'INSERT INTO intentions (date, text, created_at) VALUES (?, ?, ?)',
        [intention.date, intention.text, intention.createdAt]
      )
    },

    async loadIntentionsByDate(date: string): Promise<Intention[]> {
      const rows = await db.select<{ date: string; text: string; created_at: number }[]>(
        'SELECT date, text, created_at FROM intentions WHERE date = ? ORDER BY created_at',
        [date]
      )
      return rows.map(r => ({ date: r.date, text: r.text, createdAt: r.created_at }))
    },

    async saveEveningReview(review: EveningReview): Promise<void> {
      await db.execute(
        'INSERT OR REPLACE INTO evening_reviews (date, mood, notes, created_at) VALUES (?, ?, ?, ?)',
        [review.date, review.mood, review.notes, review.createdAt]
      )
    },

    async loadEveningReviewByDate(date: string): Promise<EveningReview | null> {
      const rows = await db.select<{ date: string; mood: number; notes: string; created_at: number }[]>(
        'SELECT date, mood, notes, created_at FROM evening_reviews WHERE date = ?',
        [date]
      )
      if (rows.length === 0) return null
      const r = rows[0]
      return { date: r.date, mood: r.mood as 1|2|3|4|5, notes: r.notes, createdAt: r.created_at }
    },

    async importSessions(sessions: Session[]): Promise<void> {
      for (const s of sessions) {
        await db.execute(
          'INSERT OR IGNORE INTO sessions (id, category_id, started_at, ended_at, date, tag) VALUES (?, ?, ?, ?, ?, ?)',
          [s.id, s.categoryId, s.startedAt, s.endedAt, s.date, s.tag ?? null]
        )
      }
    },
  }
}
