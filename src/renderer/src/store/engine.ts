/**
 * 事件接收入口：把宿主的 AgentEvent 写进 store（store/index.ts），仅此一件事。
 *
 * 订阅放在模块级而不是组件 effect 里（见 docs/adr/0013 的 A′ 方案）：
 * 订阅在 createRoot 之前就位，首帧不会漏事件；HMR 再热重载也不会叠出第二个监听。
 */
import type { AgentEvent } from '@shared/ipc'
import { bootLog } from '../boot'
import { engine, send } from './state'
import { applyMessages } from './blocks'
import { acceptRequest, clearTimers, flushSlot, pushToast } from './interaction'

/** 新增 AgentEvent 成员时这里会编译失败：提醒同步 store，而不是静默丢掉事件 */
function never(ev: never): never {
  throw new Error(`未处理的事件：${JSON.stringify(ev)}`)
}

/** 启动埋点用：首个事件、会话列表首次到齐各记一次，后面的增量不记 */
let firstEvent = true
let sessionsDone = false

/** 一个事件 → 一次状态更新；不依赖任何 React 生命周期 */
function dispatch(ev: AgentEvent): void {
  if (firstEvent) {
    firstEvent = false
    bootLog(`收到宿主第一个事件 ${ev.type}`)
  }
  switch (ev.type) {
    case 'messages':
      applyMessages(ev.delta, ev.path)
      return
    case 'sessions':
      if (!sessionsDone && !ev.loading) {
        sessionsDone = true
        bootLog(`会话列表到齐 ${ev.sessions.length} 条`)
      }
      engine.set({
        sessions: ev.sessions,
        projects: ev.projects,
        projectRows: ev.projectRows,
        workspaces: ev.workspaces,
        models: ev.models,
        commands: ev.commands
      })
      return
    case 'files':
      engine.set({ files: ev.items })
      return
    case 'busy':
      engine.set({ busy: ev.active ? (ev.label ?? '处理中…') : undefined })
      return
    case 'status':
      // 只认当前会话的状态：切换期间旧会话还在推 status，别让它改掉界面
      if (ev.path !== engine.get().viewPath) return
      engine.set({ snapshot: ev.snapshot, streaming: ev.streaming })
      return
    case 'error':
      engine.set({ error: ev.message })
      return
    case 'settled': {
      const s = engine.get()
      // 后台会话跑完只打未读点；正在看的才收掉 streaming / 记结束时间。
      // 注意「没存过盘的新会话」路径是 null，两边都为 null 时也算当前
      const mine = ev.path === s.viewPath
      const unread = !mine && ev.path && !s.unread.includes(ev.path) ? [...s.unread, ev.path] : s.unread
      engine.set(mine ? { streaming: false, settledAt: Date.now(), unread } : { unread })
      return
    }
    case 'uiRequest': {
      const req = ev.req
      // 已被问答卡认领的请求：先挂起，等用户提交后再按题号回填
      // （认领时才从消息里找工具参数——工具执行前所属消息必已 end，参数完整，ADR-0014）
      if (req.toolCallId && acceptRequest(req)) {
        flushSlot(req.toolCallId)
        return
      }
      if (req.kind === 'notify') {
        // 通知是单向的，立刻确认；界面上作为 toast 出现并自动消失
        send({ type: 'uiReply', id: req.id, reply: {} })
        pushToast(req.id, req.message ?? '', req.notifyType ?? 'info')
        return
      }
      engine.update((s) => ({ ui: [...s.ui, req] }))
      return
    }
  }
  never(ev)
}

/** 已订阅的退订函数；startEngine 幂等，重复调用不会叠出第二个监听 */
let off: (() => void) | null = null

/** 显式启动（main.tsx 在 createRoot 之前调）。
 * 不做幂等短路的外部判断，只在这里守一次，HMR 后仍能重新订阅。
 * 是否已接上引擎跨模块求值靠 hot.data 带过去，所以不放模块级变量。
 */
export function startEngine(): void {
  if (off) return
  if (hot) hot.data.started = true
  const api = window.pi?.agent
  // 浏览器里预览（无 preload）时降级为静态，不崩
  if (!api) {
    engine.set({ error: '未连接到引擎（浏览器预览）' })
    off = () => {}
    return
  }
  const stop = api.onEvent(dispatch)
  off = () => {
    stop()
    clearTimers()
  }
  api.send({ type: 'init' })
}

interface Hot {
  data: { started?: boolean }
  dispose(cb: () => void): void
  accept(cb: () => void): void
}

const hot = (import.meta as unknown as { hot?: Hot }).hot

// 改本文件时先退订（否则多一个 ipcRenderer.on，旧 dispatch 指着废弃的 store），
// 再由 accept 重新接上：main.tsx 不会跟着重跑，不在这里补就会永久失联
hot?.dispose(() => {
  off?.()
  off = null
})
hot?.accept(() => {
  if (hot?.data.started) startEngine()
})
