import type { Block, ConversationState, ToolBlock, Turn } from '../reducer/types'
import { AssistantText, SystemRow, ThinkingRow, ToolRow, TurnView } from '../blocks'
import { zh } from '../i18n/zh'

let seq = 0
function id(prefix: string): string {
  seq += 1
  return `${prefix}-${seq}`
}

const NOW = Date.UTC(2026, 10, 12, 10, 0, 0)

function tool(partial: Partial<ToolBlock> & Pick<ToolBlock, 'name'>): ToolBlock {
  return {
    kind: 'tool',
    id: id('tool'),
    callId: id('call'),
    argsRaw: '{}',
    state: 'ok',
    ts: NOW,
    ...partial,
  }
}

function makeState(blocks: readonly Block[], turn: Partial<Turn> = {}): ConversationState {
  const record: Record<string, Block> = {}
  for (const block of blocks) record[block.id] = block
  const user = blocks.find(block => block.kind === 'user')
  const built: Turn = {
    key: id('gallery'),
    userId: user?.id ?? null,
    blockIds: blocks.map(block => block.id),
    status: 'settled',
    startedAt: NOW,
    endedAt: NOW + 75_000,
    toolCount: blocks.filter(block => block.kind === 'tool').length,
    errorCount: blocks.filter(block => block.kind === 'tool' && block.state === 'error').length,
    ...turn,
  }
  return {
    turns: [built],
    blocks: record,
    seq: blocks.length,
    callIndex: {},
    liveMessage: null,
    activeTurn: built.key,
    liveTools: {},
  }
}

const DIFF = [' 1  export function greet(name) {', '- 2    return "hi " + name', '+ 2    return `hi ${name}`', ' 3  }', ''].join(
  '\n',
)

function ToolStates() {
  return (
    <>
      <div className="label">preparing</div>
      <ToolRow block={tool({ name: 'powershell', state: 'preparing', argsRaw: '' })} />
      <div className="label">running</div>
      <ToolRow
        block={tool({
          name: 'read',
          state: 'running',
          args: { path: 'D:/pi/learn/src/reducer/reduce.ts' },
          output: 'export function reduce(state, event) {',
        })}
      />
      <div className="label">ok</div>
      <ToolRow
        block={tool({
          name: 'grep',
          state: 'ok',
          args: { pattern: 'settled', path: 'src' },
          output: 'reduce.ts:88:  case \'agent_settled\':\nreduce.ts:120: ...settled',
          durationMs: 1200,
        })}
      />
      <div className="label">error</div>
      <ToolRow
        block={tool({
          name: 'powershell',
          state: 'error',
          args: { command: 'node scripts/missing.mjs' },
          output: 'Error: Cannot find module ...',
          error: { code: 'exit_1', message: '退出码 1' },
          durationMs: 640,
        })}
      />
      <div className="label">stopped</div>
      <ToolRow block={tool({ name: 'write', state: 'stopped', args: { path: 'src/new.ts' } })} />
    </>
  )
}

function ToolBodies() {
  const codemode = tool({
    name: 'codemode',
    state: 'ok',
    args: { code: 'await tools.read(...)' },
    subCalls: [
      { id: 's1', name: 'read', args: { path: 'src/a.ts' }, state: 'ok', durationMs: 210 },
      { id: 's2', name: 'grep', args: { pattern: 'reduce' }, state: 'ok', durationMs: 90 },
      { id: 's3', name: 'powershell', args: { command: 'pnpm test' }, state: 'error', durationMs: 2400 },
    ],
    durationMs: 3200,
  })
  const longText = Array.from({ length: 60 }, (_, index) => `line ${index + 1}: 这是一段用于验证截断与展开的超长输出`).join(
    '\n',
  )
  return (
    <>
      <div className="label">edit（diff）</div>
      <ToolRow
        block={tool({
          name: 'edit',
          args: { path: 'src/greet.ts', oldText: 'return "hi " + name', newText: 'return `hi ${name}`' },
          details: { diff: DIFF },
          durationMs: 300,
        })}
      />
      <div className="label">read（超长输出，默认 24 行）</div>
      <ToolRow block={tool({ name: 'read', args: { path: 'src/big.ts' }, output: longText })} defaultOpen />
      <div className="label">codemode（嵌套子调用）</div>
      <ToolRow block={codemode} defaultOpen />
    </>
  )
}

