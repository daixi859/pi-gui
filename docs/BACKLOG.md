# 待办清单（按模块）

统计时间：2026-11-02。状态标记：**P0** 会卡住或误导用户 · **P1** 界面上有但点了没反应 · **P2** 设计稿提到但没实现 · **P3** 工程收尾。

> 每条都标了「已验证 / 未验证」。未验证的是读代码推断出来的，动手前先花一次实测确认。

## 1. 引擎宿主 `src/main/agent-host.ts`

- ~~**P0** `ask_user_question` 没有回答界面~~ → **已解决**。宿主不再认领问卷，改为通用 UI 桥：`ui.select/confirm/input/editor/notify` 全部转 `uiRequest` 事件，渲染层的 `askQuestion` 适配器把结构化问卷渲染成卡片。四种原语均已实测通过（confirm=true / select / input / notify toast）。见 ADR 0004。
- ~~**P0** `newSession` 直接 `start()`（第 412 行）…侧栏出现空标题条目~~ → **实测证伪**（2026-11-02）。`SessionManager.create(cwd)` 只算出 `sessionFile` 路径不写盘（`dist/core/session-manager.js:711-716` 仅在 `persist` 时拼路径），点 5 次「新建任务」后目录 jsonl 数量 42 → 42，`listAll()` 630 条里 `messageCount === 0` 的是 0 条。空会话只在真产生消息时落盘。
- ~~**P0** 每帧全量快照~~ → **已解决**。事件改为 `blocks` + `BlockDelta { full?, order, items }`；宿主按 `sent`/`revs` 比对只推变了的块（原地修改的块用 `bump(id)` 标记），渲染层按 `order` 拼数组，未变的块沿用旧引用。
- ~~**P0** `open` 无加载态~~ → **已解决**。`open()` 期间发 `busy {active:true,label:'正在打开会话'}`，`finally` 复位；渲染层在输入区上方显示 spinner + 文案。实测 44.2MB 会话约 1.9s，提示可见。
- **P1** `emitSessions` 只取最近 40 条 / 12 个项目（第 135 行起），其余会话在选择器里不可见。
- **P2** `read` 工具结果没有映射成 `file` 块（`kind: 'file'` 定义了但宿主从不产出）。
- **P2** `bashExecution` 类型消息没有映射，终端执行结果只剩 tool 块。
- **P2** `compaction_end` 只推「上下文已压缩」，没有前后 token 数。
- **P2** `session.prompt(text, { images })` 没接图片，协议里 `prompt` 只有 `text`。
- **P3** 宿主崩溃后 `main/index.ts:19-21` 只发一条 error，不自动重启。
- **P3** 会话归属判断靠 `SessionManager.listAll()` 全量扫 589 个文件，启动多花约 1s。

## 2. 跨进程协议 `src/shared/ipc.ts` / `preload`

- ~~**P0** `openSession` 需要配一个「开始/结束加载」事件~~ → **已解决**，新增 `busy` 事件。
- ~~**P1** 缺 `askUser` 命令与对应的 event~~ → **已解决**，改为通用的 `uiReply` 命令 + `uiRequest` 事件。
- **P1** 缺 `deleteSession` / `renameSession` / `searchSessions` 命令。
- **P3** `AgentEvent` 无版本号，宿主与渲染层版本错配时只能静默失败。

## 3. 主进程 `src/main/index.ts`

- **P1** 无单实例锁（`app.requestSingleInstanceLock`），双击图标会开两个窗口，两个宿主抢同一批会话文件。
- **P3** 窗口尺寸/位置不记忆。
- **P3** 无 `session.setPermissionRequestHandler`、无外部链接拦截（`shell.openExternal`）。
- **P3** 无打包配置（electron-builder）、无应用图标、无 `productName`。

## 4. 渲染层骨架 `src/renderer/src/App.tsx` / `useAgent.ts`

- **P1** 路由只有 `start / chat / gallery` 三个字符串，后退/前进按钮没有实现（`Sidebar.tsx` 与 `CollapsedHeaderBar` 里的箭头都是空按钮）。
- **P1** `MessageActions` 传 `time=""`（`App.tsx:97`），时间永远空。
- **P1** 复制 / 赞 / 踩 / 分享四个按钮无 handler（`blocks.tsx:203-217`）。
- **P3** `useAgent` 的 `error` 只增不清，一次报错永久留在界面上。

## 5. 侧栏 `src/renderer/src/components/Sidebar.tsx`

- ~~**P1** 搜索用 `prompt()` 原生弹窗~~ → 已改为行内输入框（2026-11-02）：整行 `h-9` 固定，进入搜索时标题/图标位换成输入框，列表不位移。
- **P1** 插件市场、设置、头像、后退/前进：全是空按钮。
- **P2** 无会话右键菜单（重命名 / 删除 / 在资源管理器中显示）。
- ~~**P3** 项目分组标题不可折叠~~ → 已支持，且折叠状态与「显示更多」条数存 `localStorage`（`pi.sidebar.folded` / `pi.sidebar.limit`）。

## 6. 顶栏 `src/renderer/src/components/TitleBar.tsx`

- **P1** `⋯`（会话信息）、帮助、上传三个按钮无 handler。
- **P2** 顶部没有设计稿里的「上传」真实入口（附件）。

## 7. 输入卡 `src/renderer/src/components/Composer.tsx`

- **P1** 左侧 `+` 附件按钮无 handler。
- **P1** 访问权限「变更前确认」写死，pi 没有对应概念，实际不生效。
- **P1** 起始页工作区条的分支与项目名来自快照，但 `+`（添加工作区）无 handler。
- **P2** `@` 文件提及未实现（placeholder 里写了）。
- **P2** `/` 命令与能力选择未实现（placeholder 里写了）。
- **P2** 图片粘贴/拖拽发送未实现。
- **P3** 多行输入时 textarea 不自动增高（`rows=1` + `max-h-40`，无 `scrollHeight` 同步）。

## 8. 会话渲染 `src/renderer/src/components/blocks.tsx` / `DiffBlock.tsx`

- **P1** diff 块的「撤销」按钮无 handler。
- **P2** `FileBlock` 没有「打开」按钮实现（`shell.openPath` 未接）。
- **P2** diff 行数超过约 200 行时不截断，长 diff 会撑爆布局。
- **P3** `TurnBlock` 折叠状态不记忆，切换会话后重置。

## 9. 代码与 Markdown `CodeBlock.tsx` / `MarkdownView.tsx`

- **P2** shiki 语言只覆盖 14 种，遇到其他语言回落为纯文本（可接受，记录在此）。
- **P3** 大代码块无「折叠 / 展开全部」。

## 10. 调试页 `src/renderer/src/components/Gallery.tsx`

- **P3** 仍读 `mock.ts`，接入真实引擎后未同步；`mock.ts` 只剩它一个使用者。

## 11. 工程与文档

- **P0** 无 git 仓库，所有改动无版本记录。
- **P3** `docs/screenshots/` 全是 UI 阶段的 mock 截图，未按真实引擎重截。
- **P3** `GLOSSARY.md` 已补 Agent Host / AgentCommand / AgentEvent；`docs/adr/` 已到 0003。
- **P3** 无 `npm run typecheck` 之外的检查（无 lint、无测试；用户在 v1 明确说不写 vitest）。

## 建议的下一刀

1. `git init` + 首次提交，把当前状态固定下来（无版本控制的代价已付过一次：agent-host.ts 被写坏时只能从构建产物手工还原）。
