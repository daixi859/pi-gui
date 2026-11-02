# ADR 0006：会话重命名与删除直接操作 JSONL

## 背景

侧栏右键菜单提供「重命名 / 在文件夹中显示 / 删除」。pi 没有暴露 rename/delete API，会话就是一个 JSONL 文件（`~/.pi/agent/sessions/<时间戳>_<uuid>.jsonl`）。

## 决定

- **重命名**：用 `SessionManager.open(path)`（当前挂载的会话复用 `managerRef`）调 `appendSessionInfo(title)`，往 JSONL 追加一条 `session_info` 记录。JSONL 是追加式日志，最后一条 `session_info` 即为当前标题。
- **删除**：`unlinkSync(path)`。若删的是当前挂载的会话，先 `await start()` 切到新会话，避免 dispose 之后还有写入落到已删文件上。
- **在文件夹中显示**：`shell.showItemInFolder(path)`，走主进程的 `host:revealPath`。
- 三者都只改内存里的扫描结果 `lastList` 再 `publishSessions()`，**不重扫盘**（`SessionManager.listAll()` 要 850ms）。

## 代价

- 重命名后旧标题仍留在文件里，只是被新记录覆盖；文件不会变小。
- 删除是硬删除，没有回收站、不能撤销。

## 备选

- 自己写 JSONL：绕过 `SessionManager` 的格式约束，pi 后续版本改格式就崩。否决。
- 重扫盘刷新列表：每次操作多花约 1s，界面卡顿明显。否决。
