# ADR 0004：宿主只做通用 UI 桥，交互语义归渲染层

日期：2026-11-02
状态：已采纳

## 背景

最初把「提问卡片」当成引擎能力实现：`agent-host.ts` 里写死了 `ASK_TOOL = 'ask_user_question'`、
`questionsOf()` 从工具参数里抠问卷、`multiReply()` 拼 rpiv 扩展私有的 `"1,3; 自定义"` 格式，
并按 `entry.cursor++` 依赖 rpiv 逐题串行调用 `ui.select` 的顺序回填。

这个方案能跑通，但它把**一个外挂扩展的私有约定**焊进了宿主。后果有三：
`ask_user_question` 只是用户装的一个 npm 扩展（`@juicesharp/rpiv-ask-user-question`），
pi 核心并不知道它；换一个提问卷的扩展就要改宿主；而真正通用的问题被忽略了——
`ui.confirm` 是 `async () => false`，整机 321 处 `ctx.ui.notify` 全被吞掉，
依赖确认的扩展（pi-rewind 的回滚、子代理的取消）在不报错的情况下拿到错误的答案。

## 决定

把「引擎侧能力」和「UI 语义」拆成四层，宿主只做最底下那层的通用桥：

1. **pi SDK**：会话、工具、事件。
2. **宿主（`src/main/agent-host.ts`）**：把 `ExtensionUIContext` 的
   `select / confirm / input / editor / notify` 一律转成通用 `uiRequest` 事件推给渲染层，
   并把渲染层的 `uiReply` 兑现给等着的 Promise。宿主不知道谁是问卷、谁是确认框。
   `toolStart` 事件额外带上工具的**原始 args**，让渲染层有判断依据。
3. **协议**（`src/shared/ipc.ts`）：`UiRequest` / `UiReply` 描述原语，不含任何扩展知识。
4. **渲染层交互适配器**（`src/renderer/src/interactions/index.ts`）：
   `InteractionAdapter { name, claims(toolName, args), reply(answers) }`。
   `askQuestion` 适配器认领 `ask_user_question`，把结构化问卷渲染成卡片，
   并把答案翻译回扩展期望的 select 文本。没有适配器认领的请求落到 `UiPrompt` 原生弹窗。

三条约束：宿主按 `toolCallId` 建队列且不理解内容；适配器匹配靠 `toolName` 不靠时序；
新增扩展支持 = 注册一个适配器，不改宿主。

## 代价

- `uiRequest` 不带问卷结构，渲染层要自己从 `toolStart` 的 args 里解析，且 args 格式变了要跟着改。
- rpiv 对 `host === 'rpc'` 的问卷拒绝外部答案通道，答案必须走 `ui.select` 回填，
  因此仍要严格按题号顺序兑现，`flushSlot` 的心智负担还在（只是搬到了渲染层）。
- notify 是单向的，渲染层立刻回空 `{}` 让宿主的 Promise 落地，界面侧以 toast 呈现。

## 备选方案

- **自建同名工具**：`customTools` + `excludeTools: ['ask_user_question']`，自己实现 schema 校验
  与 envelope 文本。UI 最自由，但要重写扩展已做好的校验（reserved label、题数、选项数），
  而且扩展一更新就跟不上。否决。
- **保持现状（宿主认领问卷）**：能跑，但把扩展私有格式焊进宿主，且其余 UI 原语继续失效。否决。
