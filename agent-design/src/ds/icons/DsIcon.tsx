/**
 * PiDS 图标集：24 个核心图标，统一 16px 网格、1.5px 描边、round 端点。
 *
 * 为什么重画而不是复用旧 sprite：旧 sprite 是 20/24 网格混排、描边 1.25–1.75 不一，
 * 与 PiDS 的 1.5px 恒定描边在 16px 下并排时粗细会跳。这里全部在 16 网格上手写，
 * stroke-width 由外层统一给，任何尺寸下粗细都一致（缩放时按 16/size 补偿见 `vector`）。
 * 其余非核心图标（文件类型等）继续用旧 sprite，不重复造。
 */
import { memo, type ReactNode } from 'react'

/** 图标组件的统一入参。 */
export interface DsIconProps {
  /** 边长 px，默认 16（网格原大）。 */
  size?: number | undefined
  /** 额外的布局类，颜色跟随 currentColor。 */
  className?: string | undefined
  /** 无障碍名：有值时图标可被读屏读出，否则 aria-hidden。 */
  label?: string | undefined
}

/** 图标数据：viewBox 永远 16×16，内容不写 stroke，由外层给。 */
type Glyph = ReactNode

const GLYPHS = {
  /* ---------- 导航 6 ---------- */
  sidebar: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="2" />
      <path d="M6.5 3v10" />
    </>
  ),
  chat: <path d="M13.5 8.5a5.5 5.5 0 0 1-5.5 5.5H3.5l.9-2.4A5.5 5.5 0 1 1 13.5 8.5Z" />,
  layers: (
    <>
      <path d="M8 2 2 5l6 3 6-3-6-3Z" />
      <path d="M2.5 8.2 8 11l5.5-2.8" />
      <path d="M2.5 11.2 8 14l5.5-2.8" />
    </>
  ),
  sliders: (
    <>
      <path d="M3 4.5h10M3 8h10M3 11.5h10" />
      <circle cx="6" cy="4.5" r="1.4" />
      <circle cx="10.5" cy="8" r="1.4" />
      <circle cx="5.5" cy="11.5" r="1.4" />
    </>
  ),
  grid: (
    <>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
    </>
  ),
  panelRight: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="2" />
      <path d="M9.5 3v10" />
    </>
  ),
  history: (
    <>
      <path d="M2.6 8a5.4 5.4 0 1 0 1.6-3.8" />
      <path d="M2.4 2.6v2.6h2.6" />
      <path d="M8 5.4V8l1.9 1.2" />
    </>
  ),

  /* ---------- 工具 5 ---------- */
  search: (
    <>
      <circle cx="7" cy="7" r="4" />
      <path d="M10 10l3.5 3.5" />
    </>
  ),
  plus: <path d="M8 3v10M3 8h10" />,
  command: (
    <path d="M6 3a1.75 1.75 0 1 0 1.75 1.75V11.25A1.75 1.75 0 1 0 8 9.5h3.25A1.75 1.75 0 1 0 9.5 11.25V4.75A1.75 1.75 0 1 0 11.25 6.5H8" />
  ),
  paperclip: <path d="M11.6 5.2 6.9 9.9a1.6 1.6 0 0 0 2.2 2.2l4.4-4.4a3 3 0 0 0-4.2-4.2L4.6 8.2a4.4 4.4 0 1 0 6.2 6.2l3-3" />,
  send: <path d="M2.5 8 13.5 2.5 11 13.5 8 9.5 2.5 8Z" />,

  /* ---------- 状态 5 ---------- */
  check: <path d="M3.5 8.5 6.4 11.4 12.5 5" />,
  alert: (
    <>
      <circle cx="8" cy="8" r="5.75" />
      <path d="M8 5.2v3.6M8 10.9v.1" />
    </>
  ),
  ban: (
    <>
      <circle cx="8" cy="8" r="5.75" />
      <path d="M4.2 4.2 11.8 11.8" />
    </>
  ),
  spinner: <path d="M8 2.25a5.75 5.75 0 0 1 5.75 5.75" />,
  dot: <circle cx="8" cy="8" r="3" fill="currentColor" stroke="none" />,

  /* ---------- 操作 6 ---------- */
  chevronDown: <path d="M4.5 6.25 8 9.75l3.5-3.5" />,
  chevronRight: <path d="M6.25 4.5 9.75 8l-3.5 3.5" />,
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  more: (
    <>
      <circle cx="3.5" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  copy: (
    <>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.6" />
      <path d="M10.5 5.5v-1a1.6 1.6 0 0 0-1.6-1.6H4.1A1.6 1.6 0 0 0 2.5 4.5v4.6a1.6 1.6 0 0 0 1.6 1.6h1" />
    </>
  ),
  trash: (
    <>
      <path d="M2.75 4.5h10.5M6 4.5V3.2c0-.4.3-.7.7-.7h2.6c.4 0 .7.3.7.7v1.3" />
      <path d="M4.2 4.5l.5 7.4c0 .8.7 1.4 1.5 1.4h3.6c.8 0 1.4-.6 1.5-1.4l.5-7.4" />
    </>
  ),

  /* ---------- 主题 3 ---------- */
  sun: (
    <>
      <circle cx="8" cy="8" r="2.9" />
      <path d="M8 1.8v1.4M8 12.8v1.4M2.6 8h1.4M12 8h1.4M4.2 4.2l1 1M10.8 10.8l1 1M11.8 4.2l-1 1M5.2 10.8l-1 1" />
    </>
  ),
  moon: <path d="M13 9.6A5.6 5.6 0 0 1 6.4 3a5.7 5.7 0 1 0 6.6 6.6Z" />,
  auto: (
    <>
      <circle cx="8" cy="8" r="5.75" />
      <path d="M8 2.25v11.5" />
      <path d="M8 2.25a5.75 5.75 0 0 1 0 11.5Z" fill="currentColor" stroke="none" opacity="0.9" />
    </>
  ),

  /* ---------- 品牌 2 ---------- */
  pi: (
    <>
      <circle cx="8" cy="8" r="5.75" />
      <path d="M5.6 5.4h4.8M7.1 5.4v5.2M10.6 8.9c0 1-.8 1.7-1.9 1.7" />
    </>
  ),  sparkle: (
    <path d="M8 2.4 9.3 6.1 13 7.4l-3.7 1.3L8 12.4 6.7 8.7 3 7.4l3.7-1.3L8 2.4Z" />
  ),
} satisfies Record<string, Glyph>

/** 可用图标名。 */
export type DsIconName = keyof typeof GLYPHS

/**
 * 渲染一个 PiDS 图标。
 *
 * 描边粗细随尺寸反向补偿：在 16px 是 1.5，缩到 12px 时按比例变粗一点点，
 * 保证小尺寸下不会「虚」；放大到 20/24 时保持视觉上仍是发丝级。
 * @param props.name - 图标名。
 * @param props.size - 边长 px，默认 16。
 * @param props.className - 布局类。
 * @param props.label - 有值则作为 aria-label，否则 aria-hidden。
 * @returns 内联 SVG。
 */
export const DsIcon = memo(function DsIcon({
  name,
  size = 16,
  className,
  label,
}: DsIconProps & { name: DsIconName }) {
  const stroke = size <= 14 ? 1.5 * (16 / size) * 0.92 : 1.5 * (16 / size)
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={Number(stroke.toFixed(2))}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {GLYPHS[name]}
    </svg>
  )
})

/** 全部图标名，规范页按组展示用。 */
export const ICON_NAMES = Object.keys(GLYPHS) as DsIconName[]
