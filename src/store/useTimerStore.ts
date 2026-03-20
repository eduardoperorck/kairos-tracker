import { createStore as createZustandStore } from 'zustand/vanilla'
import {
  addCategory as domainAddCategory,
  startCategoryTimer,
  stopCategoryTimer,
  removeCategory,
  renameCategory,
  setWeeklyGoal as domainSetWeeklyGoal,
  setCategoryColor as domainSetCategoryColor,
  setPendingTag as domainSetPendingTag,
  archiveCategory as domainArchiveCategory,
  createStore as createDomainStore,
  type Store,
} from '../domain/store'

type Actions = {
  addCategory: (name: string) => void
  startTimer: (id: string) => void
  stopTimer: (id: string, tag?: string) => void
  deleteCategory: (id: string) => void
  renameCategory: (id: string, newName: string) => void
  setWeeklyGoal: (id: string, ms: number) => void
  setCategoryColor: (id: string, color: string) => void
  setPendingTag: (id: string, tag: string) => void
  archiveCategory: (id: string, archived: boolean) => void
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

  stopTimer(id, tag) {
    set(stopCategoryTimer(get(), id, tag))
  },

  deleteCategory(id) {
    set(removeCategory(get(), id))
  },

  renameCategory(id, newName) {
    set(renameCategory(get(), id, newName))
  },

  setWeeklyGoal(id, ms) {
    set(domainSetWeeklyGoal(get(), id, ms))
  },

  setCategoryColor(id, color) {
    set(domainSetCategoryColor(get(), id, color))
  },

  setPendingTag(id, tag) {
    set(domainSetPendingTag(get(), id, tag))
  },

  archiveCategory(id, archived) {
    set(domainArchiveCategory(get(), id, archived))
  },
}))
