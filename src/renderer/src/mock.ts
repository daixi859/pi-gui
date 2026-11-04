import type { Block, ProjectMeta, Snapshot } from '@shared/blocks'

export const snapshot: Snapshot = {
  model: 'GLM-5.3',
  thinkingLevel: '最高',
  cwd: 'ai-berkshire',
  workspace: 'D:\\workspace\\ai-berkshire',
  branch: 'main',
  access: '变更前确认',
  accessFull: false
}

export const projects: ProjectMeta[] = [
  {
    name: 'plmv21',
    sessions: []
  },
  {
    name: 'github-trending',
    sessions: []
  },
  { name: 'pi', sessions: [] },
  { name: 'ai-berkshire', sessions: [] },
  { name: 'inteplm-formdesign…', sessions: [] },
  { name: 'daixi-cli', sessions: [] },
  { name: 'IntePLM-Vue', sessions: [] },
  { name: 'financialreport', sessions: [] }
]

export const recentSessions = [
  { id: 's1', title: '投资团队分析阳光电源', age: '48天', active: true },
  { id: 's2', title: '心脉医疗投资清单分析', age: '61天' },
  { id: 's3', title: '链接.agent的skills到codex-ski', age: '62天' },
  { id: 's4', title: 'pageLayout-form-renderer.js 禁用输入框', age: '47天' },
  { id: 's5', title: '代理编辑input时左右箭头不切换', age: '62天' },
  { id: 's6', title: '解决PLMV20_PATHS重复compon', age: '67天' }
]

const report = `加仓信号：储能毛利率连续两季回升至 32%+；AIDC/SST 实质订单落地；欧盟未跟进限制；净现比维持 >1 重回增长。减仓信号：欧盟本土化立法实质推进；储能中标价二次探底；Q4 再现减值集中计提；2027 年盈利指引下修；高管进一步减持。

### 7. 数据抽检（准出流程）

\`report_audit.py\` 对报告 42 个数据点随机抽取 7 项，从巨潮年报、同花顺、新浪、雪球、证券之星等信息源核验：5 项通过、2 项警告、0 项不通过，判定【准出】。2 个警告均为已标注事项（逆变器份额 55% vs 46.5% 系机构统计口径矛盾，报告正文已如实并列；另一项为抽检表填写口径错误，非报告数据问题）。

### 8. AI 研究局限性声明

- 信息丰富度评级：A 级。团队按 A 级策略执行了反面检验：四份报告分别推翻了"储能＝第二利润曲线""低 PE＝便宜""136 号文毁掉储能""美国禁令致命"四个市场共识，未复述卖方叙事。
- 跨 Agent 冲突已标注：2025 营收 891.84 亿（A 股年报，四源一致，采信）vs 港股招股书 889.14 亿；市值/股价采信工具验算口径（84.40 元，验算偏差 ≤0.04%）。
- 数据不足留白：有息负债明细、存货账龄、AIDC 在手订单金额、曹仁贤夫妇港股 IPO 前套现 18.6 亿（单链条来源，待公告核实）。

---

总结：用周期股的买入纪律去买成长股的故事——85 元以下小仓参与可以，60 元下方才是显著的安全边际；放进观察名单跟踪先行指标，不以龙头信仰重仓。本报告仅供学习研究，不构成投资建议。`

export const chatBlocks: Block[] = [
  {
    kind: 'assistant',
    id: 'a1',
    text: report
  },
  {
    kind: 'file',
    id: 'f1',
    name: '阳光电源投资研究报告_20260914.md',
    meta: '文档 · MD'
  },
  {
    kind: 'diff',
    id: 'd1',
    file: '阳光电源投资研究报告_20260914.md',
    added: 167,
    removed: 0,
    lines: []
  },
  {
    kind: 'turn',
    id: 't1',
    durationMs: 12300,
    children: [
      {
        kind: 'thinking',
        id: 'th1',
        level: '最高',
        text: '先确认报告周期与数据源口径：\n1. 2025 年报与港股招股书的营收差异需要并列标注\n2. 抽检脚本 report_audit.py 的样本量是否足够\n3. 结论部分要区分"小仓参与"与"安全边际"两个不同门槛'
      },
      {
        kind: 'assistant',
        id: 'a2',
        text: '我先读一下现有草稿与核验脚本，再补数据抽检章节。'
      },
      { kind: 'tool', id: 'tl1', name: 'read', args: '阳光电源投资研究报告_20260914.md', state: 'done', output: '# 阳光电源投资研究报告\n\n## 1. 结论先行\n…' },
      { kind: 'tool', id: 'tl2', name: 'bash', args: 'python report_audit.py --sample 7', state: 'done', output: '抽检 7 项：5 通过 / 2 警告 / 0 不通过' },
      { kind: 'tool', id: 'tl3', name: 'grep', args: '营收 891.84', state: 'done', output: '2025 营收 891.84 亿（A 股年报）' },
      { kind: 'system', id: 'sy1', tone: 'info', text: '上下文已压缩：12.4k → 3.1k tokens' }
    ]
  },
  {
    kind: 'system',
    id: 'sy2',
    tone: 'warn',
    text: '操作已中断'
  }
]

