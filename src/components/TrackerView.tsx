import { useState, useEffect, useMemo, useRef } from 'react'
import { useI18n } from '../i18n'
import { deriveQuickTags } from '../domain/sessionNaming'
import { CategoryItem } from './CategoryItem'
import { FocusDebtBanner } from './FocusDebtBanner'
import { NLPTimeEntry } from './NLPTimeEntry'
import { ManualTimeEntry } from './ManualTimeEntry'
import { InputIntelligenceWidget } from './InputIntelligenceWidget'
import { DeadTimeRecoveryWidget } from './DeadTimeRecoveryWidget'
import { computeWeekMs } from '../domain/timer'
import { getLastSessionDate, suggestWeeklyGoal } from '../domain/history'
import {
  toggleMVDItem, removeMVDItem,
  isMVDAchieved, getMVDProgress, createMVDItem, canAddMVDItem,
} from '../domain/minimumViableDay'
import type { Category, Session } from '../domain/timer'
import type { CategoryInsights } from './CategoryItem'
import type { ParsedTimeEntry } from '../domain/digest'
import type { Storage } from '../persistence/storage'
import type { InputActivity } from '../domain/inputIntelligence'
import type { UnclassifiedApp } from '../domain/passiveCapture'
import type { ElevationSuggestion } from '../hooks/usePassiveCapture'
import type { MVDItem } from '../domain/minimumViableDay'


export type StoreCategory = Category & { accumulatedMs: number; pendingTag?: string }

// ── M75: Grouped context objects ──────────────────────────────────────────────

export type TimerContext = {
  categories: StoreCategory[]
  sessions: Session[]
  historySessions: Session[]
  weekDates: string[]
  categoryInsights: Record<string, CategoryInsights>
  activeCategory: StoreCategory | undefined
  claudeApiKey: string | null
  breakSkipCount: number
  breakCompletedCount?: number
  onStart: (id: string) => void
  onStop: (id: string, tag?: string) => void
  onArchive: (id: string, archived: boolean) => void
  onRename: (id: string, name: string) => void
  onSetGoal: (id: string, ms: number) => void
  onSetColor: (id: string, color: string) => void
  onSetTag: (id: string, tag: string) => void
  onAdd: () => void
  onNLPConfirm: (entry: ParsedTimeEntry) => Promise<void>
  input: string
  setInput: (v: string) => void
}

export type CaptureContext = {
  unclassifiedProcess?: UnclassifiedApp | null
  unclassifiedWorkspace?: string | null
  elevationSuggestion?: ElevationSuggestion | null
  idleMs?: number
  inputActivity?: InputActivity
  currentWindow?: { process: string; workspace: string | null; domain: string | null } | null
  onAssignProcess?: (process: string, categoryId: string) => void
  onDismissProcess?: (process: string) => void
  onAssignWorkspace?: (workspace: string, categoryId: string) => void
  onDismissWorkspace?: (workspace: string) => void
  onElevateProcess?: (process: string, categoryId: string) => void
  onDismissElevation?: (process: string) => void
}

export type MVDContext = {
  items: MVDItem[]
  onChange: (items: MVDItem[]) => void
}

export type TrackerViewProps = {
  // Grouped contexts (M75)
  timer: TimerContext
  capture: CaptureContext
  mvd?: MVDContext
  // Remaining props that don't fit cleanly into the above groups
  storage: Storage
  onFocusLock: () => void
  // kept for API compat
  switchedAt?: number | null
  switchedFromCategory?: string
  // M105 — notify parent when keyboard shortcut used
  onShortcutUsed?: () => void
  // M73 — allow command palette to open NLP panel
  onOpenNLP?: (fn: () => void) => void
}

