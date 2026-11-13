import { Button, ButtonGroup, IconButton } from '../../components/Button'
import css from '../showcase.module.css'
import type { ComponentDoc } from './types'

/** 动作组：按钮三件套。 */
export const ACTION_DOCS: readonly ComponentDoc[] = [
  {
    id: 'Button',
    name: 'Button',
    group: 'action',
    icon: 'plus',
    summary: '触发一个动作。外观按「这件事有多重要」分四级，而不是按「放在哪个页面」分。',
    use: [
      '提交表单、确认对话框、触发一次生成。',
      '一个视图里最多一个 primary——它是用户的默认下一步。',
      '破坏性且不可撤销的操作（删除会话）用 danger。',
    ],
    avoid: [
      '导航到另一个页面用链接或 NavItem，不要用 Button（读屏与中键行为不同）。',
      '同屏出现两个 primary：用户会不知道哪个是「继续」。',
      '纯图标动作不要用 Button + 隐藏文字，用 IconButton。',
    ],
    states: [
      { label: '默认', node: <Button variant="primary">发送消息</Button>, note: '实色底，白字 6.08:1' },
      { label: '悬停', node: <Button variant="primary" forceState="hover">发送消息</Button>, note: '底色深一档，不用缩放' },
      { label: '按下', node: <Button variant="primary" forceState="active">发送消息</Button>, note: '再深一档，位移 0' },
      { label: '聚焦', node: <Button variant="primary" className={css.forceRing}>发送消息</Button>, note: '2px 环 + 2px 间隔' },
      { label: '禁用', node: <Button variant="primary" disabled>发送消息</Button>, note: '仍占位，避免布局跳动' },
      { label: '加载', node: <Button variant="primary" loading>发送中</Button>, note: 'aria-busy，文字保留' },
    ],
    sizes: (
      <>
        <span className={css.sizeItem}>
          <Button size="sm">24px</Button>
          <span className={css.sizeLabel}>sm · 24</span>
        </span>
        <span className={css.sizeItem}>
          <Button size="md">28px</Button>
          <span className={css.sizeLabel}>md · 28</span>
        </span>
        <span className={css.sizeItem}>
          <Button size="lg">32px</Button>
          <span className={css.sizeLabel}>lg · 32</span>
        </span>
        <span className={css.sizeItem}>
          <Button size="xl">36px</Button>
          <span className={css.sizeLabel}>xl · 36</span>
        </span>
      </>
    ),
    props: [
      { name: 'variant', type: "'primary' | 'secondary' | 'ghost' | 'danger'", default: "'secondary'", desc: '语义层级。' },
      { name: 'size', type: "'sm' | 'md' | 'lg' | 'xl'", default: "'md'", desc: '高度 24 / 28 / 32 / 36。' },
      { name: 'icon', type: 'DsIconName', default: '—', desc: '前导图标。' },
      { name: 'trailingIcon', type: 'DsIconName', default: '—', desc: '尾部图标，如 chevronDown。' },
      { name: 'loading', type: 'boolean', default: 'false', desc: '显示 spinner；用 aria-busy 而不是 disabled，读屏仍能读到按钮名。' },
      { name: 'fullWidth', type: 'boolean', default: 'false', desc: '占满容器宽度。' },
      { name: 'disabled', type: 'boolean', default: 'false', desc: '禁用并退出 Tab 序。' },
      { name: 'forceState', type: "'hover' | 'active'", default: '—', desc: '仅文档用：强制渲染某个视觉态。' },
      { name: 'type', type: "'button' | 'submit' | 'reset'", default: "'button'", desc: '默认 button，避免在表单里误提交。' },
    ],
    keyboard: [
      { keys: 'Tab / Shift+Tab', action: '进入 / 离开按钮（禁用按钮不在序里）' },
      { keys: 'Enter', action: '触发' },
      { keys: 'Space', action: '触发（按下时不滚动页面）' },
    ],
    notes: [
      'loading 时保留文字：把文字换成「加载中…」会让按钮宽度跳变，布局抖动比多两个字更烦。',
      'danger 只在「不可撤销」时用；可撤销的删除用 secondary + 确认对话框即可。',
    ],
    sample: (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <Button variant="primary">发送</Button>
        <Button variant="secondary">取消</Button>
        <Button variant="ghost" icon="copy">复制</Button>
        <Button variant="danger" icon="trash">删除</Button>
      </div>
    ),
  },
  {
    id: 'IconButton',
    name: 'IconButton',
    group: 'action',
    icon: 'more',
    summary: '只有图标的方形按钮。空间紧张的工具条与行内操作使用，必须带无障碍名。',
    use: ['工具栏、列表行尾、浮层右上角的关闭。', '动作含义在图标的通用理解范围内（关闭、更多、复制、删除）。'],
    avoid: [
      '含义模糊的图标（例如「同步」「整理」）：加 label 也只能解决读屏，解决不了近视。',
      '作为主操作：纯图标没有语义权重，不能让用户一眼看出这是「主要该点的东西」。',
    ],
    states: [
      { label: '默认', node: <IconButton icon="more" label="更多操作" /> },
      { label: '悬停', node: <IconButton icon="more" label="更多操作" forceState="hover" /> },
      { label: '聚焦', node: <IconButton icon="more" label="更多操作" className="pi-doc-ring" /> },
      { label: '禁用', node: <IconButton icon="more" label="更多操作" disabled /> },
    ],
    sizes: (
      <>
        <span className="pi-doc-size-item">
          <IconButton icon="more" label="更多" size="sm" />
          <span className="pi-doc-size-label">sm · 24</span>
        </span>
        <span className="pi-doc-size-item">
          <IconButton icon="more" label="更多" size="md" />
          <span className="pi-doc-size-label">md · 28</span>
        </span>
        <span className="pi-doc-size-item">
          <IconButton icon="more" label="更多" size="lg" />
          <span className="pi-doc-size-label">lg · 32</span>
        </span>
      </>
    ),
    props: [
      { name: 'icon', type: 'DsIconName', default: '必填', desc: '图标名。' },
      { name: 'label', type: 'string', default: '必填', desc: '无障碍名，同时作为 title 兜底。' },
      { name: 'variant', type: "'primary' | 'secondary' | 'ghost' | 'danger'", default: "'ghost'", desc: '默认 ghost，避免工具条里一排实心块。' },
      { name: 'size', type: "'sm' | 'md' | 'lg' | 'xl'", default: "'md'", desc: '正方形边长。' },
    ],
    keyboard: [
      { keys: 'Tab', action: '聚焦' },
      { keys: 'Enter / Space', action: '触发' },
    ],
    notes: ['label 是必填属性而不是可选：可选就会有人不填，读屏于是读到「按钮」。类型系统在这里比文档更有效。'],
    sample: (
      <div style={{ display: 'flex', gap: 8 }}>
        <IconButton icon="paperclip" label="添加附件" />
        <IconButton icon="more" label="更多" />
        <IconButton icon="close" label="关闭" />
      </div>
    ),
  },
  {
    id: 'ButtonGroup',
    name: 'ButtonGroup',
    group: 'action',
    icon: 'grid',
    summary: '把强关联的并列按钮拼成一组，让它们读起来像一个控件。',
    use: ['同一对象的并列动作（复制 / 移动 / 删除）。', '分页、缩放这类连续小步骤。'],
    avoid: ['语义无关的按钮挨在一起：拼组会暗示它们属于同一个选择。', '超过 4 个按钮：改用 Menu 收起来。'],
    states: [
      {
        label: '默认',
        node: (
          <ButtonGroup label="视图">
            <Button size="sm" variant="secondary">日</Button>
            <Button size="sm" variant="secondary">周</Button>
            <Button size="sm" variant="secondary">月</Button>
          </ButtonGroup>
        ),
      },
      {
        label: '含当前项',
        node: (
          <ButtonGroup label="视图">
            <Button size="sm" variant="secondary" aria-pressed>
              日
            </Button>
            <Button size="sm" variant="secondary">周</Button>
            <Button size="sm" variant="secondary">月</Button>
          </ButtonGroup>
        ),
        note: 'aria-pressed 表达当前项',
      },
    ],
    props: [
      { name: 'label', type: 'string', default: '必填', desc: '组无障碍名（role=group）。' },
      { name: 'children', type: 'ReactNode', default: '必填', desc: '建议放 Button。' },
    ],
    keyboard: [{ keys: 'Tab', action: '逐项移动（组内不拦截方向键，避免与 Button 语义冲突）' }],
    notes: ['用 role=group + aria-label，而不是 role=toolbar：toolbar 会改变 Tab 行为，对 3 个按钮来说是过度设计。'],
    sample: (
      <ButtonGroup label="分页">
        <Button size="sm" variant="secondary" icon="chevronRight">
          上一页
        </Button>
        <Button size="sm" variant="secondary">
          下一页
        </Button>
      </ButtonGroup>
    ),
  },
]
