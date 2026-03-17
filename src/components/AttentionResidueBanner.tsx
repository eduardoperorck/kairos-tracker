import { useEffect, useState } from 'react'
import { computeAttentionResidue, formatResidueCountdown } from '../domain/attentionResidue'

type Props = {
  switchedAt: number | null
  fromCategory: string
}

export function AttentionResidueBanner({ switchedAt, fromCategory }: Props) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (switchedAt === null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [switchedAt])

  if (switchedAt === null) return null

  const state = computeAttentionResidue(switchedAt, fromCategory, now)
  if (!state.settling) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/8 px-4 py-2.5 text-sm text-amber-300"
    >
      <span className="text-base">🧠</span>
      <span className="flex-1">
        Attention residue from <strong>{fromCategory}</strong> — settling in{' '}
        <span className="font-mono">{formatResidueCountdown(state.remainingMs)}</span>
      </span>
    </div>
  )
}
