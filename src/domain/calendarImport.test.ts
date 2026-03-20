import { describe, it, expect } from 'vitest'
import { parseICS, icsEventsToSessions } from './calendarImport'
import type { Category } from './timer'

const SAMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Team standup
DTSTART:20260319T100000Z
DTEND:20260319T103000Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:Deep work
DTSTART:20260319T130000Z
DTEND:20260319T150000Z
END:VEVENT
END:VCALENDAR`

describe('parseICS', () => {
  it('parses UTC datetime events', () => {
    const events = parseICS(SAMPLE_ICS)
    expect(events).toHaveLength(2)
    expect(events[0].summary).toBe('Team standup')
    expect(events[0].endedAt - events[0].startedAt).toBe(30 * 60_000)
  })

  it('parses floating datetime', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Meeting
DTSTART:20260320T090000
DTEND:20260320T100000
END:VEVENT
END:VCALENDAR`
    const events = parseICS(ics)
    expect(events).toHaveLength(1)
    expect(events[0].endedAt - events[0].startedAt).toBe(60 * 60_000)
  })

  it('parses DATE-only events', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Holiday
DTSTART:20260320
DTEND:20260321
END:VEVENT
END:VCALENDAR`
    const events = parseICS(ics)
    expect(events).toHaveLength(1)
    expect(events[0].summary).toBe('Holiday')
  })

  it('skips events without end time', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Bad event
DTSTART:20260319T100000Z
END:VEVENT
END:VCALENDAR`
    expect(parseICS(ics)).toHaveLength(0)
  })

  it('skips events where end <= start', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Zero duration
DTSTART:20260319T100000Z
DTEND:20260319T100000Z
END:VEVENT
END:VCALENDAR`
    expect(parseICS(ics)).toHaveLength(0)
  })

  it('handles TZID param in property name', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Tz event
DTSTART;TZID=America/New_York:20260319T100000
DTEND;TZID=America/New_York:20260319T110000
END:VEVENT
END:VCALENDAR`
    const events = parseICS(ics)
    expect(events).toHaveLength(1)
    expect(events[0].endedAt - events[0].startedAt).toBe(60 * 60_000)
  })
})

describe('icsEventsToSessions', () => {
  const categories: Category[] = [
    { id: 'work', name: 'Work', activeEntry: null },
    { id: 'meeting', name: 'Meeting', activeEntry: null },
  ]

  it('matches by category name substring', () => {
    const events = parseICS(SAMPLE_ICS)
    const { sessions } = icsEventsToSessions(events, categories, 'work')
    // "Team standup" doesn't match any but fallback to work
    // "Deep work" substring matches "Work"
    expect(sessions).toHaveLength(2)
  })

  it('assigns unmatched events to fallback category', () => {
    const events = parseICS(SAMPLE_ICS)
    const { sessions, unmatchedSummaries } = icsEventsToSessions(events, categories, 'work')
    expect(unmatchedSummaries).toContain('Team standup')
    const unmatched = sessions.find(s => s.categoryId === 'work')
    expect(unmatched).toBeDefined()
  })

  it('skips events with no category match and no fallback', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Unknown event
DTSTART:20260319T100000Z
DTEND:20260319T110000Z
END:VEVENT
END:VCALENDAR`
    const events = parseICS(ics)
    const { sessions } = icsEventsToSessions(events, categories)
    expect(sessions).toHaveLength(0)
  })

  it('returns unique unmatched summaries', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Mystery
DTSTART:20260319T100000Z
DTEND:20260319T110000Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:Mystery
DTSTART:20260319T120000Z
DTEND:20260319T130000Z
END:VEVENT
END:VCALENDAR`
    const events = parseICS(ics)
    const { unmatchedSummaries } = icsEventsToSessions(events, [])
    expect(unmatchedSummaries).toHaveLength(1)
    expect(unmatchedSummaries[0]).toBe('Mystery')
  })
})
