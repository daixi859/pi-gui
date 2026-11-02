# 0005 问答卡走 uiContext 桥，不自建工具

`ask_user_question` 由扩展 `@juicesharp/rpiv-ask-user-question` 提供，不在 pi 内置工具里。

## 决定

宿主实现 `ExtensionUIContext` 的 `select` / `input`，用 `session.bindExtensions({ uiContext, mode: 'rpc' })` 绑上，让扩展走它的 `runRpcQuestionnaire` 回退路径；再在 `tool_execution_start` 拦下 `ask_user_question`，用工具原始参数把整份问卷一次性推给渲染层。

## 为什么

- 扩展在 `mode === 'rpc'` 且 `hasDialogUI(ui)` 时逐题 `await ui.select()`，不开 `mode: 'rpc'` 它只会回 `no_custom_ui` 让模型改用纯文本提问。
- 回退路径拿到的 `options` 是被压平的 `"1. label — desc"` 字符串，没有 header、题号、multiSelect 语义。光靠它做不出设计稿那种一题一页的卡片。
- 而 `tool_execution_start` 的 `args` 是工具的完整入参（`questions[].header/options[].description` 全在），所以拿这份结构渲染卡片，把用户的选择翻译回 select/input 的字符串回填。
- 不自建同名工具，是为免重写 schema 校验、保留 label 校验、结果 envelope 文本；扩展更新也自动跟进。

## 代价

- 扩展内部 `answer-channel` 对 rpc 宿主拒绝外部注入答案（`unsupported_host`），所以不能用它的事件通道，只能走 uiContext。
- 回填顺序必须严格按 rpiv 的调用顺序（`cursor` 自增），一次多题时不能乱序。
- `ask_user_question` 的参数格式变了就得跟着改 `questionsOf()`。

## 分页按钮

`step < last` 显示「继续」、最后一题显示「提交」，两者都要求当前题已作答（`answered()` 检查 option / selected / custom 任一）。翻页箭头不受作答限制，允许回看。
