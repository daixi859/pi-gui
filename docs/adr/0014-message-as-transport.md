# 0014 正文传输改认 pi 消息：AgentMessage 直通，视图模型全部渲染层派生

## 背景

宿主维护着两份「pi → UI」映射：实时走 `onEvent` / `syncMessage`（事件流），历史走
`blocksFromEntries`（`getEntries()` 的 entry 流），出口才是 Block。两份映射已经漂移
（历史缺 diff 卡、缺 streaming 标记、custom entry 被丢弃），pi 每加一个字段两边都要跟。

调研 pi TUI 源码与真机日志（`log/2026-11-09_*.log`）后确认的事实：

| 事实 | 出处 |
|---|---|
| pi 自己的归一化层是 `AgentMessage`：TUI 的历史重建与实时事件最终进同一个 `addMessageToChat(message)` | `interactive-mode.js:3112/3219/2788` |
| `sessionEntryToContextMessages` / `buildContextEntries` 是 SDK 公开导出，entry→message 由 pi 官方保证 | `pi-coding-agent/dist/index.d.ts:21` |
| 消息级 key 可用 `timestamp`（start → end → 落盘全程不变，user/assistant/toolResult 都有） | 日志实测 |
| 内容项 key 可用 `contentIndex`；轮边界 = user 消息；tool 状态 = toolCall ↔ toolResult 按 `toolCallId` 配对（toolResult 也走 message_start/end 事件流） | 日志实测 |

## 决策

1. **传输协议换成 pi 的 `AgentMessage`**。`AgentEvent.blocks`（`BlockDelta`）替换为消息级增量
   `{ order: timestamp[], items: AgentMessage[], full? }`；`src/shared/ipc.ts` 用 `import type`
   引 pi-ai 的类型（编译期擦除，不破「零运行时依赖」）。
2. **历史直通**：`getEntries() → sessionEntryToContextMessages() → 消息增量`，
   `blocksFromEntries` 整体删除。
3. **视图模型全部渲染层派生，不进协议**：
   - turn 折叠 / 展开 / 时长 = 组件内部状态 + 消息 timestamp 计算，切走丢失不管；
   - tool running = 尚无配对 toolResult；error = `isError`；diff 卡 = `toolResult.details.diff` 派生（历史 diff 卡顺带修好）；
     （file 卡已取消：read 的路径在工具行显示，不另派生块）；
   - streaming 光标 = `stopReason === 'pending'`；aborted = 轮末 assistant 的 `stopReason`。
4. **宿主保留的职责**：60ms 合并 `message_update` 全量帧为增量；`uiRequest` / `uiReply` 原样；
   `toolStart` 事件删除（完整 `arguments` 本来就在消息里）。
5. **update 帧原样转发整条 partial 消息，宿主不做内容过滤**：渲染层把 `arguments` 为空 /
   带 `partialArgs` 的 toolCall 画成 pending 行（name 从 `toolcall_start` 起可得），`message_end`
   时 `arguments` 才完整（日志实测：一次工具调用的参数拆成 ~23 个 delta 帧到达，中间帧都是
   `arguments: {}` + `partialArgs` 半截文本）。宿主过滤 thinking/text 属于理解内容，违反分层，
   不做。性能上界是大参数工具的 `partialArgs` 每帧全量重发（~500KB/s 瞬时），IPC 扛得住；
   适配器读参数的时序不变：工具执行在 message_end 之后，参数永远完整
   （shortcut: 若实测 IPC 成为瓶颈，只剥 `partialArgs` 一个字段即可，不用按类型过滤）。

## 否掉的方案

- **照搬 pi TUI（无 UI 中间结构，直接建组件）**：TUI 是全量重绘模型，`requestRender` 整屏重画
  无成本；React 按 id 复用列表，必须有一层带稳定 key 的模型。不是不要模型，是把模型从宿主
  （Block）移到渲染层（消息 / 内容项）。
- **保持现状，只抽共享函数**：两份映射仍然存在，pi 加字段仍要两处跟，漂移只是变慢。

## 后果

- ADR-0002「渲染层只认 Block」修订为「渲染层只认 AgentMessage」；Block 降为组件预览 / mock
  专用。ADR-0013 的 `{order, byId}` 形状平移到消息级，`TurnDelta` 优化由内容项级 delta 接班。
- AGENTS.md、ARCHITECTURE.md、GLOSSARY.md 在实施合入时同步改。
- 行为变化：非落盘的瞬时事件不再有位置——`auto_retry` 提示丢弃（历史本来也没有），
  `compaction_end` 造一条合成 system 消息。
- 一次切换，无双轨：项目未发布，无兼容负担。
- key 方案依赖「同一轮消息 timestamp 互异且递增」；当前 sequential 工具模式下成立，
  若未来恢复并行子 agent，需换消息级 id（shortcut: 并行会话回来时要重开 key 设计）。
