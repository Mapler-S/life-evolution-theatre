/**
 * 灭绝事件诊断分析 —— 跨维度对比统计
 *
 * 输入：灭绝前 / 后两个时间窗口内的 PBDB 化石记录
 * 输出：多维度对比指标 + 自动生成的中文洞察
 */

import type { ExtinctionEvent, Occurrence } from '../types'

export interface DiagnosticMetrics {
  /** 化石条数（原始） */
  occCount: number
  /** 属数（按 tna 首词去重） */
  generaCount: number
  /** 门级计数 */
  phyla: Map<string, number>
  /** 纲级计数 */
  classes: Map<string, number>
  /** 纬度范围（paleolat 优先） */
  latRange: [number, number]
  /** 纬度跨度（°） */
  latSpread: number
  /** 经度范围 */
  lngRange: [number, number]
  /** 按 10° 纬度带统计的化石数，用于 ridge/bar */
  latBands: { band: number; count: number }[]
  /** 原始化石（用于 mini-map 散点） */
  occurrences: Occurrence[]
}

/** 单个门/纲在前后两窗口的对比 */
export interface TaxonChange {
  name: string
  level: 'phylum' | 'class'
  before: number
  after: number
  /** 丢失绝对数 */
  loss: number
  /** 丢失率 0-1，before=0 视为新生（返回 -1 表示 infinity 上升） */
  lossRate: number
  /** 存续率 0-1 */
  survivalRate: number
}

export interface DiagnosticResult {
  before: DiagnosticMetrics
  after: DiagnosticMetrics

  /** 关键跨维度变化（门/纲级 top N，按 before 丰度排序） */
  groupChanges: TaxonChange[]

  /** 派生指标 */
  derived: {
    generaDropRate: number   // (before-after)/before
    occDropRate: number
    latShrinkRate: number    // (beforeSpread-afterSpread)/beforeSpread
    /** 幸存类群数（after > 0 的门） */
    survivedPhyla: number
    /** 完全消失的门 */
    extinctPhyla: string[]
    /** 新出现的门（before=0, after>0，可能是采样不足导致的伪阳性） */
    newPhyla: string[]
  }

  /** 自动生成的中文洞察句（2-4 条） */
  insights: string[]
}

/* ══════════════════════════════════════════════════ */

function genusOf(tna?: string): string | null {
  if (!tna) return null
  const first = tna.trim().split(/\s+/)[0]
  return first.length > 1 ? first : null
}

