import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initTokens } from './components/business/Preview'
import './styles/global.css'

initTokens()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
