import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AlliancesProvider } from './contexts/AlliancesContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AlliancesProvider>
        <App />
      </AlliancesProvider>
    </BrowserRouter>
  </StrictMode>,
)
