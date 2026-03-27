import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../i18n'
import type { ContextBookmark } from '../persistence/storage'

function fuzzyScore(label: string, query: string): number {
  if (!query) return 1
  const l = label.toLowerCase()
  const q = query.toLowerCase()
  if (l === q) return 100
  if (l.includes(q)) return 50

  let score = 0
  let li = 0
  let qi = 0
  let consecutive = 0
  while (li < l.length && qi < q.length) {
    if (l[li] === q[qi]) {
      consecutive++
      // start-of-word bonus
      if (li === 0 || l[li - 1] === ' ' || l[li - 1] === '-' || l[li - 1] === '_') score += 10
      score += consecutive * 2
      qi++
    } else {
      consecutive = 0
    }
    li++
  }
  if (qi < q.length) return 0 // not all chars matched
  return score
}

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
  // M91: Context bookmarks
  bookmarks?: ContextBookmark[]
  onSaveBookmark?: (name: string) => void
  onRestoreBookmark?: (bookmark: ContextBookmark) => void
  onDeleteBookmark?: (id: string) => void
}

export function CommandPalette({ categories, activeId, onStart, onStop, onNavigate, onClose, onOpenNLP, onCyclePreset, bookmarks = [], onSaveBookmark, onRestoreBookmark }: Props) {
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
    // M91: Save bookmark for current active context
    ...(onSaveBookmark && activeId ? [{
      id: 'action-save-bookmark',
      label: t('palette.saveBookmark'),
      action: () => {
        const catName = categories.find(c => c.id === activeId)?.name ?? 'Bookmark'
        onSaveBookmark(`${catName} — ${new Date().toLocaleTimeString()}`)
      },
    }] : []),
    // M91: Restore bookmarks
    ...bookmarks.map(bm => ({
      id: `restore-bm-${bm.id}`,
      label: `${t('palette.restoreBookmark')}: ${bm.name}`,
      action: () => { onRestoreBookmark?.(bm) },
    })),
  ]

  const filtered = (() => {
    const q = query.trim()
    if (!q) return commands
    const isStartPrefix = q.toLowerCase().startsWith('start ')
    const remainder = isStartPrefix ? q.slice(6) : ''
    return commands
      .map(c => {
        let score = fuzzyScore(c.label, q)
        if (score === 0) return null
        // Boost start commands when query begins with "start "
        if (isStartPrefix && c.id.startsWith('start-')) {
          const catNameScore = fuzzyScore(c.label.replace(/^start\s+/i, ''), remainder)
          if (catNameScore > 0) score += 1000 + catNameScore
        }
        return { cmd: c, score }
      })
      .filter((x): x is { cmd: Command; score: number } => x !== null)
      .sort((a, b) => b.score - a.score)
      .map(({ cmd }) => cmd)
  })()

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
