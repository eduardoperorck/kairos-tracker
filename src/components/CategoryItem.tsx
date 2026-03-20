import { useState, useRef, useEffect } from 'react'
import { btnPrimary } from './buttonVariants'
import { useElapsed } from '../hooks/useElapsed'
import { formatElapsed, formatRelativeTime } from '../domain/format'
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
  todayMs?: number
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
  onTagLastSession?: (tag: string) => void
  lastSessionUntagged?: boolean
  suggestedMs?: number
  compact?: boolean
  shortcutKey?: number
}

export function CategoryItem({
  category,
  weeklyMs,
  todayMs,
  lastTracked,
  insights,
  onStart,
  onStop,
  onDelete,
  onRename,
  onSetGoal,
  onSetColor,
  onTagLastSession,
  lastSessionUntagged,
  suggestedMs,
  compact,
  shortcutKey,
}: Props) {
  const { t, lang } = useI18n()
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [renameValue, setRenameValue] = useState(category.name)
  const [confirming, setConfirming] = useState(false)
  const [showTagRecovery, setShowTagRecovery] = useState(false)
  const [selectedTag, setSelectedTag] = useState<string | undefined>(undefined)
  const [showTagPicker, setShowTagPicker] = useState(false)
  const overflowRef = useRef<HTMLDivElement>(null)

  const liveMs = useElapsed(category.activeEntry?.startedAt ?? null)
  const totalMs = category.accumulatedMs + liveMs
  const isRunning = category.activeEntry !== null
  const goalMs = category.weeklyGoalMs ?? 0
  const dotColor = category.color ?? '#52525b'

  // Close overflow when clicking outside
  useEffect(() => {
    if (!overflowOpen) return
    function handleClick(e: MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false)
        setConfirming(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [overflowOpen])

  if (compact) {
    return (
      <li className={`flex items-center gap-3 rounded-md border px-3 py-2 transition-all ${
        isRunning ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-white/[0.06] bg-white/[0.01] hover:border-white/[0.1]'
      }`}>
        {shortcutKey && (
          <span className="text-[9px] text-zinc-700 font-mono w-3 shrink-0">{shortcutKey}</span>
        )}
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
        <span className="flex-1 text-sm text-zinc-200 truncate">{category.name}</span>
        <span className="font-mono text-xs text-zinc-500 tabular-nums">{formatElapsed(totalMs)}</span>
        {isRunning ? (
          <button onClick={() => onStop(selectedTag)}
            className="rounded px-2 py-0.5 text-xs text-emerald-400 hover:text-emerald-200 transition-colors">
            {t('category.stop')}
          </button>
        ) : (
          <button onClick={onStart}
            className="rounded px-2 py-0.5 text-xs text-zinc-500 hover:text-zinc-200 transition-colors">
            {t('category.start')}
          </button>
        )}
      </li>
    )
  }

  return (
    <li className={`group rounded-lg border px-5 py-4 transition-all ${
      isRunning
        ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
        : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.11] hover:bg-white/[0.04]'
    }`}>
      {/* Main row — resting: just name + elapsed + start/stop */}
      <div className="flex items-center gap-4">

        {/* Shortcut key badge */}
        {shortcutKey && (
          <span className="text-[9px] text-zinc-700 font-mono w-3 shrink-0">{shortcutKey}</span>
        )}

        {/* Color dot */}
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />

        {/* Name */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              aria-label="Rename category"
              className="w-full bg-transparent text-sm text-zinc-100 outline-none border-b border-white/20 pb-0.5"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { onRename(renameValue); setEditing(false); setOverflowOpen(false) }
                if (e.key === 'Escape') { setEditing(false); setRenameValue(category.name) }
              }}
              onBlur={() => { onRename(renameValue); setEditing(false); setOverflowOpen(false) }}
            />
          ) : (
            <span className="text-sm text-zinc-200">{category.name}</span>
          )}
          {/* Insights — progressive disclosure on hover */}
          {insights && (insights.streak > 0 || insights.flowCount > 0 || insights.peakHour !== null) && (
            <p className="mt-0.5 text-xs text-zinc-700 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {insights.streak > 0 && <span>{insights.streak}{t('stats.streak')}</span>}
              {insights.peakHour !== null && <span>{t('category.peak')} {insights.peakHour}h</span>}
              {insights.flowCount > 0 && <span>⚡ {insights.flowCount} {t('stats.flow')}</span>}
            </p>
          )}
          {/* Last tracked — shown when stopped and lastTracked is known */}
          {lastTracked && !isRunning && (
            <span className="text-xs text-zinc-700">{t('category.lastTracked')} {formatRelativeTime(lastTracked, Date.now(), lang)}</span>
          )}
        </div>

        {/* Active tag chip — only when running */}
        {isRunning && (
          <div className="relative shrink-0">
            {selectedTag ? (
              <span className="flex items-center gap-1 rounded-full border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 text-xs text-zinc-400">
                {selectedTag}
                <button onClick={() => setSelectedTag(undefined)}
                  className="text-zinc-600 hover:text-zinc-300 transition-colors">×</button>
              </span>
            ) : (
              <button onClick={() => setShowTagPicker(p => !p)}
                className="text-xs text-zinc-700 hover:text-zinc-400 transition-colors">
                + tag
              </button>
            )}
            {showTagPicker && (
              <div className="absolute right-0 top-6 z-10 w-36 rounded-lg border border-white/[0.1] bg-zinc-900 py-1 shadow-lg">
                {PRESET_TAGS.map(tag => (
                  <button key={tag}
                    className={`block w-full px-3 py-1.5 text-left text-xs transition-colors ${
                      selectedTag === tag ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                    onClick={() => { setSelectedTag(tag); setShowTagPicker(false) }}>
                    {tag}
                  </button>
                ))}
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

        {/* Start/Stop button */}
        {isRunning ? (
          <button
            aria-label="Stop"
            className="rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/[0.12] hover:border-red-500/30 transition-all shrink-0"
            onClick={() => { onStop(selectedTag); setSelectedTag(undefined) }}
          >
            {t('category.stop')}
          </button>
        ) : (
          <button
            aria-label="Start"
            className={`${btnPrimary} shrink-0`}
            onClick={onStart}
          >
            {t('category.start')}
          </button>
        )}

        {/* Overflow ··· menu */}
        <div className="relative shrink-0" ref={overflowRef}>
          <button
            aria-label="More options"
            onClick={() => setOverflowOpen(p => !p)}
            className="text-zinc-700 hover:text-zinc-400 transition-colors opacity-0 group-hover:opacity-100 px-1"
          >
            ···
          </button>
          {overflowOpen && (
            <div className="absolute right-0 top-6 z-20 w-44 rounded-lg border border-white/[0.1] bg-zinc-900 py-1 shadow-xl text-xs">
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-zinc-300 hover:bg-white/[0.04] transition-colors"
                onClick={() => { setEditing(true); setOverflowOpen(false) }}
              >
                {t('category.rename')}
              </button>
              {lastSessionUntagged && onTagLastSession && (
                <>
                  {!showTagRecovery ? (
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 text-zinc-400 hover:bg-white/[0.04] transition-colors"
                      onClick={() => setShowTagRecovery(true)}
                    >
                      {t('category.tagLastSession')}
                    </button>
                  ) : (
                    <div className="px-3 py-2">
                      <p className="mb-1.5 text-zinc-600">{t('category.tagLastSessionLabel')}</p>
                      {PRESET_TAGS.map(tag => (
                        <button key={tag}
                          className="block w-full text-left px-1 py-0.5 text-zinc-400 hover:text-zinc-100 transition-colors"
                          onClick={() => { onTagLastSession(tag); setShowTagRecovery(false); setOverflowOpen(false) }}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              <div className="px-3 py-2">
                <p className="mb-1.5 text-zinc-600">{t('category.color')}</p>
                <div className="flex gap-1.5 flex-wrap">
                  {CATEGORY_COLORS.map(c => (
                    <button key={c}
                      className={`w-5 h-5 rounded-full transition-all hover:scale-110 ${category.color === c ? 'ring-2 ring-white/40' : ''}`}
                      style={{ backgroundColor: c }}
                      onClick={() => { onSetColor?.(c); setOverflowOpen(false) }}
                    />
                  ))}
                </div>
              </div>
              <div className="border-t border-white/[0.06] mt-1 pt-1">
                {!confirming ? (
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-red-500/70 hover:text-red-400 hover:bg-white/[0.04] transition-colors"
                    onClick={() => setConfirming(true)}
                  >
                    {t('category.deleteIcon')}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2">
                    <button className="text-red-400 hover:text-red-300 transition-colors font-medium"
                      onClick={() => { onDelete(); setOverflowOpen(false); setConfirming(false) }}>
                      {t('category.confirm')}
                    </button>
                    <span className="text-zinc-700">·</span>
                    <button className="text-zinc-500 hover:text-zinc-300 transition-colors"
                      onClick={() => setConfirming(false)}>
                      {t('category.cancel')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Weekly goal with today's segment — always shown */}
      <CategoryGoal weeklyMs={weeklyMs} goalMs={goalMs} onSetGoal={onSetGoal} suggestedMs={suggestedMs} todayMs={todayMs} />
    </li>
  )
}
