import { useState } from 'react'
import { useI18n } from '../i18n'
import { CategoryItem } from './CategoryItem'
import { EnergyScoreBanner } from './EnergyScoreBanner'
import { NLPTimeEntry } from './NLPTimeEntry'
import { FocusDebtBanner } from './FocusDebtBanner'
import { AttentionResidueBanner } from './AttentionResidueBanner'
import { InputIntelligenceWidget } from './InputIntelligenceWidget'
import { DeadTimeRecoveryWidget } from './DeadTimeRecoveryWidget'
import { SessionNameSuggestion } from './SessionNameSuggestion'
import { computeWeekMs } from '../domain/timer'
import { getLastSessionDate, suggestWeeklyGoal } from '../domain/history'
import type { Category, Session } from '../domain/timer'
import type { CategoryInsights } from './CategoryItem'
import type { ParsedTimeEntry } from '../domain/digest'
import type { Storage } from '../persistence/storage'
import type { InputActivity } from '../domain/inputIntelligence'
import type { CaptureBlock } from '../domain/passiveCapture'

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
  onAdd: () => void
  onStart: (id: string) => void
  onStop: (id: string, tag?: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  onSetGoal: (id: string, ms: number) => void
  onSetColor: (id: string, color: string) => void
  onSetTag: (id: string, tag: string) => void
  onFocusLock: () => void
  onNLPConfirm: (entry: ParsedTimeEntry) => Promise<void>
  storage: Storage
  // N1 Attention Residue
  switchedAt?: number | null
  switchedFromCategory?: string
  // N5 Dead Time Recovery
  idleMs?: number
  // N7 Input Intelligence
  inputActivity?: InputActivity
  // N4 Session Naming (window titles from passive capture)
  captureBlocks?: CaptureBlock[]
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
  onAdd,
  onStart,
  onStop,
  onDelete,
  onRename,
  onSetGoal,
  onSetColor,
  onSetTag,
  onFocusLock,
  onNLPConfirm,
  switchedAt = null,
  switchedFromCategory = '',
  idleMs = 0,
  inputActivity,
  captureBlocks = [],
}: TrackerViewProps) {
  const { t } = useI18n()
  const [pendingStop, setPendingStop] = useState<string | null>(null)
  const [deadTimeDismissed, setDeadTimeDismissed] = useState(false)

  function handleStopRequest(id: string) {
    setPendingStop(id)
  }

  function confirmStop(name?: string) {
    if (!pendingStop) return
    onStop(pendingStop, name)
    setPendingStop(null)
  }

  const windowTitles = captureBlocks.map(b => b.title)

  return (
    <>
      {/* N1 Attention Residue Banner */}
      <AttentionResidueBanner switchedAt={switchedAt} fromCategory={switchedFromCategory} />

      {/* N4 Session Name Suggestion overlay */}
      {pendingStop && (
        <div className="mb-4">
          <SessionNameSuggestion
            titles={windowTitles}
            onAccept={name => confirmStop(name)}
            onDismiss={() => confirmStop(undefined)}
          />
        </div>
      )}

      {/* N5 Dead Time Recovery */}
      {activeCategory && !deadTimeDismissed && (
        <div className="mb-4">
          <DeadTimeRecoveryWidget
            idleMs={idleMs}
            onSelectTask={task => { onSetTag(activeCategory.id, task.text); setDeadTimeDismissed(true) }}
            onDismiss={() => setDeadTimeDismissed(true)}
          />
        </div>
      )}

      {/* Add category */}
      <div className="mb-6 flex gap-2">
        <input
          className="flex-1 rounded-lg border border-white/[0.07] bg-white/3 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-white/15 focus:bg-white/5 transition-all"
          placeholder={t('tracker.placeholder')}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onAdd()}
        />
        <button
          className="rounded-lg border border-white/[0.07] bg-white/3 px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-100 hover:border-white/15 transition-all"
          onClick={onAdd}
        >
          {t('tracker.add')}
        </button>
      </div>

      <FocusDebtBanner sessions={historySessions} breakSkipCount={breakSkipCount} />

      <EnergyScoreBanner sessions={historySessions} />

      {claudeApiKey && categories.length > 0 && (
        <div className="mb-4">
          <NLPTimeEntry
            categories={categories}
            apiKey={claudeApiKey}
            onConfirm={onNLPConfirm}
          />
        </div>
      )}

      {/* Category list — 2 columns on large screens */}
      <ul className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
        {categories.map(category => (
          <CategoryItem
            key={category.id}
            category={category}
            weeklyMs={computeWeekMs(sessions, category.id, weekDates)}
            lastTracked={getLastSessionDate(historySessions, category.id)}
            insights={categoryInsights[category.id]}
            suggestedMs={suggestWeeklyGoal(historySessions, category.id)}
            onStart={() => onStart(category.id)}
            onStop={(tag) => tag ? onStop(category.id, tag) : handleStopRequest(category.id)}
            onDelete={() => onDelete(category.id)}
            onRename={newName => onRename(category.id, newName)}
            onSetGoal={ms => onSetGoal(category.id, ms)}
            onSetColor={color => onSetColor(category.id, color)}
            onSetTag={tag => onSetTag(category.id, tag)}
            activeTag={category.pendingTag}
          />
        ))}
      </ul>

      {activeCategory && (
        <div className="mt-4 flex items-center justify-between">
          {inputActivity ? (
            <InputIntelligenceWidget activity={inputActivity} />
          ) : (
            <span />
          )}
          <button
            onClick={onFocusLock}
            className="text-xs text-zinc-700 hover:text-zinc-400 transition-colors"
          >
            {t('tracker.focusLock')}
          </button>
        </div>
      )}

      {categories.length === 0 && (
        <p className="mt-16 text-center text-sm text-zinc-700">
          {t('tracker.empty')}
        </p>
      )}
    </>
  )
}
