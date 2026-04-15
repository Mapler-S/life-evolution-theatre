import { useEffect, useState } from 'react'
import { fetchJson } from '../utils/apiClient'
import type {
  AsyncResult,
  DiversityPoint,
  DiversityResolution,
  GeoInterval,
  Occurrence,
  TaxonNode,
} from '../types'

/**
 * PBDB (Paleobiology Database) API 封装
 * 文档：https://paleobiodb.org/data1.2/
 */
const PBDB_BASE = 'https://paleobiodb.org/data1.2'

interface PBDBResponse<T> {
  records: T[]
  elapsed_time?: number
}

// ============================================================
// 1. 多样性曲线
// ============================================================

/**
 * 获取属级或科级多样性随地质阶的变化
 * 例：fetchDiversity('Metazoa', 'stage')
 */
export async function fetchDiversity(
  taxon: string,
  resolution: DiversityResolution = 'stage',
  signal?: AbortSignal,
): Promise<DiversityPoint[]> {
  const url = new URL(`${PBDB_BASE}/occs/diversity.json`)
  url.searchParams.set('base_name', taxon)
  url.searchParams.set('count', 'genera')
  url.searchParams.set('time_reso', resolution)
  const res = await fetchJson<PBDBResponse<DiversityPoint>>(url.toString(), {
    signal,
  })
  return res.records
}

// ============================================================
// 2. 分类树
// ============================================================

/**
 * 获取某分类群在某地质时期的下级分类单元列表
 * 例：fetchTaxaTree('Metazoa', 'Permian')
 */
export async function fetchTaxaTree(
  baseName: string,
  interval?: string,
  signal?: AbortSignal,
): Promise<TaxonNode[]> {
  const url = new URL(`${PBDB_BASE}/taxa/list.json`)
  url.searchParams.set('base_name', baseName)
  url.searchParams.set('rel', 'all_children')
  url.searchParams.set('show', 'attr,app,size')
  if (interval) url.searchParams.set('interval', interval)
  const res = await fetchJson<PBDBResponse<TaxonNode>>(url.toString(), {
    signal,
  })
  return res.records
}

/**
 * 将扁平的 TaxonNode[] 构建成父子树结构。
 * PBDB 返回的列表通过 `par` 字段关联父节点。
 */
