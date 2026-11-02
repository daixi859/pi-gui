import type { AgentCommand, AgentEvent, HostBridge } from '../shared/ipc'

export interface PiApi {
  window: {
    minimize: () => void
    toggleMaximize: () => void
    close: () => void
    onMaximized: (cb: (maximized: boolean) => void) => () => void
  }
  agent: {
    send: (cmd: AgentCommand) => void
    onEvent: (cb: (ev: AgentEvent) => void) => () => void
  }
  host: HostBridge
}

declare global {
  interface Window {
    pi: PiApi
  }
}
