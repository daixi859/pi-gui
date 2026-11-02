import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Snapshot } from '@shared/blocks'
import type { ModelOption } from '@shared/ipc'
import { MenuItem, MenuLabel, MenuPanel, MenuScrim } from './Menu'
import { IconArrowUp, IconBranch, IconChevronDown, IconFolder, IconHand, IconPlus } from './icons'

const LEVEL_LABEL: Record<string, string> = {
  off: '关闭',
  minimal: '最低',
  low: '低',
  medium: '中',
  high: '高',
  xhigh: '很高',
  max: '最高'
}

const ghost = 'flex items-center gap-1 rounded-[7px] px-1.5 py-1 text-[12.5px] hover:bg-sunken'

/** 输入卡顶部的项目 / 分支条 */
function WorkspaceBar({ snapshot }: { snapshot: Snapshot }): ReactNode {
  return (
    <div className="flex items-center gap-0.5 rounded-t-[13px] bg-[#f0f0f0] px-2 py-1.5 text-[12.5px] text-muted">
      <span className="flex items-center gap-1.5 rounded-[6px] px-1.5 py-0.5">
        <IconFolder className="size-[14px]" />
        {snapshot.cwd}
      </span>
      <span className="flex items-center gap-1.5 rounded-[6px] px-1.5 py-0.5">
        <IconBranch className="size-[14px]" />
        {snapshot.branch}
      </span>
      <button type="button" aria-label="添加工作区" className="grid size-6 place-items-center rounded-[6px] hover:bg-black/5">
        <IconPlus className="size-[14px]" />
      </button>
    </div>
  )
}

function Toolbar({
  snapshot,
  streaming,
  onModel,
  onSend,
  onAbort,
  onAttach
}: {
  snapshot: Snapshot
  streaming: boolean
  onModel: () => void
  onSend: () => void
  onAbort: () => void
  onAttach: () => void
}): ReactNode {
  return (
    <div className="flex items-center gap-1.5 px-2.5 pt-1 pb-2">
      <button
        type="button"
        aria-label="添加附件"
        onClick={onAttach}
        className="grid size-7 place-items-center rounded-full text-muted hover:bg-sunken hover:text-fg"
      >
        <IconPlus />
      </button>
      <span className={ghost}>
        <IconHand className="size-[14px]" />
        {snapshot.access}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        <button type="button" onClick={onModel} className={ghost}>
          <span className="size-[13px] rounded-full border-2 border-[#bcdcc6]" />
          <span className="font-medium text-fg">{snapshot.model}</span>
          <span className="text-muted">{snapshot.thinkingLevel}</span>
          <IconChevronDown className="size-3 text-muted" />
        </button>
        <button
          type="button"
          aria-label={streaming ? '停止' : '发送'}
          onClick={streaming ? onAbort : onSend}
          className={
            'grid size-8 place-items-center rounded-full text-white transition-colors ' +
            (streaming ? 'bg-[#444444] hover:bg-[#2f2f2f]' : 'bg-[#444444] hover:bg-[#2f2f2f]')
          }
        >
          {streaming ? <span className="size-2.5 rounded-[2px] bg-white" /> : <IconArrowUp className="size-[17px]" />}
        </button>
      </div>
    </div>
  )
}

function InputCard({
  placeholder,
  big,
  snapshot,
  models,
  streaming,
  onSubmit,
  onAbort,
  onModel,
  onLevel
}: {
  placeholder: string
  big?: boolean
  snapshot: Snapshot
  models: ModelOption[]
  streaming: boolean
  onSubmit: (text: string) => void
  onAbort: () => void
  onModel: (id: string) => void
  onLevel: (level: string) => void
}): ReactNode {
  const [text, setText] = useState('')
  const [menu, setMenu] = useState(false)
  const ta = useRef<HTMLTextAreaElement>(null)

  // 跟着内容增高（最多 max-h-40），换行不发呆
  useLayoutEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  const submit = (): void => {
    const value = text.trim()
    if (!value || streaming) return
    setText('')
    onSubmit(value)
  }

  return (
    <div
      className={
        'relative rounded-[14px] border border-edge/80 bg-surface ' +
        (big
          ? 'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_30px_-14px_rgba(0,0,0,0.16)]'
          : 'shadow-[0_1px_2px_rgba(0,0,0,0.04)]')
      }
    >
      {big && <WorkspaceBar snapshot={snapshot} />}
      <div className="px-4 pt-3">
        <textarea
          ref={ta}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={placeholder}
          className="max-h-40 w-full resize-none overflow-y-auto bg-transparent text-[14px] leading-[1.7] outline-none placeholder:text-faint"
        />
      </div>
      <Toolbar
        snapshot={snapshot}
        streaming={streaming}
        onModel={() => setMenu((v) => !v)}
        onSend={submit}
        onAbort={onAbort}
        onAttach={() => {
          void window.pi?.host.pickFiles().then((paths) => {
            if (!paths.length) return
            // 附件以路径形式插到光标处，提交时随正文一起给模型（模型能用 read 打开）
            const refs = paths.map((p) => `@${p}`).join(' ')
            setText((t) => (t ? `${t} ${refs}` : refs))
            ta.current?.focus()
          })
        }}
      />
      {menu && (
        <ModelMenu
          snapshot={snapshot}
          models={models}
          onModel={onModel}
          onLevel={onLevel}
          onClose={() => setMenu(false)}
        />
      )}
    </div>
  )
}

