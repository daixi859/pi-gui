import { type ReactNode, useEffect, useState } from 'react'
import type { UiRequest } from '@shared/ipc'
import { IconClose } from './icons'

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
      <div className="w-[440px] max-w-[calc(100vw-48px)] rounded-[14px] border border-edge bg-surface p-4 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.3)]">
        <div className="flex items-start gap-3">
          <p className="min-w-0 flex-1 whitespace-pre-wrap text-[13px] leading-[1.55] text-fg">
            {title || req.message}
          </p>
          <button
            type="button"
            onClick={close}
            aria-label="关闭"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] text-faint hover:bg-black/[0.05]"
          >
            <IconClose width={12} height={12} />
          </button>
        </div>

        {req.kind === 'confirm' && req.message && <p className="mt-2 text-[12.5px] text-muted">{req.message}</p>}

        {req.kind === 'select' && (
          <div className="mt-3 max-h-[280px] overflow-y-auto">
            {(req.options ?? []).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => onReply(req.id, { value: o })}
                className="flex w-full items-start rounded-[8px] px-2 py-[7px] text-left text-[13px] text-fg hover:bg-black/[0.04]"
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
            className="mt-3 w-full resize-none rounded-[8px] border border-edge bg-canvas px-2.5 py-2 text-[13px] text-fg outline-none placeholder:text-faint focus:border-faint"
          />
        )}

        <div className="mt-3 flex justify-end gap-1.5">
          <button
            type="button"
            onClick={close}
            className="rounded-[7px] border border-edge px-2.5 py-[5px] text-[12px] text-fg hover:bg-black/[0.04]"
          >
            取消
          </button>
          {req.kind === 'confirm' ? (
            <button
              type="button"
              onClick={() => onReply(req.id, { confirmed: true })}
              className="rounded-[7px] bg-fg px-2.5 py-[5px] text-[12px] text-white"
            >
              确认
            </button>
          ) : req.kind === 'select' ? null : (
            <button
              type="button"
              onClick={() => onReply(req.id, { value: text })}
              className="rounded-[7px] bg-fg px-2.5 py-[5px] text-[12px] text-white"
            >
              确定
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
