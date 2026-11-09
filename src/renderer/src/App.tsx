import { useEffect, useRef, useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { Sidebar } from './components/business/Sidebar'
import { Projects } from './components/business/Projects'
import { TitleBar, CollapseButton } from './components/business/TitleBar'
import { StartPage } from './components/business/StartPage'
import { ChatComposer } from './components/business/Composer'
import { MessageActions, lastText } from './components/business/blocks'
import { Transcript, WorkingDots } from './components/business/transcript/Transcript'
import { Preview } from './components/business/Preview'
import { AskCard } from './components/business/AskCard'
import { UiPrompt } from './components/business/UiPrompt'
import { Toasts } from './components/base/Toasts'
import { IconArrowDown, IconArrowLeft, IconArrowRight, IconSpinner } from './components/base/icons'
import { Button } from './components/base/Button'
import { toMarkdown } from './exportMarkdown'
import { useAgent } from './useAgent'
import { useScrollRail } from './useScrollRail'

type Route = 'start' | 'chat' | 'gallery' | 'projects'

/** 导航历史：后退/前进按栈走，切会话不重复压栈 */
type Place = {
  route: Route
  id: string | null
}

/** 离底余量：只有它一处判断，滚动与跟随共用 */
const bottomGap = (el: HTMLElement): number => el.scrollHeight - el.scrollTop - el.clientHeight

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
      // Esc 停止生成；输入框/弹层自己认领的 Esc 会先 preventDefault
      if (e.key === 'Escape' && !e.isComposing && !e.defaultPrevented && agent.streaming) agent.abort()
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
    <div className="relative flex h-screen overflow-hidden bg-canvas">
      <Sidebar
        collapsed={collapsed}
        onNavigate={(r) => go({ route: r, id: null })}
          projects={agent.projects}
          sessions={agent.sessions}
          activeId={activeId}
          unread={agent.unread}
          onOpenSession={openSession}
          onNewSession={() => {
            agent.newSession()
            go({ route: 'start', id: null })
          }}
          onNewSessionIn={(path) => {
            agent.switchWorkspace(path)
            go({ route: 'start', id: null })
          }}
          onRemoveProject={agent.removeProject}
          onRename={agent.renameSession}
          onDelete={(path) => {
            agent.deleteSession(path)
            // 删的若是当前看着的会话，宿主已切到新会话，界面回到起始页
            if (current?.path === path) go({ route: 'start', id: null })
          }}
        />

      {/* 展开时主卡片贴住侧栏右缘，侧栏分隔线与卡片左边框连成一条贯穿线；收起时四边留相等边距 */}
      <div
        className={clsx(
          'flex min-w-0 flex-1 flex-col p-1 transition-[padding] duration-150 ease-out motion-reduce:transition-none',
          !collapsed && 'pl-0'
        )}
      >
        <div className="pi-panel relative flex min-h-0 flex-1 flex-col overflow-hidden shadow-card">
          <TitleBar
            reserveLeft={collapsed}
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
            {route === 'gallery' && <Preview />}
            {route === 'projects' && (
              <Projects
                rows={agent.projectRows}
                onRemove={agent.removeProject}
                onRestore={agent.restoreProject}
                onDelete={agent.deleteProject}
              />
            )}
            {route === 'chat' && <ChatView agent={agent} answerText={answerText} scope={activeId ?? 'new'} />}
          </main>
        </div>
      </div>
      {/* 弹窗与提示放在最外层：起始页上的工具确认也要能看到 */}
      {agent.ui[0] && <UiPrompt req={agent.ui[0]} onReply={agent.replyUi} />}
      <Toasts items={agent.toasts} />
      {/* 品牌 / 前进后退浮在最上层：侧栏展开收起都在同一位置，只换箭头方向，不会因布局变化跳位。
          DOM 必须排在 TitleBar 之后：Windows 按 DOM 顺序算拖拽区，后来的 no-drag 才能把先前的 drag 挖掉 */}
      <div
        className="absolute top-1 left-3 z-30 flex h-11 items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <CollapseButton collapsed={collapsed} onClick={toggle} />
        <Button
          aria-label="后退"
          variant="ghost"
          disabled={past.current.length === 0}
          onClick={back}
          icon={<IconArrowLeft />}
        />
        <Button
          aria-label="前进"
          variant="ghost"
          disabled={future.current.length === 0}
          onClick={forward}
          icon={<IconArrowRight />}
        />
      </div>
    </div>
  )
}
function ChatView({
  agent,
  answerText,
  scope
}: {
  agent: ReturnType<typeof useAgent>
  answerText: string
  scope: string
}): ReactNode {
  const scroller = useRef<HTMLDivElement>(null)
  const rail = useScrollRail()
  // 离底部超过这个余量才给回到最新，避免小波动一直闪
  const AWAY = 120
  const [away, setAway] = useState(false)
  // 内容尺寸变化就重算：流式跟底，翻上去就松手，并给「回到最新」。
  // 用 ResizeObserver 而不是依赖 blocks：markdown / 高亮 / 图片都是异步长高的，没有滚动事件
  useEffect(() => {
    const el = scroller.current
    // ChatView 恒渲染 .pi-page 包裹层，首个子元素就是内容根
    const content = el?.firstElementChild
    if (!el || !content) return
    const sync = (): void => {
      const height = el.scrollHeight // 每次重算只读一次，避免重复强制布局
      const gap = height - el.scrollTop - el.clientHeight
      if (gap < AWAY) el.scrollTop = height
      setAway(gap >= AWAY)
    }
    const ro = new ResizeObserver(sync)
    ro.observe(content)
    ro.observe(el) // 窗口高度变了也要重算
    sync()
    return () => ro.disconnect()
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          className="rail-scroll h-full overflow-y-auto"
          onScroll={(e) => {
            setAway(bottomGap(e.currentTarget) >= AWAY)
          }}
          {...rail}
        >
        <div className="pi-page">
          {agent.blocks.length === 0 ? (
            <p className="pt-10 text-center text-xs text-faint">
              {agent.busy ?? '这个会话还没有内容'}
            </p>
          ) : (
            <>
              <Transcript blocks={agent.blocks} streaming={agent.streaming} />
              {(agent.streaming || agent.busy) && <WorkingDots />}
              {!agent.streaming && (
                <div className="mt-2 pl-1">
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
        {away && (
          <Button
            aria-label="回到最新"
            title="回到最新"
            variant="raised"
            shape="circle"
            className="absolute bottom-4 left-1/2 -translate-x-1/2"
            onClick={() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })}
            icon={<IconArrowDown />}
          />
        )}
      </div>
      <div className="mx-auto w-full max-w-[820px] px-8 pb-4">
        {agent.busy && (
          <p className="mb-2 flex items-center gap-2 text-xs text-muted">
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
          scope={scope}
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
          onSwitchWorkspace={agent.switchWorkspace}
          workspaces={agent.workspaces}
        />
      </div>
    </div>
  )
}