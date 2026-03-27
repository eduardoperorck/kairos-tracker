import { useState } from 'react'
import { toDateString } from '../domain/timer'
import { useI18n } from '../i18n'
import type { ParsedTimeEntry } from '../domain/digest'

type Props = {
  categories: { id: string; name: string }[]
  onConfirm: (entry: ParsedTimeEntry) => void | Promise<void>
}

export function ManualTimeEntry({ categories, onConfirm }: Props) {
  const { t } = useI18n()
  const today = toDateString(Date.now())

  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [tag, setTag] = useState('')
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)

  function buildEntry(): ParsedTimeEntry | null {
    if (!categoryId) { setError(t('manual.errorNoCategory')); return null }

    const [startH, startM] = startTime.split(':').map(Number)
    const [endH, endM] = endTime.split(':').map(Number)
    const startMs = (startH * 60 + startM) * 60_000
    const endMs = (endH * 60 + endM) * 60_000

    if (endMs <= startMs) { setError(t('manual.errorEndBeforeStart')); return null }

    const durationMs = endMs - startMs
    setError('')

    return {
      categoryId,
      date,
      startHour: startH,
      startMinute: startM,
      durationMs,
      tag: tag.trim() || undefined,
    }
  }

  async function handleConfirm() {
    const entry = buildEntry()
    if (!entry || confirming) return
    setConfirming(true)
    try {
      await onConfirm(entry)
      setTag('')
      setStartTime('09:00')
      setEndTime('10:00')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {/* Category */}
        <div className="col-span-2">
          <label className="block text-xs text-zinc-500 mb-1">{t('manual.category')}</label>
          <select
            className="w-full rounded-lg border border-white/[0.07] bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/[0.15] transition-all"
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
          >
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1">{t('manual.date')}</label>
          <input
            type="date"
            max={today}
            className="w-full rounded-lg border border-white/[0.07] bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/[0.15] transition-all"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        {/* Tag (optional) */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1">{t('manual.tag')} <span className="text-zinc-700">({t('manual.optional')})</span></label>
          <input
            type="text"
            className="w-full rounded-lg border border-white/[0.07] bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-white/[0.15] transition-all"
            placeholder="deep work, meeting…"
            value={tag}
            onChange={e => setTag(e.target.value)}
          />
        </div>

        {/* Start time */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1">{t('manual.start')}</label>
          <input
            type="time"
            className="w-full rounded-lg border border-white/[0.07] bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/[0.15] transition-all"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
          />
        </div>

        {/* End time */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1">{t('manual.end')}</label>
          <input
            type="time"
            className="w-full rounded-lg border border-white/[0.07] bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/[0.15] transition-all"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        onClick={handleConfirm}
        disabled={confirming || !categoryId}
        className="rounded-md border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-2 text-xs font-medium text-emerald-400 hover:bg-emerald-500/[0.12] transition-all disabled:opacity-40"
      >
        {confirming ? '…' : t('nlp.confirm')}
      </button>
    </div>
  )
}
