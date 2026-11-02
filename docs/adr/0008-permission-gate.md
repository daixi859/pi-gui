# ADR 0008：工具执行前的「变更前确认」用内联扩展实现

日期：2026-11-02 · 状态：已采纳

## 背景

界面左下角一直有「变更前确认 / 完全访问」这个开关（来自设计稿），但 pi 自身没有权限模式的概念，所以它此前只是文案，不产生任何行为。

pi 提供的钩子是扩展的 `tool_call` 事件：处理器可以就地改 `event.input`，也可以返回 `{ block: true, reason }` 拦下这次调用。官方示例 `examples/extensions/permission-gate.ts` 就是这么做的。

## 决定

宿主在 `createSession()` 里自建一个 `DefaultResourceLoader`，用 `extensionFactories` 挂一个隐藏的内联扩展 `pigui-permission-gate`：

```ts
pi.on('tool_call', async (event) => {
  if (access === 'full' || !RISKY.has(event.toolName)) return undefined
  const ok = await uiContext.confirm(`允许执行 ${event.toolName}？`, args)
  return ok ? undefined : { block: true, reason: '用户拒绝了这次工具调用' }
})
```

`RISKY = { write, edit, powershell, bash }`。确认框复用已有的 ui 桥（ADR 0004），所以渲染层不需要认识这个扩展。

## 为什么不用自定义工具或改 pi 源码

- 内联扩展是 pi 给宿主的正常扩展点，不用 fork、不用改包。
- 走 `uiContext.confirm` 自动继承 UI 桥的所有行为（RPC 模式、取消语义、通知），与问卷卡片是同一条通路。
- 开关状态留在宿主（`let access`），切会话不丢；渲染层通过 `setAccess` 命令与 `snapshot.accessFull` 回读。

## 代价

- `RISKY` 是硬编码的名单。装了别的写盘类扩展工具，要手动加进去。
- 每次确认都会跨进程往返一次，比 TUI 里慢几十毫秒，可接受。
- 扩展到 `~/.pi/agent/settings.json` 的其它扩展通过同一个 loader 加载，行为不变。
