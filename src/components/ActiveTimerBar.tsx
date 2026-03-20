import { useElapsed } from '../hooks/useElapsed'
import { formatElapsed } from '../domain/format'
import { useI18n } from '../i18n'

type Props = {
  categoryName: string
  color?: string
  startedAt: number
  onStop: () => void
  presetName?: string
}

export function ActiveTimerBar({ categoryName, color, startedAt, onStop, presetName }: Props) {
  const { t } = useI18n()
  const liveMs = useElapsed(startedAt)
  const dot = color ?? '#10b981'

  return (
    <div
      className="border-b border-white/[0.06] transition-colors"
      style={{ backgroundColor: dot + '12', borderBottomColor: dot + '25' }}
    >
      <div className="mx-auto max-w-xl lg:max-w-3xl xl:max-w-5xl px-6 h-8 flex items-center gap-3">
        <span
          className="h-1.5 w-1.5 rounded-full animate-pulse shrink-0"
          style={{ backgroundColor: dot }}
        />
        <span className="text-xs font-medium text-zinc-200 flex-1 truncate">{categoryName}</span>
        {presetName && <span className="text-[10px] text-zinc-700">{presetName}</span>}
        <span className="font-mono text-xs tabular-nums text-zinc-400">{formatElapsed(liveMs)}</span>
        <button
          onClick={onStop}
          className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors px-1"
        >
          {t('activeTimer.stop')}
        </button>
      </div>
    </div>
  )
}
