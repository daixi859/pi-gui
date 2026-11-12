# 待办清单（按模块）

统计时间：2026-11-02。状态标记：**P0** 会卡住或误导用户 · **P1** 界面上有但点了没反应 · **P2** 设计稿提到但没实现 · **P3** 工程收尾。

> 每条都标了「已验证 / 未验证」。未验证的是读代码推断出来的，动手前先花一次实测确认。

## 1. 引擎宿主 `src/main/agent-host.ts`

- ~~**P0** `ask_user_question` 没有回答界面~~ → **已解决**。宿主不再认领问卷，改为通用 UI 桥：`ui.select/confirm/input/editor/notify` 全部转 `uiRequest` 事件，渲染层的 `askQuestion` 适配器把结构化问卷渲染成卡片。四种原语均已实测通过（confirm=true / select / input / notify toast）。见 ADR 0004。
- ~~**P0** `newSession` 直接 `start()`（第 412 行）…侧栏出现空标题条目~~ → **实测证伪**（2026-11-02）。`SessionManager.create(cwd)` 只算出 `sessionFile` 路径不写盘（`dist/core/session-manager.js:711-716` 仅在 `persist` 时拼路径），点 5 次「新建任务」后目录 jsonl 数量 42 → 42，`listAll()` 630 条里 `messageCount === 0` 的是 0 条。空会话只在真产生消息时落盘。
- ~~**P0** 每帧全量快照~~ → **已解决**。事件改为 `blocks` + `BlockDelta { full?, order?, items, turns? }`；宿主按 `sent`/`revs` 比对只推变了的块（原地修改的块用 `bump(id)` 标记），turn 再细一层用 `TurnDelta` 只推变了的子块；`order` 没变就不带，渲染层沿用旧引用。见 ADR-0013。
- ~~**P0** `open` 无加载态~~ → **已解决**。`open()` 期间发 `busy {active:true,label:'正在打开会话'}`，`finally` 复位；渲染层在输入区上方显示 spinner + 文案。实测 44.2MB 会话约 1.9s，提示可见。
- ~~**P1** `emitSessions` 只取最近 40 条 / 12 个项目~~ → **实测未发生**（2026-11-02）。`publishSessions` 对 `listAll()` 结果不做截断，搜索「powershell」能命中 `pi`、`inteplm-print-website`、`wsl` 等其它项目的历史会话；侧栏只显示前 5 条是渲染层的分页（点「显示更多」继续加载）。
- ~~**P2** `read` 结果映射的 `file` 块在历史会话里靠正则取 path~~ → **已修**。`blocksFromEntries` 用 `rawArgs` 记原始参数：对象直接取 `.path`，字符串才回落正则。
- ~~**P2** `bashExecution` 类型消息没有映射~~ → 已映射成 `kind:'tool'` name=`bash`。
- ~~**P2** `compaction_end` 只推「上下文已压缩」~~ → 已带 `Xk → Yk tokens`。
- ~~**P2** 图片没接~~ → `prompt { images }` → `session.prompt(text, { images })`。
- **P3** 宿主崩溃后 `main/index.ts:19-21` 只发一条 error，不自动重启。
- **P3** 会话归属判断靠 `SessionManager.listAll()` 全量扫文件，启动多花约 1s → **实测更新（2026-11-10）**：本机 712 条会话冷态首扫 3.3s，热态 1.3-2.7s（逐目录串行调 `listAll`；用单次 `SessionManager.listAll()` 跨目录并发可降到 ~0.9s）。
- **P3** 启动耗时已埋点可复测（2026-11-10）：`pnpm run dev` 后看 `tmp/log/<时间戳>.log`，三端时间线在一个文件里（行首 `+Nms` 是各自进程 uptime）。典型分解：**宿主 SDK import ~2.0s**（cpu-prof 显示几乎全是 ESM 模块解析的 stat/lstat，337 个 js，无单一热点）→ `loader.reload` ~1.0s（6 个 TS 扩展 jiti 编译；`reload(noExtensions)` 只要 75ms）→ 会话扫描 1.3-2.7s。**渲染层 dev 首屏 ~0.5s，生产 0.47s**；曾测到 dev 6.0s：react-markdown 预打包 chunk 首次求值占 5.7s（LoAF 定位），后续因代码缓存不再复现——dev 冷启动慢属 Vite 一次性成本，打包版无此问题。分析脚本：`tmp/probe-startup*.mjs`、`tmp/analyze-prof.mjs`。