export interface ComposerProps {
  snapshot: Snapshot
  models: ModelOption[]
  streaming: boolean
  onSubmit: (text: string) => void
  onAbort: () => void
  onModel: (id: string) => void
  onLevel: (level: string) => void
}

/** 起始页的大输入卡 */
export function ComposerCard(props: Omit<ComposerProps, 'onAbort'> & { onAbort?: () => void }): ReactNode {
  return (
    <InputCard
      big
      placeholder="向 Pi 提问，使用 @ 添加上下文，使用 / 选择命令或能力"
      {...props}
      onAbort={props.onAbort ?? (() => undefined)}
    />
  )
}

/** 会话页底部输入条 */
export function ChatComposer(props: ComposerProps): ReactNode {
  return <InputCard placeholder="提出后续修改要求" {...props} />
}

export function SuggestionRow({ onPick }: { onPick: (text: string) => void }): ReactNode {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
      {['周报总结', '报错修复', 'PPT 制作', '闲时任务'].map((label) => (
        <button
          key={label}
          type="button"
          onClick={() => onPick(label)}
          className="flex items-center gap-1.5 rounded-[10px] border border-edge bg-panel px-3 py-1.5 text-[12.5px] text-muted transition-colors hover:bg-sunken hover:text-fg"
        >
          <span className="size-3 rounded-[3px] border border-faint" />
          {label}
        </button>
      ))}
    </div>
  )
}

/** 模型选择浮层：模型列表 + 思考强度滑块，数据全部来自引擎 */
function ModelMenu({
  snapshot,
  models,
  onModel,
  onLevel,
  onClose
}: {
  snapshot: Snapshot
  models: ModelOption[]
  onModel: (id: string) => void
  onLevel: (level: string) => void
  onClose: () => void
}): ReactNode {
  const current = models.find((m) => m.name === snapshot.model) ?? models[0]
  const levels = current?.levels ?? ['off']
  const currentLevel = levels.find((l) => LEVEL_LABEL[l] === snapshot.thinkingLevel) ?? levels[levels.length - 1]
  const pct = (Math.max(0, levels.indexOf(currentLevel)) / Math.max(1, levels.length - 1)) * 100
  const groups = [...new Set(models.map((m) => m.provider))]

  return (
    <>
      <MenuScrim onClose={onClose} />
      <MenuPanel className="right-2 bottom-[calc(100%+8px)] w-[320px]">
        <div className="max-h-[240px] overflow-y-auto">
          {groups.map((g) => (
            <div key={g}>
              <MenuLabel>{g}</MenuLabel>
              {models
                .filter((m) => m.provider === g)
                .map((m) => (
                  <MenuItem
                    key={m.id}
                    label={m.name}
                    selected={m.name === snapshot.model}
                    onClick={() => onModel(m.id)}
                  />
                ))}
            </div>
          ))}
        </div>
        <div className="mt-1 flex items-center gap-2 border-t border-edge px-2 pt-2 pb-1">
          <span className="text-[12.5px] text-muted">思考强度</span>
          <span className="text-[12.5px] font-medium">{LEVEL_LABEL[currentLevel] ?? snapshot.thinkingLevel}</span>
          <span className="ml-auto rounded-[5px] border border-edge px-1.5 py-0.5 text-[10.5px] text-faint">Ctrl+T</span>
        </div>
        <div className="px-2 pt-1.5 pb-2">
          <input
            type="range"
            min={0}
            max={Math.max(0, levels.length - 1)}
            step={1}
            value={Math.max(0, levels.indexOf(currentLevel))}
            onChange={(e) => onLevel(levels[Number(e.target.value)])}
            aria-label="思考强度"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface [&::-webkit-slider-thumb]:bg-[#2f9be0] [&::-webkit-slider-thumb]:shadow"
            style={{
              background: `linear-gradient(to right, #1f9d55, #2f9be0, #7b5cf0) 0 / ${pct}% no-repeat, #e7e5e2`
            }}
          />
          <div className="mt-1 flex justify-between text-[10.5px] text-faint">
            {levels.map((l) => (
              <span key={l}>{LEVEL_LABEL[l] ?? l}</span>
            ))}
          </div>
        </div>
      </MenuPanel>
    </>
  )
}
