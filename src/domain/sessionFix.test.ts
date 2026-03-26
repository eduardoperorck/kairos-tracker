import { describe, it, expect } from 'vitest'
import { splitSession, editSessionTime } from './sessionFix'
import type { Session } from './timer'

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    categoryId: 'cat-work',
    startedAt: 0,
    endedAt: 120 * 60_000, // 2h
    date: '2026-03-26',
    ...overrides,
  }
}

describe('splitSession', () => {
  it('splits a 2h session — last 45min go to new category', () => {
    const session = makeSession()
    const splitMs = 45 * 60_000
    const [first, second] = splitSession(session, splitMs, 'cat-meeting')

    expect(first.categoryId).toBe('cat-work')
    expect(second.categoryId).toBe('cat-meeting')
    expect(first.endedAt).toBe(second.startedAt)
    expect(second.endedAt).toBe(session.endedAt)
    expect(second.endedAt - second.startedAt).toBe(splitMs)
    expect(first.endedAt - first.startedAt).toBe(75 * 60_000)
  })

  it('preserves the original session id for the first half', () => {
    const session = makeSession({ id: 'original-id' })
    const [first] = splitSession(session, 30 * 60_000, 'cat-meeting')
    expect(first.id).toBe('original-id')
  })

  it('generates a new unique id for the second half', () => {
    const session = makeSession({ id: 'original-id' })
    const [first, second] = splitSession(session, 30 * 60_000, 'cat-meeting')
    expect(second.id).not.toBe(first.id)
  })

  it('second half inherits the same date', () => {
    const session = makeSession({ date: '2026-03-26' })
    const [, second] = splitSession(session, 30 * 60_000, 'cat-meeting')
    expect(second.date).toBe('2026-03-26')
  })

  it('throws when splitMs >= total session duration', () => {
    const session = makeSession()
    expect(() => splitSession(session, 120 * 60_000, 'cat-meeting')).toThrow()
  })

  it('throws when splitMs <= 0', () => {
    const session = makeSession()
    expect(() => splitSession(session, 0, 'cat-meeting')).toThrow()
  })
})

describe('editSessionTime', () => {
  it('returns a session with new startedAt and endedAt', () => {
    const session = makeSession({ startedAt: 0, endedAt: 60 * 60_000 })
    const updated = editSessionTime(session, 30 * 60_000, 90 * 60_000)
    expect(updated.startedAt).toBe(30 * 60_000)
    expect(updated.endedAt).toBe(90 * 60_000)
  })

  it('preserves all other session fields', () => {
    const session = makeSession({ id: 's1', categoryId: 'cat-work', date: '2026-03-26', tag: 'deep work' })
    const updated = editSessionTime(session, 0, 60 * 60_000)
    expect(updated.id).toBe('s1')
    expect(updated.categoryId).toBe('cat-work')
    expect(updated.date).toBe('2026-03-26')
    expect(updated.tag).toBe('deep work')
  })

  it('throws when endedAt <= startedAt', () => {
    const session = makeSession()
    expect(() => editSessionTime(session, 60 * 60_000, 60 * 60_000)).toThrow()
    expect(() => editSessionTime(session, 90 * 60_000, 60 * 60_000)).toThrow()
  })
})
