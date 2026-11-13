/**
 * 令牌清单：规范页的展示数据。
 *
 * 这里**不写颜色值**——只有变量名、层级与用途说明。真实值在页面运行时从
 * `.pi-root` 的计算样式里读，所以规范页显示的永远是当前生效的值，
 * 令牌改了页面自动跟着变，不会出现「文档与实现漂移」。
 */

/** 令牌层级。 */
export type TokenTier = 'primitive' | 'semantic' | 'component'

/** 色彩令牌条目。 */
export interface ColorTokenItem {
  /** CSS 变量名，含 `--pi-` 前缀。 */
  name: string
  /** 用途说明。 */
  usage: string
  /** 用哪个底色背景来测对比度；不测的非文字色留空。 */
  on?: string
  /** 该色用于文字还是边框；决定阈值（4.5 还是 3）。 */
  kind?: 'text' | 'edge' | 'fill'
}

/** 分组的色彩令牌。 */
export interface ColorTokenGroup {
  id: string
  title: string
  note: string
  tier: TokenTier
  items: readonly ColorTokenItem[]
}

/** 中性色阶：全部是 primitive，只在构建语义层时使用。 */
export const NEUTRAL_RAMP = [
  '--pi-n-0',
  '--pi-n-25',
  '--pi-n-50',
  '--pi-n-100',
  '--pi-n-150',
  '--pi-n-200',
  '--pi-n-250',
  '--pi-n-300',
  '--pi-n-400',
  '--pi-n-500',
  '--pi-n-600',
  '--pi-n-700',
  '--pi-n-800',
  '--pi-n-850',
  '--pi-n-900',
  '--pi-n-950',
  '--pi-n-975',
] as const

/** 语义色组。 */
export const COLOR_GROUPS: readonly ColorTokenGroup[] = [
  {
    id: 'surface',
    title: '表面',
    note: 'canvas 是最底层，panel 是其上的工作面，raised 用于浮层。三者之间只差 1 级明度——层次靠描边而不是色差，色差过大会让界面看起来像拼贴。',
    tier: 'semantic',
    items: [
      { name: '--pi-canvas', usage: '应用背景；永远在最下面' },
      { name: '--pi-panel', usage: '内容面板、卡片、输入框底' },
      { name: '--pi-raised', usage: '浮层、对话框、菜单' },
      { name: '--pi-sunken', usage: '输入区、代码块、表头等「凹」面' },
      { name: '--pi-sunken-deep', usage: '凹面里的凹面（嵌套代码块）' },
      { name: '--pi-select', usage: '列表当前项底色（不依赖强调色）' },
      { name: '--pi-hover', usage: '中性悬停蒙层（半透明，可叠在任何表面上）', kind: 'fill' },
      { name: '--pi-press', usage: '按下蒙层，比 hover 深一档', kind: 'fill' },
      { name: '--pi-scrim', usage: '模态遮罩', kind: 'fill' },
    ],
  },
  {
    id: 'text',
    title: '文字',
    note: '四级层次：fg → fg-2 → fg-3 → fg-disabled。前三级都满足 AA 正文 4.5:1；fg-disabled 只用于禁用态，不承载信息，因此不受约束。',
    tier: 'semantic',
    items: [
      { name: '--pi-fg', usage: '正文与标题', on: '--pi-panel', kind: 'text' },
      { name: '--pi-fg-2', usage: '次要文字、标签、说明', on: '--pi-panel', kind: 'text' },
      { name: '--pi-fg-3', usage: '最次要文字：时间戳、占位符、辅助信息', on: '--pi-panel', kind: 'text' },
      { name: '--pi-fg-disabled', usage: '禁用态文字', kind: 'text' },
    ],
  },
  {
    id: 'edge',
    title: '描边',
    note: '三级：subtle 用于同组内分隔（几乎看不见），edge 是常规边界，edge-strong 用于可交互控件的边界（必须 ≥3:1，否则控件边界对低视力用户等于不存在）。',
    tier: 'semantic',
    items: [
      { name: '--pi-edge-subtle', usage: '组内分隔线、表内网格', kind: 'edge' },
      { name: '--pi-edge', usage: '卡片、输入框边界', kind: 'edge' },
      { name: '--pi-edge-strong', usage: '复选/单选/开关、需要被看见的控件边界', on: '--pi-panel', kind: 'edge' },
    ],
  },
  {
    id: 'accent',
    title: '强调色',
    note: '全系统唯一的彩色强调（色相 258）。solid 用于实心按钮底，accent 用于文字与图标——两者是不同明度的两个值，因为「做底」和「做字」的白字对比度要求相反。',
    tier: 'semantic',
    items: [
      { name: '--pi-accent', usage: '链接、被选中的图标、强调文字', on: '--pi-panel', kind: 'text' },
      { name: '--pi-accent-solid', usage: '主按钮底色', kind: 'fill' },
      { name: '--pi-accent-solid-hover', usage: '主按钮悬停', kind: 'fill' },
      { name: '--pi-accent-solid-press', usage: '主按钮按下', kind: 'fill' },
      { name: '--pi-on-accent', usage: '主按钮上的文字', on: '--pi-accent-solid', kind: 'text' },
      { name: '--pi-accent-tint', usage: '选中行、徽标底', kind: 'fill' },
      { name: '--pi-on-accent-tint', usage: 'tint 上的文字', on: '--pi-accent-tint', kind: 'text' },
    ],
  },
  {
    id: 'status',
    title: '状态',
    note: '四种状态各有三件套：实色（图标/文字）、tint（浅底）、on-tint（浅底上的字）。深浅主题不是简单反相——深色主题下状态色要提亮，否则在深底上会「糊」。',
    tier: 'semantic',
    items: [
      { name: '--pi-success', usage: '成功、已完成', on: '--pi-panel', kind: 'text' },
      { name: '--pi-success-tint', usage: '成功提示底', kind: 'fill' },
      { name: '--pi-on-success-tint', usage: '成功提示底上的字', on: '--pi-success-tint', kind: 'text' },
      { name: '--pi-warning', usage: '警告、需要留意', on: '--pi-panel', kind: 'text' },
      { name: '--pi-warning-tint', usage: '警告提示底', kind: 'fill' },
      { name: '--pi-on-warning-tint', usage: '警告提示底上的字', on: '--pi-warning-tint', kind: 'text' },
      { name: '--pi-danger', usage: '错误、破坏性操作', on: '--pi-panel', kind: 'text' },
      { name: '--pi-danger-tint', usage: '错误提示底', kind: 'fill' },
      { name: '--pi-on-danger-tint', usage: '错误提示底上的字', on: '--pi-danger-tint', kind: 'text' },
      { name: '--pi-info', usage: '提示、中性告知', on: '--pi-panel', kind: 'text' },
      { name: '--pi-info-tint', usage: '提示底', kind: 'fill' },
      { name: '--pi-on-info-tint', usage: '提示底上的字', on: '--pi-info-tint', kind: 'text' },
    ],
  },
  {
    id: 'focus',
    title: '焦点与选择',
    note: '焦点环是键盘用户唯一的定位依据，任何情况下都不能被裁掉或降透明度。',
    tier: 'semantic',
    items: [
      { name: '--pi-focus', usage: '焦点环颜色' },
      { name: '--pi-selection', usage: '文本选区底色' },
    ],
  },
] as const