const SETTLED_BLOCKS: readonly Block[] = [
  {
    kind: 'user',
    id: 'g-user',
    text: '把 reducer 的 settled 逻辑再核对一遍，顺便跑一下校验脚本。',
    images: [],
    ts: NOW,
  },
  {
    kind: 'thinking',
    id: 'g-think',
    text: '先看 agent_settled 分支；如果没有 live turn，应当保持幂等。',
    streaming: false,
    durationMs: 8400,
    ts: NOW,
  },
  tool({
    name: 'read',
    args: { path: 'src/reducer/reduce.ts' },
    output: 'case \'agent_settled\': ...',
    durationMs: 420,
  }),
  tool({
    name: 'powershell',
    args: { command: 'node scripts/check-reducer.mjs' },
    output: 'all fixtures settled cleanly',
    durationMs: 5200,
  }),
  {
    kind: 'assistant',
    id: 'g-answer',
    text: '核对完了：`agent_settled` 分支是幂等的，**6 份夹具**全部干净落定。',
    status: 'settled',
    final: true,
    ts: NOW,
  },
]

const LIVE_BLOCKS: readonly Block[] = [
  {
    kind: 'thinking',
    id: 'g-live-think',
    text: '正在比较 harness 的 ToolRow 与本地实现的差异……',
    streaming: true,
    ts: NOW,
  },
  tool({
    name: 'grep',
    state: 'running',
    args: { pattern: 'ToolRowState' },
    output: 'ToolRow.tsx:12: type ToolRowState =',
  }),
]

const MCP_DIFF = [
  ' 3    "mcpServers": {',
  '- 4      "command": "npx",',
  '- 5      "args": ["-y", "@playwright/mcp@latest"]',
  '+ 4      "command": "playwright-mcp",',
  '+ 5      "args": []',
  ' 6    }',
].join('\n')

const MIXED_BLOCKS: readonly Block[] = [
  {
    kind: 'user',
    id: 'g-mixed-user',
    text: '把 MCP 改成全局命令行，冒烟通过后告诉我。',
    images: [],
    ts: NOW,
  },
  {
    kind: 'thinking',
    id: 'g-mixed-think-1',
    text: '先看 mcp.json 现在怎么写的，再用本地 playwright-mcp 做一次握手。',
    streaming: false,
    durationMs: 2400,
    ts: NOW,
  },
  tool({
    name: 'powershell',
    args: { command: 'Get-Content ~/.pi/agent/mcp.json' },
    output: '"command": "npx", "args": ["-y", "@playwright/mcp@latest"]',
    durationMs: 380,
  }),
  {
    kind: 'assistant',
    id: 'g-mixed-text-1',
    text: '配置目前还在走 `npx`，每次启动都要解析包。改成全局命令：',
    status: 'settled',
    final: false,
    ts: NOW,
  },
  tool({
    name: 'edit',
    args: { path: '~/.pi/agent/mcp.json', oldText: '"command": "npx"', newText: '"command": "playwright-mcp"' },
    details: { diff: MCP_DIFF },
    durationMs: 260,
  }),
  {
    kind: 'assistant',
    id: 'g-mixed-text-2',
    text: '已经换成 `playwright-mcp`。做一次 `initialize` 握手：',
    status: 'settled',
    final: false,
    ts: NOW,
  },
  tool({
    name: 'powershell',
    state: 'error',
    args: { command: 'playwright-mcp --stdio' },
    output: ['Error: "--stdio" is not a valid option', 'Run playwright-mcp --help'].join('\n'),
    error: { code: 'exit_1', message: '退出码 1' },
    durationMs: 1200,
  }),
  {
    kind: 'assistant',
    id: 'g-mixed-text-3',
    text: '`--stdio` 已经是默认传输，去掉参数重试：',
    status: 'settled',
    final: false,
    ts: NOW,
  },
  tool({
    name: 'powershell',
    args: { command: 'playwright-mcp' },
    output: [
      'server started',
      '{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-03-26"}}',
    ].join('\n'),
    durationMs: 2100,
  }),
  {
    kind: 'assistant',
    id: 'g-mixed-answer',
    text: [
      '✅ 配置完成，冒烟通过。',
      '',
      '- `mcp.json` 已指向全局 `playwright-mcp`',
      '- `initialize` 返回 `2025-03-26`',
      '- 下次启动不再解析 `npx` 包',
    ].join('\n'),
    status: 'settled',
    final: true,
    ts: NOW,
  },
]