## 2. 跨进程协议 `src/shared/ipc.ts` / `preload`

- ~~**P0** `openSession` 需要配一个「开始/结束加载」事件~~ → **已解决**，新增 `busy` 事件。
- ~~**P1** 缺 `askUser` 命令与对应的 event~~ → **已解决**，改为通用的 `uiReply` 命令 + `uiRequest` 事件。
- ~~**P1** 缺 `deleteSession` / `renameSession` 命令~~ → 已实现（`renameSession` 走 JSONL 追加，`deleteSession` 删文件）。
- ~~**P1** 仍缺 `searchSessions`（现在搜索只在渲染层过滤已有的 40 条）~~ → **不需要**。宿主已把 `listAll()` 全量下发（633 条），渲染层过滤即可；实测搜索能跨项目命中。
- **P3** `AgentEvent` 无版本号，宿主与渲染层版本错配时只能静默失败。

## 3. 主进程 `src/main/index.ts`

- ~~**P1** 无单实例锁~~ → 已加 `app.requestSingleInstanceLock()` + `second-instance` 聚焦。
- ~~**P3** 窗口尺寸/位置不记忆~~ → 已实现。`app.getPath('userData')/window.json` 落盘，启动时 `...readBounds()`；最大化时跳过写入（避免把全屏矩形存下来）。实测把文件改成 1000×700 后重启，截图就是 1000×700。
- ~~**P3** 无外部链接拦截~~ → `host:openExternal` 只放行 `^https?://`。
- **P3** 无打包配置（electron-builder）、无应用图标、无 `productName`。

## 4. 渲染层骨架 `src/renderer/src/App.tsx` / `store/`

- ~~**P1** 后退/前进按钮没有实现~~ → 已实现（`past`/`future` 两个 ref + `Place {route,id}`）。
- ~~**P1** `MessageActions` 传 `time=""`~~ → 已传 `settledAt` 格式化的时间。
- ~~**P1** 复制 / 赞 / 踩 / 分享四个按钮无 handler~~ → 已实现（分享=导出 Markdown）。
- ~~**P3** `error` 只增不清~~ → `clearError()` + 顶栏胶囊关闭按钮。

## 5. 侧栏 `src/renderer/src/components/Sidebar.tsx`

- ~~**P1** 搜索用 `prompt()` 原生弹窗~~ → 已改为行内输入框（2026-11-02）：整行 `h-9` 固定，进入搜索时标题/图标位换成输入框，列表不位移。
- ~~**P1** 插件市场、设置、后退/前进：全是空按钮~~ → 后退/前进已实现；插件市场与设置打开 `~/.pi/agent/settings.json`；“帮助”打开 pi 仓库；头像仍为静态。
- ~~**P2** 无会话右键菜单~~ → 已实现（重命名 / 在文件夹中显示 / 删除）。

## 6. 顶栏 `src/renderer/src/components/TitleBar.tsx`

- ~~**P1** `⋯` 无 handler~~ → 已实现（复制会话路径 / 导出 Markdown）。
- **P2** 顶部「上传」仍无真实入口（真正的附件入口在输入卡）。

## 7. 输入卡 `src/renderer/src/components/Composer.tsx`

