# ADR 0007：`@` 提及与 `/` 命令的数据由宿主提供

## 背景

输入卡的 placeholder 承诺「使用 @ 添加上下文，使用 / 选择命令或能力」。渲染层是 sandbox，读不到文件系统，也拿不到扩展注册的命令。

## 决定

- **`@` 提及**：`AgentCommand.listFiles { query }` → 宿主在 cwd 下递归扫两层，跳过点开头目录、`node_modules`、`out`，最多 40 条，回 `AgentEvent.files { items }`（相对路径）。选中后插入 `@相对路径`，随正文一起交给模型（pi 的 prompt 支持 `@file` 引用）。
- **`/` 命令**：宿主从 `session.extensionRunner.getRegisteredCommands()` 取 `{ name, description }`，随 `sessions` 事件一起下发（`CommandInfo[]`）。派发靠 `session.prompt('/name args')`——pi 在 `prompt()` 内部先 `_tryExecuteExtensionCommand()`，命中扩展命令就直接执行、不进模型。
- 附件按钮选中的**图片**走另一条路：`host.readImage(path)` 读成 base64 → `prompt { images }` → `session.prompt(text, { images: ImageContent[] })`，因为渲染层跨不过 `file://`。

## 代价

- `listFiles` 每次按键都发一次命令；目前靠「最多 40 条 + 跳过大目录」压住开销，没有防抖。文件多的项目里可能感到卡。shortcut: 无防抖，文件数上千时改为主进程侧缓存目录树。
- `/` 命令列表只在 `sessions` 事件刷新（init、settled、重命名/删除后），扩展热加载后要等下一次刷新。
