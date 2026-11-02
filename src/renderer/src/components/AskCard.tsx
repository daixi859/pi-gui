import { useState, type ReactNode } from 'react'
import type { AskAnswer, AskQuestion } from '@shared/ipc'
import { IconArrowLeft, IconArrowRight, IconCheck } from './icons'

/** 一道题的本地编辑态；custom 与 option/selected 互斥由提交时决定 */
interface Draft {
  option?: number
  selected: number[]
  custom: string
  typing: boolean
}

const emptyDraft = (): Draft => ({ selected: [], custom: '', typing: false })
const px = (n: number): { width: number; height: number } => ({ width: n, height: n })

/**
 * 问答卡：rpiv 扩展逐题 await select/input，宿主把整份问卷一次性交给这里，
 * 用户翻页填完后一次性回填。见 docs/adr/0005-ask-card.md。
 */
export function AskCard({
  id,
  questions,
  onAnswer,
  onCancel
}: {
  id: string
  questions: AskQuestion[]
  onAnswer: (id: string, answers: AskAnswer[]) => void
  onCancel: (id: string) => void
}): ReactNode {
  const [step, setStep] = useState(0)
  const [drafts, setDrafts] = useState<Draft[]>(() => questions.map(emptyDraft))
  const q = questions[step]
  const d = drafts[step]
  const last = questions.length - 1

  const patch = (next: Partial<Draft>): void =>
    setDrafts((all) => all.map((cur, i) => (i === step ? { ...cur, ...next } : cur)))
  const answered = (dr: Draft): boolean => dr.custom.trim().length > 0 || (dr.option ?? -1) >= 0 || dr.selected.length > 0

  const submit = (): void => {
    const answers = drafts.map((dr, i) =>
      questions[i].multiSelect
        ? { selected: dr.selected, custom: dr.custom.trim() || undefined }
        : dr.custom.trim()
          ? { custom: dr.custom.trim() }
          : { option: dr.option }
    )
    onAnswer(id, answers)
  }

  return (
    <div className="rounded-[14px] border border-edge bg-surface px-4 pt-3.5 pb-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_28px_-18px_rgba(0,0,0,0.25)]">
      <div className="flex items-start gap-2">
        {q.header && (
          <span className="mt-[1px] shrink-0 rounded-[6px] bg-sunken px-1.5 py-[3px] text-[11px] leading-none text-muted">
            {q.header}
          </span>
        )}
        <p className="min-w-0 flex-1 text-[13.5px] leading-[1.5] text-fg">{q.question}</p>
        <div className="ml-1 flex shrink-0 items-center gap-1 text-[11.5px] text-faint">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
            className="grid h-5 w-5 place-items-center rounded-[5px] hover:bg-black/[0.05] disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="上一题"
          >
            <IconArrowLeft {...px(12)} />
          </button>
          <span className="tabular-nums">
            {step + 1} / {questions.length}
          </span>
          <button
            type="button"
            disabled={step === last}
            onClick={() => setStep((s) => s + 1)}
            className="grid h-5 w-5 place-items-center rounded-[5px] hover:bg-black/[0.05] disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="下一题"
          >
            <IconArrowRight {...px(12)} />
          </button>
        </div>
      </div>

      <div className="mt-2.5">
        {q.options.map((o, i) => {
          const on = q.multiSelect ? d.selected.includes(i) : !d.custom.trim() && d.option === i
          return (
            <button
              key={i}
              type="button"
              onClick={() =>
                patch(
                  q.multiSelect
                    ? { selected: on ? d.selected.filter((n) => n !== i) : [...d.selected, i] }
                    : { option: i, custom: '' }
                )
              }
              className={`flex w-full items-start gap-2 rounded-[8px] px-2 py-[7px] text-left transition-colors ${
                on ? 'bg-black/[0.045]' : 'hover:bg-black/[0.03]'
              }`}
            >
              {q.multiSelect ? (
                <span
                  className={`mt-[2px] grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[4px] border ${
                    on ? 'border-fg bg-fg text-white' : 'border-edge'
                  }`}
                >
                  {on && <IconCheck {...px(10)} />}
                </span>
              ) : (
                <span className="mt-[1px] w-[16px] shrink-0 text-[12.5px] tabular-nums text-faint">{i + 1}.</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] leading-[1.35] font-medium text-fg">{o.label}</span>
                {o.description && (
                  <span className="mt-[1px] block text-[12px] leading-[1.45] text-muted">{o.description}</span>
                )}
              </span>
            </button>
          )
        })}

        {d.typing ? (
          <div className="mt-1 flex items-start gap-2 rounded-[8px] bg-black/[0.03] px-2 py-[7px]">
            <span className="mt-[1px] w-[16px] shrink-0 text-[12.5px] text-faint">{q.options.length + 1}.</span>
            <input
              autoFocus
              value={d.custom}
              onChange={(e) => patch({ custom: e.target.value })}
              placeholder="输入你的回答…"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-faint"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => patch({ typing: true, option: undefined })}
            className="mt-1 flex w-full items-start gap-2 rounded-[8px] px-2 py-[7px] text-left text-[13px] text-faint hover:bg-black/[0.03]"
          >
            {!q.multiSelect && <span className="mt-[1px] w-[16px] shrink-0 text-[12.5px]">{q.options.length + 1}.</span>}
            <span className="min-w-0 flex-1 truncate">{d.custom || '输入你的回答…'}</span>
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-edge/70 pt-2">
        <span className="text-[11px] text-faint">ⓘ 使用 Tab / 上下键选择，回车或空格选中</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onCancel(id)}
            className="rounded-[7px] border border-edge px-2.5 py-[4px] text-[12px] text-fg hover:bg-black/[0.04]"
          >
            忽略
          </button>
          {step < last ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!answered(d)}
              className="rounded-[7px] bg-fg px-2.5 py-[4px] text-[12px] text-white disabled:opacity-35"
            >
              继续
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!answered(d)}
              className="rounded-[7px] bg-fg px-2.5 py-[4px] text-[12px] text-white disabled:opacity-35"
            >
              提交
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
