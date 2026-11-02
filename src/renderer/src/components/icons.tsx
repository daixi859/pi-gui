import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

const base = (p: P): P => ({
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.35,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p
})

export const IconPlus = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 3.2v9.6M3.2 8h9.6" />
  </svg>
)

/** 新建任务：圆圈里加号（设计稿） */
export const IconPlusCircle = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="5.7" />
    <path d="M8 5.5v5M5.5 8h5" />
  </svg>
)

export const IconArrowLeft = (p: P) => (
  <svg {...base(p)}>
    <path d="M10 3.5 5.5 8l4.5 4.5" />
  </svg>
)

export const IconArrowRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 3.5 10.5 8 6 12.5" />
  </svg>
)

export const IconCheckSquare = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="5.6" />
    <path d="M5.4 8.3 7.2 10l3.3-3.6" />
  </svg>
)

export const IconSliders = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 5.5h10M3 10.5h10" />
    <circle cx="6" cy="5.5" r="1.5" fill="var(--color-canvas)" />
    <circle cx="10" cy="10.5" r="1.5" fill="var(--color-canvas)" />
  </svg>
)

export const IconBlocks = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.6" y="2.6" width="4.6" height="4.6" rx="1" />
    <rect x="8.8" y="2.6" width="4.6" height="4.6" rx="1" />
    <rect x="2.6" y="8.8" width="4.6" height="4.6" rx="1" />
    <path d="M9.2 11.4h4" />
  </svg>
)

export const IconSearch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="7.2" cy="7.2" r="4.2" />
    <path d="M10.4 10.4 13.5 13.5" />
  </svg>
)

/** 列表排序：三行递进 + 向下箭头 */
export const IconSortList = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.6 4h6.2M2.6 8h4.4M2.6 12h2.6" />
    <path d="M11.4 4.2v7M9.9 9.7l1.5 1.5 1.5-1.5" />
  </svg>
)

export const IconFilter = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.8 4.4h10.4M5 8h6M6.8 11.6h2.4" />
  </svg>
)

export const IconFolder = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.4 5.2a1.2 1.2 0 0 1 1.2-1.2h2.1l1.3 1.5h4.4a1.2 1.2 0 0 1 1.2 1.2v4.9a1.2 1.2 0 0 1-1.2 1.2H3.6a1.2 1.2 0 0 1-1.2-1.2V5.2Z" />
  </svg>
)

export const IconChevronDown = (p: P) => (
  <svg {...base(p)}>
    <path d="M4.2 6.4 8 10.2l3.8-3.8" />
  </svg>
)

export const IconChevronRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M6.4 4.2 10.2 8l-3.8 3.8" />
  </svg>
)

export const IconChevronUp = (p: P) => (
  <svg {...base(p)}>
    <path d="M4.2 9.6 8 5.8l3.8 3.8" />
  </svg>
)

export const IconArrowUp = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 12.5V3.5M4.2 7.3 8 3.5l3.8 3.8" />
  </svg>
)

export const IconArrowDown = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 3.5v9M4.2 8.7 8 12.5l3.8-3.8" />
  </svg>
)

export const IconSettings = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="2.1" />
    <path d="M8 1.9v1.6M8 12.5v1.6M2.6 8H4.2M11.8 8h1.6M4.2 4.2l1.1 1.1M10.7 10.7l1.1 1.1M11.8 4.2l-1.1 1.1M5.3 10.7l-1.1 1.1" />
  </svg>
)

export const IconPanelLeft = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.4" y="3.2" width="11.2" height="9.6" rx="1.6" />
    <path d="M6.4 3.2v9.6" />
  </svg>
)

export const IconPanelRight = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.4" y="3.2" width="11.2" height="9.6" rx="1.6" />
    <path d="M9.6 3.2v9.6" />
  </svg>
)

/** 收起侧栏：面板 + 向左箭头 */
export const IconPanelCollapse = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.4" y="3.2" width="11.2" height="9.6" rx="1.6" />
    <path d="M6.2 3.2v9.6" />
    <path d="M10.6 6.4 8.9 8l1.7 1.6" />
  </svg>
)

/** 展开侧栏：面板 + 向右箭头 */
export const IconPanelExpand = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.4" y="3.2" width="11.2" height="9.6" rx="1.6" />
    <path d="M6.2 3.2v9.6" />
    <path d="M8.9 6.4 10.6 8l-1.7 1.6" />
  </svg>
)

export const IconHelp = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="5.8" />
    <path d="M6.5 6.2a1.6 1.6 0 1 1 2.2 1.5c-.5.2-.7.6-.7 1.1v.3" />
    <circle cx="8" cy="11.2" r="0.5" fill="currentColor" stroke="none" />
  </svg>
)

export const IconUpload = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 10.5V2.8M4.8 5.7 8 2.5l3.2 3.2" />
    <path d="M2.9 10.4v1.4a1.3 1.3 0 0 0 1.3 1.3h7.6a1.3 1.3 0 0 0 1.3-1.3v-1.4" />
  </svg>
)

export const IconMinimize = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 8h10" />
  </svg>
)

export const IconMaximize = (p: P) => (
  <svg {...base(p)}>
    <rect x="3.4" y="3.4" width="9.2" height="9.2" rx="1.2" />
  </svg>
)

export const IconClose = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
)

export const IconDots = (p: P) => (
  <svg {...base(p)}>
    <circle cx="3.6" cy="8" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="12.4" cy="8" r="0.9" fill="currentColor" stroke="none" />
  </svg>
)

export const IconShield = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 2.2 3.4 4v4c0 2.6 1.9 4.6 4.6 5.8 2.7-1.2 4.6-3.2 4.6-5.8V4L8 2.2Z" />
  </svg>
)

