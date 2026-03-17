import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './components/App'
import { I18nProvider } from './i18n'
import type { Storage } from './persistence/storage'

async function resolveStorage(): Promise<Storage> {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    const { createTauriStorage } = await import('./persistence/tauriStorage')
    return createTauriStorage()
  }
  // Browser fallback: in-memory storage (data not persisted across reloads)
  const { createInMemoryStorage } = await import('./persistence/inMemoryStorage')
  return createInMemoryStorage()
}

resolveStorage().then(storage => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nProvider>
        <App storage={storage} />
      </I18nProvider>
    </StrictMode>
  )
})
