import { describe, it, expect } from 'vitest'
import { parseICS } from './calendarParser'

const SAMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:event-001@test.com
DTSTART:20260326T090000Z
DTEND:20260326T100000Z
SUMMARY:Daily Standup
END:VEVENT
BEGIN:VEVENT
UID:event-002@test.com
DTSTART:20260326T140000Z
DTEND:20260326T150000Z
SUMMARY:Product Meeting
END:VEVENT
END:VCALENDAR`

const DATE_ONLY_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:all-day-001@test.com
DTSTART;VALUE=DATE:20260326
DTEND;VALUE=DATE:20260327
SUMMARY:All Day Event
END:VEVENT
END:VCALENDAR`

const CRLF_ICS = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:crlf-001@test.com\r\nDTSTART:20260326T110000Z\r\nDTEND:20260326T120000Z\r\nSUMMARY:CRLF Test\r\nEND:VEVENT\r\nEND:VCALENDAR`

describe('parseICS', () => {
  it('returns empty array for empty string', () => {
    expect(parseICS('')).toEqual([])
  })

  it('parses two events from a sample ICS', () => {
    const events = parseICS(SAMPLE_ICS)
    expect(events).toHaveLength(2)
  })

  it('extracts summary correctly', () => {
    const events = parseICS(SAMPLE_ICS)
    expect(events[0].summary).toBe('Daily Standup')
    expect(events[1].summary).toBe('Product Meeting')
  })

  it('extracts UID as event id', () => {
    const events = parseICS(SAMPLE_ICS)
    expect(events[0].id).toBe('event-001@test.com')
  })

  it('parses UTC DATE-TIME correctly', () => {
    const events = parseICS(SAMPLE_ICS)
    const e = events[0]
    expect(e.start).toBe(Date.UTC(2026, 2, 26, 9, 0, 0))
    expect(e.end).toBe(Date.UTC(2026, 2, 26, 10, 0, 0))
  })

  it('parses DATE-only format (all-day events)', () => {
    const events = parseICS(DATE_ONLY_ICS)
    expect(events).toHaveLength(1)
    expect(events[0].summary).toBe('All Day Event')
    // Should be midnight of 2026-03-26 local time
    const d = new Date(events[0].start)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(2)  // 0-indexed March
    expect(d.getDate()).toBe(26)
  })

  it('handles CRLF line endings', () => {
    const events = parseICS(CRLF_ICS)
    expect(events).toHaveLength(1)
    expect(events[0].summary).toBe('CRLF Test')
  })

  it('skips events where DTSTART >= DTEND', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:bad-001@test.com
DTSTART:20260326T100000Z
DTEND:20260326T100000Z
SUMMARY:Zero Duration
END:VEVENT
END:VCALENDAR`
    expect(parseICS(ics)).toHaveLength(0)
  })

  it('uses fallback id when UID is missing', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260326T090000Z
DTEND:20260326T100000Z
SUMMARY:No UID
END:VEVENT
END:VCALENDAR`
    const events = parseICS(ics)
    expect(events).toHaveLength(1)
    expect(events[0].id).toMatch(/^evt-\d+/)
  })

  it('handles multiline folded SUMMARY correctly', () => {
    // ICS RFC 5545: CRLF + whitespace means continuation — whitespace is removed on unfold
    const ics = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:fold-001@test.com\r\nDTSTART:20260326T090000Z\r\nDTEND:20260326T100000Z\r\nSUMMARY:Folded\r\n Line\r\nEND:VEVENT\r\nEND:VCALENDAR`
    const events = parseICS(ics)
    expect(events).toHaveLength(1)
    // unfolding removes CRLF+space, so "Folded\r\n Line" → "FoldedLine"
    expect(events[0].summary).toBe('FoldedLine')
  })
})
