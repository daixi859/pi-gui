# 0010 切走会话不 dispose，后台继续跑

## 决定

宿主用 `mounted: Map<会话文件路径, Mounted>` 持有多个会话，`current` 只决定哪一份块推给渲染层。
切换会话 = 换 `current`，不 `dispose`。只有删除会话、以及切走后已经空闲（`session.isIdle`）的才释放。
每个 `Mounted` 自带转录缓存（history / round / turn）、节流定时器、增量比对表和工具栈。

## 为什么

- 原来 `open()` / `start()` 先 `session.dispose()`，而 `dispose()` 内部会 `agent.abort()`：切走等于中断任务；
  正在流式的内容还没到 `message_end` 落盘，切回来就永远看不到。
- 新会话的 JSONL 在首条用户消息 `message_end` 之后才创建，侧栏又只在 `agent_settled` 时重扫，
  运行中的新任务在侧栏里根本没有条目。

## 代价

- 后台会话各占一份上下文和模型客户端；切走后已空闲的在下一次切换时 `prune`，正在跑/压缩的留着继续跑。
- 状态按会话拆开：`status` / `settled` 都带会话文件路径，`sessions` 事件用 `SessionMeta.running` 标后台运行，
  未读点由渲染层在「别的会话 settled」时打上。
- 后台会话的确认框 / 问卷仍然弹在当前界面上（ui 请求不带会话归属），用户可以就地作答。
