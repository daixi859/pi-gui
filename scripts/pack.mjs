// 打绿色版：release/Pi/ 整个文件夹拷走就能双击 Pi.exe 跑，不依赖本仓库。
// 用法：pnpm run release
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'release', 'Pi')
const app = join(out, 'resources', 'app')

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true })
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} 失败`)
}

console.log('› 构建')
run('pnpm', ['exec', 'electron-vite', 'build'])

// 只清 out 里的内容，保留 out 目录本身（它可能被占用或是有特殊权限的目录）
console.log('› 清空', relative(root, out))
mkdirSync(out, { recursive: true })
for (const name of readdirSync(out)) rmSync(join(out, name), { recursive: true, force: true })
mkdirSync(app, { recursive: true })

console.log('› 拷贝 Electron 运行时')
cpSync(join(root, 'node_modules', 'electron', 'dist'), out, { recursive: true })
renameSync(join(out, 'electron.exe'), join(out, 'Pi.exe'))
rmSync(join(out, 'resources', 'default_app.asar'), { force: true })

console.log('› 拷贝应用产物')
cpSync(join(root, 'out'), join(app, 'out'), { recursive: true })
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
writeFileSync(
  join(app, 'package.json'),
  JSON.stringify({ name: pkg.name, version: pkg.version, main: 'out/main/index.js' }, null, 2)
)

// agent-host 在运行时 import pi SDK，所以生产依赖必须实打实躺在磁盘上。
// 按本地 node_modules 的扁平化布局原样复制，离线也能打包。
console.log('› 拷贝生产依赖（约 700MB，慢）')
// pnpm ls 对 extraneous 包会返回非零，只要 stdout 有东西就照抄。
// pnpm-workspace.yaml 的 nodeLinker=hoisted 保证 node_modules 是扁平布局，这里的路径拷贝才成立。
const list = spawnSync('pnpm', ['ls', '--prod', '--depth', 'Infinity', '--parseable'], {
  cwd: root,
  encoding: 'utf8',
  shell: true
})
// 同一个包在输出里可能出现正/反斜杠两种写法，按规范化路径去重，避免重复拷贝。
const dirs = [
  ...new Set(
    String(list.stdout ?? '')
      .split('\n')
      .map((s) => s.trim())
      .filter((p) => p && existsSync(p))
      .map((p) => normalize(p))
      .filter((p) => p !== normalize(root))
  )
]
if (!dirs.length) throw new Error('pnpm ls 没列出生产依赖：' + list.error)
for (const dir of dirs) cpSync(dir, join(app, 'node_modules', relative(join(root, 'node_modules'), dir)), { recursive: true })

console.log('› 写启动器')
writeFileSync(join(out, '启动 Pi.cmd'), '@echo off\r\nstart "" "%~dp0Pi.exe"\r\n')

console.log(`\n完成：${out}\n双击 Pi.exe 或「启动 Pi.cmd」即可运行。`)
