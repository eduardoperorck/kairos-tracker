export type MicroTask = {
  id: string
  text: string
  estimatedMinutes: number
}

export type DeadTimeState =
  | { dead: false }
  | { dead: true; idleMs: number; suggestions: MicroTask[] }

const DEFAULT_THRESHOLD_MS = 10 * 60_000 // 10 minutes idle = dead time

const DEFAULT_SUGGESTIONS: MicroTask[] = [
  { id: 'review-inbox', text: 'Review inbox', estimatedMinutes: 5 },
  { id: 'review-tasks', text: 'Review task backlog', estimatedMinutes: 5 },
  { id: 'respond-messages', text: 'Respond to messages', estimatedMinutes: 5 },
  { id: 'plan-tomorrow', text: 'Plan tomorrow', estimatedMinutes: 3 },
  { id: 'capture-ideas', text: 'Capture ideas or notes', estimatedMinutes: 3 },
  { id: 'stretch', text: 'Stand up and stretch', estimatedMinutes: 2 },
  { id: 'review-docs', text: 'Read documentation', estimatedMinutes: 10 },
  { id: 'code-review', text: 'Do a quick code review', estimatedMinutes: 10 },
]

export function computeDeadTime(
  idleMs: number,
  thresholdMs = DEFAULT_THRESHOLD_MS,
  customTasks: MicroTask[] = [],
): DeadTimeState {
  if (idleMs <= thresholdMs) return { dead: false }

  const pool = customTasks.length > 0 ? customTasks : DEFAULT_SUGGESTIONS
  const maxMinutes = Math.floor(idleMs / 60_000)
  const suggestions = pool.filter(t => t.estimatedMinutes <= maxMinutes).slice(0, 3)

  return { dead: true, idleMs, suggestions }
}

export function formatIdleTime(idleMs: number): string {
  const minutes = Math.floor(idleMs / 60_000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`
}
