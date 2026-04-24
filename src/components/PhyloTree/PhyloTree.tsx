import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { motion, AnimatePresence } from 'framer-motion'
import { PHYLO_SEED, PHYLO_SEED_PLANTAE, nodeStatus, type NodeStatus, type PhyloTreeNode } from '../../utils/phyloSeed'
import { useExploreStore } from '../../stores/useExploreStore'
import { rafThrottle } from '../../utils/rafThrottle'
import { usePhyloLayout } from '../../hooks/usePhyloLayout'
import './PhyloTree.css'

/* ── 布局 ── */
const SZ = 620
const PAD = 100
const R = SZ / 2 - PAD
const CX = SZ / 2

/* ── 视觉映射 ── */
const rScale = d3.scaleSqrt().domain([1, 10]).range([2.5, 8])

const COL: Record<NodeStatus, string> = {
  alive: '#5a7a3a', 'dying-now': '#8b2635', 'dead-earlier': '#b8b0a3', dead: '#b8b0a3',
}
const SCOL: Record<NodeStatus, string> = {
  alive: '#44633a', 'dying-now': '#6e1c29', 'dead-earlier': '#a09888', dead: '#a09888',
}
const LOPA: Record<NodeStatus, number> = {
  alive: 0.6, 'dying-now': 0.18, 'dead-earlier': 0.1, dead: 0.28,
}

/* ── 类型 ── */
interface Tip { cx: number; cy: number; node: PhyloTreeNode; status: NodeStatus }

/** 递归扁平化 PhyloTreeNode，构建 id → 原始节点的索引 */
function indexById(root: PhyloTreeNode, out: Map<string, PhyloTreeNode> = new Map()): Map<string, PhyloTreeNode> {
  out.set(root.id, root)
  root.children?.forEach(c => indexById(c, out))
  return out
}

