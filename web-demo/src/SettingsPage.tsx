import { useMemo, useState, type ReactNode } from 'react'
import { fmtBytes, fmtDateTime } from './format'
import {
  useSettings,
  type ApprovalPolicy,
  type Density,
  type Theme,
  type ThinkingLevel
} from './settings'
import type { SessionCatalog, SessionMock } from './types'
import { useToast } from './toast'
import { FieldRow, Segmented, Switch } from './ui/Controls'
import { ConfirmDialog } from './ui/Dialog'
import { Icon } from './ui/Icon'

type PendingConfirm = 'settings' | 'data' | null

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: 'sun' | 'moon' | 'monitor' }> = [
  { value: 'light', label: '浅色', icon: 'sun' },
  { value: 'dark', label: '深色', icon: 'moon' },
  { value: 'system', label: '跟随系统', icon: 'monitor' }
]

const DENSITY_OPTIONS: Array<{ value: Density; label: string }> = [
  { value: 'comfortable', label: '舒适' },
  { value: 'compact', label: '紧凑' }
]

const THINKING_OPTIONS: Array<{ value: ThinkingLevel; label: string }> = [
  { value: 'off', label: '关闭' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' }
]

const APPROVAL_OPTIONS: Array<{ value: ApprovalPolicy; label: string }> = [
  { value: 'ask', label: '每次询问' },
  { value: 'readonly', label: '只读放行' },
  { value: 'deny', label: '全部拒绝' }
]

const POLICY_HINT: Record<ApprovalPolicy, string> = {
  ask: '所有工具调用都先暂停，等你批准或拒绝。',
  readonly: '读取文件、搜索这类只读操作直接放行，写操作仍然询问。',
  deny: '所有工具调用一律拒绝，适合只想让代理回答问题的时候。'
}

export function SettingsPage({
  sessions,
  catalog,
  onResetData
}: {
  sessions: SessionMock[]
  catalog: SessionCatalog
  onResetData: () => void
}) {
  const { settings, update, reset, savedAt } = useSettings()
  const { push } = useToast()
  const [confirm, setConfirm] = useState<PendingConfirm>(null)

  const models = useMemo(() => {
    const set = new Set<string>([settings.model, ...sessions.map((s) => s.model)])
    return Array.from(set).sort()
  }, [sessions, settings.model])

  const messageCount = sessions.reduce((sum, s) => sum + s.messageCount, 0)
  const totalBytes = sessions.reduce((sum, s) => sum + s.bytes, 0)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[760px] px-5 pb-20 pt-8 md:px-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-[var(--cds-text-primary)]">
              设置
            </h1>
            <p className="mt-1.5 text-xs leading-5 text-[var(--cds-text-secondary)]">
              偏好保存在浏览器 localStorage 里，刷新后仍然生效。
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] text-[var(--cds-text-muted)]">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            已保存 · {fmtDateTime(savedAt)}
          </span>
        </header>

        <div className="mt-6 space-y-4">
          <Section
            icon="sun"
            title="外观"
            description="控制主题、信息密度与动效。主题默认跟随系统。"
          >
            <FieldRow title="主题" hint="浅色、深色或跟随系统；顶栏右侧可以快速切换。">
              <Segmented
                label="主题"
                value={settings.theme}
                options={THEME_OPTIONS}
                onChange={(value) => update('theme', value)}
              />
            </FieldRow>
            <FieldRow title="信息密度" hint="紧凑模式会压缩列表行高与段落间距。">
              <Segmented
                label="信息密度"
                value={settings.density}
                options={DENSITY_OPTIONS}
                onChange={(value) => update('density', value)}
              />
            </FieldRow>
            <FieldRow
              title="减少动效"
              hint="关闭思考展开、状态点与页面过渡动画；系统开启减少动态效果时也会自动生效。"
            >
              <Switch
                label="减少动效"
                checked={settings.reduceMotion}
                onChange={(checked) => update('reduceMotion', checked)}
              />
            </FieldRow>
          </Section>

          <Section
            icon="sparkles"
            title="对话"
            description="新会话默认使用的模型、思考等级与工具审批策略。"
          >
            <FieldRow
              title="默认模型"
              hint="来自本机 pi 历史里出现过的模型，选择只影响新会话的显示。"
            >
              <div className="relative">
                <select
                  value={settings.model}
                  onChange={(e) => update('model', e.target.value)}
                  aria-label="默认模型"
                  className="h-8 w-full cursor-pointer appearance-none rounded-lg border border-[var(--cds-border)] bg-[var(--cds-surface-1)] pl-2.5 pr-8 font-mono text-[11px] text-[var(--cds-text-primary)] outline-none transition-colors hover:border-[var(--cds-border-strong)] focus:border-[var(--cds-border-strong)] sm:w-[240px]"
                >
                  {models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                <Icon
                  name="chevron-down"
                  size={12}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--cds-text-muted)]"
                />
              </div>
            </FieldRow>
            <FieldRow title="思考等级" hint="演示里用来决定思考块的展示时长与默认展开程度。">
              <Segmented
                label="思考等级"
                value={settings.thinking}
                options={THINKING_OPTIONS}
                onChange={(value) => update('thinking', value)}
              />
            </FieldRow>
            <FieldRow title="工具审批策略" hint={POLICY_HINT[settings.approval]}>
              <Segmented
                label="工具审批策略"
                value={settings.approval}
                options={APPROVAL_OPTIONS}
                onChange={(value) => update('approval', value)}
              />
            </FieldRow>
          </Section>

          <Section
            icon="panel-left"
            title="应用"
            description="侧栏默认状态；随时可以用 ⌘B / Ctrl+B 切换。"
          >
            <FieldRow title="收起侧栏" hint="开启后进入页面只显示内容区，顶栏左侧可重新展开。">
              <Switch
                label="收起侧栏"
                checked={settings.sidebarCollapsed}
                onChange={(checked) => update('sidebarCollapsed', checked)}
              />
            </FieldRow>
          </Section>

          <Section
            icon="database"
            title="数据"
            description="演示数据来自本机 pi 历史会话，只读展示，工具输出已截断。"
          >
            <div className="grid grid-cols-3 gap-2 py-4">
              <Stat label="会话" value={String(sessions.length)} />
              <Stat label="消息" value={String(messageCount)} />
              <Stat label="原始体积" value={fmtBytes(totalBytes)} />
            </div>
            <div className="space-y-2 border-t border-[var(--cds-border)] py-4 text-[11px]">
              <InfoRow label="来源" value={catalog.source} />
              <InfoRow label="生成时间" value={fmtDateTime(catalog.generatedAt)} />
              <InfoRow label="设置存储" value="pigui-demo.settings.v1" mono />
              <InfoRow label="会话存储" value="pigui-demo.sessions.v1" mono />
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--cds-border)] py-4">
              <button
                type="button"
                onClick={() => setConfirm('settings')}
                className="cursor-pointer rounded-lg border border-[var(--cds-border)] bg-[var(--cds-surface-1)] px-3 py-1.5 text-xs font-medium text-[var(--cds-text-primary)] transition-colors hover:bg-[var(--cds-alpha-1)]"
              >
                恢复默认设置
              </button>
              <button
                type="button"
                onClick={() => setConfirm('data')}
                className="cursor-pointer rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
              >
                清除演示数据
              </button>
              <span className="text-[10px] text-[var(--cds-text-muted)]">
                会清空排序、草稿、审批决议与设置
              </span>
            </div>
          </Section>
        </div>

        <footer className="mt-5 space-y-1 text-[10px] leading-4 text-[var(--cds-text-muted)]">
          <p>界面沿用 open-claude-ui 的 Claude 设计语言（MIT），组件在本地复刻，不依赖 framer-motion。</p>
          <p>PiGui web demo · mock 数据仅用于展示对话块交互。</p>
        </footer>
      </div>

      <ConfirmDialog
        open={confirm === 'settings'}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          reset()
          setConfirm(null)
          push({ title: '已恢复默认设置', description: '主题、模型与审批策略回到初始值。' })
        }}
        title="恢复默认设置？"
        description="主题、密度、模型、思考等级与审批策略都会回到初始值。会话排序不受影响。"
        confirmLabel="恢复默认"
        danger={false}
      />

      <ConfirmDialog
        open={confirm === 'data'}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          onResetData()
          setConfirm(null)
          push({ title: '演示数据已清除', description: '设置、会话排序、草稿和审批记录都已重置。' })
        }}
        title="清除所有演示数据？"
        description="会重置设置、会话排序与固定状态、草稿会话和审批决议。mock 会话本身会重新加载。"
        confirmLabel="清除数据"
        danger
      />
    </div>
  )
}

function Section({
  icon,
  title,
  description,
  children
}: {
  icon: 'sun' | 'sparkles' | 'panel-left' | 'database'
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--cds-border)] bg-[var(--cds-surface-1)]">
      <div className="border-b border-[var(--cds-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <Icon name={icon} size={14} className="text-[var(--cds-clay)]" />
          <h2 className="text-[13px] font-semibold text-[var(--cds-text-primary)]">{title}</h2>
        </div>
        <p className="mt-1 text-[11px] leading-5 text-[var(--cds-text-secondary)]">{description}</p>
      </div>
      <div className="px-5">{children}</div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--cds-border)] bg-[var(--cds-surface-0)] px-3 py-2">
      <div className="text-sm font-semibold tabular-nums text-[var(--cds-text-primary)]">{value}</div>
      <div className="mt-0.5 text-[10px] text-[var(--cds-text-muted)]">{label}</div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <span className="shrink-0 text-[var(--cds-text-muted)]">{label}</span>
      <span
        className={`min-w-0 truncate text-right text-[var(--cds-text-secondary)] ${
          mono ? 'font-mono text-[10px]' : ''
        }`}
      >
        {value}
      </span>
    </div>
  )
}
