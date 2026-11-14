import type { ReactNode } from 'react'
import { zh } from '../i18n/zh'
import { formatDuration } from '../lib/format'

/** 时长里的数字单独走等宽、tabular，和 harness 的总行一致。 */
export function withNumeric(value: string): ReactNode {
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

/** 运行中的总行文案：不足 1 秒只说「正在工作中…」，避免开局就弹「用时 不到 1 秒」。 */
export function runningLabel(elapsed: number | undefined): string {
  return elapsed === undefined || elapsed < 1000 ? zh.turn.working : zh.turn.workingFor(formatDuration(elapsed))
}
