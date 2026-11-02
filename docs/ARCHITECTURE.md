# 架构与规划

本文回答三个问题：进程怎么分、每个文件干什么、接下来做什么。
术语见 [GLOSSARY.md](../GLOSSARY.md)，决策背景见 [adr/](adr/)，未完成项见 [BACKLOG.md](BACKLOG.md)。

---

## 1. 四层结构

```
┌──────────────────────────────────────────────────────────────────┐
│ 渲染层 Renderer  (React 19 + Tailwind 4, 无 Node 权限)            │
│                                                                  │
│   App.tsx ──── useAgent() ──── interactions/  ← 交互语义在这里    │
│      │              │                  │                         │
│      │              │  AgentCommand →  │                         │
│   components/       │  ← AgentEvent    │                         │
└──────┼──────────────┼──────────────────┼─────────────────────────┘
       │              │                  │
       │  window.pi.agent.send / onEvent │  (contextBridge)
┌──────┼──────────────▼──────────────────▼─────────────────────────┐
│ preload (CJS, sandbox) — 只做白名单转发，无业务逻辑                 │
└──────┼──────────────┬────────────────────────────────────────────┘
       │ ipcMain      │ webContents.send
┌──────▼──────────────▼────────────────────────────────────────────┐
│ 主进程 main/index.ts — 建窗、转发、无 pi 依赖                      │
└──────┬───────────────────────────────────────────────────────────┘
       │ utilityProcess.fork + postMessage（无共享内存）
┌──────▼───────────────────────────────────────────────────────────┐
│ 引擎宿主 agent-host.ts — 唯一加载 pi SDK 的进程                    │
│   AgentSession ── 事件订阅 ── Block 组装 ── uiContext 通用桥        │
└──────┬───────────────────────────────────────────────────────────┘
       │
   pi SDK 1.4.0  ~/.pi/agent/{sessions,settings.json,extensions}
```

**为什么这样分**

- 渲染层崩溃/重载不影响会话；宿主崩溃可以重启进程而不关窗口（`docs/adr/0001`）。
- `sandbox: true` + `contextIsolation: true` + `nodeIntegration: false` 是硬约束，所以渲染层永远拿不到
  `fs`、`child_process`，pi 也只能在宿主里跑（`AGENTS.md`）。
- 主进程不认识 pi：它只认识 `AgentCommand` / `AgentEvent`。这样换引擎（或同时跑两个）不用改窗口代码。

---

## 2. 数据流

### 2.1 发一轮对话

```
Composer 提交
  → useAgent.prompt(text)
  → preload → ipcMain 'agent:command' → host.postMessage({type:'prompt'})
  → agent-host: session.prompt(text)
  → pi 事件流 message_start / message_update / tool_execution_* / message_end
  → agent-host 组装 Block，60ms 合并一次
  → send({type:'reset', blocks})          ← 每次全量快照，不推增量
  → main 转发 → preload → useAgent setState
  → TranscriptStack 重渲染，ChatView 贴底
```

**全量而非增量**：两层各自维护增量补丁太容易错位。代价是长会话（本机实测 11MB / 约 700 块）
每帧要序列化整棵 Block 树，已列入 BACKLOG P0（万级块时必须切成按 `id` 增量）。

### 2.2 一次扩展 UI 交互（问卷 / 确认框 / 通知）

```
工具开跑 tool_execution_start
  → host: liveTools.push(toolCallId)
  → send({type:'toolStart', name, args})          ← 完整原始入参
  → 渲染层 slots.set(toolCallId, {name, args, reqs:[]})

扩展调 ctx.ui.select(...)   （rpiv 问卷：每道单选一次 select，多选一次 input）
  → host.uiContext.select → ask({kind:'select', ...}) 压进 pending Map
  → send({type:'uiRequest', req:{id, toolCallId, kind, options}})
  → 渲染层：该 toolCallId 有适配器认领 → 挂进 slot.reqs，等用户提交
  → AskCard 提交 → flushSlot 按题号顺序回填
  → send({type:'uiReply', id, reply:{value}})  → host settleUi → resolve Promise
```

关键约束（`docs/adr/0004`）：

- **宿主不理解内容**。它只把 `ui.select/confirm/input/editor/notify` 原样搬运，不认识
  `ask_user_question`，也不拼 rpiv 的 `"1,3; 自定义"` 格式。
