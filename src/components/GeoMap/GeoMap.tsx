import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { AnimatePresence, motion } from 'framer-motion'
import { useExploreStore } from '../../stores/useExploreStore'
import { useOccurrences } from '../../hooks/usePBDB'
import { LAND_FEATURES } from '../../utils/worldLand'
import type { Occurrence } from '../../types'
import './GeoMap.css'

/* ── 布局 ── */
const W = 640
const H = 360

/* ── 门级配色（博物馆标签色） ── */
const PHYLUM_COLOR: Record<string, string> = {
  Chordata:       '#8b2635',
  Arthropoda:     '#b07a3a',
  Mollusca:       '#1e3a5f',
  Brachiopoda:    '#5a7a3a',
  Echinodermata:  '#c99a3b',
  Cnidaria:       '#6e1c29',
  Bryozoa:        '#44633a',
  Porifera:       '#a09888',
}
const PHYLUM_DEFAULT = '#6b5a47'

interface Tip { cx: number; cy: number; occ: Occurrence }

/* ══════════════════════════════════════════════════ */
export default function GeoMap() {
  const [tip, setTip] = useState<Tip | null>(null)
  const [expanded, setExpanded] = useState(false)

  /* ESC 键退出全屏 */
  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

  const selTax = useExploreStore(s => s.selectedTaxon)
  const selExt = useExploreStore(s => s.selectedExtinction)
  const tr     = useExploreStore(s => s.timeRange)

  /* ── 查询目标分类 ──
     优先级：树上选中的节点 > 灭绝事件的首个受影响类群 > 无
     PBDB 只接受裸学名，需剥除括号注释（如 "Dinosauria (non-avian)" → "Dinosauria"） */
  const rawName = selTax?.nam ?? selExt?.affectedTaxa[0] ?? ''
  const taxonName = rawName.replace(/\s*\([^)]*\)/g, '').trim()

  /* ── 时间窗 ──
     如果选中灭绝事件，取事件前后 ±10 Ma 的窗口；否则用滑杆全局范围 */
  const query = useMemo(() => {
    if (selExt) return { max_ma: selExt.ma + 10, min_ma: Math.max(0, selExt.ma - 10), limit: 500 }
    return { max_ma: tr[0], min_ma: tr[1], limit: 500 }
  }, [selExt, tr])

  const { data: occs, loading, error } = useOccurrences(taxonName, query)

  /* ── 投影 ── */
  const projection = useMemo(() =>
    d3.geoNaturalEarth1()
      .scale((W / (2 * Math.PI)) * 1.05)
      .translate([W / 2, H / 2]),
  [])

  const pathGen = useMemo(() => d3.geoPath(projection), [projection])
  const gratGen = useMemo(() => d3.geoGraticule10(), [])

  /* ── 投影化的点 ── */
  const points = useMemo(() => {
    if (!occs) return []
    const out: { x: number; y: number; o: Occurrence; color: string }[] = []
    for (const o of occs) {
      const lng = o.paleolng ?? o.lng
      const lat = o.paleolat ?? o.lat
      if (typeof lng !== 'number' || typeof lat !== 'number') continue
      const p = projection([lng, lat])
      if (!p) continue
      out.push({
        x: p[0], y: p[1], o,
        color: PHYLUM_COLOR[o.phl ?? ''] ?? PHYLUM_DEFAULT,
      })
    }
    return out
  }, [occs, projection])

  /* ── 统计 ── */
  const stats = useMemo(() => {
    if (!points.length) return null
    const phyla = new Map<string, number>()
    points.forEach(p => {
      const k = p.o.phl ?? '未分类'
      phyla.set(k, (phyla.get(k) ?? 0) + 1)
    })
    return {
      count: points.length,
      phyla: [...phyla.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    }
  }, [points])

  const empty = !taxonName

  return (
    <>
      {/* 展开态下的背景遮罩（点击退出） */}
      {expanded && <div className="gm-backdrop" onClick={() => setExpanded(false)}/>}

      <div className={`gm-box${expanded ? ' gm-box--expanded' : ''}`}>
        <header className="gm-hd">
          <div className="gm-hd-main">
            <h3>古地理化石分布</h3>
            <p className="gm-sub">
              {empty
                ? '点击演化树节点或灭绝事件以查看分布'
                : `${rawName}${selExt ? ` · ${selExt.nameZh}` : ''}`}
            </p>
          </div>
          <button
            type="button"
            className="gm-expand-btn"
            onClick={() => setExpanded(v => !v)}
            title={expanded ? '收起（Esc）' : '放大查看'}
            aria-label={expanded ? '收起地图' : '放大地图'}>
            {expanded ? (
              /* 收起图标 */
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path d="M6 6 H2 M6 6 V2 M10 6 H14 M10 6 V2 M6 10 H2 M6 10 V14 M10 10 H14 M10 10 V14"
                      stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
              </svg>
            ) : (
              /* 放大图标 */
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path d="M2 6 V2 H6 M10 2 H14 V6 M14 10 V14 H10 M6 14 H2 V10"
                      stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
              </svg>
            )}
          </button>
        </header>

      <div className="gm-svg-wrap">
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="gm-svg" preserveAspectRatio="xMidYMid meet">
          {/* 海洋底色 */}
          <rect width={W} height={H} className="gm-ocean"/>

          {/* 经纬网 */}
          <path d={pathGen(gratGen) ?? ''} className="gm-graticule"/>

          {/* 陆块 */}
          {LAND_FEATURES.features.map((f, i) => (
            <path key={i} d={pathGen(f) ?? ''} className="gm-land"/>
          ))}

          {/* 化石点 */}
          <AnimatePresence>
            {points.map((p, i) => (
              <motion.circle key={`${p.o.oid}-${i}`}
                cx={p.x} cy={p.y}
                initial={{ r: 0, opacity: 0 }}
                animate={{ r: 3, opacity: 0.75 }}
                exit={{ r: 0, opacity: 0 }}
                transition={{ duration: 0.35, delay: Math.min(0.3, i * 0.001) }}
                fill={p.color}
                stroke="#1c1917"
                strokeWidth={0.4}
                className="gm-pt"
                onMouseEnter={e => setTip({ cx: e.clientX, cy: e.clientY, occ: p.o })}
                onMouseMove={e => setTip(t => t ? { ...t, cx: e.clientX, cy: e.clientY } : t)}
                onMouseLeave={() => setTip(null)}/>
            ))}
          </AnimatePresence>
        </svg>

        {/* 状态遮罩 */}
        {empty && (
          <div className="gm-overlay">
            <p>选中演化树上任一节点</p>
            <p className="gm-sm">或在时间轴上点击一次大灭绝事件</p>
          </div>
        )}
        {loading && !empty && (
          <div className="gm-overlay gm-overlay--load">
            <div className="gm-spin"/>
            <p>正在检索 PBDB 化石记录…</p>
          </div>
        )}
        {error && (
          <div className="gm-overlay gm-overlay--err">
            <p>数据加载失败</p>
            <p className="gm-sm">{error.message}</p>
          </div>
        )}
        {!loading && !error && !empty && points.length === 0 && (
          <div className="gm-overlay">
            <p>此时段暂无化石记录</p>
            <p className="gm-sm">试试调整时间范围或换一个类群</p>
          </div>
        )}
      </div>

      {/* 图例 + 统计 */}
      {stats && (
        <footer className="gm-ft">
          <div className="gm-count">共 <b>{stats.count}</b> 条化石记录</div>
          <ul className="gm-legend">
            {stats.phyla.map(([name, n]) => (
              <li key={name}>
                <span className="gm-dot" style={{ background: PHYLUM_COLOR[name] ?? PHYLUM_DEFAULT }}/>
                {name} <span className="gm-n">{n}</span>
              </li>
            ))}
          </ul>
        </footer>
      )}

        <div className="gm-note">坐标优先采用 PBDB paleoloc 古地理重建；底图为现代大陆轮廓参考</div>

        <GmTip tip={tip}/>
      </div>
    </>
  )
}

