import { useState } from 'react'
import { useElapsed } from '../hooks/useElapsed'
import { formatElapsed, formatRelativeTime } from '../domain/format'
import { CategoryName } from './CategoryName'
import { CategoryGoal } from './CategoryGoal'
import { useI18n } from '../i18n'
import type { Category } from '../domain/timer'

export const CATEGORY_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6']

const PRESET_TAGS = ['deep work', 'meeting', 'admin', 'learning', 'blocked', 'review']

export type CategoryInsights = {
  streak: number
  flowCount: number
  peakHour: number | null
}

type Props = {
  category: Category & { accumulatedMs: number; pendingTag?: string }
  weeklyMs: number
  lastTracked?: number | null
  insights?: CategoryInsights
  onStart: () => void
  onStop: (tag?: string) => void
  onDelete: () => void
  onRename: (newName: string) => void
  onSetGoal: (ms: number) => void
  onSetColor?: (color: string) => void
  onSetTag?: (tag: string) => void
  activeTag?: string
  suggestedMs?: number
}

export function CategoryItem({ category, weeklyMs, lastTracked, insights, onStart, onStop, onDelete, onRename, onSetGoal, onSetColor, suggestedMs }: Props) {
  const { t } = useI18n()
  const [confirming, setConfirming] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [selectedTag, setSelectedTag] = useState<string | undefined>(undefined)
  const [showTagPicker, setShowTagPicker] = useState(false)

  const liveMs = useElapsed(category.activeEntry?.startedAt ?? null)
  const totalMs = category.accumulatedMs + liveMs
  const isRunning = category.activeEntry !== null
  const goalMs = category.weeklyGoalMs ?? 0
  const lastTrackedText = !isRunning && lastTracked ? `${t('category.lastTracked')} ${formatRelativeTime(lastTracked, Date.now())}` : null
  const dotColor = category.color ?? '#52525b' // zinc-600 default

  return (
    <li className={`group rounded-lg border px-5 py-4 transition-all ${
      isRunning
        ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
        : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.11] hover:bg-white/[0.04]'
    }`}>

      {/* Main row */}
      <div className="flex items-center gap-4">

        {/* Color dot */}
        <div className="relative shrink-0">
          <button
            className="w-2.5 h-2.5 rounded-full transition-all hover:scale-125"
            style={{ backgroundColor: dotColor }}
            onClick={() => setShowColorPicker(p => !p)}
            aria-label={t('category.colorLabel')}
          />
          {showColorPicker && (
            <div className="absolute left-0 top-5 z-10 flex gap-1.5 rounded-lg border border-white/[0.1] bg-zinc-900 p-2 shadow-lg">
              {CATEGORY_COLORS.map(c => (
                <button
                  key={c}
                  className={`w-5 h-5 rounded-full transition-all hover:scale-110 ${category.color === c ? 'ring-2 ring-white/40' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => { onSetColor?.(c); setShowColorPicker(false) }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <CategoryName name={category.name} onRename={onRename} />
          {lastTrackedText && (
            <p className="mt-0.5 text-xs text-zinc-700">{lastTrackedText}</p>
          )}
          {insights && (insights.streak > 0 || insights.flowCount > 0 || insights.peakHour !== null) && (
            <p className="mt-0.5 text-xs text-zinc-600 flex gap-2">
              {insights.streak > 0 && <span>{insights.streak}{t('stats.streak')}</span>}
              {insights.peakHour !== null && <span>{t('category.peak')} {insights.peakHour}h</span>}
              {insights.flowCount > 0 && <span>⚡ {insights.flowCount} {t('stats.flow')}</span>}
            </p>
          )}
        </div>

        {/* Tag selector (when running) */}
        {isRunning && (
          <div className="relative shrink-0">
            <button
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              onClick={() => setShowTagPicker(p => !p)}
            >
              {selectedTag ? `[${selectedTag}]` : t('category.addTag')}
            </button>
            {showTagPicker && (
              <div className="absolute right-0 top-6 z-10 w-36 rounded-lg border border-white/[0.1] bg-zinc-900 py-1 shadow-lg">
                {PRESET_TAGS.map(t => (
                  <button
                    key={t}
                    className={`block w-full px-3 py-1.5 text-left text-xs transition-colors ${
                      selectedTag === t ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                    onClick={() => { setSelectedTag(t); setShowTagPicker(false) }}
                  >
                    {t}
                  </button>
                ))}
                {selectedTag && (
                  <button
                    className="block w-full px-3 py-1.5 text-left text-xs text-zinc-600 hover:text-zinc-400"
                    onClick={() => { setSelectedTag(undefined); setShowTagPicker(false) }}
                  >
                    {t('category.clearTag')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Elapsed time */}
        <span className={`font-mono text-sm tabular-nums shrink-0 w-16 text-right transition-colors ${
          isRunning ? 'text-emerald-400' : 'text-zinc-500'
        }`}>
          {formatElapsed(totalMs)}
        </span>

        {/* Actions */}
        {confirming ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors"
              onClick={() => { onDelete(); setConfirming(false) }}
            >
              {t('category.confirm')}
            </button>
            <span className="text-zinc-700">·</span>
            <button
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              onClick={() => setConfirming(false)}
            >
              {t('category.cancel')}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <button
              aria-label="Delete"
              className="text-xs text-zinc-700 hover:text-zinc-400 transition-colors opacity-0 group-hover:opacity-100"
              onClick={() => setConfirming(true)}
            >
              {t('category.delete')}
            </button>
            {isRunning ? (
              <button
                aria-label="Stop"
                className="rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/[0.12] hover:border-red-500/30 transition-all"
                onClick={() => { onStop(selectedTag); setSelectedTag(undefined) }}
              >
                {t('category.stop')}
              </button>
            ) : (
              <button
                aria-label="Start"
                className="rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:border-white/[0.16] hover:bg-white/[0.08] transition-all"
                onClick={onStart}
              >
                {t('category.start')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Weekly goal */}
      <CategoryGoal weeklyMs={weeklyMs} goalMs={goalMs} onSetGoal={onSetGoal} suggestedMs={suggestedMs} />
    </li>
  )
}
