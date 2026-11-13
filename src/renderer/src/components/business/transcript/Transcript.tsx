import { memo, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  TurnView,
  type Block,
  type ConversationState,
  type MarkdownRenderer,
  type Turn
} from 'agent-design/blocks'
import { MarkdownView } from '../../base/MarkdownView'
import { useEngine } from '../../../store'

/** 回合外的字段用不到（组件只读 state.blocks），给一份常量，别每次渲染新建对象 */
const EMPTY: ConversationState = {
  turns: [],
  blocks: {},
  seq: 0,
  callIndex: {},
  liveMessage: null,
  activeTurn: null,
  liveTools: {}
}

/** 正文的 Markdown 由宿主注入：shiki 高亮、外链走系统浏览器（ADR-0018） */
const renderMarkdown: MarkdownRenderer = (text, streaming) => (
  <MarkdownView text={text} streaming={streaming} />
)

/** 折叠记忆按会话分开：同一个 turn key 在不同会话里不该共用开合状态 */
function scopeOf(viewPath: string | null): string {
  if (!viewPath) return ''
  const name = viewPath.split(/[\\/]/).pop() ?? ''
  return name.replace(/\.jsonl$/, '')
}

/** live 时钟：只有存在 live 回合时才走表，落定后停表（库不自己定时，ADR-0018） */
function useLiveClock(active: boolean): number | undefined {
  const [now, setNow] = useState<number>()
  useEffect(() => {
    if (!active) {
      setNow(undefined)
      return
    }
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [active])
  return now
}

/**
 * 一个回合的块：只挑本回合用到的，浅比较引用。
 * 别的回合的块变了不惊动这个回合，正在流的那一行变了只有它重渲染。
 */
const TurnFrame = memo(function TurnFrame({
  turn,
  scope,
  now
}: {
  turn: Turn
  scope: string
  now: number | undefined
}): ReactNode {
  const blocks = useEngine(
    useShallow((s) => {
      const picked: Record<string, Block> = {}
      // 用户气泡不在 blockIds 里（它渲染在回合头之上），单独补一份
      if (turn.userId !== null) {
        const user = s.byId[turn.userId]
        if (user !== undefined) picked[turn.userId] = user
      }
      for (const id of turn.blockIds) {
        const block = s.byId[id]
        if (block !== undefined) picked[id] = block
      }
      return picked
    })
  )
  const state = useMemo(() => ({ ...EMPTY, blocks }), [blocks])
  return <TurnView turn={turn} state={state} scope={scope} now={now} renderMarkdown={renderMarkdown} />
})

/** 会话正文：只订阅回合坐标，块内容由每个回合自己订阅（行级 memo 继续生效） */
export const Transcript = memo(function Transcript(): ReactNode {
  const turns = useEngine((s) => s.turns)
  const viewPath = useEngine((s) => s.viewPath)
  const scope = scopeOf(viewPath)
  const now = useLiveClock(turns.some((t) => t.status === 'live'))
  return (
    <div className="pi-blocks flex flex-col">
      {turns.map((turn) => (
        <TurnFrame key={turn.key} turn={turn} scope={scope} now={now} />
      ))}
    </div>
  )
})
