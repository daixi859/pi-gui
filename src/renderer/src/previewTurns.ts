/**
 * 组件预览用的静态回合：预览页不跑引擎，直接用对话块库的形状造数据。
 * 只服务 components/business/Preview.tsx，不进运行时路径。
 */
import type { Block, ConversationState, ToolBlock, Turn } from 'agent-design/blocks'

const DIFF = [
  ' 42 const token = getToken()',
  '-43 const user = await login(email)',
  '+43 const user = await login(email, pwd)',
  '+44 track("login", { id: user.id })',
  ' 45 return user'
].join('\n')

const ANSWER = [
  '登录页加了密码参数，Safari 下的 flex 子项也补了 min-w-0，类型检查还剩一处调用没跟上：',
  '',
  '    const user = await login(email, pwd)',
  '',
  '改完后 pnpm run typecheck 通过。'
].join('\n')

const blocks: Block[] = [
  {
    kind: 'thinking',
    id: 'p-th',
    text: 'Safari 下错位多半来自 flex 子项的 min-width。先看登录页的容器宽度约束。',
    streaming: false,
    durationMs: 4200,
    ts: 1
  },
  {
    kind: 'tool',
    id: 'p-read',
    callId: 'p-read',
    name: 'read',
    argsRaw: '{"path":"src/renderer/src/components/business/Login.tsx"}',
    args: { path: 'src/renderer/src/components/business/Login.tsx' },
    state: 'ok',
    output: 'export function Login(): ReactNode {\n  return <form className="w-full max-w-sm">…</form>\n}',
    durationMs: 320,
    ts: 2
  },
  {
    kind: 'tool',
    id: 'p-edit',
    callId: 'p-edit',
    name: 'edit',
    argsRaw: '{"path":"src/renderer/src/components/business/Login.tsx"}',
    args: { path: 'src/renderer/src/components/business/Login.tsx' },
    state: 'ok',
    details: { diff: DIFF },
    durationMs: 210,
    ts: 3
  },
  {
    kind: 'tool',
    id: 'p-bash',
    callId: 'p-bash',
    name: 'bash',
    argsRaw: '{"command":"pnpm run typecheck"}',
    args: { command: 'pnpm run typecheck' },
    state: 'error',
    output: 'src/renderer/src/components/business/Login.tsx(43,18): error TS2554: Expected 2 arguments, but got 1.',
    error: { code: 'exit', message: '命令以退出码 2 结束' },
    durationMs: 12400,
    ts: 4
  },
  {
    kind: 'assistant',
    id: 'p-a',
    text: ANSWER,
    status: 'settled',
    final: true,
    ts: 5
  },
  { kind: 'system', id: 'p-s', tone: 'warn', text: '上下文已压缩：12.4k → 3.1k tokens', ts: 6 }
]

const user: Block = { kind: 'user', id: 'p-u', text: '修复登录页在 Safari 下的布局错位', images: [], ts: 0 }

const settled: Turn = {
  key: 'p-turn-1',
  userId: user.id,
  blockIds: blocks.map((b) => b.id),
  status: 'settled',
  startedAt: 0,
  endedAt: 18_000,
  toolCount: 3,
  errorCount: 1
}

const liveUser: Block = { kind: 'user', id: 'p-u2', text: '再跑一遍类型检查', images: [], ts: 0 }

const liveThinking: Block = {
  kind: 'thinking',
  id: 'p-th2',
  text: '改完先跑类型检查，确认没有别的调用方受影响。',
  streaming: false,
  durationMs: 1800,
  ts: 0
}

const liveTool: ToolBlock = {
  kind: 'tool',
  id: 'p-tool2',
  callId: 'p-tool2',
  name: 'bash',
  argsRaw: '{"command":"pnpm run typecheck"}',
  args: { command: 'pnpm run typecheck' },
  state: 'running',
  ts: 0
}

const live: Turn = {
  key: 'p-turn-2',
  userId: liveUser.id,
  blockIds: [liveThinking.id, liveTool.id],
  status: 'live',
  startedAt: 0,
  activity: { kind: 'tool', detail: 'pnpm run typecheck' },
  toolCount: 1,
  errorCount: 0
}

function stateOf(turn: Turn, blocks: Record<string, Block>): ConversationState {
  return { turns: [turn], blocks, seq: 0, callIndex: {}, liveMessage: null, activeTurn: null, liveTools: {} }
}

export const previewSettled: { turn: Turn; state: ConversationState } = {
  turn: settled,
  state: stateOf(settled, { ...Object.fromEntries(blocks.map((b) => [b.id, b])), [user.id]: user })
}

export const previewLive: { turn: Turn; state: ConversationState; now: number } = {
  turn: live,
  state: stateOf(live, { [liveUser.id]: liveUser, [liveThinking.id]: liveThinking, [liveTool.id]: liveTool }),
  now: 12_500
}