export const gallerySections = [
  { id: 'user', label: '用户消息' },
  { id: 'assistant', label: 'assistant · markdown' },
  { id: 'thinking', label: 'thinking 折叠 / 展开' },
  { id: 'tool', label: 'tool running / done / error' },
  { id: 'diff', label: 'diff 折叠 / 展开' },
  { id: 'file', label: '文件卡' },
  { id: 'turn', label: 'turn 折叠' },
  { id: 'system', label: 'system 提示' }
] as const

export type GallerySection = (typeof gallerySections)[number]['id']

export const galleryBlocks: Record<GallerySection, Block[]> = {
  user: [{ kind: 'user', id: 'g-u1', text: '修复登录页在 Safari 下的布局错位' }],
  assistant: [
    { kind: 'assistant', id: 'g-a1', text: report },
    {
      kind: 'assistant',
      id: 'g-a2',
      streaming: true,
      text: '我正在检查 `auth.ts` 的类型定义，稍等'
    }
  ],
  thinking: [
    { kind: 'thinking', id: 'g-t1', level: '最高', text: '考虑三个方向：\n1. 缓存失效策略\n2. 并发写入的锁粒度\n3. 回滚路径' },
    { kind: 'thinking', id: 'g-t2', level: '最高', streaming: true, text: '先看下 session 存储的实现……' }
  ],
  tool: [
    { kind: 'tool', id: 'g-tl1', name: 'read', args: 'src/auth.ts', state: 'running' },
    { kind: 'tool', id: 'g-tl2', name: 'read', args: 'src/auth.ts', state: 'done', output: 'export async function login() { … }' },
    { kind: 'tool', id: 'g-tl3', name: 'bash', args: 'npm test -- auth', state: 'error', output: 'FAIL src/auth.test.ts\n  ● login rejects empty password' }
  ],
  diff: [
    { kind: 'diff', id: 'g-d1', file: 'src/auth.ts', added: 3, removed: 1, lines: [] },
    {
      kind: 'diff',
      id: 'g-d2',
      file: 'src/auth.ts',
      added: 3,
      removed: 1,
      lines: [
        { type: 'ctx', no: 42, text: 'const token = getToken()' },
        { type: 'del', no: 43, text: 'const user =  await login(email)' },
        { type: 'add', no: 43, text: 'const user = await login(email, pwd)' },
        { type: 'add', no: 44, text: 'track("login", { id: user.id })' },
        { type: 'ctx', no: 45, text: 'return user' }
      ]
    }
  ],
  file: [{ kind: 'file', id: 'g-f1', name: 'report_20260914.md', meta: '文档 · MD' }],
  turn: [
    {
      kind: 'turn',
      id: 'g-tu1',
      durationMs: 12300,
      aborted: true,
      children: [
        { kind: 'thinking', id: 'g-tu1-th', text: '需要先读 auth.ts' },
        { kind: 'tool', id: 'g-tu1-tl', name: 'read', args: 'src/auth.ts', state: 'done' }
      ]
    }
  ],
  system: [
    { kind: 'system', id: 'g-s1', tone: 'info', text: '上下文已压缩：12.4k → 3.1k tokens' },
    { kind: 'system', id: 'g-s2', tone: 'warn', text: '操作已中断' },
    { kind: 'system', id: 'g-s3', tone: 'error', text: '缺少 API key：请先在设置中配置' }
  ]
}
