import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as d3 from 'd3'
import { motion, AnimatePresence } from 'framer-motion'
import { useDiversity, useTimeIntervals } from '../../hooks/usePBDB'
import { BIG_FIVE_EXTINCTIONS, EARTH_TIMELINE } from '../../utils/geoTimeScale'
import { useExploreStore } from '../../stores/useExploreStore'
import { rafThrottle } from '../../utils/rafThrottle'
import type { DiversityPoint, ExtinctionEvent, GeoInterval, TimeRange } from '../../types'
import './Timeline.css'

/* ── 尺寸 ─────────────────────────────────────── */
const HEIGHT = 210
const M = { top: 16, right: 24, bottom: 36, left: 24 }
const CURVE_H = 72          // 多样性曲线高度
const ERA_H = 14
const PERIOD_H = 20
const GAP = 2
const BANDS_Y = CURVE_H + 10 // 色带起始 y

interface Tip { cx: number; cy: number; content: ReactNode }

/* ══════════════════════════════════════════════════ */
export default function Timeline() {
  const box   = useRef<HTMLDivElement>(null)
  const gRef  = useRef<SVGGElement>(null)
  const brRef = useRef<SVGGElement>(null)

  const [w, setW]         = useState(900)
  const [zt, setZt]       = useState(d3.zoomIdentity)
  const [tip, setTip]     = useState<Tip | null>(null)
  const [hoverX, setHX]   = useState<number | null>(null)

  /* ── 数据 ─── */
  const { data: periods }                   = useTimeIntervals(3)
  const { data: eras }                      = useTimeIntervals(2)
  const { data: diversity, loading: dLoad } = useDiversity('Metazoa', 'stage')

  /* ── 全局状态 ─── */
  const selExt  = useExploreStore(s => s.selectedExtinction)
  const setSel  = useExploreStore(s => s.setSelectedExtinction)
  const setTR   = useExploreStore(s => s.setTimeRange)
  const timeRng = useExploreStore(s => s.timeRange)
  const rangeActive = timeRng[0] < 4600 || timeRng[1] > 0

  /* ── 宽度（rAF 节流，避免连续 resize 多次重算 D3） ─── */
  useEffect(() => {
    const el = box.current; if (!el) return
    const update = rafThrottle((cw: number) => setW(cw))
    const ro = new ResizeObserver(e => { const cw = e[0].contentRect.width; if (cw > 0) update(cw) })
    ro.observe(el)
    return () => { ro.disconnect(); update.cancel() }
  }, [])

  const iw = Math.max(200, w - M.left - M.right)
  const ih = HEIGHT - M.top - M.bottom

  /* ── 分段比例尺 ─── */
  const base = useMemo(() =>
    d3.scaleLinear()
      .domain([EARTH_TIMELINE.earthFormation, 2500, 538.8, 0])
      .range([0, iw * 0.18, iw * 0.4, iw]).clamp(true),
  [iw])

  const x = useMemo(() => (ma: number) => base(ma) * zt.k + zt.x, [base, zt])
  const inv = useCallback((px: number) => base.invert((px - zt.x) / zt.k), [base, zt])

  /* ── 多样性曲线 ─── */
  const maxD = useMemo(() => diversity ? (d3.max(diversity, d => d.sampled_in_bin) ?? 1) : 1, [diversity])
  const yS   = useMemo(() => d3.scaleSqrt().domain([0, maxD]).range([CURVE_H, 0]), [maxD])
  const areaD = useMemo(() => {
    if (!diversity?.length) return null
    const s = [...diversity].sort((a, b) => b.max_ma - a.max_ma)
    return d3.area<DiversityPoint>()
      .x(d => x((d.max_ma + d.min_ma) / 2))
      .y0(CURVE_H).y1(d => yS(d.sampled_in_bin))
      .curve(d3.curveMonotoneX)(s)
  }, [diversity, x, yS])

  /* ── Brush（仅覆盖色带区域） ─── */
  useEffect(() => {
    const g = brRef.current; if (!g) return
    const sel = d3.select(g)
    const brush = d3.brushX<unknown>()
      .extent([[0, BANDS_Y - 4], [iw, BANDS_Y + ERA_H + GAP + PERIOD_H + 4]])
      .on('end', ev => {
        if (!ev.selection) {
          // 点击空白 / 0 宽拖拽 → 清除已选范围
          setTR([4600, 0] as TimeRange)
          return
        }
        const [a, b] = ev.selection as [number, number]
        setTR([inv(Math.min(a, b)), inv(Math.max(a, b))] as TimeRange)
      })
    sel.call(brush)
    return () => { sel.on('.brush', null); sel.selectAll('*').remove() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iw, setTR])

  /* 清除按钮：同时清除 React 状态 + DOM 上的 brush selection */
  const clearBrush = useCallback(() => {
    setTR([4600, 0] as TimeRange)
    const g = brRef.current
    if (g) d3.select(g).call(d3.brushX().move as never, null)
  }, [setTR])

  /* ── Zoom（滚轮，绑在主 <g>；rAF 节流 zoom 回调） ─── */
  useEffect(() => {
    const g = gRef.current; if (!g) return
    const sel = d3.select(g)
    const onZoom = rafThrottle((t: d3.ZoomTransform) => setZt(t))
    const zoom = d3.zoom<SVGGElement, unknown>()
      .scaleExtent([1, 8])
      .translateExtent([[0, 0], [iw, ih]])
      .extent([[0, 0], [iw, ih]])
      .filter(ev => ev.type === 'wheel' || ev.type === 'dblclick')
      .on('zoom', ev => onZoom(ev.transform))
    sel.call(zoom)
    return () => { sel.on('.zoom', null); onZoom.cancel() }
  }, [iw, ih])

  /* ── SVG hover（rAF 节流，避免每像素 setState 卡顿） ─── */
  const applyMove = useMemo(
    () => rafThrottle((lx: number, cx: number, cy: number) => {
      if (lx < 0 || lx > iw) { setHX(null); setTip(null); return }
      const ma = inv(lx)
      setHX(lx)
      setTip({ cx, cy, content: (
        <div className="tl-tt-inner">
          <div className="tl-tt-ma">{ma.toFixed(1)} Ma</div>
          {findIn(eras, ma)  && <div className="tl-tt-era">{findIn(eras, ma)!.nam}</div>}
          {findIn(periods, ma) && <div className="tl-tt-per">{findIn(periods, ma)!.nam}</div>}
        </div>
      )})
    }),
    [iw, inv, eras, periods],
  )
  useEffect(() => () => applyMove.cancel(), [applyMove])

  function onMove(ev: React.MouseEvent<SVGSVGElement>) {
    const lx = ev.clientX - ev.currentTarget.getBoundingClientRect().left - M.left
    applyMove(lx, ev.clientX, ev.clientY)
  }

  function onLeave() { applyMove.cancel(); setHX(null); setTip(null) }

  /* ── 灭绝标记点击（toggle） ─── */
  const clickExt = useCallback((e: ExtinctionEvent) => {
    setSel(selExt?.id === e.id ? null : e)
  }, [selExt, setSel])

  /* ══════════════ JSX ════════════════ */
  return (
    <div ref={box} className="tl-container">
      {/* 框选范围提示 */}
      <AnimatePresence>
        {rangeActive && (
          <motion.div className="tl-range-chip"
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
            <span className="tl-range-chip-dot"/>
            筛选范围：<b>{timeRng[0].toFixed(1)}</b>–<b>{timeRng[1].toFixed(1)}</b> Ma
            <button className="tl-range-chip-clear" onClick={clearBrush}
              title="清除筛选">×</button>
          </motion.div>
        )}
      </AnimatePresence>

      <svg width={w} height={HEIGHT} className="tl-svg"
        onMouseMove={onMove} onMouseLeave={onLeave}>
        <defs>
          <linearGradient id="tl-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent-primary)" stopOpacity="0.65"/>
            <stop offset="100%" stopColor="var(--color-accent-primary)" stopOpacity="0.03"/>
          </linearGradient>
          <filter id="tl-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        <g ref={gRef} transform={`translate(${M.left},${M.top})`}>
          {/* 1) 多样性曲线 */}
          {areaD && <path d={areaD} fill="url(#tl-grad)"
            stroke="var(--color-accent-primary)" strokeWidth={1.2}
            className="tl-curve" style={{pointerEvents:'none'}}/>}

          {/* 2) 代色带 */}
          {eras?.map(e => band(e, x, BANDS_Y, ERA_H, 'era'))}

          {/* 3) 纪色带 */}
          {periods?.map(p => band(p, x, BANDS_Y + ERA_H + GAP, PERIOD_H, 'per'))}

          {/* 4) hover 参考线 */}
          {hoverX !== null && <line x1={hoverX} x2={hoverX} y1={0} y2={ih}
            className="tl-hover-line" style={{pointerEvents:'none'}}/>}

          {/* 5) Brush */}
          <g ref={brRef} className="tl-brush"/>

          {/* 6) 灭绝脉冲（最顶层，保证可点击） */}
          {BIG_FIVE_EXTINCTIONS.map(ev => {
            const px = x(ev.ma)
            if (px < -20 || px > iw + 20) return null
            const isSel = selExt?.id === ev.id
            const r0 = 3 + ev.severity * 5
            return (
              <g key={ev.id} transform={`translate(${px},0)`} className="tl-ext">
                {/* 虚线 */}
                <line x1={0} x2={0} y1={CURVE_H} y2={ih}
                  stroke="var(--color-extinction)" strokeDasharray="2 3"
                  strokeOpacity={isSel ? 0.85 : 0.25} style={{pointerEvents:'none'}}/>
                {/* 透明大热区 */}
                <circle cx={0} cy={CURVE_H - 6} r={18} fill="transparent"
                  style={{cursor:'pointer'}}
                  onClick={e => { e.stopPropagation(); clickExt(ev) }}
                  onMouseEnter={e => setTip({ cx: e.clientX, cy: e.clientY, content: (
                    <div className="tl-tt-inner">
                      <div className="tl-tt-ma">{ev.nameZh}</div>
                      <div>{ev.ma} Ma · 灭绝率 {Math.round(ev.severity*100)}%</div>
                      <div className="tl-tt-hint">点击查看</div>
                    </div>
                  )})}
                  onMouseMove={e => setTip(p => p ? {...p, cx: e.clientX, cy: e.clientY} : p)}
                  onMouseLeave={() => setTip(null)}/>
                {/* 可见脉冲圆（纯视觉） */}
                <motion.circle cx={0} cy={CURVE_H - 6} r={r0} fill="var(--color-extinction)"
                  filter="url(#tl-glow)" style={{pointerEvents:'none'}}
                  initial={{ r: r0, opacity: 0.85 }}
                  animate={{
                    r: isSel ? [r0+1, r0+5, r0+1] : [r0, r0+2, r0],
                    opacity: isSel ? 1 : [0.7, 1, 0.7],
                  }}
                  transition={{duration:1.6, repeat:Infinity, ease:'easeInOut'}}/>
              </g>
            )
          })}
        </g>
      </svg>

      {dLoad && <div className="tl-loading">正在加载多样性数据…</div>}

      <AnimatePresence>
        {tip && (
          <motion.div className="tl-tooltip"
            initial={{opacity:0, y:4}} animate={{opacity:1, y:0}} exit={{opacity:0}}
            transition={{duration:0.12}}
            style={{left: tip.cx + 14, top: tip.cy + 14}}>
            {tip.content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── 辅助 ───────────────────────────────────── */

function band(iv: GeoInterval, x: (ma:number)=>number, y: number, h: number, kind: string) {
  const x0 = x(iv.eag), x1 = x(iv.lag), w = x1 - x0
  if (w < 0.5) return null
  const fill = iv.col ? `#${iv.col}` : 'var(--color-bg-card)'
  const minW = kind === 'era' ? 40 : 26
  return (
    <g key={iv.oid} className={`tl-band tl-band--${kind}`}>
      <rect x={x0} y={y} width={w} height={h} fill={fill}/>
      {w > minW && <text x={x0+w/2} y={y+h/2} textAnchor="middle" dy="0.35em"
        className={`tl-band-lbl tl-band-lbl--${kind}`}>
        {kind === 'per' && iv.nam.length > 9 ? iv.nam.slice(0,4)+'.' : iv.nam}
      </text>}
    </g>
  )
}

function findIn(list: GeoInterval[] | null, ma: number) {
  return list?.find(iv => ma <= iv.eag && ma >= iv.lag)
}
