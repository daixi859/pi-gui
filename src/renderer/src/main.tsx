import { bootLog, bootResources } from './boot'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initTokens } from './components/business/Preview'
import { startEngine } from './store/engine'
import './styles/global.css'

// 走到这一行时上面所有 import（React、shiki 之类）都已求值完，差值是整张模块图的解析执行耗时
bootLog('渲染层模块就绪')

initTokens()
// 显式启动：在首帧之前挂上 IPC 订阅，不依赖任何组件的 effect
startEngine()
bootLog('引擎已订阅，发 init 给宿主')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
bootLog('render 已调用')

// 首帧提交后的一刻：和上一行差多少，就是 React 挂载 + 样式计算的开销
requestAnimationFrame(() => {
  bootLog('首帧已提交')
  // 想看资源明细时加 ?bootres（日志会很长）
  if (location.search.includes('bootres')) bootResources()
})
