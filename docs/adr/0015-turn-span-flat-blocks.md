# 0015 turn 从嵌套块改为段坐标：块全平铺，折叠全在组件

## 背景

ADR-0014 把视图模型派生收进渲染层后，`timeline.ts` 仍然在派生时把回合组装成嵌套的
turn 块（`children` 持有过程块），并把末尾答案物理提到折叠外（`steps.pop()`）。折叠这一个
纯视图关注点被劈成两半：数据层决定"什么进折叠"，TurnView 决定"收起时显示什么"，
TurnView 的注释要靠跨文件解释（"末尾那段由 timeline.ts 摘成独立的行"）。

调研 deepseek-harness 的同构实现后确认可行路线：它的数据层（事件日志 → 平铺 Node，
`seq` 为 React key）没有任何 turn 嵌套容器；回合折叠呈现是 ui-chat 包通过 declaration
merging 注册的私有派生（`TurnProcessSpec` 只含范围坐标 `processStartSeq`/`answerAnchorSeq`
与统计），折叠与否由每个行座位在渲染时按坐标区间自判，折叠状态在组件 / 视图 store。

## 决策

1. **Block 全平铺**：`turn` 嵌套成员从 Block 联合中删除；`shared/blocks.ts` 的 diff
   kind 只保留给预览库，transcript 派生不再产出独立 diff 块。
2. **diff 并进它的工具行**：diff 本来就从 `toolResult.details.diff` 派生（派生处 100%
   知道归属），直接放进 tool 块的 `diff` 字段。行级订阅后行不知道相邻块，相邻合并逻辑
   （旧 TurnView 里"diff 跟着 edit/write 走"）随之消失。
3. **回合降级为段坐标 `TurnSpan`**（timeline.ts 定义，渲染层私有）：`{ key, userId?, ids,
   durationMs, stepCount, noteCount, toolCount, live, aborted }`——只记范围与统计，等价
   deepseek 的 `TurnProcessSpec`。user 气泡单列 `userId`（渲染在段头之前，与旧实现的
   顶层顺序一致），`ids` 是段头之后的全部块、顺序即渲染顺序；值未变的段复用旧对象
   （含 ids 引用），段容器 memo 才能命中。
4. **折叠全在组件**：Transcript 只订阅 `turns`；TurnSection 按段坐标渲染折叠头
   （统计/时长/状态全来自 span），行（Row/RowView）按 `open` 自判——user 气泡与
   assistant 文本不受折叠影响，其余过程块收起时整行不渲染。"末尾答案提到折叠外"
   不再是数据搬运，只是渲染顺序的自然结果。
5. **store 形状简化**：`order` 与 `liveTurnId` 删除（Transcript 只认 `turns`，
   导出走 `turns.ids`），`answerText` 保留（复制按钮用）。
6. 折叠记忆仍存 localStorage，key 从"第一个子块 id"改为段 key（`t-${user 消息
   timestamp}`，live 到落定不变）；存量记忆失效一次，可接受。

## 否掉的方案

- **照搬 deepseek 的全部机制**（CSS 隐藏不卸载、disclosure 重置代数、四档展示模式）：
  为大型产品设计的复杂度，本项目的条件渲染 + localStorage 足够，体量不对等。
- **组件直接吃 msgs（连块派生也不要）**：ADR-0014 已否——React 需要稳定 key 的视图
  模型，toolCall↔toolResult 配对状态机不该进组件。

## 后果

- 修订 ADR-0013「turn 的 children 保持嵌套，不摊平进 byId」：摊平正是本次决策，
  「turn 是原子渲染单位」让位于「段坐标 + 行级订阅」。ADR-0011 中 TurnBlock.children
  相关叙述同步作废。
- 转录渲染路径：`msgs → deriveBlocks → { turns, byId, answerText } → Transcript
  （段容器）→ Row（按 id 订阅）`。任何一块变化只有那一行重渲染；未变段的容器引用
  稳定，Transcript 不重渲染它们。
- live 段的 `durationMs` 随派生刷新（消息增量持续到达时即走表）；工具静默期无帧到达
  时时停走，与旧实现一致。
- mock 假流（mockTimeline.ts）与预览库同步换段结构；无消费方的 `chatBlocks` 死数据
  顺手删除。