- ~~**P1** 左侧 `+` 无 handler~~ → 已实现（图片转 base64 当附件，其余插 `@路径`）。
- ~~**P1** 访问权限「变更前确认」写死~~ → **已实现**。宿主用 `DefaultResourceLoader` 多挂一个隐藏的内联扩展 `pigui-permission-gate`（`createSession()` 里），监听 `tool_call`，对 `write/edit/powershell/bash` 走 `uiContext.confirm` 逐次确认；开关切到「完全访问」后直接放行。已验证确认框弹出、确认后命令执行（`echo gate-ok`）。
- **P1** 起始页工作区条的 `+`（添加工作区）无 handler。pi 的 `cwd` 由宿主启动参数决定，GUI 里换工作区要换宿主，v1 不做。
- ~~**P2** `@` 文件提及未实现~~ → 已实现（宿主 `listFiles`）。
- ~~**P2** `/` 命令未实现~~ → 已实现（命令来自扩展，`prompt()` 派发）。
- ~~**P2** 图片粘贴/拖拽发送未实现~~ → 已实现（粘贴 / 拖拽 / 文件选择）。
- ~~**P3** 多行输入不自动增高~~ → 已用 `scrollHeight` 同步。

## 8. 会话渲染 `src/renderer/src/components/blocks.tsx` / `DiffBlock.tsx`

- ~~**P1** diff 块的「撤销」无 handler~~ → 已实现（宿主 `revertEdit` + `git apply -R`）。
- ~~**P2** 长 diff 不截断~~ → 超 300 行截断并提示剩余行数。
- ~~**P3** `TurnBlock` 折叠状态不记忆~~ → 按块 id 存 localStorage。

## 9. 代码与 Markdown `CodeBlock.tsx` / `MarkdownView.tsx`

- **P2** shiki 语言只覆盖 14 种，遇到其他语言回落为纯文本（可接受，记录在此）。
- **P3** 大代码块无「折叠 / 展开全部」。

## 10. 调试页 `src/renderer/src/components/Gallery.tsx`

- **P3** 仍读 `mock.ts`，接入真实引擎后未同步；`mock.ts` 只剩它一个使用者。

## 11. 工程与文档

- ~~**P0** 无 git 仓库~~ → 已 `git init` + 首次提交（`b59cbe0`）。
- ~~**P3** `docs/screenshots/` 全是 UI 阶段的 mock 截图~~ → 已按真实引擎重截（2026-11-02 收尾批次）。
- **P3** `GLOSSARY.md` 已补 Agent Host / AgentCommand / AgentEvent；`docs/adr/` 已到 0013。
- **P3** 无 `pnpm run typecheck` 之外的检查（无 lint、无测试；用户在 v1 明确说不写 vitest）。

## 12. 2026-11-02 收尾批次（已实现，待真机回归）

- 会话重命名 / 删除 / 在文件夹中显示：宿主 `renameSession` / `deleteSession`，右键菜单。
- diff 撤销：`revertEdit` → `git apply -R` 临时 patch；无 patch 时按钮置灰。
- `@` 文件提及：宿主 `listFiles` 递归扫 cwd 两层（跳过 `node_modules`/`out`/点开头），最多 40 条。
- `/` 斜杠命令：宿主从 `session.extensionRunner.getRegisteredCommands()` 取，随 `sessions` 事件下发；命令本身由 `prompt()` 派发（pi 内部先试扩展命令）。
- 导航后退/前进、`Ctrl+N`、`Ctrl+B`。
- 复制 / 赞 / 踩 / 分享（导出 Markdown）与时间显示。
- 图片：粘贴 / 拖拽 / 附件按钮选中图片 → `prompt { images }` → `session.prompt(text, { images })`；用户气泡显示「N 张图片」。
- 长 diff 截到 300 行并提示剩余行数。
- `TurnBlock` 展开状态按块 id 存 localStorage。
- 「插件市场」与「设置」打开 `~/.pi/agent/settings.json`（pi 的插件/模型/扩展都配在这）。「帮助」打开 pi 仓库。
- 菜单项支持 `danger` 红色样式。

