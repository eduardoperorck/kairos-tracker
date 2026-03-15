export type PersistedCategory = {
  id: string
  name: string
  accumulatedMs: number
}

export interface Storage {
  loadCategories(): Promise<PersistedCategory[]>
  saveCategory(id: string, name: string): Promise<void>
  updateAccumulatedMs(id: string, ms: number): Promise<void>
  renameCategory(id: string, newName: string): Promise<void>
  deleteCategory(id: string): Promise<void>
}
