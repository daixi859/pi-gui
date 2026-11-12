import { useState } from 'react'
import {
  APPROVAL_REQUESTS,
  RISK_META,
  VERDICT_LABEL,
  type ApprovalRequest,
  type ApprovalVerdict
} from './mock/approvals'
import { fmtRelative } from './format'
import { McpToolDecisionCard } from '../ocu/McpToolDecisionCard'
import { useSettings, type ApprovalPolicy } from './settings'
import { useToast } from './toast'
import { Icon } from './ui/Icon'

const POLICY_LABEL: Record<ApprovalPolicy, string> = {
  ask: '每次询问',
  readonly: '只读自动放行',
  deny: '全部拒绝'
}

export function ApprovalsPage({
  decisions,
  onDecide,
  onUndo,
  onOpenSettings
}: {
  decisions: Record<string, ApprovalVerdict>
  onDecide: (id: string, verdict: ApprovalVerdict) => void
  onUndo: (id: string) => void
  onOpenSettings: () => void
}) {
  const { settings } = useSettings()
  const { push } = useToast()
  const [nonce, setNonce] = useState<Record<string, number>>({})

  const pending = APPROVAL_REQUESTS.filter((request) => !decisions[request.id])
  const approved = APPROVAL_REQUESTS.filter(
    (request) => decisions[request.id] && decisions[request.id] !== 'deny'
  ).length
  const denied = APPROVAL_REQUESTS.filter((request) => decisions[request.id] === 'deny').length

  const undo = (request: ApprovalRequest) => {
    onUndo(request.id)
    setNonce((prev) => ({ ...prev, [request.id]: (prev[request.id] ?? 0) + 1 }))
    push({
      title: '已撤销决议',
      description: `${request.toolCall.toolName} 回到等待授权状态。`
    })
  }

  const decide = (request: ApprovalRequest, verdict: ApprovalVerdict) => {
    onDecide(request.id, verdict)
    push({
      title:
        verdict === 'deny'
          ? '已拒绝执行'
          : verdict === 'always_allow'
            ? '已加入始终允许'
            : '已单次批准',
      description: `${request.toolCall.toolName} · ${request.reason}`,
      action: { label: '撤销', onClick: () => undo(request) }
    })
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[820px] px-5 pb-20 pt-8 md:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-semibold tracking-tight text-[var(--cds-text-primary)]">
                工具审批
              </h1>
              <span className="rounded-full border border-[var(--cds-border)] bg-[var(--cds-surface-0)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--cds-text-muted)]">
                演示
              </span>
            </div>
            <p className="mt-1.5 max-w-[520px] text-xs leading-5 text-[var(--cds-text-secondary)]">
              代理调用写文件、执行命令、发 PR 这类工具时会先停下来，等你决定。批准后会模拟执行并回填结果。
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--cds-border)] bg-[var(--cds-surface-1)] px-2.5 text-[11px] text-[var(--cds-text-secondary)] transition-colors hover:border-[var(--cds-border-strong)] hover:text-[var(--cds-text-primary)]"
          >
            <Icon name="shield" size={12} className="text-[var(--cds-clay)]" />
            审批策略：{POLICY_LABEL[settings.approval]}
            <Icon name="chevron-right" size={11} className="text-[var(--cds-text-muted)]" />
          </button>
        </header>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Metric label="等待处理" value={pending.length} tone="clay" />
          <Metric label="已批准" value={approved} tone="green" />
          <Metric label="已拒绝" value={denied} tone="red" />
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--cds-border)] bg-[var(--cds-alpha-1)] px-3 py-2.5 text-[11px] leading-5 text-[var(--cds-text-secondary)]">
          <Icon name="alert" size={13} className="mt-0.5 shrink-0 text-[var(--cds-clay)]" />
          <p>
            这些是本地 mock 请求，不会真的执行命令。批准按钮会走一遍 pending → running → success
            的状态流转；拒绝会以 <code className="font-mono text-[var(--cds-text-primary)]">user_denied</code>{' '}
            结算。
          </p>
        </div>

        <div className="mt-6 space-y-5">
          {APPROVAL_REQUESTS.map((request) => {
            const decision = decisions[request.id]
            const risk = RISK_META[request.risk]
            return (
              <article key={request.id}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${risk.className}`}
                  >
                    {risk.label}
                  </span>
                  <span className="text-[10px] text-[var(--cds-text-muted)]">
                    {fmtRelative(request.requestedAt)} · Pi 发起
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    {decision ? (
                      <>
                        <span className="text-[10px] text-[var(--cds-text-muted)]">
                          决议：{VERDICT_LABEL[decision]}
                        </span>
                        <button
                          type="button"
                          onClick={() => undo(request)}
                          className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-[var(--cds-text-secondary)] transition-colors hover:bg-[var(--cds-alpha-2)] hover:text-[var(--cds-text-primary)]"
                        >
                          <Icon name="rotate-ccw" size={10} />
                          撤销
                        </button>
                      </>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[10px] text-[var(--cds-clay)]">
                        <span className="relative flex size-1.5">
                          <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--cds-clay)] opacity-60" />
                          <span className="relative inline-flex size-1.5 rounded-full bg-[var(--cds-clay)]" />
                        </span>
                        等你决定
                      </span>
                    )}
                  </span>
                </div>

                <p className="mb-2 text-xs leading-5 text-[var(--cds-text-secondary)]">
                  {request.reason}
                </p>

                <McpToolDecisionCard
                  key={`${request.id}:${nonce[request.id] ?? 0}`}
                  toolCall={request.toolCall}
                  initialStatus={decision ? (decision === 'deny' ? 'error' : 'success') : 'pending_approval'}
                  initialSettleReason={decision ? (decision === 'deny' ? 'user_denied' : 'completed') : null}
                  onVerdict={(verdict) => decide(request, verdict)}
                />
              </article>
            )
          })}
        </div>

        <footer className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] leading-4 text-[var(--cds-text-muted)]">
          <span>批准后约 1.2s 完成</span>
          <span>拒绝会终止执行</span>
          <span>撤销可从底部提示或卡片右上角操作</span>
        </footer>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  tone
}: {
  label: string
  value: number
  tone: 'clay' | 'green' | 'red'
}) {
  const toneClass =
    tone === 'clay'
      ? 'text-[var(--cds-clay)]'
      : tone === 'green'
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-500'
  return (
    <div className="rounded-lg border border-[var(--cds-border)] bg-[var(--cds-surface-1)] px-3 py-2.5">
      <div className={`text-lg font-semibold leading-6 tabular-nums ${toneClass}`}>{value}</div>
      <div className="mt-0.5 text-[10px] text-[var(--cds-text-muted)]">{label}</div>
    </div>
  )
}
