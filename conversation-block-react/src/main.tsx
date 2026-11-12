import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installIconSprite } from './icons/sprite'
import './styles/app.css'

installIconSprite()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
