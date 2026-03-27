import { computeDeadTime, formatIdleTime } from '../domain/deadTimeRecovery'
import type { MicroTask } from '../domain/deadTimeRecovery'
import { useI18n, isI18nKey } from '../i18n'
import type { TKey } from '../i18n'

type Props = {
  idleMs: number
  idleContext?: string
  customTasks?: MicroTask[]
  onSelectTask: (task: MicroTask) => void
  onDismiss: () => void
}

function taskLabel(task: MicroTask, t: (key: TKey) => string): string {
  const key = `deadTime.task.${task.id}`
  return isI18nKey(key) ? t(key as TKey) : task.text
}

export function DeadTimeRecoveryWidget({ idleMs, idleContext, customTasks, onSelectTask, onDismiss }: Props) {
  const { t } = useI18n()
  const state = computeDeadTime(idleMs, undefined, customTasks)

  if (!state.dead) return null

  return (
    <div
      role="dialog"
      aria-label={t('deadTime.title')}
      className="rounded-xl border border-white/10 bg-zinc-900/95 p-4 shadow-2xl text-sm"
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-medium text-zinc-200">
            💤 {t('deadTime.title')} — {formatIdleTime(state.idleMs)} {t('deadTime.idle')}
            {idleContext && <span className="text-zinc-500"> {t('deadTime.idleIn')} {idleContext}</span>}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">{t('deadTime.quickWin')}</p>
        </div>
        <button
          onClick={onDismiss}
          aria-label={t('deadTime.dismiss')}
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
                <span>{taskLabel(task, t)}</span>
                <span className="text-zinc-600 text-xs">{task.estimatedMinutes}m</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