export function buildTaxaTree(flat: TaxonNode[]): TaxonNode[] {
  const byId = new Map<string, TaxonNode>()
  flat.forEach((n) => byId.set(n.oid, { ...n, children: [] }))
  const roots: TaxonNode[] = []
  byId.forEach((node) => {
    if (node.par && byId.has(node.par)) {
      byId.get(node.par)!.children!.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

// ============================================================
// 3. 化石产地坐标
// ============================================================

/**
 * 获取化石出现记录，包含古地理坐标
 * 例：fetchOccurrences('Dinosauria', { interval: 'Cretaceous' })
 */
export interface OccurrencesQuery {
  /** 命名时期，如 "Cretaceous" */
  interval?: string
  /** 时间范围上界（Ma，较老） */
  max_ma?: number
  /** 时间范围下界（Ma，较新） */
  min_ma?: number
  /** 返回条数上限 */
  limit?: number
}

/** PBDB 紧凑词汇表（默认）的原始响应字段 */
interface PBDBOccurrenceRaw {
  oid: string
  cid?: string
  idn?: string
  tna?: string
  /** 注意：PBDB 紧凑词汇返回的 lng/lat 是字符串 */
  lng?: string | number
  lat?: string | number
  /** paleoloc show 对应的字段：pln=paleolng, pla=paleolat */
  pln?: number
  pla?: number
  phl?: string
  cll?: string
  odl?: string
  oei?: string
  oli?: string
  eag?: number
  lag?: number
}

function toNum(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  if (typeof v === 'string' && v.length) {
    const n = Number.parseFloat(v)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

export async function fetchOccurrences(
  taxon: string,
  query: OccurrencesQuery = {},
  signal?: AbortSignal,
): Promise<Occurrence[]> {
  const url = new URL(`${PBDB_BASE}/occs/list.json`)
  url.searchParams.set('base_name', taxon)
  url.searchParams.set('show', 'coords,phylo,time,paleoloc')
  if (query.interval) url.searchParams.set('interval', query.interval)
  if (typeof query.max_ma === 'number')
    url.searchParams.set('max_ma', String(query.max_ma))
  if (typeof query.min_ma === 'number')
    url.searchParams.set('min_ma', String(query.min_ma))
  url.searchParams.set('limit', String(query.limit ?? 500))
  const res = await fetchJson<PBDBResponse<PBDBOccurrenceRaw>>(url.toString(), {
    signal,
  })
  // 规范化：lng/lat 字符串 → number，pln/pla → paleolng/paleolat
  const out: Occurrence[] = []
  for (const r of res.records) {
    const lng = toNum(r.lng)
    const lat = toNum(r.lat)
    if (lng === undefined || lat === undefined) continue
    out.push({
      oid: r.oid,
      cid: r.cid,
      idn: r.idn,
      tna: r.tna,
      lng, lat,
      paleolng: toNum(r.pln),
      paleolat: toNum(r.pla),
      phl: r.phl,
      cll: r.cll,
      odl: r.odl,
      oei: r.oei,
      oli: r.oli,
      eag: r.eag,
      lag: r.lag,
    })
  }
  return out
}

// ============================================================
// 4. 地质年代表
// ============================================================

/**
 * 获取完整的国际年代地层表（ICS scale）
 * scale_level: 1=宙, 2=代, 3=纪, 4=世, 5=期
 */
export async function fetchTimeIntervals(
  scaleLevel: 1 | 2 | 3 | 4 | 5 = 3,
  signal?: AbortSignal,
): Promise<GeoInterval[]> {
  const url = new URL(`${PBDB_BASE}/intervals/list.json`)
  url.searchParams.set('scale', '1')
  url.searchParams.set('scale_level', String(scaleLevel))
  const res = await fetchJson<PBDBResponse<GeoInterval>>(url.toString(), {
    signal,
    ttl: 60 * 60 * 1000, // 年代表基本不变，缓存 1 小时
  })
  return res.records
}

// ============================================================
// React Hook 封装
// ============================================================

type Fetcher<T, Args extends readonly unknown[]> = (
  ...args: [...Args, AbortSignal]
) => Promise<T>

/**
 * 通用的异步数据 hook 工厂：
 * - 参数变化时取消前次请求并重新拉取
 * - 组件卸载时自动 abort
 */
function useAsync<T, Args extends readonly unknown[]>(
  fetcher: Fetcher<T, Args>,
  args: Args,
  enabled = true,
): AsyncResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // 以 JSON 序列化参数做依赖，避免 args 数组每次新引用触发重拉
  const key = JSON.stringify(args)

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetcher(...args, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result)
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  return { data, loading, error }
}

export function useDiversity(
  taxon: string,
  resolution: DiversityResolution = 'stage',
): AsyncResult<DiversityPoint[]> {
  return useAsync(fetchDiversity, [taxon, resolution] as const, !!taxon)
}

export function useTaxaTree(
  baseName: string,
  interval?: string,
): AsyncResult<TaxonNode[]> {
  return useAsync(fetchTaxaTree, [baseName, interval] as const, !!baseName)
}

export function useOccurrences(
  taxon: string,
  query: OccurrencesQuery = {},
): AsyncResult<Occurrence[]> {
  return useAsync(fetchOccurrences, [taxon, query] as const, !!taxon)
}

export function useTimeIntervals(
  scaleLevel: 1 | 2 | 3 | 4 | 5 = 3,
): AsyncResult<GeoInterval[]> {
  return useAsync(fetchTimeIntervals, [scaleLevel] as const)
}
