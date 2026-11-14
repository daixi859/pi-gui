# agent-design · 对话块组件库 + 回放验收场

> **这个包只有一个实现。** `src/blocks/` 是 PiGui 对话正文的**唯一实现**，作为生产依赖被 `import { TurnView } from 'agent-design/blocks'` 引入（ADR-0018）。包内其余部分是它的验收场：把 pi 的 JSON 事件流归约成块，按时间轴回放真实会话，不经过 PiGui 的宿主与 store。
>
> 改块 = 改 PiGui 的主界面。改动后跑 `pnpm run typecheck`（仓库根），并在回放页与 PiGui 各看一眼。

## 三层结构

总行（耗时 / 状态）→ 分组（两段 assistant 文本之间的思考与工具）→ 行（思考 / 工具 / 系统）。折叠总行只隐藏分组，assistant 文本永远常显。

| 层 | 组件 | 说明 |
| --- | --- | --- |
| 总行 | `blocks/TurnView.tsx`、`blocks/RunningHead.tsx` | 用户气泡、`已完成，用时 X`、`pi.fold.*` 折叠记忆；live 时由 `RunningHead` 画「正在工作中，用时 X」，尾部是 `RunningStatus` |
| 分组 | `blocks/ProcessGroup.tsx` | 24px 整行按钮，组头按类别汇总，组体限高内滚、运行中贴底 |
| 行 | `blocks/ThinkingRow.tsx` `blocks/ToolRow.tsx` `blocks/SystemRow.tsx` `blocks/AssistantText.tsx` | 每行默认收起，整行可点 |
| 汇总 | `blocks/ChangedFiles.tsx` | 回合尾的文件改动卡，悬停预览 diff |

## 包入口

```ts
import { TurnView, type Turn, type ConversationState } from 'agent-design/blocks'
```

`src/blocks/index.ts` 被导入时会**自己管副作用**：注入 `blocks.css`，调用一次 `installIconSprite()`（幂等、没有 `document` 就跳过）。使用方只需给容器加 `pi-blocks` 类——所有令牌（`--dsw-*` / `--app-*` / 字体 / 字号刻度 / elevation）都重新声明在 `.pi-blocks` 作用域内，不进 `:root`、不碰 `body`。

宿主需要自己提供、由块通过 props 注入的三件事：

- `renderMarkdown(text, streaming)` —— 默认用 `react-markdown` + `remark-gfm`；PiGui 注入自己的 shiki 高亮实现。
- `renderImages(sources)` —— 用户消息里的图片；默认画 `<img className="userImage">`。
- `now` —— live 回合的走表时间。库不自建定时器，PiGui 在正文层挂 1 秒 tick，回放页按回放时钟走、暂停即冻结。

块内文案全部来自 `src/i18n/zh.ts`（随包导出 `zh`），不接收 labels 注入。

## 运行

本项目是 pnpm workspace 的子包（见仓库根 `pnpm-workspace.yaml`），依赖在仓库根统一安装：

```bash
pnpm install                                   # 在仓库根执行，不要在本目录 npm install
pnpm --filter agent-design dev     # http://localhost:5173
```

Vite 8 默认只监听 `localhost`（`::1`），用 `http://localhost:5173` 访问；`127.0.0.1` 会拒绝连接。

```bash
pnpm --filter agent-design fixtures # 从真实会话重新生成 public/fixtures/*.json
pnpm --filter agent-design check    # 只跑 reducer，打印每份夹具的块统计与落定校验
pnpm --filter agent-design shots    # Playwright 截图 + 横向溢出/耗时/播放态断言（需 dev server）
pnpm --filter agent-design build
```

`shots` 用全局安装的 Playwright（`npm root -g` 下找 `playwright`），输出到 `screenshots/`：

| 文件 | 场景 |
| --- | --- |
| `player-mid.png` | 1280 浅色，回放中（live 回合、思考流式、工具运行） |
| `player-end.png` | 跳末尾，过程收起 + 答案常显 |
| `player-expanded.png` | 展开过程块 |
| `player-error.png` | 失败与重试夹具（错误行默认展开） |
| `player-group.png` | 展开一个分组：组体限高内滚，行距 4px |
| `player-interleaved.png` | 「穿插汇报」回合：分组与进度文本交替 |
| `player-thinking.png` | 长思考流式中：展开思考体贴底，看得到最新几行 |
| `player-changes.png` | 回合尾部的文件改动卡（路径 + 增删行数） |
| `player-live-groups.png` | live 回合：前面的分组是完成态，只有尾部组显示「正在…」 |
| `player-group-open.png` | 穿插回合里展开一个含工具的分组 |
| `player-debug.png` | 底部调试抽屉（最近事件 + 归约统计） |
| `player-700.png` | 窄屏 700px：rail 横排、气泡与主按钮对比 |

## 目录

