# 架构与规划

本文回答三个问题：进程怎么分、每个文件干什么、接下来做什么。
术语见 [GLOSSARY.md](../GLOSSARY.md)，决策背景见 [adr/](adr/)，未完成项见 [BACKLOG.md](BACKLOG.md)。

---

## 1. 四层结构

```
┌──────────────────────────────────────────────────────────────────┐
│ 渲染层 Renderer  (React 19 + Tailwind 4, 无 Node 权限)            │
│                                                                  │
│   App.tsx ──── store/ ──── interactions/  ← 交互语义在这里        │
│      │            │              │                                │
│      │            │  AgentCommand →                                │
│   components/     │  ← AgentEvent │                                │
└──────┼────────────┼──────────────┼────────────────────────────────┘
       │            │              │
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
│   AgentSession ── 事件订阅 ── 消息增量搬运 ── uiContext 通用桥      │
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
  → store.prompt(text)（store/index.ts 的动作）
  → preload → ipcMain 'agent:command' → host.postMessage({type:'prompt'})
  → agent-host: session.prompt(text)
  → pi 事件流 message_start / message_update / message_end
  → agent-host 只做 upsert（key = timestamp），60ms 合并一次
  → send({type:'messages', delta: MessageDelta})   ← 只推变了的消息
  → main 转发 → preload → store/engine.ts dispatch → store/blocks.ts applyMessages
  → store/timeline.ts 派生成 Turn/Block（形状由 agent-design/blocks 定；未变的消息产出同引用块）
  → 只有变化的那个回合壳（Turn）与块（useEngine(s => s.byId[id])）重渲染，ChatView 贴底
```

**增量而非全量**：`MessageDelta` 带 `items`（变了的消息，整条）、可选 `order`（顺序变了才带）。
宿主按引用比对（upsert 时浅拷贝换引用）。渲染层把消息增量落进 `msgs`，再全量派生成 Block，
派生按消息引用 memo，所以未变的行保持引用不变、列表面板一次都不重渲染。见 ADR-0013 / 0014。

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
 ├─ package.json              scripts: dev / build / start / release / typecheck；packageManager 固定 pnpm
 ├─ AGENTS.md                 硬约束（preload CJS、sandbox 不可关、禁止 npm install 装依赖）
  ├─ pnpm-workspace.yaml       workspace 成员（agent-design）+ catalog 版本源 + nodeLinker=hoisted
  ├─ pnpm-lock.yaml            唯一锁文件（已删除 package-lock.json）
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
 │                            · 事件订阅 → 消息 upsert + 增量推送（ADR-0014，不组装块）
 │                            · uiContext 通用桥（pending Map + liveTools 栈）
 │                            · 会话列表 / 模型列表 / 快照 / 打开历史会话（entry 直通）
 │
 ├─ src/preload/
 │   ├─ index.ts              contextBridge 暴露 window.pi = { window.*, agent.* }
 │   └─ index.d.ts            PiApi 类型 + global Window 声明
 │
 └─ src/renderer/
     ├─ index.html
     └─ src/
        ├─ main.tsx            createRoot（之前显式 startEngine 挂 IPC 订阅）
        ├─ App.tsx            路由（start / chat / gallery）+ 布局 + ChatView 自动贴底
        ├─ store/             引擎状态的唯一入口（ADR-0013）
        │  ├─ state.ts        EngineState 形状 + zustand 实例 + send
        │  ├─ blocks.ts       MessageDelta → msgs{order,byId}，再派生成块
        │  ├─ timeline.ts     消息 → Turn/Block（形状来自 agent-design/blocks；tool 配对、diff 并工具行）
        │  ├─ interaction.ts  ui 槽位、问卷回填、toast 计时
        │  ├─ engine.ts       宿主事件 dispatch + startEngine + HMR 退订
        │  └─ index.ts        动作层：组件只从这里 import
        ├─ perf.ts            dev-only 渲染计数（window.__piPerf）
        ├─ useScrollRail.ts   滚动条贴到右边缘才露出滑块（WebKit 没有轨道 hover）
        ├─ drafts.ts          输入框草稿 store（按会话键，仅内存）
        ├─ interactions/      交互适配器：questionsOf / multiReply / selectReply / registry
        ├─ previewTurns.ts    组件预览的静态回合夹具（不进运行时路径）
        ├─ util.ts            进行中思考的一行摘要（分组头用）
        ├─ styles/global.css  Tailwind 4 @theme 别名（指向 agent-design 的 --pi-*）；业务用的 pi-card/pi-panel/pi-page/pi-input（Markdown 排版归对话块库）
        └─ components/
            ├─ base/               主仓残留的基础组件（ADR-0012）
            │  ├─ MarkdownView.tsx react-markdown + gfm，围栏代码转 agent-design 的 CodeBlock
            │  └─ PiLogo.tsx       三色 logo + 描边水印
            ├─ （基础组件本体在 agent-design/src/components/，经 agent-design/components 引入：
            │  Button / Menu / Dropdown / ListRow / Tip / Toasts / Marquee / Shimmer / CodeBlock / icons，
            │  CSS Modules，令牌来自 agent-design/src/styles/tokens.css）
            └─ business/           业务组件（知道 pi，由基础组件组合，不写控件外观）
               ├─ TitleBar.tsx     无框拖拽条 + 窗口按钮 + 品牌/收起按钮（浮动工具条在 App）
               ├─ Sidebar.tsx      268px 侧栏：导航、任务列表(搜索/排序)、项目分组
               ├─ Projects.tsx     项目页：从会话扫描派生的项目表 + 软移除/恢复/真删
               ├─ StartPage.tsx    起始页：水印 + 问候 + 大输入卡 + 建议胶囊
               ├─ Composer.tsx     WorkspaceBar / InputCard / ChatComposer / 模型弹窗
               ├─ transcript/      会话正文薄壳：Transcript（1 秒时钟 + 折叠 scope + Markdown 注入）
               ├─ MessageActions.tsx 回合结束后的动作条（复制/赞踩/分享/导出）
               ├─ AskCard.tsx      问卷卡片：翻页、单选/多选、自定义输入、忽略/继续/提交
               ├─ UiPrompt.tsx     裸 UI 请求的原生弹窗（confirm/select/input/editor）
               └─ Preview.tsx      组件预览（#gallery）+ 令牌面板
