import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AlliancesProvider } from './contexts/AlliancesContext.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AlliancesProvider>
          <App />
        </AlliancesProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
