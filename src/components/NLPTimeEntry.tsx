import { useState } from 'react'
import { callClaudeForParsing, type ParsedTimeEntry } from '../domain/digest'
import { formatElapsed } from '../domain/format'
import { toDateString } from '../domain/timer'
import { useI18n } from '../i18n'

type Props = {
  categories: { id: string; name: string }[]
  apiKey: string | null
  onConfirm: (entry: ParsedTimeEntry) => void | Promise<void>
}

export function NLPTimeEntry({ categories, apiKey, onConfirm }: Props) {
  const { t } = useI18n()
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParsedTimeEntry | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [confirming, setConfirming] = useState(false)

  const today = toDateString(Date.now())

  async function handleParse() {
    if (!text.trim()) return
    setStatus('loading')
    setErrorMsg('')
    try {
      const result = await callClaudeForParsing(text, categories, apiKey, today)
      setParsed(result)
      setStatus('idle')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Parse failed')
      setStatus('error')
    }
  }

  async function handleConfirm() {
    if (!parsed || confirming) return
    setConfirming(true)
    try {
      await onConfirm(parsed)
    } finally {
      setConfirming(false)
      setParsed(null)
      setText('')
    }
  }

  const catName = parsed ? categories.find(c => c.id === parsed.categoryId)?.name ?? parsed.categoryId : ''

  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-white/[0.15] transition-all"
          placeholder={t('nlp.placeholder')}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleParse()}
        />
        <button
          onClick={handleParse}
          disabled={status === 'loading' || !text.trim()}
          className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-100 hover:border-white/[0.15] transition-all disabled:opacity-40"
        >
          {status === 'loading' ? t('nlp.parsing') : t('nlp.parse')}
        </button>
      </div>

      {status === 'error' && (
        <p className="text-xs text-red-400">{errorMsg}</p>
      )}

      {parsed && (
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-3">
          <p className="text-sm text-zinc-300 mb-1">
            <span className="font-medium text-emerald-400">{catName}</span>
            {' · '}{parsed.date}{' · '}{parsed.startHour}:00{' · '}{formatElapsed(parsed.durationMs)}
            {parsed.tag && <span className="ml-2 text-xs text-zinc-500">[{parsed.tag}]</span>}
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="rounded-md border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/[0.12] transition-all disabled:opacity-40"
            >
              {t('nlp.confirm')}
            </button>
            <button
              onClick={() => setParsed(null)}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              {t('nlp.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
