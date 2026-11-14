import { memo } from 'react'
import { runningLabel, withNumeric } from './headText'

/**
 * 运行中的总行（只读，不可折叠）。
 *
 * 单独成件是因为它要在「回合还没成形」时也能画：发完消息到 user 块到达之间有几十毫秒
 * 的空窗，那段时间回合还不在 store 里，宿主用一个 `elapsed: undefined` 的实例顶上，
 * 保证发出即见「正在工作中」，不必等任何事件回来。
 */
export const RunningHead = memo(function RunningHead({ elapsed }: { elapsed?: number }) {
  return (
    <div className="turnHead" data-live="">
      <span className="turnHeadText">{withNumeric(runningLabel(elapsed))}</span>
    </div>
  )
})
