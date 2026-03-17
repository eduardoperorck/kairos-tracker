import { useMemo } from 'react'
import { useI18n } from '../i18n'
import { correlateCommitsWithSessions } from '../domain/codeQuality'
import type { GitCommit } from '../domain/codeQuality'
import type { Session } from '../domain/timer'

type Props = {
  commits: GitCommit[]
  sessions: (Session & { dwsScore?: number })[]
}

function pct(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`
}

export function CodeQualityView({ commits, sessions }: Props) {
  const { t } = useI18n()

  const correlation = useMemo(
    () => correlateCommitsWithSessions(commits, sessions),
    [commits, sessions]
  )

  if (commits.length === 0) {
    return (
      <div className="mt-6">
        <h3 className="mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
          {t('codeQuality.title')}
        </h3>
        <p className="text-xs text-zinc-700">{t('codeQuality.empty')}</p>
      </div>
    )
  }

  const { highDws, lowDws, insight } = correlation

  return (
    <div className="mt-6">
      <h3 className="mb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
        {t('codeQuality.title')}
      </h3>

      {insight && (
        <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-xs text-amber-300">{insight}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {/* High DWS */}
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="mb-2 text-[10px] font-medium text-emerald-500 uppercase tracking-wider">
            {t('codeQuality.highDws')} (DWS ≥ 60)
          </p>
          <p className="font-mono text-xl font-semibold text-zinc-100">{highDws.commitCount}</p>
          <p className="text-[10px] text-zinc-600">commits</p>
          <div className="mt-2 space-y-1 text-xs text-zinc-400">
            <div className="flex justify-between">
              <span>Fix rate</span>
              <span className="font-mono text-emerald-400">{pct(highDws.fixRate)}</span>
            </div>
            <div className="flex justify-between">
              <span>Test rate</span>
              <span className="font-mono text-emerald-400">{pct(highDws.testRate)}</span>
            </div>
          </div>
        </div>

        {/* Low DWS */}
        <div className="rounded-lg border border-zinc-700/40 bg-white/[0.02] p-3">
          <p className="mb-2 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
            {t('codeQuality.lowDws')} (DWS {'<'} 60)
          </p>
          <p className="font-mono text-xl font-semibold text-zinc-100">{lowDws.commitCount}</p>
          <p className="text-[10px] text-zinc-600">commits</p>
          <div className="mt-2 space-y-1 text-xs text-zinc-400">
            <div className="flex justify-between">
              <span>Fix rate</span>
              <span className={`font-mono ${lowDws.fixRate > highDws.fixRate * 1.3 ? 'text-red-400' : 'text-zinc-400'}`}>
                {pct(lowDws.fixRate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Test rate</span>
              <span className="font-mono text-zinc-400">{pct(lowDws.testRate)}</span>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-2 text-right text-[10px] text-zinc-700">
        {correlation.totalCommits} total commits analyzed
      </p>
    </div>
  )
}
