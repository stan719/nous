import '@fontsource-variable/geist'
import '@fontsource/instrument-serif/latin.css'
import '@fontsource/instrument-serif/latin-ext.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { installIosGuards } from './lib/ios'
import { useNous } from './store/useNous'
import './styles/index.css'

installIosGuards()
// dostęp do store z konsoli i testów e2e (tylko w trybie deweloperskim)
if (import.meta.env.DEV) Object.assign(window, { nous: useNous })
// poproś przeglądarkę, by nie czyściła danych przy braku miejsca
navigator.storage?.persist?.().catch(() => {})
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
