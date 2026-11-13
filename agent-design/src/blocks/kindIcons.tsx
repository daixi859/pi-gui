import type { ReactNode } from 'react'
import {
  IconAgentPresetOutlineRegular,
  IconApiOutlineRegular,
  IconBrowseOutlineRegular,
  IconCodeOutlineRegular,
  IconContextInjectionOutlineRegular,
  IconEditOutlineRegular,
  IconGlobeOutlineRegular,
  IconPlanOutlineRegular,
  IconQuestionOutlineRegular,
  IconSearchOutlineRegular,
  IconSparkleRegular,
  IconThinkOutlineRegular,
} from '../icons'
import type { ProcessKind } from './tools'

/**
 * 类别 → 图标。组头与工具行共用这一张表：一处改动，两处同时变。
 * 尺寸统一 14px，与 DisclosureRow 的行首图标一致。
 */
export const KIND_ICON: Record<ProcessKind, ReactNode> = {
  thinking: <IconThinkOutlineRegular size={14} />,
  read: <IconBrowseOutlineRegular size={14} />,
  readImage: <IconBrowseOutlineRegular size={14} />,
  search: <IconSearchOutlineRegular size={14} />,
  edit: <IconEditOutlineRegular size={14} />,
  write: <IconEditOutlineRegular size={14} />,
  commands: <IconApiOutlineRegular size={14} />,
  code: <IconCodeOutlineRegular size={14} />,
  webSearch: <IconGlobeOutlineRegular size={14} />,
  webFetch: <IconBrowseOutlineRegular size={14} />,
  subagents: <IconAgentPresetOutlineRegular size={14} />,
  plan: <IconPlanOutlineRegular size={14} />,
  questions: <IconQuestionOutlineRegular size={14} />,
  tools: <IconSparkleRegular size={14} />,
  context: <IconContextInjectionOutlineRegular size={14} />,
}
