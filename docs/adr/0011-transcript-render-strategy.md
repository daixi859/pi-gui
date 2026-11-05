# 0011 对话块渲染重写：两个参考实现的评比与选型

## 背景

现有实现（`components/blocks.tsx` + `MarkdownView.tsx`）能出内容，但增量流式时明显发涩。参考两个成熟实现的做法，先评比再定改法。

- 参考 A：`D:\workspace\github-trending\deepseek-harness`
- 参考 B：`D:\workspace\github-trending\ZCode`

## 一、现状体检（先定位，别猜）

| 事实 | 位置 | 影响 |
|---|---|---|
| 宿主已按 60ms 合帧，且只推变了的块 | `src/main/agent-host.ts:100` `schedule()` | 传输层不是瓶颈，约 16fps，无需再批处理 |
| 渲染层一个 `setState` 换掉整个 state 对象 | `useAgent.ts:197` | 每次增量重渲染 **App 全树**，含侧栏、输入框 |
| `BlockView` 没有 `memo`，`TranscriptStack` 全量 `map` | `blocks.tsx:193,283` | 一个 token 到达 → **全部历史块重渲染** |
| 每个 delta 全文重跑 `ReactMarkdown` | `MarkdownView.tsx:9` | 单条消息累计 O(n²)：1 万字回答 = 上百次全文 parse + 重建 React 树 |
| 流式期间对**每个半截代码串**跑一次 shiki | `CodeBlock.tsx:40-58`，缓存 key 含 `code` 必然 miss | 最贵的一项，且每次 `dangerouslySetInnerHTML` 整块替换 |
| 滚动跟随每次 blocks 变化都读 `scrollHeight` | `App.tsx:170-175` | 每次增量一次强制布局（长会话 5–15ms） |
| 无虚拟化 | — | DOM 随会话线性增长（ADR-0002 提到 ~700 块量级） |

结论：**瓶颈全在渲染层，占 90%；协议层（Block + delta + 60ms）已经是对的形状，不用动。**

## 二、两个参考实现的做法

| 机制 | deepseek-harness | ZCode |
|---|---|---|
| 列表 | **不虚拟化**（只虚拟化右侧导航轨），靠 memo 边界 | **turn 级虚拟化**（`@tanstack/react-virtual`），正在跑的 turn 抽出虚拟层、走普通流 |
| 重渲染粒度 | 每节点一个 observable，`useSyncExternalStore` 按 key 订阅，`order` 不变则列表不动 | 整会话一个 projection store + **浅层结构共享**（row pool / WeakRef），靠引用相等命中 memo |
| markdown | **自建 mdast 增量**：冻结前 N-2 个顶层块，尾巴重解析；冻结段缓存成 React 元素，key 用源偏移 | 交给 `streamdown`，`mode: streaming \| static`；不自己实现增量 |
| 流式批处理 | 客户端 3×rAF（~50ms）合批 | 无客户端合批，靠 CLI 30ms flush |
| 代码高亮 | Shiki 同步核 + **行级增量**（完成行缓存 + grammar state），32 行一组 reconcile；视口内才高亮 | **流式期间完全不高亮**，完成时一次性高亮（可见"落定"跳变） |
| 折叠/懒渲染 | — | 工具卡内容只在展开时 `renderContent()` |
| 度量 | 完整基准套件 + CI 预算（长会话 240 轮、火焰/内存/DOM 预算表） | 文档化的 trace 复盘，无自动化预算 |
| 代价 | 代码量大（增量解析 + 语法状态机 + 基准），要自建 AST→React 渲染器 | 引 `streamdown`；完成时高亮跳变；虚拟化带来高度缓存/锚点复杂度 |

## 三、评比（按 PiGui 的处境配权重）

权重理由：PiGui 是壳，无测试、无 lint，回归只能靠人眼 → **引入风险与代码量必须重**；协议层已够快 → "流式帧成本"是渲染成本，不是传输成本。

| 维度 | 权重 | A deepseek | B ZCode | 说明 |
|---|---|---|---|---|
| 长会话渲染成本 | 25% | 3 | 5 | A 靠 memo 做到"只提交变更节点"，但 DOM 仍是全量；B 真虚拟化 |
| 流式单帧成本 | 25% | 5 | 4 | A 有 mdast 增量 + 行级高亮；B 流式不高亮，够用但收尾有跳变 |
| 引入风险（依赖/回归面） | 20% | 2 | 3 | A 要换掉 `react-markdown` 并自建渲染器；B 只需加一个虚拟化库 |
| 代码量与维护 | 15% | 2 | 3 | A 数千行；B 中 |
| UI 表达力/可塑性 | 15% | 4 | 3 | A 块形态自由；B 的折叠与 live tail 有取舍 |
| **加权** | | **3.30** | **3.75** | |

