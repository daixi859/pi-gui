import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import type { Snapshot } from '@shared/blocks'
import type { CommandInfo, ModelOption, PromptImage } from '@shared/ipc'
import { setDraftImages, setDraftText, useDraft } from '../drafts'
import { MenuItem, MenuLabel, MenuPanel, MenuScrim } from './Menu'
import { Button } from './Button'
import { IconArrowUp, IconBranch, IconChevronDown, IconClose, IconFolder, IconHand, IconPlus } from './icons'
import { Tip } from './Tip'

const LEVEL_LABEL: Record<string, string> = {
  off: '关闭',
  minimal: '最低',
  low: '低',
  medium: '中',
  high: '高',
  xhigh: '很高',
  max: '最高'
}

const ghost = 'flex items-center gap-1 rounded-md px-1 py-1 text-sm hover:bg-sunken'

/** 工作区名取目录名；Windows 反斜杠也要认 */
const basename = (p: string): string => p.split(/[\\/]/).filter(Boolean).pop() ?? p

/** 输入卡顶部的项目 / 分支条 */
function WorkspaceBar({
  snapshot,
  workspaces,
  onSwitch
}: {
  snapshot: Snapshot
  workspaces: string[]
  onSwitch: (path: string) => void
}): ReactNode {
  const [menu, setMenu] = useState(false)
  const [query, setQuery] = useState('')
  const hits = workspaces.filter((p) => p.toLowerCase().includes(query.trim().toLowerCase()))
  const choose = (path: string): void => {
    setMenu(false)
    setQuery('')
    if (path !== snapshot.workspace) onSwitch(path)
  }
  const add = (): void => {
    setMenu(false)
    setQuery('')
    void window.pi?.host.pickDirectory().then((path) => {
      if (path) choose(path)
    })
  }
  return (
    <div className="relative flex items-center gap-0.5 rounded-t-lg bg-sunken px-2 py-1 text-xs text-muted">
      <button
        type="button"
        onClick={() => setMenu((v) => !v)}
        title="切换工作区"
        className="flex items-center gap-1 rounded-sm px-1 py-0.5 hover:bg-black/5 hover:text-fg"
      >
        <IconFolder className="size-[14px]" />
        {snapshot.cwd}
        <IconChevronDown className="size-3" />
      </button>
      <span className="flex items-center gap-1 rounded-sm px-1 py-0.5">
        <IconBranch className="size-[14px]" />
        {snapshot.branch}
      </span>
      {menu && (
        <>
          <MenuScrim onClose={() => setMenu(false)} />
          <MenuPanel className="bottom-full left-0 mb-1 w-[240px]">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索工作区"
              aria-label="搜索工作区"
              className="pi-input mb-1 w-full"
            />
            <div className="max-h-[280px] overflow-y-auto">
              {hits.map((path) => (
                <MenuItem
                  key={path}
                  label={basename(path)}
                  title={path}
                  selected={path === snapshot.workspace}
                  onClick={() => choose(path)}
                />
              ))}
              {hits.length === 0 && <div className="px-2 py-1 text-xs text-faint">没有匹配的工作区</div>}
            </div>
            <div className="mt-1 border-t border-edge pt-1">
              <MenuItem label="添加工作区…" onClick={add} />
            </div>
          </MenuPanel>
        </>
      )}
    </div>
  )
}

function Toolbar({
  snapshot,
  models,
  streaming,
  empty,
  onModel,
  onLevel,
  onSend,
  onAbort,
  onAttach,
  onAccess
}: {
  snapshot: Snapshot
  models: ModelOption[]
  streaming: boolean
  /** 没文字也没图片：发送按钮置灰 */
  empty: boolean
  onModel: (id: string) => void
  onLevel: (level: string) => void
  onSend: () => void
  onAbort: () => void
  onAttach: () => void
  onAccess: () => void
}): ReactNode {
  const [menu, setMenu] = useState(false)
  return (
    <div className="flex items-center gap-1 px-2 pt-1 pb-2">
      <Button
        aria-label="添加附件"
        variant="ghost"
        shape="circle"
        onClick={onAttach}
        icon={<IconPlus />}
      />
      <button type="button" onClick={onAccess} className={ghost} title="切换变更前确认 / 完全访问">
        <IconHand className="size-3.5" />
        {snapshot.access}
      </button>
      <div className="ml-auto flex items-center gap-1">
        <div className="relative">
          <button type="button" onClick={() => setMenu((v) => !v)} className={ghost}>
            <span className="size-[13px] rounded-full border-2 border-success-3" />
            <span className="font-medium text-fg">{snapshot.model}</span>
            <span className="text-muted">{snapshot.thinkingLevel}</span>
            <IconChevronDown className="size-3 text-muted" />
          </button>
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
        {/* 视觉 26，外圈 28 保住可点热区 */}
        {streaming ? (
          <div className="group relative">
            <Button
              aria-label="停止生成"
              variant="ghost"
              shape="circle"
              onClick={onAbort}
              icon={
                <span className="grid size-6.5 place-items-center rounded-pill bg-sunken text-fg transition-colors hover:bg-select">
                  <span className="size-3 rounded-xs bg-current" />
                </span>
              }
            />
            <Tip text="停止生成" kbd="Esc" />
          </div>
        ) : (
          <div className="group relative">
            <Button
              aria-label="发送"
              variant="ghost"
              shape="circle"
              disabled={empty}
              onClick={onSend}
              icon={
                <span
                  className={clsx(
                    'grid size-6.5 place-items-center rounded-pill transition-colors',
                    empty ? 'bg-sunken text-faint' : 'bg-fg text-surface hover:bg-fg/85'
                  )}
                >
                  <IconArrowUp className="size-4" />
                </span>
              }
            />
            {/* 没内容就不发，也就不提示 */}
            {!empty && <Tip text="发送" kbd="Enter" />}
          </div>
        )}
      </div>
    </div>
  )
}

