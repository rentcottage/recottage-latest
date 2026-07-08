import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installGoogleTranslateGuard } from './lib/googleTranslateGuard'

// Must run before React mounts — makes DOM ops resilient to Google Translate's
// node swaps so the booking flow can't white-screen. See the module for details.
installGoogleTranslateGuard()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
