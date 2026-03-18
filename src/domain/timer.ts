export type TimerEntry = {
  startedAt: number
  endedAt: number | null
}

export type Session = {
  id: string
  categoryId: string
  startedAt: number
  endedAt: number
  date: string
  tag?: string
}

export function toDateString(ms: number): string {
  const d = new Date(ms)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function computeTodayMs(sessions: Session[], categoryId: string, today: string): number {
  return sessions
    .filter(s => s.categoryId === categoryId && s.date === today)
    .reduce((sum, s) => sum + (s.endedAt - s.startedAt), 0)
}

export function createSession(categoryId: string, entry: TimerEntry): Session {
  const endedAt = entry.endedAt ?? Date.now()
  return {
    id: crypto.randomUUID(),
    categoryId,
    startedAt: entry.startedAt,
    endedAt,
    date: toDateString(entry.startedAt),
  }
}

export type Category = {
  id: string
  name: string
  activeEntry: TimerEntry | null
  weeklyGoalMs?: number
  color?: string
}

export function getWeekDates(today: string): string[] {
  const date = new Date(today + 'T12:00:00Z')
  const day = date.getUTCDay() // 0=Sun … 6=Sat
  const mondayOffset = day === 0 ? -6 : 1 - day
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(date)
    d.setUTCDate(date.getUTCDate() + mondayOffset + i)
    return d.toISOString().slice(0, 10)
  })
}

export function computeStreak(sessionDates: string[], today: string): number {
  const unique = [...new Set(sessionDates)].sort()
  if (unique.length === 0) return 0

  const last = unique[unique.length - 1]
  const todayMs = new Date(today + 'T12:00:00Z').getTime()
  const lastMs = new Date(last + 'T12:00:00Z').getTime()
  const diffDays = Math.round((todayMs - lastMs) / 86_400_000)

  if (diffDays > 1) return 0

  let count = 0
  let cursor = lastMs
  for (let i = unique.length - 1; i >= 0; i--) {
    const dateMs = new Date(unique[i] + 'T12:00:00Z').getTime()
    if (Math.round((cursor - dateMs) / 86_400_000) > 0) break
    count++
    cursor = dateMs - 86_400_000
  }
  return count
}

export function computeWeekMs(sessions: Session[], categoryId: string, weekDates: string[]): number {
  const set = new Set(weekDates)
  return sessions
    .filter(s => s.categoryId === categoryId && set.has(s.date))
    .reduce((sum, s) => sum + (s.endedAt - s.startedAt), 0)
}

export function createCategory(name: string): Category {
  return {
    id: crypto.randomUUID(),
    name,
    activeEntry: null,
  }
}

export function startTimer(): TimerEntry {
  return {
    startedAt: Date.now(),
    endedAt: null,
  }
}

export function stopTimer(entry: TimerEntry): TimerEntry {
  return {
    ...entry,
    endedAt: Date.now(),
  }
}

export function getElapsed(entry: Pick<TimerEntry, 'startedAt' | 'endedAt'>): number {
  const end = entry.endedAt ?? Date.now()
  return end - entry.startedAt
}
