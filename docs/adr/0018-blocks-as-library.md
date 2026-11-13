# 0018 对话块升为组件库：PiGui 正文改用 agent-design 的实现

## 背景

PiGui 的正文渲染（`src/renderer/src/components/business/transcript/`）与 `agent-design/src/blocks/` 是同一件事的两份实现：都把 pi 的消息流画成「回合 → 分组 → 行」，都各自维护一套工具元数据、一套折叠记忆、一套 diff 解析。ADR-0017 已经把两者判成「并行不继承」，但那条论断的前提是「两边做的是不同的事」——实际上它们做的是同一件事，只是长得不像。

代价是可验证的：同一个工具名要在四处登记（`config/tools.ts:11` 的 `TOOL_META`、`toolModel.ts:10,23` 的 `VARIANTS`/`TITLES`、`turnGroups.ts:54` 的 `TOOL_KIND`、`ProcessGroup.tsx:26` 的 `ICONS`），任一处漏改就得到「组标题说在检索、行标题说在读文件」这种自相矛盾的界面。这不是待修的小毛病，是两份实现的必然产物。

`agent-design` 的那一份更成熟：它有三层分组（assistant 文本切组、组头按类别汇总、组体限高贴底跟随）、`ChangedFiles` 汇总、`HoverPreview` 预览、完整的 15 类 `ProcessKind` 与落定文案。PiGui 的那一份则是 ADR-0015 之后留下的平铺行，折叠粒度更粗。

## 决策

1. **唯一实现 = `agent-design/src/blocks/`。** PiGui 删除 `transcript/{Transcript,TurnView,Step,tool/{StepRow,tools,bodies}}.tsx` 与 `components/business/{blocks,DiffBlock}.tsx`、`transcript/SessionBlockPreview.tsx`，正文改吃包里的块。`agent-design` 的定位随之变成「块组件库 + 设计验收场」，回放页降级为块的验收页（README 与 ADR-0017 的措辞同步改）。

   否决「只搬行级组件、保留 PiGui 自己的 TurnView/分组」：那会得到 ADR-0017 已经否掉的中间态——两边都不像，且分组逻辑仍有两份。

2. **包入口 `agent-design/blocks`。** `agent-design/package.json` 加 `exports: { "./blocks": "./src/blocks/index.ts" }`，根 `package.json` 加 `"agent-design": "workspace:*"`，PiGui 侧写 `import { TurnView } from 'agent-design/blocks'`。`index.ts` 是唯一桶文件（`blocks/` 此前没有）。

   否决深引用别名（`@agent-design/blocks/*`）：依赖变成隐身的，`package.json` 看不出谁在用它，也无法在将来换成构建产物。
   否决给 `agent-design` 加 vite lib 构建：改动要重新 build 才能生效，开发期体验与收益不成比例。

3. **块类型的唯一来源 = `agent-design/src/reducer/types.ts`**，由 `blocks/index.ts` 重导出。`src/shared/blocks.ts` 删掉 `Block`/`DiffLine`/`DiffBlock`/`ToolState`/`SystemTone`，只留 `SessionMeta`/`ProjectRow`/`Snapshot`/`LEVEL_LABEL`。

   Block 不跨进程传输（ADR-0014、ADR-0015），`agent-host.ts` 只消费 `LEVEL_LABEL` 与快照类型，所以这不是协议变更。若改成「宿主再声明一份等价类型」，等于给漂移留缝。

4. **时间线派生直接产 `Turn`/`Block`。** `store/timeline.ts` 的 `TurnSpan` 退役，`deriveBlocks` 直接返回 `{ turns: Turn[], byId: Record<string, Block>, answerText }`；`stepCount`/`noteCount`/`toolCount`/`errorCount` 这类统计从 `Turn` 的 `blockIds` 现场算。

5. **思考档位从块里删掉。** `ThinkingBlock` 不带 `level`，思考行不显示档位。输入卡的思考强度选择与快照里的 `thinkingLevel` 不受影响——那是「下一轮用什么」的声明，不是历史记录的一部分。

6. **Markdown 由调用方注入。** `AssistantText` 接受可选的 `renderMarkdown`（默认自带 `ReactMarkdown` + `remark-gfm`）。PiGui 传入自己的 `base/MarkdownView`（shiki 高亮、链接走 `openExternal`）；验收场用默认实现。`AssistantText` 的职责是间距、流式光标与 `data-final` 语义，不是解析 Markdown。

