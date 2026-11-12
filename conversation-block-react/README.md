# 会话块 · pi 事件流 → 对话块复刻

把 pi 的 JSON 事件流（`pi --mode json` / 会话 `.jsonl`）归约成与 DeepSeek harness 同构的三层对话块（总行 → 分组 → 行），并用同一套块组件做两件事：

- **回放**：按事件时间轴播放真实会话，含思考、工具行、失败重试、中断、子调用、超长输出，以及「工具 / 思考 / 标准文本」交替出现的回合；过程按 assistant 文本切成可独立开合的分组。
- **状态画廊**：纯 props 渲染每种终态，不经过事件流，用来单独调块的样子。

样式 token、图标 sprite、`DisclosureRow` / `TextShimmer` / `StateDot` / 鲸鱼指示器均从 harness 搬来，块组件的 props 形状也贴着 harness 的 `ToolRowState` / `AgentChatData`，方便之后整体搬回宿主。

## 运行

```bash
npm install
npm run dev          # http://localhost:5173
```

Vite 8 默认只监听 `localhost`（`::1`），用 `http://localhost:5173` 访问；`127.0.0.1` 会拒绝连接。

```bash
npm run fixtures     # 从真实会话重新生成 public/fixtures/*.json
npm run check        # 只跑 reducer，打印每份夹具的块统计与落定校验
npm run shots        # Playwright 截图 + 横向溢出/耗时/播放态断言（需 dev server）
npm run build
```

`shots` 用全局安装的 Playwright（`npm root -g` 下找 `playwright`），输出到 `screenshots/`：

| 文件 | 场景 |
| --- | --- |
| `player-mid.png` | 1280 浅色，回放中（live 回合、思考流式、工具运行） |
| `player-end.png` | 跳末尾，过程收起 + 答案常显 |
| `player-expanded.png` | 展开过程块 |
| `player-error.png` | 失败与重试夹具（错误行默认展开） |
| `player-expanded.png` | 展开总行：分组标题按类别汇总，文本常显 |
| `player-group.png` | 展开一个分组：组体限高内滚，行距 4px |
| `player-interleaved.png` | 「穿插汇报」回合：分组与进度文本交替 |
| `player-thinking.png` | 长思考流式中：展开思考体贴底，看得到最新几行 |
| `player-changes.png` | 回合尾部的文件改动卡（路径 + 增删行数） |
| `player-live-groups.png` | live 回合：前面的分组是完成态，只有尾部组显示「正在…」 |
| `player-group-open.png` | 穿插回合里展开一个含工具的分组 |
| `player-debug.png` | 底部调试抽屉（最近事件 + 归约统计） |
| `gallery.png` / `gallery-dark-700.png` | 状态画廊，浅色 1280 / 深色 700 |
| `gallery-mixed.png` | 画廊里的穿插回合卡（默认展开） |
| `player-700.png` / `player-700-light.png` | 窄屏深色 / 浅色 |

## 目录

```
scripts/
  build-fixtures.mjs   # 会话 jsonl → 夹具（裁剪事件、压输出、补 dt/durationMs）
  fixtures.config.json # 每份夹具的源文件与行区间
  check-reducer.mjs    # 无 DOM 归约校验
  shoot.mjs            # Playwright 截图与断言
src/
  reducer/             # PiEvent 类型 + 纯 reducer（状态机）
  blocks/              # 三层：turn（总行）/ ProcessGroup（分组）/ thinking、tool、assistant、system 行
  primitives/          # 搬来的 DisclosureRow / TextShimmer / StateDot
  icons/               # 图标 artwork + sprite 注入
  lib/                 # 回放时钟、主题、折叠、格式化
  pages/               # Player（回放 + 调试） / Gallery（状态画廊）
  styles/              # harness token（design-platform/base）+ 应用层 app.css
public/fixtures/       # 7 份夹具 + index.json
```

## 数据流

```
.jsonl ──build-fixtures──▶ { id, events: [{ dt, ev }] } ──fetch──▶ useReplay ──▶ reduce(state, ev, t) ──▶ blocks
```

reducer 是纯函数：`reduce(state, event, at)`，第三个参数是事件发生时刻。回放用夹具里累计的 `dt`，实时接入时默认 `Date.now()`；思考段与工具行的耗时因此来自真实时间差，而不是事件里可缺省的 `durationMs`。

ID 约定：

- 回合 `turn:<n>`，user 块与回合同步创建；同一 user 的 `message_start/end` 不重复建块。
- 思考/文本块 `think|text:<msgTs>:<contentIndex>`，`msgTs` 取该条 assistant 消息开始时的回放时刻。
- 工具块 `tool:<callId>`，`callIndex` 从 callId 反查块 id；`toolcall_delta` 先累积原始 JSON，`toolcall_end` 再落参数。
- `agent_settled` 把未完成的工具标 `stopped`、流式文本标 `interrupted`，并给 live 回合补 `endedAt`。

