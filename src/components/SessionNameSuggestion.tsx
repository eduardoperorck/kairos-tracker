import { useState } from 'react'
import { suggestSessionName } from '../domain/sessionNaming'

type Props = {
  titles: string[]
  onAccept: (name: string) => void
  onDismiss: () => void
}

export function SessionNameSuggestion({ titles, onAccept, onDismiss }: Props) {
  const suggestion = suggestSessionName(titles)
  const [custom, setCustom] = useState(suggestion)

  return (
    <div
      role="dialog"
      aria-label="Name this session"
      className="rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-sm"
    >
      <p className="mb-2 text-zinc-400">Name this session:</p>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-zinc-100 outline-none focus:border-white/20"
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onAccept(custom)}
          autoFocus
        />
        <button
          onClick={() => onAccept(custom)}
          className="rounded border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-indigo-300 hover:bg-indigo-500/20 transition-colors"
        >
          Save
        </button>
        <button
          onClick={onDismiss}
          className="rounded border border-white/10 bg-white/3 px-3 py-1 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  )
}
