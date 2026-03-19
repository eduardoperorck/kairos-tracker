import type { Session, Category } from './timer'
import { formatLocalTime } from './format'

// ─── groupSessionsByDate ──────────────────────────────────────────────────────

export type DayGroup = {
  date: string
  sessions: (Session & { categoryName: string })[]
  totalMs: number
}

export function groupSessionsByDate(sessions: Session[], categories: Category[]): DayGroup[] {
  const catMap = new Map(categories.map(c => [c.id, c.name]))
  const dayMap = new Map<string, DayGroup>()

  for (const s of sessions) {
    const existing = dayMap.get(s.date)
    const enriched = { ...s, categoryName: catMap.get(s.categoryId) ?? 'Unknown' }
    const duration = s.endedAt - s.startedAt
    if (existing) {
      existing.sessions.push(enriched)
      existing.totalMs += duration
    } else {
      dayMap.set(s.date, { date: s.date, sessions: [enriched], totalMs: duration })
    }
  }

  return Array.from(dayMap.values()).sort((a, b) => b.date.localeCompare(a.date))
}

// ─── computeHourDistribution ─────────────────────────────────────────────────

export type HourSlot = { hour: number; totalMs: number }

export function computeHourDistribution(sessions: Session[]): HourSlot[] {
  const hourMap = new Map<number, number>()

  for (const s of sessions) {
    const hour = new Date(s.startedAt).getHours()
    const duration = s.endedAt - s.startedAt
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + duration)
  }

  return Array.from(hourMap.entries())
    .map(([hour, totalMs]) => ({ hour, totalMs }))
    .filter(h => h.totalMs > 0)
    .sort((a, b) => a.hour - b.hour)
}

// ─── exportSessionsToCSV ─────────────────────────────────────────────────────

export function exportSessionsToCSV(sessions: Session[], categories: Category[]): string {
  const catMap = new Map(categories.map(c => [c.id, c.name]))
  const header = 'category,date,started_at,ended_at,duration_minutes,tag'
  const rows = sessions.map(s => {
    const catName = catMap.get(s.categoryId) ?? 'Unknown'
    const durationMin = Math.round((s.endedAt - s.startedAt) / 60000)
    return [catName, s.date, s.startedAt, s.endedAt, durationMin, s.tag ?? ''].join(',')
  })
  return [header, ...rows].join('\n')
}

// ─── exportSessionsToJSON ────────────────────────────────────────────────────

export function exportSessionsToJSON(sessions: Session[], categories: Category[]): string {
  const catMap = new Map(categories.map(c => [c.id, c.name]))
  const data = sessions.map(s => ({
    id: s.id,
    category: catMap.get(s.categoryId) ?? 'Unknown',
    categoryId: s.categoryId,
    date: s.date,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    durationMinutes: Math.round((s.endedAt - s.startedAt) / 60000),
    tag: s.tag,
  }))
  return JSON.stringify(data, null, 2)
}

// ─── exportSessionsToHTML ────────────────────────────────────────────────────

export type WeeklyStat = { name: string; weeklyMs: number }

