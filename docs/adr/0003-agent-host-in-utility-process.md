# 0003 引擎跑在 utilityProcess 里

## 决定

pi SDK 只在 `src/main/agent-host.ts` 里 import，由主进程用 `utilityProcess.fork` 起一个 `pi-agent-host` 子进程。渲染层通过 preload 的 `window.pi.agent` 与主进程 IPC，主进程再转发给宿主。

## 为什么

- pi 启动要 6s、会 spawn 工具（powershell / node-pty）、可能死循环。放在主进程里，一次 OOM 或阻塞就带走窗口。
- SDK 是 ESM-only 且依赖 Node 22 能力，渲染层 sandbox + contextIsolation 下不可能加载它。
- 宿主进程可以独立 kill 重启，窗口和 UI 状态不用跟着重建。

## 代价

- 每层要写透传代码：`shared/ipc.ts` 的类型 → preload → `ipcMain`/`parentPort` → `store/`。
- 宿主内没有 Electron API，文件路径、git 分支都得用 Node 自己读。
- 增量渲染靠宿主自己压帧（60ms 合并一次完整快照），不能指望 React 端 diff。

## 备选与放弃原因

- 主进程内直接建会话：崩溃风险传导到窗口，且阻塞主线程。
- 渲染层 `nodeIntegration`：违反 `AGENTS.md` 硬约束，等于把整个 Node 暴露给页面。
