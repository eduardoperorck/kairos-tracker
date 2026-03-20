import { computeBurnoutRisk } from '../domain/burnoutRisk'
import type { Session } from '../domain/timer'
import { useI18n } from '../i18n'
import type { TKey } from '../i18n'

type Props = {
  sessions: Session[]
  today: string
  focusDebtLevel?: 'minimal' | 'moderate' | 'high' | 'critical'
}

const LEVEL_STYLES: Record<string, string> = {
  low: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-300',
  moderate: 'border-yellow-500/20 bg-yellow-500/8 text-yellow-300',
  high: 'border-orange-500/20 bg-orange-500/8 text-orange-300',
  critical: 'border-red-500/20 bg-red-500/8 text-red-400',
}

const LEVEL_ICONS: Record<string, string> = {
  low: '✅',
  moderate: '⚠️',
  high: '🔥',
  critical: '🚨',
}

export function BurnoutRiskBadge({ sessions, today, focusDebtLevel = 'minimal' }: Props) {
  const { t } = useI18n()
  const risk = computeBurnoutRisk(sessions, today, focusDebtLevel)

  return (
    <div
      role="status"
      className={`rounded-lg border px-4 py-3 text-sm ${LEVEL_STYLES[risk.level]}`}
    >
      <div className="flex items-center gap-2 font-medium">
        <span>{LEVEL_ICONS[risk.level]}</span>
        <span>{t('burnout.title')} — <span className="capitalize">{t(`burnout.${risk.level}` as TKey)}</span></span>
        <span className="ml-auto font-mono text-xs opacity-70">{risk.score}/100</span>
      </div>
      {risk.signals.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-xs opacity-80">
          {risk.signals.map(signal => (
            <li key={signal}>• {t(signal as TKey)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
