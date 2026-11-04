import '@/styles/globals.css'
import '@fontsource-variable/inter'
import '@fontsource-variable/fraunces'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProviders } from './app/providers'
import { useUiStore } from './store/ui'

// Re-apply the persisted theme after the store rehydrates from localStorage.
useUiStore.getState().setTheme(useUiStore.getState().theme)

const container = document.getElementById('root')
if (!container) throw new Error('Root element not found')

createRoot(container).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>
)