export const IconSparkle = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 2.6 9.3 6 12.6 7.3 9.3 8.6 8 12 6.7 8.6 3.4 7.3 6.7 6 8 2.6Z" />
  </svg>
)

export const IconCopy = (p: P) => (
  <svg {...base(p)}>
    <rect x="5.6" y="5.6" width="7.2" height="7.2" rx="1.4" />
    <path d="M10.4 5.6V4.4a1.2 1.2 0 0 0-1.2-1.2H4.4a1.2 1.2 0 0 0-1.2 1.2v4.8a1.2 1.2 0 0 0 1.2 1.2h1.2" />
  </svg>
)

export const IconThumbUp = (p: P) => (
  <svg {...base(p)}>
    <path d="M5.4 13V6.6l2.7-4a1 1 0 0 1 1.7.9l-.6 2.4h3a1.2 1.2 0 0 1 1.2 1.5l-1 4.3a1.2 1.2 0 0 1-1.2.9H5.4Z" />
    <path d="M2.6 6.6h1.6v6.4H2.6z" />
  </svg>
)

export const IconThumbDown = (p: P) => (
  <svg {...base(p)}>
    <path d="M10.6 3v6.4l-2.7 4a1 1 0 0 1-1.7-.9l.6-2.4h-3a1.2 1.2 0 0 1-1.2-1.5l1-4.3A1.2 1.2 0 0 1 4.8 3h5.8Z" />
    <path d="M13.4 3h-1.6v6.4h1.6z" />
  </svg>
)

export const IconShare = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 10.2V2.6M5.4 5.2 8 2.6l2.6 2.6" />
    <path d="M3.4 8.8v3a1.4 1.4 0 0 0 1.4 1.4h6.4a1.4 1.4 0 0 0 1.4-1.4v-3" />
  </svg>
)

export const IconFile = (p: P) => (
  <svg {...base(p)}>
    <path d="M8.8 2.4H4.6a1.4 1.4 0 0 0-1.4 1.4v8.4a1.4 1.4 0 0 0 1.4 1.4h6.8a1.4 1.4 0 0 0 1.4-1.4V5.8L8.8 2.4Z" />
    <path d="M8.6 2.6v3.2h3.2" />
  </svg>
)

export const IconUndo = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.4 6.4h6a3.2 3.2 0 0 1 0 6.4H5.6" />
    <path d="M5.8 3.8 3.2 6.4l2.6 2.6" />
  </svg>
)

export const IconCheck = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.2 8.4 6.3 11.5 12.8 5" />
  </svg>
)

export const IconStop = (p: P) => (
  <svg {...base(p)}>
    <rect x="4.6" y="4.6" width="6.8" height="6.8" rx="1.4" fill="currentColor" stroke="none" />
  </svg>
)

export const IconClock = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="5.6" />
    <path d="M8 4.9V8l2.2 1.4" />
  </svg>
)

export const IconCommand = (p: P) => (
  <svg {...base(p)}>
    <path d="M5.6 2.8a1.4 1.4 0 1 1-1.4 1.4v7.6a1.4 1.4 0 1 1 1.4-1.4h4.8a1.4 1.4 0 1 1 1.4 1.4V4.2a1.4 1.4 0 1 1-1.4 1.4H5.6Z" />
  </svg>
)

export const IconWrench = (p: P) => (
  <svg {...base(p)}>
    <path d="M9.8 2.6a3.4 3.4 0 0 0-3 4.9L2.8 11.5l1.7 1.7 4-4a3.4 3.4 0 0 0 4.9-3l-2 2-1.7-1.7 2-2a3.4 3.4 0 0 0-1.9-1.9Z" />
  </svg>
)

export const IconBookmark = (p: P) => (
  <svg {...base(p)}>
    <path d="M4.4 2.8h7.2v10.4L8 10.4l-3.6 2.8V2.8Z" />
  </svg>
)

/** 分支：git branch 样式 */
export const IconEdit = (p: P) => (
  <svg {...base(p)}>
    <path d="M11.3 2l2.7 2.7-7.4 7.4-3.2.5.5-3.2z" />
    <path d="M9.8 3.5l2.7 2.7" />
  </svg>
)

export const IconTrash = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.5 4.5h11" />
    <path d="M6 4.5V3h4v1.5" />
    <path d="M4.4 4.5l.6 8a1 1 0 0 0 1 .9h4a1 1 0 0 0 1-.9l.6-8" />
  </svg>
)

export const IconSpinner = (p: P) => (
  <svg {...base(p)} className={`animate-spin ${p.className ?? ''}`} style={{ animationDuration: '1.4s' }}>
    <circle cx="8" cy="8" r="5.5" strokeOpacity="0.2" />
    <path d="M13.5 8A5.5 5.5 0 0 0 8 2.5" />
  </svg>
)

export const IconBranch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="4.8" cy="3.8" r="1.5" />
    <circle cx="4.8" cy="12.2" r="1.5" />
    <circle cx="11.2" cy="6.4" r="1.5" />
    <path d="M4.8 5.3v5.4M11.2 7.9c0 2.1-1.7 3-3.4 3.3" />
  </svg>
)

/** 手形：需要确认的权限档位 */
export const IconHand = (p: P) => (
  <svg {...base(p)}>
    <path d="M5.6 8.2V4.4a1 1 0 0 1 2 0v3.2M7.6 7.4V3.6a1 1 0 0 1 2 0v3.8M9.6 7.6V4.6a1 1 0 0 1 2 0v4.6c0 2.4-1.5 4-3.8 4-1.6 0-2.4-.7-3.2-1.8L2.8 9.2a1 1 0 0 1 1.6-1.2l1.2 1.3" />
  </svg>
)
