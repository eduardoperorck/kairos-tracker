import { useState } from 'react'
import type { Intention, EveningReview } from '../domain/intentions'

type Props = {
  intentions: Intention[]
  review: EveningReview | null
  onAddIntention: (text: string) => void
  onSaveReview: (mood: 1 | 2 | 3 | 4 | 5, notes: string) => void
}

export function IntentionsView({ intentions, review, onAddIntention, onSaveReview }: Props) {
  const [newText, setNewText] = useState('')
  const [done, setDone] = useState<Set<number>>(new Set())
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5>(review?.mood ?? 3)
  const [notes, setNotes] = useState(review?.notes ?? '')

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
      {/* Morning brief */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-zinc-200">Today's Intentions</h2>

        <div className="mb-4 flex gap-2">
          <input
            className="flex-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-white/[0.15] focus:bg-white/[0.05] transition-all"
            placeholder="What do you intend to accomplish today?"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button
            className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-100 hover:border-white/[0.15] transition-all"
            onClick={handleAdd}
          >
            Add
          </button>
        </div>

        {intentions.length === 0 ? (
          <p className="text-sm text-zinc-700">No intentions set yet.</p>
        ) : (
          <ul className="space-y-2">
            {intentions.map((intention, idx) => (
              <li key={idx} className="flex items-center gap-3">
                <button
                  aria-label={done.has(idx) ? 'Mark undone' : 'Mark done'}
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
        <h2 className="mb-4 text-sm font-semibold text-zinc-200">Evening Review</h2>

        <div className="mb-4">
          <p className="mb-2 text-xs text-zinc-500">How was your day?</p>
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
          placeholder="Notes about your day..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />

        <button
          className="mt-3 rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-100 hover:border-white/[0.15] transition-all"
          onClick={() => onSaveReview(mood, notes)}
        >
          Save Review
        </button>

        {review && (
          <p className="mt-2 text-xs text-zinc-600">Last saved: mood {review.mood}/5</p>
        )}
      </section>
    </div>
  )
}
