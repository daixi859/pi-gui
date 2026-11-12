import { useState } from 'react'
import { CodeBlock } from '../ocu/CodeBlock'
import { QuietDotsWave } from '../ocu/StatusIndicators'
import type { ToolBlock } from './blocks'

/** 取参数里最能代表这次调用的一个字段做摘要（命令 / 路径 / 模式） */
function summarize(block: ToolBlock): string {
  if (block.partialArgs !== undefined) {
    // pi 的流式中间帧 arguments 为空对象，参数只有 partialArgs 半截文本，先不摘要
    return '接收参数中…'
  }
  const args = block.args
  const v = args.command ?? args.file_path ?? args.path ?? args.pattern ?? args.query ?? args.url ?? ''
  return String(v).replace(/\s+/g, ' ')
}

/** 工具调用块：收起时一行摘要，展开后显示参数与结果；running = 尚无配对的 toolResult */
export function ToolStep({ block }: { block: ToolBlock }) {
  const [open, setOpen] = useState(false)
  const pending = block.state === 'running'

  return (
    <div
      data-cds="ToolStep"
      className="my-1 overflow-hidden rounded-lg border border-[var(--cds-border)] bg-[var(--cds-surface-2)] text-xs"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left hover:bg-[var(--cds-surface-3)]"
      >
        {pending ? (
          <QuietDotsWave label="" />
        ) : (
          <span
            className={`size-1.5 shrink-0 rounded-full ${block.result?.isError ? 'bg-red-500' : 'bg-emerald-500'}`}
          />
        )}
        <span className="font-mono font-semibold">{block.name}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-[var(--cds-text-secondary)]">{summarize(block)}</span>
        {block.result?.durationMs != null && (
          <span className="font-mono text-[11px] text-[var(--cds-text-muted)] tabular-nums">
            {block.result.durationMs}ms
          </span>
        )}
        <span
          className={`text-[10px] text-[var(--cds-text-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 border-t border-[var(--cds-border)] p-3">
          <CodeBlock
            code={pending && block.partialArgs !== undefined ? block.partialArgs : JSON.stringify(block.args, null, 2)}
            language="json"
          />
          {block.result && (
            <CodeBlock
              code={block.result.content.map((c) => c.text).join('\n') || '(无输出)'}
              language={block.result.isError ? 'error' : 'text'}
            />
          )}
        </div>
      )}
    </div>
  )
}
