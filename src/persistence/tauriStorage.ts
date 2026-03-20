import Database from '@tauri-apps/plugin-sql'
import type { Storage, PersistedCategory, DailyCaptureStatRow } from './storage'
import type { Session } from '../domain/timer'
import type { Intention, EveningReview } from '../domain/intentions'
import type { WindowRule } from '../domain/passiveCapture'

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
  // v3 — archived column: hide categories without deleting history
  `ALTER TABLE categories ADD COLUMN archived INTEGER NOT NULL DEFAULT 0`,
  // v4 — daily_capture_stats: persist passive window intelligence across restarts
  `CREATE TABLE IF NOT EXISTS daily_capture_stats (
    date        TEXT NOT NULL,
    process     TEXT NOT NULL,
    total_ms    INTEGER NOT NULL,
    block_count INTEGER NOT NULL,
    category_id TEXT,
    PRIMARY KEY (date, process)
  )`,
  // v5 — window_rules: migrate user window rules from localStorage to SQLite
  `CREATE TABLE IF NOT EXISTS window_rules (
    id          TEXT PRIMARY KEY,
    match_type  TEXT NOT NULL,
    pattern     TEXT NOT NULL,
    category_id TEXT,
    tag         TEXT,
    mode        TEXT NOT NULL,
    enabled     INTEGER NOT NULL DEFAULT 1
  )`,
]

async function runMigrations(db: InstanceType<typeof Database>): Promise<void> {
  const versionRows = await db.select<{ user_version: number }[]>('PRAGMA user_version')
  let version = versionRows[0]?.user_version ?? 0
  for (let i = version; i < MIGRATIONS.length; i++) {
    await db.execute(MIGRATIONS[i])
    version = i + 1
    // safe: version is always a small positive integer from a migration array index, never user-controlled
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
      const rows = await db.select<{ id: string; name: string; weekly_goal_ms: number | null; color: string | null; archived: number }[]>(
        'SELECT id, name, weekly_goal_ms, color, archived FROM categories ORDER BY rowid'
      )
      return rows.map(r => ({
        id: r.id,
        name: r.name,
        accumulatedMs: 0, // always overridden by computeTodayMs in useInitStore
        weeklyGoalMs: r.weekly_goal_ms ?? undefined,
        color: r.color ?? undefined,
        archived: r.archived === 1 ? true : undefined,
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

    async archiveCategory(id: string, archived: boolean): Promise<void> {
      await db.execute('UPDATE categories SET archived = ? WHERE id = ?', [archived ? 1 : 0, id])
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

    async updateSessionTag(id: string, tag: string | null): Promise<void> {
      await db.execute('UPDATE sessions SET tag = ? WHERE id = ?', [tag, id])
    },

    async saveDailyCaptureStat(row: DailyCaptureStatRow): Promise<void> {
      await db.execute(
        `INSERT INTO daily_capture_stats (date, process, total_ms, block_count, category_id)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(date, process) DO UPDATE SET
           total_ms    = total_ms    + excluded.total_ms,
           block_count = block_count + excluded.block_count`,
        [row.date, row.process, row.total_ms, row.block_count, row.category_id ?? null]
      )
    },

    async loadDailyCaptureStatsSince(date: string): Promise<DailyCaptureStatRow[]> {
      const rows = await db.select<{
        date: string; process: string; total_ms: number; block_count: number; category_id: string | null
      }[]>(
        'SELECT date, process, total_ms, block_count, category_id FROM daily_capture_stats WHERE date >= ? ORDER BY date, process',
        [date]
      )
      return rows.map(r => ({
        date: r.date,
        process: r.process,
        total_ms: r.total_ms,
        block_count: r.block_count,
        category_id: r.category_id,
      }))
    },

    async loadWindowRules(): Promise<WindowRule[]> {
      const rows = await db.select<{
        id: string; match_type: string; pattern: string; category_id: string | null;
        tag: string | null; mode: string; enabled: number
      }[]>(
        'SELECT id, match_type, pattern, category_id, tag, mode, enabled FROM window_rules ORDER BY rowid'
      )
      return rows.map(r => ({
        id: r.id,
        matchType: r.match_type as 'process' | 'title',
        pattern: r.pattern,
        categoryId: r.category_id,
        tag: r.tag ?? undefined,
        mode: r.mode as 'auto' | 'suggest' | 'ignore',
        enabled: r.enabled === 1,
      }))
    },

    async saveWindowRule(rule: WindowRule): Promise<void> {
      await db.execute(
        `INSERT OR REPLACE INTO window_rules (id, match_type, pattern, category_id, tag, mode, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [rule.id, rule.matchType, rule.pattern, rule.categoryId ?? null, rule.tag ?? null, rule.mode, rule.enabled ? 1 : 0]
      )
    },

    async deleteWindowRule(id: string): Promise<void> {
      await db.execute('DELETE FROM window_rules WHERE id = ?', [id])
    },
  }
}
