/**
 * 高保真页：五面完整界面。
 *
 * 这一页的目的不是「画得好看」，而是把前面两批的令牌与组件放到真实密度下检验：
 * 左栏 262、正文 820、输入卡 672 这些数字如果在这里不成立，说明规范写错了。
 * 所有尺寸、颜色、间距都来自令牌；本文件不出现一个硬编码色值。
 */
import { memo, useEffect, useState, type ReactNode } from 'react'
import { Button, IconButton } from '../components/Button'
import { Checkbox, Input, Select, Switch } from '../components/controls'
import {
  Avatar,
  Badge,
  Divider,
  EmptyState,
  NavGroup,
  NavItem,
  SegmentedControl,
  Skeleton,
  Tag,
} from '../components/display'
import { Dialog, Kbd, Menu, ToastLayer, Tooltip, type ToastItem } from '../components/overlays'
import { DsIcon, type DsIconName } from '../icons/DsIcon'
import { PiPortal } from '../theme/PiRoot'
import {
  AssistantMsg,
  ChangesRow,
  GroupBlock,
  RunningIndicator,
  TurnHead,
  UserMsg,
} from './ConversationBlocks'
import { CONVERSATION, RECENT, SESSIONS, STARTERS, type MockTurn } from './conversation'
import css from './surfaces.module.css'

/** 五个面。 */
export type SurfaceId = 'chat' | 'start' | 'settings' | 'overlays' | 'states'

const FACES: readonly { id: SurfaceId; label: string; note: string }[] = [
  { id: 'chat', label: '主对话壳', note: '262 左栏 / 820 正文 / 672 输入卡' },
  { id: 'start', label: '起始页', note: '空会话的第一屏' },
  { id: 'settings', label: '设置页', note: 'macOS 系统设置式两栏' },
  { id: 'overlays', label: '浮层', note: '命令面板 / 弹窗 / Toast / Tooltip' },
  { id: 'states', label: '空态与异常', note: '六种「没有内容」的界面' },
]

/**
 * 高保真页：顶部子导航切换五个面。
 * @returns 五个完整界面之一。
 */
export const SurfacesPage = memo(function SurfacesPage() {
  const [face, setFace] = useState<SurfaceId>('chat')
  const meta = FACES.find(item => item.id === face) ?? FACES[0]
  return (
    <div className={css.page}>
      <div className={css.subnav}>
        {FACES.map(item => (
          <button
            key={item.id}
            type="button"
            className={css.subnavItem}
            data-active={item.id === face || undefined}
            onClick={() => setFace(item.id)}
          >
            {item.label}
          </button>
        ))}
        <span className={css.subnavNote}>{meta.note}</span>
      </div>
      <div className={css.stage}>
        {face === 'chat' && <ChatSurface />}
        {face === 'start' && <StartSurface />}
        {face === 'settings' && <SettingsSurface />}
        {face === 'overlays' && <OverlaySurface />}
        {face === 'states' && <StateSurface />}
      </div>
    </div>
  )
})

/* =========================== 共用：左栏 =========================== */

