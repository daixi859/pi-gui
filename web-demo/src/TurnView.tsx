import { useEffect, useMemo, useRef } from 'react'
import { UserMessageBubble } from '../ocu/ChatMessageBubbles'
import { ThinkingAccordion } from '../ocu/ThinkingAccordion'
import { deriveTurn } from './blocks'
import { AssistantText } from './AssistantText'
import { ToolStep } from './ToolStep'
import { useTurnReplay, type ReplayState } from './replay'
import { fmtTime, userText } from './turns'
import type { AssistantMessage, Turn } from './types'

/** 单条助手消息的派生块：重放中和静态全量走同一个 deriveTurn，工具/流式状态全部从消息算 */
function AssistantBlocks({
  turn,
  items,
  state,
  firstAssistant
}: {
  turn: Turn
  items: Turn['items']
  state: ReplayState | null
  firstAssistant: AssistantMessage | null
}) {
  const derived = useMemo(() => deriveTurn({ items, durations: turn.durations }), [items, turn.durations])
  let headerShown = false

  return (
    <div className="flex max-w-[720px] flex-col gap-2">
      {derived.blocks.map((block) => {
        const showHeader = !!firstAssistant && block.ts === firstAssistant.timestamp && !headerShown
        if (showHeader) headerShown = true

        if (block.kind === 'thinking') {
          const live = block.streaming
          return (
            <div key={block.id}>
              {showHeader && <PiHeader msg={firstAssistant} />}
              <ThinkingAccordion
                thoughtText={block.text}
                isThinkingLive={live}
                elapsedMs={live ? (state?.thinkingMs ?? 0) : (block.durationMs ?? 0)}
              />
            </div>
          )
        }

        if (block.kind === 'text') {
          return (
            <div key={block.id}>
              {showHeader && <PiHeader msg={firstAssistant} />}
              <AssistantText text={block.text} streaming={block.streaming} />
            </div>
          )
        }

        return (
          <div key={block.id}>
            {showHeader && <PiHeader msg={firstAssistant} />}
            <ToolStep block={block} />
          </div>
        )
      })}
    </div>
  )
}

function PiHeader({ msg }: { msg: AssistantMessage | null }) {
  if (!msg) return null
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--cds-text-muted)]">
      <span className="flex size-5 items-center justify-center rounded-md bg-clay font-serif text-[10px] font-bold text-white">
        ✦
      </span>
      <span className="font-semibold text-[var(--cds-text-primary)]">Pi</span>
      <span className="rounded bg-[var(--cds-alpha-1)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--cds-text-secondary)]">
        {msg.model}
      </span>
      <span className="font-mono text-[11px]">{fmtTime(msg.timestamp)}</span>
    </div>
  )
}

/** 一轮对话：用户气泡 + 派生块；重放时按 pi 事件序列逐步推进消息 */
export function TurnView({
  turn,
  onTick,
  autoPlay = false
}: {
  turn: Turn
  onTick: () => void
  autoPlay?: boolean
}) {
  const { state, playing, play, stop } = useTurnReplay(turn, autoPlay)
  const rootRef = useRef<HTMLElement>(null)

  const items = state ? state.items : turn.items
  const firstAssistant = useMemo(() => {
    const first = items.find((m) => m.role === 'assistant')
    return first && first.role === 'assistant' ? first : null
  }, [items])

  // 重放每推进一步都通知父级，让滚动图钉跟随内容高度变化
  useEffect(() => {
    onTick()
  }, [state, onTick])

  // Esc 停止本轮的流式重放（不打断弹窗与抽屉的 Esc 行为）
  useEffect(() => {
    if (!playing) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[role="dialog"]')) stop()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [playing, stop])

  const startReplay = () => {
    play()
    // 内容折叠后回到本轮开头，避免视线停留在旧的底部位置
    const reduceMotion = document.documentElement.dataset.reduceMotion === 'true'
    const anchor = () =>
      rootRef.current?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' })
    requestAnimationFrame(anchor)
    window.setTimeout(anchor, 140)
  }

  return (
    <section ref={rootRef} className="flex flex-col gap-4 scroll-mt-4">
      <UserMessageBubble text={userText(turn.user)} time={fmtTime(turn.user.timestamp)} />

      <AssistantBlocks turn={turn} items={items} state={state} firstAssistant={firstAssistant} />

      <div className="flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={playing ? stop : startReplay}
          title={playing ? '停止重放（Esc）' : '按 pi 事件顺序播放这一轮的思考与工具调用'}
          className={
            playing
              ? 'flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--cds-border)] bg-[var(--cds-surface-popover)] px-2.5 py-1 font-medium text-[var(--cds-text-secondary)] shadow-[var(--cds-shadow-xs)] transition-colors hover:border-[var(--cds-border-strong)] hover:text-[var(--cds-text-primary)]'
              : 'cursor-pointer rounded-md px-2 py-1 font-medium text-[var(--cds-text-secondary)] transition-colors hover:bg-[var(--cds-alpha-1)] hover:text-[var(--cds-text-primary)]'
          }
        >
          {playing && <span className="size-1.5 animate-pulse rounded-full bg-[var(--cds-clay)]" />}
          {playing ? '停止重放' : state ? '再次重放' : '重放这一轮'}
        </button>
      </div>
    </section>
  )
}
