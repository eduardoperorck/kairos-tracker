import { useState, useRef } from 'react'
import { useI18n } from '../i18n'
import { buildPartnerCard, validatePartnerCard } from '../domain/accountability'
import type { PartnerCard } from '../domain/accountability'
import type { Session, Category } from '../domain/timer'
import type { Storage } from '../persistence/storage'

type Props = {
  sessions: Session[]
  categories: Category[]
  storage: Storage
  nickname: string
  weeklyGoalMs?: number
}

const DEBT_COLOR: Record<string, string> = {
  minimal: 'text-emerald-400',
  moderate: 'text-yellow-400',
  high: 'text-orange-400',
  critical: 'text-red-400',
}

export function AccountabilityView({ sessions, categories, storage, nickname, weeklyGoalMs = 0 }: Props) {
  const { t } = useI18n()
  const [partner, setPartner] = useState<PartnerCard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleExport() {
    const card = buildPartnerCard(nickname || 'Anonymous', sessions, categories, weeklyGoalMs)
    const json = JSON.stringify(card, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `accountability-${nickname || 'me'}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const raw = JSON.parse(await file.text())
      const card = validatePartnerCard(raw)
      if (!card) { setError('Invalid partner card file.'); return }
      setPartner(card)
      setError(null)
      await storage.setSetting('accountability_partner', JSON.stringify(card))
    } catch {
      setError('Could not read partner card file.')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div>
      <h3 className="mb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
        {t('accountability.title')}
      </h3>

      <div className="flex gap-2 mb-4">
        <button
          onClick={handleExport}
          className="rounded-md border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-zinc-400 hover:text-zinc-100 hover:border-white/[0.15] transition-all"
        >
          {t('accountability.export')}
        </button>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-zinc-400 hover:text-zinc-100 hover:border-white/[0.15] transition-all"
        >
          {t('accountability.import')}
        </button>
      </div>

      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

      {partner ? (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">👤</span>
              <span className="text-sm font-semibold text-zinc-200">{partner.nickname}</span>
            </div>
            <span className="text-[10px] text-zinc-700">
              {t('accountability.linked')} · {new Date(partner.exportedAt).toLocaleDateString()}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="font-mono text-xl font-semibold text-zinc-100">{partner.dwsAvgThisWeek}</p>
              <p className="text-[10px] text-zinc-600">DWS avg</p>
            </div>
            <div className="text-center">
              <p className="font-mono text-xl font-semibold text-zinc-100">{partner.weeklyGoalPct}%</p>
              <p className="text-[10px] text-zinc-600">weekly goal</p>
            </div>
            <div className="text-center">
              <p className={`text-sm font-medium capitalize ${DEBT_COLOR[partner.focusDebtLevel]}`}>
                {partner.focusDebtLevel}
              </p>
              <p className="text-[10px] text-zinc-600">focus debt</p>
            </div>
          </div>

          {partner.topCategory && (
            <p className="mt-3 text-xs text-zinc-600">
              Top this week: <span className="text-zinc-400">{partner.topCategory}</span>
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-zinc-700">{t('accountability.empty')}</p>
      )}
    </div>
  )
}
