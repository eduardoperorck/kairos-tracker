import { useI18n } from '../i18n'

const IDLE_THRESHOLD_MS = 5 * 60_000

type CurrentWindow = {
  process: string
  workspace: string | null
  domain: string | null
}

type Props = {
  currentWindow: CurrentWindow | null
  idleMs: number
  isTimerActive: boolean
}

function formatLabel(w: CurrentWindow): string {
  if (w.workspace) return `VS Code › ${w.workspace}`
  if (w.domain) return w.domain
  return w.process
}

export function PassiveTrackingIndicator({ currentWindow, idleMs, isTimerActive }: Props) {
  const { t } = useI18n()

  if (!currentWindow) return null

  const isIdle = idleMs >= IDLE_THRESHOLD_MS
  const dotColor = isIdle
    ? 'text-amber-500'
    : isTimerActive
    ? 'text-emerald-500'
    : 'text-zinc-600'

  const stateLabel = isIdle ? t('tracking.idle') : t('tracking.watching')

  return (
    <div className="flex items-center gap-1.5 px-6 py-0.5 text-[11px] text-zinc-600 border-b border-white/[0.04] bg-white/[0.01]">
      <span data-testid="tracking-dot" className={`${dotColor} leading-none`}>●</span>
      <span>{stateLabel}:</span>
      <span className="text-zinc-500 truncate max-w-xs">{formatLabel(currentWindow)}</span>
    </div>
  )
}
