import { getElapsed } from './timer'

type CategoryLike = {
  id: string
  name: string
  accumulatedMs: number
  activeEntry: { startedAt: number; endedAt: number | null } | null
}

export type StatEntry = {
  id: string
  name: string
  totalMs: number
  percentage: number
}

export function computeStats(categories: CategoryLike[]): StatEntry[] {
  const entries = categories.map(c => ({
    id: c.id,
    name: c.name,
    totalMs: c.accumulatedMs + (c.activeEntry ? getElapsed(c.activeEntry) : 0),
  }))

  const total = entries.reduce((sum, e) => sum + e.totalMs, 0)

  return entries
    .map(e => ({
      ...e,
      percentage: total === 0 ? 0 : Math.round((e.totalMs / total) * 100),
    }))
    .sort((a, b) => b.totalMs - a.totalMs)
}
