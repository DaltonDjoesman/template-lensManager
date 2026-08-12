import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { ensureDemoSeed } from './lib/demoData'
import { applyThemePreference, initThemeListeners } from './lib/theme'

applyThemePreference()
initThemeListeners()

registerSW({ immediate: true })

async function boot() {
  try {
    await ensureDemoSeed()
  } catch (err) {
    console.error('First-run demo seed failed:', err)
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
