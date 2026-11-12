import { useState, type ReactNode } from 'react'
import type { Block } from '@shared/blocks'
import type { TurnSpan } from '../../../store/timeline'
import { Button } from '../../base/Button'
import { StaticTranscript } from './Transcript'

type Mode = 'running' | 'done' | 'error'

/** 会话块设计稿：同一条事件链的三种时刻，不复制一套仅供展示的外观。 */
export function SessionBlockPreview(): ReactNode {
  const [mode, setMode] = useState<Mode>('running')
  const running = mode === 'running'
  const failed = mode === 'error'
  const state = running ? 'running' : failed ? 'error' : 'done'
  const blocks: Block[] = [
    {
      kind: 'user',
      id: 'design-user',
      text: '检查会话事件的错误处理，修复请求失败后代码块没有展示错误信息的问题。'
    },
    {
      kind: 'thinking',
      id: 'design-thinking',
      level: '高',
      streaming: running,
      durationMs: 6800,
      text: '先确认 toolCall 与 toolResult 的关联方式，再检查加载、完成和失败三种状态，并把每一个工具的输入、执行过程和输出接回同一条事件链，避免参数流式更新时丢失上下文。\n\n错误信息应该直接来自工具结果，不能在渲染层吞掉。参数流式生成时也要保留可识别的加载提示。'
    },
    {
      kind: 'tool',
      id: 'design-read',
      name: 'read',
      args: '{"path":"src/renderer/src/store/timeline.ts","offset":70,"limit":40}',
      state: 'done',
      output: ' 89 | const r = results.get(c.id)\n 90 | const details = r?.details\n 91 | const args = c.arguments\n 99 | kind: \'tool\',\n100 | id: `tc-${c.id}`'
    },
    {
      kind: 'tool',
      id: 'design-grep',
      name: 'grep',
      args: '{"pattern":"isError|toolResult","path":"src/renderer/src"}',
      state: 'done',
      output: 'src/renderer/src/store/timeline.ts:104: state: r ? (r.isError ? \'error\' : \'done\') : \'running\'\nsrc/renderer/src/store/timeline.ts:114: toolResult 配对进工具行'
    },
    {
      kind: 'tool',
      id: 'design-terminal',
      name: 'powershell',
      args: '{"command":"npm run typecheck"}',
      state,
      output: running ? undefined : failed ? 'src/renderer/src/mockTimeline.ts(85,7): error TS2741: Property \'errorCount\' is missing.' : '> tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json'
    },
    {
      kind: 'tool',
      id: 'design-edit',
      name: 'edit',
      args: '{"path":"src/renderer/src/components/business/transcript/tool/StepRow.tsx"}',
      state: running ? 'running' : 'done',
      diff: {
        id: 'design-diff',
        file: 'StepRow.tsx',
        added: 8,
        removed: 1,
        lines: [
          { type: 'del', text: "state === 'error' ? <span>失败</span> : null", no: 111 },
          { type: 'add', text: "state === 'error' ? <IconClose /> : null", no: 111 },
          { type: 'add', text: "state === 'done' ? <IconCheck /> : null", no: 112 }
        ]
      }
    },
    {
      kind: 'assistant',
      id: 'design-assistant',
      text: running ? '正在把工具结果接回对应的调用…' : '已统一会话块的状态与工具展示，失败原因可以直接展开查看。'
    }
  ]
  const span: TurnSpan = {
    key: 'design-turn',
    userId: 'design-user',
    ids: blocks.slice(1).map((b) => b.id),
    startedAt: 0,
    durationMs: running ? 0 : 24500,
    stepCount: 5,
    noteCount: 1,
    toolCount: 4,
    errorCount: failed ? 1 : 0,
    live: running,
    ...(running ? { activity: { kind: 'tool', toolName: 'powershell', detail: 'npm run typecheck' } as const } : {}),
    aborted: false
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1" role="group" aria-label="会话块状态">
        {(['running', 'done', 'error'] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={mode === value ? 'secondary' : 'ghost'}
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
          >
            {value === 'running' ? '进行中' : value === 'done' ? '已完成' : '失败'}
          </Button>
        ))}
        <span className="ml-auto text-xs text-faint">同一组 Block · 三种状态</span>
      </div>
      <div className="pi-panel p-4">
        <StaticTranscript turns={[{ span, blocks }]} defaultOpen />
      </div>
    </div>
  )
}