/* ══════════════════════════════════════════════════ */
export default function PhyloTree() {
  const [tip, setTip]       = useState<Tip | null>(null)
  const [hovId, setHovId]   = useState<string | null>(null)
  const [drill, setDrill]   = useState<PhyloTreeNode | null>(null)
  const [kingdom, setKingdom] = useState<'animalia' | 'plantae'>('animalia')
  const cRef = useRef<HTMLDivElement>(null)

  const selExt = useExploreStore(s => s.selectedExtinction)
  const setTax = useExploreStore(s => s.setSelectedTaxon)
  const setDiagOpen = useExploreStore(s => s.setDiagnosticOpen)
  const [shaking, setShaking] = useState(false)
  const [infoDismissed, setInfoDismissed] = useState(false)

  /* 选中灭绝事件时震动 + 重新显示信息卡片 */
  useEffect(() => {
    if (!selExt) return
    setShaking(true)
    setInfoDismissed(false)
    const t = setTimeout(() => setShaking(false), 550)
    return () => clearTimeout(t)
  }, [selExt])

  const seedTree = kingdom === 'animalia' ? PHYLO_SEED : PHYLO_SEED_PLANTAE
  const data = drill ?? seedTree

  /* ── 布局（Web Worker 异步 / 同步 fallback） ── */
  const { nodes: laidNodes, links: laidLinks } = usePhyloLayout(data, R)

  /* id → 原始 PhyloTreeNode / 父/子 的索引（供渲染 & 高亮使用） */
  const dataById = useMemo(() => indexById(data), [data])
  const childrenMap = useMemo(() => {
    const m = new Map<string, string[]>()
    laidLinks.forEach(l => {
      const arr = m.get(l.sourceId); arr ? arr.push(l.targetId) : m.set(l.sourceId, [l.targetId])
    })
    return m
  }, [laidLinks])
  const parentMap = useMemo(() => {
    const m = new Map<string, string>()
    laidLinks.forEach(l => m.set(l.targetId, l.sourceId))
    return m
  }, [laidLinks])

  const linkGen = useMemo(() =>
    d3.linkRadial<{ source: { x: number; y: number }, target: { x: number; y: number } }, { x: number; y: number }>()
      .angle(d => d.x).radius(d => d.y),
  [])

  /* ── 状态函数 ── */
  const st = useCallback((n: PhyloTreeNode) => nodeStatus(n, selExt), [selExt])

  const linkStFor = useCallback((targetId: string) => {
    const n = dataById.get(targetId)
    return n ? st(n) : 'alive'
  }, [dataById, st])

  /* ── 祖先+子孙高亮集 ── */
  const hlSet = useMemo(() => {
    const s = new Set<string>()
    if (!hovId) return s
    // 自身 + 所有后代（BFS）
    const queue = [hovId]
    while (queue.length) {
      const id = queue.shift()!
      s.add(id)
      const ch = childrenMap.get(id)
      if (ch) queue.push(...ch)
    }
    // 所有祖先
    let p = parentMap.get(hovId)
    while (p) { s.add(p); p = parentMap.get(p) }
    return s
  }, [hovId, childrenMap, parentMap])

  /* ── 坐标 ── */
  const rx = (a: number, r: number) => r * Math.cos(a - Math.PI / 2)
  const ry = (a: number, r: number) => r * Math.sin(a - Math.PI / 2)

  /* ── tooltip 移动节流 ── */
  const moveTip = useMemo(
    () => rafThrottle((cx: number, cy: number) =>
      setTip(p => p ? { ...p, cx, cy } : p)),
    [],
  )
  useEffect(() => () => moveTip.cancel(), [moveTip])

  return (
    <div ref={cRef} className={`pt-box${shaking ? ' pt-box--shake' : ''}`}>
      {/* 界切换 */}
      <div className="pt-kingdom">
        <button
          className={`pt-kingdom-btn${kingdom === 'animalia' ? ' pt-kingdom-btn--on' : ''}`}
          onClick={() => { setKingdom('animalia'); setDrill(null) }}>
          动物界
        </button>
        <button
          className={`pt-kingdom-btn${kingdom === 'plantae' ? ' pt-kingdom-btn--on' : ''}`}
          onClick={() => { setKingdom('plantae'); setDrill(null) }}>
          植物界
        </button>
      </div>

      {drill && <button className="pt-back" onClick={() => setDrill(null)}>← 返回全树</button>}

      <svg width={SZ} height={SZ} viewBox={`0 0 ${SZ} ${SZ}`} className="pt-svg">
        <g transform={`translate(${CX},${CX})`}>

          {/* 连接线 */}
          {laidLinks.map(l => {
            const ls = linkStFor(l.targetId)
            const hl = hlSet.has(l.sourceId) && hlSet.has(l.targetId)
            const d = linkGen({
              source: { x: l.sx, y: l.sy },
              target: { x: l.tx, y: l.ty },
            })
            return d ? (
              <motion.path key={`${l.sourceId}-${l.targetId}`}
                d={d} fill="none" className="pt-link"
                initial={false}
                animate={{
                  stroke: COL[ls],
                  strokeOpacity: hl ? 1 : LOPA[ls],
                  strokeWidth: hl ? 2 : ls === 'alive' ? 1.2 : 0.7,
                }}
                transition={{ duration: 0.5, ease: 'easeOut' }}/>
            ) : null
          })}

          {/* 节点 */}
          {laidNodes.map(ln => {
            const d = dataById.get(ln.id)
            if (!d) return null
            const s = st(d)
            const hl = hlSet.has(d.id), leaf = ln.isLeaf
            const px = rx(ln.x, ln.y), py = ry(ln.x, ln.y)
            const nr = rScale(d.size)

            return (
              <g key={d.id} className="pt-node"
                onMouseEnter={e => { setHovId(d.id); setTip({ cx: e.clientX, cy: e.clientY, node: d, status: s }) }}
                onMouseMove={e => moveTip(e.clientX, e.clientY)}
                onMouseLeave={() => { moveTip.cancel(); setHovId(null); setTip(null) }}
                onClick={() => setTax({ oid: d.id, nam: d.name, rnk: 0 })}
                onDoubleClick={() => { if (d.children?.length) setDrill(d) }}>

                {/* 灭绝脉冲光环 */}
                {s === 'dying-now' && (
                  <motion.circle cx={px} cy={py} fill="none" stroke="#8b2635"
                    initial={{ r: nr, strokeOpacity: 0.8, strokeWidth: 2 }}
                    animate={{ r: nr + 14, strokeOpacity: 0, strokeWidth: 0.5 }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}/>
                )}

                {/* 主圆：显式 initial 避免 framer-motion 从 DOM 读取 undefined 的 SVG 属性 */}
                <motion.circle cx={px} cy={py}
                  r={nr}
                  fill={COL[s]}
                  stroke={SCOL[s]}
                  initial={{ r: nr, fill: COL[s], stroke: SCOL[s], strokeWidth: 1, opacity: 1 }}
                  animate={{
                    r: hl ? nr + 2 : nr,
                    fill: COL[s], stroke: hl ? '#1e3a5f' : SCOL[s],
                    strokeWidth: hl ? 2 : 1,
                    opacity: s === 'dead-earlier' ? 0.4 : s === 'dying-now' ? 0.7 : 1,
                  }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  style={{ cursor: 'pointer' }}/>

                {/* 叶标签 */}
                {leaf && (
                  <text x={px} y={py}
                    dx={ln.x < Math.PI ? 10 : -10} dy="0.35em"
                    textAnchor={ln.x < Math.PI ? 'start' : 'end'}
                    transform={`rotate(${lblAngle(ln.x)},${px},${py})`}
                    className={`pt-lbl pt-lbl--${s}`}>
                    {d.nameZh.replace(/（.*）/, '')}
                  </text>
                )}
              </g>
            )
          })}

          {/* 中心标签 */}
          <text textAnchor="middle" dy="0.35em" className="pt-center">{data.nameZh}</text>
        </g>
      </svg>

      {/* 选中信息卡片 */}
      <AnimatePresence>
        {selExt && !infoDismissed && (
          <motion.div className="pt-info"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.25 }}>
            <button className="pt-info-close" onClick={() => setInfoDismissed(true)}
              title="关闭" aria-label="关闭信息面板">×</button>
            <div className="pt-info-badge">{Math.round(selExt.severity * 100)}% 属级灭绝</div>
            <div className="pt-info-name">{selExt.nameZh}</div>
            <div className="pt-info-time">{selExt.name} · {selExt.ma} Ma</div>
            <div className="pt-info-desc">{selExt.description}</div>
            <div className="pt-info-taxa">
              {selExt.affectedTaxa.slice(0, 4).map(t => (
                <span key={t} className="pt-info-tag">{t}</span>
              ))}
            </div>
            <button className="pt-info-diag" onClick={() => setDiagOpen(true)}>
              <span className="pt-info-diag-icon">⊹</span>
              打开深度诊断
              <span className="pt-info-diag-arrow">→</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 图例 */}
      {selExt && (
        <div className="pt-legend">
          <span className="pt-dot pt-dot--alive"/> 存活
          <span className="pt-dot pt-dot--dying"/> 本次灭绝
          <span className="pt-dot pt-dot--dead"/> 此前已灭
        </div>
      )}

      {/* Tooltip */}
      <AnimatePresence>
        {tip && (
          <motion.div className="pt-tip"
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            style={{ left: tip.cx + 16, top: tip.cy + 16 }}>
            <div className="pt-tip-name">{tip.node.name}</div>
            <div className="pt-tip-zh">{tip.node.nameZh}</div>
            <div className="pt-tip-rank">{tip.node.rank}</div>
            {tip.node.description && <div className="pt-tip-desc">{tip.node.description}</div>}
            <div className={`pt-tip-st pt-tip-st--${tip.status}`}>{stLabel(tip.status)}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── 辅助 ── */

function lblAngle(rad: number): number {
  const d = (rad * 180) / Math.PI - 90
  return rad < Math.PI ? d : d + 180
}

function stLabel(s: NodeStatus): string {
  switch (s) {
    case 'alive':        return '● 现存'
    case 'dying-now':    return '✕ 在本次事件中灭绝'
    case 'dead-earlier': return '○ 此前已灭绝'
    case 'dead':         return '○ 已灭绝'
  }
}
