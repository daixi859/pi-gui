# Pi — 桌面客户端

Electron + React 的 pi agent 图形界面。**只做壳**：所有 agent 能力来自 `@earendil-works/pi-coding-agent`，本项目不实现模型调用、工具、会话存储。

## 命令

```bash
npm run dev        # 开发（先确认没在跑：Get-Process electron | Stop-Process -Force）
npm run typecheck  # 三端类型检查，改完必跑
```

无测试、无 lint、无 git。**没有版本控制**，改文件要精确替换并跑 `npm run typecheck`。

## 进程模型

```
渲染层 (React)  ──window.pi.agent.*──▶  preload  ──IPC──▶  主进程  ──parentPort──▶  agent-host (utilityProcess)
```

- `src/main/agent-host.ts` 是**唯一 import pi SDK 的地方**，跑在 utilityProcess 里。主进程只转发消息。
- 契约全在 `src/shared/`：`ipc.ts`（AgentCommand / AgentEvent）、`blocks.ts`（渲染用的 Block 联合类型）。改协议先改这里，三端同时编译。
- 渲染层不得直接用 Node API（`sandbox: true` + `contextIsolation: true`，preload 必须 CJS）。

## 关键约定

- **块优先**：所有内容表示成 `Block`（`user|assistant|thinking|tool|diff|file|turn|system`），渲染层只认 Block，不认 pi 的 `AgentMessage`。转换在 `agent-host.ts` 的 `syncMessage` / `blocksFromEntries`。
- **块增量**：`blocks` 事件带 `BlockDelta { full?, order, items }`，只推变了的块；原地修改的块要 `bump(id)` 否则推不出去。渲染层 `useAgent` 按 id 缓存、未变的块保持引用不变。
- **宿主不懂扩展**：`agent-host.ts` 不能出现任何具体扩展/工具名。扩展的 UI 请求统一变成 `uiRequest` 事件，由渲染层 `interactions/` 里的适配器解释（见 `docs/adr/0004-interaction-layer.md`）。新增交互 = 加一个适配器，不改宿主。
- **pi 的 `bindExtensions({ uiContext, mode: 'rpc' })`** 是扩展 UI 的入口，`mode: 'rpc'` 让扩展走 `ui.select/input/confirm` 而不是 TUI 渲染。答案回填必须严格按请求顺序（扩展是逐题 `await` 的）。

## 目录

| 路径 | 作用 |
|---|---|
| `src/shared/` | 跨进程类型契约，无运行时依赖 |
| `src/main/index.ts` | 建窗、IPC 转发、fork agent-host |
| `src/main/agent-host.ts` | pi 会话生命周期、事件→Block、会话列表扫描、UI 桥 |
| `src/preload/` | `window.pi` 的唯一出口 |
| `src/renderer/src/useAgent.ts` | 引擎状态唯一入口，view 只读它 |
| `src/renderer/src/interactions/` | 扩展 UI 请求 → 具体控件的适配器 |
| `src/renderer/src/components/` | 纯展示组件，props 驱动 |
| `src/renderer/src/components/transcript/` | 会话正文渲染（运行时路径，blocks.tsx 只留给预览页） |
| `docs/ARCHITECTURE.md` | 分层图 + 数据流 + 逐文件职责 |
| `docs/STYLE.md` | 样式规范：令牌、刻度、语义类、新增流程 |
| `docs/BACKLOG.md` | 待办与已证伪的误判，动手前先看 |
| `docs/adr/` | 架构决策记录 |
| `GLOSSARY.md` | 领域术语 |

## 样式

**动手前先读 `docs/STYLE.md`**，那里是完整规范。四条硬规则：

- 只写令牌类名，不写任意值：`bg-panel`、`text-muted`、`text-xs`、`rounded-md`、`p-2`、`shadow-card`；禁止 `text-[13px]`、`bg-[#f0f0f0]`、`shadow-[...]`。
- 刻度：间距 2/4/8/16、圆角 4/8/16、字号 12/14（正文/标题 14，代码与小字 12），展示字号特例 `text-2xl` 28px 仅用于问候/品牌大字。刻度外的值按「就近、平局偏小」归入；新代码不得引入刻度外的值。
- 重复 3 次以上的类组合提成 `pi-` 语义类（`pi-panel`、`pi-card`、`pi-icon-btn`、`pi-menu`、`pi-menu-item`、`pi-page`、`pi-input`、`pi-btn`），定义在 `global.css` 的 `@utility`。
- 可访问性底线：可点区域 ≥28px、键盘焦点可见、正文对比 ≥4.5:1；动效尊重 `prefers-reduced-motion`。

令牌调整走「组件预览」页（`components/Preview.tsx`）：改动只写运行时变量与 localStorage，「复制为 CSS」后手动贴回 `@theme`。图标全是手绘 SVG，在 `components/icons.tsx`，不接受 `size` prop，用 `className="size-4"`。

## 调试

主进程支持 `PI_SHOT=<png路径>` + `PI_SHOT_JS=<页面脚本>`（或 `PI_SHOT_JS_FILE=<脚本路径>`，脚本返回值会打到 stdout）+ `PI_SHOT_AT=<触发ms>` + `PI_SHOT_DELAY=<截图前ms>`，用于无头截图验证。改代码后重启 dev（热更新对 main/host 不生效）。

**原则上用户可以直接查看的不用启动无头浏览器截图验证**：改完跑 `npm run typecheck`，然后直接向用户确认效果即可。涉及 JS 复杂行为、用户无法判断的或跨进程改动时才需要启动验证。
