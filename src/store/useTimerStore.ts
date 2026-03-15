import { createStore as createZustandStore } from 'zustand/vanilla'
import {
  addCategory as domainAddCategory,
  startCategoryTimer,
  stopCategoryTimer,
  removeCategory,
  renameCategory,
  createStore as createDomainStore,
  type Store,
} from '../domain/store'

type Actions = {
  addCategory: (name: string) => void
  startTimer: (id: string) => void
  stopTimer: (id: string) => void
  deleteCategory: (id: string) => void
  renameCategory: (id: string, newName: string) => void
}

export type TimerStore = Store & Actions

export const useTimerStore = createZustandStore<TimerStore>((set, get) => ({
  ...createDomainStore(),

  addCategory(name) {
    set(domainAddCategory(get(), name))
  },

  startTimer(id) {
    set(startCategoryTimer(get(), id))
  },

  stopTimer(id) {
    set(stopCategoryTimer(get(), id))
  },

  deleteCategory(id) {
    set(removeCategory(get(), id))
  },

  renameCategory(id, newName) {
    set(renameCategory(get(), id, newName))
  },
}))
