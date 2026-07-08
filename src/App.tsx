import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { AppRoutes } from './router'
import ProfileCompletionGate from './components/feature/ProfileCompletionGate'
import ErrorBoundary from './components/feature/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter basename={__BASE_PATH__}>
        <ProfileCompletionGate>
          <AppRoutes />
        </ProfileCompletionGate>
        <Analytics />
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App