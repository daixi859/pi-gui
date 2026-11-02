/**
 * 交互适配器：把宿主转发来的通用 UI 原语，解释成某个扩展/工具期望的字符串答案。
 *
 * 宿主不认识工具名，也不认识这些格式；这里的每一行都只关乎渲染层怎么呈现、怎么翻译。
 * 新增一类交互 = 新增一个文件 + 在 registry 里加一行。
 */
import type { AskAnswer, AskQuestion, UiRequest } from '@shared/ipc'

/** 一次待处理的交互请求，按工具调用分组（toolCallId 为 undefined 时是裸 UI 请求） */
export interface AdapterContext {
  /** 该请求所属工具调用的完整入参（来自 toolStart 事件），未认领时为 undefined */
  args?: unknown
  /** 该工具调用里第几个 ui.* 请求（从 0 开始） */
  index: number
}

export interface InteractionAdapter {
  /** 适配器名，仅用于调试 */
  name: string
  /** 认领规则：工具名 + 首个请求的形态 */
  claims: (name: string, args: unknown) => boolean
  /** 用户在界面上的答案翻译成宿主需要的字符串 */
  reply: (answers: unknown) => string | undefined
}

/* ---------------- ask_user_question（rpiv 扩展） ----------------
 * rpiv 在 mode="rpc" 下逐题 await ui.select()（多选用 ui.input()），
 * 单选的自定义文本原样返回即可，多选要拼成它认的 "1,3; 自定义"。
 */

const ASK_TOOL = 'ask_user_question'

/** 从工具参数里取出问卷；形状不对返回空数组，让调用方退回通用弹窗 */
export function questionsOf(args: unknown): AskQuestion[] {
  const raw = (args as { questions?: unknown })?.questions
  if (!Array.isArray(raw)) return []
  return raw.flatMap((q) => {
    const item = q as { question?: string; header?: string; multiSelect?: boolean; options?: unknown }
    if (!item?.question || !Array.isArray(item.options)) return []
    return [
      {
        header: item.header,
        question: item.question,
        multiSelect: Boolean(item.multiSelect),
        options: item.options.flatMap((o) => {
          const op = o as { label?: string; description?: string }
          return op?.label ? [{ label: op.label, description: op.description }] : []
        })
      }
    ]
  })
}

/** 多选回填成 rpiv 认的 "1,3; 自定义"（见 rpc-fallback.ts 的 askMultiSelect） */
export function multiReply(a: AskAnswer | undefined, count: number): string {
  if (!a) return ''
  const nums = (a.selected ?? []).filter((i) => i >= 0 && i < count).map((i) => String(i + 1))
  return a.custom ? `${nums.join(',')}; ${a.custom}` : nums.join(',')
}

/** 单选：自定义文本原样返回（rpiv 认作 custom 答案），否则取选项行 */
export function selectReply(a: AskAnswer | undefined, options: string[]): string | undefined {
  if (!a) return undefined
  if (a.custom) return a.custom
  return a.option === undefined ? undefined : options[a.option]
}

export const askQuestion: InteractionAdapter = {
  name: ASK_TOOL,
  claims: (name) => name === ASK_TOOL,
  reply: () => undefined
}

/* ---------------- 通用兜底 ---------------- */

/** 裸 select/input/confirm：把第一个选项/空串交给扩展，避免扩展挂死 */
export const plain: InteractionAdapter = {
  name: 'plain',
  claims: () => false,
  reply: () => undefined
}

export const adapters: InteractionAdapter[] = [askQuestion, plain]

/** 认领一个 ui 请求：返回对应适配器，没有则 undefined（调用方走原生弹窗） */
export function claim(tool: { name: string; args: unknown } | undefined): InteractionAdapter | undefined {
  if (!tool) return undefined
  return adapters.find((a) => a.claims(tool.name, tool.args))
}

/** 该请求是否属于被认领的问卷（问卷走卡片，不弹原生窗） */
export function isQuestionRequest(req: UiRequest, args: unknown): boolean {
  return (req.kind === 'select' || req.kind === 'input') && questionsOf(args).length > 0
}
