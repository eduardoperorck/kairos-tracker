export type TimerEntry = {
  startedAt: number
  endedAt: number | null
}

export type Category = {
  id: string
  name: string
  activeEntry: TimerEntry | null
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
