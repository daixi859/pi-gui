import { clsx } from 'clsx'
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

/** 统一 16 网格、1.5 描边（半宽 0.75）。
 *  墨迹分三档，全部光学居中于 (8,8)：S=10.5（方向/符号）、M=12.5（常规）、L=14.5（容器/满框）。
 *  中心线落在 0.25 网格上，加半描边后墨迹边缘正好落回 0.5 网格。
 *  实心图形用 fill="currentColor" + stroke="none"，不要用背景色填（换底色会露馅）。 */
const base = (p: P): P => ({
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p
})

/* ---------- S：墨迹 10.5 ---------- */

export const IconPlus = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.75 8h10.5M8 2.75v10.5" />
  </svg>
)

export const IconChevronDown = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.5 5.75 8 10.25l4.5-4.5" />
  </svg>
)

export const IconChevronRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M5.75 3.5 10.25 8l-4.5 4.5" />
  </svg>
)

export const IconChevronUp = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.5 10.25 8 5.75l4.5 4.5" />
  </svg>
)

export const IconArrowLeft = (p: P) => (
  <svg {...base(p)}>
    <path d="M12.5 8H3.5M7.5 4 3.5 8l4 4" />
  </svg>
)

export const IconArrowRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.5 8h9M8.5 4 12.5 8l-4 4" />
  </svg>
)

export const IconArrowUp = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 12.5v-9M4 7.5 8 3.5l4 4" />
  </svg>
)

export const IconArrowDown = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 3.5v9M4 8.5 8 12.5l4-4" />
  </svg>
)

export const IconClose = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.5 3.5 12.5 12.5M12.5 3.5 3.5 12.5" />
  </svg>
)

export const IconCheck = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
  </svg>
)

export const IconMinimize = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.75 8h10.5" />
  </svg>
)

export const IconBookmark = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.5 2.75h9v10.5L8 10.25 3.5 13.25V2.75Z" />
  </svg>
)

export const IconPause = (p: P) => (
  <svg {...base(p)}>
    <rect x="5.25" y="2.75" width="2" height="10.5" rx="1" fill="currentColor" stroke="none" />
    <rect x="8.75" y="2.75" width="2" height="10.5" rx="1" fill="currentColor" stroke="none" />
  </svg>
)

/* ---------- M：墨迹 12.5 ---------- */

export const IconSearch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="6.5" cy="6.5" r="4" />
    <path d="M9.5 9.5 13.5 13.5" />
  </svg>
)

/** 滑杆：两根轨道 + 各一个旋钮（短竖线压过轨道）。旧版用背景色填圆做镂空，换底色会露色块 */
export const IconSliders = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.5 5.5h11M2.5 10.5h11" />
    <path d="M6 4v3M10 9v3" />
  </svg>
)

/** 列表排序：三行递进 + 向下箭头 */
export const IconSortList = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.5 4h6.5M2.5 8h4.5M2.5 12h2.5" />
    <path d="M11.5 3.5v9M9.25 10.25 11.5 12.5l2.25-2.25" />
  </svg>
)

export const IconFilter = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.5 4.5h11M5 8h6M6.75 11.5h2.5" />
  </svg>
)

export const IconFolder = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.5 4.75a1.5 1.5 0 0 1 1.5-1.5h2L7.5 4.75h4.5a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5V4.75Z" />
  </svg>
)

/** 打开的文件夹（翻开的盖），表示分组已展开 */
export const IconFolderOpen = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.5 12.5V5a1.5 1.5 0 0 1 1.5-1.5h2L7.5 5h4A1.5 1.5 0 0 1 13 6.5v1" />
    <path d="M2.5 12.5h9.25l1.75-4.5H4.5l-2 4.5Z" />
  </svg>
)

export const IconMaximize = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
  </svg>
)

export const IconUpload = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 10.75V2.75M4.75 6 8 2.75 11.25 6" />
    <path d="M2.5 10.75v1a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-1" />
  </svg>
)

