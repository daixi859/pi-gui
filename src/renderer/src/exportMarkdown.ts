import type { Block } from '@shared/blocks'

/** 把一个块序列化成 Markdown；turn 展开子块 */
function line(b: Block): string {
  switch (b.kind) {
    case 'user':
      return `**我**\n\n${b.text}`
    case 'assistant':
      return b.text
    case 'thinking':
      return `<details><summary>Thinking</summary>\n\n${b.text}\n\n</details>`
    case 'tool':
      return `> 工具 \`${b.name}\` · ${b.state}${b.output ? `\n>\n> ${b.output.replace(/\n/g, '\n> ')}` : ''}`
    case 'diff':
      return `> 修改 \`${b.file}\` +${b.added} -${b.removed}`
    case 'file':
      return `> 文件 \`${b.name}\` · ${b.meta}`
    case 'turn':
      return b.children.map(line).join('\n\n')
    case 'system':
      return `> ${b.text}`
  }
}

export function toMarkdown(blocks: Block[]): string {
  return blocks.map(line).join('\n\n---\n\n') + '\n'
}

/** 会话文件路径 → 所在目录 */
export function dirOf(path: string): string {
  return path.replace(/[\\/][^\\/]+$/, '')
}
