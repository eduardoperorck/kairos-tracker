import { createCategory, startTimer, getElapsed, type Category } from './timer'

export type Store = {
  categories: (Category & { accumulatedMs: number })[]
}

export function createStore(): Store {
  return { categories: [] }
}

export function addCategory(store: Store, name: string): Store {
  return {
    ...store,
    categories: [...store.categories, { ...createCategory(name), accumulatedMs: 0 }],
  }
}

export function startCategoryTimer(store: Store, id: string): Store {
  if (!store.categories.find(c => c.id === id)) throw new Error(`Category not found: ${id}`)

  return {
    ...store,
    categories: store.categories.map(c => {
      // stop any other running timer
      if (c.id !== id && c.activeEntry !== null) {
        return { ...c, accumulatedMs: c.accumulatedMs + getElapsed(c.activeEntry), activeEntry: null }
      }
      // start the target timer
      if (c.id === id && c.activeEntry === null) {
        return { ...c, activeEntry: startTimer() }
      }
      return c
    }),
  }
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

export function stopCategoryTimer(store: Store, id: string): Store {
  const target = store.categories.find(c => c.id === id)
  if (!target) throw new Error(`Category not found: ${id}`)

  return {
    ...store,
    categories: store.categories.map(c => {
      if (c.id === id && c.activeEntry !== null) {
        return { ...c, accumulatedMs: c.accumulatedMs + getElapsed(c.activeEntry), activeEntry: null }
      }
      return c
    }),
  }
}
