# 0016 包管理改用 pnpm workspace

## 背景

仓库根是 Electron 应用 `pi`，另有两个独立子项目：`agent-design/`（原名 `conversation-block-react/`，Vite 会话块复刻，独立 `package.json` + `package-lock.json`）与 `web-demo/`（Vite 演示站，没有自己的 `package.json`，借用根依赖，README 写明「不写入根 `package.json`」）。三者的依赖版本已经漂移：`vite` 根为 `^8.3.5`、子包为 `^8.3.6`；`@types/node` 根为 `^26.6.6`、子包为 `^24.19.2`；`typescript` 根为 `^7.0.2`、子包为 `~7.0.2`。`web-demo` 的脚本曾只能挂在根 `package.json` 上。

## 决策

1. **根保持为 Electron 应用，同时作为 workspace 成员**；子项目目录名不变（后续 `conversation-block-react/` 已改名为 `agent-design/`，见下方修订）。`pnpm-workspace.yaml` 的 `packages` 只列子项目目录（现为 `agent-design`、`web-demo`）。
2. **`web-demo` 成为独立包**：新增 `web-demo/package.json`，自己声明依赖；根 `package.json` 不再含 `web-demo` 脚本。
3. **共享版本走 `catalog:`**：所有共同依赖的版本只在 `pnpm-workspace.yaml` 的 `catalog` 写一次，子包用 `"catalog:"` 引用。版本以根原有范围为准。
4. **唯一锁文件**：删除根与子包的 `package-lock.json`，只保留 `pnpm-lock.yaml`。
5. **`nodeLinker: hoisted`**（写在 `pnpm-workspace.yaml`，不是 `.npmrc`）：`scripts/pack.mjs` 的生产依赖拷贝依赖扁平 `node_modules`。默认的符号链接布局会让这段逻辑失效。`pack.mjs` 改用 `pnpm ls --prod --depth Infinity --parseable`，并对路径去重（pnpm 输出里同一路径可能有正反斜杠两种写法）。
6. **`packageManager: pnpm@12.18.0`** 固定版本。命令统一为 `pnpm`；`dev.cmd`、`run.cmd`、`pack.mjs` 同步。
7. **`allowBuilds`** 白名单放行 `electron`、`protobufjs`、`@google/genai`。pnpm 12 默认禁止安装脚本，不加白名单则安装失败（`ERR_PNPM_IGNORED_BUILDS`）。

## 否掉的方案

- **保留 npm，只加 workspaces 字段**：可以，但版本仍会漂移，且 `web-demo` 仍无独立依赖声明。
- **pnpm 默认布局（符号链接）**：`pack.mjs` 的扁平拷贝逻辑需要整体重写，改动范围大；本次先保持扁平布局，等有需要再重写。

## 后果

- 装依赖、跑脚本一律用 `pnpm`。`npm install` 会生成 `package-lock.json` 并破坏扁平布局，AGENTS.md 已写明禁止。
- Electron 运行时下载走 GitHub，在某些网络下会 `fetch failed`；本机使用 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` 重新安装成功。
- 升级共享依赖只改 `pnpm-workspace.yaml` 的 `catalog`，然后跑 `pnpm install`。
- `@types/node` 在子包里从 `^24` 统一到 `^26`，类型检查通过（`conversation-block-react` 的 `build` 与 `check`、`web-demo` 的 `typecheck`、根的 `typecheck` 均 exit 0）。

## 修订

- 子项目 `conversation-block-react/` 改名为 `agent-design/`（包名 `agent-design`，`git mv` 保留历史）。pnpm 命令改为 `pnpm --filter agent-design <script>`。上文历史段落保留原名以反映当时状态。
