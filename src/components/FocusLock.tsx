import { useEffect } from 'react'
import { formatElapsed } from '../domain/format'
import { useElapsed } from '../hooks/useElapsed'

type Props = {
  categoryName: string
  startedAt: number
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

export function FocusLock({ categoryName, startedAt, onExit }: Props) {
  const elapsedMs = useElapsed(startedAt)

  useEffect(() => {
    setAlwaysOnTop(true)
    return () => { setAlwaysOnTop(false) }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a0a]">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-zinc-600">Focus Lock</p>
      <h1 className="mb-6 text-2xl font-semibold tracking-wide text-zinc-100">{categoryName}</h1>
      <span className="font-mono text-6xl tabular-nums text-emerald-400 mb-12">
        {formatElapsed(elapsedMs)}
      </span>
      <button
        onClick={onExit}
        className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-6 py-2.5 text-sm text-zinc-500 hover:text-zinc-100 hover:border-white/[0.16] transition-all"
      >
        Exit Focus Lock
      </button>
    </div>
  )
}