function InputCard({
  placeholder,
  big,
  scope,
  snapshot,
  models,
  streaming,
  onSubmit,
  onAbort,
  onModel,
  onLevel,
  files,
  onQueryFiles,
  commands,
  onAccess,
  onSwitchWorkspace,
  workspaces
}: {
  placeholder: string
  big?: boolean
  /** 草稿键：会话 id，起始页用 'new' */
  scope: string
  snapshot: Snapshot
  models: ModelOption[]
  streaming: boolean
  onSubmit: (text: string, images?: PromptImage[]) => void
  onAbort: () => void
  onModel: (id: string) => void
  onLevel: (level: string) => void
  files: string[]
  onQueryFiles: (query: string) => void
  commands: CommandInfo[]
  onAccess: () => void
  /** 换工作区：选目录后宿主在新目录开一个会话 */
  onSwitchWorkspace: (path: string) => void
  workspaces: string[]
}): ReactNode {
  // 切会话/回起始页再回来草稿还在；输入框卸载后由 store 兜着
  const { text, images } = useDraft(scope)
  const setText = (next: string): void => setDraftText(scope, next)
  const setImages = (fn: (prev: PromptImage[]) => PromptImage[]): void =>
    setDraftImages(scope, fn)
  const ta = useRef<HTMLTextAreaElement>(null)
  const [zoom, setZoom] = useState<PromptImage | null>(null)

  useEffect(() => {
    if (!zoom) return
    // 捕获阶段截下 Esc：只关预览，不再冒到 App 变成「停止生成」
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setZoom(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [zoom])

  // @ 提及：光标前最后一段是 @xxx 就拉候选
  const mention = /(?:^|\s)@([^\s@]*)$/.exec(text)?.[1]
  const typing = mention !== undefined

  // / 命令：整段只由 /xxx 组成时列扩展命令（带参数的就不提示了）
  const slash = /^\/(\S*)$/.exec(text)?.[1]
  const cmdHits =
    slash === undefined
      ? []
      : commands.filter((c) => c.name.toLowerCase().startsWith(slash.toLowerCase())).slice(0, 8)

  useEffect(() => {
    if (typing) onQueryFiles(mention ?? '')
  }, [mention, typing, onQueryFiles])

  const insert = (path: string): void => {
    setText(text.replace(/@[^\s@]*$/, `@${path} `))
    ta.current?.focus()
  }

  // 跟着内容增高（最多 max-h-40），换行不发呆
  useLayoutEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  const submit = (): void => {
    const value = text.trim()
    if ((!value && !images.length) || streaming) return
    setText('')
    const pics = images
    setImages(() => [])
    onSubmit(value, pics.length ? pics : undefined)
  }

  /** 图片从剪贴板/拖拽进来：转 base64 存着，发时随 prompt 一起给模型 */
  const addImages = (files: FileList | File[]): void => {
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue
      const reader = new FileReader()
      reader.onload = () => {
        const url = String(reader.result)
        setImages((prev) => [...prev, { data: url.slice(url.indexOf(',') + 1), mimeType: f.type }])
      }
      reader.readAsDataURL(f)
    }
  }

  return (
    <div className={clsx('relative rounded-lg border border-edge/80 bg-surface', big ? 'shadow-card' : 'shadow-hairline')}>
      {big && <WorkspaceBar snapshot={snapshot} workspaces={workspaces} onSwitch={onSwitchWorkspace} />}
      {cmdHits.length > 0 && (
        <div className="absolute bottom-full mb-1 left-0 w-[420px] overflow-hidden rounded-md border border-edge bg-panel p-1 shadow-pop">
          {cmdHits.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => {
                setText(`/${c.name} `)
                ta.current?.focus()
              }}
              className="flex w-full items-baseline gap-2 rounded-md px-2 py-1 text-left hover:bg-sunken"
            >
              <span className="font-mono text-xs">/{c.name}</span>
              {c.description && (
                <span className="truncate text-xs text-muted">{c.description}</span>
              )}
            </button>
          ))}
        </div>
      )}
      {typing && files.length > 0 && (
        <div className="absolute bottom-full mb-1 left-0 max-h-[220px] w-[360px] overflow-y-auto rounded-md border border-edge bg-panel p-1 shadow-pop">
          {files.slice(0, 12).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => insert(f)}
              className="block w-full truncate rounded-md px-2 py-1 text-left font-mono text-xs text-muted hover:bg-sunken hover:text-fg"
            >
              {f}
            </button>
          ))}
        </div>
      )}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pt-2">
          {images.map((img, i) => (
            <div key={i} className="group relative">
              <button
                type="button"
                aria-label={`查看图片 ${i + 1}`}
                onClick={() => setZoom(img)}
                className="block size-10 overflow-hidden rounded-sm border border-edge"
              >
                <img
                  src={`data:${img.mimeType};base64,${img.data}`}
                  alt={`图片 ${i + 1}`}
                  className="size-full object-cover"
                />
              </button>
              <Button
                aria-label={`移除图片 ${i + 1}`}
                variant="ghost"
                shape="circle"
                className="absolute -top-2 -right-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                icon={
                  <span className="grid size-3.5 place-items-center rounded-pill bg-fg text-surface">
                    <IconClose className="size-2" />
                  </span>
                }
              />
            </div>
          ))}
        </div>
      )}
      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="图片预览"
          className="fixed inset-0 z-50 flex items-center justify-center bg-fg/70 p-8"
          onClick={() => setZoom(null)}
        >
          <img
            src={`data:${zoom.mimeType};base64,${zoom.data}`}
            alt="图片预览"
            className="max-h-full max-w-full rounded-md object-contain"
          />
        </div>
      )}
      <div
        className="px-4 pt-2"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          addImages(e.dataTransfer.files)
        }}
      >
        <textarea
          ref={ta}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files)
            if (files.some((f) => f.type.startsWith('image/'))) {
              e.preventDefault()
              addImages(files)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={placeholder}
          className="max-h-40 w-full resize-none overflow-y-auto bg-transparent text-sm leading-[1.6] outline-none placeholder:text-faint"
        />
      </div>
      <Toolbar
        snapshot={snapshot}
        models={models}
        streaming={streaming}
        empty={!text.trim() && images.length === 0}
        onModel={onModel}
        onLevel={onLevel}
        onSend={submit}
        onAbort={onAbort}
        onAccess={onAccess}
        onAttach={() => {
          void window.pi?.host.pickFiles().then((paths) => {
            if (!paths.length) return
            // 选到图片就当附件随 prompt 发给模型，其余当 @ 路径（模型能用 read 打开）
            const pics = paths.filter((p) => /\.(png|jpe?g|gif|webp|bmp)$/i.test(p))
            const rest = paths.filter((p) => !pics.includes(p))
            for (const p of pics) {
              void window.pi?.host
                .readImage(p)
                .then((img) => {
                  if (img) setImages((prev) => [...prev, img])
                })
            }
            if (rest.length) {
              const refs = rest.map((p) => `@${p}`).join(' ')
              setText(text ? `${text} ${refs}` : refs)
            }
            ta.current?.focus()
          })
        }}
      />
    </div>
  )
}