export const IconDots = (p: P) => (
  <svg {...base(p)}>
    <circle cx="3.5" cy="8" r="1" fill="currentColor" stroke="none" />
    <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
    <circle cx="12.5" cy="8" r="1" fill="currentColor" stroke="none" />
  </svg>
)

export const IconCopy = (p: P) => (
  <svg {...base(p)}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5a1.5 1.5 0 0 0 1.5 1.5h1.5" />
  </svg>
)

export const IconThumbUp = (p: P) => (
  <svg {...base(p)}>
    <path d="M5.4 13.25V6.85l2.7-4a1 1 0 0 1 1.7.9l-.6 2.4h3a1.2 1.2 0 0 1 1.2 1.5l-1 4.3a1.2 1.2 0 0 1-1.2.9H5.4Z" />
    <path d="M2.6 6.85h1.6v6.4H2.6z" />
  </svg>
)

export const IconThumbDown = (p: P) => (
  <svg {...base(p)}>
    <path d="M10.6 2.75v6.4l-2.7 4a1 1 0 0 1-1.7-.9l.6-2.4h-3a1.2 1.2 0 0 1-1.2-1.5l1-4.3A1.2 1.2 0 0 1 4.8 2.75h5.8Z" />
    <path d="M13.4 2.75h-1.6v6.4h1.6z" />
  </svg>
)

export const IconShare = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 10V2.5M5.25 5.25 8 2.5l2.75 2.75" />
    <path d="M3 8.75v3.25a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5V8.75" />
  </svg>
)

export const IconFile = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 2.5H4.5A1.5 1.5 0 0 0 3 4v8a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 12V6.5L9 2.5Z" />
    <path d="M8.75 2.75v3.5h3.75" />
  </svg>
)

export const IconImage = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
    <circle cx="6" cy="6.75" r="1.25" />
    <path d="M2.75 11.5 6.5 8l2 1.9 1.75-1.5 3 2.6" />
  </svg>
)

export const IconUndo = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.25 6.25h6.5a3 3 0 0 1 0 6H6.25" />
    <path d="M5.75 3.75 3.25 6.25 5.75 8.75" />
  </svg>
)

export const IconClock = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M8 4.75V8l2 1.25" />
  </svg>
)

export const IconCommand = (p: P) => (
  <svg {...base(p)}>
    <path d="M10 3.75v8.5a2.25 2.25 0 1 0 2.25-2.25h-8.5a2.25 2.25 0 1 0 2.25 2.25v-8.5a2.25 2.25 0 1 0-2.25 2.25h8.5a2.25 2.25 0 1 0-2.25-2.25Z" />
  </svg>
)

export const IconWrench = (p: P) => (
  <svg {...base(p)}>
    <path d="M9.8 2.6a3.4 3.4 0 0 0-3 4.9L2.8 11.5l1.7 1.7 4-4a3.4 3.4 0 0 0 4.9-3l-2 2-1.7-1.7 2-2a3.4 3.4 0 0 0-1.9-1.9Z" />
  </svg>
)

/** 铅笔：编辑 */
export const IconEdit = (p: P) => (
  <svg {...base(p)}>
    <path d="M11.5 2.25 13.75 4.5 5 13.25 2.25 13.75 2.75 11 11.5 2.25Z" />
    <path d="M10 3.75 12.25 6" />
  </svg>
)

export const IconTrash = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.5 3.75h11" />
    <path d="M6.25 3.75v-1.5h3.5v1.5" />
    <path d="M4.5 3.75l.6 8.5a1.5 1.5 0 0 0 1.5 1.4h2.8a1.5 1.5 0 0 0 1.5-1.4l.6-8.5" />
  </svg>
)

/** 手形：需要确认的权限档位 */
export const IconHand = (p: P) => (
  <svg {...base(p)}>
    <path d="M5.75 8.5V4a1.25 1.25 0 0 1 2.5 0v3.25M8.25 7.25V3.5a1.25 1.25 0 0 1 2.5 0v3.75M10.75 7V4.75a1.25 1.25 0 0 1 2.5 0v4.5c0 2.6-1.75 4.5-4.25 4.5-1.75 0-2.75-.75-3.5-2L3 9.25a1.1 1.1 0 0 1 1.75-1.3l1 1.3" />
  </svg>
)

