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
    <div className="pi-card px-4 pt-4 pb-2 shadow-card">
      <div className="flex items-start gap-2">
        {q.header && (
          <span className="mt-0.5 shrink-0 rounded-sm bg-sunken px-1 py-0.5 text-xs leading-none text-muted">
            {q.header}
          </span>
        )}
        <p className="min-w-0 flex-1 text-sm leading-[1.5] text-fg">{q.question}</p>
        <div className="ml-1 flex shrink-0 items-center gap-1 text-xs text-faint">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
            className="grid h-5 w-5 place-items-center rounded-sm hover:bg-tint disabled:opacity-30 disabled:hover:bg-transparent"
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
            className="grid h-5 w-5 place-items-center rounded-sm hover:bg-tint disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="下一题"
          >
            <IconArrowRight {...px(12)} />
          </button>
        </div>
      </div>

      <div className="mt-2">
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
              className={`flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left transition-colors ${
                on ? 'bg-tint-strong' : 'hover:bg-tint'
              }`}
            >
              {q.multiSelect ? (
                <span
                  className={`mt-0.5 grid h-[15px] w-[15px] shrink-0 place-items-center rounded-sm border ${
                    on ? 'border-fg bg-fg text-white' : 'border-edge'
                  }`}
                >
                  {on && <IconCheck {...px(10)} />}
                </span>
              ) : (
                <span className="mt-0.5 w-[16px] shrink-0 text-xs tabular-nums text-faint">{i + 1}.</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-[1.35] font-medium text-fg">{o.label}</span>
                {o.description && (
                  <span className="mt-0.5 block text-xs leading-[1.45] text-muted">{o.description}</span>
                )}
              </span>
            </button>
          )
        })}

        {d.typing ? (
          <div className="mt-1 flex items-start gap-2 rounded-sm bg-tint px-2 py-2">
            <span className="mt-0.5 w-[16px] shrink-0 text-xs text-faint">{q.options.length + 1}.</span>
            <input
              autoFocus
              value={d.custom}
              onChange={(e) => patch({ custom: e.target.value })}
              placeholder="输入你的回答…"
              className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-faint"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => patch({ typing: true, option: undefined })}
            className="mt-1 flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-xs text-faint hover:bg-tint"
          >
            {!q.multiSelect && <span className="mt-0.5 w-[16px] shrink-0 text-xs">{q.options.length + 1}.</span>}
            <span className="min-w-0 flex-1 truncate">{d.custom || '输入你的回答…'}</span>
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-edge/70 pt-2">
        <span className="text-xs text-faint">ⓘ 使用 Tab / 上下键选择，回车或空格选中</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onCancel(id)}
            className="rounded-md border border-edge px-2 py-1 text-sm text-fg hover:bg-tint"
          >
            忽略
          </button>
          {step < last ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!answered(d)}
              className="pi-btn disabled:opacity-35"
            >
              继续
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!answered(d)}
              className="pi-btn disabled:opacity-35"
            >
              提交
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
