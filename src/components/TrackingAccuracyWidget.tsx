import type { TrackingAccuracyScore } from '../domain/passiveCapture'
import { useI18n } from '../i18n'

type Props = {
  tas: TrackingAccuracyScore
}

function Ring({ value, color }: { value: number; color: string }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const dash = (Math.min(100, Math.max(0, value)) / 100) * circ
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      {/* Track */}
      <circle cx="36" cy="36" r={r} fill="none" stroke="#27272a" strokeWidth="7" />
      {/* Progress */}
      <circle
        cx="36" cy="36" r={r}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
      />
      <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="700" fill="#f4f4f5">
        {Math.round(value)}
      </text>
    </svg>
  )
}

function Metric({ label, value, unit = '%', color }: {
  label: string; value: number; unit?: string; color: string
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Ring value={value} color={color} />
      <span className="text-[10px] text-zinc-400 text-center leading-tight">{label}</span>
      <span className={`text-xs font-semibold`} style={{ color }}>
        {Math.round(value)}{unit}
      </span>
    </div>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#eab308' : '#f97316'
  const label = score >= 75 ? 'Excellent' : score >= 50 ? 'Good' : 'Needs work'
  return (
    <div className="flex flex-col items-center">
      <Ring value={score} color={color} />
      <span className="mt-1 text-[10px] font-semibold" style={{ color }}>{label}</span>
    </div>
  )
}

export function TrackingAccuracyWidget({ tas }: Props) {
  const { t } = useI18n()

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="mb-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
        {t('stats.trackingAccuracy')}
      </h3>

      <div className="flex items-start gap-6">
        {/* Weekly TAS — main score */}
        <div className="flex flex-col items-center gap-1 min-w-[72px]">
          <ScoreBadge score={tas.weeklyTAS} />
          <span className="text-[10px] text-zinc-500 text-center">Weekly TAS</span>
        </div>

        {/* Divider */}
        <div className="w-px self-stretch bg-zinc-800" />

        {/* Individual metrics */}
        <div className="flex flex-1 justify-around flex-wrap gap-4">
          <Metric
            label={t('stats.autoAccuracy')}
            value={tas.autoAccuracy}
            color="#818cf8"
          />
          <Metric
            label={t('stats.coverage')}
            value={tas.coverage}
            color="#38bdf8"
          />
          <Metric
            label={t('stats.stability')}
            value={tas.stabilityScore}
            color="#34d399"
          />
          <Metric
            label={t('stats.noiseRatio')}
            value={tas.noiseRatio * 100}
            color={tas.noiseRatio < 0.1 ? '#22c55e' : tas.noiseRatio < 0.2 ? '#eab308' : '#f97316'}
          />
        </div>
      </div>

      <p className="mt-3 text-[11px] text-zinc-600 leading-relaxed">
        {t('stats.tasDescription')}
      </p>
    </section>
  )
}
