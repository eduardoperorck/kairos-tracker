import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../i18n'

type View = 'tracker' | 'stats' | 'history' | 'today' | 'settings'

type Command = {
  id: string
  label: string
  action: () => void
}

type Props = {
  categories: { id: string; name: string }[]
  activeId: string | null
  onStart: (id: string) => void
  onStop: () => void
  onNavigate: (view: View) => void
  onClose: () => void
  onOpenNLP?: () => void
  onCyclePreset?: () => void
}

export function CommandPalette({ categories, activeId, onStart, onStop, onNavigate, onClose, onOpenNLP, onCyclePreset }: Props) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Reset selected index when query changes
  useEffect(() => setSelectedIdx(0), [query])

  const activeCategory = categories.find(c => c.id === activeId)

  const commands: Command[] = [
    ...(activeCategory ? [{ id: 'stop', label: `${t('category.stop')} ${activeCategory.name}`, action: onStop }] : []),
    ...categories
      .filter(c => c.id !== activeId)
      .map(c => ({ id: `start-${c.id}`, label: `${t('category.start')} ${c.name}`, action: () => onStart(c.id) })),
    { id: 'nav-stats', label: t('nav.stats'), action: () => onNavigate('stats') },
    { id: 'nav-history', label: t('nav.history'), action: () => onNavigate('history') },
    { id: 'nav-today', label: t('nav.today'), action: () => onNavigate('today') },
    { id: 'nav-settings', label: t('nav.settings'), action: () => onNavigate('settings') },
    { id: 'nav-tracker', label: t('nav.timer'), action: () => onNavigate('tracker') },
    ...(onOpenNLP ? [{ id: 'action-nlp', label: t('palette.logTime'), action: onOpenNLP }] : []),
    ...(onCyclePreset ? [{ id: 'action-cycle-preset', label: t('palette.changePreset'), action: onCyclePreset }] : []),
    { id: 'action-weekly-digest', label: t('palette.weeklyDigest'), action: () => onNavigate('stats') },
    { id: 'action-set-goals', label: t('palette.setGoals'), action: () => onNavigate('today') },
  ]

  const filtered = query.trim()
    ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && filtered[selectedIdx]) {
      filtered[selectedIdx].action()
      onClose()
    }
  }

  function execute(cmd: Command) {
    cmd.action()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-white/[0.1] bg-zinc-900 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="w-full bg-transparent px-5 py-4 text-sm text-zinc-100 placeholder-zinc-600 outline-none border-b border-white/[0.07]"
          placeholder={t('palette.placeholder')}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <ul className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-5 py-3 text-xs text-zinc-600">{t('palette.noResults')}</li>
          ) : (
            filtered.map((cmd, idx) => (
              <li key={cmd.id}>
                <button
                  className={`w-full px-5 py-2.5 text-left text-sm text-zinc-300 hover:bg-white/[0.05] hover:text-zinc-100 transition-colors ${idx === selectedIdx ? 'bg-white/[0.05] text-zinc-200' : ''}`}
                  onClick={() => execute(cmd)}
                >
                  {cmd.label}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