- **回答必须按题号顺序**。rpiv 在 `mode:'rpc'` 下是逐题 `await` 的，`flushSlot` 靠 `sent` 游标对齐。
- **没被认领的请求落到 `UiPrompt`**（原生弹窗），保证任何扩展的 `ui.*` 都有响应而不是静默吞掉。
- **notify 是单向的**：立刻回空 `{}` 让 Promise 落地，界面上是 3.5s 的 toast。

### 2.3 会话列表

```
init → SessionManager.listAll()  (~589 个 JSONL 文件)
     → 按 modified 倒序，取前 40 条 / 前 12 个项目
     → project = basename(cwd)，title = name 或 firstMessage 首行去标签截 28 字
     → send({type:'sessions', sessions, projects, models})
```

---

## 3. 目录与文件

```
 PiGui/
 ├─ electron.vite.config.ts   三端构建配置：main 双入口(index / agent-host)、
 │                            preload 强制 CJS、renderer 挂 react+tailwind
 ├─ tsconfig.json             项目引用：node 与 web 两套
 ├─ tsconfig.node.json        main + preload + shared。TS7 无 baseUrl，paths 必须写 "./src/..."
 ├─ tsconfig.web.json         renderer + shared + preload/index.d.ts
 ├─ package.json              scripts: dev / build / start / typecheck
 ├─ AGENTS.md                 硬约束（preload CJS、sandbox 不可关、npm install 会损坏原生模块）
 ├─ GLOSSARY.md               术语表：只定义语言，不记实现
 │
 ├─ src/shared/               ← 两端共享，零运行时依赖
 │   ├─ blocks.ts             Block 八种 kind 的联合类型 + SessionMeta/ProjectMeta/Snapshot
 │   └─ ipc.ts                AgentCommand / AgentEvent / UiRequest / UiReply / ModelOption
 │
 ├─ src/main/
 │   ├─ index.ts              建无框窗口、fork 引擎宿主、双向转发、窗口控制 IPC、
 │   │                        PI_SHOT 调试截图钩子
 │   └─ agent-host.ts         引擎宿主（最大文件）：持有 AgentSession，
 │                            · 事件订阅 → Block 组装（turn 折叠、diff 解析）
 │                            · uiContext 通用桥（pending Map + liveTools 栈）
 │                            · 会话列表 / 模型列表 / 快照 / 打开历史会话
 │
 ├─ src/preload/
 │   ├─ index.ts              contextBridge 暴露 window.pi = { window.*, agent.* }
 │   └─ index.d.ts            PiApi 类型 + global Window 声明
 │
 └─ src/renderer/
     ├─ index.html
     └─ src/
        ├─ main.tsx            createRoot
        ├─ App.tsx            路由（start / chat / gallery）+ 布局 + ChatView 自动贴底
        ├─ useAgent.ts        引擎状态唯一入口：发命令、收事件、ui 槽位与回填
        ├─ interactions/      交互适配器：questionsOf / multiReply / selectReply / registry
        ├─ mock.ts            画廊样本数据（仅 Gallery 使用，不参与运行时）
        ├─ util.ts            formatDuration
        ├─ styles/global.css  Tailwind 4 @theme 色板/字体/圆角 + .md 排版 + 流式光标
        └─ components/
            ├─ TitleBar.tsx        无框拖拽条 + 窗口按钮 + 收起态布局
            ├─ Sidebar.tsx         268px 侧栏：导航、任务列表(搜索/排序)、项目分组
            ├─ StartPage.tsx       起始页：水印 + 问候 + 大输入卡 + 建议胶囊
            ├─ Composer.tsx        WorkspaceBar / InputCard / ChatComposer / 模型弹窗
            ├─ blocks.tsx          Block 分派：User/Assistant/Thinking/Tool/File/Turn/System
            ├─ MarkdownView.tsx    react-markdown + gfm，围栏代码转 CodeBlock
            ├─ CodeBlock.tsx       shiki 懒加载高亮（15 种语言，双主题 CSS 变量）
            ├─ DiffBlock.tsx       文件变更折叠行 + 行号着色
            ├─ AskCard.tsx         问卷卡片：翻页、单选/多选、自定义输入、忽略/继续/提交
            ├─ UiPrompt.tsx        裸 UI 请求的原生弹窗（confirm/select/input/editor）
            ├─ Toasts.tsx          扩展 notify 的右下角提示
            ├─ Menu.tsx            公共下拉：遮罩 + 面板 + 条目 + 分组标题
            ├─ Gallery.tsx         组件画廊（#gallery）
            ├─ PiLogo.tsx          三色 logo + 描边水印
            └─ icons.tsx           自绘 SVG 图标集
```

