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
