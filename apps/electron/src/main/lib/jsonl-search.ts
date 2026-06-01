import {
  findFirstJsonlEventMatch,
} from './native-runtime/jsonl-event-reader'

export interface SearchSnippetResult {
  snippet: string
  matchStart: number
  matchLength: number
}

/**
 * 为命中内容构造前后文片段。
 *
 * 规则与旧实现保持一致：前后各截取约 40 个字符，
 * 命中不在首尾时补 `...`，并将 matchStart 对齐到 snippet 内坐标。
 */
export function buildSearchSnippet(
  content: string,
  query: string,
  queryLower: string,
): SearchSnippetResult | null {
  const matchIndex = content.toLowerCase().indexOf(queryLower)
  if (matchIndex === -1) return null

  const snippetStart = Math.max(0, matchIndex - 40)
  const snippetEnd = Math.min(content.length, matchIndex + query.length + 40)
  const prefix = snippetStart > 0 ? '...' : ''
  const suffix = snippetEnd < content.length ? '...' : ''

  return {
    snippet: prefix + content.slice(snippetStart, snippetEnd) + suffix,
    matchStart: matchIndex - snippetStart + prefix.length,
    matchLength: query.length,
  }
}

/**
 * 逐行流式扫描 JSONL 文件，返回第一条匹配结果。
 *
 * 读取过程对坏行容错：JSON 解析失败时跳过，不中断整个搜索。
 */
export async function findFirstJsonlMatch<TParsed, TResult>(
  filePath: string,
  buildResult: (parsed: TParsed) => TResult | null | Promise<TResult | null>,
): Promise<TResult | null> {
  return findFirstJsonlEventMatch<TParsed, TResult>(
    filePath,
    ({ record }) => buildResult(record),
  )
}
