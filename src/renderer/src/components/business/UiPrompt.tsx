import { type ReactNode, useEffect, useState } from 'react'
import type { UiRequest } from '@shared/ipc'
import { IconClose } from '../base/icons'
import { Button } from '../base/Button'

/**
 * 裸 UI 请求的原生弹窗：没有交互适配器认领的 select/input/confirm/editor 落到这里，
 * 保证任何扩展调用的 ui.* 都有响应，不再静默吞掉或恒返回 false。
 */
export function UiPrompt({
  req,
  onReply
}: {
  req: UiRequest
  onReply: (id: string, reply: { value?: string; confirmed?: boolean; cancelled?: boolean }) => void
}): ReactNode {
  const [text, setText] = useState(req.prefill ?? '')
  useEffect(() => setText(req.prefill ?? ''), [req.id, req.prefill])

  const close = (): void => onReply(req.id, { cancelled: true })
  const title = req.kind === 'confirm' ? req.title : (req.title ?? '')

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20" role="dialog" aria-modal="true">
      <div className="pi-card w-[440px] max-w-[calc(100vw-48px)] p-4 shadow-dialog">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-[1.55] text-fg">
            {title || req.message}
          </p>
          <Button
            aria-label="关闭"
            variant="ghost"
            size="sm"
            shape="circle"
            className="shrink-0"
            onClick={close}
            icon={<IconClose />}
          />
        </div>

        {req.kind === 'confirm' && req.message && <p className="mt-2 text-sm text-muted">{req.message}</p>}

        {req.kind === 'select' && (
          <div className="mt-2 max-h-[280px] overflow-y-auto">
            {(req.options ?? []).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => onReply(req.id, { value: o })}
                className="flex w-full items-start rounded-sm px-2 py-2 text-left text-sm text-fg hover:bg-tint"
              >
                {o}
              </button>
            ))}
          </div>
        )}

        {(req.kind === 'input' || req.kind === 'editor') && (
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={req.placeholder}
            rows={req.kind === 'editor' ? 6 : 3}
            className="mt-2 w-full resize-none rounded-sm border border-edge bg-canvas px-2 py-2 text-sm text-fg outline-none placeholder:text-faint focus:border-faint"
          />
        )}

        <div className="mt-2 flex justify-end gap-1">
          <Button onClick={close}>取消</Button>
          {req.kind === 'confirm' ? (
            <Button variant="primary" onClick={() => onReply(req.id, { confirmed: true })}>
              确认
            </Button>
          ) : req.kind === 'select' ? null : (
            <Button variant="primary" onClick={() => onReply(req.id, { value: text })}>
              确定
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
