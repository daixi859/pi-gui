import { Checkbox, Field, Input, Radio, Select, Switch, Textarea } from '../../components/controls'
import { Kbd } from '../../components/overlays'
import css from '../showcase.module.css'
import type { ComponentDoc } from './types'

/** 输入组：所有让用户填东西的控件。 */
export const INPUT_DOCS: readonly ComponentDoc[] = [
  {
    id: 'Field',
    name: 'Field',
    group: 'input',
    icon: 'sliders',
    summary: '字段外壳：标签 + 控件 + 提示/错误。它是把「一个控件」变成「一个能看懂的表单项」的那一层。',
    use: ['任何需要文字标签的表单项。', '需要在控件下方给常态说明或校验错误时。'],
    avoid: ['控件自身已经足够自解释的场合（搜索框、命令面板）：多一行标签只是噪音。', '把 Field 当布局容器堆两列：它有固定的纵向节奏，横排由上一层 grid 决定。'],
    states: [
      {
        label: '默认',
        node: (
          <Field label="工作目录" hint="pi 会在这个目录里读写文件。">
            <Input defaultValue="D:\\workspace\\PiGui" />
          </Field>
        ),
      },
      {
        label: '必填',
        node: (
          <Field label="会话名" required>
            <Input placeholder="未命名会话" />
          </Field>
        ),
        note: '星号 aria-hidden，必填语义靠 required',
      },
      {
        label: '错误',
        node: (
          <Field label="API Key" error="格式不对，应以 sk- 开头。">
            <Input defaultValue="sk-ant" invalid />
          </Field>
        ),
        note: 'role=alert；错误优先于提示',
      },
      {
        label: '禁用',
        node: (
          <Field label="模型" hint="由组织策略锁定。">
            <Input defaultValue="claude-sonnet" disabled />
          </Field>
        ),
      },
    ],
    props: [
      { name: 'label', type: 'string', default: '必填', desc: '字段名，同时是控件的 <label>。' },
      { name: 'hint', type: 'string', default: '—', desc: '常态说明。' },
      { name: 'error', type: 'string', default: '—', desc: '有值即 invalid 态，并广播 role=alert。' },
      { name: 'required', type: 'boolean', default: 'false', desc: '在标签后加视觉星号。' },
      { name: 'htmlFor', type: 'string', default: '—', desc: '控件 id；不传时由控件自己生成并关联。' },
    ],
    keyboard: [{ keys: '—', action: '自身不可聚焦；Tab 直接进入内部控件' }],
    notes: [
      '错误与提示不同时显示：两行一个说「必填」一个说「格式错」，用户只会读第一行。',
      '星号只是视觉补充，真正的必填语义必须由控件上的 required / aria-required 承载——否则读屏用户得不到信息。',
    ],
    sample: (
      <Field label="工作目录" hint="pi 会在这个目录里读写文件。">
        <Input defaultValue="D:\\workspace\\PiGui" />
      </Field>
    ),
  },
  {
    id: 'Input',
    name: 'Input',
    group: 'input',
    icon: 'search',
    summary: '单行文本输入。三种高度、可带前导图标与尾部内容，错误态由外面的 Field 驱动。',
    use: ['会话重命名、搜索、URL、API Key 等单行值。', '需要尾部提示时（如 ⌘K 快捷键、字符计数）。'],
    avoid: ['多行文本（提示词、系统提示）用 Textarea。', '选项固定且不超过 12 个时用 Select，别让用户手打。'],
    states: [
      { label: '默认', node: <Input placeholder="输入点什么" /> },
      { label: '已填', node: <Input defaultValue="重构 timeline.ts" /> },
      { label: '聚焦', node: <Input placeholder="输入点什么" className={css.forceRing} /> },
      { label: '带图标', node: <Input icon="search" placeholder="搜索会话" />, note: '前导图标不拦截点击' },
      { label: '错误', node: <Input defaultValue="sk-ant" invalid />, note: '边框转 danger，附 aria-invalid' },
      { label: '禁用', node: <Input defaultValue="不可编辑" disabled /> },
    ],
    sizes: (
      <>
        <span className={css.sizeItem}>
          <Input size="sm" placeholder="sm" style={{ width: 120 }} />
          <span className={css.sizeLabel}>sm · 24</span>
        </span>
        <span className={css.sizeItem}>
          <Input size="md" placeholder="md" style={{ width: 120 }} />
          <span className={css.sizeLabel}>md · 28</span>
        </span>
        <span className={css.sizeItem}>
          <Input size="lg" placeholder="lg" style={{ width: 120 }} />
          <span className={css.sizeLabel}>lg · 32</span>
        </span>
      </>
    ),
    props: [
      { name: 'size', type: "'sm' | 'md' | 'lg'", default: "'md'", desc: '高度 24 / 28 / 32。' },
      { name: 'icon', type: "'search'", default: '—', desc: '前导图标；只有搜索一个值，避免图标变装饰。' },
      { name: 'trailing', type: 'ReactNode', default: '—', desc: '尾部内容，如 <Kbd> 或单位。' },
      { name: 'invalid', type: 'boolean', default: 'false', desc: '错误态视觉，同时设 aria-invalid。' },
      { name: '...rest', type: 'InputHTMLAttributes', default: '—', desc: '透传原生属性（value/onChange/placeholder/disabled…）。' },
    ],
    keyboard: [
      { keys: 'Tab / Shift+Tab', action: '进出' },
      { keys: 'Enter', action: '提交所在表单（不提交时浏览器不动作）' },
      { keys: 'Esc', action: '组件不处理——清空或关闭由使用方决定' },
    ],
    notes: [
      'Esc 不自动清空：在命令面板里 Esc 是关闭，在搜索框里 Esc 是清空，组件无权替使用方选。',
      '前导图标是装饰而不是按钮：它是 aria-hidden 的，不然读屏会读出「搜索 搜索框」。',
    ],
    sample: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Input icon="search" placeholder="搜索会话或文件" trailing={<Kbd>⌘K</Kbd>} />
        <Input defaultValue="输入了内容" />
      </div>
    ),
  },
  {
    id: 'Textarea',
    name: 'Textarea',
    group: 'input',
    icon: 'layers',
    summary: '多行文本输入。带可选字数统计，默认禁止拖拽改高以保住紧凑布局。',
    use: ['系统提示、上下文说明、多行反馈。', '需要字数上限且用户会写满的场合（配 showCount + maxLength）。'],
    avoid: ['主对话输入框：那是独立的 composer，有附件、模型切换与行数自增。', '只有一行内容的场景用 Input，多行框会浪费高度并暗示「要写很多」。'],
    states: [
      { label: '默认', node: <Textarea placeholder="写下你的系统提示…" rows={3} /> },
      { label: '带计数', node: <Textarea value="始终用中文回答。" readOnly maxLength={200} showCount />, note: '只在给了 maxLength 时出现' },
      { label: '聚焦', node: <Textarea placeholder="聚焦态" rows={2} className={css.forceRing} /> },
      { label: '错误', node: <Textarea defaultValue="太短" rows={2} invalid /> },
      { label: '禁用', node: <Textarea defaultValue="只读内容" rows={2} disabled /> },
    ],
    props: [
      { name: 'invalid', type: 'boolean', default: 'false', desc: '错误态视觉。' },
      { name: 'showCount', type: 'boolean', default: 'false', desc: '显示「已用/上限」，需要同时给 maxLength。' },
      { name: '...rest', type: 'TextareaHTMLAttributes', default: '—', desc: '透传原生属性；rows 控制初始高度。' },
    ],
    keyboard: [
      { keys: 'Tab / Shift+Tab', action: '进出；不会在内容里插入制表符' },
      { keys: 'Enter', action: '换行（textarea 语义，不提交）' },
      { keys: 'Ctrl+Enter', action: '组件不拦截——多行框里的提交由使用方绑定' },
    ],
    notes: [
      '默认 `resize: none`：拖拽把手会让用户把布局拖坏，而高度本应由内容或 rows 决定。',
      '字数统计是 aria-hidden 的：读屏能读到原生 maxLength 限制，重复播报数字只会打断输入。',
    ],
    sample: <Textarea defaultValue="你是一个在后端仓库里工作的 agent。回答前先读 AGENTS.md。" rows={3} maxLength={400} showCount />,
  },
  {
    id: 'Select',
    name: 'Select',
    group: 'input',
    icon: 'chevronDown',
    summary: '单选下拉。刻意使用原生 <select>，代价是外观定制有限，换回的是系统级键盘与读屏行为。',
    use: ['选项在 3–12 个之间且不需要搜索。', '设置页里的枚举型配置（模型、思考档位、语言）。'],
    avoid: ['选项超过 12 个：用 CommandPalette 让用户搜。', '选项有富文本（图标 + 两行说明）：原生 select 只能渲染纯文本，改用 Menu。'],
    states: [
      {
        label: '默认',
        node: (
          <Select defaultValue="sonnet" options={[{ value: 'sonnet', label: 'Sonnet 4.5' }, { value: 'opus', label: 'Opus 4.1' }]} />
        ),
      },
      {
        label: '占位',
        node: <Select value="" placeholder="选择模型" options={[{ value: 'sonnet', label: 'Sonnet 4.5' }]} onChange={() => undefined} />,
        note: '占位项 disabled，不可回选',
      },
      {
        label: '错误',
        node: <Select defaultValue="sonnet" invalid options={[{ value: 'sonnet', label: 'Sonnet 4.5' }]} />,
      },
      {
        label: '禁用',
        node: <Select defaultValue="sonnet" disabled options={[{ value: 'sonnet', label: 'Sonnet 4.5' }]} />,
      },
    ],
    sizes: (
      <>
        <span className={css.sizeItem}>
          <Select size="sm" defaultValue="a" options={[{ value: 'a', label: 'sm' }]} />
          <span className={css.sizeLabel}>sm · 24</span>
        </span>
        <span className={css.sizeItem}>
          <Select size="md" defaultValue="a" options={[{ value: 'a', label: 'md' }]} />
          <span className={css.sizeLabel}>md · 28</span>
        </span>
        <span className={css.sizeItem}>
          <Select size="lg" defaultValue="a" options={[{ value: 'a', label: 'lg' }]} />
          <span className={css.sizeLabel}>lg · 32</span>
        </span>
      </>
    ),
    props: [
      { name: 'options', type: 'readonly SelectOption[]', default: '必填', desc: '`{ value, label, disabled? }` 列表。' },
      { name: 'size', type: "'sm' | 'md' | 'lg'", default: "'md'", desc: '高度档位。' },
      { name: 'placeholder', type: 'string', default: '—', desc: '受控值为空时显示的不可选项。' },
      { name: 'invalid', type: 'boolean', default: 'false', desc: '错误态视觉。' },
      { name: 'value / defaultValue', type: 'string', default: '—', desc: '受控或非受控。' },
    ],
    keyboard: [
      { keys: 'Space / Enter', action: '展开（Windows 原生行为）' },
      { keys: '↑ / ↓', action: '在选项间移动，展开时实时高亮' },
      { keys: '字母键', action: '按首字母跳转（原生行为）' },
      { keys: 'Esc', action: '收起且不改变当前值' },
    ],
    notes: [
      '箭头是自绘的（原生箭头在浅深两套主题里颜色不可控），其余全部原生，包括弹出的列表。',
      '「为什么不自绘下拉」的判据：自绘要重写键盘遍历、首字母跳转、Esc 语义、读屏播报与移动端滚轮选中，换来的只是列表项能放图标。',
    ],
    sample: <Select defaultValue="sonnet" options={[{ value: 'sonnet', label: 'Sonnet 4.5' }, { value: 'opus', label: 'Opus 4.1' }, { value: 'haiku', label: 'Haiku 4.0' }]} />,
  },
  {
    id: 'Checkbox',
    name: 'Checkbox',
    group: 'input',
    icon: 'check',
    summary: '多选或独立开关项。支持半选，用于「部分子项已选」的父级。',
    use: ['一组可同时成立的选项（工具开关、权限清单）。', '需要「提交后才生效」的场景——这是它与 Switch 的分界。'],
    avoid: ['立即生效的设置项：用 Switch，语义更准。', '互斥选项：用 Radio（一组里只能选一个）。'],
    states: [
      { label: '未选', node: <Checkbox label="允许读取工作区" /> },
      { label: '已选', node: <Checkbox label="允许读取工作区" defaultChecked /> },
      { label: '半选', node: <Checkbox label="全部工具" indeterminate />, note: '父级用：部分子项已选' },
      { label: '带说明', node: <Checkbox label="自动批准" description="跳过只读工具的人工确认。" defaultChecked /> },
      { label: '聚焦', node: <Checkbox label="允许读取工作区" className={css.forceRing} /> },
      { label: '禁用', node: <Checkbox label="允许写入" disabled defaultChecked /> },
    ],
    props: [
      { name: 'label', type: 'string', default: '必填', desc: '主标签，整行可点。' },
      { name: 'description', type: 'string', default: '—', desc: '次要说明，换行在标签下方。' },
      { name: 'checked / defaultChecked', type: 'boolean', default: 'false', desc: '受控或非受控。' },
      { name: 'indeterminate', type: 'boolean', default: 'false', desc: '半选视觉；只在未勾选时生效。' },
      { name: 'onChange', type: '(checked: boolean) => void', default: '—', desc: '回调，直接给布尔而不是事件。' },
      { name: 'disabled', type: 'boolean', default: 'false', desc: '禁用并退出 Tab 序。' },
    ],
    keyboard: [
      { keys: 'Tab', action: '在一组复选框间逐个移动（原生行为）' },
      { keys: 'Space', action: '切换' },
    ],
    notes: [
      '原生 input 用 `opacity: 0` 绝对定位铺满方块，视觉由 span 画：这样读屏、表单提交、`:checked` 与键盘行为都与浏览器一致。',
      'indeterminate 必须通过 DOM 属性设置（React 没有对应 prop），否则读屏报的是「未选」。',
    ],
    sample: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Checkbox label="允许读取工作区" defaultChecked />
        <Checkbox label="允许写入文件" />
        <Checkbox label="全部工具" indeterminate />
      </div>
    ),
  },
  {
    id: 'Radio',
    name: 'Radio',
    group: 'input',
    icon: 'dot',
    summary: '一组里选一个，且选项少到可以全部平铺。方向键在组内移动由浏览器提供。',
    use: ['2–5 个互斥选项且都值得展示（思考档位、权限级别）。', '默认选中项有合理值、用户很少改的配置。'],
    avoid: ['超过 6 个选项：用 Select 省空间，或 CommandPalette 支持搜索。', '需要取消选择（「以上都不是」）：raddio 一旦选中无法点掉，用 Checkbox 组。'],
    states: [
      { label: '未选', node: <Radio name="demo-r1" label="只读" /> },
      { label: '已选', node: <Radio name="demo-r2" label="可写" defaultChecked /> },
      { label: '带说明', node: <Radio name="demo-r3" label="完全访问" description="包括运行命令与安装依赖。" defaultChecked /> },
      { label: '聚焦', node: <Radio name="demo-r4" label="只读" className={css.forceRing} /> },
      { label: '禁用', node: <Radio name="demo-r5" label="沙箱" disabled /> },
    ],
    props: [
      { name: 'label', type: 'string', default: '必填', desc: '主标签。' },
      { name: 'name', type: 'string', default: '—', desc: '同名校验互斥；同组必须一致。' },
      { name: 'description', type: 'string', default: '—', desc: '次要说明。' },
      { name: 'checked / defaultChecked', type: 'boolean', default: 'false', desc: '受控或非受控。' },
      { name: 'onChange', type: '(checked: boolean) => void', default: '—', desc: '回调。' },
      { name: 'disabled', type: 'boolean', default: 'false', desc: '禁用。' },
    ],
    keyboard: [
      { keys: 'Tab', action: '进入组时落在已选项；组内只有一项在 Tab 序里' },
      { keys: '↑ / ↓ / ← / →', action: '在组内移动并立即选中（原生行为）' },
      { keys: 'Space', action: '选中当前项' },
    ],
    notes: [
      '同一组必须共享 `name`：否则方向键不会移动、读屏也不会报「1/3」。这是最常见的误用。',
      '每组建议包一层 `<fieldset>` + `<legend>` 给组名；只用视觉分隔不够。',
    ],
    sample: (
      <div style={{ display: 'flex', gap: 16 }}>
        <Radio name="perm" label="只读" />
        <Radio name="perm" label="可写" defaultChecked />
        <Radio name="perm" label="完全访问" />
      </div>
    ),
  },
  {
    id: 'Switch',
    name: 'Switch',
    group: 'input',
    icon: 'panelRight',
    summary: '立即生效的二态设置。与 Checkbox 的区别是「改了马上算数」，所以不该出现在需要点保存的表单里。',
    use: ['设置页里即时生效的开关（折叠侧栏、显示时间戳、自动批准）。'],
    avoid: ['需要「提交」才生效的表单字段：用 Checkbox。', '互斥多态（浅色/深色/跟随系统）：用 SegmentedControl。'],
    states: [
      { label: '关', node: <Switch label="显示时间戳" /> },
      { label: '开', node: <Switch label="显示时间戳" defaultChecked /> },
      { label: '带文字', node: <Switch label="自动批准只读工具" defaultChecked showLabel /> },
      { label: '聚焦', node: <Switch label="显示时间戳" className={css.forceRing} /> },
      { label: '禁用', node: <Switch label="显示时间戳" disabled defaultChecked /> },
    ],
    props: [
      { name: 'label', type: 'string', default: '必填', desc: '无障碍名；showLabel 时同时显示在右侧。' },
      { name: 'checked / defaultChecked', type: 'boolean', default: 'false', desc: '受控或非受控。' },
      { name: 'onChange', type: '(checked: boolean) => void', default: '—', desc: '回调。' },
      { name: 'showLabel', type: 'boolean', default: 'false', desc: '是否在轨道右侧显示文字。' },
      { name: 'disabled', type: 'boolean', default: 'false', desc: '禁用。' },
    ],
    keyboard: [
      { keys: 'Tab', action: '进出' },
      { keys: 'Space', action: '切换' },
    ],
    notes: [
      '用 `<input type="checkbox" role="switch">`：原生点击与表单行为免费拿到，`role=switch` 让读屏报「开/关」而不是「选中/未选」。',
      '开关不做异步操作的进度条。点了要等 3 秒才动的开关应该改成「按钮 + 加载态」，否则用户会连点。',
    ],
    sample: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Switch label="显示时间戳" defaultChecked showLabel />
        <Switch label="自动批准只读工具" showLabel />
      </div>
    ),
  },
]
