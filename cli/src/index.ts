#!/usr/bin/env node
/**
 * Time Tracker CLI companion
 * Communicates directly with the SQLite database used by the Tauri app.
 *
 * Usage:
 *   npx time-tracker start work
 *   npx time-tracker stop
 *   npx time-tracker status
 *   npx time-tracker today
 */

import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'
import fs from 'fs'

// ─── Locate database ─────────────────────────────────────────────────────────

function findDb(): string {
  // Tauri stores app data in %APPDATA%\productivity-challenge on Windows
  const platform = os.platform()
  let appData: string

  if (platform === 'win32') {
    appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming')
    return path.join(appData, 'productivity-challenge', 'timetracker.db')
  } else if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'productivity-challenge', 'timetracker.db')
  } else {
    return path.join(os.homedir(), '.local', 'share', 'productivity-challenge', 'timetracker.db')
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

function toDateString(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}

const GREEN = '\x1b[32m'
const DIM   = '\x1b[2m'
const RESET = '\x1b[0m'
const BOLD  = '\x1b[1m'

// ─── Commands ─────────────────────────────────────────────────────────────────

function cmd_status(db: Database.Database): void {
  const active = db.prepare(`
    SELECT c.name, e.started_at
    FROM active_entries e
    JOIN categories c ON c.id = e.category_id
    LIMIT 1
  `).get() as { name: string; started_at: number } | undefined

  if (!active) {
    console.log(`${DIM}─ No active timer${RESET}`)
    return
  }

  const elapsed = Date.now() - active.started_at
  console.log(`${GREEN}▶ Active: ${BOLD}${active.name}${RESET}${GREEN} · ${formatDuration(elapsed)} elapsed${RESET}`)
}

function cmd_start(db: Database.Database, categoryName: string): void {
  const cats = db.prepare('SELECT id, name FROM categories').all() as { id: string; name: string }[]
  const cat = cats.find(c => c.name.toLowerCase() === categoryName.toLowerCase())
    ?? cats.find(c => c.name.toLowerCase().startsWith(categoryName.toLowerCase()))

  if (!cat) {
    const names = cats.map(c => c.name).join(', ')
    console.error(`Category not found: "${categoryName}". Available: ${names}`)
    process.exit(1)
  }

  // Stop any running timer first
  db.prepare('DELETE FROM active_entries').run()

  db.prepare('INSERT OR REPLACE INTO active_entries (category_id, started_at) VALUES (?, ?)').run(cat.id, Date.now())
  console.log(`${GREEN}✓ Started: ${BOLD}${cat.name}${RESET}${GREEN}  [${new Date().toTimeString().slice(0, 8)}]${RESET}`)
}

function cmd_stop(db: Database.Database): void {
  const active = db.prepare(`
    SELECT c.id as catId, c.name, e.started_at
    FROM active_entries e
    JOIN categories c ON c.id = e.category_id
    LIMIT 1
  `).get() as { catId: string; name: string; started_at: number } | undefined

  if (!active) {
    console.log(`${DIM}Nothing to stop.${RESET}`)
    return
  }

  const now = Date.now()
  const date = toDateString(now)
  const id = `cli-${now}`

  db.prepare(`
    INSERT INTO sessions (id, category_id, date, started_at, ended_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, active.catId, date, active.started_at, now)

  db.prepare('DELETE FROM active_entries').run()

  const elapsed = now - active.started_at
  console.log(`${GREEN}■ Stopped: ${BOLD}${active.name}${RESET}${GREEN} · ${formatDuration(elapsed)}${RESET}`)
}

function cmd_today(db: Database.Database): void {
  const date = toDateString(Date.now())
  const rows = db.prepare(`
    SELECT c.name, SUM(s.ended_at - s.started_at) as totalMs
    FROM sessions s
    JOIN categories c ON c.id = s.category_id
    WHERE s.date = ?
    GROUP BY s.category_id
    ORDER BY totalMs DESC
  `).all(date) as { name: string; totalMs: number }[]

  if (rows.length === 0) {
    console.log(`${DIM}No sessions today.${RESET}`)
    return
  }

  console.log(`\n${BOLD}Today — ${date}${RESET}`)
  for (const r of rows) {
    console.log(`  ${r.name.padEnd(16)} ${GREEN}${formatDuration(r.totalMs)}${RESET}`)
  }
  const total = rows.reduce((sum, r) => sum + r.totalMs, 0)
  console.log(`${'─'.repeat(26)}`)
  console.log(`  ${'Total'.padEnd(16)} ${BOLD}${formatDuration(total)}${RESET}\n`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const [,, command, ...args] = process.argv

const dbPath = findDb()

if (!fs.existsSync(dbPath)) {
  console.error(`Database not found at: ${dbPath}`)
  console.error('Make sure the Time Tracker app has been run at least once.')
  process.exit(1)
}

// Warn if database file is world-readable (Unix only)
if (os.platform() !== 'win32') {
  const stat = fs.statSync(dbPath)
  if ((stat.mode & 0o004) !== 0) {
    console.warn('Warning: database file is world-readable. Run: chmod o-r ' + dbPath)
  }
}

const db = new Database(dbPath, { readonly: command === 'status' || command === 'today' })

switch (command) {
  case 'status':
    cmd_status(db)
    break
  case 'start':
    if (!args[0]) { console.error('Usage: time-tracker start <category>'); process.exit(1) }
    cmd_start(db, args[0])
    break
  case 'stop':
    cmd_stop(db)
    break
  case 'today':
    cmd_today(db)
    break
  default:
    console.log(`Time Tracker CLI

  Commands:
    start <category>   Start a timer for the given category
    stop               Stop the active timer
    status             Show current timer status
    today              Show today's tracked time

  Examples:
    time-tracker start work
    time-tracker stop
    time-tracker today
`)
}

db.close()
