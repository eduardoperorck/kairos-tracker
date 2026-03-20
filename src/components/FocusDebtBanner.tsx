import { useMemo } from 'react'
import { computeFocusDebt, getDebtLevel, getDebtColor, buildDebtEventsFromSessions } from '../domain/focusDebt'
import { useI18n } from '../i18n'
import type { Session } from '../domain/timer'

type Props = {
  sessions: Session[]
  breakSkipCount?: number
  breakCompletedCount?: number
}

export function FocusDebtBanner({ sessions, breakSkipCount = 0, breakCompletedCount = 0 }: Props) {
  const { t } = useI18n()
  const debt = useMemo(() => {
    const events = buildDebtEventsFromSessions(sessions, breakSkipCount, breakCompletedCount)
    return computeFocusDebt(events)
  }, [sessions, breakSkipCount, breakCompletedCount])

  const level = getDebtLevel(debt)
  const color = getDebtColor(level)
  const label = t(`focusDebt.${level}` as 'focusDebt.minimal')
  const description = t(`focusDebt.desc.${level}` as 'focusDebt.desc.minimal')

  if (level === 'minimal' && debt <= 0) return null

  return (
    <div className="mb-4 rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{t('focusDebt.title')}</span>
          <span className={`text-xs font-semibold ${color}`}>{label}</span>
          <span className="text-xs text-zinc-700">{debt > 0 ? `+${debt}` : debt} pts</span>
        </div>
      </div>
      <p className="mt-1 text-xs text-zinc-600">{description}</p>
    </div>
  )
}
