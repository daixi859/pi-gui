import type { McpToolCallData } from '../../ocu/McpToolDecisionCard'

export type ApprovalVerdict = 'allow_once' | 'always_allow' | 'deny'
export type ApprovalRisk = 'low' | 'medium' | 'high'

export interface ApprovalRequest {
  id: string
  reason: string
  risk: ApprovalRisk
  requestedAt: number
  toolCall: McpToolCallData
}

const now = Date.now()

export const APPROVAL_REQUESTS: ApprovalRequest[] = [
  {
    id: 'approval-port-5179',
    reason: '开发服务器端口被占用，需要结束旧的 Node 进程后重启。',
    risk: 'medium',
    requestedAt: now - 4 * 60_000,
    toolCall: {
      id: 'call_powershell_12884',
      toolName: 'powershell',
      serverUrl: 'cli://powershell',
      inputParams: {
        command: 'Get-Process -Id 12884 | Select-Object Id, ProcessName, Path',
        workdir: 'D:\\workspace\\PiGui',
        timeoutMs: 15000
      },
      resultOutput: 'Id  ProcessName  Path\n--  -----------  ----\n12884  node  C:\\Program Files\\nodejs\\node.exe',
      executionDurationMs: 640
    }
  },
  {
    id: 'approval-edit-app',
    reason: '代理准备修改应用入口，把新的页面外壳接进 App.tsx。',
    risk: 'high',
    requestedAt: now - 18 * 60_000,
    toolCall: {
      id: 'call_edit_77a1',
      toolName: 'edit',
      serverUrl: 'fs://workspace',
      inputParams: {
        file_path: 'D:\\workspace\\PiGui\\web-demo\\src\\App.tsx',
        oldText: 'export function App() {\n  return <ChatPage />\n}',
        newText: 'export function App() {\n  return <AppShell />\n}'
      },
      resultOutput: 'Successfully replaced 1 occurrence(s) in App.tsx.',
      executionDurationMs: 180
    }
  },
  {
    id: 'approval-github-pr',
    reason: '你让我把 web demo 的改动整理成一个 PR，需要调用 GitHub MCP 创建。',
    risk: 'low',
    requestedAt: now - 32 * 60_000,
    toolCall: {
      id: 'call_github_pr_2048',
      toolName: 'mcp__github__create_pull_request',
      serverUrl: 'mcp://github',
      inputParams: {
        owner: 'Caho1',
        repo: 'PiGui',
        title: 'feat: web demo with multi-page shell',
        head: 'web-demo',
        base: 'master',
        body: '演示会话列表、工具审批与设置页，全部使用 pi 历史 mock 数据。',
        draft: true
      },
      resultOutput: 'Created draft pull request #42: https://github.com/Caho1/PiGui/pull/42',
      executionDurationMs: 1240
    }
  }
]

export const RISK_META: Record<
  ApprovalRisk,
  { label: string; className: string; barClassName: string }
> = {
  low: {
    label: '低风险',
    className:
      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    barClassName: 'bg-emerald-500'
  },
  medium: {
    label: '需留意',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    barClassName: 'bg-amber-500'
  },
  high: {
    label: '高风险',
    className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    barClassName: 'bg-red-500'
  }
}

export const VERDICT_LABEL: Record<ApprovalVerdict, string> = {
  allow_once: '单次批准',
  always_allow: '始终允许',
  deny: '拒绝'
}
