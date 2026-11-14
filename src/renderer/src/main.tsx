import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initTokens } from 'agent-design/components'
import { startEngine } from './store/engine'
import './styles/global.css'

initTokens()
// 显式启动：在首帧之前挂上 IPC 订阅，不依赖任何组件的 effect
startEngine()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
