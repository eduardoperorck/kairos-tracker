import { useState, useRef, useEffect } from 'react'

type Props = {
  name: string
  onRename: (newName: string) => void
}

export function CategoryName({ name, onRename }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function commitRename() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== name) onRename(trimmed)
    else setDraft(name)
    setEditing(false)
  }

  function cancelRename() {
    setDraft(name)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        aria-label="Rename category"
        className="w-full bg-transparent text-sm font-medium text-zinc-100 outline-none border-b border-zinc-600 focus:border-zinc-400 pb-px transition-colors"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') commitRename()
          if (e.key === 'Escape') cancelRename()
        }}
        onBlur={commitRename}
      />
    )
  }

  return (
    <span
      className="text-sm font-medium text-zinc-200 hover:text-zinc-100 cursor-pointer transition-colors"
      onClick={() => { setEditing(true); setDraft(name) }}
    >
      {name}
    </span>
  )
}
