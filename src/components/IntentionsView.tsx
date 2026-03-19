import { useState, useEffect } from 'react'
import { useI18n } from '../i18n'
import { MVDWidget } from './MVDWidget'
import type { Intention, EveningReview } from '../domain/intentions'
import type { MVDItem } from '../domain/minimumViableDay'

type Props = {
  intentions: Intention[]
  review: EveningReview | null
  today: string
  onAddIntention: (text: string) => void
  onSaveReview: (mood: 1 | 2 | 3 | 4 | 5, notes: string) => void
  onExportMarkdown?: (doneSet: Set<number>) => void
  mvdItems?: MVDItem[]
  onMVDChange?: (items: MVDItem[]) => void
  draftNotes?: string // auto-generated summary pre-fill
}

function loadDone(today: string): Set<number> {
  try {
    const raw = localStorage.getItem(`intentions_done_${today}`)
    return raw ? new Set(JSON.parse(raw) as number[]) : new Set()
  } catch { return new Set() }
}

export function IntentionsView({ intentions, review, today, onAddIntention, onSaveReview, onExportMarkdown, mvdItems = [], onMVDChange, draftNotes }: Props) {
  const { t } = useI18n()
  const [newText, setNewText] = useState('')
  const [done, setDone] = useState<Set<number>>(() => loadDone(today))
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5>(review?.mood ?? 3)
  const [notes, setNotes] = useState(review?.notes ?? draftNotes ?? '')

  useEffect(() => {
    localStorage.setItem(`intentions_done_${today}`, JSON.stringify([...done]))
  }, [done, today])

  function handleAdd() {
    const text = newText.trim()
    if (!text) return
    onAddIntention(text)
    setNewText('')
  }

  function toggleDone(idx: number) {
    setDone(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  return (
    <div className="space-y-8">
      {/* Minimum Viable Day */}
      {onMVDChange && (
        <MVDWidget items={mvdItems} onChange={onMVDChange} />
      )}

      {/* Morning brief */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-zinc-200">{t('intentions.title')}</h2>

        <div className="mb-4 flex gap-2">
          <input
            className="flex-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-white/[0.15] focus:bg-white/[0.05] transition-all"
            placeholder={t('intentions.placeholder')}
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button
            className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-100 hover:border-white/[0.15] transition-all"
            onClick={handleAdd}
          >
            {t('intentions.add')}
          </button>
        </div>

        {intentions.length === 0 ? (
          <p className="text-sm text-zinc-700">{t('intentions.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {intentions.map((intention, idx) => (
              <li key={idx} className="flex items-center gap-3">
                <button
                  aria-label={done.has(idx) ? t('intentions.markUndone') : t('intentions.markDone')}
                  onClick={() => toggleDone(idx)}
                  className={`w-4 h-4 rounded border transition-colors shrink-0 ${
                    done.has(idx)
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-zinc-700 hover:border-zinc-500'
                  }`}
                />
                <span className={`text-sm transition-colors ${
                  done.has(idx) ? 'line-through text-zinc-600' : 'text-zinc-300'
                }`}>
                  {intention.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Evening review */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-zinc-200">{t('intentions.eveningTitle')}</h2>

        <div className="mb-4">
          <p className="mb-2 text-xs text-zinc-500">{t('intentions.howWasDay')}</p>
          <div className="flex gap-2">
            {([1, 2, 3, 4, 5] as const).map(n => (
              <button
                key={n}
                aria-label={`Mood ${n}`}
                onClick={() => setMood(n)}
                className={`w-10 h-10 rounded-lg border text-sm transition-all ${
                  mood === n
                    ? 'border-zinc-300 bg-white/[0.08] text-zinc-100'
                    : 'border-zinc-800 text-zinc-600 hover:border-zinc-600 hover:text-zinc-400'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <textarea
          className="w-full rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-white/[0.15] focus:bg-white/[0.05] transition-all resize-none"
          rows={3}
          placeholder={t('intentions.notesPlaceholder')}
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />

        <button
          className="mt-3 rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-100 hover:border-white/[0.15] transition-all"
          onClick={() => onSaveReview(mood, notes)}
        >
          {t('intentions.saveReview')}
        </button>

        {review && (
          <p className="mt-2 text-xs text-zinc-600">{t('intentions.lastSaved')} {review.mood}/5</p>
        )}

        {onExportMarkdown && (
          <button
            onClick={() => onExportMarkdown(done)}
            className="mt-3 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {t('export.markdown')}
          </button>
        )}
      </section>
    </div>
  )
}