export function exportSessionsToHTML(sessions: Session[], categories: Category[], _weeklyStats: WeeklyStat[]): string {
  const grouped = groupSessionsByDate(sessions, categories)

  const rows = grouped.map(day => {
    const sessionRows = day.sessions.map(s => {
      const dur = Math.round((s.endedAt - s.startedAt) / 60000)
      const start = formatLocalTime(s.startedAt)
      const end = formatLocalTime(s.endedAt)
      return `<tr><td>${s.categoryName}</td><td>${start}</td><td>${end}</td><td>${dur} min</td><td>${s.tag ?? ''}</td></tr>`
    }).join('\n')
    return `<h3>${day.date}</h3><table><thead><tr><th>Category</th><th>Start</th><th>End</th><th>Duration</th><th>Tag</th></tr></thead><tbody>${sessionRows}</tbody></table>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Time Tracker Export</title>
<style>body{font-family:sans-serif;max-width:800px;margin:2rem auto}table{width:100%;border-collapse:collapse}th,td{padding:.5rem;border:1px solid #ccc;text-align:left}th{background:#f0f0f0}</style>
</head>
<body><h1>Time Tracker Report</h1>${rows}</body>
</html>`
}

// ─── getLastSessionDate ───────────────────────────────────────────────────────

export function getLastSessionDate(sessions: Session[], categoryId: string): number | null {
  const filtered = sessions.filter(s => s.categoryId === categoryId)
  if (filtered.length === 0) return null
  return Math.max(...filtered.map(s => s.endedAt))
}

// ─── computeDayTotals ────────────────────────────────────────────────────────

export type DayTotal = { date: string; totalMs: number; topCategoryId: string | null }

export function computeDayTotals(sessions: Session[], _categories: Category[], since: string): DayTotal[] {
  const filtered = sessions.filter(s => s.date >= since)
  const dayMap = new Map<string, Map<string, number>>()

  for (const s of filtered) {
    if (!dayMap.has(s.date)) dayMap.set(s.date, new Map())
    const catMap = dayMap.get(s.date)!
    const dur = s.endedAt - s.startedAt
    catMap.set(s.categoryId, (catMap.get(s.categoryId) ?? 0) + dur)
  }

  return Array.from(dayMap.entries()).map(([date, catMap]) => {
    const totalMs = Array.from(catMap.values()).reduce((a, b) => a + b, 0)
    let topCategoryId: string | null = null
    let topMs = 0
    for (const [catId, ms] of catMap.entries()) {
      if (ms > topMs) { topMs = ms; topCategoryId = catId }
    }
    return { date, totalMs, topCategoryId }
  }).sort((a, b) => a.date.localeCompare(b.date))
}

// ─── computeEnergyPattern ────────────────────────────────────────────────────

export type EnergySlot = { hour: number; avgMs: number; peakDays: number }

export function computeEnergyPattern(sessions: Session[], _days: number): {
  slots: EnergySlot[]
  peakHours: number[]
  valleyHours: number[]
  insight: string
} {
  if (sessions.length === 0) {
    return { slots: [], peakHours: [], valleyHours: [], insight: 'No data yet.' }
  }

  // Group by hour: sum ms and count unique days
  const hourMs = new Map<number, number>()
  const hourDays = new Map<number, Set<string>>()

  for (const s of sessions) {
    const hour = new Date(s.startedAt).getHours()
    const dur = s.endedAt - s.startedAt
    hourMs.set(hour, (hourMs.get(hour) ?? 0) + dur)
    if (!hourDays.has(hour)) hourDays.set(hour, new Set())
    hourDays.get(hour)!.add(s.date)
  }

  const slots: EnergySlot[] = Array.from(hourMs.entries()).map(([hour, totalMs]) => {
    const days = hourDays.get(hour)?.size ?? 1
    return { hour, avgMs: Math.round(totalMs / days), peakDays: days }
  }).sort((a, b) => a.hour - b.hour)

  const sorted = [...slots].sort((a, b) => b.avgMs - a.avgMs)
  const topN = Math.min(3, sorted.length)
  const peakHours = sorted.slice(0, topN).map(s => s.hour).sort((a, b) => a - b)
  const bottomN = sorted.length > 3 ? Math.min(2, sorted.length - topN) : 0
  const valleyHours = sorted.slice(-bottomN).map(s => s.hour).sort((a, b) => a - b)

  const peakStr = peakHours.length > 0
    ? `Your peak hours are ${peakHours.map(h => `${h}h`).join(' and ')}.`
    : 'Not enough data to determine peak hours.'

  return { slots, peakHours, valleyHours, insight: peakStr }
}

// ─── isFlowSession ───────────────────────────────────────────────────────────

const DEFAULT_FLOW_THRESHOLD_MS = 45 * 60 * 1000 // 45 minutes

export function isFlowSession(session: Session, thresholdMs = DEFAULT_FLOW_THRESHOLD_MS): boolean {
  return (session.endedAt - session.startedAt) >= thresholdMs
}

// ─── parseTogglCSV ───────────────────────────────────────────────────────────

export function parseTogglCSV(raw: string, existingCategories: Category[]): {
  sessions: Omit<Session, 'id'>[]
  newCategories: string[]
} {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length <= 1) return { sessions: [], newCategories: [] }

  const existingNames = new Map(existingCategories.map(c => [c.name, c.id]))
  const newCatNames = new Set<string>()
  const sessions: Omit<Session, 'id'>[] = []

  // Parse CSV — simple field splitting respecting quoted fields
  function parseRow(line: string): string[] {
    const fields: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        fields.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    fields.push(current)
    return fields
  }

  for (let i = 1; i < lines.length; i++) {
    const fields = parseRow(lines[i])
    // User,Email,Client,Project,Task,Description,Start date,Start time,End date,End time,Duration
    const projectName = fields[3]?.trim() ?? ''
    const startDate = fields[6]?.trim() ?? ''
    const startTime = fields[7]?.trim() ?? ''
    const endDate = fields[8]?.trim() ?? ''
    const endTime = fields[9]?.trim() ?? ''

    if (!projectName || !startDate || !startTime) continue

    const startedAt = new Date(`${startDate}T${startTime}Z`).getTime()
    const endedAt = new Date(`${endDate}T${endTime}Z`).getTime()

    let categoryId = existingNames.get(projectName)
    if (!categoryId) {
      // We'll generate a placeholder — real import will create the category
      categoryId = `import-${projectName.toLowerCase().replace(/\s+/g, '-')}`
      newCatNames.add(projectName)
    }

    sessions.push({
      categoryId,
      startedAt,
      endedAt,
      date: startDate,
    })
  }

  return { sessions, newCategories: Array.from(newCatNames) }
}

// ─── exportDayAsMarkdown ─────────────────────────────────────────────────────

import type { EveningReview } from './intentions'
import { formatElapsed } from './format'

export function exportDayAsMarkdown(
  date: string,
  sessions: Session[],
  categories: Category[],
  intentions: { text: string; done?: boolean }[],
  review: EveningReview | null
): string {
  const catMap = new Map(categories.map(c => [c.id, c]))

  // Time tracked per category
  const msById: Record<string, number> = {}
  const flowById: Record<string, number> = {}
  for (const s of sessions) {
    msById[s.categoryId] = (msById[s.categoryId] ?? 0) + (s.endedAt - s.startedAt)
    if (isFlowSession(s)) flowById[s.categoryId] = (flowById[s.categoryId] ?? 0) + 1
  }

  const totalMs = Object.values(msById).reduce((a, b) => a + b, 0)

  const timeLines = Object.entries(msById)
    .sort((a, b) => b[1] - a[1])
    .map(([id, ms]) => {
      const cat = catMap.get(id)
      const goalMs = cat?.weeklyGoalMs
      const pct = goalMs ? ` (goal: ${formatElapsed(goalMs)} · ${Math.round((ms / goalMs) * 100)}%)` : ''
      const flows = flowById[id] ? ` · ${flowById[id]} flow sessions` : ''
      return `- ${cat?.name ?? id}: ${formatElapsed(ms)}${pct}${flows}`
    })
    .join('\n')

  const intentionLines = intentions
    .map(i => `- [${i.done ? 'x' : ' '}] ${i.text}`)
    .join('\n')

  const lines: string[] = [
    `# ${date} · Productivity Review`,
    '',
    '## Time Tracked',
    timeLines || '- No sessions recorded',
    '',
    `**Total:** ${formatElapsed(totalMs)}${review ? ` · Mood: ${review.mood}/5` : ''}`,
  ]

  if (intentions.length > 0) {
    lines.push('', '## Intentions', intentionLines)
  }

  if (review) {
    lines.push('', '## Evening Notes', review.notes || '_(no notes)_')
  }

  return lines.join('\n')
}

// ─── suggestWeeklyGoal ───────────────────────────────────────────────────────

export function suggestWeeklyGoal(sessions: Session[], categoryId: string, recentWeeks = 4): number {
  if (sessions.length === 0) return 0

  // Group sessions by ISO week
  function getWeekKey(date: string): string {
    const d = new Date(date + 'T12:00:00Z')
    const day = d.getUTCDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const monday = new Date(d)
    monday.setUTCDate(d.getUTCDate() + mondayOffset)
    return monday.toISOString().slice(0, 10)
  }

  const catSessions = sessions.filter(s => s.categoryId === categoryId)
  if (catSessions.length === 0) return 0

  const weekMs = new Map<string, number>()
  for (const s of catSessions) {
    const wk = getWeekKey(s.date)
    weekMs.set(wk, (weekMs.get(wk) ?? 0) + (s.endedAt - s.startedAt))
  }

  const weeks = Array.from(weekMs.values())
  if (weeks.length < 2) return 0

  const recent = weeks.slice(-recentWeeks)
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length
  const suggested = avg * 1.1

  // Round to nearest 0.5h in ms
  const halfHourMs = 1_800_000
  return Math.round(suggested / halfHourMs) * halfHourMs
}
