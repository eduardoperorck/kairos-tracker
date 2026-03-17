import { createCategory, startTimer, getElapsed, createSession, type Category, type Session } from './timer'
export type { Session }

export type Store = {
  categories: (Category & { accumulatedMs: number; pendingTag?: string })[]
  sessions: Session[]
  historySessions: Session[]
  initError?: boolean
}

export function createStore(): Store {
  return { categories: [], sessions: [], historySessions: [] }
}

export function addCategory(store: Store, name: string): Store {
  return {
    ...store,
    categories: [...store.categories, { ...createCategory(name), accumulatedMs: 0 }],
  }
}

export function startCategoryTimer(store: Store, id: string): Store {
  if (!store.categories.find(c => c.id === id)) throw new Error(`Category not found: ${id}`)

  const newSessions: Session[] = []

  const categories = store.categories.map(c => {
    // stop any other running timer
    if (c.id !== id && c.activeEntry !== null) {
      newSessions.push(createSession(c.id, c.activeEntry))
      return { ...c, accumulatedMs: c.accumulatedMs + getElapsed(c.activeEntry), activeEntry: null }
    }
    // start the target timer
    if (c.id === id && c.activeEntry === null) {
      return { ...c, activeEntry: startTimer() }
    }
    return c
  })

  return { ...store, categories, sessions: [...store.sessions, ...newSessions], historySessions: [...store.historySessions, ...newSessions] }
}

export function renameCategory(store: Store, id: string, newName: string): Store {
  if (!store.categories.find(c => c.id === id)) throw new Error(`Category not found: ${id}`)
  return {
    ...store,
    categories: store.categories.map(c =>
      c.id === id ? { ...c, name: newName } : c
    ),
  }
}

export function removeCategory(store: Store, id: string): Store {
  if (!store.categories.find(c => c.id === id)) throw new Error(`Category not found: ${id}`)
  return {
    ...store,
    categories: store.categories.filter(c => c.id !== id),
  }
}

export function setWeeklyGoal(store: Store, id: string, ms: number): Store {
  if (!store.categories.find(c => c.id === id)) throw new Error(`Category not found: ${id}`)
  return {
    ...store,
    categories: store.categories.map(c =>
      c.id === id ? { ...c, weeklyGoalMs: ms } : c
    ),
  }
}

export function setCategoryColor(store: Store, id: string, color: string): Store {
  if (!store.categories.find(c => c.id === id)) throw new Error(`Category not found: ${id}`)
  return {
    ...store,
    categories: store.categories.map(c =>
      c.id === id ? { ...c, color } : c
    ),
  }
}

export function stopCategoryTimer(store: Store, id: string, tag?: string): Store {
  const target = store.categories.find(c => c.id === id)
  if (!target) throw new Error(`Category not found: ${id}`)

  const newSessions: Session[] = []

  const categories = store.categories.map(c => {
    if (c.id === id && c.activeEntry !== null) {
      const resolvedTag = tag ?? c.pendingTag
      const session = createSession(c.id, c.activeEntry)
      newSessions.push(resolvedTag ? { ...session, tag: resolvedTag } : session)
      return { ...c, accumulatedMs: c.accumulatedMs + getElapsed(c.activeEntry), activeEntry: null, pendingTag: undefined }
    }
    return c
  })

  return { ...store, categories, sessions: [...store.sessions, ...newSessions], historySessions: [...store.historySessions, ...newSessions] }
}

export function setPendingTag(store: Store, id: string, tag: string): Store {
  if (!store.categories.find(c => c.id === id)) throw new Error(`Category not found: ${id}`)
  return {
    ...store,
    categories: store.categories.map(c =>
      c.id === id ? { ...c, pendingTag: tag } : c
    ),
  }
}
