import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from './router'
import ProfileCompletionGate from './components/feature/ProfileCompletionGate'

function App() {
  return (
    <BrowserRouter basename={__BASE_PATH__}>
      <ProfileCompletionGate>
        <AppRoutes />
      </ProfileCompletionGate>
    </BrowserRouter>
  )
}

export default App