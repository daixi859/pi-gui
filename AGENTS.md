# Pi — 桌面客户端

Electron + React 的 pi agent 图形界面。**只做壳**：所有 agent 能力来自 `@earendil-works/pi-coding-agent`，本项目不实现模型调用、工具、会话存储。

## 命令

```bash
pnpm run dev        # 开发（先确认没在跑：Get-Process electron | Stop-Process -Force）
pnpm run typecheck  # 三端类型检查，改完必跑
```

包管理器是 **pnpm**（根 `package.json` 的 `packageManager` 固定版本），不要用 `npm install` / `npx`，否则会生成 `package-lock.json` 或破坏扁平布局。

## 工作区（pnpm workspace）

- 根目录就是 Electron 应用 `pi`，同时是 workspace 的一员。
- 子项目列在 `pnpm-workspace.yaml` 的 `packages` 中：`agent-design/`。各自有独立 `package.json`。
- 共享依赖版本只在 `pnpm-workspace.yaml` 的 `catalog:` 里写一次，子包用 `"catalog:"` 引用。升级依赖只改这一处。
- 子包命令用 `--filter`：`pnpm --filter agent-design build`。
- `pnpm-workspace.yaml` 里 `nodeLinker: hoisted` 不能删：`scripts/pack.mjs` 依赖扁平的 `node_modules` 原样拷贝生产依赖。
- 安装脚本白名单在 `allowBuilds`（electron、protobufjs、@google/genai）。新增带安装脚本的依赖要同步加入。

有测试脚本的只有 `agent-design`（`pnpm --filter agent-design check` 跑 reducer 校验，`lint` 用 oxlint）。根目录无测试、无 lint。

项目有 git 仓库（根目录 `.git`）。改文件仍要精确替换，改完跑 `pnpm run typecheck`。

## 进程模型

```
渲染层 (React)  ──window.pi.agent.*──▶  preload  ──IPC──▶  主进程  ──parentPort──▶  agent-host (utilityProcess)
```

- `src/main/agent-host.ts` 是**唯一 import pi SDK 的地方**，跑在 utilityProcess 里。主进程只转发消息。
- 契约全在 `src/shared/`：`ipc.ts`（AgentCommand / AgentEvent）、`blocks.ts`（渲染用的 Block 联合类型）。改协议先改这里，三端同时编译。
- 渲染层不得直接用 Node API（`sandbox: true` + `contextIsolation: true`，preload 必须 CJS）。

## 关键约定

- **消息直通**（ADR-0014）：正文传输是 pi 的 `AgentMessage`（`messages` 事件带 `MessageDelta`，key = timestamp）。宿主只搬运不加工；`Block` 是渲染层 `store/timeline.ts` 从消息派生的视图模型，transcript 组件继续只认 Block。
- **消息增量**：只推变了的消息（同 key 引用变了才发），顺序没变不带 `order`。流式中的 toolCall 参数未解析完，渲染层画 pending；工具参数在 ui 请求认领时从消息里查（那时所属消息必已 end）。
- **宿主不懂扩展**：`agent-host.ts` 不能出现任何具体扩展/工具名。扩展的 UI 请求统一变成 `uiRequest` 事件，由渲染层 `interactions/` 里的适配器解释（见 `docs/adr/0004-interaction-layer.md`）。新增交互 = 加一个适配器，不改宿主。
- **pi 的 `bindExtensions({ uiContext, mode: 'rpc' })`** 是扩展 UI 的入口，`mode: 'rpc'` 让扩展走 `ui.select/input/confirm` 而不是 TUI 渲染。答案回填必须严格按请求顺序（扩展是逐题 `await` 的）。

## 目录

