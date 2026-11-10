/** 首行：落定后的思考预览 */
function firstLine(text: string): string {
  const newline = text.indexOf('\n')
  return newline === -1 ? text : text.slice(0, newline)
}

/**
 * 最后一个「已完成段落」的首行。段落由空行分隔，只有整段写完（出现空行，或段落之后
 * 又开了新行）才推进——段内 token 再多也不动 header，这样预览的更新是离散的。
 * 照 deepseek-harness 的 ReasoningRow。
 */
function latestCompletedParagraphFirstLine(text: string): string {
  let summary = ''
  let paragraphStart = 0
  const separator = /\r?\n(?:[\t ]*\r?\n)+/g
  for (;;) {
    const nextParagraph = separator.exec(text)
    const paragraphEnd = nextParagraph === null ? text.length : nextParagraph.index + nextParagraph[0].indexOf('\n')
    const newline = text.indexOf('\n', paragraphStart)
    if (newline !== -1 && newline <= paragraphEnd) {
      const candidate = text.slice(paragraphStart, newline).trim()
      if (candidate !== '') summary = candidate
    }
    if (nextParagraph === null) return summary
    paragraphStart = nextParagraph.index + nextParagraph[0].length
  }
}

/** 思考行 header 的摘要：流式中取已完成段落首行、落定取首行，去掉粗体标记（照 deepseek-harness） */
export function reasoningSummary(text: string, running: boolean): string {
  return (running ? latestCompletedParagraphFirstLine(text) : firstLine(text)).replaceAll('**', '')
}

const LIVE_DETAIL_MAX = 160
const detailGraphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/** 一行任务摘要：压空白、去粗体标记，超长按 grapheme 截断加省略号（照 deepseek-harness 的 normalizeLiveToolText） */
function normalizeDetail(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= LIVE_DETAIL_MAX) return normalized
  const segments: string[] = []
  for (const { segment } of detailGraphemes.segment(normalized)) {
    if (segments.length === LIVE_DETAIL_MAX) {
      return `${segments.slice(0, LIVE_DETAIL_MAX - 1).join('').trimEnd()}…`
    }
    segments.push(segment)
  }
  return normalized
}

/**
 * 进行中的思考在分组头里报什么：最后一个非空段落（不是首行）。
 * 分组头要的是「模型此刻在写的那一段」，思考行自己的摘要要的是「已经写完的段落首行」——两者刻意不同。
 * 照 deepseek-harness 的 liveReasoningDetail。
 */
export function liveReasoningDetail(text: string): string {
  const paragraphs = text.split(/\r?\n[\t ]*\r?\n/)
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    const detail = normalizeDetail((paragraphs[i] ?? '').replaceAll('**', ''))
    if (detail !== '') return detail
  }
  return ''
}

/** 时长文案：不足一秒按一秒报，其余向上取整到秒 */
export function workTime(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000))
  if (s < 60) return `${s} 秒`
  const m = Math.floor(s / 60)
  const rest = s % 60
  if (m < 60) return rest ? `${m} 分 ${rest} 秒` : `${m} 分`
  return `${Math.floor(m / 60)} 小时 ${m % 60} 分`
}
