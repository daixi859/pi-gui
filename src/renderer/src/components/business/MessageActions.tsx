import { useEffect, useRef, useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import { Button, IconCopy, IconShare, IconThumbDown, IconThumbUp } from 'agent-design/components'

/** 渲染层不能直接用 shell / clipboard，全部过 preload 的主进程桥 */
const host = (): Window['pi']['host'] | undefined => window.pi?.host

/**
 * 一条回答下方的操作条：复制 / 评价 / 导出。
 * 复制只用最后一段回答的纯文本；导出时才调 full() 拼整篇 markdown（这步很贵，不能每帧做）
 */
export function MessageActions({
  text,
  time,
  full
}: {
  text: string
  time: string
  full?: () => string
}): ReactNode {
  const [voted, setVoted] = useState<'up' | 'down' | null>(null)
  const [copied, setCopied] = useState(false)
  // 连点复制会叠定时器：新版盖掉旧版，组件卸载时一并清
  const resetCopy = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(resetCopy.current), [])
  const items = [
    {
      key: 'copy',
      icon: IconCopy,
      label: copied ? '已复制' : '复制',
      onClick: () => {
        host()?.copy(text)
        setCopied(true)
        window.clearTimeout(resetCopy.current)
        resetCopy.current = window.setTimeout(() => setCopied(false), 1500)
      }
    },
    {
      key: 'up',
      icon: IconThumbUp,
      label: '有帮助',
      active: voted === 'up',
      onClick: () => setVoted((v) => (v === 'up' ? null : 'up'))
    },
    {
      key: 'down',
      icon: IconThumbDown,
      label: '没帮助',
      active: voted === 'down',
      onClick: () => setVoted((v) => (v === 'down' ? null : 'down'))
    },
    {
      key: 'share',
      icon: IconShare,
      label: '导出为 Markdown',
      onClick: () => host()?.saveText('Pi 会话.md', full ? full() : text)
    }
  ]
  return (
    <div className="flex items-center gap-1 text-faint">
      {items.map(({ key, icon: Ico, label, active, onClick }) => (
        <Button
          key={key}
          title={label}
          aria-label={label}
          variant="ghost"
          className={clsx(active && 'text-fg')}
          onClick={onClick}
          icon={<Ico className="size-[15px]" />}
        />
      ))}
      <span className="ml-1 text-xs">{time}</span>
    </div>
  )
}
