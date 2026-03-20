import { useState } from 'react'
import {
  createMVDItem,
  toggleMVDItem,
  isMVDAchieved,
  canAddMVDItem,
  getMVDProgress,
  removeMVDItem,
  MAX_MVD_ITEMS,
} from '../domain/minimumViableDay'
import type { MVDItem } from '../domain/minimumViableDay'
import { useI18n } from '../i18n'

type Props = {
  items: MVDItem[]
  onChange: (items: MVDItem[]) => void
}

export function MVDWidget({ items, onChange }: Props) {
  const { t } = useI18n()
  const [input, setInput] = useState('')
  const achieved = isMVDAchieved(items)
  const canAdd = canAddMVDItem(items)
  const progress = getMVDProgress(items)

  function handleAdd() {
    const text = input.trim()
    if (!text || !canAdd) return
    onChange([...items, createMVDItem(text)])
    setInput('')
  }

  function handleToggle(id: string) {
    onChange(toggleMVDItem(items, id))
  }

  function handleRemove(id: string) {
    onChange(removeMVDItem(items, id))
  }

  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/3 px-4 py-3 text-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div>
            <span className="font-medium text-zinc-300">🎯 {t('mvd.title')}</span>
            <p className="text-xs text-zinc-600 mt-0.5">{t('mvd.subtitle')}</p>
          </div>
          {achieved && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
              ✓ {t('mvd.achieved')}
            </span>
          )}
        </div>
        {items.length > 0 && (
          <span className="text-xs text-zinc-600 font-mono">
            {progress.done}/{progress.total}
          </span>
        )}
      </div>

      {/* Items */}
      {items.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {items.map(item => (
            <li
              key={item.id}
              className="flex items-center gap-2 group"
            >
              <button
                onClick={() => handleToggle(item.id)}
                aria-label={item.done ? 'Mark undone' : 'Mark done'}
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                  item.done
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-zinc-700 hover:border-zinc-500'
                }`}
              >
                {item.done && <span className="text-[10px] leading-none">✓</span>}
              </button>
              <span className={`flex-1 ${item.done ? 'line-through text-zinc-600' : 'text-zinc-300'}`}>
                {item.text}
              </span>
              <button
                onClick={() => handleRemove(item.id)}
                aria-label="Remove"
                className="text-zinc-700 opacity-0 group-hover:opacity-100 hover:text-zinc-400 transition-all"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add input */}
      {canAdd ? (
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border border-white/[0.07] bg-white/3 px-2 py-1 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-white/15"
            placeholder={`Must-do ${items.length + 1} of ${MAX_MVD_ITEMS}…`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button
            onClick={handleAdd}
            disabled={!input.trim()}
            className="rounded border border-white/[0.07] bg-white/3 px-2 py-1 text-xs text-zinc-500 hover:text-zinc-100 hover:border-white/15 disabled:opacity-40 transition-all"
          >
            {t('mvd.add')}
          </button>
        </div>
      ) : (
        <p className="text-xs text-zinc-600">{t('mvd.max')}</p>
      )}
    </div>
  )
}