/** 左栏：产品标识 + 新建/搜索 + 会话列表 + 底部账户。 */
function Sidebar({
  compact = false,
  onCollapse,
}: {
  compact?: boolean
  onCollapse?: (() => void) | undefined
}) {
  return (
    <aside className={css.sidebar} aria-label="会话">
      <div className={css.sideHead}>
        <span className={css.sideMark} aria-hidden="true">
          <DsIcon name="pi" size={13} />
        </span>
        <span className={css.sideTitle}>pi</span>
        <span className={css.sideActions}>
          <Tooltip content="搜索会话 ⌘K">
            <IconButton icon="search" label="搜索会话" size="sm" />
          </Tooltip>
          <Tooltip content="新建会话 ⌘N">
            <IconButton icon="plus" label="新建会话" size="sm" />
          </Tooltip>
          {onCollapse !== undefined && (
            <Tooltip content="收起侧栏 ⌘B">
              <IconButton icon="sidebar" label="收起侧栏" size="sm" onClick={onCollapse} />
            </Tooltip>
          )}
        </span>
      </div>
      <div className={css.sideScroll}>
        <NavGroup>
          <NavItem label="新会话" icon="plus" />
          <NavItem label="命令面板" icon="command" meta={<Kbd>⌘K</Kbd>} />
        </NavGroup>
        {!compact &&
          SESSIONS.map(group => (
            <div key={group.label}>
              <div className={css.sideSection}>
                {group.label}
                <span className={css.sideSectionAction}>
                  <DsIcon name="more" size={12} />
                </span>
              </div>
              {group.items.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={css.chatItem}
                  data-active={item.active || undefined}
                  aria-current={item.active ? 'true' : undefined}
                >
                  <span className={css.chatItemTitle}>{item.title}</span>
                  <span className={css.chatItemMeta}>{item.meta}</span>
                </button>
              ))}
            </div>
          ))}
      </div>
      <div className={css.sideFoot}>
        <Avatar name="林陌" size="sm" />
        <span className={css.sideFootName}>林陌</span>
        <span className={css.sideFootPlan}>
          <Badge tone="accent" size="sm">
            Pro
          </Badge>
        </span>
      </div>
    </aside>
  )
}

/* =========================== 一面：主对话壳 =========================== */

/** 一个回合：用户消息 → 回合头 → 过程组与文本 → 改动汇总。 */
function TurnBlock({ turn }: { turn: MockTurn }) {
  const [open, setOpen] = useState(true)
  const live = turn.status === 'live'
  const foldable = turn.entries.some(entry => entry.kind === 'group')
  return (
    <div className={css.turn}>
      {turn.user !== undefined && <UserMsg text={turn.user} />}
      <TurnHead
        status={turn.status}
        duration={turn.duration}
        failed={turn.failed}
        open={open}
        foldable={foldable}
        onToggle={() => setOpen(value => !value)}
      />
      <div className={css.turnFlow}>
        {turn.entries.map(entry => {
          if (entry.kind === 'assistant') return <AssistantMsg item={entry} key={entry.id} />
          if (!live && !open) return null
          return <GroupBlock group={entry} key={entry.id} />
        })}
      </div>
      {turn.changes !== undefined && <ChangesRow changes={turn.changes} />}
      {live && <RunningIndicator label="Deep diving · 正在检索 data-density" />}
    </div>
  )
}

/** 输入卡：自增高文本域 + 底部动作条。 */
function Composer() {
  return (
    <div className={css.composerWrap}>
      <div className={css.composer}>
        <textarea
          className={css.composerInput}
          placeholder="给 pi 发消息，或粘贴一段代码…"
          rows={2}
          aria-label="消息输入"
        />
        <div className={css.composerBar}>
          <Tooltip content="附加文件">
            <IconButton icon="paperclip" label="附加文件" size="sm" />
          </Tooltip>
          <Tooltip content="插入命令">
            <IconButton icon="command" label="插入命令" size="sm" />
          </Tooltip>
          <span className={css.composerHint}>
            <Kbd>⏎</Kbd> 发送 · <Kbd>⇧⏎</Kbd> 换行
          </span>
          <Button variant="primary" size="sm" icon="send">
            发送
          </Button>
        </div>
      </div>
    </div>
  )
}

/** 一面：主对话壳。 */
function ChatSurface() {
  // 侧栏收起后，展开按钮浮到正文左上角——否则用户找不到回来的路
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className={css.frame}>
      <div className={css.window}>
        <div className={css.chat}>
          {!collapsed && <Sidebar onCollapse={() => setCollapsed(true)} />}
          <section className={css.main}>
            <div className={css.mainBar}>
              {collapsed && (
                <IconButton icon="sidebar" label="展开侧栏" size="sm" onClick={() => setCollapsed(false)} />
              )}
              <span className={css.mainBarTitle}>收紧 store 的事件接入</span>
              <Badge tone="neutral" size="sm">
                pi-coding-agent
              </Badge>
              <span className={css.mainBarSpacer} />
              <span className={css.mainBarMeta}>2 个回合 · 48 秒 · 3.2k tokens</span>
              <Menu
                label="会话操作"
                align="end"
                items={[
                  { id: 'rename', label: '重命名会话', icon: 'sliders' },
                  { id: 'export', label: '导出为 Markdown', icon: 'copy' },
                  { id: 'sep', separator: true },
                  { id: 'delete', label: '删除会话', icon: 'trash', tone: 'danger' },
                ]}
                trigger={props => <IconButton {...props} icon="more" label="会话操作" size="sm" />}
              />
            </div>
            <div className={css.scroll}>
              <div className={css.prose}>
                {CONVERSATION.map(turn => (
                  <TurnBlock turn={turn} key={turn.id} />
                ))}
              </div>
            </div>
            <Composer />
          </section>
        </div>
      </div>
    </div>
  )
}