| 路径 | 作用 |
|---|---|
| `src/shared/` | 跨进程类型契约，无运行时依赖 |
| `src/main/index.ts` | 建窗、IPC 转发、fork agent-host |
| `src/main/agent-host.ts` | pi 会话生命周期、事件→消息增量、会话列表扫描、UI 桥 |
| `src/preload/` | `window.pi` 的唯一出口 |
| `src/renderer/src/store/` | 引擎状态唯一入口（zustand，ADR-0013）：`state.ts` 形状+实例、`blocks.ts` 消息增量、`timeline.ts` 消息→Block 派生、`interaction.ts` UI 请求、`engine.ts` 事件接入、`index.ts` 动作层 |
| `src/renderer/src/interactions/` | 扩展 UI 请求 → 具体控件的适配器 |
| `agent-design/src/components/` | 基础组件（Button、Menu、Dropdown、ListRow、Tip、Toasts 等）：不知道 pi，控件外观唯一书写地，CSS Modules（ADR-0012） |
| `agent-design/src/pages/Components.tsx` | 基础组件预览页（令牌面板、图标、按钮、弹层） |
| `src/renderer/src/components/base/` | 主仓残留的基础组件（PiLogo、MarkdownView） |
| `src/renderer/src/components/business/` | 业务组件：知道 pi，由基础组件组合，不写控件外观 |
| `src/renderer/src/components/business/transcript/` | 会话正文渲染（运行时路径，blocks.tsx 只留给预览页） |
| `docs/ARCHITECTURE.md` | 分层图 + 数据流 + 逐文件职责 |
| `docs/STYLE.md` | 样式规范：令牌、刻度、语义类、新增流程 |
| `docs/BACKLOG.md` | 待办与已证伪的误判，动手前先看 |
| `docs/adr/` | 架构决策记录 |
| `GLOSSARY.md` | 领域术语 |

## 样式

**动手前先读 `docs/STYLE.md`**，那里是完整规范。四条硬规则：

- 只写令牌类名，不写任意值：`bg-panel`、`text-muted`、`text-xs`、`rounded-md`、`p-2`、`shadow-card`；禁止 `text-[13px]`、`bg-[#f0f0f0]`、`shadow-[...]`。
- 业务组件不写控件外观（底色/边框/圆角/阴影/hover 拼控件），控件外观只来自 `components/base/` 或 `pi-` 语义类；布局与文本类自由。详见 ADR-0012。
- 刻度：间距 2/4/8/16、圆角 4/8/16、字号 12/14（正文/标题 14，代码与小字 12），展示字号特例 `text-2xl` 28px 仅用于问候/品牌大字。刻度外的值按「就近、平局偏小」归入；新代码不得引入刻度外的值。
- 重复 3 次以上的类组合提成 `pi-` 语义类（`pi-panel`、`pi-card`、`pi-icon-btn`、`pi-menu`、`pi-menu-item`、`pi-page`、`pi-input`），定义在 `global.css` 的 `@utility`。
- 可访问性底线：可点区域 ≥24px、键盘焦点可见、正文对比 ≥4.5:1；动效尊重 `prefers-reduced-motion`。

令牌调整走 agent-design 的「组件预览」页（`agent-design/src/pages/Components.tsx`）：改动只写运行时变量与 localStorage，「复制为 CSS」后手动贴回 `agent-design/src/styles/tokens.css` 的 `:root`。图标全是手绘 SVG，在 `agent-design/src/components/icons.tsx`，不接受 `size` prop，用 `className="size-4"`。业务组件的预览仍在主仓 `components/business/Preview.tsx`。

`agent-design` 内的组件不使用 Tailwind，只用 CSS Modules 与 `--pi-*` 令牌。

## 调试

主进程支持 `PI_SHOT=<png路径>` + `PI_SHOT_JS=<页面脚本>`（或 `PI_SHOT_JS_FILE=<脚本路径>`，脚本返回值会打到 stdout）+ `PI_SHOT_AT=<触发ms>` + `PI_SHOT_DELAY=<截图前ms>`，用于无头截图验证。改代码后重启 dev（热更新对 main/host 不生效）。

**临时文件统一放项目根的 `tmp/`**（已被 `.gitignore` 忽略，可整体删除）：运行日志 `tmp/log/`、dev 输出 `tmp/dev.log`、临时截图与探针脚本。只有文档要引用的截图才进 `docs/screenshots/`。

**原则上用户可以直接查看的不用启动无头浏览器截图验证**：改完跑 `pnpm run typecheck`，然后直接向用户确认效果即可。涉及 JS 复杂行为、用户无法判断的或跨进程改动时才需要启动验证。