## 13. 2026-11-04 渲染重写（ADR-0011 P0）与项目页

- 正文改由 `components/transcript/` 渲染：每个块 `memo`，流式只重渲染受影响的块。
- 流式代码块先渲染纯文本，收尾后一次性着色（ADR-0011 P0-2）。
- 滚动跟随合到 rAF 一帧内；`TurnBlock` 折叠态仍按块 id 存 localStorage。
- **P2** 旧 `DiffBlock` 的「打开 diff」「撤销」在新正文里没有入口（`DiffBlock.tsx` 已无运行时引用），需要时在 `transcript/Step.tsx` 的 diff 行补。
- **P3** `transcript/MockStage.tsx` + `mockTimeline.ts`（假流 + perf HUD）只挂在预览页，不参与运行时；ADR-0011 §五要求的一次性体检脚本未进仓库。
- ~~**P3** 后台会话切换：`useAgent` 用 `ev.path === viewPath` 过滤增量，`enter()` 期间 `viewPath` 为 null，靠宿主首个 `full` 事件补种；新建会话路径未定前到达的增量会被丢弃（未实测）。~~ → 已迁到 `store/blocks.ts` 的 `applyBlocks`，逻辑不变。

## 14. 2026-11-09 状态管理改为 zustand（ADR-0013）

- 新建 `src/renderer/src/store/`（state / blocks / interaction / engine / index），单 store 多 slice。
- 正文改按 id 存：`order: string[]` + `byId: Record<string, Block>`；`Transcript` 只订阅 `order`，每行 `Row` 只订阅 `byId[id]`。
- 删 `useAgent.ts`（约 400 行），组件改用 `useEngine` selector + `./store` 动作。
- `Sidebar` / `Projects` / `ComposerCard` 自己订阅数据，props 分别从 12→7、4→1、14→2。
- 侧栏 `filter().sort()` 进 `useMemo` 并预建 `unreadSet`；`answerText` 进 store；`toMarkdown` 只在点导出时算。
- 宿主侧顺带优化：`BlockDelta.order` 变成「顺序没变就不带」；turn 新增 `TurnDelta`（只推变了的子块 + `durationMs`）。
- `MessageActions` 从 `blocks.tsx` 抽出，新增 `full?: () => string`。
- **P3** 验收：`src/renderer/src/perf.ts` 暴露 `window.__piPerf.renders`（dev-only），组件渲染体里 `count('app'/'sidebar'/'row')`（另暴露 `reset()`，生产构建里整块被摇掉）。2026-11-09 实测（`PI_SHOT_JS_FILE` 打开一条 27KB 会话并发一句 prompt）：启动阶段 app=4、sidebar=80、row=40（全是 `sessions` / `busy` 事件，一次性）；流式 6 秒内 app +4、sidebar +4、row +2（侧栏增量全部来自 `sessions` 事件，不是正文增量）。正文块增量未触发过侧栏重渲染，目标达成。
- **P2** 待重测：上面这组数取自重构前。ADR-0011 的「打开 700 块会话 < 400ms」「DOM < 8k」与 ARCHITECTURE §「万级块不卡」都还没在 id 化缓存 + `TurnDelta` 之后验过，旧数字作废。
- 重构后的审查修补：`store/engine.ts` 用 `hot.accept` 重新订阅（否则改该文件后引擎永久失联）；`dispatch` 末尾 `never(ev)` 兜底，新增 `AgentEvent` 成员会编译失败而不是静默丢弃；`App` 的会话查找改为先订 `sessions` 再 `useMemo`，不再每个 delta 跑一遍 `find`。

## 建议的下一刀

1. `docs/screenshots/` 里的 03-model-menu / 05-gallery-diff 还是旧版，其余已按真实引擎重截。
2. 打包：`electron-builder` + 应用图标 + `productName`，把 `agent-host.js` 与 pi 依赖打进去。
