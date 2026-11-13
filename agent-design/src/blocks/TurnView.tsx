import { memo, type ReactNode } from 'react'
import { IconChevronDownOutlineRegular } from '../icons'
import { zh } from '../i18n/zh'
import { formatDuration } from '../lib/format'
import { useFold } from '../lib/useFold'
import type { ConversationState, Turn, UserBlock } from '../reducer/types'
import { AssistantText, defaultRenderMarkdown, type MarkdownRenderer } from './AssistantText'
import { ChangedFiles } from './ChangedFiles'
import { ProcessGroup } from './ProcessGroup'
import { RunningStatus } from './RunningStatus'
import { turnLayout } from './turnGroups'

export { SystemRow } from './SystemRow'

/**
 * 用户消息：右对齐气泡；图片贴在气泡上方。
 * 图片既可以是 URL，也可以是已经渲染好的节点（宿主从磁盘读图后自己给 <img>）。
 */
export const UserMessage = memo(function UserMessage({
  block,
  renderImages,
}: {
  block: UserBlock
  renderImages?: (images: readonly string[]) => ReactNode
}) {
  return (
    <div className="user">
      {block.images.length > 0 && (
        <div className="userImages">
          {renderImages !== undefined
            ? renderImages(block.images)
            : block.images.map((src, index) => (
                <img className="userImage" src={src} alt={`${zh.block.image} ${index + 1}`} key={index} />
              ))}
        </div>
      )}
      {block.text !== '' && <div className="userBubble">{block.text}</div>}
    </div>
  )
})

/** 时长里的数字单独走等宽、tabular，和 harness 的总行一致。 */
function withNumeric(value: string) {
  return value.split(/(\d+)/).map((part, index) =>
    /^\d+$/.test(part) ? (
      <span className="turnNumber" key={index}>
        {part}
      </span>
    ) : (
      part
    ),
  )
}

/**
 * 一个回合的三层结构：
 * 总行（耗时/状态，折叠全部过程）→ 分组（assistant 文本之间的过程）→ 行。
 * 折叠只隐藏分组；所有 assistant 文本常显，最终答案只是 `final` 的那一段。
 */
export const TurnView = memo(function TurnView({
  turn,
  state,
  defaultOpen = false,
  scope = '',
  renderMarkdown = defaultRenderMarkdown,
  renderImages,
  now,
}: {
  turn: Turn
  state: ConversationState
  /** 画廊等场景：初始展开过程块。 */
  defaultOpen?: boolean
  /** 开合状态的命名空间（会话 id）；避免不同会话共用 turn:N。 */
  scope?: string
  /** 调用方注入的 Markdown 渲染器。 */
  renderMarkdown?: MarkdownRenderer
  /** 用户消息里的图片怎么画（宿主从磁盘读图后自己给 <img>）。 */
  renderImages?: (images: readonly string[]) => ReactNode
  /** 回放时钟；live 状态的「用时」按它计。 */
  now?: number
}) {
  const user = turn.userId !== null ? (state.blocks[turn.userId] as UserBlock | undefined) : undefined
  const layout = turnLayout(turn, state)
  const live = turn.status === 'live'
  const foldable = layout.groups.length > 0
  const [open, toggle] = useFold(scope, turn.key, live || defaultOpen)
  const shown = !foldable || open

  const duration =
    turn.endedAt !== undefined ? formatDuration(Math.max(0, turn.endedAt - turn.startedAt)) : undefined
  const stopped = turn.status === 'aborted'
  const elapsed = now === undefined ? undefined : Math.max(1000, now - turn.startedAt)
  const runningLabel =
    elapsed === undefined ? zh.turn.working : zh.turn.workingFor(formatDuration(elapsed))

  return (
    <div className="turn">
      {user !== undefined && <UserMessage block={user} renderImages={renderImages} />}

      {!live && (
        <button
          type="button"
          className="turnHead"
          data-open={open || undefined}
          aria-expanded={foldable ? open : undefined}
          disabled={!foldable}
          onClick={foldable ? toggle : undefined}
        >
          <span className="turnHeadText">
            {stopped ? (
              zh.turn.stopped
            ) : (
              <>
                {zh.turn.workedPrefix}
                {withNumeric(duration ?? '')}
              </>
            )}
          </span>
          {foldable && <IconChevronDownOutlineRegular className="turnHeadChevron" />}
        </button>
      )}

      <div className="turnFlow" data-folded={!live && !shown ? '' : undefined}>
        {layout.entries.map(entry => {
          if (entry.kind === 'text')
            return <AssistantText block={entry.block} renderMarkdown={renderMarkdown} key={entry.block.id} />
          if (!live && !shown) return null
          return (
            <ProcessGroup group={entry.group} state={state} scope={scope} key={entry.group.key} />
          )
        })}
      </div>

      {!live && <ChangedFiles turn={turn} state={state} />}
      {live && <RunningStatus label={runningLabel} />}
    </div>
  )
})
