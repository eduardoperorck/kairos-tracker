import { useState, useRef, useEffect } from 'react'
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
  onArchive: () => void
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
  quickTags?: string[]
}

export function CategoryItem({
  category,
  weeklyMs,
  todayMs,
  lastTracked,
  insights,
  onStart,
  onStop,
  onArchive,
  onRename,
  onSetGoal,
  onSetColor,
  onTagLastSession,
  lastSessionUntagged,
  suggestedMs,
  compact,
  shortcutKey,
  quickTags,
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
      <li className={`flex items-center gap-2.5 rounded px-2.5 py-1.5 transition-all ${
        isRunning ? 'bg-emerald-500/[0.07]' : 'hover:bg-white/[0.03]'
      }`}>
        {shortcutKey && (
          <span className="text-[10px] text-zinc-500 font-mono w-3 shrink-0">{shortcutKey}</span>
        )}
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
        <span className="flex-1 text-xs text-zinc-300 truncate">{category.name}</span>
        <span className={`font-mono text-[11px] tabular-nums ${isRunning ? 'text-emerald-400' : 'text-zinc-500'}`}>{formatElapsed(totalMs)}</span>
        {isRunning ? (
          <button onClick={() => onStop(selectedTag)}
            className="text-[11px] text-red-400/80 hover:text-red-300 transition-colors px-1">
            {t('category.stop')}
          </button>
        ) : (
          <button onClick={onStart}
            className="text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors px-1">
            {t('category.start')}
          </button>
        )}
      </li>
    )
  }

  return (
    <li className={`group/cat relative rounded-lg border transition-all ${
      isRunning
        ? 'border-emerald-500/25 bg-emerald-500/[0.06]'
        : 'border-white/[0.06] hover:border-white/[0.1] hover:bg-white/[0.02]'
    }`}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">

        {shortcutKey && (
          <span className="text-[11px] text-zinc-500 font-mono w-3.5 shrink-0">{shortcutKey}</span>
        )}

        {/* Color dot — tooltip with stats on hover */}
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0 mt-px"
          style={{ backgroundColor: dotColor }}
          title={!isRunning ? ([
            lastTracked ? `${t('category.lastTracked')} ${formatRelativeTime(lastTracked, Date.now(), lang)}` : null,
            insights?.streak && insights.streak > 0 ? `${insights.streak}${t('stats.streak')}` : null,
            insights?.flowCount && insights.flowCount > 0 ? `${insights.flowCount} ${t('stats.flow')}` : null,
            insights?.peakHour !== null && insights?.peakHour !== undefined ? `${t('category.peak')} ${insights.peakHour}h` : null,
          ].filter(Boolean).join(' · ') || undefined) : undefined}
        />

        {/* Name */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5 min-w-0">
          {editing ? (
            <input
              autoFocus
              aria-label="Rename category"
              className="flex-1 bg-transparent text-sm text-zinc-100 outline-none border-b border-white/20"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { onRename(renameValue); setEditing(false); setOverflowOpen(false) }
                if (e.key === 'Escape') { setEditing(false); setRenameValue(category.name) }
              }}
              onBlur={() => { onRename(renameValue); setEditing(false); setOverflowOpen(false) }}
            />
          ) : (
            <span
              className={`text-base truncate transition-colors ${isRunning ? 'text-zinc-100' : 'text-zinc-300'}`}
              onDoubleClick={() => setEditing(true)}
            >
              {category.name}
            </span>
          )}
          {!isRunning && insights && insights.streak > 1 && (
            <span className="shrink-0 text-xs text-zinc-600 font-mono">{insights.streak}d</span>
          )}
        </div>

        {/* Active tag — when running */}
        {isRunning && (
          <div className="relative shrink-0">
            {selectedTag ? (
              <span className="flex items-center gap-1 rounded border border-white/[0.08] px-1.5 py-0.5 text-[10px] text-zinc-500">
                {selectedTag}
                <button onClick={() => setSelectedTag(undefined)}
                  className="text-zinc-700 hover:text-zinc-400 transition-colors leading-none">×</button>
              </span>
            ) : (
              <button onClick={() => setShowTagPicker(p => !p)}
                className="text-[10px] text-zinc-700 hover:text-zinc-400 transition-colors">
                + tag
              </button>
            )}
            {showTagPicker && (
              <div className="absolute right-0 top-5 z-10 w-32 rounded border border-white/[0.08] bg-zinc-950 py-1 shadow-xl">
                {(quickTags ?? PRESET_TAGS).map(tag => (
                  <button key={tag}
                    className={`block w-full px-3 py-1 text-left text-[11px] transition-colors ${
                      selectedTag === tag ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-200'
                    }`}
                    onClick={() => { setSelectedTag(tag); setShowTagPicker(false) }}>
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Elapsed */}
        <span className={`font-mono text-sm tabular-nums shrink-0 transition-colors ${
          isRunning ? 'text-emerald-400' : 'text-zinc-500'
        }`}>
          {formatElapsed(totalMs)}
        </span>

        {/* Start / Stop */}
        {isRunning ? (
          <button
            aria-label="Stop"
            onClick={() => { onStop(selectedTag); setSelectedTag(undefined) }}
            className="shrink-0 rounded-md px-3 py-1 text-sm text-red-400/80 hover:text-red-300 border border-red-500/15 hover:border-red-500/30 transition-all"
          >
            {t('category.stop')}
          </button>
        ) : (
          <button
            aria-label="Start"
            onClick={onStart}
            className="shrink-0 rounded-md px-3 py-1 text-sm text-zinc-400 hover:text-zinc-100 border border-white/[0.07] hover:border-white/[0.15] transition-all"
          >
            {t('category.start')}
          </button>
        )}

        {/* Overflow ··· */}
        <div className="relative shrink-0" ref={overflowRef}>
          <button
            aria-label="More options"
            onClick={() => setOverflowOpen(p => !p)}
            className="text-zinc-600 hover:text-zinc-300 transition-colors px-0.5 text-sm leading-none"
          >
            ···
          </button>
          {overflowOpen && (
            <div className="absolute right-0 top-5 z-20 w-40 rounded border border-white/[0.08] bg-zinc-950 py-1 shadow-xl text-xs">
              <button
                className="flex w-full items-center px-3 py-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.03] transition-colors"
                onClick={() => { setEditing(true); setOverflowOpen(false) }}
              >
                {t('category.rename')}
              </button>
              {lastSessionUntagged && onTagLastSession && (
                <>
                  {!showTagRecovery ? (
                    <button
                      className="flex w-full items-center px-3 py-1.5 text-zinc-500 hover:text-zinc-100 hover:bg-white/[0.03] transition-colors"
                      onClick={() => setShowTagRecovery(true)}
                    >
                      {t('category.tagLastSession')}
                    </button>
                  ) : (
                    <div className="px-3 py-1.5">
                      <p className="mb-1 text-zinc-700 text-[10px]">{t('category.tagLastSessionLabel')}</p>
                      {(quickTags ?? PRESET_TAGS).map(tag => (
                        <button key={tag}
                          className="block w-full text-left py-0.5 text-zinc-500 hover:text-zinc-100 transition-colors"
                          onClick={() => { onTagLastSession(tag); setShowTagRecovery(false); setOverflowOpen(false) }}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              <div className="px-3 py-1.5">
                <p className="mb-1 text-zinc-700 text-[10px]">{t('category.color')}</p>
                <div className="flex gap-1 flex-wrap">
                  {CATEGORY_COLORS.map(c => (
                    <button key={c}
                      className={`w-4 h-4 rounded-full transition-all hover:scale-110 ${category.color === c ? 'ring-1 ring-white/40 ring-offset-1 ring-offset-zinc-950' : ''}`}
                      style={{ backgroundColor: c }}
                      onClick={() => { onSetColor?.(c); setOverflowOpen(false) }}
                    />
                  ))}
                </div>
              </div>
              <div className="border-t border-white/[0.05] mt-1 pt-1">
                {!confirming ? (
                  <button
                    className="flex w-full items-center px-3 py-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.03] transition-colors"
                    onClick={() => setConfirming(true)}
                  >
                    {t('category.archiveIcon')}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <button className="text-zinc-300 hover:text-zinc-100 transition-colors"
                      onClick={() => { onArchive(); setOverflowOpen(false); setConfirming(false) }}>
                      {t('category.confirm')}
                    </button>
                    <span className="text-zinc-700">·</span>
                    <button className="text-zinc-600 hover:text-zinc-400 transition-colors"
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

      {/* Weekly goal bar — flush at bottom, no padding */}
      <CategoryGoal weeklyMs={weeklyMs} goalMs={goalMs} onSetGoal={onSetGoal} suggestedMs={suggestedMs} todayMs={todayMs} />

    </li>
  )
}
