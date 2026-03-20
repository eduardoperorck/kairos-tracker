import type { Session, Category } from './timer'
import { toDateString } from './timer'

export type CalendarEvent = {
  summary: string
  startedAt: number
  endedAt: number
}

/** Parse DTSTART/DTEND value to unix ms. Handles UTC (Z), floating, and DATE-only formats. */
function parseDtValue(value: string): number | null {
  // Date-only: 20260319
  if (/^\d{8}$/.test(value)) {
    const y = parseInt(value.slice(0, 4))
    const m = parseInt(value.slice(4, 6)) - 1
    const d = parseInt(value.slice(6, 8))
    return new Date(y, m, d).getTime()
  }
  // DateTime UTC: 20260319T100000Z
  if (/^\d{8}T\d{6}Z$/.test(value)) {
    const y = parseInt(value.slice(0, 4))
    const mo = parseInt(value.slice(4, 6)) - 1
    const d = parseInt(value.slice(6, 8))
    const h = parseInt(value.slice(9, 11))
    const mi = parseInt(value.slice(11, 13))
    const s = parseInt(value.slice(13, 15))
    return Date.UTC(y, mo, d, h, mi, s)
  }
  // DateTime floating: 20260319T100000
  if (/^\d{8}T\d{6}$/.test(value)) {
    const y = parseInt(value.slice(0, 4))
    const mo = parseInt(value.slice(4, 6)) - 1
    const d = parseInt(value.slice(6, 8))
    const h = parseInt(value.slice(9, 11))
    const mi = parseInt(value.slice(11, 13))
    const s = parseInt(value.slice(13, 15))
    return new Date(y, mo, d, h, mi, s).getTime()
  }
  return null
}

/** Strip TZID param from property name, e.g. "DTSTART;TZID=America/New_York" → "DTSTART" */
function propName(line: string): string {
  return line.split(';')[0].split(':')[0]
}

function propValue(line: string): string {
  const idx = line.indexOf(':')
  return idx >= 0 ? line.slice(idx + 1) : ''
}

/** Parse raw ICS text into calendar events. */
export function parseICS(raw: string): CalendarEvent[] {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const events: CalendarEvent[] = []

  let inEvent = false
  let summary = ''
  let dtstart: number | null = null
  let dtend: number | null = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      summary = ''
      dtstart = null
      dtend = null
      continue
    }
    if (line === 'END:VEVENT') {
      inEvent = false
      if (summary && dtstart !== null && dtend !== null && dtend > dtstart) {
        events.push({ summary, startedAt: dtstart, endedAt: dtend })
      }
      continue
    }
    if (!inEvent) continue

    const name = propName(line)
    const value = propValue(line)

    if (name === 'SUMMARY') {
      summary = value.trim()
    } else if (name === 'DTSTART') {
      dtstart = parseDtValue(value.trim())
    } else if (name === 'DTEND') {
      dtend = parseDtValue(value.trim())
    }
  }

  return events
}

export type ICSImportResult = {
  sessions: Session[]
  /** Event summaries that had no matching category (user needs to create them) */
  unmatchedSummaries: string[]
}

/**
 * Convert parsed ICS events to sessions by matching event summary to category name.
 * Case-insensitive substring match: "Team standup" matches "Work" if category "Meeting" doesn't exist.
 * If no category matches, falls back to the first category or skips.
 */
export function icsEventsToSessions(
  events: CalendarEvent[],
  categories: Category[],
  fallbackCategoryId?: string,
): ICSImportResult {
  const unmatchedSet = new Set<string>()
  const sessions: Session[] = []

  for (const event of events) {
    // Find category by name match (case-insensitive)
    const matched = categories.find(c =>
      c.name.toLowerCase() === event.summary.toLowerCase() ||
      event.summary.toLowerCase().includes(c.name.toLowerCase())
    )
    const categoryId = matched?.id ?? fallbackCategoryId
    if (!categoryId) {
      unmatchedSet.add(event.summary)
      continue
    }
    if (!matched) unmatchedSet.add(event.summary)

    sessions.push({
      id: crypto.randomUUID(),
      categoryId,
      startedAt: event.startedAt,
      endedAt: event.endedAt,
      date: toDateString(event.startedAt),
    })
  }

  return { sessions, unmatchedSummaries: [...unmatchedSet] }
}
