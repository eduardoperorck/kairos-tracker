import { classifyDay } from '../domain/makerManager'
import type { CaptureBlock } from '../domain/passiveCapture'
import { useI18n } from '../i18n'
import type { TKey } from '../i18n'

type Props = {
  blocks: CaptureBlock[]
}

const MODE_STYLES: Record<string, string> = {
  maker: 'border-indigo-500/20 bg-indigo-500/8 text-indigo-300',
  manager: 'border-sky-500/20 bg-sky-500/8 text-sky-300',
  mixed: 'border-violet-500/20 bg-violet-500/8 text-violet-300',
  unknown: 'border-zinc-500/20 bg-zinc-500/8 text-zinc-500',
}

const MODE_ICONS: Record<string, string> = {
  maker: '🔨',
  manager: '📅',
  mixed: '⚖️',
  unknown: '❓',
}

export function MakerManagerBadge({ blocks }: Props) {
  const { t } = useI18n()
  const classification = classifyDay(blocks)

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${MODE_STYLES[classification.mode]}`}>
      <div className="flex items-center gap-2 font-medium">
        <span>{MODE_ICONS[classification.mode]}</span>
        <span>{t(`dayMode.${classification.mode}` as TKey)}</span>
      </div>
      {classification.totalBlocks > 0 && (
        <div className="mt-1.5 flex gap-4 text-xs opacity-70">
          <span>Deep: {classification.makerPct}%</span>
          <span>Short: {classification.managerPct}%</span>
          <span>Longest: {Math.round(classification.longestBlockMs / 60_000)}m</span>
        </div>
      )}
    </div>
  )
}
