import { useState, useEffect, useMemo, useRef } from 'react'
import { useI18n } from '../i18n'
import { CategoryItem } from './CategoryItem'
import { FocusDebtBanner } from './FocusDebtBanner'
import { NLPTimeEntry } from './NLPTimeEntry'
import { InputIntelligenceWidget } from './InputIntelligenceWidget'
import { DeadTimeRecoveryWidget } from './DeadTimeRecoveryWidget'
import { computeWeekMs } from '../domain/timer'
import { getLastSessionDate, suggestWeeklyGoal } from '../domain/history'
import {
  toggleMVDItem, removeMVDItem,
  isMVDAchieved, getMVDProgress,
} from '../domain/minimumViableDay'
import type { Category, Session } from '../domain/timer'
import type { CategoryInsights } from './CategoryItem'
import type { ParsedTimeEntry } from '../domain/digest'
import type { Storage } from '../persistence/storage'
import type { InputActivity } from '../domain/inputIntelligence'
import type { CaptureBlock, UnclassifiedApp } from '../domain/passiveCapture'
import type { ElevationSuggestion } from '../hooks/usePassiveCapture'
import type { MVDItem } from '../domain/minimumViableDay'

const QUICK_TAGS = ['deep work', 'meeting', 'admin', 'learning']

export type StoreCategory = Category & { accumulatedMs: number; pendingTag?: string }

export type TrackerViewProps = {
  input: string
  setInput: (v: string) => void
  categories: StoreCategory[]
  sessions: Session[]
  historySessions: Session[]
  weekDates: string[]
  categoryInsights: Record<string, CategoryInsights>
  activeCategory: StoreCategory | undefined
  claudeApiKey: string | null
  breakSkipCount: number
  breakCompletedCount?: number
  onAdd: () => void
  onStart: (id: string) => void
  onStop: (id: string, tag?: string) => void
  onDelete: (id: string) => void
  onArchive: (id: string, archived: boolean) => void
  onRename: (id: string, name: string) => void
  onSetGoal: (id: string, ms: number) => void
  onSetColor: (id: string, color: string) => void
  onSetTag: (id: string, tag: string) => void
  onFocusLock: () => void
  onNLPConfirm: (entry: ParsedTimeEntry) => Promise<void>
  storage: Storage
  // kept for API compat
  switchedAt?: number | null
  switchedFromCategory?: string
  // N5 Dead Time Recovery
  idleMs?: number
  // N7 Input Intelligence
  inputActivity?: InputActivity
  // N4 Session Naming
  captureBlocks?: CaptureBlock[]
  // P1 Unclassified process prompt
  unclassifiedProcess?: UnclassifiedApp | null
  onAssignProcess?: (process: string, categoryId: string) => void
  onDismissProcess?: (process: string) => void
  // B2 Elevation suggestion
  elevationSuggestion?: ElevationSuggestion | null
  onElevateProcess?: (process: string, categoryId: string) => void
  onDismissElevation?: (process: string) => void
  // MVD goals at top
  mvdItems?: MVDItem[]
  onMVDChange?: (items: MVDItem[]) => void
  // M105 — notify parent when keyboard shortcut used
  onShortcutUsed?: () => void
  // M73 — allow command palette to open NLP panel
  onOpenNLP?: (fn: () => void) => void
}

