import { useCallback, useEffect, useRef, useState } from 'react'
import { useClaudeScrollPinning } from '../ocu/useClaudeScrollPinning'
import { Composer } from './Composer'
import { TurnView } from './TurnView'
import { fmtBytes } from './format'
import type { SessionMock, Turn } from './types'
import { Icon } from './ui/Icon'

const SUGGESTIONS = [
  {
    title: '这个 PowerShell 为什么失败？',
    hint: '把错误输出贴进来，一起看 exit code',
    prompt: '帮我看看这个 PowerShell 命令为什么失败，错误是：'
  },
  {
    title: '把这次改动整理成提交说明',
    hint: '从当前会话里提取变更点和风险',
    prompt: '把这次会话里的改动整理成一段提交说明，列清楚变更点和风险。'
  },
  {
    title: '帮我读一下 Electron 主进程',
    hint: '先定位入口，再列出值得注意的地方',
    prompt: '帮我读一下这个项目的 Electron 主进程，先定位入口，再列出值得注意的地方。'
  },
  {
    title: '跑一遍 typecheck 并修复',
    hint: '逐条处理类型错误',
    prompt: '跑一遍 typecheck，把报错逐条修掉，最后再跑一次确认。'
  }
]

export function ChatPage({
  session,
  turns,
  isDraft,
  onSend
}: {
  session: SessionMock
  turns: Turn[]
  isDraft: boolean
  onSend: (text: string) => void
}) {
  const [draft, setDraft] = useState('')
  const [focusSignal, setFocusSignal] = useState(0)
  const [tick, setTick] = useState(0)

  // 只有组件挂载后新增的轮次才自动回放；历史消息保持静态
  const seenTurns = useRef<Set<string> | null>(null)
  if (seenTurns.current === null) {
    seenTurns.current = new Set(turns.map((turn) => turn.user.id))
  }
  const [autoPlayIds, setAutoPlayIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    const seen = seenTurns.current
    if (!seen) return
    const fresh = turns.filter((turn) => !seen.has(turn.user.id))
    if (fresh.length === 0) return
    for (const turn of fresh) seen.add(turn.user.id)
    setAutoPlayIds((prev) => new Set([...prev, ...fresh.map((turn) => turn.user.id)]))
  }, [turns])

  const bump = useCallback(() => setTick((t) => t + 1), [])

  const { containerRef, showJumpControl, markUserInput, handleScroll, scrollToBottom } =
    useClaudeScrollPinning([turns.length, tick])

  const send = (text: string) => {
    onSend(text)
    setDraft('')
    // 发送后跟随新回复；即使此前向上滚动也强制回到底部
    window.setTimeout(() => scrollToBottom(true), 0)
  }

  const useSuggestion = (prompt: string) => {
    setDraft(prompt)
    setFocusSignal((n) => n + 1)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          onWheel={markUserInput}
          onTouchStart={markUserInput}
          onKeyDown={markUserInput}
          className="h-full overflow-y-auto"
        >
          {turns.length === 0 ? (
            <div className="flex h-full items-center justify-center px-5 py-10">
              <div className="w-full max-w-[560px] -translate-y-4 text-center">
                <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-[var(--cds-clay)] text-xl font-semibold text-white shadow-[var(--cds-shadow-sm)]">
                  π
                </div>
                <h2 className="mt-4 text-[22px] font-semibold tracking-tight text-[var(--cds-text-primary)]">
                  有什么可以帮你的？
                </h2>
                <p className="mx-auto mt-2 max-w-[420px] text-xs leading-5 text-[var(--cds-text-secondary)]">
                  这是一个 web demo：发送消息会生成一轮带思考、工具调用和流式文字的 mock
                  回复，不会真的执行命令。
                </p>

                <div className="mt-6 grid gap-2 text-left sm:grid-cols-2">
                  {SUGGESTIONS.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => useSuggestion(item.prompt)}
                      className="group flex cursor-pointer flex-col rounded-xl border border-[var(--cds-border)] bg-[var(--cds-surface-1)] px-3 py-2.5 text-left transition-colors hover:border-[var(--cds-border-strong)] hover:bg-[var(--cds-alpha-1)]"
                    >
                      <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--cds-text-primary)]">
                        <span className="min-w-0 truncate">{item.title}</span>
                        <Icon
                          name="arrow-right"
                          size={11}
                          className="ml-auto shrink-0 text-[var(--cds-text-muted)] opacity-0 transition-opacity group-hover:opacity-100"
                        />
                      </span>
                      <span className="mt-1 text-[10px] leading-4 text-[var(--cds-text-muted)]">
                        {item.hint}
                      </span>
                    </button>
                  ))}
                </div>

                <p className="mt-5 text-[10px] text-[var(--cds-text-muted)]">
                  {isDraft ? '草稿会话 · 消息只保存在本次演示中' : '数据来自本机 pi 历史会话'}
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[820px] px-5 pb-[28vh] pt-6 md:px-8">
              <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--cds-border)] pb-3 text-[10px] text-[var(--cds-text-muted)]">
                <span className="flex min-w-0 items-center gap-1">
                  <Icon name="folder" size={11} className="shrink-0" />
                  <span className="truncate font-mono">{session.cwd}</span>
                </span>
                <span className="tabular-nums">{session.turnCount} 轮</span>
                <span className="tabular-nums">{session.messageCount} 条消息</span>
                <span className="tabular-nums">{fmtBytes(session.bytes)}</span>
                <span className="ml-auto hidden items-center gap-1 sm:flex">
                  <span className="size-1.5 rounded-full bg-emerald-500/80" />
                  已加载本地 mock
                </span>
              </div>

              <div className="chat-turn-list flex flex-col gap-8">
                {turns.map((turn) => (
                  <TurnView
                    key={turn.user.id}
                    turn={turn}
                    onTick={bump}
                    autoPlay={autoPlayIds.has(turn.user.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {showJumpControl && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--cds-border)] bg-[var(--cds-surface-popover)] px-3 py-1.5 text-[11px] font-medium text-[var(--cds-text-secondary)] shadow-[var(--cds-shadow-md)] transition-colors hover:text-[var(--cds-text-primary)]"
          >
            <Icon name="arrow-down" size={12} />
            跳至最新
          </button>
        )}
      </div>

      <div className="shrink-0 bg-[var(--cds-surface-1)]">
        <div className="mx-auto w-full max-w-[820px] px-4 pb-3 pt-2 md:px-8">
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={send}
            focusSignal={focusSignal}
          />
          <p className="mt-2 text-center text-[9px] text-[var(--cds-text-muted)]">
            Pi 可能会出错，请检查生成的命令与代码。
          </p>
        </div>
      </div>
    </div>
  )
}
