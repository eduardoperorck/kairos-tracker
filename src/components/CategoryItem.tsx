import { useState, useRef, useEffect } from 'react'
import { useElapsed } from '../hooks/useElapsed'
import { formatElapsed } from '../domain/format'
import type { Category } from '../domain/timer'

type Props = {
  category: Category & { accumulatedMs: number }
  onStart: () => void
  onStop: () => void
  onDelete: () => void
  onRename: (newName: string) => void
}

export function CategoryItem({ category, onStart, onStop, onDelete, onRename }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(category.name)
  const inputRef = useRef<HTMLInputElement>(null)

  const liveMs = useElapsed(category.activeEntry?.startedAt ?? null)
  const totalMs = category.activeEntry ? liveMs : category.accumulatedMs
  const isRunning = category.activeEntry !== null

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function commitRename() {
    const name = draft.trim()
    if (name && name !== category.name) onRename(name)
    else setDraft(category.name)
    setEditing(false)
  }

  function cancelRename() {
    setDraft(category.name)
    setEditing(false)
  }

  return (
    <li className={`flex items-center justify-between rounded-xl border px-5 py-4 transition-colors ${
      isRunning ? 'border-emerald-700 bg-emerald-950' : 'border-zinc-800 bg-zinc-900'
    }`}>
      <div className="flex items-center gap-4 min-w-0">
        <span className={`h-2 w-2 shrink-0 rounded-full ${isRunning ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
        {editing ? (
          <input
            ref={inputRef}
            aria-label="Rename category"
            className="rounded bg-zinc-800 px-2 py-0.5 text-sm font-medium text-zinc-100 outline-none ring-1 ring-zinc-500 focus:ring-emerald-500"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') cancelRename()
            }}
            onBlur={commitRename}
          />
        ) : (
          <span
            className="cursor-pointer text-sm font-medium text-zinc-100 hover:text-white"
            onClick={() => { setEditing(true); setDraft(category.name) }}
          >
            {category.name}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className={`font-mono text-sm tabular-nums ${isRunning ? 'text-emerald-300' : 'text-zinc-500'}`}>
          {formatElapsed(totalMs)}
        </span>

        {confirming ? (
          <>
            <button
              className="rounded-lg border border-red-700 bg-red-900 px-3 py-1.5 text-xs font-medium text-red-200 transition-colors hover:bg-red-800"
              onClick={() => { onDelete(); setConfirming(false) }}
            >
              Confirm
            </button>
            <button
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {isRunning ? (
              <button
                className="rounded-lg border border-red-800 bg-red-950 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-900"
                onClick={onStop}
              >
                Stop
              </button>
            ) : (
              <button
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
                onClick={onStart}
              >
                Start
              </button>
            )}
            <button
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:border-red-900 hover:text-red-400"
              onClick={() => setConfirming(true)}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  )
}