export function TrackerView({
  timer,
  capture,
  mvd,
  storage: _storage,
  onFocusLock,
  onShortcutUsed,
  onOpenNLP,
}: TrackerViewProps) {
  // Destructure context objects for convenient local access
  const {
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
    onArchive,
    onRename,
    onSetGoal,
    onSetColor,
    onSetTag,
    onNLPConfirm,
  } = timer

  const {
    idleMs = 0,
    inputActivity,
    unclassifiedWorkspace = null,
    onAssignWorkspace,
    onDismissWorkspace,
    elevationSuggestion = null,
    onElevateProcess,
    onDismissElevation,
    currentWindow = null,
  } = capture

  const mvdItems = mvd?.items ?? []
  const onMVDChange = mvd?.onChange
  const { t } = useI18n()
  const [deadTimeDismissed, setDeadTimeDismissed] = useState(false)

  // M-UX1: track when workspace/elevation were first detected for context display
  const [workspaceDetectedAt, setWorkspaceDetectedAt] = useState<number | null>(null)
  useEffect(() => {
    if (unclassifiedWorkspace) {
      setWorkspaceDetectedAt(prev => prev ?? Date.now())
    } else {
      setWorkspaceDetectedAt(null)
    }
  }, [unclassifiedWorkspace])

  const [elevationDetectedAt, setElevationDetectedAt] = useState<number | null>(null)
  useEffect(() => {
    if (elevationSuggestion) {
      setElevationDetectedAt(prev => prev ?? Date.now())
    } else {
      setElevationDetectedAt(null)
    }
  }, [elevationSuggestion])

  function ageLabel(detectedAt: number | null, justNowKey: 'tracker.detectedJustNow' | 'tracker.activeJustNow', agoKey: 'tracker.detectedAgo' | 'tracker.activeFor'): string {
    if (!detectedAt) return t(justNowKey)
    const n = Math.max(0, Math.round((Date.now() - detectedAt) / 60_000))
    return n === 0 ? t(justNowKey) : t(agoKey).replace('{n}', String(n))
  }
  const [showArchived, setShowArchived] = useState(false)
  const activeCount = categories.filter(c => !c.archived).length
  const effectiveCompact = activeCount >= 7
  const [showNLP, setShowNLP] = useState(false)
  const [logMode, setLogMode] = useState<'ai' | 'manual'>('ai')
  const [addingCategory, setAddingCategory] = useState(false)
  const [mvdInputVisible, setMvdInputVisible] = useState(false)
  const [mvdInputValue, setMvdInputValue] = useState('')

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

  const quickTags = useMemo(() => deriveQuickTags(sessions, ['deep work', 'meeting', 'admin', 'learning']), [sessions])

  function handleStopWithDeferred(id: string) {
    onStop(id) // stop immediately, no modal
    setDeferredTagCatId(id)
    if (deferDismissRef.current) clearTimeout(deferDismissRef.current)
    deferDismissRef.current = setTimeout(() => setDeferredTagCatId(null), 30_000)
  }

  function applyDeferredTag(tag: string | null) {
    if (deferDismissRef.current) clearTimeout(deferDismissRef.current)
    setDeferredTagCatId(null)
    // Tag is applied optimistically; actual session update happens via onSetTag which updates pending tag
    // For already-stopped sessions, we use storage directly — parent handles this via onStop with tag
    // Best effort: just dismiss (tag was already saved by auto-suggest in App.tsx)
    if (tag && deferredTagCatId) onSetTag(deferredTagCatId, tag)
  }

  // Banner priority: deadtime > workspace > elevation > focusdebt (unclassified moved to global overlay in App)
  const showDeadTime = !!activeCategory && !deadTimeDismissed && idleMs >= 3 * 60_000
  const showWorkspace = !showDeadTime && !!unclassifiedWorkspace && !!onAssignWorkspace && !!onDismissWorkspace
  const showElevation = !showDeadTime && !showWorkspace && !!elevationSuggestion && !!onElevateProcess && !!onDismissElevation
  const isRunning = !!activeCategory?.activeEntry
  const showFocusDebt = !showDeadTime && !showWorkspace && !showElevation && !isRunning

  const mvdAchieved = isMVDAchieved(mvdItems)
  const mvdProgress = getMVDProgress(mvdItems)

  return (
    <>
      {/* Single-slot contextual banner */}
      {showDeadTime && (
        <div className="mb-4">
          <DeadTimeRecoveryWidget
            idleMs={idleMs}
            idleContext={currentWindow?.process ?? undefined}
            onSelectTask={task => { onSetTag(activeCategory!.id, task.text); setDeadTimeDismissed(true) }}
            onDismiss={() => setDeadTimeDismissed(true)}
          />
        </div>
      )}

      {showWorkspace && unclassifiedWorkspace && (
        <div className="mb-4 rounded-lg border border-sky-500/20 bg-sky-500/[0.06] px-4 py-3 text-sm">
          <div className="mb-2 text-sky-300">
            <span className="text-zinc-500 mr-1">{t('tracker.workspacePrompt')}</span>
            <span className="font-medium font-mono">'{unclassifiedWorkspace}'</span>
            <span className="text-zinc-600 text-xs ml-1">• {ageLabel(workspaceDetectedAt, 'tracker.detectedJustNow', 'tracker.detectedAgo')}</span>
            <p className="text-xs text-zinc-500 mt-0.5">{t('tracker.workspaceAssign')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.filter(c => !c.archived).map(cat => {
              const processWord = (unclassifiedWorkspace ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
              const catWord = cat.name.toLowerCase().replace(/[^a-z0-9]/g, '')
              const isSimilar = processWord.length > 1 && catWord.length > 1 &&
                (catWord.includes(processWord) || processWord.includes(catWord))
              return (
                <button key={cat.id} onClick={() => onAssignWorkspace!(unclassifiedWorkspace!, cat.id)}
                  className={`rounded border px-3 py-1 text-xs transition-all ${
                    isSimilar
                      ? 'border-sky-400/40 bg-sky-500/25 text-sky-200 hover:text-sky-100 hover:bg-sky-500/35'
                      : 'border-sky-500/30 bg-sky-500/10 text-sky-300 hover:text-sky-100 hover:bg-sky-500/20'
                  }`}>
                  {cat.name}
                </button>
              )
            })}
            <button onClick={() => onDismissWorkspace!(unclassifiedWorkspace)}
              className="rounded border border-white/[0.05] px-3 py-1 text-xs text-zinc-600 hover:text-zinc-400 transition-all">
              {t('tracker.workspaceIgnore')} '{unclassifiedWorkspace}'
            </button>
          </div>
        </div>
      )}

      {showElevation && elevationSuggestion && (
        <div className="mb-4 rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-4 py-3 text-sm">
          <div className="mb-2 text-violet-300">
            <span className="font-medium">{elevationSuggestion.displayName}</span>
            {' '}{t('tracker.autoStart')} <span className="font-medium">{activeCategory?.name}</span>
            {' '}{t('tracker.whenever')}
            <span className="text-zinc-600 text-xs ml-1">• {ageLabel(elevationDetectedAt, 'tracker.activeJustNow', 'tracker.activeFor')}</span>
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
          {quickTags.map(tag => (
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
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-400">{t('tracker.done')}</span>
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
            {mvdItems.length === 0 && !mvdInputVisible && (
              <input
                className="flex-1 min-w-[12rem] rounded border border-dashed border-white/[0.08] bg-transparent px-2 py-1 text-xs text-zinc-500 placeholder-zinc-700 outline-none focus:border-white/[0.15] focus:text-zinc-200 transition-all"
                placeholder={t('tracker.mvdPlaceholder')}
                value={mvdInputValue}
                onChange={e => setMvdInputValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && mvdInputValue.trim()) {
                    onMVDChange([...mvdItems, createMVDItem(mvdInputValue.trim())])
                    setMvdInputValue('')
                  }
                  if (e.key === 'Escape') setMvdInputValue('')
                }}
              />
            )}
            {mvdItems.length > 0 && canAddMVDItem(mvdItems) && !mvdInputVisible && (
              <button
                onClick={() => setMvdInputVisible(true)}
                className="rounded-full border border-dashed border-white/[0.07] px-2 py-1 text-xs text-zinc-700 hover:text-zinc-400 hover:border-white/15 transition-all">
                +
              </button>
            )}
            {mvdItems.length > 0 && mvdInputVisible && (
              <input
                autoFocus
                className="flex-1 min-w-[12rem] rounded border border-white/[0.1] bg-white/[0.02] px-2 py-1 text-xs text-zinc-200 placeholder-zinc-700 outline-none focus:border-white/[0.2] transition-all"
                placeholder={t('tracker.mvdPlaceholder')}
                value={mvdInputValue}
                onChange={e => setMvdInputValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && mvdInputValue.trim()) {
                    onMVDChange([...mvdItems, createMVDItem(mvdInputValue.trim())])
                    setMvdInputValue('')
                    setMvdInputVisible(false)
                  }
                  if (e.key === 'Escape') { setMvdInputValue(''); setMvdInputVisible(false) }
                }}
                onBlur={() => { setMvdInputVisible(false); setMvdInputValue('') }}
              />
            )}
          </div>
        </div>
      )}

      {/* Log session trigger — right-aligned button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowNLP(p => !p)}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-all ${
            showNLP
              ? 'border-white/[0.12] bg-white/[0.05] text-zinc-200'
              : 'border-white/[0.07] text-zinc-500 hover:text-zinc-200 hover:border-white/[0.12]'
          }`}
        >
          <span className="text-[11px] leading-none">+</span>
          {t('tracker.logTimeManual')}
          {!claudeApiKey && (
            <span className="text-zinc-700 text-[10px]" title="AI entry requires an Anthropic API key in Settings">· manual</span>
          )}
        </button>
      </div>

      {/* Time Entry panel */}
      {showNLP && (
        <div className="mb-5">
          {claudeApiKey && (
            <div className="flex items-center gap-1 mb-3">
              <button
                onClick={() => setLogMode('manual')}
                className={`rounded px-3 py-1 text-xs transition-all ${
                  logMode === 'manual'
                    ? 'bg-white/[0.08] text-zinc-200'
                    : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                {t('tracker.logTimeManual')}
              </button>
              <button
                onClick={() => setLogMode('ai')}
                className={`rounded px-3 py-1 text-xs transition-all ${
                  logMode === 'ai'
                    ? 'bg-white/[0.08] text-zinc-200'
                    : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                {t('tracker.logTimeAI')}
              </button>
            </div>
          )}
          {(!claudeApiKey || logMode === 'manual') ? (
            <ManualTimeEntry
              categories={categories.filter(c => !c.archived)}
              onConfirm={entry => { onNLPConfirm(entry); setShowNLP(false) }}
            />
          ) : (
            <NLPTimeEntry categories={categories} apiKey={claudeApiKey} onConfirm={entry => { onNLPConfirm(entry); setShowNLP(false) }} />
          )}
        </div>
      )}

      {/* Category list */}
      <ul className={effectiveCompact ? 'space-y-1.5' : 'space-y-3'}>
        {sortedActive.map((category, idx) => (
          <CategoryItem
            key={category.id}
            category={category}
            weeklyMs={computeWeekMs(sessions, category.id, weekDates)}
            todayMs={sessions.filter(s => s.categoryId === category.id).reduce((sum, s) => sum + (s.endedAt - s.startedAt), 0)}
            lastTracked={getLastSessionDate(historySessions, category.id)}
            insights={categoryInsights[category.id]}
            suggestedMs={suggestWeeklyGoal(historySessions, category.id)}
            onStart={() => onStart(category.id)}
            onStop={(tag) => tag ? onStop(category.id, tag) : handleStopWithDeferred(category.id)}
            onArchive={() => onArchive(category.id, true)}
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
            quickTags={quickTags}
          />
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
              className={`w-full rounded-md border border-dashed border-white/[0.08] px-4 text-xs text-zinc-600 hover:text-zinc-300 hover:border-white/[0.15] transition-all text-center ${effectiveCompact ? 'py-1.5' : 'py-2.5'}`}
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
                    {t('tracker.unarchive')}
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
