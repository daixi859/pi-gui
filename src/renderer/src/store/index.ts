/**
 * store 的动作层：所有「用户点一下就发一条命令」的函数。
 *
 * 状态形状与实例在 state.ts，切片逻辑在 blocks.ts / interaction.ts，事件接入在 engine.ts。
 * 组件只从这里 import，不必知道内部怎么分片。
 */
import type { PromptImage } from '@shared/ipc'
import { engine, send } from './state'
import { applyStreaming } from './blocks'

export type { Ask, EngineState, Toast } from './state'
export { engine, initial, useEngine } from './state'
export { blocksOf } from './blocks'
export { answerAsk, cancelAsk, replyUi } from './interaction'

export const prompt = (text: string, images?: PromptImage[]): void => {
  // 先自己进「工作中」：宿主的 status(true) 要等 agent_start，
  // 而 agent_start 又在 before_agent_start 扩展跑完之后，空会话里这段空窗
  // 会让正文只剩一句「这个会话还没有内容」，看起来像没发出去
  if (!engine.get().streaming) {
    engine.set({ streaming: true, settledAt: null })
    applyStreaming()
  }
  send({ type: 'prompt', text, images })
}
export const abort = (): void => send({ type: 'abort' })
export const renameSession = (path: string, title: string): void => send({ type: 'renameSession', path, title })
export const removeProject = (path: string): void => send({ type: 'projectRemove', path })
export const restoreProject = (path: string): void => send({ type: 'projectRestore', path })
export const setModel = (modelId: string): void => send({ type: 'setModel', modelId })
export const setThinkingLevel = (level: string): void => send({ type: 'setThinkingLevel', level })
export const queryFiles = (query: string): void => send({ type: 'listFiles', query })
export const clearError = (): void => engine.update(() => ({ error: undefined }))
export const toggleAccess = (): void =>
  send({ type: 'setAccess', mode: engine.get().snapshot.accessFull ? 'confirm' : 'full' })

/**
 * 切到某个会话：正文清空、清掉它的未读标记。正在跑的那个宿主不会 dispose，
 * 留在后台继续跑，跑完才标未读。
 */
function enter(path: string | null): void {
  engine.update((s) => ({
    viewPath: path,
    msgs: { order: [], byId: {} },
    turns: [],
    byId: {},
    answerText: '',
    streaming: false,
    settledAt: null,
    unread: s.unread.filter((p) => p !== path)
  }))
}

export const newSession = (): void => {
  enter(null)
  send({ type: 'newSession' })
}

export const switchWorkspace = (path: string): void => {
  enter(null)
  send({ type: 'workspace', path })
}

export const openSession = (path: string): void => {
  enter(path)
  send({ type: 'openSession', path })
}

export const deleteSession = (path: string): void => {
  // 删的是正在看的会话：宿主会切到新会话，路径等它回来再认
  engine.update((s) => (s.viewPath === path ? { viewPath: null, streaming: false } : {}))
  send({ type: 'deleteSession', path })
}

export const deleteProject = (path: string): void => {
  // 项目下的会话会被整批删掉，正在看的那条可能在里面，宿主会切到新会话
  engine.update(() => ({ viewPath: null, streaming: false }))
  send({ type: 'projectDelete', path })
}
