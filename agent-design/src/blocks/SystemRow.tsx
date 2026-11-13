import { memo } from 'react'
import { IconInfoOutlineRegular, IconWarningTriangleOutlineRegular } from '../icons'
import type { SystemBlock } from '../reducer/types'

/** 系统提示：不参与折叠，永远贴在过程里。 */
export const SystemRow = memo(function SystemRow({ block }: { block: SystemBlock }) {
  return (
    <div className="systemRow" data-tone={block.tone}>
      {block.tone === 'info' ? (
        <IconInfoOutlineRegular size={12} />
      ) : (
        <IconWarningTriangleOutlineRegular size={12} />
      )}
      <span>{block.text}</span>
    </div>
  )
})