```

`docs/`：`adr/` 决策记录 · `BACKLOG.md` 未完成项（按模块分级）· `screenshots/` 视觉基线。

---

## 4. 状态归属

| 状态 | 存在哪 | 谁写 | 谁读 |
|---|---|---|---|
| 会话历史 / 模型列表 / 快照 | 宿主 | pi 事件 | 渲染层 store（只读副本） |
| 正文回合 `turns` + 块 `byId` | 渲染层 store（从消息增量派生） | `applyMessages` 调 `deriveBlocks` | `Transcript` 只读 `turns`，每个回合的块按 `blockIds` 逐块订阅 `byId[id]` |
| `answerText` / `liveTurnId` | 渲染层 store（派生缓存） | `blocks.ts` 应用增量时顺带算 | `AnswerActions` / `Transcript` |
| 问卷答案 / UI 槽位 | `store/interaction.ts` 的 `slots` | 用户提交 | `flushSlot` |
| 路由、侧栏折叠、下拉开关 | 渲染层组件 state | 用户 | 各自组件 |
| pi 会话文件 | `~/.pi/agent/sessions/*.jsonl` | pi | `openSession` 时读 |

渲染层**没有**任何写回宿主的业务状态：所有变更都是命令，宿主是唯一事实源。

---

## 5. 规划

### 已完成

- **阶段一** 纯 UI 壳 + 设计稿对齐（8 个 Block、无框外观、侧栏、输入卡、模型弹窗；正文块后来由 `agent-design/blocks` 接管，ADR-0018）
- **阶段二** 真引擎接入：宿主会话、会话列表、模型/思考强度切换、流式渲染、turn 折叠、历史会话打开
- **阶段二补** 扩展 UI 通用桥 + 交互适配器分层（ADR 0004），四种原语实测通过
- **阶段三前半** 正文增量（`BlockDelta`）+ 按 id 订阅的 zustand store（ADR 0013）；`/` 斜杠命令、`@` 文件提及、会话重命名/删除、图片发送

### 下一阶段：先止血（1–2 天）

1. `AgentEvent` 加版本号，宿主与渲染层版本错配时明确报错而不是静默失败。
2. 长会话虚拟滚动（未装任何虚拟化库；先量 700 块打开耗时再定，ADR-0011 的目标是 < 400ms）

### 阶段三：长会话与命令（约一周）

5. ~~Block 增量同步~~ → 已完成（`BlockDelta` + `TurnDelta`，ADR-0013）。
6. ~~斜杠命令 `/`~~ → 已完成。
7. ~~`@` 文件提及~~ → 已完成。
8. 会话管理：重命名、删除、搜索（当前搜索是 `prompt()` 弹窗过滤，排序项也不生效）。
9. 图片发送（协议 `prompt` 加 `images`）、`bashExecution` 消息映射、`read` 结果映射成 file 块。

### 阶段四：打包与分发（约一周）

10. `electron-builder` 出 Windows 安装包；`asar` 里 pi SDK 的 `.node` 与 `node-pty` 必须
    `asarUnpack`（spike 已验证 utilityProcess 内可 spawn）。
11. 单实例锁~~（已加）~~。
12. 宿主崩溃自动重启 + 会话恢复（现在只发一条 error）。
13. 自动更新与崩溃上报（未评估）。

### 阶段五：产品化（方向待确认）

14. 设置页：模型凭据、默认工作目录、主题、快捷键。
15. 插件市场：读 `~/.pi/agent/settings.json` 的 packages，展示/启用/禁用扩展 —— 现在导航有入口但无功能。
16. 多工作区：起始页 `+` 目前无 handler；需要 workspace 概念贯穿侧栏与会话归属。
17. 会话内搜索与「跳到上一条提问」；长会话虚拟滚动（`@tanstack/react-virtual` **未安装**，需要时自己加）。

### 明确不做

- 多平台（用户已定：仅 Windows）。
- 终端面板（v1 明确不接）。
- 单元测试框架（v1 明确不写 vitest；关键路径用 `PI_SHOT` 截图链路做端到端验证）。
