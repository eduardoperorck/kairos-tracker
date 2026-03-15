import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './components/App'
import { createInMemoryStorage } from './persistence/inMemoryStorage'
import type { Storage } from './persistence/storage'

async function resolveStorage(): Promise<Storage> {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    const { createTauriStorage } = await import('./persistence/tauriStorage')
    return createTauriStorage()
  }
  return createInMemoryStorage()
}

resolveStorage().then(storage => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App storage={storage} />
    </StrictMode>
  )
})
