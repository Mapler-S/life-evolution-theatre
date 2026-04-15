/**
 * AI 提示词构造 —— 按场景把上下文拼成高质量 prompt
 *
 * 设计原则：
 * - 基础 prompt 留给 composePrompt() 再叠加风格尾缀，避免重复
 * - 每种场景保证 ≤ 400 字符，兼容大多数 AI 绘图后端的 prompt 长度
 * - 受影响类群取前 3 个，避免过长稀释主题
 */

import type { ExtinctionEvent, TaxonNode } from '../types'

/** 场景 A / D —— 按地质时期生成生态复原 */
export function buildIntervalPrompt(opts: {
  intervalName: string
  startMa: number
  endMa: number
  dominantTaxa?: string[]
}): string {
  const taxa = (opts.dominantTaxa ?? []).slice(0, 4).join(', ')
  const mid = Math.round((opts.startMa + opts.endMa) / 2)
  return [
    `Scientific paleontological reconstruction of the ${opts.intervalName}`,
    `(${opts.startMa}–${opts.endMa} Ma, ~${mid} Ma) ecosystem`,
    taxa && `featuring ${taxa}`,
    'detailed environment with accurate flora and fauna',
  ].filter(Boolean).join(', ')
}

/** 场景 B —— 按分类群生成科研级复原图 */
export function buildTaxonPrompt(opts: {
  taxonName: string
  description?: string
  intervalName?: string
}): string {
  return [
    `Detailed scientific reconstruction of ${opts.taxonName}`,
    opts.description && opts.description,
    opts.intervalName && `from the ${opts.intervalName}`,
    'showing anatomical features and skin / plumage texture',
  ].filter(Boolean).join(', ')
}

/** 场景 C —— 灭绝前后对比双联画 */
export function buildExtinctionDiptychPrompt(ev: ExtinctionEvent): string {
  const affected = ev.affectedTaxa.slice(0, 3).join(', ')
  return [
    `Diptych scientific illustration of the ${ev.name}`,
    `LEFT panel: thriving ${ev.intervalBefore} ecosystem with ${affected} flourishing`,
    `RIGHT panel: desolate ${ev.intervalAfter} landscape after extinction`,
    'side-by-side composition, dramatic contrast between life and devastation',
  ].join(', ')
}

/** 根据当前选择，自动推荐默认 prompt（给"一键生成"用） */
export function buildDefaultPrompt(
  extinction: ExtinctionEvent | null,
  taxon: TaxonNode | null,
): { prompt: string; scene: 'diptych' | 'taxon' | 'idle' } {
  if (extinction) return { prompt: buildExtinctionDiptychPrompt(extinction), scene: 'diptych' }
  if (taxon) return { prompt: buildTaxonPrompt({ taxonName: stripParen(taxon.nam) }), scene: 'taxon' }
  return { prompt: '', scene: 'idle' }
}

/** "Dinosauria (non-avian)" → "Dinosauria" */
function stripParen(name: string): string {
  return name.replace(/\s*\([^)]*\)/g, '').trim()
}
