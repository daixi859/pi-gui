import type { Block, DiffLine } from '@shared/blocks'
import { argDetail, type TurnActivity, type TurnSpan } from './store/timeline'
import { liveReasoningDetail as liveDetail } from './util'

/** 一帧：虚拟时刻 t（毫秒）对应的段结构。宿主每 60ms 推一次，这里照抄这个节奏 */
export interface Frame {
  t: number
  turns: { span: TurnSpan; blocks: Block[] }[]
}

const FLUSH = 60

const THINK_A = `先把现状理清楚。
三个热点：一是 BlockView 没有 memo，一个 token 到达就把整段历史重渲染；二是 MarkdownView 每个增量都全文重跑 ReactMarkdown；三是流式期间 CodeBlock 对每个半截代码串跑一次 shiki。
先看块是怎么从宿主推过来的，再决定改哪一层。`

const THINK_B = `差量协议没问题，问题全在渲染层。
先确认改完后 turn 的折叠不会丢内容：段内最后一个 assistant 是答案，收起时要留在折叠外面；中间的说明文字属于过程。
diff 并进工具行显示。`

const ANSWER_A = `现状定位清楚了，三处都在渲染层：

1. **BlockView 没有 memo** —— 宿主已经只推变了的块，渲染层却把它们全量重渲染一遍。
2. **MarkdownView 每个增量全文重跑** —— 单条长回答的解析成本是 O(n²)。
3. **流式期间跑 shiki** —— 缓存 key 含 \`code\`，每个半截代码串都必然 miss。

按 ZCode 的形态重排：思考与工具收成一行摘要，\`已完成，用时 12秒\` 折叠，答案留在外面。`

const ANSWER_B = `压测结果：\`npm test\` 在这台机器上没有测试套件，这是预期内的——项目本来就没测试。

换成 \`npm run typecheck\` 之后通过。折叠后长会话的 DOM 只随回合数增长，不再随工具输出膨胀。`

const CODE_DIFF: DiffLine[] = [
  { type: 'ctx', no: 193, text: 'export function BlockView({ block }: { block: Block }): ReactNode {' },
  { type: 'del', no: 194, text: '  switch (block.kind) {' },
  { type: 'add', no: 194, text: '  return <Step block={block} />' },
  { type: 'del', no: 195, text: '    case \'user\':' },
  { type: 'add', no: 195, text: '  switch (block.kind) {' },
  { type: 'ctx', no: 196, text: '    case \'assistant\':' }
]

/** 新建文件：整段都是新增行 */
const WRITE_DIFF: DiffLine[] = [
  { type: 'add', no: 1, text: 'export const TurnView = memo(function TurnView({ span }: Props) {' },
  { type: 'add', no: 2, text: '  const [choice, setChoice] = useState<boolean | null>(null)' },
  { type: 'add', no: 3, text: '  const open = choice ?? span.live' },
  { type: 'add', no: 4, text: '  return <div className="space-y-2">{rows}</div>' },
  { type: 'add', no: 5, text: '})' }
]

/** 一个回合：user 气泡单独存（渲染在段头之前），段内其余块平铺，段坐标在快照时算 */
interface Seg {
  key: string
  user: Block
  blocks: Block[]
  startedAt: number
  endedAt: number | null
  aborted: boolean
  /** live 头要显示的当前活动；think / tool / say 各自切换 */
  activity: TurnActivity
}

/** 把脚本展开成按时间排序的帧序列，运行器只需要推进虚拟时钟 */
class Script {
  t = 0
  readonly frames: Frame[] = []
  private segs: Seg[] = []
  private cur: Seg | null = null
  private n = 0

  constructor(private readonly rounds: number) {
    this.run()
  }

  private flush(): void {
    const snap: Frame = { t: Math.round(this.t), turns: this.segs.map((s) => this.snapshot(s)) }
    const last = this.frames[this.frames.length - 1]
    if (last && last.t === snap.t) this.frames[this.frames.length - 1] = snap
    else this.frames.push(snap)
  }

