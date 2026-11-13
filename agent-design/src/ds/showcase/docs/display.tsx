import { Button, IconButton } from '../../components/Button'
import {
  Avatar,
  Badge,
  Card,
  Divider,
  EmptyState,
  NavGroup,
  NavItem,
  SegmentedControl,
  Skeleton,
  Tabs,
  Tag,
} from '../../components/display'
import type { ComponentDoc } from './types'
/** 展示组：不触发动作也不收输入的容器与标记。 */
export const DISPLAY_DOCS: readonly ComponentDoc[] = [
  {
    id: 'Tabs',
    name: 'Tabs',
    group: 'display',
    icon: 'layers',
    summary: '同一区域里的并列内容面板切换。与 SegmentedControl 的区别是：Tabs 切的是「内容」，分段控件切的是「一个值」。',
    use: ['内容并列且互斥（会话 / 文件 / 变更三个面板）。', '面板数量 2–7，标题短到能并排。'],
    avoid: ['切换的是同一个东西的视图模式（列表/网格）：用 SegmentedControl。', '超过 7 个：用侧栏导航或 Menu，一行 tab 挤到换行就不可扫读了。'],
    states: [
      {
        label: '三项',
        node: <Tabs items={[{ id: 't1', label: '会话' }, { id: 't2', label: '文件', count: 12 }, { id: 't3', label: '变更', count: 3 }]} value="t1" onChange={() => undefined} label="内容面板" />,
      },
      {
        label: '带图标',
        node: <Tabs items={[{ id: 'u1', label: '对话', icon: 'chat' }, { id: 'u2', label: '工具', icon: 'command' }]} value="u1" onChange={() => undefined} label="视图" />,
      },
      {
        label: '含禁用',
        node: <Tabs items={[{ id: 'd1', label: '概览' }, { id: 'd2', label: '历史', disabled: true }]} value="d1" onChange={() => undefined} label="面板" />,
        note: '禁用项留在原位，不隐藏',
      },
    ],
    props: [
      { name: 'items', type: 'readonly TabItem[]', default: '必填', desc: '`{ id, label, count?, icon?, disabled? }`。' },
      { name: 'value', type: 'string', default: '必填', desc: '当前选中 id（受控）。' },
      { name: 'onChange', type: '(id: string) => void', default: '必填', desc: '切换回调。' },
      { name: 'label', type: 'string', default: '必填', desc: 'tablist 的无障碍名。' },
      { name: 'TabPanel', type: '{ id, children }', default: '—', desc: '配对的面板容器，自动接 aria-controls/labelledby。' },
    ],
    keyboard: [
      { keys: '← / →', action: '在标签间移动并即时切换（自动激活）' },
      { keys: 'Home / End', action: '跳首 / 尾' },
      { keys: 'Tab', action: '整组只占一个 Tab 位，进入后落在当前面板' },
    ],
    notes: [
      'roving tabindex：只有当前 tab 是 tabIndex=0。否则 7 个标签意味着用户要按 7 次 Tab 才能穿过去。',
      '自动激活（移动即切换）适合本地内容；如果切换会发请求，应改成手动激活（Enter 才切），本组件当前只服务本地内容。',
    ],
    sample: <Tabs items={[{ id: 's1', label: '会话' }, { id: 's2', label: '文件', count: 12 }, { id: 's3', label: '变更', count: 3 }]} value="s1" onChange={() => undefined} label="内容面板" />,
  },
  {
    id: 'SegmentedControl',
    name: 'SegmentedControl',
    group: 'display',
    icon: 'grid',
    summary: '2–4 个互斥选项的即时切换，读作「选一个值」。用 radiogroup 语义，不是 tablist。',
    use: ['主题切换（跟随系统 / 浅色 / 深色）。', '视图密度、排序方式这类三选一。'],
    avoid: ['切换内容面板：用 Tabs，语义是 tab 而非 ratio。', '超过 4 个选项：挤成一条就扫不清了，改用 Select。'],
    states: [
      { label: '三项文字', node: <SegmentedControl options={[{ value: 'auto', label: '系统' }, { value: 'light', label: '浅色' }, { value: 'dark', label: '深色' }]} value="light" onChange={() => undefined} label="主题" /> },
      { label: '仅图标', node: <SegmentedControl iconOnly options={[{ value: 'auto', label: '跟随系统', icon: 'auto' }, { value: 'light', label: '浅色', icon: 'sun' }, { value: 'dark', label: '深色', icon: 'moon' }]} value="dark" onChange={() => undefined} label="主题" /> },
      { label: '两项', node: <SegmentedControl options={[{ value: 'list', label: '列表' }, { value: 'grid', label: '网格' }]} value="list" onChange={() => undefined} label="视图" /> },
    ],
    props: [
      { name: 'options', type: 'readonly SegmentOption[]', default: '必填', desc: '`{ value, label, icon? }`。' },
      { name: 'value', type: 'string', default: '必填', desc: '当前值（受控）。' },
      { name: 'onChange', type: '(value: string) => void', default: '必填', desc: '变化回调。' },
      { name: 'label', type: 'string', default: '必填', desc: 'radiogroup 的无障碍名。' },
      { name: 'iconOnly', type: 'boolean', default: 'false', desc: '只显示图标，label 转为 aria-label 与 title。' },
    ],
    keyboard: [
      { keys: '← / → / ↑ / ↓', action: '在选项间循环移动并立即选中' },
      { keys: 'Tab', action: '整组一个 Tab 位' },
    ],
    notes: [
      '语义选择：这是「选一个值」而不是「切面板」，所以 role=radio。用 tablist 会让读屏报「标签页 1/3」，而屏幕上并没有对应的面板。',
      'iconOnly 时 label 必须保留并转为 aria-label：三个只有图标的方块对读屏用户等于三个无名按钮。',
    ],
    sample: <SegmentedControl options={[{ value: 'auto', label: '系统' }, { value: 'light', label: '浅色' }, { value: 'dark', label: '深色' }]} value="light" onChange={() => undefined} label="主题" />,
  },
  {
    id: 'Avatar',
    name: 'Avatar',
    group: 'display',
    icon: 'dot',
    summary: '身份标记：有图用图，没图用名字首字。属于装饰性信息，读屏名由旁边文本承担。',
    use: ['会话作者、工作区成员、组织。', '需要一眼区分「谁说的话」的对话列表头。'],
    avoid: ['需要点击进入用户资料：Avatar 本身不是按钮，套 Button 或包一层可聚焦元素。', '作为页面主视觉：头像信息量低，撑不起视觉重心。'],
    states: [
      { label: '小', node: <Avatar name="Pi Agent" size="sm" /> },
      { label: '中', node: <Avatar name="Pi Agent" size="md" /> },
      { label: '大', node: <Avatar name="Yuki Tanaka" size="lg" /> },
      { label: '中性', node: <Avatar name="Pi Agent" tone="neutral" /> },
      { label: '在线', node: <Avatar name="Pi Agent" presence="online" /> },
      { label: '忙碌', node: <Avatar name="Pi Agent" presence="busy" /> },
    ],
    props: [
      { name: 'name', type: 'string', default: '必填', desc: '显示名；无图时取首字；同时是 aria-label。' },
      { name: 'src', type: 'string', default: '—', desc: '图片地址。' },
      { name: 'size', type: "'sm' | 'md' | 'lg'", default: "'md'", desc: '20 / 24 / 32。' },
      { name: 'tone', type: "'accent' | 'neutral'", default: "'accent'", desc: '无图时的底色。' },
      { name: 'presence', type: "'online' | 'busy' | 'away'", default: '—', desc: '右下角状态点。' },
    ],
    keyboard: [{ keys: '—', action: '不可聚焦；整套 role=img + aria-label' }],
    notes: [
      '首字取 `Array.from(name)[0]`：按码点取，中文与 emoji 都不会被切成半个字。',
      '状态点用 `currentColor` 系着色且 aria-hidden：状态语义必须另由文本承载，颜色不能是唯一信息。',
    ],
    sample: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar name="Pi Agent" size="sm" />
        <Avatar name="Yuki" presence="online" />
        <Avatar name="Quinn" tone="neutral" />
      </div>
    ),
  },
  {
    id: 'Badge',
    name: 'Badge',
    group: 'display',
    icon: 'dot',
    summary: '数量或状态的短标记，3 个字以内。比 Tag 短、比 Tag 轻，不承载操作。',
    use: ['未读数、条数、状态（运行中 / 已完成）。', '表格列里的枚举值。'],
    avoid: ['可删除的实体（附件名、筛选条件）：用 Tag。', '超过 3 个字的文本：胶囊状底会撑成一条，改用纯文本或 Tag。'],
    states: [
      { label: '中性', node: <Badge>草稿</Badge> },
      { label: '强调', node: <Badge tone="accent">12</Badge> },
      { label: '成功', node: <Badge tone="success" dot>已完成</Badge> },
      { label: '警告', node: <Badge tone="warning" dot>待确认</Badge> },
      { label: '危险', node: <Badge tone="danger" dot>失败</Badge> },
      { label: '描边', node: <Badge outline tone="info">info</Badge> },
    ],
    props: [
      { name: 'children', type: 'ReactNode', default: '必填', desc: '短文本或数字。' },
      { name: 'tone', type: "'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'", default: "'neutral'", desc: '语气。' },
      { name: 'size', type: "'sm' | 'md'", default: "'md'", desc: '18 / 20 高。' },
      { name: 'outline', type: 'boolean', default: 'false', desc: '只有描边，用于密集列表降噪。' },
      { name: 'dot', type: 'boolean', default: 'false', desc: '前导圆点，状态用。' },
    ],
    keyboard: [{ keys: '—', action: '不可聚焦，纯展示' }],
    notes: ['带 dot 的状态徽标必须同时有文字：只有颜色点的状态在灰度屏与色盲用户眼里等于没有。'],
    sample: (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Badge tone="accent">12</Badge>
        <Badge tone="success" dot>运行中</Badge>
        <Badge outline>草稿</Badge>
      </div>
    ),
  },
  {
    id: 'Tag',
    name: 'Tag',
    group: 'display',
    icon: 'close',
    summary: '比 Badge 更长、可删除的实体标签：已选筛选条件、附件名、工作区标签。',
    use: ['一组可增删的条件（筛选器已选项）。', '需要展示并移除的关联实体。'],
    avoid: ['状态与计数：用 Badge（不该有删除按钮）。', '纯展示的分类：静态文本或 Badge 更轻。'],
    states: [
      { label: '静态', node: <Tag>timeline.ts</Tag> },
      { label: '可删除', node: <Tag onRemove={() => undefined}>src/ds</Tag> },
      { label: '一组', node: <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Tag onRemove={() => undefined}>typescript</Tag><Tag onRemove={() => undefined}>diff</Tag><Tag>+2</Tag></div> },
    ],
    props: [
      { name: 'children', type: 'ReactNode', default: '必填', desc: '标签文本。' },
      { name: 'onRemove', type: '() => void', default: '—', desc: '提供则显示删除按钮。' },
      { name: 'removeLabel', type: 'string', default: "'移除'", desc: '删除按钮的无障碍名；列表里应带上实体名（如「移除 typescript」）。' },
    ],
    keyboard: [
      { keys: 'Tab', action: '移动到删除按钮（标签文本本身不可聚焦）' },
      { keys: 'Enter / Space', action: '删除' },
    ],
    notes: ['removeLabel 默认「移除」在列表里会变成一串同名的按钮；真实使用时应传「移除 <实体名>」。'],
    sample: (
      <div style={{ display: 'flex', gap: 6 }}>
        <Tag onRemove={() => undefined} removeLabel="移除 typescript">typescript</Tag>
        <Tag onRemove={() => undefined} removeLabel="移除 diff">diff</Tag>
      </div>
    ),
  },
  {
    id: 'Card',
    name: 'Card',
    group: 'display',
    icon: 'layers',
    summary: '一组相关内容的边界。默认靠 1px 描边分组，不靠阴影和圆角堆装饰。',
    use: ['把紧密相关的内容圈在一起（一次工具调用的输入输出）。', '需要头/尾分区的独立信息块。'],
    avoid: ['只是为了加内边距：直接用布局容器，多层卡片套娃会让边界失去意义。', '列表里的每一项都套卡片：用分隔线更轻。'],
    states: [
      {
        label: '基础',
        node: (
          <Card title="工作区" description="pi 在这个目录里读写文件。" actions={<IconButton icon="more" label="更多" size="sm" />}>
            <span style={{ color: 'var(--pi-fg-2)', fontSize: 13 }}>D:\workspace\PiGui</span>
          </Card>
        ),
      },
      {
        label: '带脚注',
        node: (
          <Card title="模型" footer={<span style={{ color: 'var(--pi-fg-3)', fontSize: 12 }}>变更立即生效</span>}>
            <span style={{ color: 'var(--pi-fg-2)', fontSize: 13 }}>Claude Sonnet 4.5</span>
          </Card>
        ),
      },
      { label: '浮起', node: <Card elevated><span style={{ color: 'var(--pi-fg-2)', fontSize: 13 }}>脱离背景的卡片（极淡投影）</span></Card> },
      { label: '无边框', node: <Card flush><span style={{ color: 'var(--pi-fg-2)', fontSize: 13 }}>只做布局，不画边界</span></Card> },
    ],
    props: [
      { name: 'title', type: 'string', default: '—', desc: '标题（h3）。' },
      { name: 'description', type: 'string', default: '—', desc: '标题下的说明。' },
      { name: 'actions', type: 'ReactNode', default: '—', desc: '标题右侧动作区。' },
      { name: 'footer', type: 'ReactNode', default: '—', desc: '底部分区，带分隔线。' },
      { name: 'elevated', type: 'boolean', default: 'false', desc: '加一层极淡投影。' },
      { name: 'flush', type: 'boolean', default: 'false', desc: '去掉描边与底色，只保留布局与内边距。' },
    ],
    keyboard: [{ keys: '—', action: '容器自身不可聚焦；内部控件各自可聚焦' }],
    notes: ['用 `<section>` 而不是 div：有标题的卡片是一个独立区块，读屏可以按「区域」跳转。'],
    sample: (
      <Card title="工作区" description="pi 在这个目录里读写文件。" actions={<Button size="sm" variant="secondary">更改</Button>}>
        <span style={{ color: 'var(--pi-fg-2)', fontSize: 13 }}>D:\workspace\PiGui</span>
      </Card>
    ),
  },
  {
    id: 'Divider',
    name: 'Divider',
    group: 'display',
    icon: 'more',
    summary: '分隔线：水平用于分组，垂直用于工具栏里的并列动作，可带中间文字标签。',
    use: ['工具栏里分隔不同性质的动作组。', '长列表里分隔语义不同的区段。'],
    avoid: ['两个元素之间只用一条线就想表达层级：间距（8/16）通常就够了，线用多了会显得吵。', '作为「卡片边界」：那是 Card 的职责。'],
    states: [
      { label: '水平', node: <div style={{ width: '100%' }}><div style={{ fontSize: 12, color: 'var(--pi-fg-3)' }}>上方内容</div><Divider /><div style={{ fontSize: 12, color: 'var(--pi-fg-3)' }}>下方内容</div></div> },
      { label: '带标签', node: <div style={{ width: '100%' }}><Divider label="今天" /></div> },
      { label: '垂直', node: <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 24 }}><span style={{ fontSize: 12 }}>复制</span><Divider orientation="vertical" /><span style={{ fontSize: 12 }}>移动</span></div> },
    ],
    props: [
      { name: 'orientation', type: "'horizontal' | 'vertical'", default: "'horizontal'", desc: '方向。' },
      { name: 'label', type: 'string', default: '—', desc: '中间的标签（仅水平）。' },
    ],
    keyboard: [{ keys: '—', action: '`<hr>` 是分隔符语义，不可聚焦；带标签版用 role=separator + aria-label' }],
    notes: ['水平用原生 `<hr>`：浏览器与读屏都把它当分隔符，不需要额外 role。'],
    sample: <div style={{ width: '100%' }}><Divider label="今天" /></div>,
  },
  {
    id: 'Skeleton',
    name: 'Skeleton',
    group: 'display',
    icon: 'layers',
    summary: '加载中的占位块。必须与真实内容同尺寸，否则加载完成时布局会跳。',
    use: ['首屏数据未到时占住位置，避免 CLS。', '列表分页加载时的尾部占位。'],
    avoid: ['等待时间短于 300ms：闪现一下的骨架比空白更烦，直接渲染或什么都不显示。', '用骨架代替进度：骨架表达「马上就来」，适合已知结构；不确定时长的任务用进度或状态文本。'],
    states: [
      { label: '单行', node: <div style={{ width: '100%' }}><Skeleton width="60%" /></div> },
      { label: '段落', node: <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}><Skeleton /><Skeleton width="85%" /><Skeleton width="45%" /></div> },
      { label: '方块', node: <Skeleton width={40} height={40} radius={8} /> },
    ],
    props: [
      { name: 'width', type: 'number | string', default: "'100%'", desc: '宽度。' },
      { name: 'height', type: 'number | string', default: '12', desc: '高度。' },
      { name: 'radius', type: 'number | string', default: '4', desc: '圆角覆盖。' },
    ],
    keyboard: [{ keys: '—', action: 'aria-hidden；加载状态由外层 aria-busy 表达' }],
    notes: ['骨架自己 aria-hidden：读屏不该读「空块」；外层容器给 aria-busy=true 就够了。'],
    sample: <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}><Skeleton /><Skeleton width="85%" /><Skeleton width="45%" /></div>,
  },
  {
    id: 'EmptyState',
    name: 'EmptyState',
    group: 'display',
    icon: 'chat',
    summary: '空态：说明发生了什么 + 给出一个出路。没有动作按钮的空态基本等于死路。',
    use: ['列表第一次打开（还没有会话）。', '搜索无结果（并给出清除筛选的入口）。'],
    avoid: ['错误状态：用带重试的错误块，图标与语气都不同。', '把空态当宣传位塞大插图：用户此时想的是「我该点哪」。'],
    states: [
      { label: '首次打开', node: <EmptyState icon="chat" title="还没有会话" description="开始一次对话，pi 会在你的工作区里工作。" actions={<Button size="sm" variant="primary">新建会话</Button>} /> },
      { label: '无结果', node: <EmptyState icon="search" title="没有匹配的会话" description="试试更短的关键词。" actions={<Button size="sm" variant="secondary">清除筛选</Button>} /> },
      { label: '无动作', node: <EmptyState title="暂无变更" description="这个会话还没有修改文件。" />, note: '纯说明型，允许没有按钮' },
    ],
    props: [
      { name: 'title', type: 'string', default: '必填', desc: '一句话说明现状。' },
      { name: 'description', type: 'string', default: '—', desc: '下一步该做什么。' },
      { name: 'icon', type: 'DsIconName', default: "'chat'", desc: '图标。' },
      { name: 'actions', type: 'ReactNode', default: '—', desc: '动作区，一般只有一个主操作。' },
    ],
    keyboard: [{ keys: 'Tab', action: '直接进入动作按钮' }],
    notes: ['标题用 h3：空态常常是整个面板的唯一内容，给个标题层级能让读屏用户知道这里是什么。'],
    sample: <EmptyState icon="chat" title="还没有会话" description="开始一次对话，pi 会在你的工作区里工作。" actions={<Button size="sm" variant="primary">新建会话</Button>} />,
  },
  {
    id: 'NavItem',
    name: 'NavItem / NavGroup',
    group: 'display',
    icon: 'sidebar',
    summary: '侧栏导航项与分组。用 button 而非 a（当前无 URL 路由），当前项用 aria-current=page 表达。',
    use: ['左侧栏的会话列表、设置页的二级导航。', '需要「当前在哪」的持久导航区。'],
    avoid: ['页内区块切换：用 Tabs。', '跳转到外部网址：用真正的 `<a>`，它才有中键与复制链接。'],
    states: [
      { label: '默认', node: <NavItem label="会话" icon="chat" /> },
      { label: '当前', node: <NavItem label="会话" icon="chat" active />, note: 'aria-current=page' },
      { label: '带计数', node: <NavItem label="工具调用" icon="command" meta={<Badge tone="accent">12</Badge>} /> },
      { label: '禁用', node: <NavItem label="归档" icon="history" disabled /> },
      { label: '分组', node: <NavGroup label="工作区"><NavItem label="pi-gui" icon="layers" active /><NavItem label="agent-design" icon="layers" /></NavGroup> },
    ],
    props: [
      { name: 'label', type: 'string', default: '必填', desc: '文案。' },
      { name: 'icon', type: 'DsIconName', default: '—', desc: '前导图标。' },
      { name: 'meta', type: 'ReactNode', default: '—', desc: '右侧元信息（计数、状态点）。' },
      { name: 'active', type: 'boolean', default: 'false', desc: '当前项，输出 aria-current=page。' },
      { name: 'disabled', type: 'boolean', default: 'false', desc: '禁用。' },
      { name: 'onSelect', type: '() => void', default: '—', desc: '点击回调。' },
      { name: 'NavGroup.label', type: 'string', default: '—', desc: '分组的无障碍名，同时可见。' },
    ],
    keyboard: [
      { keys: 'Tab', action: '逐项移动（导航不是 radio 组，保留自然 Tab 序）' },
      { keys: 'Enter / Space', action: '进入' },
    ],
    notes: [
      '用 button 而不是 a：没有 URL 就没有 href，假的 href="#" 会让读屏报「链接」并污染浏览器历史。',
      'aria-current="page" 而不是 aria-selected：前者是导航语义（「你在这一页」），后者属于 tab/listbox。',
    ],
    sample: (
      <NavGroup label="工作区">
        <NavItem label="pi-gui" icon="layers" active />
        <NavItem label="agent-design" icon="layers" meta={<Badge size="sm">3</Badge>} />
        <NavItem label="归档" icon="history" disabled />
      </NavGroup>
    ),
  },
]
