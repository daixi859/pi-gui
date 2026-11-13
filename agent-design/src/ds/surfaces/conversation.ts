/**
 * 高保真用的会话内容：只保留渲染需要的形状。
 *
 * 刻意不去 import `reducer/types`：那套类型描述的是「事件流归约后的真状态」，
 * 而高保真面要能精确摆出任意状态（进行中、失败、被中断、超长输出），
 * 手写比造事件流直接得多。字段名仍与真模型对齐，将来换真数据只改数据源。
 */
import type { DsIconName } from '../icons/DsIcon'

/** 一行过程的状态。 */
export type LineState = 'preparing' | 'running' | 'ok' | 'error' | 'stopped'

/** 工具行。 */
export interface ToolLine {
  readonly kind: 'tool'
  readonly id: string
  /** 动作词：检索 / 阅读 / 修改 / 执行 / 写入 / 脚本。 */
  readonly title: string
  /** 摘要：路径末段、命令、pattern。 */
  readonly summary: string
  /** 摘要是否走等宽字体。 */
  readonly mono?: boolean
  readonly state: LineState
  /** 已完成时的耗时文案，例如「1.2 秒」。 */
  readonly duration?: string
  /** 展开后的结果正文。 */
  readonly output?: string
  /** 改动行数（编辑类工具）。 */
  readonly diff?: { readonly added: number; readonly removed: number }
}

/** 思考行。 */
export interface ThinkingLine {
  readonly kind: 'thinking'
  readonly id: string
  /** 展开后的思考正文。 */
  readonly text: string
  /** 流式中的实时摘要，收起时显示。 */
  readonly liveSummary?: string
  readonly state: 'streaming' | 'done'
  readonly duration?: string
}

/** 系统提示行（上下文注入、重试、警告）。 */
export interface NoteLine {
  readonly kind: 'note'
  readonly id: string
  readonly text: string
  readonly tone?: 'info' | 'warn' | 'error'
}

/** 过程组里的一行。 */
export type ProcessLine = ToolLine | ThinkingLine | NoteLine

/** 过程组：一段连续的工具/思考，被 assistant 文本切开。 */
export interface ProcessGroupItem {
  readonly kind: 'group'
  readonly id: string
  readonly icon: DsIconName
  /** 收起时的标题：已完成 →「已读取 3 个文件」；进行中 →「正在读取文件」。 */
  readonly title: string
  readonly state: 'done' | 'live'
  /** 默认是否展开。 */
  readonly open?: boolean
  readonly lines: readonly ProcessLine[]
}

/** 助手文本段。 */
export interface AssistantItem {
  readonly kind: 'assistant'
  readonly id: string
  /** 是否是该回合的最终答案（决定字重与下边距）。 */
  readonly final?: boolean
  /** 段落；`code` 段落渲染成代码块。 */
  readonly blocks: readonly AssistantBlockView[]
}

/** 助手文本里的一段。 */
export type AssistantBlockView =
  | { readonly type: 'p'; readonly text: string }
  | { readonly type: 'code'; readonly lang: string; readonly code: string }
  | { readonly type: 'list'; readonly items: readonly string[] }

/** 回合里的一条。 */
export type TurnEntry = ProcessGroupItem | AssistantItem

/** 回合结束后的改动汇总。 */
export interface ChangedFiles {
  readonly files: readonly { readonly name: string; readonly dir: string; readonly added: number; readonly removed: number }[]
}

/** 一个回合。 */
export interface MockTurn {
  readonly id: string
  /** 开场用户消息；续写回合没有。 */
  readonly user?: string
  readonly entries: readonly TurnEntry[]
  readonly status: 'settled' | 'live' | 'aborted'
  /** 落定后的耗时。 */
  readonly duration?: string
  /** 失败次数（回合头右侧显示）。 */
  readonly failed?: number
  readonly changes?: ChangedFiles
}