/* ---------- L：墨迹 14.5 ---------- */

/** 新建任务：圆圈里加号（设计稿） */
export const IconPlusCircle = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="6.5" />
    <path d="M8 5.25v5.5M5.25 8h5.5" />
  </svg>
)

export const IconCheckSquare = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="6.5" />
    <path d="M4.75 8.25 7 10.5l4.25-4.75" />
  </svg>
)

export const IconBlocks = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.25" y="2.25" width="5.25" height="5.25" rx="1.5" />
    <rect x="8.5" y="2.25" width="5.25" height="5.25" rx="1.5" />
    <rect x="2.25" y="8.5" width="5.25" height="5.25" rx="1.5" />
    <path d="M8.5 11.25h5.25" />
  </svg>
)

export const IconSettings = (p: P) => (
  <svg {...base(p)}>
    <path d="M14.25 8l-2 1.76.17 2.66-2.66-.17L8 14.25l-1.76-2-2.66.17.17-2.66L1.75 8l2-1.76-.17-2.66 2.66.17L8 1.75l1.76 2 2.66-.17-.17 2.66L14.25 8Z" />
    <circle cx="8" cy="8" r="2.5" />
  </svg>
)

export const IconPanelLeft = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
    <path d="M6.5 3v10" />
  </svg>
)

export const IconPanelRight = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
    <path d="M9.5 3v10" />
  </svg>
)

/** 收起侧栏：面板 + 向左箭头 */
export const IconPanelCollapse = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
    <path d="M6.5 3v10" />
    <path d="M11 6.5 9.25 8l1.75 1.5" />
  </svg>
)

/** 展开侧栏：面板 + 向右箭头 */
export const IconPanelExpand = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
    <path d="M6.5 3v10" />
    <path d="M9 6.5 10.75 8 9 9.5" />
  </svg>
)

export const IconHelp = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="6.5" />
    <path d="M6.5 6.25a1.75 1.75 0 1 1 2.4 1.6c-.55.3-.9.75-.9 1.4v.25" />
    <circle cx="8" cy="11.5" r="0.75" fill="currentColor" stroke="none" />
  </svg>
)

export const IconShield = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 2.5 13.5 4.5v4.25c0 2.3-2.1 4-5.5 4.75-3.4-.75-5.5-2.45-5.5-4.75V4.5L8 2.5Z" />
  </svg>
)

export const IconSparkle = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4Z" />
  </svg>
)

export const IconStop = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="2" fill="currentColor" stroke="none" />
  </svg>
)

export const IconSpinner = (p: P) => (
  <svg {...base(p)} className={clsx('animate-spin', p.className)} style={{ animationDuration: '1.4s' }}>
    <circle cx="8" cy="8" r="5.5" strokeOpacity="0.2" />
    <path d="M13.5 8A5.5 5.5 0 0 0 8 2.5" />
  </svg>
)

export const IconBranch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="4" cy="4" r="1.5" />
    <circle cx="4" cy="12" r="1.5" />
    <circle cx="12" cy="4" r="1.5" />
    <path d="M4 5.5v5M12 5.5c0 3.5-2.5 5-6.5 5.5" />
  </svg>
)

/** 思考：圆圈里三个点 */
export const IconThinking = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="6.5" />
    <circle cx="5" cy="8" r="1" fill="currentColor" stroke="none" />
    <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
    <circle cx="11" cy="8" r="1" fill="currentColor" stroke="none" />
  </svg>
)

/** 终端：窗口 + 提示符 */
export const IconTerminal = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
    <path d="M5 6.5 6.75 8 5 9.5" />
    <path d="M8.5 9.75h3" />
  </svg>
)

/** 阅读：眼睛 */
export const IconEye = (p: P) => (
  <svg {...base(p)}>
    <path d="M1.5 8S4 4 8 4s6.5 4 6.5 4S12 12 8 12 1.5 8 1.5 8Z" />
    <circle cx="8" cy="8" r="1.75" />
  </svg>
)