  private snapshot(seg: Seg): { span: TurnSpan; blocks: Block[] } {
    const live = seg.endedAt === null
    return {
      span: {
        key: seg.key,
        userId: seg.user.id,
        ids: seg.blocks.map((b) => b.id),
        startedAt: seg.startedAt,
        durationMs: live ? 0 : Math.round(seg.endedAt! - seg.startedAt),
        stepCount: seg.blocks.filter((b) => b.kind !== 'assistant').length,
        noteCount: seg.blocks.filter((b) => b.kind === 'assistant').length,
        toolCount: seg.blocks.filter((b) => b.kind === 'tool').length,
        live,
        ...(live ? { activity: seg.activity } : {}),
        aborted: seg.aborted
      },
      blocks: [seg.user, ...seg.blocks]
    }
  }

  private patch(id: string, f: (c: Block) => Block): void {
    const blocks = this.cur?.blocks
    if (!blocks) return
    const i = blocks.findIndex((c) => c.id === id)
    if (i >= 0) blocks[i] = f(blocks[i])
  }

  private push(b: Block): string {
    this.cur?.blocks.push(b)
    return b.id
  }

  /** 按 60ms 一帧把文本吐出去，跟宿主的合帧节奏一致 */
  private stream(
    build: (text: string, done: boolean, elapsed: number) => Block,
    text: string,
    ms: number,
    each?: (acc: string) => void
  ): void {
    const count = Math.max(1, Math.round(ms / FLUSH))
    const size = Math.ceil(text.length / count)
    let id = ''
    for (let i = 0; i < count; i++) {
      this.t += ms / count
      const acc = text.slice(0, (i + 1) * size)
      const b = build(acc, i === count - 1, ms)
      // 第一帧插入，后面原地替换同一个 id
      if (id) this.patch(id, () => b)
      else id = this.push(b)
      each?.(acc)
      this.flush()
    }
  }

  private beginTurn(user: string, gap = 320): void {
    this.cur = {
      key: `t${++this.n}`,
      user: { kind: 'user', id: `u${++this.n}`, text: user },
      blocks: [],
      startedAt: this.t,
      endedAt: null,
      aborted: false,
      activity: { kind: 'thinking' }
    }
    this.segs.push(this.cur)
    this.t += gap
    this.flush()
  }

  private endTurn(aborted = false): void {
    if (!this.cur) return
    this.cur.endedAt = this.t
    this.cur.aborted = aborted
    this.flush()
    this.cur = null
  }

  private think(text: string, ms: number): void {
    if (this.cur) this.cur.activity = { kind: 'thinking' }
    const id = `th${++this.n}`
    this.stream(
      (acc, done) =>
        ({ kind: 'thinking', id, text: acc, level: '最高', streaming: !done, durationMs: done ? ms : undefined }),
      text,
      ms,
      // 段头跟着思考内容走：报此刻正在写的那一段，而不是干巴巴一句「思考中」
      (acc) => {
        if (!this.cur) return
        const detail = liveDetail(acc)
        this.cur.activity = { kind: 'thinking', ...(detail ? { detail } : {}) }
      }
    )
  }

  private tool(name: string, args: string, ms: number, output?: string, fail = false): void {
    const detail = argDetail(JSON.parse(args) as Record<string, unknown>)
    if (this.cur) this.cur.activity = { kind: 'tool', toolName: name, ...(detail ? { detail } : {}) }
    const id = `tl${++this.n}`
    this.push({ kind: 'tool', id, name, args, state: 'running' })
    this.flush()
    this.t += ms
    this.patch(id, (c) => ({ ...c, state: fail ? 'error' : 'done', output }) as Block)
    this.flush()
  }

