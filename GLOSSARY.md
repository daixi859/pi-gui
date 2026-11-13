# GLOSSARY

本文件只定义语言，不记录实现。

## Block（块）

对话记录的最小渲染单元。一个 Block 有唯一 `id` 与 `kind`，渲染层只会根据 `kind` 选择组件，不知道消息来自哪个模型、哪次请求。

Block 不是「消息」：一次助手回复会被拆成多个 Block（thinking / tool / assistant / system）。它是渲染层从消息派生的视图模型，不跨进程传输（ADR-0014）。

没有 diff 这种 kind：文件改动从工具结果的 `details.diff` 派生，直接放进那条工具块（ADR-0015）。Block 的类型定义只有一份，在 `agent-design/src/reducer/types.ts`（ADR-0018）。

## Turn（回合）

用户发出一次输入，到助手停止工作之间的完整过程。Turn 是 Block 的容器：只用 `blockIds` 记录自己拥有哪些块（顺序即渲染顺序），统计信息（工具数、失败数）从这些块现场算，不另存。可以折叠、可以带中断标记与时长。Turn 之外出现的 Block 属于会话级提示（见 System）。

渲染层此前的 `TurnSpan`（ADR-0015 引入的段坐标，只记范围与统计）已退役，由本定义取代。

## 过程分组（ProcessGroup）

一次 Turn 之内，两段 assistant 文本之间的那些过程块（思考、工具、系统行）被收成一组，组头按类别汇总（「已读取文件、搜索代码」），组体限高内滚。分组是**渲染期**的视图，不是数据层概念：数据层只有平铺的 Turn 与 Block，分组由 `turnLayout` 按文本切段现算。

一个 Turn 通常有多组，只有最后一组在运行时是 live 的。折叠 Turn 收起的是这些组的组体，assistant 文本（含中途汇报）常显。

## 过程类别（ProcessKind）

过程块的归类标签，共 15 类（thinking / read / readImage / write / search / edit / commands / code / webSearch / webFetch / subagents / plan / questions / tools / context）。它同时驱动三件事：分组的组头文案（落定 / live / 准备中三套）、组头图标、以及「这一组在做什么」的活动指示。

`kind` 是唯一保留的归类词；旧实现里的 `variant` 已退役，工具名到类别的映射只有一张表（`agent-design/src/blocks/tools.ts`，ADR-0018）。

## 对话块库（agent-design/blocks）

`agent-design` 包里的块组件子路径，是对话正文的唯一实现：`import { TurnView } from 'agent-design/blocks'` 引入组件，同时引入块的类型定义与文案。它自带 `blocks.css`（作用域 `.pi-blocks`，只声明块自己消费的变量），不带来宿主的全局样式。

`agent-design` 因此同时是「块组件库」与「设计验收场」：验收场只剩回放页（`pages/Player.tsx`），按事件时间轴回放真实会话，用纯 props 渲染同一套块，是块的对照物而非第二份实现（ADR-0018）。

## System 提示

不属于任何一方发言的会话内通知，只有语气（info / warn / error）和文本，没有内容结构。例如「上下文已压缩」「操作已中断」。

## Transcript（对话记录）

当前会话的 Block 线性序列，按发生顺序排列。Transcript 只追加，不重排。

渲染层用「顺序 + 按 id 存」两份数据表示它（`order` / `byId`），而不是一个数组：这样增量到达时只有发生变化的那一行需要重渲染。

## Session（会话）

一个可独立恢复的 Transcript，绑定唯一工作目录（Project）。会话之间不共享历史。

## Project（项目）

以工作目录标识的一组会话的分组单位，用于侧栏归类。一个 Project 不是 git 仓库的同义词。

## Workspace 快照（Snapshot）

输入卡顶部展示的当前状态：工作目录、分支，以及输入卡底部的模型、思考强度、访问权限。它是「下一轮会用什么」的声明，不是会话属性的记录。

## 访问权限（Access）

助手工具调用可触达的范围，取值见 `完全访问` 等档位。它是用户在输入框上显式选择的授权，不是模型自行推断的。

## 思考强度（Thinking Level）

模型在回答前允许投入的推理预算档位（关闭 / 低 / 中 / 高 / 最高）。它不是模型名的一部分，同一模型可在不同档位下工作。

## 组件预览（Component Preview）

开发期页面，按 图标 / 输入 / 展示 / 弹窗 / 对话块 分类展示真实组件，右侧「外观令牌」面板可实时改动全局样式。它取代了早期的块画廊，仍然不属于用户可到达的功能。

## 设计令牌（Design Token）

样式的唯一来源：颜色、字号、圆角、间距都定义成 CSS 变量，组件只引用令牌类名，不写具体数值。

术语本身不绑定刻度。本项目现在只有一套：宿主规范（`--dsw-*`，间距 2/4/8/16、圆角 4/8/16、字号 12/14，见 `docs/STYLE.md`）。对话块把自成一套的 `--dsw-*` / `--app-*` 值**重新声明**在 `.pi-blocks` 作用域内（`agent-design/src/blocks/blocks.css`），那是包内自持而非第二套规范。

## 基础组件（Base Component）

不知道 pi 领域词汇的通用控件：按钮、菜单、列表行、悬停提示、图标。只吃原生概念（文案、变体、槽位），放进任何应用都能用。控件外观的唯一书写地。

## 业务组件（Business Component）

知道 pi 领域（块、会话、项目、UI 桥）的组件，由基础组件组合而成。布局与文字自由，控件外观一律取自基础组件，不自己拼。

## Agent Host（引擎宿主）

独立子进程，唯一持有 pi SDK 与活动会话的地方。渲染层不认识 pi，只认识 Block；主进程只做转发。宿主崩溃或重启不影响窗口存活。

## AgentCommand / AgentEvent（跨进程协议）

渲染层对引擎的全部输入输出。Command 是意图（发送、中止、切换会话、换模型、回答 UI 请求），Event 是事实（消息增量、UI 请求、状态快照、结束、错误）。Event 是**增量**的：`messages` 事件带 `MessageDelta`（`order` / `items`，`full` 时才是整棵快照），宿主只推变了的消息；消息是 pi 的 `AgentMessage`，key 是 timestamp。见 ADR-0013 / 0014。

## UI 桥

把宿主进程里的 `ui.select / confirm / input / editor / notify` 统一翻译成 `uiRequest` 事件、
再把渲染层的 `uiReply` 兑现回 Promise 的那一层。宿主不理解请求语义，不区分「问卷」「确认框」，
只负责搬运，所以换一个扩展不需要改宿主。

## UiRequest / UiReply

桥的两种原语。前者描述要问什么（kind + 标题 + 选项），后者描述答了什么（value / confirmed / cancelled）。

## 交互适配器（Interaction Adapter）

渲染层里认领某类 UI 请求的小模块，声明 `claims(toolName, args)` 与 `reply(answers)`。
`askQuestion` 认领 `ask_user_question` 并把结构化问卷渲染成卡片；没有适配器认领的请求
落到原生弹窗 UiPrompt。新增一个扩展的界面支持 = 注册一个适配器，不改宿主。
