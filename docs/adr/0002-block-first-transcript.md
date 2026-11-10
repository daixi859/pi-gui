# 0002 Block 优先的会话模型

## 背景

pi 的原始事件是增量文本流 + 工具生命周期回调。渲染层需要 thinking、tool 调用、diff 等多种形态，且思考/工具过程要能折叠。

## 决定

跨进程协议传输的不是「消息」，而是 Block：`user | assistant | thinking | tool | diff | file | turn | system`。每个 Block 自带 `id` 与 `kind`；`turn` 是唯一可嵌套的 Block，其余都平铺。传输粒度是「当前完整 Block 序列」，宿主自己按 60ms 合并，不做增量补丁。

## 备选

- **直接传 pi 原始事件**：渲染层要自己做状态机聚合，且 pi 事件结构会随版本变，泄漏到 UI。
- **只传最终 markdown**：丢掉 thinking / 工具过程的呈现能力，与设计稿冲突。
- **按 provider 的 message 结构传**：OpenAI / Anthropic 字段不同，客户端无法只维护一套渲染。

## 后果

- 引擎侧适配层要负责「pi 事件 → Block」的翻译，渲染层对 pi 版本无感。
- Block 是渲染契约，新增呈现形态 = 新增 `kind`，不改 IPC 通道。
- 丢掉的信息：pi 的原始 token 用量等细节必须塞进 Block 字段或单独事件，不能靠透传。
- 每帧传全量快照，长会话（~700 块）序列化开销随会话增长；超过万级块时需要改成按 `id` 增量（见 `src/main/agent-host.ts` 的 `schedule()`）。
