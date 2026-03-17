import { describe, it, expect } from 'vitest'
import { classifyCommit, correlateCommitsWithSessions } from './codeQuality'
import type { GitCommit } from './codeQuality'
import type { Session } from './timer'

function makeCommit(subject: string, offsetMs = 0): GitCommit {
  const ts = new Date('2026-03-15T10:30:00Z').getTime() + offsetMs
  return { hash: 'abc123', timestamp: new Date(ts).toISOString(), subject }
}

function makeSession(overrides: Partial<Session & { dwsScore?: number }> = {}): Session & { dwsScore?: number } {
  return {
    id: 's1',
    categoryId: 'c1',
    date: '2026-03-15',
    startedAt: new Date('2026-03-15T09:00:00Z').getTime(),
    endedAt:   new Date('2026-03-15T11:00:00Z').getTime(),
    dwsScore: 75,
    ...overrides,
  }
}

describe('classifyCommit', () => {
  it('marks fix commits', () => {
    expect(classifyCommit(makeCommit('fix: correct null pointer')).isFix).toBe(true)
    expect(classifyCommit(makeCommit('hotfix user auth')).isFix).toBe(true)
    expect(classifyCommit(makeCommit('feat: add new feature')).isFix).toBe(false)
  })

  it('marks test commits', () => {
    expect(classifyCommit(makeCommit('test: add unit tests')).isTest).toBe(true)
    expect(classifyCommit(makeCommit('coverage: improve to 80%')).isTest).toBe(true)
    expect(classifyCommit(makeCommit('feat: new UI')).isTest).toBe(false)
  })

  it('marks revert commits', () => {
    expect(classifyCommit(makeCommit('revert "bad change"')).isRevert).toBe(true)
    expect(classifyCommit(makeCommit('feat: add button')).isRevert).toBe(false)
  })

  it('converts timestamp to ms', () => {
    const result = classifyCommit(makeCommit('feat: x'))
    expect(result.timestamp).toBeTypeOf('number')
    expect(result.timestamp).toBeGreaterThan(0)
  })
})

describe('correlateCommitsWithSessions', () => {
  it('returns zero counts when no commits', () => {
    const result = correlateCommitsWithSessions([], [makeSession()])
    expect(result.totalCommits).toBe(0)
    expect(result.highDws.commitCount).toBe(0)
  })

  it('assigns commits inside a high-DWS session window', () => {
    const session = makeSession({ dwsScore: 80 })
    const commit = makeCommit('feat: new feature')
    const result = correlateCommitsWithSessions([commit], [session])
    expect(result.highDws.commitCount).toBe(1)
    expect(result.lowDws.commitCount).toBe(0)
  })

  it('assigns commits inside a low-DWS session window', () => {
    const session = makeSession({ dwsScore: 30 })
    const commit = makeCommit('feat: add button')
    const result = correlateCommitsWithSessions([commit], [session])
    expect(result.lowDws.commitCount).toBe(1)
    expect(result.highDws.commitCount).toBe(0)
  })

  it('ignores commits outside any session window', () => {
    const session = makeSession({
      startedAt: new Date('2026-03-15T09:00:00Z').getTime(),
      endedAt:   new Date('2026-03-15T10:00:00Z').getTime(),
    })
    // commit is at 15h, far from the session
    const commit = makeCommit('feat: late commit', 4.5 * 3_600_000)
    const result = correlateCommitsWithSessions([commit], [session])
    expect(result.highDws.commitCount).toBe(0)
    expect(result.lowDws.commitCount).toBe(0)
  })

  it('calculates fix rate correctly', () => {
    const session = makeSession({ dwsScore: 20 })
    const commits = [
      makeCommit('fix: bug', 0),
      makeCommit('fix: another bug', 1000),
      makeCommit('feat: new thing', 2000),
    ]
    const result = correlateCommitsWithSessions(commits, [session])
    expect(result.lowDws.fixRate).toBeCloseTo(2 / 3)
  })

  it('generates insight when low-DWS fix rate is high', () => {
    const highSession = makeSession({ dwsScore: 80 })
    const lowSession = makeSession({
      dwsScore: 20,
      startedAt: new Date('2026-03-15T14:00:00Z').getTime(),
      endedAt:   new Date('2026-03-15T16:00:00Z').getTime(),
    })
    const highCommits = [
      makeCommit('feat: feature A'),
      makeCommit('feat: feature B'),
    ]
    const lowCommits = [
      makeCommit('fix: bug 1', 4.5 * 3_600_000),
      makeCommit('fix: bug 2', 4.5 * 3_600_000 + 1000),
      makeCommit('fix: bug 3', 4.5 * 3_600_000 + 2000),
    ]
    const result = correlateCommitsWithSessions([...highCommits, ...lowCommits], [highSession, lowSession])
    expect(result.insight).not.toBeNull()
  })
})
