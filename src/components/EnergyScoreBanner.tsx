import { useMemo } from 'react'
import { computeEnergyPattern } from '../domain/history'
import { useI18n } from '../i18n'
import type { Session } from '../domain/timer'

const MIN_SESSIONS = 5

type Props = {
  sessions: Session[]
  currentHour?: number
}

export function EnergyScoreBanner({ sessions, currentHour = new Date().getHours() }: Props) {
  const { t } = useI18n()
  const { peakHours, valleyHours } = useMemo(
    () => computeEnergyPattern(sessions, 30),
    [sessions]
  )

  if (sessions.length < MIN_SESSIONS) return null

  const isPeak = peakHours.includes(currentHour)
  const isValley = valleyHours.includes(currentHour)

  if (!isPeak && !isValley) return null

  if (isPeak) {
    return (
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-3">
        <span className="text-base leading-none mt-0.5">⚡</span>
        <div>
          <p className="text-xs font-medium text-emerald-400">{t('energy.peak')}</p>
          <p className="text-xs text-zinc-600">{t('energy.peakSub')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-zinc-700/40 bg-zinc-800/30 px-4 py-3">
      <span className="text-base leading-none mt-0.5">🌙</span>
      <div>
        <p className="text-xs font-medium text-zinc-400">{t('energy.valley')}</p>
        <p className="text-xs text-zinc-600">{t('energy.valleySub')}</p>
      </div>
    </div>
  )
}
