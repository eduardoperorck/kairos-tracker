import { useEffect } from 'react'
import { useElapsed } from '../hooks/useElapsed'
import { CircularTimer } from './CircularTimer'
import { isFlowSession } from '../domain/history'
import { useI18n } from '../i18n'

const DEFAULT_CYCLE_MS = 52 * 60_000 // 52 min default

type Props = {
  categoryName: string
  startedAt: number
  cycleMs?: number
  onExit: () => void
}

async function setAlwaysOnTop(enabled: boolean): Promise<void> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('set_always_on_top', { enabled })
  } catch {
    // noop in browser mode
  }
}

export function FocusLock({ categoryName, startedAt, cycleMs = DEFAULT_CYCLE_MS, onExit }: Props) {
  const { t } = useI18n()
  const elapsedMs = useElapsed(startedAt)
  const flow = isFlowSession({ id: '', categoryId: '', date: '', startedAt, endedAt: startedAt + elapsedMs })

  useEffect(() => {
    setAlwaysOnTop(true)
    return () => { setAlwaysOnTop(false) }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a0a]">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-zinc-600">Focus Lock</p>
      <h1 className="mb-8 text-2xl font-semibold tracking-wide text-zinc-100">{categoryName}</h1>
      <CircularTimer elapsedMs={elapsedMs} cycleMs={cycleMs} isFlow={flow} />
      <button
        onClick={onExit}
        className="mt-12 rounded-lg border border-white/[0.08] bg-white/[0.04] px-6 py-2.5 text-sm text-zinc-500 hover:text-zinc-100 hover:border-white/[0.16] transition-all"
      >
        {t('focusLock.exit')}
      </button>
    </div>
  )
}
