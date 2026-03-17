import { useState, useRef } from 'react'
import { buildDigestPayload, formatDigestPrompt, callDigestAPI } from '../domain/digest'
import type { Category, Session } from '../domain/timer'
import type { Storage } from '../persistence/storage'

type Props = {
  categories: Category[]
  sessions: Session[]
  historySessions: Session[]
  today: string
  storage: Storage
}

export function DigestView({ categories, sessions, historySessions, today, storage }: Props) {
  const [digest, setDigest] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastGeneratedRef = useRef(0)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showKeyInput, setShowKeyInput] = useState(false)

  async function handleGenerate() {
    const now = Date.now()
    if (now - lastGeneratedRef.current < 10_000) return  // 10-second cooldown
    setError(null)
    let apiKey = await storage.getSetting('anthropic_api_key')

    if (!apiKey) {
      setShowKeyInput(true)
      return
    }

    lastGeneratedRef.current = now
    setLoading(true)
    try {
      const payload = buildDigestPayload(categories, sessions, historySessions, today)
      const prompt = formatDigestPrompt(payload)
      const text = await callDigestAPI(prompt, apiKey)
      setDigest(text)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveKey() {
    const key = apiKeyInput.trim()
    if (!key) return
    await storage.setSetting('anthropic_api_key', key)
    setApiKeyInput('')
    setShowKeyInput(false)
    handleGenerate()
  }

  return (
    <div className="mt-8 rounded-lg border border-white/[0.07] bg-white/[0.02] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">AI Weekly Digest</h3>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="rounded-md border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:border-white/[0.15] transition-all disabled:opacity-40"
        >
          {loading ? 'Generating…' : digest ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {showKeyInput && (
        <div className="mb-3 flex gap-2">
          <input
            type="password"
            placeholder="sk-ant-… (stored locally)"
            className="flex-1 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-white/[0.15] transition-all"
            value={apiKeyInput}
            onChange={e => setApiKeyInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
          />
          <button
            onClick={handleSaveKey}
            className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-zinc-400 hover:text-zinc-100 transition-all"
          >
            Save & Generate
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {digest ? (
        <p className="text-sm text-zinc-300 leading-relaxed">{digest}</p>
      ) : !loading && !showKeyInput && !error && (
        <p className="text-xs text-zinc-700">Click Generate to get an AI-powered summary of your week.</p>
      )}
    </div>
  )
}
