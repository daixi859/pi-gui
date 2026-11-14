import { clsx } from 'clsx'
import { useState, type ReactNode } from 'react'
import { TurnView } from 'agent-design/blocks'
import { previewLive, previewSettled } from '../../previewTurns'
import { ComposerCard } from './Composer'
import { AskCard } from './AskCard'
import { UiPrompt } from './UiPrompt'

/**
 * 开发期业务组件预览：输入卡、提问卡、回合与对话块、确认弹窗。
 * 基础组件（按钮、菜单、图标）与令牌面板在 agent-design 的组件预览页，这里不重复。
 */

type Category = 'inputs' | 'display' | 'dialogs' | 'transcript'

const CATEGORIES: Array<{ id: Category; label: string }> = [
  { id: 'inputs', label: '输入' },
  { id: 'display', label: '展示' },
  { id: 'dialogs', label: '弹窗' },
  { id: 'transcript', label: '对话块' }
]

const MOCK_QUESTIONS = [
  {
    header: '权限确认',
    question: '执行这个方案前，需要你确认一件事',
    multiSelect: false,
    options: [
      { label: '直接修改接口', description: '改动面小，但需要重启宿主' },
      { label: '先加适配层', description: '兼容旧调用，改动更多' }
    ]
  }
]

function Chip({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-sm border px-2 py-0.5 text-xs transition-colors',
        active ? 'border-edge bg-select text-fg' : 'border-transparent text-muted hover:bg-sunken'
      )}
    >
      {children}
    </button>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted">{title}</h3>
      {children}
    </section>
  )
}

function InputsDemo(): ReactNode {
  const [text, setText] = useState('')
  return (
    <div className="flex flex-col gap-6">
      <Section title="输入框">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="搜索任务标题"
          className="pi-input w-[280px]"
        />
      </Section>
      <Section title="输入卡（起始页大卡）">
        <ComposerCard scope="preview" onSubmit={() => undefined} />
      </Section>
      <Section title="提问卡">
        <AskCard id="preview-ask" questions={MOCK_QUESTIONS} onAnswer={() => undefined} onCancel={() => undefined} />
      </Section>
    </div>
  )
}

function DisplayDemo(): ReactNode {
  return (
    <div className="flex flex-col gap-6">
      <Section title="回合 · 已落定（过程分组 + 修改文件）">
        <div className="pi-blocks">
          <TurnView turn={previewSettled.turn} state={previewSettled.state} scope="preview" defaultOpen />
        </div>
      </Section>
      <Section title="回合 · 运行中（走表计时）">
        <div className="pi-blocks">
          <TurnView turn={previewLive.turn} state={previewLive.state} scope="preview" now={previewLive.now} />
        </div>
      </Section>
    </div>
  )
}

function DialogsDemo(): ReactNode {
  const [prompt, setPrompt] = useState(false)
  return (
    <div className="flex flex-col gap-6">
      <Section title="工具确认弹窗">
        <div className="flex gap-2">
          <Chip active={prompt} onClick={() => setPrompt((v) => !v)}>
            {prompt ? '关闭弹窗' : '打开弹窗'}
          </Chip>
        </div>
      </Section>
      {prompt && (
        <UiPrompt
          req={{
            id: 'preview-confirm',
            kind: 'confirm',
            title: '允许执行 write？',
            message: '{"path":"src/renderer/src/App.tsx","content":"…"}'
          }}
          onReply={() => setPrompt(false)}
        />
      )}
    </div>
  )
}

function TranscriptDemo(): ReactNode {
  return (
    <div className="flex flex-col gap-6">
      <Section title="完整回合（对话块来自 agent-design/blocks）">
        <div className="pi-blocks">
          <TurnView turn={previewSettled.turn} state={previewSettled.state} scope="preview" />
        </div>
      </Section>
      <Section title="展开过程块">
        <div className="pi-blocks">
          <TurnView turn={previewSettled.turn} state={previewSettled.state} scope="preview-open" defaultOpen />
        </div>
      </Section>
    </div>
  )
}

/* ---------------- 页面 ---------------- */

export function Preview(): ReactNode {
  const [active, setActive] = useState<Category>('inputs')
  return (
    <div className="flex h-full">
      <nav className="w-[168px] shrink-0 overflow-y-auto border-r border-edge py-3">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActive(c.id)}
            className={clsx(
              'block w-full px-4 py-1.5 text-left text-xs transition-colors hover:bg-sunken',
              c.id === active ? 'font-medium text-fg' : 'text-muted'
            )}
          >
            {c.label}
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[860px] px-8 py-6">
          {active === 'inputs' && <InputsDemo />}
          {active === 'display' && <DisplayDemo />}
          {active === 'dialogs' && <DialogsDemo />}
          {active === 'transcript' && <TranscriptDemo />}
        </div>
      </div>
    </div>
  )
}
