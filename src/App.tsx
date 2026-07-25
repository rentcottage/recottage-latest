import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { AppRoutes } from './router'
import ProfileCompletionGate from './components/feature/ProfileCompletionGate'
import ErrorBoundary from './components/feature/ErrorBoundary'
import { I18nProvider } from './i18n'

function App() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <BrowserRouter basename={__BASE_PATH__}>
          <ProfileCompletionGate>
            <AppRoutes />
          </ProfileCompletionGate>
          <Analytics />
        </BrowserRouter>
      </I18nProvider>
    </ErrorBoundary>
  )
}

export default App