import { useState } from 'react'
import { useI18n } from '../i18n'
import { MVDWidget } from './MVDWidget'
import type { EveningReview } from '../domain/intentions'
import type { MVDItem } from '../domain/minimumViableDay'

type Props = {
  intentions?: unknown[]  // kept for API compat, no longer rendered
  review: EveningReview | null
  today: string
  onAddIntention?: (text: string) => void
  onSaveReview: (mood: (1 | 2 | 3 | 4 | 5) | undefined, notes: string) => void
  onExportMarkdown?: (doneSet: Set<number>) => void
  mvdItems?: MVDItem[]
  onMVDChange?: (items: MVDItem[]) => void
  draftNotes?: string
}

export function IntentionsView({ review, onSaveReview, onExportMarkdown, mvdItems = [], onMVDChange, draftNotes }: Props) {
  const currentHour = new Date().getHours()
  const { t } = useI18n()
  const [notes, setNotes] = useState(review?.notes ?? draftNotes ?? '')

  return (
    <div className="space-y-8">
      {/* Today's Focus — single unified concept */}
      {onMVDChange && (
        <MVDWidget items={mvdItems} onChange={onMVDChange} />
      )}

      {/* Evening review — only after 5pm or if already saved */}
      {(currentHour >= 17 || !!review) && (
      <section>
        <h2 className="mb-4 text-sm font-semibold text-zinc-200">{t('intentions.eveningTitle')}</h2>

        <textarea
          className="w-full rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-white/[0.15] focus:bg-white/[0.05] transition-all resize-none"
          rows={3}
          placeholder={t('intentions.notesPlaceholder')}
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />

        <div className="mt-3 flex items-center gap-4">
          <button
            className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 hover:border-white/[0.15] transition-all"
            onClick={() => onSaveReview(undefined, notes)}
          >
            {t('intentions.saveReview')}
          </button>

          {onExportMarkdown && (
            <button
              onClick={() => onExportMarkdown(new Set())}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              {t('export.markdown')}
            </button>
          )}

          {review && (
            <span className="ml-auto text-xs text-zinc-700">{t('intentions.lastSaved')}</span>
          )}
        </div>
      </section>
      )}

      {/* Before 5pm hint */}
      {currentHour < 17 && !review && (
        <p className="text-xs text-zinc-700 italic">{t('intentions.eveningOnly')}</p>
      )}
    </div>
  )
}
