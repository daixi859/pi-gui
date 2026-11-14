import { memo } from 'react'
import { TextShimmer } from '../primitives/TextShimmer'
import { zh } from '../i18n/zh'
import { formatDuration } from '../lib/format'

/** 鲸鱼轮廓（16×16 描边图形）：一条路径，走 currentColor，跟着文本色变化。 */
const WHALE_PATH =
  'M8.844 13.742C8.967 12.328 8.45 10.4 8.45 9.65C8.45 8.94 8.88 8.43 9.6 8.43C11.285 8.43 12.106 8.281 12.685 8.104C13.71 7.791 14.585 6.768 15.055 5.945C15.137 5.803 14.99 5.641 14.829 5.671C13.829 5.86 12.828 5.376 11.827 4.978C10.659 4.514 9.491 4.707 8.935 4.876C8.805 4.915 8.658 4.819 8.636 4.686C8.468 3.643 7.405 2.615 5.498 2.238C4.54 2.048 3.748 1.574 3.347 1.202C3.252 1.113 3.088 1.125 3.03 1.242C2.628 2.059 2.168 3.82 5.248 6.115C5.82 6.494 6.31 6.785 6.574 7.637C6.72 8.104 6.157 9.168 6.061 9.368C5.157 11.27 5.089 12.19 4.926 13.742'

/** 运行中的文案：不足 1 秒不报时长，避免开局就闪「不到 1 秒」。 */
function runningStatusLabel(elapsed: number | undefined): string {
  return elapsed === undefined || elapsed < 1000 ? zh.running : zh.runningFor(formatDuration(elapsed))
}

/**
 * 回合尾部的运行指示：摆尾的鲸鱼 + 扫光文案（「深度求索中，用时 x 秒 ···」）。
 * 鲸鱼是纯 SVG 描边 + CSS 动画（不外挂图片资源），减少动效时静止。
 */
export const RunningStatus = memo(function RunningStatus({ elapsed, active = true }: { elapsed?: number; active?: boolean }) {
  return (
    <div className="running" aria-live="polite">
      <span className="runningContent">
        <span className="runningIcon" aria-hidden="true">
          <svg className="runningWhale" viewBox="0 0 16 16" fill="none">
            <path
              d={WHALE_PATH}
              stroke="currentColor"
              strokeWidth={1}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <TextShimmer active={active} className="runningText">{runningStatusLabel(elapsed)}</TextShimmer>
      </span>
    </div>
  )
})