```
scripts/
  build-fixtures.mjs   # 会话 jsonl → 夹具（裁剪事件、压输出、补 dt/durationMs）
  fixtures.config.json # 每份夹具的源文件与行区间
  check-reducer.mjs    # 无 DOM 归约校验
  shoot.mjs            # 回放页的 Playwright 截图与断言
src/
  blocks/              # 对话块：TurnView / ProcessGroup / 行组件（包入口 agent-design/blocks）
                       #   + index.ts（桶）、tools.ts（工具元数据四表合一）、blocks.css（令牌 + 样式）
  primitives/          # 块的内脏：DisclosureRow / TextShimmer / StateDot / HoverPreview
  icons/               # 图标 artwork + sprite 注入（导入 blocks 时自动执行一次）
  i18n/                # 块内文案（唯一文案源，随包导出）
  lib/                 # 回放时钟、折叠记忆、格式化
  styles/              # 回放页外壳样式（app.css）；块样式已搬到 blocks/blocks.css
  pages/               # Player（回放 + 调试抽屉）——块的验收场
  reducer/             # PiEvent 类型 + 纯 reducer（状态机）
public/fixtures/       # 夹具 json + index.json
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

- **总行**：全宽 33px、底部分隔线（整回合唯一的横线）。首条回应成形后才渲染：运行中写「正在工作中，用时 X」，`data-live` 标记、不可点（`RunningHead`）；落定后换成按钮「已完成，用时 X」/「已停止」，可折叠时才出现 chevron。时长数字等宽 tabular。落定耗时用宿主 settled 的墙钟（`stampSettled`）：pi 的消息 timestamp 是首包时刻，用消息 ts 会闪「不到 1 秒」。运行中不足 1 秒只写「正在工作中…」，不报时长。首包未回时总行不渲染，只有 user 气泡 + 末尾鲸鱼；`aborted` 例外，仍显示「已停止」。
- **鲸鱼**：回合末尾一只（`RunningStatus`，无分隔线），文案只说「此刻在干什么」——最后一个运行中分组的 `groupLiveTitle`（如「正在读取文件 · src/a.ts」），正文正在写则「正在回复」，否则「正在分析请求」。耗时归总行，两处不重复。鲸鱼是纯 SVG 描边 + CSS 浮动动画（`running-whale-swim`），不依赖外挂图片；`prefers-reduced-motion: no-preference` 时才动。
- **分组**：24px 整行按钮，图标按组内次数最多的类别选（`blocks/tools.ts` 的 kind），悬停/展开时淡出成 chevron，运行中整行扫光。收起标题按次数取前 3 类、无计数：`已读取文件` / `已读取文件并搜索代码`（第二项去掉共用「已」）/ `执行了命令，已读取文件，已搜索代码等`（超过 3 类加「等」）；整组没有工具时显示「已完成分析」。live 时只有**最后一个分组**显示「正在读取文件 · 路径 / 正在运行命令 · 命令」；被文本切开的前序分组已经完成，按类别摘要展示，不再全部显示「正在分析请求」。
- **分组容器**：展开后标题底部 8px，组内行距 4px；组体 `max-height: min(400px, 50vh)` 内滚，触顶/触底各有 24px 渐隐，滚动条 6px。运行中的组展开时自动贴底，读者上滚后停止跟随；落定后从顶部开始读。分组成员按原顺序，`codemode` 有子调用时只按子调用类别计数。开合状态按 `useFold(scope, key)` 存进 localStorage（`pi.fold.<scope>.<key>`）。
- **思考行**：默认收起。运行中标题是「思考」，摘要取最新「已完成段落」的首行并扫光；落定后显示「已思考 · X 秒」+ 首行摘要。手动展开后正文超过 168px 会自动贴底（顶部渐隐），读者上滚停止跟随。整行可点，图标只是装饰。思考不带档位——档位输入在宿主，块不显示。
- **工具行**：整行点击开合（右侧时长/状态不参与），默认一律收起，包括失败和修改；`preparing/running` 用文字跑马灯（`--app-shimmer`，1.15s 线性循环），不再显示 loading 圆圈；`ok/error/stopped` 保留状态圆点；失败行展开后红显；`edit/write` 完成态在时长旁显示 `+N −M`；diff 行号进 gutter，`+/-` 只留标记列。body 头部的状态文案（退出码/中断）不参与压缩，避免被长命令挤成竖排。
- **长输出**：超过 24 行只渲染头部，按钮展开全部；单条工具结果在夹具阶段截到 16k 字符。
- **答案与穿插**：pi 在每次工具调用前都会带一段 assistant text（`stopReason: toolUse`）。所有文本按事件顺序切分过程：文本前、两段文本之间、最后一段文本到结尾各成一组；只有最后一段标 `final`。折叠总行后仍能读完整的汇报节奏，展开后每组可单独看细节。`interleaved` 夹具取自真实会话（9 段中途文本 → 10 个分组）。
- **回合尾改动**：落定后从本轮成功的 `edit/write` 块汇总改动文件，单文件显示「已编辑 文件名」，多文件列出路径与增删行数（超过 4 行折叠）；`write` 没有 diff 时用写入内容行数近似新增，同一回合里被命令删除的临时文件不计入。

## 已知取舍

- 工具名到 kind / 动词的映射是白名单（`src/blocks/tools.ts`），后缀规则兜底（`*_inspect` → 检索、`terminal_*` → 命令、`subagent_*` → 子智能体），未收录的显示原名 + 原始参数。
- diff 只做行级着色，没有语法高亮；Markdown 里的代码块由宿主注入的 `renderMarkdown` 决定（PiGui 用 shiki，回放页用纯 `<pre>`）。
- 夹具里的 `dt` 是按会话时间戳重建的回放节奏，不是模型真实 token 间隔；`aborted` 为控制体积截断过事件并注入了 `agent_settled(aborted)`。
- 暗色主题在 PiGui 里尚未接入（宿主还没有深色）；回放页跟随系统，块令牌因此同时给了浅色与深色两组兜底值。
- pi 的 `agent-summary` custom 条目没有进夹具；分组与标题都从 block 顺序现算，保证与回放看到的内容一致。
