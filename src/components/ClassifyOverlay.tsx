import { useI18n } from '../i18n'
import type { Category } from '../domain/timer'
import type { UnclassifiedApp, CategorySlot } from '../domain/passiveCapture'
import { DEFAULT_CATEGORY_SUGGESTIONS } from '../domain/passiveCapture'

const SLOT_KEYWORDS: Record<CategorySlot, string[]> = {
  work:     ['work', 'trabalho', 'job', 'professional', 'dev', 'code', 'coding'],
  study:    ['study', 'estudo', 'learn', 'aprender', 'course', 'curso'],
  personal: ['personal', 'pessoal', 'life', 'leisure', 'lazer', 'hobby'],
}

function slotMatchesCategory(slot: CategorySlot, name: string): boolean {
  const n = name.toLowerCase()
  return SLOT_KEYWORDS[slot].some(kw => n.includes(kw))
}

interface Props {
  process: UnclassifiedApp
  categories: Category[]
  onAssign: (process: string, categoryId: string) => void
  onDismiss: (process: string) => void
}

export function ClassifyOverlay({ process: app, categories, onAssign, onDismiss }: Props) {
  const { t } = useI18n()

  const suggestedSlot: CategorySlot | null = (() => {
    const procLower = app.process.toLowerCase()
    for (const [ruleId, slot] of Object.entries(DEFAULT_CATEGORY_SUGGESTIONS)) {
      if (procLower.includes(ruleId.replace(/-title$/, '').replace(/-ins$/, ''))) return slot as CategorySlot
    }
    return null
  })()

  const suggestedCategory = suggestedSlot
    ? categories.find(c => slotMatchesCategory(suggestedSlot, c.name)) ?? null
    : null

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl border border-sky-500/30 bg-zinc-900/95 shadow-2xl backdrop-blur-sm p-4 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="flex items-center gap-2 mb-3">
        {app.iconBase64 && (
          <img src={app.iconBase64} alt="" className="h-6 w-6 rounded" aria-hidden="true" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-sky-300 truncate">{app.displayName}</p>
          {app.title && app.title !== app.displayName && (
            <p className="text-[10px] text-zinc-500 truncate">{app.title}</p>
          )}
        </div>
        <button
          onClick={() => onDismiss(app.process)}
          className="text-zinc-600 hover:text-zinc-400 transition-colors text-lg leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>

      <p className="text-xs text-zinc-400 mb-2">{t('tracker.whichCategory')}</p>

      {suggestedCategory && (
        <button
          onClick={() => onAssign(app.process, suggestedCategory.id)}
          className="w-full mb-2 rounded-lg px-3 py-2 text-sm font-medium border border-sky-500/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20 transition-all"
        >
          {suggestedCategory.name}
          <span className="ml-2 text-[10px] text-sky-500 font-normal">sugerido</span>
        </button>
      )}

      <div className="flex flex-wrap gap-1.5">
        {categories
          .filter(c => c.id !== suggestedCategory?.id)
          .map(c => (
            <button
              key={c.id}
              onClick={() => onAssign(app.process, c.id)}
              className="rounded border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-300 hover:text-zinc-100 hover:border-white/20 transition-all"
            >
              {c.name}
            </button>
          ))}
      </div>
    </div>
  )
}
