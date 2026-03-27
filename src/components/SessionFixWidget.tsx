import { useState } from 'react'
import { useI18n } from '../i18n'
import { formatElapsed } from '../domain/format'
import type { Session } from '../domain/timer'

type Category = { id: string; name: string }

type Props = {
  session: Session
  categories: Category[]
  onConfirm: () => void
  onEditTime: (startedAt: number, endedAt: number) => void
  onSplit: (splitDurationMs: number, newCategoryId: string) => void
  onDismiss: () => void
}

type Mode = 'default' | 'edit' | 'split'

function msToTimeInput(ms: number): string {
  const d = new Date(ms)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

function timeInputToMs(base: number, timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  const d = new Date(base)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

export function SessionFixWidget({ session, categories, onConfirm, onEditTime, onSplit, onDismiss }: Props) {
  const { t } = useI18n()
  const [mode, setMode] = useState<Mode>('default')

  // Edit time state
  const [startInput, setStartInput] = useState(() => msToTimeInput(session.startedAt))
  const [endInput, setEndInput] = useState(() => msToTimeInput(session.endedAt))

  // Split state — default split: last 30 min to first other category
  const otherCategories = categories.filter(c => c.id !== session.categoryId)
  const [splitMinutes, setSplitMinutes] = useState(30)
  const [splitCategoryId, setSplitCategoryId] = useState(otherCategories[0]?.id ?? categories[0]?.id ?? '')

  const durationMs = session.endedAt - session.startedAt
  const durationLabel = formatElapsed(durationMs)

  function handleSaveEdit() {
    const newStart = timeInputToMs(session.startedAt, startInput)
    const newEnd = timeInputToMs(session.endedAt, endInput)
    onEditTime(newStart, newEnd)
  }

  function handleApplySplit() {
    onSplit(splitMinutes * 60_000, splitCategoryId)
  }

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/95 p-4 shadow-2xl text-sm animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-medium text-zinc-200">
            {categories.find(c => c.id === session.categoryId)?.name ?? session.categoryId}
            <span className="text-zinc-500 font-normal ml-2">• {durationLabel}</span>
          </p>
          <p className="text-xs text-zinc-600 mt-0.5">
            {msToTimeInput(session.startedAt)} – {msToTimeInput(session.endedAt)}
          </p>
        </div>
        <button
          aria-label={t('sessionFix.dismiss')}
          onClick={onDismiss}
          className="text-zinc-600 hover:text-zinc-400 transition-colors ml-2 shrink-0"
        >
          ✕
        </button>
      </div>

      {mode === 'default' && (
        <div className="flex gap-2">
          <button
            onClick={() => setMode('edit')}
            className="rounded border border-white/[0.07] bg-white/[0.02] px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:border-white/15 transition-all"
          >
            ✏️ {t('sessionFix.editTime')}
          </button>
          <button
            onClick={() => setMode('split')}
            className="rounded border border-white/[0.07] bg-white/[0.02] px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:border-white/15 transition-all"
          >
            ✂️ {t('sessionFix.split')}
          </button>
          <button
            onClick={onConfirm}
            className="ml-auto rounded border border-emerald-500/30 bg-emerald-500/[0.08] px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/15 transition-all"
          >
            ✅ {t('sessionFix.confirm')}
          </button>
        </div>
      )}

      {mode === 'edit' && (
        <div className="space-y-2">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-zinc-500 mb-1" htmlFor="sf-start">{t('sessionFix.start')}</label>
              <input
                id="sf-start"
                type="time"
                value={startInput}
                onChange={e => setStartInput(e.target.value)}
                className="w-full rounded border border-white/[0.07] bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-white/20"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-zinc-500 mb-1" htmlFor="sf-end">{t('sessionFix.end')}</label>
              <input
                id="sf-end"
                type="time"
                value={endInput}
                onChange={e => setEndInput(e.target.value)}
                className="w-full rounded border border-white/[0.07] bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-white/20"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveEdit}
              className="rounded border border-emerald-500/30 bg-emerald-500/[0.08] px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/15 transition-all">
              {t('sessionFix.save')}
            </button>
            <button onClick={() => setMode('default')}
              className="rounded border border-white/[0.07] px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-all">
              ← Back
            </button>
          </div>
        </div>
      )}

      {mode === 'split' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-zinc-400 flex-wrap">
            <input
              type="number"
              min={1}
              max={Math.floor(durationMs / 60_000) - 1}
              value={splitMinutes}
              onChange={e => setSplitMinutes(Number(e.target.value))}
              className="w-16 rounded border border-white/[0.07] bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-white/20"
            />
            <span>{t('sessionFix.splitMinutes')}</span>
            <select
              value={splitCategoryId}
              onChange={e => setSplitCategoryId(e.target.value)}
              className="rounded border border-white/[0.07] bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-white/20"
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <span>{t('sessionFix.splitWas')}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={handleApplySplit}
              className="rounded border border-sky-500/30 bg-sky-500/[0.08] px-3 py-1.5 text-xs text-sky-400 hover:bg-sky-500/15 transition-all">
              {t('sessionFix.applySplit')}
            </button>
            <button onClick={() => setMode('default')}
              className="rounded border border-white/[0.07] px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-all">
              ← Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
