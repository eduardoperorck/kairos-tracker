export type CalendarEvent = {
  id: string
  summary: string
  start: number  // Unix timestamp ms
  end: number    // Unix timestamp ms
}

/**
 * Parse a DATE or DATE-TIME value from an ICS property.
 * Handles:
 *   - DATE:        YYYYMMDD
 *   - DATE-TIME:   YYYYMMDDTHHmmss  or  YYYYMMDDTHHmmssZ  (UTC)
 * Returns Unix ms timestamp or NaN on parse failure.
 */
function parseICSDate(value: string): number {
  // Strip any timezone identifier prefix like "TZID=..." — we only care about the value
  const raw = value.includes(':') ? value.split(':').pop()! : value

  if (raw.includes('T')) {
    // DATE-TIME format: YYYYMMDDTHHmmss[Z]
    const year  = parseInt(raw.slice(0, 4), 10)
    const month = parseInt(raw.slice(4, 6), 10) - 1
    const day   = parseInt(raw.slice(6, 8), 10)
    const hour  = parseInt(raw.slice(9, 11), 10)
    const min   = parseInt(raw.slice(11, 13), 10)
    const sec   = parseInt(raw.slice(13, 15), 10)
    const utc   = raw.endsWith('Z')
    if (utc) {
      return Date.UTC(year, month, day, hour, min, sec)
    }
    return new Date(year, month, day, hour, min, sec).getTime()
  } else {
    // DATE format: YYYYMMDD — treat as local midnight
    const year  = parseInt(raw.slice(0, 4), 10)
    const month = parseInt(raw.slice(4, 6), 10) - 1
    const day   = parseInt(raw.slice(6, 8), 10)
    return new Date(year, month, day, 0, 0, 0).getTime()
  }
}

/**
 * Unfold ICS content lines: lines ending with CRLF followed by a space/tab
 * are continuations and should be joined.
 */
function unfold(content: string): string {
  return content.replace(/\r?\n[ \t]/g, '')
}

/**
 * Parse a basic ICS string and extract VEVENT blocks.
 * Only DTSTART, DTEND, SUMMARY, and UID are extracted.
 */
export function parseICS(content: string): CalendarEvent[] {
  const unfolded = unfold(content)
  const lines = unfolded.split(/\r?\n/)

  const events: CalendarEvent[] = []
  let inEvent = false
  let uid = ''
  let summary = ''
  let start = NaN
  let end = NaN

  for (const line of lines) {
    const upper = line.toUpperCase()

    if (upper === 'BEGIN:VEVENT') {
      inEvent = true
      uid = ''
      summary = ''
      start = NaN
      end = NaN
      continue
    }

    if (upper === 'END:VEVENT') {
      inEvent = false
      if (!isNaN(start) && !isNaN(end) && start < end) {
        events.push({
          id: uid || `evt-${start}`,
          summary,
          start,
          end,
        })
      }
      continue
    }

    if (!inEvent) continue

    // Each line is "PROPERTY[;params]:value"
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const propFull = line.slice(0, colonIdx).toUpperCase()
    const value    = line.slice(colonIdx + 1)

    // Extract base property name (before any semicolon params)
    const prop = propFull.split(';')[0]

    if (prop === 'UID') {
      uid = value.trim()
    } else if (prop === 'SUMMARY') {
      summary = value.trim()
    } else if (prop === 'DTSTART') {
      start = parseICSDate(line.slice(colonIdx + 1).trim())
    } else if (prop === 'DTEND') {
      end = parseICSDate(line.slice(colonIdx + 1).trim())
    }
  }

  return events
}