两个都不能照抄：A 的增量 markdown 依赖自建 AST 渲染器，B 的虚拟化依赖"turn 是原子单位"这一前提。**真正的答案是各取一半，做一套 300 行以内、不引新依赖的最小版**（加权 4.35）。

## 四、决定

按「成本 ↑ / 收益 ↓」分三档，每档可单独上线、单独回滚。

### P0 立即做（约 1 小时，纯渲染层，零风险）

1. `BlockView` 套 `memo`。`useAgent` 的 `cache` 已保证未变块引用不变，这一处就能把"整段历史重渲染"变成"只重渲染流式块"。
2. 流式期间不高亮：`MarkdownView` 把 `streaming` 传给 `CodeBlock`，流式中直接渲染 `<pre>` 纯文本，结束再走 shiki。**这是单点收益最大的一行改动。**
3. 滚动跟随用 `ResizeObserver` 合并（markdown / 高亮 / 图片是异步长高的，没有 blocks 信号），每次回调只读一次 `scrollHeight`。
4. `TurnBlock.children.map` 受 1 的庇护；若宿主每次整块重发 turn 导致 children 数组换引用，把 `memo` 的比较器显式化（按 `id + children.length` 比）。

预期：单帧 commit 从 O(历史) 降到 O(1 个块)。

### P1 视 P0 实测再定（约 150 行，不引新依赖）

**只在 P0 后单帧 p95 仍 > 16ms 时做**：流式消息的「冻结前缀」。
取 `react-markdown` 已带上的 `remark-parse`/`mdast` 做一次 parse，按顶层节点的 `position.end.offset` 切出「已冻结的块」和「尾巴」；冻结块各自交给一个 `memo` 的 `ReactMarkdown`（复用现有 `components` 映射），尾巴每帧重解析。复用 A 的核心思想，但不重写渲染器。
风险点：引用式链接/脚注定义落在冻结边界之后会短暂显示为字面量（A 也接受这个偏差），收尾时全文再 parse 一次自愈。

### P2 只在不做不行时做

turn 级虚拟化，形态照抄 B：**虚拟化已完成的 turn，正在跑的 turn 放在普通流里**（否则正文长高会先撑大虚拟行、下一帧才回填 scrollTop，滚动条来回跳）。前提是 P0/P1 之后确实出现"几百轮会话滚动卡"。先量再决定，别提前上。

明确不做：`@tanstack/react-virtual`（P2 才考虑）、`streamdown`（markdown 只用一套，避免 static/streaming 两套渲染的收尾跳变）、客户端再叠一层 rAF 合批（宿主已 60ms，再叠只增加首字延迟）。

## 五、验收指标

无测试框架，用现有 `PI_SHOT` + `PI_SHOT_JS_FILE` 做一次性体检脚本（不进仓库）：

| 指标 | 采集方式 | 门槛 |
|---|---|---|
| 增量单帧 commit | `PerformanceObserver` longtask + rAF 间隔 p95 | p95 < 16ms，无 > 50ms 长任务 |
| 历史块重渲染数 | 临时在 `BlockView` 里 `console.count` | 流式期间每次增量 = 1 |
| 打开 700 块会话 | `performance.now()` 到首帧绘制 | < 400ms |
| 流式滚动 FPS | rAF 采样 200 帧 | p95 帧间隔 < 20ms |
| DOM 节点数 | `document.querySelectorAll('*').length` | 700 块 < 8k（超过再谈 P2） |

可复现性：需要一段可控的假流。建议在 `agent-host.ts` 加一个 dev-only 的 `PI_FAKE_STREAM=1`（约 20 行，仅在未设置时跳过），按 60ms 往会话里灌固定文本 —— 否则前后对比只能靠"感觉快了"。

## 后果

- P0 不动协议、不动宿主，`npm run typecheck` 即可验证；视觉差异只有"流式代码块不着色、结束才着色"。
- 保留 `react-markdown`，放弃 A 的完整增量方案，接受长回答仍有每次增量的尾巴重解析（尾巴通常 1–2 段，成本可控）。
- 记录一条与 ADR-0002 一致的边界：一旦单会话块数上万，`flushBlocks` 的全量 `order` 与渲染层全量 `map` 都要改，届时 P2 顺带解决。