// 画廊是静态的：state 只构建一次，turn 与 blocks 共享同一份，避免 id 对不上。
const SETTLED_STATE = makeState(SETTLED_BLOCKS)
const MIXED_STATE = makeState(MIXED_BLOCKS)
const LIVE_STATE = makeState(LIVE_BLOCKS, {
  status: 'live',
  endedAt: undefined,
  activity: { kind: 'tool', detail: 'grep' },
})

/** 状态画廊：纯 props 渲染每种终态，不经过事件回放。 */
export function Gallery() {
  return (
    <div className="gallery pi-blocks">
      <div className="galleryInner">
        <p className="galleryNote">{zh.gallery.note}</p>

        <section className="card">
          <div className="cardHead">{zh.gallery.toolStates}</div>
          <div className="cardBody">
            <ToolStates />
          </div>
        </section>

        <section className="card">
          <div className="cardHead">结果体：diff / 截断 / 嵌套</div>
          <div className="cardBody">
            <ToolBodies />
          </div>
        </section>

        <section className="card">
          <div className="cardHead">{zh.gallery.thinking}</div>
          <div className="cardBody">
            <div className="label">streaming（展开 + 渐隐）</div>
            <ThinkingRow
              block={{
                kind: 'thinking',
                id: 'g-think-2',
                text: '用户想确认错误行的默认展开。先看 ToolRow 的初始 state，再从 block.state 派生 open。为了验证长文本的渐隐，这一段会写得比较长：……',
                streaming: true,
                ts: NOW,
              }}
            />
            <div className="label">settled（收起，单行摘要）</div>
            <ThinkingRow
              block={{
                kind: 'thinking',
                id: 'g-think-3',
                text: '工具行需要区分 preparing 与 running：前者还没有参数，后者已经拿到参数。',
                streaming: false,
                durationMs: 12_000,
                ts: NOW,
              }}
            />
          </div>
        </section>

        <section className="card">
          <div className="cardHead">{zh.gallery.assistant}</div>
          <div className="cardBody">
            <div className="label">streaming</div>
            <AssistantText
              block={{
                kind: 'assistant',
                id: 'g-text-1',
                text: '结论：\n\n- 工具行状态一致\n- 错误行默认展开\n\n继续补充 **嵌套调用** 的细节',
                status: 'running',
                final: false,
                ts: NOW,
              }}
            />
            <div className="label">settled（表格 + 代码）</div>
            <AssistantText
              block={{
                kind: 'assistant',
                id: 'g-text-2',
                text: '| 状态 | 颜色 |\n| --- | --- |\n| ok | 绿 |\n| error | 红 |\n\n```ts\ntype ToolState = \'preparing\' | \'running\' | \'ok\' | \'error\' | \'stopped\'\n```\n\n> 引用与列表也走同一套 token。',
                status: 'settled',
                final: true,
                ts: NOW,
              }}
            />
          </div>
        </section>

        <div className="grid2">
          <section className="card">
            <div className="cardHead">{zh.gallery.turn} · settled（过程收起）</div>
            <div className="cardBody">
              <TurnView turn={SETTLED_STATE.turns[0]} state={SETTLED_STATE} scope="gallery" />
            </div>
          </section>

          <section className="card">
            <div className="cardHead">{zh.gallery.turn} · live</div>
            <div className="cardBody">
              <TurnView turn={LIVE_STATE.turns[0]} state={LIVE_STATE} scope="gallery" />
            </div>
          </section>
        </div>

        <section className="card">
          <div className="cardHead">{zh.gallery.turn} · 工具 / 思考 / 文本穿插（展开）</div>
          <div className="cardBody">
            <TurnView turn={MIXED_STATE.turns[0]} state={MIXED_STATE} defaultOpen scope="gallery" />
          </div>
        </section>

        <section className="card">
          <div className="cardHead">{zh.gallery.system}</div>
          <div className="cardBody">
            <SystemRow block={{ kind: 'system', id: 'sys-1', tone: 'info', text: '上下文已压缩：20428 tokens → 1180 tokens', ts: NOW }} />
            <SystemRow block={{ kind: 'system', id: 'sys-2', tone: 'warn', text: '工具调用被中断：powershell', ts: NOW }} />
            <SystemRow block={{ kind: 'system', id: 'sys-3', tone: 'error', text: '模型返回错误：context length exceeded', ts: NOW }} />
          </div>
        </section>
      </div>
    </div>
  )
}