export interface ComposerProps {
  /** 草稿键：会话 id，起始页用 'new' */
  scope: string
  snapshot: Snapshot
  models: ModelOption[]
  streaming: boolean
  onSubmit: (text: string, images?: PromptImage[]) => void
  onAbort: () => void
  onModel: (id: string) => void
  onLevel: (level: string) => void
  files: string[]
  onQueryFiles: (query: string) => void
  commands: CommandInfo[]
  onAccess: () => void
  onSwitchWorkspace: (path: string) => void
  workspaces: string[]
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
          className="flex items-center gap-1 rounded-md border border-edge bg-panel px-2 py-1 text-sm text-muted transition-colors hover:bg-sunken hover:text-fg"
        >
          <span className="size-3 rounded-sm border border-faint" />
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
      <MenuPanel className="right-0 bottom-full mb-1 w-[320px]">
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
          <span className="text-xs text-muted">思考强度</span>
          <span className="text-xs font-medium">{LEVEL_LABEL[currentLevel] ?? snapshot.thinkingLevel}</span>
          <span className="ml-auto rounded-sm border border-edge px-1 py-0.5 text-xs text-faint">Ctrl+T</span>
        </div>
        <div className="px-2 pt-1 pb-2">
          <input
            type="range"
            min={0}
            max={Math.max(0, levels.length - 1)}
            step={1}
            value={Math.max(0, levels.indexOf(currentLevel))}
            onChange={(e) => onLevel(levels[Number(e.target.value)])}
            aria-label="思考强度"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface [&::-webkit-slider-thumb]:bg-link [&::-webkit-slider-thumb]:shadow"
            style={{
              background: `linear-gradient(to right, var(--color-add), var(--color-link)) 0 / ${pct}% no-repeat, var(--color-edge)`
            }}
          />
          <div className="mt-1 flex justify-between text-xs text-faint">
            {levels.map((l) => (
              <span key={l}>{LEVEL_LABEL[l] ?? l}</span>
            ))}
          </div>
        </div>
      </MenuPanel>
    </>
  )
}