/** 字号阶梯说明。 */
export const TYPE_SCALE = [
  { token: '--pi-fs-11', role: '等宽微标签：令牌名、色值、代码语言标、差异计数', sample: '11px · 微标签' },
  { token: '--pi-fs-12', role: '辅助信息、时间戳、徽标、代码行号', sample: '12px · 辅助信息' },
  { token: '--pi-fs-13', role: '界面主力：按钮、标签、菜单、侧栏', sample: '13px · 界面主力' },
  { token: '--pi-fs-14', role: '正文与长文', sample: '14px · 正文' },
  { token: '--pi-fs-16', role: '区块小标题、对话框标题', sample: '16px · 小标题' },
  { token: '--pi-fs-20', role: '页面区块标题', sample: '20px · 区块标题' },
  { token: '--pi-fs-24', role: '页面主标题', sample: '24px · 主标题' },
  { token: '--pi-fs-28', role: '唯一的大字：起始页问候语', sample: '28px · 展示' },
] as const

/** 间距阶梯说明。 */
export const SPACE_SCALE = [
  { token: '--pi-sp-2', px: 2, usage: '唯一的非 4 倍数档：只做图标与文字之间的光学微调' },
  { token: '--pi-sp-4', px: 4, usage: '紧贴元素之间、菜单项内边距' },
  { token: '--pi-sp-8', px: 8, usage: '控件内边距、同组元素间距' },
  { token: '--pi-sp-12', px: 12, usage: '卡片内边距、表单项之间' },
  { token: '--pi-sp-16', px: 16, usage: '区块内边距、段落之间' },
  { token: '--pi-sp-20', px: 20, usage: '演示外框、窄栏内容之间的呼吸' },
  { token: '--pi-sp-24', px: 24, usage: '页面边距、区块之间' },
  { token: '--pi-sp-32', px: 32, usage: '页面级分栏、起始页大块之间' },
  { token: '--pi-sp-40', px: 40, usage: '章节之间、文档上下留白' },
  { token: '--pi-sp-48', px: 48, usage: '文档左右页边距，最大的留白' },
] as const

/** 圆角阶梯说明。 */
export const RADIUS_SCALE = [
  { token: '--pi-r-4', px: 4, usage: '小控件：复选框、键帽、菜单项、小按钮' },
  { token: '--pi-r-8', px: 8, usage: '主力圆角：按钮、输入框、导航项' },
  { token: '--pi-r-12', px: 12, usage: '卡片、浮层、Toast' },
  { token: '--pi-r-16', px: 16, usage: '对话框' },
  { token: '--pi-r-full', px: 999, usage: '头像、开关、标签、状态点' },
] as const

/** 动效阶梯说明。 */
export const MOTION_SCALE = [
  { token: '--pi-dur-micro', ms: 90, usage: '颜色变化、hover 反馈（低于 100ms 才觉得「跟手」）' },
  { token: '--pi-dur-base', ms: 140, usage: '展开收起、开关滑动' },
  { token: '--pi-dur-enter', ms: 200, usage: '浮层与对话框入场' },
  { token: '--pi-dur-sweep', ms: 1200, usage: '唯一的循环动画：运行指示器扫光' },
] as const

/** 字号对照：每级都用「行高用途」标注。 */
export const LINE_HEIGHT_NOTE = [
  { token: '--pi-lh-tight', value: '1.5', usage: '单行控件内文字' },
  { token: '--pi-lh-ui', value: '1.6', usage: '界面文本（中文在 1.5 下会显得挤，1.6 是中文界面的舒适下限）' },
  { token: '--pi-lh-prose', value: '1.75', usage: '长段落、Markdown 正文' },
] as const