/* ── Tooltip（fixed 定位，跟随鼠标） ── */
function GmTip({ tip }: { tip: Tip | null }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (tip && ref.current) {
      ref.current.style.left = `${tip.cx + 14}px`
      ref.current.style.top  = `${tip.cy + 14}px`
    }
  }, [tip])
  return (
    <AnimatePresence>
      {tip && (
        <motion.div ref={ref} className="gm-tip"
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}>
          <div className="gm-tip-name">{tip.occ.tna ?? tip.occ.idn ?? tip.occ.oid}</div>
          {tip.occ.phl && <div className="gm-tip-rank">{tip.occ.phl} › {tip.occ.cll ?? '—'}</div>}
          <div className="gm-tip-coord">
            {(tip.occ.paleolat ?? tip.occ.lat).toFixed(1)}°,
            {' '}{(tip.occ.paleolng ?? tip.occ.lng).toFixed(1)}°
            {tip.occ.paleolat !== undefined && <span className="gm-tip-paleo"> paleo</span>}
          </div>
          {(tip.occ.eag || tip.occ.lag) && (
            <div className="gm-tip-age">{tip.occ.eag?.toFixed(1)}–{tip.occ.lag?.toFixed(1)} Ma</div>
          )}
          {tip.occ.oei && <div className="gm-tip-int">{tip.occ.oei}</div>}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