export function TrackerView({
  input,
  setInput,
  categories,
  sessions,
  historySessions,
  weekDates,
  categoryInsights,
  activeCategory,
  claudeApiKey,
  breakSkipCount,
  breakCompletedCount = 0,
  onAdd,
  onStart,
  onStop,
  onDelete,
  onArchive,
  onRename,
  onSetGoal,
  onSetColor,
  onSetTag,
  onFocusLock,
  onNLPConfirm,
  idleMs = 0,
  inputActivity,
  captureBlocks = [],
  unclassifiedProcess = null,
  onAssignProcess,
  onDismissProcess,
  elevationSuggestion = null,
  onElevateProcess,
  onDismissElevation,
  mvdItems = [],
  onMVDChange,
  onShortcutUsed,
  onOpenNLP,
}: TrackerViewProps) {
  const { t } = useI18n()
  const [deadTimeDismissed, setDeadTimeDismissed] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const activeCount = categories.filter(c => !c.archived).length
  const effectiveCompact = activeCount >= 5
  const [showNLP, setShowNLP] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)

  // M73: expose setShowNLP to parent so command palette can open NLP panel
  useEffect(() => {
    onOpenNLP?.(() => setShowNLP(true))
  }, [onOpenNLP])

  // Cleanup deferred tag dismiss timeout on unmount
  useEffect(() => {
    return () => {
      if (deferDismissRef.current) clearTimeout(deferDismissRef.current)
    }
  }, [])
  const ghostInputRef = useRef<HTMLInputElement>(null)

  // Deferred tag bar state
  const [deferredTagCatId, setDeferredTagCatId] = useState<string | null>(null)
  const deferDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keys 1–9 start/stop corresponding category
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const digit = parseInt(e.key)
      if (digit >= 1 && digit <= 9) {
        const cat = categories.filter(c => !c.archived)[digit - 1]
        if (!cat) return
        if (cat.activeEntry) {
          onStop(cat.id)
        } else {
          onStart(cat.id)
          onShortcutUsed?.()
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [categories, onStart, onStop, onShortcutUsed])

  // Focus ghost input when expanding
  useEffect(() => {
    if (addingCategory) ghostInputRef.current?.focus()
  }, [addingCategory])

  // Stable timestamp for the current render cycle — avoids Date.now() in render path
  const now = useMemo(() => Date.now(), [])

  // Auto-sort active categories by last tracked date (most recent first)
  const sortedActive = useMemo(() => {
    const active = categories.filter(c => !c.archived)
    const lastTrackedMap = new Map(
      active.map(c => [c.id, getLastSessionDate(historySessions, c.id) ?? 0])
    )
    // Running category always first
    return [...active].sort((a, b) => {
      if (a.activeEntry && !b.activeEntry) return -1
      if (!a.activeEntry && b.activeEntry) return 1
      return (lastTrackedMap.get(b.id) ?? 0) - (lastTrackedMap.get(a.id) ?? 0)
    })
  }, [categories, historySessions])

  function handleStopWithDeferred(id: string) {
    onStop(id) // stop immediately, no modal
    setDeferredTagCatId(id)
    if (deferDismissRef.current) clearTimeout(deferDismissRef.current)
    deferDismissRef.current = setTimeout(() => setDeferredTagCatId(null), 5_000)
  }

  function applyDeferredTag(tag: string | null) {
    if (deferDismissRef.current) clearTimeout(deferDismissRef.current)
    setDeferredTagCatId(null)
    // Tag is applied optimistically; actual session update happens via onSetTag which updates pending tag
    // For already-stopped sessions, we use storage directly — parent handles this via onStop with tag
    // Best effort: just dismiss (tag was already saved by auto-suggest in App.tsx)
    if (tag && deferredTagCatId) onSetTag(deferredTagCatId, tag)
  }

  // Banner priority: deadtime > unclassified > elevation > focusdebt
  const showDeadTime = !!activeCategory && !deadTimeDismissed && idleMs >= 3 * 60_000
  const showUnclassified = !showDeadTime && !!unclassifiedProcess && !!onAssignProcess && !!onDismissProcess
  const showElevation = !showDeadTime && !showUnclassified && !!elevationSuggestion && !!onElevateProcess && !!onDismissElevation
  const isRunning = !!activeCategory?.activeEntry
  const showFocusDebt = !showDeadTime && !showUnclassified && !showElevation && !isRunning

  const mvdAchieved = isMVDAchieved(mvdItems)
  const mvdProgress = getMVDProgress(mvdItems)

  return (
    <>
      {/* Single-slot contextual banner */}
      {showDeadTime && (
        <div className="mb-4">
          <DeadTimeRecoveryWidget
            idleMs={idleMs}
            onSelectTask={task => { onSetTag(activeCategory!.id, task.text); setDeadTimeDismissed(true) }}
            onDismiss={() => setDeadTimeDismissed(true)}
          />
        </div>
      )}

      {showUnclassified && (
        <div className="mb-4 rounded-lg border border-sky-500/20 bg-sky-500/[0.06] px-4 py-3 text-sm">
          <div className="mb-2 flex items-center gap-2">
            {unclassifiedProcess!.iconBase64 && (
              <img src={unclassifiedProcess!.iconBase64} alt="" className="h-6 w-6 rounded" aria-hidden="true" />
            )}
            <span className="font-medium text-sky-300">{unclassifiedProcess!.displayName}</span>
            <span className="text-sky-600 text-xs">({unclassifiedProcess!.process})</span>
            <span className="text-sky-500">{t('tracker.whichCategory')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.filter(c => !c.archived).map(c => (
              <button key={c.id} onClick={() => onAssignProcess!(unclassifiedProcess!.process, c.id)}
                className="rounded border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-zinc-300 hover:text-zinc-100 hover:border-white/20 transition-all">
                {c.name}
              </button>
            ))}
            <button onClick={() => onDismissProcess!(unclassifiedProcess!.process)}
              className="rounded border border-white/[0.05] px-3 py-1 text-xs text-zinc-600 hover:text-zinc-400 transition-all">
              {t('tracker.ignore')}
            </button>
          </div>
        </div>
      )}

      {showElevation && elevationSuggestion && (
        <div className="mb-4 rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-4 py-3 text-sm">
          <div className="mb-2 text-violet-300">
            <span className="font-medium">{elevationSuggestion.displayName}</span>
            {' '}is open — {t('tracker.autoStart')} <span className="font-medium">{activeCategory?.name}</span> {t('tracker.whenever')}
          </div>
          <div className="flex gap-2">
            <button onClick={() => onElevateProcess!(elevationSuggestion.process, elevationSuggestion.categoryId)}
              className="rounded border border-violet-500/30 bg-violet-500/15 px-3 py-1 text-xs text-violet-300 hover:text-violet-100 transition-all">
              {t('tracker.yesAlways')}
            </button>
            <button onClick={() => onDismissElevation!(elevationSuggestion.process)}
              className="rounded border border-white/[0.05] px-3 py-1 text-xs text-zinc-600 hover:text-zinc-400 transition-all">
              {t('tracker.notNow')}
            </button>
          </div>
        </div>
      )}

      {showFocusDebt && <FocusDebtBanner sessions={historySessions} breakSkipCount={breakSkipCount} breakCompletedCount={breakCompletedCount} />}

      {/* Deferred tag bar — appears after stopping a timer */}
      {deferredTagCatId && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-xs animate-in fade-in">
          <span className="text-zinc-500 shrink-0">{t('tracker.tagQuestion')}</span>
          {QUICK_TAGS.map(tag => (
            <button key={tag} onClick={() => applyDeferredTag(tag)}
              className="rounded border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-zinc-400 hover:text-zinc-100 hover:border-white/15 transition-all">
              {tag}
            </button>
          ))}
          <button onClick={() => applyDeferredTag(null)}
            className="ml-auto text-zinc-700 hover:text-zinc-500 transition-colors">
            {t('tracker.skipTag')}
          </button>
        </div>
      )}

      {/* MVD inline chips — today's must-do goals */}
      {onMVDChange && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{t('tracker.todaysGoals')}</span>
            {mvdItems.length > 0 && (
              <span className="text-xs text-zinc-600 font-mono">{mvdProgress.done}/{mvdProgress.total}</span>
            )}
            {mvdAchieved && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-400">✓ Done</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {mvdItems.map(item => (
              <span key={item.id}
                className={`group flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-all cursor-pointer ${
                  item.done
                    ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400/60 line-through'
                    : 'border-white/[0.07] bg-white/[0.02] text-zinc-300 hover:border-white/15'
                }`}
                onClick={() => onMVDChange(toggleMVDItem(mvdItems, item.id))}>
                {item.done && <span className="text-emerald-500 text-[10px]">✓</span>}
                {item.text}
                <button onClick={e => { e.stopPropagation(); onMVDChange(removeMVDItem(mvdItems, item.id)) }}
                  className="ml-0.5 opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-zinc-400 transition-all">
                  ×
                </button>
              </span>
            ))}
            {mvdItems.length === 0 && (
              <span className="text-xs text-zinc-700 italic">{t('tracker.noGoalsHint')}</span>
            )}
          </div>
        </div>
      )}

      {/* Controls row — NLP (always visible; AI indicator when API key is set) */}
      <div className="mb-5 flex items-center justify-end gap-2">
        <button onClick={() => setShowNLP(v => !v)}
          className={`rounded border px-2 py-1 text-xs transition-all ${
            showNLP
              ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400'
              : 'border-white/[0.06] text-zinc-600 hover:text-zinc-300'
          }`}
          title="Log time with natural language">
          {claudeApiKey ? `${t('tracker.logTime')} (AI)` : t('tracker.logTime')}
        </button>
      </div>

      {/* NLP Time Entry — expandable; API key required to actually run */}
      {showNLP && (
        <div className="mb-5">
          {claudeApiKey
            ? <NLPTimeEntry categories={categories} apiKey={claudeApiKey} onConfirm={onNLPConfirm} />
            : <p className="text-xs text-zinc-600 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                Set an Anthropic API key in Settings to enable AI-powered natural language entry.
              </p>
          }
        </div>
      )}

      {/* Category list */}
      <ul className={effectiveCompact ? 'space-y-1' : 'space-y-2 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0'}>
        {sortedActive.map((category, idx) => (
          <li key={category.id} className={effectiveCompact ? '' : 'group/cat relative'}>
            <CategoryItem
              category={category}
              weeklyMs={computeWeekMs(sessions, category.id, weekDates)}
              todayMs={sessions.filter(s => s.categoryId === category.id).reduce((sum, s) => sum + (s.endedAt - s.startedAt), 0)}
              lastTracked={getLastSessionDate(historySessions, category.id)}
              insights={categoryInsights[category.id]}
              suggestedMs={suggestWeeklyGoal(historySessions, category.id)}
              onStart={() => onStart(category.id)}
              onStop={(tag) => tag ? onStop(category.id, tag) : handleStopWithDeferred(category.id)}
              onDelete={() => onDelete(category.id)}
              onRename={newName => onRename(category.id, newName)}
              onSetGoal={ms => onSetGoal(category.id, ms)}
              onSetColor={color => onSetColor(category.id, color)}
              onSetTag={tag => onSetTag(category.id, tag)}
              activeTag={category.pendingTag}
              lastSessionUntagged={(() => {
                const last = [...sessions].reverse().find(s => s.categoryId === category.id)
                return !!last && !last.tag
              })()}
              onTagLastSession={tag => onSetTag(category.id, tag)}
              compact={effectiveCompact}
              shortcutKey={idx < 9 ? idx + 1 : undefined}
            />
            {!effectiveCompact && (() => {
              const lastUsed = getLastSessionDate(historySessions, category.id)
              const daysSince = lastUsed ? Math.floor((now - lastUsed) / 86_400_000) : Infinity
              if (daysSince <= 7 || category.activeEntry) return null
              return (
                <button
                  onClick={() => onArchive(category.id, true)}
                  title={`Archive — last used ${daysSince === Infinity ? 'never' : `${daysSince}d ago`}`}
                  className="absolute top-2 right-2 hidden group-hover/cat:inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-700 hover:text-zinc-400 transition-colors"
                >
                  archive · {daysSince === Infinity ? 'never used' : `${daysSince}d ago`}
                </button>
              )
            })()}
          </li>
        ))}

        {/* Ghost card — add category inline */}
        <li>
          {addingCategory ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-white/[0.1] bg-white/[0.01] px-4 py-3">
              <input
                ref={ghostInputRef}
                className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-700 outline-none"
                placeholder={t('tracker.placeholder')}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { onAdd(); setAddingCategory(false) }
                  if (e.key === 'Escape') { setAddingCategory(false); setInput('') }
                }}
                onBlur={() => { if (!input.trim()) setAddingCategory(false) }}
              />
              <button onClick={() => { onAdd(); setAddingCategory(false) }}
                className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors">
                {t('tracker.add')}
              </button>
              <button onClick={() => { setAddingCategory(false); setInput('') }}
                className="text-xs text-zinc-700 hover:text-zinc-500 transition-colors">
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingCategory(true)}
              className={`w-full rounded-lg border border-dashed border-white/[0.06] px-4 text-xs text-zinc-700 hover:text-zinc-400 hover:border-white/[0.12] transition-all text-center ${effectiveCompact ? 'py-2' : 'py-3'}`}
            >
              {t('tracker.addCategory')}
            </button>
          )}
        </li>
      </ul>

      {/* Archived categories */}
      {categories.some(c => c.archived) && (
        <div className="mt-4">
          <button onClick={() => setShowArchived(v => !v)}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            {showArchived ? '▾' : '▸'} {categories.filter(c => c.archived).length} {t('tracker.archived')}
          </button>
          {showArchived && (
            <ul className="mt-2 space-y-1">
              {categories.filter(c => c.archived).map(category => (
                <li key={category.id} className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm text-zinc-500">
                  <span>{category.name}</span>
                  <button onClick={() => onArchive(category.id, false)}
                    className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors">
                    unarchive
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeCategory && (
        <div className="mt-4 flex items-center justify-between">
          {inputActivity && inputActivity.windowMs > 0 ? (
            <InputIntelligenceWidget activity={inputActivity} />
          ) : (
            <span />
          )}
          <button onClick={onFocusLock}
            className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors border border-white/[0.06] rounded px-2 py-1">
            {t('tracker.focusLock')}
          </button>
        </div>
      )}

      {categories.length === 0 && (
        <p className="mt-16 text-center text-sm text-zinc-700">{t('tracker.empty')}</p>
      )}
    </>
  )
}
