import type { Session } from './timer'

export type GitCommit = {
  hash: string
  timestamp: string  // ISO date string from git log
  subject: string
}

export type CommitQuality = {
  hash: string
  timestamp: number
  subject: string
  isFix: boolean
  isTest: boolean
  isRevert: boolean
}

export type CodeQualityCorrelation = {
  highDws: { commitCount: number; fixRate: number; testRate: number; avgSubjectLength: number }
  lowDws:  { commitCount: number; fixRate: number; testRate: number; avgSubjectLength: number }
  totalCommits: number
  insight: string | null
}

const FIX_KEYWORDS = ['fix', 'hotfix', 'bugfix', 'bug', 'patch', 'correct', 'revert']
const TEST_KEYWORDS = ['test', 'spec', 'coverage', 'jest', 'vitest']

export function classifyCommit(commit: GitCommit): CommitQuality {
  const lower = commit.subject.toLowerCase()
  const isFix = FIX_KEYWORDS.some(k => lower.includes(k))
  const isTest = TEST_KEYWORDS.some(k => lower.includes(k))
  const isRevert = lower.startsWith('revert')
  return {
    hash: commit.hash,
    timestamp: new Date(commit.timestamp).getTime(),
    subject: commit.subject,
    isFix,
    isTest,
    isRevert,
  }
}

function qualityStats(commits: CommitQuality[]) {
  if (commits.length === 0) return { commitCount: 0, fixRate: 0, testRate: 0, avgSubjectLength: 0 }
  const fixRate = commits.filter(c => c.isFix).length / commits.length
  const testRate = commits.filter(c => c.isTest).length / commits.length
  const avgSubjectLength = commits.reduce((s, c) => s + c.subject.length, 0) / commits.length
  return { commitCount: commits.length, fixRate, testRate, avgSubjectLength }
}

/**
 * Correlates git commits with sessions that have a dwsScore.
 * Sessions with dwsScore >= 60 are "high DWS"; < 60 are "low DWS".
 * Commits are assigned to the session whose time window they fall within ± 30 min.
 */
export function correlateCommitsWithSessions(
  commits: GitCommit[],
  sessions: (Session & { dwsScore?: number })[],
  dwsThreshold = 60
): CodeQualityCorrelation {
  const classified = commits.map(classifyCommit)
  const WINDOW_MS = 30 * 60_000

  const highCommits: CommitQuality[] = []
  const lowCommits: CommitQuality[] = []

  for (const commit of classified) {
    const matchingSession = sessions.find(
      s => commit.timestamp >= s.startedAt - WINDOW_MS && commit.timestamp <= s.endedAt + WINDOW_MS
    )
    if (!matchingSession) continue
    const dws = matchingSession.dwsScore ?? 50
    if (dws >= dwsThreshold) highCommits.push(commit)
    else lowCommits.push(commit)
  }

  const high = qualityStats(highCommits)
  const low = qualityStats(lowCommits)

  let insight: string | null = null
  if (high.commitCount > 0 && low.commitCount > 0) {
    if (low.fixRate > high.fixRate * 1.5) {
      const ratio = (low.fixRate / Math.max(high.fixRate, 0.01)).toFixed(1)
      insight = `Commits during low-focus sessions have ${ratio}× more fix-commits than high-focus sessions.`
    } else if (high.testRate > low.testRate * 1.5) {
      insight = `You include tests ${(high.testRate * 100).toFixed(0)}% of the time in high-focus sessions vs ${(low.testRate * 100).toFixed(0)}% in low-focus.`
    }
  }

  return { highDws: high, lowDws: low, totalCommits: classified.length, insight }
}
