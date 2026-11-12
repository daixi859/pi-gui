# Pi Web Demo

独立的 Vite + React + Tailwind 4 演示站，用来展示 PiGui 的页面外壳与对话块交互。它复用仓库根目录的依赖，不写入根 `package.json`，也不参与 Electron 构建。

数据来自本机 pi 会话历史，已转成静态 mock；不会真的执行命令或调用模型。

## 运行

在仓库根目录：

```bash
npx vite --config web-demo/vite.config.ts
```

打开 <http://localhost:5179>。端口固定为 5179，避免和 Electron 开发服务器冲突。

校验：

```bash
npx tsc --noEmit -p web-demo/tsconfig.json
npx vite build --config web-demo/vite.config.ts --outDir ../tmp/web-demo-dist
```

## 页面

| 路由 | 内容 |
| --- | --- |
| `#/chat/:id` | 对话：真实 pi 会话、逐块重放、工具块展开 |
| `#/chat/new` | 草稿会话：空状态、建议问题、mock 回复 |
| `#/sessions` | 全部会话：搜索、固定、排序、删除与撤销 |
| `#/approvals` | 工具审批：三张 MCP 决策卡与决议历史 |
| `#/settings` | 外观、模型、思考等级、审批策略、数据重置 |

## 对话块交互

- 数据走 pi 的消息直通形状（ADR-0014）：`sessions.json` 存 pi 的 `AgentMessage`（content 数组原样），块由渲染层 `src/blocks.ts` 现派生——工具状态 = `toolCall` ↔ `toolResult` 按 `toolCallId` 配对，流式 = `stopReason === 'pending'`。
- 「重放这一轮」按 pi 的真实事件顺序驱动（`src/replay.ts`）：`turn_start → message_start → thinking/text/toolcall 增量帧（partial 消息全量帧）→ message_end → tool_execution_start/end（toolResult 消息进入）→ turn_end`。工具参数在增量帧里是空 `arguments` + `partialArgs` 半截文本，`message_end` 才完整——和 pi 一致。重放过程中按 `Esc` 或点「停止重放」可立即显示全量内容。
- 在草稿或任意会话里发送消息，会生成一轮 pi 形状消息（思考、`powershell` 工具调用、工具结果和代码块正文）的 mock 回复，并走同一事件机制自动播放；历史轮次保持静态。
- 助手消息在同一轮内只显示一次 Pi 头部（按消息时间戳分组），避免工具往返造成重复标题。
- 审批卡覆盖 `pending → running → success/error` 三态；决议后可撤销，离开再回来仍保持已决议状态。

## 快捷键

| 键 | 行为 |
| --- | --- |
| `Ctrl/⌘ K` | 打开命令面板（页面、会话、帮助） |
| `Ctrl/⌘ B` | 收起 / 展开侧栏 |
| `/` | 聚焦会话搜索 |
| `?` | 快捷键列表 |
| `Alt + ↑/↓` | 在侧栏内调整会话顺序 |
| `Enter` / `Shift + Enter` | 发送 / 换行 |
| `Esc` | 关闭弹窗、抽屉，或停止重放 |

所有偏好保存在 `pigui-demo.settings.v1`，会话排序和固定状态保存在 `pigui-demo.sessions.v1`。设置页底部可以恢复默认或清除全部演示数据。

## 数据

```bash
node web-demo/scripts/build-sessions.mjs
```

默认扫描 `~/.pi/agent/sessions/--C--Users-DELL--`，最多取 8 个会话，生成 `src/mock/sessions.json`。工具结果会截断到 900 字符以控制体积；思考耗时来自 `compact-thinking-duration` 自定义记录。也可以传入一个目录覆盖默认扫描路径。

> `src/mock/sessions.json` 来自本机真实会话，包含本地路径与对话内容，仅适合本地演示。发布或分享仓库前建议替换成脱敏数据，或不要提交该文件。

## 目录

- `ocu/`：从 [open-claude-ui](https://github.com/Caho1/open-claude-ui) MIT 源码复制的 Claude 设计组件与 `cds-theme.css`。`McpToolDecisionCard` 有两处本地补丁：支持从已决议状态挂载，以及窄屏隐藏英文括注 / 调整决议按钮网格；`ThinkingAccordion`、`CodeBlock`、`ChatMessageBubbles`、`useClaudeScrollPinning` 原样使用。
- `src/`：路由、外壳、四个页面、设置 / Toast / 对话框、重放状态机与 mock 会话转换。
- `scripts/`：pi JSONL → `sessions.json` 的转换脚本。