/** 主对话面用的完整会话。 */
export const CONVERSATION: readonly MockTurn[] = [
  {
    id: 'turn-1',
    user: '把 store 里的事件接入收紧一下：现在 message_update 每个 delta 都会触发一次全量重渲染，滚轮在长会话里会掉帧。',
    status: 'settled',
    duration: '48 秒',
    entries: [
      {
        kind: 'group',
        id: 'grp-1',
        icon: 'search',
        title: '已搜索代码，读取 4 个文件',
        state: 'done',
        lines: [
          { kind: 'thinking', id: 'th-1', state: 'done', duration: '6 秒', text: '先从订阅点看起。message_update 在 engine.ts 里被合流成一次 set，但如果每次 delta 都新建 blocks 对象，selector 的浅比较就会全部失效。' },
          { kind: 'tool', id: 't-1', title: '检索', summary: 'message_update', mono: true, state: 'ok', duration: '0.3 秒' },
          { kind: 'tool', id: 't-2', title: '阅读', summary: 'engine.ts', state: 'ok', duration: '0.2 秒' },
          { kind: 'tool', id: 't-3', title: '阅读', summary: 'blocks.ts', state: 'ok', duration: '0.4 秒' },
          { kind: 'tool', id: 't-4', title: '阅读', summary: 'timeline.ts', state: 'ok', duration: '0.3 秒' },
        ],
      },
      {
        kind: 'assistant',
        id: 'as-1',
        blocks: [
          { type: 'p', text: '问题在 `blocks.ts`：`message_update` 每次都会重建整个 `blocks` 记录，即使只有一个字符变了。下游的 `timeline` 用 `state.blocks` 做依赖，于是每个 delta 都把整条时间线重算一遍。' },
          { type: 'p', text: '把重建范围收窄到受影响的 key 即可。改动很小，只碰增量合并那一处。' },
        ],
      },
      {
        kind: 'group',
        id: 'grp-2',
        icon: 'sliders',
        title: '修改了 2 个文件',
        state: 'done',
        lines: [
          { kind: 'tool', id: 't-5', title: '修改', summary: 'blocks.ts', state: 'ok', duration: '0.6 秒', diff: { added: 18, removed: 11 }, output: 'applyPatch: 3 处替换，保留未受影响的 key 引用。' },
          { kind: 'tool', id: 't-6', title: '执行', summary: 'pnpm run typecheck', mono: true, state: 'ok', duration: '9.4 秒', output: 'tsc -b\n\n三个项目全部通过，无输出。' },
        ],
      },
      {
        kind: 'assistant',
        id: 'as-2',
        final: true,
        blocks: [
          { type: 'p', text: '改完了。现在只有内容真正变化的 block 会拿到新引用，`timeline` 的 useMemo 不会再整条失效。' },
          { type: 'list', items: ['`blocks.ts`：增量合并时复用未变化的 block 对象', '`engine.ts`：批处理窗口从 0ms 提到 16ms，与一帧对齐'] },
          { type: 'p', text: 'typecheck 已通过。长会话滚动没有再出现掉帧。' },
        ],
      },
    ],
    changes: {
      files: [
        { name: 'blocks.ts', dir: 'src/renderer/src/store', added: 18, removed: 11 },
        { name: 'engine.ts', dir: 'src/renderer/src/store', added: 6, removed: 2 },
      ],
    },
  },
  {
    id: 'turn-2',
    user: '顺便把设置页的密度选项接上，两档：舒适 / 紧凑。',
    status: 'live',
    entries: [
      {
        kind: 'group',
        id: 'grp-3',
        icon: 'search',
        title: '正在读取文件',
        state: 'live',
        open: true,
        lines: [
          { kind: 'thinking', id: 'th-2', state: 'streaming', liveSummary: '密度是个全局偏好，应该和主题走同一套机制', text: '密度是个全局偏好，应该和主题走同一套机制。useTheme 已经有 localStorage 与 system 回退，照着写一个 useDensity，再在 PiRoot 上挂 data-density 就够了。' },
          { kind: 'tool', id: 't-7', title: '阅读', summary: 'useTheme.ts', state: 'ok', duration: '0.2 秒' },
          { kind: 'tool', id: 't-8', title: '检索', summary: 'data-density', mono: true, state: 'running' },
        ],
      },
    ],
  },
]

/** 左栏会话列表：按时间分组。 */
export interface SessionGroup {
  readonly label: string
  readonly items: readonly { readonly id: string; readonly title: string; readonly meta: string; readonly active?: boolean }[]
}

export const SESSIONS: readonly SessionGroup[] = [
  {
    label: '今天',
    items: [
      { id: 'c1', title: '收紧 store 的事件接入', meta: '2 个回合 · 12 分钟前', active: true },
      { id: 'c2', title: '设置页密度选项', meta: '1 个回合 · 14:20' },
      { id: 'c3', title: '截图脚本的横向溢出断言', meta: '5 个回合 · 09:41' },
    ],
  },
  {
    label: '昨天',
    items: [
      { id: 'c4', title: '把 preload 的 IPC 类型收窄', meta: '3 个回合' },
      { id: 'c5', title: '长会话滚动掉帧', meta: '8 个回合' },
    ],
  },
  {
    label: '更早',
    items: [
      { id: 'c6', title: '设计令牌的对比度复盘', meta: '6 个回合' },
      { id: 'c7', title: 'agent-host 的消息合流', meta: '4 个回合' },
    ],
  },
]

/** 起始页的推荐举动。 */
export const STARTERS: readonly { id: string; icon: DsIconName; title: string; text: string }[] = [
  { id: 's1', icon: 'chat', title: '解释这段代码', text: '把选中的 120 行讲清楚，标出副作用在哪' },
  { id: 's2', icon: 'search', title: '定位一个 bug', text: '滚动到长会话底部时会偶发白屏，帮忙找原因' },
  { id: 's3', icon: 'sliders', title: '重构一个模块', text: '把 store/index.ts 拆成动作层与选择器两层' },
  { id: 's4', icon: 'layers', title: '写一份设计文档', text: '按现有 ADR 的格式，记录这次令牌层的取舍' },
]

/** 起始页的「最近会话」。 */
export const RECENT: readonly { id: string; title: string; meta: string }[] = [
  { id: 'r1', title: '收紧 store 的事件接入', meta: '12 分钟前 · 2 个回合' },
  { id: 'r2', title: '设置页密度选项', meta: '今天 14:20 · 1 个回合' },
  { id: 'r3', title: '截图脚本的横向溢出断言', meta: '昨天 · 5 个回合' },
]
