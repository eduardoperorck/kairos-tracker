import { computeDeadTime, formatIdleTime } from '../domain/deadTimeRecovery'
import type { MicroTask } from '../domain/deadTimeRecovery'

type Props = {
  idleMs: number
  customTasks?: MicroTask[]
  onSelectTask: (task: MicroTask) => void
  onDismiss: () => void
}

export function DeadTimeRecoveryWidget({ idleMs, customTasks, onSelectTask, onDismiss }: Props) {
  const state = computeDeadTime(idleMs, undefined, customTasks)

  if (!state.dead) return null

  return (
    <div
      role="dialog"
      aria-label="Dead time detected"
      className="rounded-xl border border-white/10 bg-zinc-900/95 p-4 shadow-2xl text-sm"
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-medium text-zinc-200">
            💤 Dead time — {formatIdleTime(state.idleMs)} idle
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">Quick win while you're in transition?</p>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-zinc-600 hover:text-zinc-400 transition-colors ml-2"
        >
          ✕
        </button>
      </div>
      <ul className="space-y-1.5">
        {state.suggestions.map(task => (
          <li key={task.id}>
            <button
              onClick={() => onSelectTask(task)}
              className="w-full rounded border border-white/[0.06] bg-white/3 px-3 py-2 text-left text-zinc-300 hover:bg-white/6 hover:text-zinc-100 transition-colors"
            >
              <span className="flex justify-between">
                <span>{task.text}</span>
                <span className="text-zinc-600 text-xs">{task.estimatedMinutes}m</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
