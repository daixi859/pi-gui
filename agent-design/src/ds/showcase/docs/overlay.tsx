import type { CSSProperties } from 'react'
import { Button, IconButton } from '../../components/Button'
import { Input } from '../../components/controls'
import { DialogSurface, Kbd, Menu, Popover, Tooltip, TooltipBubble, type MenuEntry } from '../../components/overlays'
import css from '../showcase.module.css'
import type { ComponentDoc } from './types'

/** 内联展示用的菜单条目（文档里不能依赖传送门）。 */
const DEMO_MENU: readonly MenuEntry[] = [
  { id: 'rename', label: '重命名', icon: 'copy', shortcut: 'F2' },
  { id: 'duplicate', label: '创建副本', icon: 'layers', shortcut: '⌘D' },
  { id: 'sep-1', separator: true },
  { id: 'pin', label: '置顶', icon: 'panelRight', checked: true },
  { id: 'sep-2', separator: true },
  { id: 'delete', label: '删除会话', icon: 'trash', tone: 'danger', shortcut: '⌫' },
]

/** 浮层组：菜单、浮层、提示、对话框、轻提示、键帽。 */
export const OVERLAY_DOCS: readonly ComponentDoc[] = [
  {
    id: 'Menu',
    name: 'Menu',
    group: 'overlay',
    icon: 'more',
    summary: '锚定在触发器上的操作列表。浮层家族里唯一自带完整键盘模型（roving tabindex + 方向键）的组件。',
    use: ['行尾「更多」、右键菜单、下拉操作集合。', '选项少于 12 个、不需要搜索的场景。'],
    avoid: ['纯信息展示（说明、状态）：用 Popover 或 Tooltip，别把只读内容塞进 role=menu。', '选项超过 12 个：用 CommandPalette 让用户搜。'],
    states: [
      { label: '展开', node: <Menu trigger={props => <Button variant="secondary" {...props}>更多操作</Button>} items={DEMO_MENU} label="会话操作" />, note: '点触发器展开' },
      { label: '含危险项', node: <Menu trigger={props => <IconButton icon="more" label="更多" {...props} />} items={DEMO_MENU} label="会话操作" /> },
    ],
    props: [
      { name: 'trigger', type: '(props: TriggerProps) => ReactNode', default: '必填', desc: '渲染函数；收到的 ref/onClick/aria 必须挂到可聚焦元素上。' },
      { name: 'items', type: 'readonly MenuEntry[]', default: '必填', desc: 'MenuItem（label/icon/shortcut/tone/checked/disabled）或分隔线 / 分组标题。' },
      { name: 'label', type: 'string', default: '必填', desc: 'role=menu 的无障碍名。' },
      { name: 'align', type: "'start' | 'end'", default: "'start'", desc: '与触发器的对齐边。' },
    ],
    keyboard: [
      { keys: 'Enter / Space / ↓', action: '展开并聚焦首项' },
      { keys: '↑ / ↓', action: '在可选项间循环移动' },
      { keys: 'Home / End', action: '跳到首项 / 末项' },
      { keys: 'Enter / Space', action: '选择当前项' },
      { keys: 'Tab', action: '收起并移出' },
      { keys: 'Esc', action: '收起，焦点回到触发器' },
    ],
    notes: [
      '触发器用「渲染函数 + TriggerProps」而不是 cloneElement：cloneElement 在 React 19 里对 ref 的传递语义已改，渲染函数更稳。',
      '面板通过 createPortal 挂到 document.body：否则任何祖先的 overflow 或 transform 都会把浮层裁掉。',
    ],
    sample: <Menu trigger={props => <Button variant="secondary" trailingIcon="chevronDown" {...props}>会话操作</Button>} items={DEMO_MENU} label="会话操作" />,
  },
  {
    id: 'Popover',
    name: 'Popover',
    group: 'overlay',
    icon: 'panelRight',
    summary: '通用锚定浮层。内容自由、键盘模型由内容自己定，负责定位与关闭。',
    use: ['下拉里放表单（如「重命名」输入框 + 按钮）。', '轻量的临时面板（筛选、说明、模型参数）。'],
    avoid: ['需要用户必须处理才能继续：用 Dialog（Popover 不拦焦点也不拦操作）。', '标准操作列表：用 Menu，它能免费拿到方向键遍历。'],
    states: [
      { label: '默认', node: <Popover label="重命名" trigger={props => <Button variant="secondary" {...props}>重命名</Button>}><div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 4 }}><Input placeholder="新名称" size="sm" /><Button size="sm" variant="primary">保存</Button></div></Popover> },
      { label: '贴触发器宽度', node: <Popover matchWidth label="筛选" trigger={props => <Button variant="secondary" trailingIcon="chevronDown" {...props}>筛选</Button>}><div style={{ padding: 8 }}>与触发器同宽</div></Popover> },
    ],
    props: [
      { name: 'trigger', type: '(props: TriggerProps) => ReactNode', default: '必填', desc: '触发器渲染函数。' },
      { name: 'children', type: 'ReactNode', default: '必填', desc: '面板内容。' },
      { name: 'open', type: 'boolean', default: '—', desc: '受控开关；不传则自管。' },
      { name: 'matchWidth', type: 'boolean', default: 'false', desc: '面板至少与触发器同宽。' },
      { name: 'flush', type: 'boolean', default: 'false', desc: '去掉内边距（纯列表 / 图表）。' },
      { name: 'align', type: "'start' | 'end'", default: "'start'", desc: '对齐边。' },
      { name: 'label', type: 'string', default: '—', desc: 'role=dialog 的无障碍名。' },
    ],
    keyboard: [
      { keys: 'Enter / Space', action: '触发器展开' },
      { keys: 'Esc', action: '收起' },
      { keys: 'Tab', action: '组件不拦；在面板内容里按内容自身的顺序移动' },
    ],
    notes: [
      '不自动聚焦首元素：很多 Popover 里第一个元素是输入框，自动聚焦是对的；但有些是纯信息，聚焦反而是噪音。把选择权留给内容。',
      '定位有翻面与夹取：空间不够时自动换边，并保证不超出视口—这些都在 `useAnchorPosition` 里，组件只消费结果。',
    ],
    sample: <Popover label="重命名会话" trigger={props => <Button variant="secondary" {...props}>重命名</Button>}><div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><Input placeholder="新名称" size="sm" /><Button size="sm" variant="primary">保存</Button></div></Popover>,
  },
  {
    id: 'Tooltip',
    name: 'Tooltip',
    group: 'overlay',
    icon: 'alert',
    summary: '悬浮或聚焦 400ms 后出现的补充说明。永远不能承载唯一信息。',
    use: ['图标按钮的解释（同时它也已有 aria-label）。', '被截断文本的全文、快捷键提醒。'],
    avoid: ['唯一的说明：触屏与读屏用户可能永远看不到。', '需要用户点击的内容：Tooltip 不可交互、鼠标移入即消失。'],
    states: [
      {
        label: '气泡本体',
        node: <div style={{ display: 'flex', justifyContent: 'center' }}><TooltipBubble content="复制到剪贴板" /></div>,
        note: '内联渲染，无定位',
      },
      { label: '悬挂触发', node: <Tooltip content="复制到剪贴板"><IconButton icon="copy" label="复制" /></Tooltip>, note: '悬停或聚焦 400ms' },
    ],
    props: [
      { name: 'content', type: 'string', default: '必填', desc: '提示文字，只接受纯文本。' },
      { name: 'children', type: 'ReactNode', default: '必填', desc: '触发元素，必须自身可聚焦（或用 Tooltip 包裹一个可聚焦元素）。' },
      { name: 'side', type: "'top' | 'bottom'", default: "'top'", desc: '偏好方位，空间不足自动翻面。' },
      { name: 'delay', type: 'number', default: '400', desc: '显示延迟 ms；0 会在鼠标扫过时不停闪。' },
    ],
    keyboard: [
      { keys: 'Tab', action: '聚焦触发元素后 400ms 显示' },
      { keys: 'Esc', action: '立即隐藏' },
    ],
    notes: [
      '气泡 `pointer-events: none`：否则鼠标一移向气泡就触发 mouseleave，出现「追不上」的闪烁。',
      '延迟 400ms 而不是 0：0 延迟在工具条上会变成一排不停弹出的黑块。',
    ],
    sample: <Tooltip content="复制到剪贴板"><Button variant="ghost" icon="copy">复制</Button></Tooltip>,
  },
  {
    id: 'Dialog',
    name: 'Dialog',
    group: 'overlay',
    icon: 'alert',
    summary: '模态对话框。遮罩期间焦点被锁在内部、页面不滚动，关闭后焦点回到触发元素。',
    use: ['需要用户明确回答才能继续（删除确认、覆盖保存）。', '需要集中注意力的短表单（新建工作区、设置别名）。'],
    avoid: ['只是展示更多信息：用 Popover 或抽屉，别打断用户。', '长流程（多步向导）：用整页或 Drawer，弹窗里的滚动体验很差。'],
    states: [
      {
        label: '确认型',
        node: (
          <div className={css.stateStage} style={{ background: 'var(--pi-sunken)', padding: 12 }}>
            <DialogSurface
              title="删除这个会话？"
              description="会话记录与工具输出会被一并删除，此操作不可撤销。"
              width={360}
              footer={
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <Button variant="secondary" size="sm">取消</Button>
                  <Button variant="danger" size="sm">删除</Button>
                </div>
              }
            />
          </div>
        ),
        note: '面板本体，内联渲染',
      },
      {
        label: '表单型',
        node: (
          <div className={css.stateStage} style={{ background: 'var(--pi-sunken)', padding: 12 }}>
            <DialogSurface
              title="重命名会话"
              width={360}
              footer={
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <Button variant="secondary" size="sm">取消</Button>
                  <Button variant="primary" size="sm">保存</Button>
                </div>
              }
            >
              <Input defaultValue="重构 timeline" autoFocus />
            </DialogSurface>
          </div>
        ),
        note: 'dismissOnScrim=false 防误删输入',
      },
    ],
    props: [
      { name: 'open', type: 'boolean', default: '必填', desc: '是否打开。' },
      { name: 'title', type: 'string', default: '必填', desc: '标题，同时是 aria-labelledby 的目标。' },
      { name: 'description', type: 'string', default: '—', desc: '说明，接到 aria-describedby。' },
      { name: 'children', type: 'ReactNode', default: '—', desc: '正文。' },
      { name: 'footer', type: 'ReactNode', default: '—', desc: '动作区；建议右对齐，主操作在最右。' },
      { name: 'onClose', type: '() => void', default: '必填', desc: 'Esc、遮罩、关闭按钮统一走这里。' },
      { name: 'dismissOnScrim', type: 'boolean', default: 'true', desc: '点遮罩是否关闭；填写类应设 false。' },
      { name: 'width', type: 'number', default: '440', desc: '面板宽度上限，窄屏自动收缩。' },
    ],
    keyboard: [
      { keys: 'Esc', action: '关闭（填写类由使用方决定是否拦）' },
      { keys: 'Tab / Shift+Tab', action: '在面板内循环，不会跑到页面后面' },
      { keys: 'Enter', action: '焦点在主操作上时触发默认动作' },
    ],
    notes: [
      '拆成 `DialogSurface` + `Dialog` 两层：面板本体可以内联渲染（本页的双主题并排、设置页的预览都需要），只有需要模态行为时才套外层。',
      '关闭后焦点回触发器：这不是美观问题——焦点丢到 body 后键盘用户要从头 Tab 一遍。',
      '标题不用 `aria-label` 而是 `aria-labelledby` 指向真实的 h2：读屏会把它当标题播报，也能被「按标题跳转」找到。',
    ],
    sample: (
      <DialogSurface
        title="删除这个会话？"
        description="会话记录与工具输出会被一并删除，此操作不可撤销。"
        width={360}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="secondary" size="sm">取消</Button>
            <Button variant="danger" size="sm">删除</Button>
          </div>
        }
      />
    ),
  },
  {
    id: 'Toast',
    name: 'Toast',
    group: 'overlay',
    icon: 'check',
    summary: '不打断操作的短暂反馈，固定在视口底部居中堆叠，默认 4 秒自动消失。',
    use: ['操作成功后的确认（已复制、已保存）。', '后台任务的轻量结果（已加载 12 个文件）。'],
    avoid: ['需要用户处理或选择：用 Dialog 或行内提示。', '错误需要用户重试：写在相关控件旁边（Field 的 error），而不是浮一个会消失的提示。'],
    states: [
      { label: '信息', node: <div className={css.stateStage}><div role="status" style={toastStyle('info')}>已连接到本地工作区</div></div> },
      { label: '成功', node: <div className={css.stateStage}><div role="status" style={toastStyle('success')}>已复制到剪贴板</div></div> },
      { label: '警告', node: <div className={css.stateStage}><div role="status" style={toastStyle('warning')}>3 个工具被策略阻止</div></div> },
      { label: '错误', node: <div className={css.stateStage}><div role="status" style={toastStyle('danger')}>连接失败，正在重试</div></div> },
    ],
    props: [
      { name: 'message', type: 'string', default: '必填', desc: '一句话文案，不带句号。' },
      { name: 'tone', type: "'info' | 'success' | 'warning' | 'danger'", default: "'info'", desc: '语气，决定图标与着色。' },
      { name: 'duration', type: 'number', default: '4000', desc: '自动消失毫秒；0 表示常驻（必须手动关）。' },
      { name: 'onDismiss', type: '(id: string) => void', default: '必填', desc: '关闭回调。' },
    ],
    keyboard: [
      { keys: 'Tab', action: '焦点在关闭按钮上（不自动抢焦点）' },
      { keys: 'Enter / Space', action: '关闭' },
    ],
    notes: [
      '`role=status`（隐含 aria-live=polite）：读屏会播报但不打断当前朗读，且不抢焦点。错误也用 polite——真正需要立即处理的事不该靠 Toast。',
      '不阻塞、不居中遮挡：底部居中堆叠，最多 3 条，溢出时旧的先走。',
    ],
    sample: <div role="status" style={toastStyle('success')}>已复制到剪贴板</div>,
  },
  {
    id: 'Kbd',
    name: 'Kbd',
    group: 'overlay',
    icon: 'command',
    summary: '键帽：展示快捷键的视觉记号，不解析按键。',
    use: ['菜单项右侧的快捷键提示。', '输入框尾部的 ⌘K 提示、空态里的引导。'],
    avoid: ['可点击的「按钮」：Kbd 不是交互元素，看着像按钮会让用户去点。'],
    states: [
      { label: '单键', node: <Kbd>Esc</Kbd> },
      { label: '组合', node: <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><Kbd>⌘</Kbd><Kbd>K</Kbd></div> },
      { label: '在输入框里', node: <Input icon="search" placeholder="搜索" trailing={<Kbd>⌘K</Kbd>} /> },
    ],
    props: [{ name: 'children', type: 'ReactNode', default: '必填', desc: '按键名，如 ⌘ / K / Esc。' }],
    keyboard: [{ keys: '—', action: '不可聚焦、不可交互，纯展示' }],
    notes: ['用原生 `<kbd>`：读屏与复制粘贴行为都对，且浏览器默认等宽字体与语义一致。'],
    sample: <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><Kbd>⌘</Kbd><Kbd>K</Kbd><span style={{ color: 'var(--pi-fg-3)', fontSize: 12 }}>打开命令面板</span></div>,
  },
]

/** Toast 语气 → 内联样式（文档里不挂 Portal，直接用同一组令牌画出等价外观）。 */
function toastStyle(tone: 'info' | 'success' | 'warning' | 'danger'): CSSProperties {
  const toneColor = {
    info: 'var(--pi-info)',
    success: 'var(--pi-success)',
    warning: 'var(--pi-warning)',
    danger: 'var(--pi-danger)',
  } as const
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    minHeight: 32,
    padding: '0 12px',
    borderRadius: 'var(--pi-r-8)',
    border: '1px solid var(--pi-edge)',
    background: 'var(--pi-panel)',
    color: toneColor[tone],
    fontSize: 13,
    boxShadow: 'var(--pi-shadow-pop)',
  }
}
