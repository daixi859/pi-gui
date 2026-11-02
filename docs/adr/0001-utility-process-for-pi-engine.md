# 0001 用 utilityProcess 隔离 pi 引擎

## 背景

pi 核心要在客户端里跑：建会话、流式产出、执行工具，其中包含 node-pty 这类原生模块。渲染层必须保持 `contextIsolation: true` 与 `sandbox: true`，不能直接 require 原生模块。

## 决定

pi 引擎跑在 Electron `utilityProcess` 里，主进程只做转发；渲染层 ↔ 主进程用 IPC，主进程 ↔ 引擎用 `MessagePort`。

## 备选

- **主进程内直接跑**：最省事，但引擎崩溃或原生模块出错会带走整个窗口，且主进程会被工具调用阻塞。
- **独立子进程 fork**：可用，但拿不到 Electron 的调试与生命周期管理，退出清理要自己写。
- **渲染层直接跑**：与 sandbox 冲突，且违反 AGENTS 硬约束。

## 后果

- 多一层消息编解码，所有引擎事件必须先经过 `src/shared/ipc.ts` 的类型定义。
- 引擎崩溃可被观测、可重启，不影响窗口。
- 打包时必须把引擎及其依赖作为 unpacked 资源，不能塞进 asar（原生模块限制）。
