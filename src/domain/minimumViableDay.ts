export type MVDItem = {
  id: string
  text: string
  done: boolean
  createdAt: number
}

export const MAX_MVD_ITEMS = 3

export function createMVDItem(text: string): MVDItem {
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    done: false,
    createdAt: Date.now(),
  }
}

export function toggleMVDItem(items: MVDItem[], id: string): MVDItem[] {
  return items.map(item => (item.id === id ? { ...item, done: !item.done } : item))
}

export function isMVDAchieved(items: MVDItem[]): boolean {
  return items.length > 0 && items.every(item => item.done)
}

export function canAddMVDItem(items: MVDItem[]): boolean {
  return items.length < MAX_MVD_ITEMS
}

export function getMVDProgress(items: MVDItem[]): { done: number; total: number; pct: number } {
  if (items.length === 0) return { done: 0, total: 0, pct: 0 }
  const done = items.filter(i => i.done).length
  return { done, total: items.length, pct: Math.round((done / items.length) * 100) }
}

export function removeMVDItem(items: MVDItem[], id: string): MVDItem[] {
  return items.filter(item => item.id !== id)
}

export function filterToday(items: MVDItem[], today: string): MVDItem[] {
  return items.filter(item => {
    const d = new Date(item.createdAt)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return dateStr === today
  })
}