7. **块专属样式独立成 `agent-design/src/blocks/blocks.css`。** 内容 = `styles/app.css` 的块段（原 453–1381 行）加上块真正消费的变量，按 `.pi-blocks` 作用域重声明（`--dsw-alias-*` 约 15 个、`--app-*` 约 10 个、`--dsh-content-font-size` 给死 14px）。`app.css` 对应段删除，验收场改吃新 CSS，PiGui 只 `import 'agent-design/blocks/blocks.css'`。

   否决直接 import `app.css`：它的 `.md` 全套与 PiGui `global.css:335–371` 直接对撞，且带着 `body`/`html` 的全局规则与 `data-ds-dark-theme` 分支。
   否决用 Tailwind 重写：等于再抄一份，两份迟早分叉。

8. **包入口自管副作用。** 导入 `agent-design/blocks` 时调一次 `installIconSprite()`（已幂等，且有 `document` 才装）。暗色暂不接：PiGui 目前没有暗色主题，grep `data-ds-dark-theme`/`data-theme` 在 `src/renderer/src` 零命中。

9. **工具元数据四表合一。** 新建 `agent-design/src/blocks/tools.ts`：一条 `Record<toolName, { kind: ProcessKind; verb: string }>`。`ProcessGroup` 的图标按 `kind` 查，`ToolRow` 的标题取 `verb`；`VARIANTS`/`TITLES`/`TOOL_META` 退役。保留 `kind` 这个词——它是驱动分组的那一维；`variant` 退役。

10. **文案归包。** 块内所有文案来自 `agent-design/src/i18n/zh.ts`，包把它作为唯一文案源导出；PiGui 只保留块以外界面的自有串。否决 `labels` 注入：那会让两个调用方各写一份「已完成，用时」。

11. **live 文案去品牌化。** `deepDiving: '深度求索中...'` / `deepDivingFor` 改为「正在工作中…」/「正在工作中，用时 X」。那是 DeepSeek harness 的口吻，PiGui 是 pi agent 客户端。

12. **时钟由宿主走表，折叠记忆按会话隔离。** `TurnView` 接受 `now?: number`，PiGui 在 `Transcript` 层挂 1 秒 tick（仅有 live turn 时开）并把 `now` 传下去；库组件不自己定时。折叠的 `scope` 用会话标识（`SessionMeta.id`），key 仍是 `turn.key`，避免切会话串折叠状态。

13. **`tsconfig.web.json` 加 `allowImportingTsExtensions: true`。** 包里若干文件写 `from './props.ts'`（`reducer/reduce.ts:22` 等），不加会报 TS5097。这是 PiGui 侧为跨包引用付出的唯一配置改动——`electron.vite.config.ts` 不需要改：renderer 的 `workspaceRoot` 已覆盖 `agent-design`，`nodeLinker: hoisted` 保证 React 单实例。

## 后果

- `agent-design` 从此有生产消费者，不再是纯验收场。改块的默认样式会直接改 PiGui 的外观，验收场与宿主必须一起看。
- 分组行为按 assistant 文本切段：中途汇报的文本会把过程切成多组，只有最后一组是 live。这与 PiGui 原来「折叠只隐藏过程块、文本全在折叠外」不同——折叠头收起后，中途文本仍然常显（这一点两边一致），差别在于过程的可见分组粒度。
- `scripts/pack.mjs:44–61` 按 `pnpm ls --prod` 拷贝生产依赖，`agent-design` 成为生产依赖后本会把 TSX 源码拷进 `release/app/agent-design`。已就地修掉：拷贝前按路径里有没有 `node_modules` 过滤，工作区包（`agent-design`、`web-demo`）跳过——它们只在构建期被 vite 打进 `out/`，运行时用不到。规则与 `nodeLinker: hoisted` 绑定，将来若换回符号链接布局需要重看。
- `thinkingLevel` 仍出现在消息里的旧数据会被忽略，不需要迁移。
- 两份 `.md` 样式的冲突随 `blocks.css` 的作用域化解：Markdown 排版与流式光标整体移交块库（`.pi-blocks .md`、`data-streaming`），PiGui 的 `global.css` 不再有自己的 `.md` 与 `.streaming` 规则，`MarkdownView` 只负责把文本喂给 ReactMarkdown + shiki。

## 验收

- `pnpm run typecheck`（三端）。
- 无头截图比对：PiGui 主界面与 `agent-design` 回放页各截一轮，确认组头文案、图标、diff 行号、改动卡一致。
- 发布前：`pnpm pack` 后检查 `release/app/agent-design` 是否出现源码。