  /** diff 属于它的工具行：补进段内最后一个 tool 块的字段 */
  private diff(file: string, lines: DiffLine[], ms: number): void {
    const blocks = this.cur?.blocks
    if (!blocks) return
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i]
      if (b.kind !== 'tool') continue
      blocks[i] = {
        ...b,
        diff: {
          id: `d${++this.n}`,
          file,
          added: lines.filter((l) => l.type === 'add').length,
          removed: lines.filter((l) => l.type === 'del').length,
          lines
        }
      }
      break
    }
    this.flush()
    this.t += ms
  }

  /** 答案也流式进段：收起时它是留在折叠外面的文本 */
  private say(text: string, ms: number): void {
    if (this.cur) this.cur.activity = { kind: 'replying' }
    const id = `a${++this.n}`
    this.stream((acc, done) => ({ kind: 'assistant', id, text: acc, streaming: !done }), text, ms)
  }

  private run(): void {
    // 压测回合放最前面：流式发生在历史已经铺满的情况下，跟真实长会话一致
    for (let i = 0; i < this.rounds; i++) this.filler(i)

    // 第一轮：把 pi 的七个工具各走一遍
    this.beginTurn('把对话块按 ZCode 的样式重做一版，先看现在是怎么渲染的')
    this.think(THINK_A, 2400)
    this.tool(
      'ls',
      '{"path":"src/renderer/src/components"}',
      620,
      'App.tsx\nblocks.tsx\nicons.tsx\nMarkdownView.tsx\nCodeBlock.tsx\nDiffBlock.tsx\nPreview.tsx\nStartPage.tsx'
    )
    this.tool(
      'glob',
      '{"pattern":"src/renderer/**/*.tsx"}',
      700,
      'src/renderer/src/App.tsx\nsrc/renderer/src/components/business/blocks.tsx\nsrc/renderer/src/components/business/transcript/Step.tsx\nsrc/renderer/src/components/business/transcript/TurnView.tsx'
    )
    this.tool('read', '{"path":"src/renderer/src/components/business/blocks.tsx","limit":80}', 850, 'export function BlockView…')
    this.tool(
      'grep',
      '{"pattern":"setState","path":"src/renderer/src"}',
      700,
      'src/renderer/src/useAgent.ts:197: const [blocks, setBlocks] = useState([])\nsrc/renderer/src/useAgent.ts:214: setBlocks(next)'
    )
    this.think(THINK_B, 1600)
    this.tool(
      'bash',
      '{"command":"npm run typecheck"}',
      2200,
      '> pi@0.1.0 typecheck\n> tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json'
    )
    this.tool('edit', '{"path":"src/renderer/src/components/business/blocks.tsx","edits":[{"oldText":"…"}]}', 700, 'applied 1 edit')
    this.diff('src/renderer/src/components/business/blocks.tsx', CODE_DIFF, 900)
    this.tool(
      'write',
      '{"path":"src/renderer/src/components/business/transcript/TurnView.tsx","content":"…"}',
      760,
      'wrote 52 lines'
    )
    this.diff('src/renderer/src/components/business/transcript/TurnView.tsx', WRITE_DIFF, 700)
    this.say(ANSWER_A, 3200)
    this.endTurn()

    // 第二轮：确认可访问性与收尾
    this.beginTurn('性能呢？压测一下长会话')
    this.think('先跑一遍类型检查，再灌 40 个回回合看 DOM 数和帧间隔。', 900)
    this.tool('bash', '{"command":"npm test -- --runInBand"}', 1400, 'No test files found.\nexit 1', true)
    this.tool('bash', '{"command":"npm run typecheck"}', 1800, '> tsc --noEmit\n0 errors')
    this.say(ANSWER_B, 2400)
    this.endTurn()
  }

  /** 压测用的历史回合：一次性铺满，不产生流式帧 */
  private filler(i: number): void {
    this.beginTurn(`第 ${i + 1} 轮的历史问题：检查第 ${(i * 37) % 90} 个文件的引用关系`, 8)
    this.push({
      kind: 'thinking',
      id: `fh${++this.n}`,
      text: `这轮只看 ${i} 号子目录，避免一次读太多文件。`,
      durationMs: 2400,
      level: '最高'
    })
    this.push({ kind: 'tool', id: `ft${++this.n}`, name: 'read', args: '{"path":"src/main/index.ts"}', state: 'done', output: 'const win = new BrowserWindow({ … })' })
    this.push({ kind: 'tool', id: `ft${++this.n}`, name: 'bash', args: '{"command":"git log --oneline -5"}', state: 'done', output: '4e1a8cf style: 主题色阶化' })
    this.push({ kind: 'assistant', id: `fa${++this.n}`, text: `第 ${i + 1} 轮结论：引用关系清晰，没有循环依赖。` })
    this.endTurn()
  }
}

export interface Timeline {
  frames: Frame[]
  total: number
}

export function buildTimeline(rounds = 0): Timeline {
  const s = new Script(rounds)
  return { frames: s.frames, total: s.t }
}