/* =========================== 二面：起始页 =========================== */

/** 二面：起始页（同一外壳，正文换成第一屏）。 */
function StartSurface() {
  return (
    <div className={css.frame}>
      <div className={css.window}>
        <div className={css.chat}>
          <Sidebar />
          <section className={css.main}>
            <div className={css.mainBar}>
              <span className={css.mainBarTitle}>新会话</span>
              <span className={css.mainBarSpacer} />
              <span className={css.mainBarMeta}>工作目录 D:\workspace\PiGui</span>
            </div>
            <div className={css.startMain}>
              <div className={css.startInner}>
                <div className={css.startHero}>
                  <span className={css.startMark} aria-hidden="true">
                    <DsIcon name="pi" size={22} />
                  </span>
                  <h1 className={css.startTitle}>今天想做什么？</h1>
                  <p className={css.startLead}>
                    我可以读代码、跑命令、改文件。给它一个目标，它会自己拆步骤，并把过程摊开给你看。
                  </p>
                </div>
                <div className={css.startGrid}>
                  {STARTERS.map(item => (
                    <button type="button" className={css.startCard} key={item.id}>
                      <span className={css.startCardIcon}>
                        <DsIcon name={item.icon} size={14} />
                      </span>
                      <span className={css.startCardTitle}>{item.title}</span>
                      <span className={css.startCardText}>{item.text}</span>
                    </button>
                  ))}
                </div>
                <div className={css.recent}>
                  <div className={css.recentLabel}>最近</div>
                  {RECENT.map(item => (
                    <button type="button" className={css.recentItem} key={item.id}>
                      <DsIcon name="history" size={13} />
                      {item.title}
                      <span className={css.recentMeta}>{item.meta}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Composer />
          </section>
        </div>
      </div>
    </div>
  )
}

/* =========================== 三面：设置页 =========================== */

/** 设置分组里的行。 */
function SettingRow({
  label,
  desc,
  control,
}: {
  label: string
  desc?: string | undefined
  control: ReactNode
}) {
  return (
    <div className={css.settingRow}>
      <div className={css.settingMain}>
        <span className={css.settingLabel}>{label}</span>
        {desc !== undefined && <span className={css.settingDesc}>{desc}</span>}
      </div>
      <div className={css.settingControl}>{control}</div>
    </div>
  )
}

type SettingsSection = 'general' | 'appearance' | 'model' | 'keys' | 'about'

const SETTINGS_NAV: readonly { id: SettingsSection; label: string; icon: DsIconName }[] = [
  { id: 'general', label: '通用', icon: 'sliders' },
  { id: 'appearance', label: '外观', icon: 'sun' },
  { id: 'model', label: '模型', icon: 'layers' },
  { id: 'keys', label: '快捷键', icon: 'command' },
  { id: 'about', label: '关于', icon: 'pi' },
]

/** 三面：设置页。 */
function SettingsSurface() {
  const [section, setSection] = useState<SettingsSection>('appearance')
  const [theme, setTheme] = useState('system')
  const [density, setDensity] = useState('comfortable')
  const [stream, setStream] = useState(true)
  const [sandbox, setSandbox] = useState(true)

  return (
    <div className={css.frame}>
      <div className={css.window}>
        <div className={css.settings}>
          <nav className={css.settingsNav} aria-label="设置分类">
            {SETTINGS_NAV.map(item => (
              <NavItem
                key={item.id}
                label={item.label}
                icon={item.icon}
                active={section === item.id}
                onSelect={() => setSection(item.id)}
              />
            ))}
          </nav>
          <div className={css.settingsPane}>
            <div className={css.settingsInner}>
              <div className={css.settingsHead}>
                <h1 className={css.settingsTitle}>
                  {SETTINGS_NAV.find(item => item.id === section)?.label ?? '设置'}
                </h1>
                <p className={css.settingsLead}>
                  这些偏好存在本地，按项目不共享。改完立即生效，不需要重启。
                </p>
              </div>

              <div className={css.groupBox}>
                <div className={css.groupLabel}>外观</div>
                <SettingRow
                  label="主题"
                  desc="跟随系统时，窗口会随系统切换深浅色"
                  control={
                    <SegmentedControl
                      label="主题"
                      value={theme}
                      onChange={setTheme}
                      options={[
                        { value: 'system', label: '跟随系统', icon: 'auto' },
                        { value: 'light', label: '浅色', icon: 'sun' },
                        { value: 'dark', label: '深色', icon: 'moon' },
                      ]}
                    />
                  }
                />
                <SettingRow
                  label="密度"
                  desc="紧凑档把行高与内距同时收窄，长会话一屏多看 3 行"
                  control={
                    <SegmentedControl
                      label="密度"
                      value={density}
                      onChange={setDensity}
                      options={[
                        { value: 'comfortable', label: '舒适' },
                        { value: 'compact', label: '紧凑' },
                      ]}
                    />
                  }
                />
                <SettingRow
                  label="流式输出"
                  desc="关闭后，回答会在完成时整段出现"
                  control={<Switch label="流式输出" checked={stream} onChange={setStream} />}
                />
              </div>

              <div className={css.groupBox}>
                <div className={css.groupLabel}>执行</div>
                <SettingRow
                  label="命令沙箱"
                  desc="危险命令先征询，其余在只读沙箱里跑"
                  control={<Switch label="命令沙箱" checked={sandbox} onChange={setSandbox} />}
                />
                <SettingRow
                  label="工作目录"
                  control={
                    <div className={css.settingControl} style={{ width: 240 }}>
                      <Input value="D:\workspace\PiGui" readOnly aria-label="工作目录" />
                      <Button size="sm">选择…</Button>
                    </div>
                  }
                />
                <SettingRow
                  label="自动批准"
                  desc="仅对当前会话有效，新建会话后重置"
                  control={<Checkbox label="编辑当前目录内的文件" />}
                />
              </div>

              <div className={css.groupBox}>
                <div className={css.groupLabel}>模型</div>
                <SettingRow
                  label="默认模型"
                  control={
                    <div style={{ width: 200 }}>
                      <Select
                        aria-label="默认模型"
                        defaultValue="sonnet"
                        options={[
                          { value: 'sonnet', label: 'Claude Sonnet 4.5' },
                          { value: 'haiku', label: 'Claude Haiku 4' },
                          { value: 'deepseek', label: 'DeepSeek V4' },
                        ]}
                      />
                    </div>
                  }
                />
                <SettingRow
                  label="思考预算"
                  desc="每个回合分配给思考的上限"
                  control={
                    <div className={css.settingControl}>
                      <Input
                        size="sm"
                        defaultValue="4096"
                        aria-label="思考预算（tokens）"
                        style={{ width: 96 }}
                      />
                      <span className={css.settingUnit}>tokens</span>
                    </div>
                  }
                />
              </div>

              <Divider label="危险区域" />

              <div className={css.groupBox}>
                <SettingRow
                  label="清空全部会话记录"
                  desc="本地 transcript 与索引一并删除，不可恢复"
                  control={
                    <Button variant="danger" size="sm">
                      清空…
                    </Button>
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* =========================== 四面：浮层 =========================== */

const PALETTE_ITEMS: readonly { id: string; label: string; hint: string; icon: DsIconName }[] = [
  { id: 'p1', label: '新建会话', hint: '⌘N', icon: 'plus' },
  { id: 'p2', label: '切换主题', hint: '⌘⇧L', icon: 'sun' },
  { id: 'p3', label: '打开设置', hint: '⌘,', icon: 'sliders' },
  { id: 'p4', label: '跳到最近会话', hint: '⌘P', icon: 'history' },
]

/** 命令面板：⌘K 的样子，用真实遮罩层展示。 */
function CommandPalette({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <PiPortal>
      <div
        className={css.paletteScrim}
        onMouseDown={event => {
          if (event.target === event.currentTarget) onClose()
        }}
      >
        <div className={css.palette} role="dialog" aria-modal="true" aria-label="命令面板">
          <div className={css.paletteHead}>
            <DsIcon name="search" size={14} />
            <input className={css.paletteInput} placeholder="搜索命令、会话或文件…" autoFocus aria-label="搜索" />
            <Kbd>esc</Kbd>
          </div>
          <div className={css.paletteList}>
            {PALETTE_ITEMS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={css.paletteItem}
                data-active={index === 0 || undefined}
              >
                <DsIcon name={item.icon} size={13} />
                {item.label}
                <span className={css.paletteItemKey}>{item.hint}</span>
              </button>
            ))}
          </div>
          <div className={css.paletteFoot}>
            <span className={css.paletteFootItem}>
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> 选择
            </span>
            <span className={css.paletteFootItem}>
              <Kbd>⏎</Kbd> 执行
            </span>
            <span className={css.paletteFootItem}>
              <Tag>2 个会话</Tag>
            </span>
          </div>
        </div>
      </div>
    </PiPortal>
  )
}

/** 四面：浮层演示。 */
function OverlaySurface() {
  const [palette, setPalette] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [toasts, setToasts] = useState<readonly ToastItem[]>([])

  const pushToast = (tone: 'success' | 'danger' | 'info'): void => {
    setToasts(list => [
      ...list,
      {
        id: `t-${Date.now()}`,
        message:
          tone === 'success' ? '已保存到会话历史' : tone === 'danger' ? '命令被沙箱拒绝：需要写权限' : '正在连接到 agent-host',
        tone,
      },
    ])
  }

  return (
    <div className={css.overlayStage}>
      <p className={css.overlayCaption}>
        浮层全部走传送门，但它们挂在 PiRoot 内部的宿主上——否则会落到令牌作用域之外，
        背景与描边会一起失效。
      </p>

      <div className={css.overlayRow}>
        <Button icon="command" onClick={() => setPalette(true)}>
          命令面板
        </Button>
        <Button variant="secondary" onClick={() => setConfirm(true)}>
          确认弹窗
        </Button>
        <Button variant="secondary" onClick={() => pushToast('success')}>
          Toast · 成功
        </Button>
        <Button variant="secondary" onClick={() => pushToast('danger')}>
          Toast · 失败
        </Button>
        <Tooltip content="只补充说明，不承载唯一信息">
          <Button variant="ghost" icon="alert">
            Tooltip
          </Button>
        </Tooltip>
        <Menu
          label="更多动作"
          items={[
            { id: 'a1', label: '复制为 Markdown', icon: 'copy', shortcut: '⌘C' },
            { id: 'a2', label: '在新窗口打开', icon: 'panelRight' },
            { id: 's', separator: true, label: '会话' },
            { id: 'a3', label: '删除会话', icon: 'trash', tone: 'danger', shortcut: '⌫' },
          ]}
          trigger={props => (
            <Button {...props} variant="secondary" trailingIcon="chevronDown">
              菜单
            </Button>
          )}
        />
      </div>

      <div className={css.overlayRow}>
        <span className={css.overlayCaption}>
          快捷键 <Kbd>⌘K</Kbd> 打开命令面板 · <Kbd>esc</Kbd> 关闭 · <Kbd>⌘⏎</Kbd> 确认
        </span>
      </div>

      {palette && <CommandPalette onClose={() => setPalette(false)} />}

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="删除这个会话？"
        description="会话的完整 transcript 会一起删除，此操作不可撤销。"
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              取消
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirm(false)
                pushToast('success')
              }}
            >
              删除会话
            </Button>
          </>
        }
      >
        <div className={css.dangerNote}>
          <DsIcon name="alert" size={14} />
          <span>
            这个会话里有 2 个回合、3 处文件改动。删除后无法从界面恢复，但改动本身仍留在工作目录里。
          </span>
        </div>
      </Dialog>

      <ToastLayer toasts={toasts} onDismiss={id => setToasts(list => list.filter(item => item.id !== id))} />
    </div>
  )
}

/* =========================== 五面：空态与异常 =========================== */

/** 五面：六种「没有内容」。 */
function StateSurface() {
  return (
    <div className={css.stateGrid}>
      <StateCard label="还没有会话">
        <EmptyState
          icon="chat"
          title="还没有任何会话"
          description="新建一个会话，或者从右侧的推荐开始。所有执行都在本地进行。"
          actions={
            <>
              <Button variant="primary" size="sm" icon="plus">
                新建会话
              </Button>
              <Button size="sm">看示例</Button>
            </>
          }
        />
      </StateCard>

      <StateCard label="搜索无结果">
        <div className={css.stateCardBody}>
          <span className={css.stateIcon}>
            <DsIcon name="search" size={15} />
          </span>
          <h3 className={css.stateTitle}>没有匹配的会话</h3>
          <p className={css.stateText}>「data-density」在标题与正文里都没有出现。换个词，或只搜标题。</p>
          <div className={css.stateActions}>
            <Button size="sm">只搜标题</Button>
          </div>
        </div>
      </StateCard>

      <StateCard label="加载中（骨架）">
        <div className={css.stateCardBody} style={{ alignItems: 'stretch' }}>
          <div className={css.skeletonStack} aria-busy="true" aria-label="正在加载会话">
            <Skeleton width="72%" height={10} />
            <Skeleton width="100%" height={10} />
            <Skeleton width="88%" height={10} />
            <Skeleton width="94%" height={10} />
            <Skeleton width="46%" height={10} />
          </div>
        </div>
      </StateCard>

      <StateCard label="连接中断">
        <div className={css.stateCardBody}>
          <span className={css.stateIcon} data-tone="danger">
            <DsIcon name="ban" size={15} />
          </span>
          <h3 className={css.stateTitle}>与 agent-host 的连接断开了</h3>
          <p className={css.stateText}>
            会话进程已退出（退出码 1）。已生成的内容保留在本地，重连后可以继续。
          </p>
          <div className={css.stateActions}>
            <Button size="sm" icon="auto">
              重连
            </Button>
            <Button size="sm" variant="ghost">
              查看日志
            </Button>
          </div>
        </div>
      </StateCard>

      <StateCard label="权限被拒">
        <div className={css.stateCardBody}>
          <span className={css.stateIcon} data-tone="warn">
            <DsIcon name="alert" size={15} />
          </span>
          <h3 className={css.stateTitle}>这条命令需要写权限</h3>
          <p className={css.stateText}>
            <code className={css.inlineCodeSm}>rm -rf node_modules</code> 会删除项目依赖，沙箱默认拒绝。
          </p>
          <div className={css.stateActions}>
            <Button size="sm" variant="danger">
              允许一次
            </Button>
            <Button size="sm" variant="ghost">
              取消
            </Button>
          </div>
        </div>
      </StateCard>

      <StateCard label="首次使用">
        <div className={css.stateCardBody}>
          <span className={css.stateIcon}>
            <DsIcon name="pi" size={15} />
          </span>
          <h3 className={css.stateTitle}>先选一个工作目录</h3>
          <p className={css.stateText}>
            pi 只会读写你指定的目录。选好后可以随时在设置里更换，不需要重开会话。
          </p>
          <div className={css.stateActions}>
            <Button size="sm" variant="primary">
              选择目录…
            </Button>
          </div>
        </div>
      </StateCard>
    </div>
  )
}

/** 状态卡：标题条 + 居中内容。 */
function StateCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className={css.stateCard}>
      <div className={css.stateCardHead}>
        <span>{label}</span>
      </div>
      {children}
    </section>
  )
}
