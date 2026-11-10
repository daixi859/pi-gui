import { contextBridge, ipcRenderer } from 'electron'
import type { AgentCommand, AgentEvent } from '@shared/ipc'

contextBridge.exposeInMainWorld('pi', {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggleMaximize'),
    close: () => ipcRenderer.send('window:close'),
    onMaximized: (cb: (maximized: boolean) => void) => {
      const handler = (_e: unknown, maximized: boolean): void => cb(maximized)
      ipcRenderer.on('window:maximized', handler)
      return () => ipcRenderer.removeListener('window:maximized', handler)
    }
  },
  agent: {
    send: (cmd: AgentCommand) => ipcRenderer.send('agent:command', cmd),
    onEvent: (cb: (ev: AgentEvent) => void) => {
      const handler = (_e: unknown, ev: AgentEvent): void => cb(ev)
      ipcRenderer.on('agent:event', handler)
      return () => ipcRenderer.removeListener('agent:event', handler)
    }
  },
  host: {
    copy: (text: string) => ipcRenderer.send('host:copy', text),
    openExternal: (url: string) => ipcRenderer.send('host:openExternal', url),
    saveText: (name: string, text: string) => ipcRenderer.send('host:saveText', name, text),
    pickFiles: () => ipcRenderer.invoke('host:pickFiles') as Promise<string[]>,
    pickDirectory: () => ipcRenderer.invoke('host:pickDir') as Promise<string | null>,
    readImage: (path: string) =>
      ipcRenderer.invoke('host:readImage', path) as Promise<{ data: string; mimeType: string } | null>,
    readText: (path: string) =>
      ipcRenderer.invoke('host:readText', path) as Promise<{ text: string; truncated: boolean } | null>,
    openAgentConfig: () => ipcRenderer.send('host:openAgentConfig'),
    revealPath: (path: string) => ipcRenderer.send('host:revealPath', path)
  }
})