`docs/`：`adr/` 决策记录 · `BACKLOG.md` 未完成项（按模块分级）· `screenshots/` 视觉基线。

---

## 4. 状态归属

| 状态 | 存在哪 | 谁写 | 谁读 |
|---|---|---|---|
| 会话历史 / 模型列表 / 快照 | 宿主 | pi 事件 | 渲染层（只读副本） |
| 当前 Block 树 | 宿主组装，渲染层持有副本 | `reset` 覆盖整棵 | TranscriptStack |
| 问卷答案 / UI 槽位 | 渲染层 `slots` ref | 用户提交 | `flushSlot` |
| 路由、侧栏折叠、下拉开关 | 渲染层组件 state | 用户 | 各自组件 |
| pi 会话文件 | `~/.pi/agent/sessions/*.jsonl` | pi | `openSession` 时读 |

渲染层**没有**任何写回宿主的业务状态：所有变更都是命令，宿主是唯一事实源。

---

## 5. 规划

### 已完成

- **阶段一** 纯 UI 壳 + 设计稿对齐（8 个 Block、无框外观、侧栏、输入卡、模型弹窗、画廊）
- **阶段二** 真引擎接入：宿主会话、会话列表、模型/思考强度切换、流式渲染、turn 折叠、历史会话打开
- **阶段二补** 扩展 UI 通用桥 + 交互适配器分层（ADR 0004），四种原语实测通过

### 下一阶段：先止血（1–2 天）

1. `git init` + 首次提交 —— 无版本控制已付过一次代价（`agent-host.ts` 被写坏只能从构建产物还原）。
2. `newSession` 不立刻建空会话文件（当前侧栏总出现空标题条目）。
3. `openSession` 加加载态（打开 11MB 会话静默卡几秒）。
4. `AgentEvent` 加版本号，宿主与渲染层版本错配时明确报错而不是静默失败。

### 阶段三：长会话与命令（约一周）

5. Block 增量同步（`reset` → `blockUpsert` / `blockRemove`），万级块不卡。
6. 斜杠命令 `/`：现在 `/xxx` 被当普通文本发给模型（已实测），需要本地命令面板 + 转发到 pi 的
   `commandContext`。
7. `@` 文件提及：输入 `@` 弹文件补全，选中后把路径塞进 prompt 或作为附件。
8. 会话管理：重命名、删除、搜索（当前搜索是 `prompt()` 弹窗过滤，排序项也不生效）。
9. 图片发送（协议 `prompt` 加 `images`）、`bashExecution` 消息映射、`read` 结果映射成 file 块。

### 阶段四：打包与分发（约一周）

10. `electron-builder` 出 Windows 安装包；`asar` 里 pi SDK 的 `.node` 与 `node-pty` 必须
    `asarUnpack`（spike 已验证 utilityProcess 内可 spawn）。
11. 单实例锁（现在双击图标会开两个窗口、两个宿主抢同一批会话文件）。
12. 宿主崩溃自动重启 + 会话恢复；`app.requestSingleInstanceLock` 后二次启动聚焦已有窗口。
13. 自动更新与崩溃上报（未评估）。

### 阶段五：产品化（方向待确认）

14. 设置页：模型凭据、默认工作目录、主题、快捷键。
15. 插件市场：读 `~/.pi/agent/settings.json` 的 packages，展示/启用/禁用扩展 —— 现在导航有入口但无功能。
16. 多工作区：起始页 `+` 目前无 handler；需要 workspace 概念贯穿侧栏与会话归属。
17. 会话内搜索与「跳到上一条提问」；长会话虚拟滚动（`@tanstack/react-virtual` 已在依赖里但未用）。

### 明确不做

- 多平台（用户已定：仅 Windows）。
- 终端面板（v1 明确不接）。
- 单元测试框架（v1 明确不写 vitest；关键路径用 `PI_SHOT` 截图链路做端到端验证）。