## 渲染决策

- **三层结构**：总行（耗时/状态）→ 分组（assistant 文本之间的思考/工具）→ 行。折叠总行只隐藏分组，所有 assistant 文本（包括中途汇报）常显；最终答案只是 `final` 的那一段。
- **总行**：全宽 33px、底部分隔线，只显示「已完成，用时 X」或「已停止」；时长数字等宽 tabular，可折叠时才出现 chevron。右侧不再放工具数/失败数。live 期间不渲染；尾部是鲸鱼 +「深度求索中，用时 X」，文字前后各一条 16px 短线，时间按回放时钟走，暂停即冻结。
- **分组**：24px 整行按钮，图标按组内次数最多的类别选，悬停/展开时淡出成 chevron，运行中整行扫光。收起标题按次数取前 3 类、无计数：`已读取文件` / `已读取文件并搜索代码`（第二项去掉共用「已」）/ `执行了命令，已读取文件，已搜索代码等`（超过 3 类加「等」）；整组没有工具时显示「已完成分析」。live 时只有**最后一个分组**显示「正在读取文件 · 路径 / 正在运行命令 · 命令」；被文本切开的前序分组已经完成，按类别摘要展示，不再全部显示「正在分析请求」。
- **分组容器**：展开后标题底部 8px，组内行距 4px；组体 `max-height: min(400px, 50vh)` 内滚，触顶/触底各有 24px 渐隐，滚动条 6px。运行中的组展开时自动贴底，读者上滚后停止跟随；落定后从顶部开始读。分组成员按原顺序，`codemode` 有子调用时只按子调用类别计数。开合状态按夹具 id 隔离。
- **思考行**：默认收起，和 harness 一致。运行中标题是「思考」，摘要取最新「已完成段落」的首行并扫光；落定后显示「已思考 · X 秒」+ 首行摘要。手动展开后正文超过 168px 会自动贴底（顶部渐隐），读者上滚停止跟随。整行可点，图标只是装饰。
- **工具行**：整行点击开合（右侧时长/状态不参与），默认一律收起，包括失败和修改；`preparing/running` 用文字跑马灯（深黑高光（暗色主题为浅色高光）扫过标题与摘要，`--app-shimmer`，1.15s 线性循环），不再显示 loading 圆圈；`ok/error/stopped` 保留状态圆点；失败行展开后红显；`edit/write` 完成态在时长旁显示 `+N −M`；diff 行号进 gutter，`+/-` 只留标记列。body 头部的状态文案（退出码/中断）不参与压缩，避免被长命令挤成竖排。
- **长输出**：超过 24 行只渲染头部，按钮展开全部；单条工具结果在夹具阶段截到 16k 字符。
- **答案与穿插**：pi 在每次工具调用前都会带一段 assistant text（`stopReason: toolUse`）。所有文本按事件顺序切分过程：文本前、两段文本之间、最后一段文本到结尾各成一组；只有最后一段标 `final`。折叠总行后仍能读完整的汇报节奏，展开后每组可单独看细节。`interleaved` 夹具取自真实会话（9 段中途文本 → 10 个分组）。
- **回合尾改动**：落定后从本轮成功的 `edit/write` 块汇总改动文件，单文件显示「已编辑 文件名」，多文件列出路径与增删行数（超过 4 行折叠）；`write` 没有 diff 时用写入内容行数近似新增，同一回合里被命令删除的临时文件不计入。
- **主题**：跟随系统 / 浅色 / 深色，记在 localStorage；浅色与深色的主按钮、用户气泡、diff 前景色、跑马灯高光各有一组 `--app-*` token（harness 的 `brand-primary-invert` 在两种主题下同色，直接用会黑底黑字/白底白字）。

## 已知取舍

- 工具名到 variant 的映射是白名单（grep/glob、read/ls、powershell/bash/cmd、write、edit、codemode），未收录的显示原名 + 原始参数。
- 行内代码/代码块用 `<pre>` + 等宽字体，没有接 shiki；diff 也没有做语法高亮，只做行级着色。
- 夹具里的 `dt` 是按会话时间戳重建的回放节奏，不是模型真实 token 间隔；`aborted` 为控制体积截断过事件并注入了 `agent_settled(aborted)`。
- 画廊里的展示块是手写常量（`NOW` 固定），修改块形状时需同步 `Gallery.tsx`。
- pi 的 `agent-summary` custom 条目没有进夹具；分组与标题都从 block 顺序现算，保证与回放看到的内容一致。
