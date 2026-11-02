import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Sidebar, CollapsedHeaderBar } from './components/Sidebar'
import { TitleBar } from './components/TitleBar'
import { StartPage } from './components/StartPage'
import { ChatComposer } from './components/Composer'
import { MessageActions, TranscriptStack, lastText } from './components/blocks'
import { Gallery } from './components/Gallery'
import { AskCard } from './components/AskCard'
import { UiPrompt } from './components/UiPrompt'
import { Toasts } from './components/Toasts'
import { IconSpinner } from './components/icons'
import { toMarkdown } from './exportMarkdown'
import { useAgent } from './useAgent'

type Route = 'start' | 'chat' | 'gallery'

/** 导航历史：后退/前进按栈走，切会话不重复压栈 */
interface Place {
  route: Route
  id: string | null
}

export default function App(): ReactNode {
  const agent = useAgent()
  const [collapsed, setCollapsed] = useState(false)
  const [place, setPlace] = useState<Place>({ route: 'start', id: null })
  const past = useRef<Place[]>([])
  const future = useRef<Place[]>([])
  const [, bump] = useState(0)
  const route = place.route
  const activeId = place.id
  const toggle = (): void => setCollapsed((v) => !v)

  /** 压栈后跳转；同位置不压 */
  const go = (next: Place): void => {
    setPlace((prev) => {
      if (prev.route === next.route && prev.id === next.id) return prev
      past.current.push(prev)
      future.current = []
      return next
    })
    bump((v) => v + 1)
  }

  const back = (): void => {
    const prev = past.current.pop()
    if (!prev) return
    future.current.push(place)
    setPlace(prev)
    bump((v) => v + 1)
  }

  const forward = (): void => {
    const next = future.current.pop()
    if (!next) return
    past.current.push(place)
    setPlace(next)
    bump((v) => v + 1)
  }

  useEffect(() => {
    if (location.hash === '#gallery') setPlace({ route: 'gallery', id: null })
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggle()
      }
      // Ctrl+N 新建任务
      if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        agent.newSession()
        setPlace({ route: 'start', id: null })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [agent])

  const current = agent.sessions.find((s) => s.id === activeId)

  const send = (text: string): void => {
    agent.prompt(text)
    go({ route: 'chat', id: activeId })
  }

  const openSession = (id: string, path: string): void => {
    agent.openSession(path)
    go({ route: 'chat', id })
  }

  const answerText = lastText(agent.blocks)

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {!collapsed && (
        <Sidebar
          onCollapse={toggle}
          onNavigate={(r) => go({ route: r, id: null })}
          projects={agent.projects}
          sessions={agent.sessions}
          sessionsLoading={agent.sessionsLoading}
          activeId={activeId}
          runningPath={agent.runningPath}
          unread={agent.unread}
          onOpenSession={openSession}
          onNewSession={() => {
            agent.newSession()
            go({ route: 'start', id: null })
          }}
          onRename={agent.renameSession}
          onDelete={(path) => {
            agent.deleteSession(path)
            // 删的若是当前看着的会话，宿主已切到新会话，界面回到起始页
            if (current?.path === path) go({ route: 'start', id: null })
          }}
          canBack={past.current.length > 0}
          canForward={future.current.length > 0}
          onBack={back}
          onForward={forward}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col p-[6px]">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[12px] border border-edge bg-panel shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.18)]">
          {collapsed && (
            <CollapsedHeaderBar
              onExpand={toggle}
              canBack={past.current.length > 0}
              canForward={future.current.length > 0}
              onBack={back}
              onForward={forward}
            />
          )}
          <TitleBar
            collapsed={collapsed}
            title={current?.title}
            showTitle={route === 'chat'}
            sessionPath={current?.path}
            onExport={() =>
              current && window.pi?.host.saveText(`${current.title}.md`, toMarkdown(agent.blocks))
            }
            onClearError={agent.clearError}
            error={agent.error}
          />
          <main className="min-h-0 flex-1 overflow-hidden">
            {route === 'start' && <StartPage agent={agent} onSubmit={send} />}
            {route === 'gallery' && <Gallery />}
            {route === 'chat' && <ChatView agent={agent} answerText={answerText} />}
          </main>
        </div>
      </div>
      {/* 弹窗与提示放在最外层：起始页上的工具确认也要能看到 */}
      {agent.ui[0] && <UiPrompt req={agent.ui[0]} onReply={agent.replyUi} />}
      <Toasts items={agent.toasts} />
    </div>
  )
}
function ChatView({
  agent,
  answerText
}: {
  agent: ReturnType<typeof useAgent>
  answerText: string
}): ReactNode {
  const scroller = useRef<HTMLDivElement>(null)
  // 流式时跟到底部，用户往上翻就松手
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160
    if (nearBottom) el.scrollTop = el.scrollHeight
  }, [agent.blocks])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[820px] px-8 pt-1 pb-8">
          {agent.blocks.length === 0 ? (
            <p className="pt-10 text-center text-[13px] text-faint">
              {agent.busy ?? '这个会话还没有内容'}
            </p>
          ) : (
            <>
              <TranscriptStack blocks={agent.blocks} />
              {!agent.streaming && (
                <div className="mt-3 pl-1">
                  <MessageActions
                    text={answerText || toMarkdown(agent.blocks)}
                    time={agent.settledAt ? new Date(agent.settledAt).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="mx-auto w-full max-w-[820px] px-8 pb-4">
        {agent.busy && (
          <p className="mb-2 flex items-center gap-2 text-[12.5px] text-muted">
            <IconSpinner />
            {agent.busy}…
          </p>
        )}
        {agent.asks[0] && (
          <div className="mb-2">
            <AskCard
              id={agent.asks[0].id}
              questions={agent.asks[0].questions}
              onAnswer={agent.answerAsk}
              onCancel={agent.cancelAsk}
            />
          </div>
        )}
        <ChatComposer
          snapshot={agent.snapshot}
          models={agent.models}
          streaming={agent.streaming}
          onSubmit={agent.prompt}
          onAbort={agent.abort}
          onModel={agent.setModel}
          onLevel={agent.setThinkingLevel}
          files={agent.files}
          onQueryFiles={agent.queryFiles}
          commands={agent.commands}
          onAccess={agent.toggleAccess}
        />
      </div>
    </div>
  )
}