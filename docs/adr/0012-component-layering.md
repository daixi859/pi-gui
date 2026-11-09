# 0012 组件分层：基础组件与业务组件

## 背景

25 个组件平铺在 `components/` 根，无分层标记；业务组件里散落约 30 个原生 `<button>` 手写控件外观（按钮、列表行、下拉项各写各的），同类全宽行样式重复 5+ 次，「业务组件里又长出一个按钮」反复发生。

## 决策

### 判定（两条，违反任一条即业务组件）

1. 不 import 渲染层业务状态与适配器：`useAgent` / `drafts` / `projects` / `mock` / `mockTimeline` / `interactions`。
2. props 不引用 `@shared` 协议类型（Block、DiffLine、UiRequest、AskQuestion…）。

「谁知道 pi 谁是业务」是可判定标准；「长得像不像控件」不是——DiffBlock、UiPrompt 只吃纯数据，但吃的是跨进程契约，归业务。

### 目录

```
components/
├── base/       Button, Menu, Dropdown, ListRow, Tip, Toasts, icons, PiLogo, CodeBlock, MarkdownView
└── business/   Sidebar, Composer, Projects, TitleBar, StartPage, AskCard,
                UiPrompt, DiffBlock, Preview, blocks
                └── transcript/   会话正文子分组
```

业务可以 import base，反之禁止；base 内部不越出 base/。

### 样式硬规则

- 业务组件自由：文本色/字号/字重、间距、flex/grid 布局、truncate（令牌刻度内）。
- 业务组件禁止：用 bg / border / rounded / shadow / hover 拼出控件或卡片底——必须来自基础组件或 `pi-` 语义类。新控件外观 = 给基础组件加 variant。
- 新 `pi-` 类仍按「重复 ≥3 次」提取（STYLE.md §8）；控件型组合优先落成基础组件而不是 `pi-` 类。

### 存量豁免

transcript/ 的折叠头、AskCard 选项行、UiPrompt 选项行等非三档形态（Button / MenuItem / ListRow）的存量手写行不在本次收口范围；新代码一律走硬规则，存量被触碰时顺手迁移。

## 后果

- `ListRow`（select/quiet × md/lg，icon/label/hint/children 槽位）成为全宽行的唯一底座；`MenuItem` 增加 children 富内容槽（label 变可选）。
- 行 hover 统一为 `bg-select/60`：原 Sidebar 会话行 hover 是实色 `bg-select`，与 active 态无法区分。
- WorkspaceBar 底色 sunken→tint：ghost 按钮 hover 是 `bg-sunken`，条底与 hover 同色会让反馈消失，条底退一档。