/** 以 paleolat 优先、回退到现代 lat */
function lat(o: Occurrence): number | null {
  const v = o.paleolat ?? o.lat
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function lng(o: Occurrence): number | null {
  const v = o.paleolng ?? o.lng
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function computeMetrics(occs: Occurrence[]): DiagnosticMetrics {
  const phyla = new Map<string, number>()
  const classes = new Map<string, number>()
  const genera = new Set<string>()
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180

  // 10° 纬度带计数（-90..90 → 18 个桶）
  const bands = new Array(18).fill(0) as number[]

  for (const o of occs) {
    if (o.phl) phyla.set(o.phl, (phyla.get(o.phl) ?? 0) + 1)
    if (o.cll) classes.set(o.cll, (classes.get(o.cll) ?? 0) + 1)
    const g = genusOf(o.tna ?? o.idn)
    if (g) genera.add(g)
    const la = lat(o), lo = lng(o)
    if (la !== null) {
      if (la < minLat) minLat = la
      if (la > maxLat) maxLat = la
      const idx = Math.min(17, Math.max(0, Math.floor((la + 90) / 10)))
      bands[idx]++
    }
    if (lo !== null) {
      if (lo < minLng) minLng = lo
      if (lo > maxLng) maxLng = lo
    }
  }

  if (minLat > maxLat) { minLat = 0; maxLat = 0 }
  if (minLng > maxLng) { minLng = 0; maxLng = 0 }

  return {
    occCount: occs.length,
    generaCount: genera.size,
    phyla,
    classes,
    latRange: [Math.round(minLat), Math.round(maxLat)],
    latSpread: Math.round(maxLat - minLat),
    lngRange: [Math.round(minLng), Math.round(maxLng)],
    latBands: bands.map((count, i) => ({
      band: -90 + i * 10 + 5,   // 带中心（度）
      count,
    })),
    occurrences: occs,
  }
}

/* ══════════════════════════════════════════════════ */

/** 合并两份 Map，返回按"before+after 合计"排序的前 N 个 key */
function topKeys(
  a: Map<string, number>,
  b: Map<string, number>,
  n: number,
): string[] {
  const all = new Map<string, number>()
  for (const [k, v] of a) all.set(k, (all.get(k) ?? 0) + v)
  for (const [k, v] of b) all.set(k, (all.get(k) ?? 0) + v)
  return [...all.entries()]
    .filter(([k]) => k && k !== 'Unknown')
    .sort((x, y) => y[1] - x[1])
    .slice(0, n)
    .map(([k]) => k)
}

export function computeDiagnostic(
  beforeOccs: Occurrence[],
  afterOccs: Occurrence[],
  event: ExtinctionEvent,
): DiagnosticResult {
  const before = computeMetrics(beforeOccs)
  const after = computeMetrics(afterOccs)

  // 门级对比（Top 10）
  const phylaKeys = topKeys(before.phyla, after.phyla, 10)
  const phylaChanges: TaxonChange[] = phylaKeys.map((name) => {
    const b = before.phyla.get(name) ?? 0
    const a = after.phyla.get(name) ?? 0
    const loss = b - a
    const lossRate = b > 0 ? Math.max(0, loss / b) : -1
    return {
      name, level: 'phylum',
      before: b, after: a, loss, lossRate,
      survivalRate: b > 0 ? Math.min(1, a / b) : 1,
    }
  })

  const genDrop = before.generaCount > 0
    ? (before.generaCount - after.generaCount) / before.generaCount : 0
  const occDrop = before.occCount > 0
    ? (before.occCount - after.occCount) / before.occCount : 0
  const latShrink = before.latSpread > 0
    ? (before.latSpread - after.latSpread) / before.latSpread : 0

  const extinctPhyla: string[] = []
  const newPhyla: string[] = []
  for (const [k, v] of before.phyla) if (v > 0 && (after.phyla.get(k) ?? 0) === 0) extinctPhyla.push(k)
  for (const [k, v] of after.phyla) if (v > 0 && (before.phyla.get(k) ?? 0) === 0) newPhyla.push(k)
  const survivedPhyla = [...before.phyla.entries()].filter(
    ([k, v]) => v > 0 && (after.phyla.get(k) ?? 0) > 0,
  ).length

  /* ── 自动洞察 ── */
  const insights: string[] = []
  if (before.generaCount > 0) {
    const pct = Math.round(genDrop * 100)
    if (pct > 40) insights.push(
      `属级多样性骤降 ${pct}%（${before.generaCount} → ${after.generaCount}），${event.nameZh}的冲击在数据上清晰可辨。`,
    )
    else if (pct > 10) insights.push(
      `属级多样性下降 ${pct}%，灭绝选择性明显但未波及全部类群。`,
    )
    else if (pct < -5) insights.push(
      `样本窗口内属级数量反而上升（${Math.abs(pct)}%），可能为采样偏差或辐射期延续。`,
    )
  }
  if (Math.abs(latShrink) > 0.2) {
    const pct = Math.round(Math.abs(latShrink) * 100)
    if (latShrink > 0) insights.push(
      `生物地理跨度收缩 ${pct}%（${before.latSpread}° → ${after.latSpread}° 纬度），高纬度类群首当其冲。`,
    )
    else insights.push(
      `灭绝后地理跨度反而扩张 ${pct}%，幸存者在空缺生态位中迅速扩散。`,
    )
  }
  if (extinctPhyla.length > 0) {
    insights.push(
      `${extinctPhyla.slice(0, 3).join(' / ')} 等 ${extinctPhyla.length} 个门在窗口内完全消失。`,
    )
  }
  const hardestHit = phylaChanges
    .filter((c) => c.lossRate > 0.5 && c.before >= 5)
    .sort((a, b) => b.lossRate - a.lossRate)[0]
  if (hardestHit) {
    insights.push(
      `重灾区：${hardestHit.name} 损失率 ${Math.round(hardestHit.lossRate * 100)}%（${hardestHit.before} → ${hardestHit.after}）。`,
    )
  }
  if (insights.length === 0) {
    insights.push('样本量在此事件附近较少，差异信号尚不足以支撑强结论。尝试扩大时间窗口或切换类群。')
  }

  return {
    before, after,
    groupChanges: phylaChanges,
    derived: {
      generaDropRate: genDrop,
      occDropRate: occDrop,
      latShrinkRate: latShrink,
      survivedPhyla,
      extinctPhyla,
      newPhyla,
    },
    insights,
  }
}
