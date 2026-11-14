import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { Sidebar } from './components/business/Sidebar'
import { Projects } from './components/business/Projects'
import { TitleBar, CollapseButton } from './components/business/TitleBar'
import { StartPage } from './components/business/StartPage'
import { ChatComposer } from './components/business/Composer'
import { MessageActions } from './components/business/MessageActions'
import { Transcript } from './components/business/transcript/Transcript'
import { Preview } from './components/business/Preview'
import { AskCard } from './components/business/AskCard'
import { UiPrompt } from './components/business/UiPrompt'
import { Button, IconArrowDown, IconArrowLeft, IconArrowRight, IconSpinner, Toasts } from 'agent-design/components'
import { RunningStatus } from 'agent-design/blocks'
import { toMarkdown } from './exportMarkdown'
import { blocksOf } from './store'
import {
  abort,
  answerAsk,
  cancelAsk,
  clearError,
  deleteSession,
  newSession,
  openSession,
  prompt,
  replyUi,
  switchWorkspace,
  useEngine
} from './store'
import { useScrollRail } from './useScrollRail'
import { count } from './perf'

type Route = 'start' | 'chat' | 'gallery' | 'projects'

/** 导航历史：后退/前进按栈走，切会话不重复压栈 */
type Place = {
  route: Route
  id: string | null
}

/** 离底余量：只有它一处判断，滚动与跟随共用 */
const bottomGap = (el: HTMLElement): number => el.scrollHeight - el.scrollTop - el.clientHeight

export default function App(): ReactNode {
  count('app')
  const [collapsed, setCollapsed] = useState(false)
  const [place, setPlace] = useState<Place>({ route: 'start', id: null })
  const past = useRef<Place[]>([])
  const future = useRef<Place[]>([])
  const [, bump] = useState(0)
  const route = place.route
  const activeId = place.id
  // 只选真正影响外壳的两个字段：流式状态与错误条。正文一概不进这里
  const streaming = useEngine((s) => s.streaming)
  const error = useEngine((s) => s.error)
  // 先只订 sessions（引用只在 sessions 事件时变），find 再 memo 一次：
  // 否则每个 delta 的 set 都会跑一遍 O(n) 的 selector
  const sessions = useEngine((s) => s.sessions)
  const current = useMemo(() => sessions.find((x) => x.id === activeId), [sessions, activeId])
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
        newSession()
        setPlace({ route: 'start', id: null })
      }
      // Esc 停止生成；输入框/弹层自己认领的 Esc 会先 preventDefault
      if (e.key === 'Escape' && !e.isComposing && !e.defaultPrevented && useEngine.getState().streaming) {
        abort()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const send = (text: string): void => {
    prompt(text)
    go({ route: 'chat', id: activeId })
  }

  const open = (id: string, path: string): void => {
    openSession(path)
    go({ route: 'chat', id })
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-canvas">
      <Sidebar
        collapsed={collapsed}
        onNavigate={(r) => go({ route: r, id: null })}
        activeId={activeId}
        onOpenSession={open}
        onNewSession={() => {
          newSession()
          go({ route: 'start', id: null })
        }}
        onNewSessionIn={(path) => {
          switchWorkspace(path)
          go({ route: 'start', id: null })
        }}
        onDelete={(path) => {
          deleteSession(path)
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
              current && window.pi?.host.saveText(`${current.title}.md`, toMarkdown(blocksOf()))
            }
            onClearError={clearError}
            error={error}
          />
          <main className="min-h-0 flex-1 overflow-hidden">
            {route === 'start' && <StartPage onSubmit={send} />}
            {route === 'gallery' && <Preview />}
            {route === 'projects' && <Projects />}
            {route === 'chat' && (
              <ChatView streaming={streaming} scope={activeId ?? 'new'} />
            )}
          </main>
        </div>
      </div>
      {/* 弹窗与提示放在最外层：起始页上的工具确认也要能看到 */}
      <UiPromptHost />
      <ToastsHost />
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

/** 裸 UI 请求（select / input / confirm / editor）：一次只显示队首 */
function UiPromptHost(): ReactNode {
  const req = useEngine((s) => s.ui[0])
  if (!req) return null
  return <UiPrompt req={req} onReply={replyUi} />
}


/** 扩展通知：自动消失的计时在 store/interaction.ts 里 */
function ToastsHost(): ReactNode {
  const items = useEngine((s) => s.toasts)
  return <Toasts items={items} />
}

/** 会话页：正文之外只有孤立的动作条、工作指示与输入卡需要状态，各自订阅自己那一份 */
function ChatView({ streaming, scope }: { streaming: boolean; scope: string }): ReactNode {
  const scroller = useRef<HTMLDivElement>(null)
  const rail = useScrollRail()
  const empty = useEngine((s) => s.turns.length === 0)
  const busy = useEngine((s) => s.busy)
  // 已有 live 回时鲸鱼由 TurnView 自己画在回合尾部，这里只补「还没成形的那一段」
  const live = useEngine((s) => s.turns.some((t) => t.status === 'live'))
  // 开局：一轮刚发出去，回合还没成形（连 user 块都还没到）时正文全是空的，
  // 也要能看见正在工作，别只留一句「这个会话还没有内容」让人以为没发出去
  const starting = streaming && !live
  const ask = useEngine((s) => s.asks[0])
  // 离底部超过这个余量才给回到最新，避免小波动一直闪
  const AWAY = 120
  const [away, setAway] = useState(false)
  // 内容尺寸变化就重算：流式跟底，翻上去就松手，并给「回到最新」。
  // 用 ResizeObserver 而不是依赖正文：markdown / 高亮 / 图片都是异步长高的，没有滚动事件
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
            {empty && !streaming ? (
              <p className="pt-10 text-center text-xs text-faint">{busy ?? '这个会话还没有内容'}</p>
            ) : (
              <>
                <Transcript />
                {starting && (
                  <div className="pi-blocks">
                    <RunningStatus />
                  </div>
                )}
                {!streaming && <AnswerActions />}
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
        {busy && (
          <p className="mb-2 flex items-center gap-2 text-xs text-muted">
            <IconSpinner />
            {busy}…
          </p>
        )}
        {ask && (
          <div className="mb-2">
            <AskCard id={ask.id} questions={ask.questions} onAnswer={answerAsk} onCancel={cancelAsk} />
          </div>
        )}
        <ChatComposer scope={scope} onSubmit={prompt} />
      </div>
    </div>
  )
}

/**
 * 动作条：只在回合结束后出现。
 * 导出用的 markdown 在点击时才拼（store 里只留最后一段回答的纯文本）。
 */
function AnswerActions(): ReactNode {
  const settledAt = useEngine((s) => s.settledAt)
  const answerText = useEngine((s) => s.answerText)
  return (
    <div className="mt-2 pl-1">
      <MessageActions
        text={answerText}
        full={() => toMarkdown(blocksOf())}
        time={settledAt ? new Date(settledAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}
      />
    </div>
  )
}
