import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { AppRoutes } from './router'
import ProfileCompletionGate from './components/feature/ProfileCompletionGate'

function App() {
  return (
    <BrowserRouter basename={__BASE_PATH__}>
      <ProfileCompletionGate>
        <AppRoutes />
      </ProfileCompletionGate>
      <Analytics />
    </BrowserRouter>
  )
}

export default App