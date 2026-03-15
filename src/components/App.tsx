import { useState } from 'react'
import { useTimerState } from '../store/useTimerStoreHook'
import { useTimerStore } from '../store/useTimerStore'
import { CategoryItem } from './CategoryItem'
import { StatsView } from './StatsView'
import { useInitStore } from '../hooks/useInitStore'
import { computeStats } from '../domain/stats'
import type { Storage } from '../persistence/storage'

type Props = { storage: Storage }

export function App({ storage }: Props) {
  const { categories, addCategory, startTimer, stopTimer, deleteCategory, renameCategory } = useTimerState()
  const [input, setInput] = useState('')
  const [view, setView] = useState<'tracker' | 'stats'>('tracker')

  useInitStore(storage)

  async function handleAdd() {
    const name = input.trim()
    if (!name) return
    addCategory(name)
    setInput('')
    const { categories: next } = useTimerStore.getState()
    const created = next[next.length - 1]
    await storage.saveCategory(created.id, created.name)
  }

  async function handleStart(id: string) {
    const prev = categories.find(c => c.activeEntry !== null)
    startTimer(id)
    if (prev && prev.id !== id) {
      const { categories: next } = useTimerStore.getState()
      const updated = next.find(c => c.id === prev.id)!
      await storage.updateAccumulatedMs(prev.id, updated.accumulatedMs)
    }
  }

  async function handleRename(id: string, newName: string) {
    renameCategory(id, newName)
    await storage.renameCategory(id, newName)
  }

  async function handleDelete(id: string) {
    deleteCategory(id)
    await storage.deleteCategory(id)
  }

  async function handleStop(id: string) {
    stopTimer(id)
    const { categories: next } = useTimerStore.getState()
    const updated = next.find(c => c.id === id)!
    await storage.updateAccumulatedMs(id, updated.accumulatedMs)
  }

  if (view === 'stats') {
    return <StatsView stats={computeStats(categories)} onBack={() => setView('tracker')} />
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-lg px-4 py-12">

        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-white">Time Tracker</h1>
          <button
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
            onClick={() => setView('stats')}
          >
            Stats →
          </button>
        </div>

        <div className="mb-8 flex gap-2">
          <input
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
            placeholder="Category name"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button
            className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-600 active:bg-zinc-800"
            onClick={handleAdd}
          >
            Add
          </button>
        </div>

        <ul className="space-y-3">
          {categories.map(category => (
            <CategoryItem
              key={category.id}
              category={category}
              onStart={() => handleStart(category.id)}
              onStop={() => handleStop(category.id)}
              onDelete={() => handleDelete(category.id)}
              onRename={newName => handleRename(category.id, newName)}
            />
          ))}
        </ul>

        {categories.length === 0 && (
          <p className="mt-12 text-center text-sm text-zinc-600">
            Add a category to start tracking time.
          </p>
        )}

      </div>
    </div>
  )
}
