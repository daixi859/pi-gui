// 打绿色版：release/Pi/ 整个文件夹拷走就能双击 Pi.exe 跑，不依赖本仓库。
// 用法：npm run release
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'release', 'Pi')
const app = join(out, 'resources', 'app')

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true })
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} 失败`)
}

console.log('› 构建')
run('npx', ['electron-vite', 'build'])

console.log('› 清空', relative(root, out))
rmSync(out, { recursive: true, force: true })
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
// npm ls 对 extraneous 包会返回非零，只要 stdout 有东西就照抄
const list = spawnSync('npm', ['ls', '--omit=dev', '--all', '--parseable'], {
  cwd: root,
  encoding: 'utf8',
  shell: true
})
const dirs = String(list.stdout ?? '')
  .split('\n')
  .map((s) => s.trim())
  .filter((p) => p && p !== root && existsSync(p))
if (!dirs.length) throw new Error('npm ls 没列出生产依赖：' + list.error)
for (const dir of dirs) cpSync(dir, join(app, 'node_modules', relative(join(root, 'node_modules'), dir)), { recursive: true })

console.log('› 写启动器')
writeFileSync(join(out, '启动 Pi.cmd'), '@echo off\r\nstart "" "%~dp0Pi.exe"\r\n')

console.log(`\n完成：${out}\n双击 Pi.exe 或「启动 Pi.cmd」即可运行。`)
