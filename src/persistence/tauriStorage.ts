import Database from '@tauri-apps/plugin-sql'
import type { Storage, PersistedCategory, DailyCaptureStatRow, CorrectionRecord, ContextBookmark } from './storage'
import type { Session } from '../domain/timer'
import type { Intention, EveningReview } from '../domain/intentions'
import type { WindowRule } from '../domain/passiveCapture'
import type { DomainRule } from '../domain/classifier'

const DB_PATH = 'sqlite:kairos.db'

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
  // v6a — domain_rules: user-assigned domain → category mappings (was localStorage)
  `CREATE TABLE IF NOT EXISTS domain_rules (
    id          TEXT PRIMARY KEY,
    domain      TEXT NOT NULL,
    category_id TEXT NOT NULL
  )`,
  // v6b — correction_records: correction learning counters (was localStorage)
  `CREATE TABLE IF NOT EXISTS correction_records (
    context_key TEXT NOT NULL,
    category_id TEXT NOT NULL,
    count       INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (context_key, category_id)
  )`,
  // v7a — index on sessions.date for loadSessionsByDate / loadSessionsSince queries
  `CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date)`,
  // v7b — composite index on (category_id, date) for per-category date range queries
  `CREATE INDEX IF NOT EXISTS idx_sessions_category_date ON sessions(category_id, date)`,
  // v8 — context_bookmarks: user-saved workspace+domain+category snapshots (M90)
  `CREATE TABLE IF NOT EXISTS context_bookmarks (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    category_id TEXT NOT NULL,
    workspace   TEXT,
    domain      TEXT,
    created_at  INTEGER NOT NULL
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

    async purgeSessionsBefore(date: string): Promise<number> {
      const countRows = await db.select<{ n: number }[]>(
        'SELECT COUNT(*) as n FROM sessions WHERE date < ?', [date]
      )
      const count = countRows[0]?.n ?? 0
      await db.execute('DELETE FROM sessions WHERE date < ?', [date])
      return count
    },

    async deleteAllSessions(): Promise<number> {
      const countRows = await db.select<{ n: number }[]>('SELECT COUNT(*) as n FROM sessions')
      const count = countRows[0]?.n ?? 0
      await db.execute('DELETE FROM sessions')
      return count
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
      await db.execute('BEGIN TRANSACTION')
      try {
        for (const s of sessions) {
          await db.execute(
            'INSERT OR IGNORE INTO sessions (id, category_id, started_at, ended_at, date, tag) VALUES (?, ?, ?, ?, ?, ?)',
            [s.id, s.categoryId, s.startedAt, s.endedAt, s.date, s.tag ?? null]
          )
        }
        await db.execute('COMMIT')
      } catch (e) {
        await db.execute('ROLLBACK')
        throw e
      }
    },

    async updateSessionTag(id: string, tag: string | null): Promise<void> {
      await db.execute('UPDATE sessions SET tag = ? WHERE id = ?', [tag, id])
    },

    async deleteSession(id: string): Promise<void> {
      await db.execute('DELETE FROM sessions WHERE id = ?', [id])
    },

    async updateSessionTime(id: string, startedAt: number, endedAt: number): Promise<void> {
      await db.execute('UPDATE sessions SET started_at = ?, ended_at = ? WHERE id = ?', [startedAt, endedAt, id])
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

    async updateCaptureStatCategory(date: string, process: string, categoryId: string): Promise<void> {
      await db.execute(
        'UPDATE daily_capture_stats SET category_id = ? WHERE date = ? AND process = ?',
        [categoryId, date, process]
      )
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

    async loadDomainRules(): Promise<DomainRule[]> {
      const rows = await db.select<{ id: string; domain: string; category_id: string }[]>(
        'SELECT id, domain, category_id FROM domain_rules ORDER BY rowid'
      )
      return rows.map(r => ({ id: r.id, domain: r.domain, categoryId: r.category_id }))
    },

    async saveDomainRule(rule: DomainRule): Promise<void> {
      await db.execute(
        'INSERT OR REPLACE INTO domain_rules (id, domain, category_id) VALUES (?, ?, ?)',
        [rule.id, rule.domain, rule.categoryId]
      )
    },

    async deleteDomainRule(id: string): Promise<void> {
      await db.execute('DELETE FROM domain_rules WHERE id = ?', [id])
    },

    async loadCorrections(): Promise<CorrectionRecord[]> {
      const rows = await db.select<{ context_key: string; category_id: string; count: number }[]>(
        'SELECT context_key, category_id, count FROM correction_records'
      )
      return rows.map(r => ({ contextKey: r.context_key, categoryId: r.category_id, count: r.count }))
    },

    async saveCorrection(record: CorrectionRecord): Promise<void> {
      await db.execute(
        `INSERT INTO correction_records (context_key, category_id, count) VALUES (?, ?, ?)
         ON CONFLICT(context_key, category_id) DO UPDATE SET count = excluded.count`,
        [record.contextKey, record.categoryId, record.count]
      )
    },

    async loadContextBookmarks(): Promise<ContextBookmark[]> {
      const rows = await db.select<{
        id: string; name: string; category_id: string; workspace: string | null; domain: string | null; created_at: number
      }[]>(
        'SELECT id, name, category_id, workspace, domain, created_at FROM context_bookmarks ORDER BY created_at DESC'
      )
      return rows.map(r => ({
        id: r.id,
        name: r.name,
        categoryId: r.category_id,
        workspace: r.workspace,
        domain: r.domain,
        createdAt: r.created_at,
      }))
    },

    async saveContextBookmark(bookmark: ContextBookmark): Promise<void> {
      await db.execute(
        'INSERT OR REPLACE INTO context_bookmarks (id, name, category_id, workspace, domain, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [bookmark.id, bookmark.name, bookmark.categoryId, bookmark.workspace ?? null, bookmark.domain ?? null, bookmark.createdAt]
      )
    },

    async deleteContextBookmark(id: string): Promise<void> {
      await db.execute('DELETE FROM context_bookmarks WHERE id = ?', [id])
    },
  }
}
