import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import type { UndoOperation } from '../hooks/useUndoStack'

const AUTO_DISMISS_MS = 8_000

interface Props {
  operation: UndoOperation | null
  onUndo: () => void
  canUndo: boolean
}

export function UndoToast({ operation, onUndo, canUndo }: Props) {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!operation || !canUndo) { setVisible(false); return }
    setVisible(true)
    const id = setTimeout(() => setVisible(false), AUTO_DISMISS_MS)
    return () => clearTimeout(id)
  }, [operation, canUndo])

  if (!visible || !operation) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg bg-zinc-800 border border-white/10 px-4 py-2 text-sm text-zinc-100 shadow-xl animate-in fade-in slide-in-from-bottom-2"
    >
      <span>{operation.label}</span>
      <button
        onClick={() => { onUndo(); setVisible(false) }}
        className="text-xs font-medium text-sky-400 hover:text-sky-200 transition-colors border border-sky-500/30 rounded px-2 py-0.5"
      >
        {t('undo.label')}
      </button>
    </div>
  )
}
