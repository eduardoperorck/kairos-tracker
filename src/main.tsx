import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './components/App'
import { createTauriStorage } from './persistence/tauriStorage'

createTauriStorage().then(storage => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App storage={storage} />
    </StrictMode>
  )
})
