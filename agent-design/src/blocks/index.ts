/**
 * 对话块包的唯一入口。
 *
 * 宿主只依赖这里：`import { TurnView } from 'agent-design/blocks'`。
 * 导入即带两件事——样式（blocks.css，作用域 .pi-blocks）与图标 sprite（幂等）。
 */

import './blocks.css'
import { installIconSprite } from '../icons/sprite'

installIconSprite()

export type {
  AssistantBlock,
  AssistantStatus,
  Block,
  ConversationState,
  SystemBlock,
  ThinkingBlock,
  ToolBlock,
  ToolState,
  ToolSubCall,
  Turn,
  TurnActivity,
  TurnStatus,
  UserBlock,
} from '../reducer/types'

export { AssistantText, defaultRenderMarkdown, type MarkdownRenderer } from './AssistantText'
export { ChangedFiles, type ChangedFile } from './ChangedFiles'
export { KIND_ICON } from './kindIcons'
export { RunningHead } from './RunningHead'
export { RunningStatus } from './RunningStatus'
export { SystemRow } from './SystemRow'
export { ThinkingRow } from './ThinkingRow'
export { ToolRow } from './ToolRow'
export {
  blockKind,
  toolKind,
  toolMeta,
  toolVerb,
  type ProcessKind,
  type ToolMeta,
} from './tools'
export {
  groupActivity,
  groupDoneTitle,
  groupLiveTitle,
  turnLayout,
  type ProcessGroupView,
  type TurnEntry,
  type TurnLayout,
} from './turnGroups'
export {
  DEFAULT_VISIBLE_LINES,
  hasBody,
  parseDiff,
  splitOutput,
  subCallStats,
  toolRowModel,
  type DiffLine,
  type ToolRowModel,
} from './toolModel'
export { TurnView, UserMessage } from './TurnView'
export { zh } from '../i18n/zh'
