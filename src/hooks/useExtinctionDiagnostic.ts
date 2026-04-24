import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchOccurrences } from './usePBDB'
import { computeDiagnostic, type DiagnosticResult } from '../utils/diagnostic'
import type { ExtinctionEvent, Occurrence } from '../types'

/**
 * 诊断数据获取策略
 *
 * 背景：`base_name=Metazoa` 的全动物界查询对 PBDB 服务器压力极大，
 * 即使 limit=500 + 精简 show 也频繁返回 500（内部超时）。
 *
 * 解决：把 "所有动物" 拆为 8 个主要门，每个门独立查询小批量。
 * 每个单独请求 PBDB 能轻松处理，并发 8 个的总耗时反而比一个大查询还短。
 * 单个门请求失败不影响其他（.catch 兜底），实现部分可用。
 */
const MAJOR_PHYLA = [
  'Arthropoda',      // 节肢：三叶虫、海蝎、螃蟹
  'Brachiopoda',     // 腕足
  'Mollusca',        // 软体：菊石、双壳、腹足
  'Chordata',        // 脊索：鱼、爬行、哺乳
  'Echinodermata',   // 棘皮：海百合、海星
  'Cnidaria',        // 刺胞：珊瑚
  'Bryozoa',         // 苔藓虫
  'Porifera',        // 海绵
] as const

/** 每个门单查的 limit */
const PER_TAXON_LIMIT = 400
/** 精简 show —— 只保留诊断需要的门/纲 + 古地理坐标 */
const DIAG_SHOW = 'paleoloc,phylo'

/** 并发拉取 8 门在某个时间窗口的化石，合并结果。单门失败不影响整体。 */
async function fetchWindow(
  maxMa: number, minMa: number, signal: AbortSignal,
): Promise<Occurrence[]> {
  const results = await Promise.all(
    MAJOR_PHYLA.map(taxon =>
      fetchOccurrences(
        taxon,
        { max_ma: maxMa, min_ma: minMa, limit: PER_TAXON_LIMIT, show: DIAG_SHOW },
        signal,
      ).catch((err: unknown) => {
        // 单门失败：允许 abort 冒泡，其他错误吞掉（保留部分数据）
        if (err instanceof DOMException && err.name === 'AbortError') throw err
        console.warn(`[diagnostic] ${taxon} 获取失败，已跳过:`, err)
        return [] as Occurrence[]
      }),
    ),
  )
  return results.flat()
}

/**
 * 串行拉取灭绝事件前 / 后两个窗口的 PBDB 化石，
 * 再合并计算诊断指标。
 *
 * 为什么串行而非并发：
 * PBDB 对同 IP 并发大请求易触发限流 / ERR_CONNECTION_RESET，
 * 实测串行并加重试更稳定；总耗时通常 3~8s。
 */
export function useExtinctionDiagnostic(
  event: ExtinctionEvent | null,
  windowMa: number,
  enabled: boolean,
): {
  data: DiagnosticResult | null
  loading: boolean
  error: Error | null
  refetch: () => void
} {
  const [data, setData]       = useState<DiagnosticResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<Error | null>(null)
  const [nonce, setNonce]     = useState(0)

  // 参数指纹（避免对象引用抖动触发重跑）
  const key = useMemo(
    () => event ? `${event.id}|${windowMa}|${enabled ? 1 : 0}|${nonce}` : '',
    [event, windowMa, enabled, nonce],
  )

  useEffect(() => {
    if (!event || !enabled) { setData(null); setError(null); return }

    const controller = new AbortController()
    let aborted = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        // 窗口间串行（减少并发压力），窗口内对 8 门并发
        const before = await fetchWindow(
          event.ma + windowMa, event.ma, controller.signal,
        )
        if (aborted) return
        const after = await fetchWindow(
          event.ma, Math.max(0, event.ma - windowMa), controller.signal,
        )
        if (aborted) return
        if (before.length === 0 && after.length === 0) {
          throw new Error('PBDB 返回空结果 —— 该时间窗口内 8 大门均无化石记录或全部请求失败')
        }
        setData(computeDiagnostic(before, after, event))
      } catch (err) {
        if (aborted) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        if (!aborted) setLoading(false)
      }
    })()

    return () => { aborted = true; controller.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const refetch = useCallback(() => setNonce(n => n + 1), [])

  return { data, loading, error, refetch }
}
