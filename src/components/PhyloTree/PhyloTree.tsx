import { useCallback, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { motion, AnimatePresence } from 'framer-motion'
import { PHYLO_SEED, nodeStatus, type NodeStatus, type PhyloTreeNode } from '../../utils/phyloSeed'
import { useExploreStore } from '../../stores/useExploreStore'
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
type HN = d3.HierarchyPointNode<PhyloTreeNode>

interface Tip { cx: number; cy: number; node: PhyloTreeNode; status: NodeStatus }

/* ══════════════════════════════════════════════════ */
export default function PhyloTree() {
  const [tip, setTip]       = useState<Tip | null>(null)
  const [hovId, setHovId]   = useState<string | null>(null)
  const [drill, setDrill]   = useState<PhyloTreeNode | null>(null)
  const cRef = useRef<HTMLDivElement>(null)

  const selExt = useExploreStore(s => s.selectedExtinction)
  const setTax = useExploreStore(s => s.setSelectedTaxon)

  const data = drill ?? PHYLO_SEED

  /* ── 布局 ── */
  const root = useMemo(() =>
    d3.cluster<PhyloTreeNode>()
      .size([2 * Math.PI, R])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.8) / a.depth)
      (d3.hierarchy<PhyloTreeNode>(data)),
  [data])

  const nodes = useMemo(() => root.descendants(), [root])
  const links = useMemo(() => root.links(), [root])

  const linkGen = useMemo(() =>
    d3.linkRadial<d3.HierarchyPointLink<PhyloTreeNode>, HN>()
      .angle(d => d.x).radius(d => d.y),
  [])

  /* ── 状态函数 ── */
  const st = useCallback((n: PhyloTreeNode) => nodeStatus(n, selExt), [selExt])

  const linkSt = useCallback(
    (l: d3.HierarchyPointLink<PhyloTreeNode>) => st(l.target.data),
  [st])

  /* ── 祖先+子孙高亮集 ── */
  const hlSet = useMemo(() => {
    if (!hovId) return new Set<string>()
    const s = new Set<string>()
    function walk(n: HN): boolean {
      if (n.data.id === hovId) {
        n.descendants().forEach(d => s.add(d.data.id))
        return true
      }
      if (n.children) for (const c of n.children) if (walk(c)) { s.add(n.data.id); return true }
      return false
    }
    walk(root)
    return s
  }, [hovId, root])

  /* ── 坐标 ── */
  const rx = (a: number, r: number) => r * Math.cos(a - Math.PI / 2)
  const ry = (a: number, r: number) => r * Math.sin(a - Math.PI / 2)

  return (
    <div ref={cRef} className="pt-box">
      {drill && <button className="pt-back" onClick={() => setDrill(null)}>← 返回全树</button>}

      <svg width={SZ} height={SZ} viewBox={`0 0 ${SZ} ${SZ}`} className="pt-svg">
        <g transform={`translate(${CX},${CX})`}>

          {/* 连接线 */}
          {links.map(l => {
            const ls = linkSt(l)
            const hl = hlSet.has(l.source.data.id) && hlSet.has(l.target.data.id)
            const d = linkGen(l)
            return d ? (
              <motion.path key={`${l.source.data.id}-${l.target.data.id}`}
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
          {nodes.map(hn => {
            const d = hn.data, s = st(d)
            const hl = hlSet.has(d.id), leaf = !hn.children
            const px = rx(hn.x, hn.y), py = ry(hn.x, hn.y)
            const nr = rScale(d.size)

            return (
              <g key={d.id} className="pt-node"
                onMouseEnter={e => { setHovId(d.id); setTip({ cx: e.clientX, cy: e.clientY, node: d, status: s }) }}
                onMouseMove={e => setTip(p => p ? { ...p, cx: e.clientX, cy: e.clientY } : p)}
                onMouseLeave={() => { setHovId(null); setTip(null) }}
                onClick={() => setTax({ oid: d.id, nam: d.name, rnk: 0 })}
                onDoubleClick={() => { if (hn.children?.length) setDrill(d) }}>

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
                    dx={hn.x < Math.PI ? 10 : -10} dy="0.35em"
                    textAnchor={hn.x < Math.PI ? 'start' : 'end'}
                    transform={`rotate(${lblAngle(hn.x)},${px},${py})`}
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
