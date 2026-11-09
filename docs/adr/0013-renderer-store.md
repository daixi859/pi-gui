# 0013 渲染层状态：单 zustand store + 按 id 订阅正文块

## 背景

ADR-0011 把正文渲染从「整棵 `setState`」改成了「每个块 memo」，但那个 memo 只在**子组件**上，
根上还是一个问题：`useAgent` 用一个 `useState` 持有整个 `AgentState`，每次 IPC 增量都换掉整个对象，
**App 整棵树重渲染**（16 次/秒）。实测派生值更贵：

| 事实 | 位置 | 影响 |
|---|---|---|
| 每次增量换整个 state 对象 | `useAgent.ts`（已删） | App 全树重渲染，含侧栏、输入卡 |
| 侧栏 `filter().sort()` 写在渲染体、无 `useMemo` | `Sidebar.tsx:186-196`（旧） | 630 条会话 × 16fps 的 `O(n log n)` |
| `SessionRow` 未 memo、`unread.includes()` 每行 O(m) | `Sidebar.tsx:435`（旧） | 每帧几百次闭包与查找 |
| `lastText` / `toMarkdown` 在渲染体内跑 | `App.tsx:101`、`App.tsx:249`（旧） | 每帧复制数组 + 序列化全篇 markdown |

## 决策

### 1. 用 zustand，单 store 多 slice，不拆多个 store

`src/renderer/src/store/` 五个文件，按职责分层而不是按 store 分：

| 文件 | 职责 |
|---|---|
| `state.ts` | 状态形状 `EngineState` + `create` 实例 + `engine {get,set,update}` + `send` |
| `blocks.ts` | 正文切片：`BlockDelta` → `{order, byId}`，顺带维护 `answerText` / `liveTurnId` |
| `interaction.ts` | 交互切片：ui 槽位、问卷答案按题号回填、toast 计时 |
| `engine.ts` | 宿主事件入口 `dispatch` + `startEngine` + HMR 退订 |
| `index.ts` | 动作层，组件只从这里 import |

`state.ts` 单独一层是为了**打断循环引用**：其他四个文件只依赖它，彼此之间没有 import 环。

不拆多个 store 的理由：一个事件常常同时改两类状态——`settled` 同时改 `streaming` 与 `unread`，
`blocks` 同时改 `byId` 与 `viewPath`。拆成两个 store 会丢原子性，React 18 的自动批处理只对同一个
store 的连续 `set` 保证一次提交。

### 2. 正文块按 id 存，不存数组

```ts
order: string[]                 // 只增删时换引用
byId: Record<string, Block>     // 增量时展开复制，只改那一个键
```

列表组件只订阅 `order`，行组件 `Row = memo(({id}) => useEngine(s => s.byId[id]))` 各自订阅自己那一块。
于是：**流式期间列表一次都不重渲染，只有正在变的那一行重渲染**。

- 否掉的方案 B（数组 + 下标订阅）：`t-live` 落定后会换 id（`settleRound`），下标会漂。
- 否掉的方案 C（保持数组，靠 memo 浅比较）：`map` 仍要每次 O(n) 建元素，且数组引用每次必变。

turn 的 `children` 保持嵌套，不摊平进 `byId`：`TurnView` 订阅整个 turn。理由见 ADR-0011
「turn 是原子渲染单位」，而且 `Step` 已经 memo，展开时真正渲染的只有最后一块。

### 3. 订阅在模块级，不在组件 effect 里（A′）

`startEngine()` 由 `main.tsx` 在 `initTokens()` 之后、`createRoot()` 之前显式调用：

- 首帧之前就挂上 `ipcRenderer.on`，不会漏掉「刚启动就到达的事件」；
- 不受 `StrictMode` 双调 effect 影响（开发时不会双订阅、事件不会被 dispatch 两次）；
- 没写进 `useEffect`，就不会出现「依赖数组一变就重订阅，旧闭包累积」的问题——`dispatch` 是纯模块函数，
  不存在需要捕获的值。

代价是「import 即有副作用」的诱惑，所以明确：`startEngine` 只能由 `main.tsx` 调，store 内部不自动执行；
`engine.ts` 里写了 `import.meta.hot.dispose` 退订，改一次文件不会叠出第二个监听。

### 4. 派生值进 store，不写进渲染体

- `answerText`：应用 `BlockDelta` 时顺带从 `byId` 里取最后一条 assistant 文本。复制按钮直接读。
- `toMarkdown(blocksOf())`：只在**点导出/分享时**拼，不进渲染路径。
- 侧栏 `visible` / `grouped` / `unreadSet`：`useMemo`，依赖是 `sessions` / `projects` / `unread` 的引用——
  流式期间这些引用不变，一次都不跑。
- 不选「用 selector 算派生值」：selector 在每次 `set` 时对每个活跃订阅者求值，16fps × 700 行更贵。

### 5. 宿主侧顺带优化：turn 增量（`TurnDelta`）

原来 turn 只要 `durationMs` 变了整块重发，`children` 少则十几条，每 60ms 一次。
现在 `flushBlocks` 对 turn 尝试 `turnDelta(next, prev)`：只有「子块按 id 一一对应（含末尾追加）」
才增量，`items` 只带变了的子块，`order` 只在长度变化时带。渲染层 `applyTurn` 按 id 合并。
不满足条件（重排、换 id）返回 `null`，调用方退回整块，协议上永远有一个安全的兜底。

同时 `BlockDelta.order` 改成「顺序没变就不带」：渲染层沿用旧数组引用，列表本身不重渲染。

## 后果

- `useAgent.ts` 删除（约 400 行）。组件从 `./store` 直接 import 动作与 `useEngine`。
- 组件的 props 大面积收缩：`Sidebar` 从 12 个 prop 降到 7 个，`Projects` 从 4 个降到 1 个，
  `ComposerCard` / `ChatComposer` 只剩 `{scope, onSubmit}`——数据自己订阅。
- 组件里多了一条纪律：**订阅字段要窄**。在根组件订阅 `sessions` 就等于回到旧模型。
- 新增 `src/renderer/src/perf.ts`（dev-only）：组件渲染体里 `count('sidebar')`，
  控制台读 `window.__piPerf.renders`。验收口径见 BACKLOG。
- `blocks.tsx` 的 `MessageActions` 抽成独立文件（`components/business/MessageActions.tsx`），
  新增 `full?: () => string`，导出时才拼完整 markdown。
