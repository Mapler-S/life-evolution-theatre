import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useExtinctionDiagnostic } from '../../hooks/useExtinctionDiagnostic'
import { useExploreStore } from '../../stores/useExploreStore'
import type { DiagnosticMetrics, DiagnosticResult, TaxonChange } from '../../utils/diagnostic'
import type { Occurrence } from '../../types'
import './ExtinctionDiagnostic.css'

/** 排序模式 */
type SortMode = 'loss' | 'lossRate' | 'before'

/* ══════════════════════════════════════════════════ */
export default function ExtinctionDiagnostic() {
  const open    = useExploreStore(s => s.diagnosticOpen)
  const setOpen = useExploreStore(s => s.setDiagnosticOpen)
  const selExt  = useExploreStore(s => s.selectedExtinction)
  const setTax  = useExploreStore(s => s.setSelectedTaxon)

  const [windowMa, setWindowMa]       = useState(5)
  const [hoverPhylum, setHoverPhylum] = useState<string | null>(null)
  const [hoverBand, setHoverBand]     = useState<number | null>(null)
  const [sortMode, setSortMode]       = useState<SortMode>('lossRate')

  const { data, loading, error, refetch } = useExtinctionDiagnostic(selExt, windowMa, open)

  /* ── Esc 关闭 ── */
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  /* 每次进出 / 切换事件，重置跨维度高亮 */
  useEffect(() => { setHoverPhylum(null); setHoverBand(null) }, [selExt?.id, windowMa])

  const close = useCallback(() => setOpen(false), [setOpen])

  /* 类群条点击 → 选中类群 + 关闭面板，主界面联动 */
  const onPickTaxon = useCallback((name: string) => {
    setTax({ oid: `phylum:${name}`, nam: name, rnk: 20 })
    close()
  }, [setTax, close])

  const sortedChanges = useMemo(() => {
    if (!data) return []
    const arr = [...data.groupChanges]
    if (sortMode === 'loss')     arr.sort((a, b) => b.loss - a.loss)
    else if (sortMode === 'lossRate') arr.sort((a, b) => b.lossRate - a.lossRate)
    else /* 'before' */          arr.sort((a, b) => b.before - a.before)
    return arr
  }, [data, sortMode])

  return (
    <AnimatePresence>
      {open && selExt && (
        <motion.div className="diag-overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={close}>

          <motion.div className="diag-panel" onClick={e => e.stopPropagation()}
            initial={{ scale: 0.96, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 30, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.2, 0, 0.2, 1] }}>

            {/* ── 关闭 ── */}
            <button className="diag-close" onClick={close} aria-label="关闭">×</button>

            {/* ═══ Hero ═══ */}
            <header className="diag-hero">
              <div className="diag-hero-meta">
                <div className="diag-hero-kicker">大灭绝事件 · 深度诊断</div>
                <h1 className="diag-hero-title">{selExt.nameZh}</h1>
                <div className="diag-hero-sub">
                  {selExt.name} · <b>{selExt.ma}</b> Ma ·
                  {' '}从 {selExt.intervalBefore} → {selExt.intervalAfter}
                </div>
                <p className="diag-hero-desc">{selExt.description}</p>
              </div>
              <SeverityRing value={selExt.severity}/>
            </header>

            {/* ═══ 时间窗口滑轨 ═══ */}
            <section className="diag-window">
              <div className="diag-window-hd">
                <span className="diag-window-lbl">
                  对比窗口：事件前后各
                  <b className="diag-window-val">{windowMa}</b>
                  Ma （{selExt.ma + windowMa} ~ {Math.max(0, selExt.ma - windowMa)} Ma）
                </span>
                {loading && <span className="diag-loading">查询 PBDB 中…</span>}
              </div>
              <input type="range" min={1} max={20} step={1} value={windowMa}
                onChange={e => setWindowMa(Number(e.target.value))}
                className="diag-window-range"/>
            </section>

            {error && (
              <div className="diag-error">
                <div className="diag-error-hd">
                  <span className="diag-error-icon">⚠</span>
                  PBDB 数据获取失败
                </div>
                <div className="diag-error-msg">{error.message}</div>
                <div className="diag-error-hint">
                  常见原因：网络到 paleobiodb.org 的连接被重置（境外科研站点，部分网络环境不稳定）。
                  已自动重试 2 次仍失败，可尝试：
                </div>
                <ul className="diag-error-tips">
                  <li>缩小「对比窗口」以减少单次返回数据量</li>
                  <li>切换科学上网后再试</li>
                  <li>稍等 30 秒后点击重试（PBDB 可能在限流）</li>
                </ul>
                <button className="diag-error-retry" onClick={refetch} disabled={loading}>
                  {loading ? '重试中…' : '↻ 重试'}
                </button>
              </div>
            )}

            {data && (
              <>
                {/* ═══ 双栏核心指标 ═══ */}
                <DualMetrics before={data.before} after={data.after} result={data}/>

                {/* ═══ 纬度分布 ridge ═══ */}
                <LatitudeDistribution
                  before={data.before} after={data.after}
                  hoverBand={hoverBand} setHoverBand={setHoverBand}/>

                {/* ═══ 古地理迷你地图（前/后） ═══ */}
                <MiniMaps
                  before={data.before} after={data.after}
                  hoverPhylum={hoverPhylum} hoverBand={hoverBand}/>

                {/* ═══ 门级消长对比 ═══ */}
                <PhylaChanges
                  changes={sortedChanges}
                  sortMode={sortMode} setSortMode={setSortMode}
                  hoverPhylum={hoverPhylum} setHoverPhylum={setHoverPhylum}
                  onPickTaxon={onPickTaxon}/>

                {/* ═══ 自动洞察 ═══ */}
                <InsightsFooter insights={data.insights}/>
              </>
            )}

            {!data && !loading && !error && (
              <div className="diag-empty">切换事件即可查看诊断…</div>
            )}

            {loading && !data && <div className="diag-spinner"><span/>加载 PBDB 全球化石数据…</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ══════════════════════════════════════════════════
   ▎灭绝率环形动画
   ══════════════════════════════════════════════════ */
function SeverityRing({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const r = 48, c = 2 * Math.PI * r
  return (
    <div className="diag-ring">
      <svg viewBox="0 0 120 120" className="diag-ring-svg">
        <circle cx="60" cy="60" r={r} className="diag-ring-bg"/>
        <motion.circle cx="60" cy="60" r={r} className="diag-ring-fg"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - value) }}
          transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 }}
          transform="rotate(-90 60 60)"/>
      </svg>
      <div className="diag-ring-text">
        <motion.div className="diag-ring-num"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}>
          {pct}%
        </motion.div>
        <div className="diag-ring-lbl">属级灭绝率</div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   ▎双栏核心指标（属数/化石/纬度跨度/门数）
   ══════════════════════════════════════════════════ */
function DualMetrics({
  before, after, result,
}: { before: DiagnosticMetrics; after: DiagnosticMetrics; result: DiagnosticResult }) {
  const genDrop = Math.round(result.derived.generaDropRate * 100)
  const latDrop = Math.round(result.derived.latShrinkRate * 100)
  return (
    <section className="diag-dual">
      <div className="diag-col diag-col--before">
        <div className="diag-col-tag">灭绝前</div>
        <MetricCell label="属数"     value={before.generaCount}/>
        <MetricCell label="化石记录"  value={before.occCount}/>
        <MetricCell label="纬度跨度"  value={before.latSpread} suffix="°"/>
        <MetricCell label="门数"     value={before.phyla.size}/>
      </div>

      <div className="diag-divider">
        <div className="diag-divider-line"/>
        <div className="diag-divider-badge">灭绝线</div>
      </div>

      <div className="diag-col diag-col--after">
        <div className="diag-col-tag">灭绝后</div>
        <MetricCell label="属数"     value={after.generaCount}
          delta={genDrop !== 0 ? `${genDrop > 0 ? '↓' : '↑'} ${Math.abs(genDrop)}%` : undefined}
          deltaBad={genDrop > 0}/>
        <MetricCell label="化石记录"  value={after.occCount}/>
        <MetricCell label="纬度跨度"  value={after.latSpread} suffix="°"
          delta={latDrop !== 0 ? `${latDrop > 0 ? '↓' : '↑'} ${Math.abs(latDrop)}%` : undefined}
          deltaBad={latDrop > 0}/>
        <MetricCell label="门数"     value={after.phyla.size}
          delta={result.derived.extinctPhyla.length > 0
            ? `灭绝 ${result.derived.extinctPhyla.length}` : undefined}
          deltaBad={true}/>
      </div>
    </section>
  )
}

function MetricCell({ label, value, suffix, delta, deltaBad }: {
  label: string; value: number; suffix?: string; delta?: string; deltaBad?: boolean
}) {
  return (
    <div className="diag-metric">
      <div className="diag-metric-lbl">{label}</div>
      <div className="diag-metric-val">
        <motion.span
          key={value}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}>
          {value.toLocaleString()}{suffix}
        </motion.span>
      </div>
      {delta && (
        <div className={`diag-metric-delta${deltaBad ? ' diag-metric-delta--bad' : ' diag-metric-delta--good'}`}>
          {delta}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════
   ▎纬度分布 ridge —— 前/后叠放 18 个 10° 带
   ══════════════════════════════════════════════════ */
function LatitudeDistribution({
  before, after, hoverBand, setHoverBand,
}: {
  before: DiagnosticMetrics; after: DiagnosticMetrics
  hoverBand: number | null; setHoverBand: (b: number | null) => void
}) {
  const maxCount = Math.max(
    ...before.latBands.map(b => b.count),
    ...after.latBands.map(b => b.count),
    1,
  )
  return (
    <section className="diag-lat">
      <h3 className="diag-section-title">纬度带化石分布 <span className="diag-sub">（悬停联动地图）</span></h3>
      <div className="diag-lat-grid">
        <div className="diag-lat-axis">
          <span>90°N</span><span>0°</span><span>90°S</span>
        </div>
        <div className="diag-lat-bars">
          {before.latBands.map((bBand, i) => {
            const aBand = after.latBands[i]
            const center = bBand.band
            const hot = hoverBand === center
            return (
              <div key={center}
                className={`diag-lat-row${hot ? ' diag-lat-row--hot' : ''}`}
                onMouseEnter={() => setHoverBand(center)}
                onMouseLeave={() => setHoverBand(null)}>
                <div className="diag-lat-bar diag-lat-bar--before"
                  style={{ width: `${(bBand.count / maxCount) * 100}%` }}
                  title={`灭绝前 ${bBand.count} 条化石`}/>
                <div className="diag-lat-bar diag-lat-bar--after"
                  style={{ width: `${(aBand.count / maxCount) * 100}%` }}
                  title={`灭绝后 ${aBand.count} 条化石`}/>
                {hot && (
                  <div className="diag-lat-label">
                    {latBandLabel(center)} · 前 {bBand.count} / 后 {aBand.count}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <div className="diag-lat-legend">
        <span className="diag-lat-chip diag-lat-chip--before"/> 灭绝前
        <span className="diag-lat-chip diag-lat-chip--after"/> 灭绝后
      </div>
    </section>
  )
}

function latBandLabel(center: number): string {
  const lo = center - 5, hi = center + 5
  const fmt = (v: number) => v === 0 ? '0°' : v > 0 ? `${v}°N` : `${-v}°S`
  return `${fmt(lo)}~${fmt(hi)}`
}

/* ══════════════════════════════════════════════════
   ▎古地理迷你地图 —— 前/后并列散点
   ══════════════════════════════════════════════════ */
function MiniMaps({
  before, after, hoverPhylum, hoverBand,
}: {
  before: DiagnosticMetrics; after: DiagnosticMetrics
  hoverPhylum: string | null; hoverBand: number | null
}) {
  return (
    <section className="diag-maps">
      <h3 className="diag-section-title">
        化石古地理分布
        <span className="diag-sub">
          （{hoverPhylum ? `高亮：${hoverPhylum}` : hoverBand !== null ? `高亮纬度：${latBandLabel(hoverBand)}` : '悬停上方维度以联动'}）
        </span>
      </h3>
      <div className="diag-maps-grid">
        <MiniMap occs={before.occurrences} label="灭绝前"
          hoverPhylum={hoverPhylum} hoverBand={hoverBand} accent="before"/>
        <MiniMap occs={after.occurrences} label="灭绝后"
          hoverPhylum={hoverPhylum} hoverBand={hoverBand} accent="after"/>
      </div>
    </section>
  )
}

function MiniMap({ occs, label, hoverPhylum, hoverBand, accent }: {
  occs: Occurrence[]; label: string
  hoverPhylum: string | null; hoverBand: number | null
  accent: 'before' | 'after'
}) {
  const W = 360, H = 180
  return (
    <div className={`diag-map diag-map--${accent}`}>
      <div className="diag-map-title">{label} · {occs.length} 条</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="diag-map-svg">
        {/* 经纬网格 */}
        {[0, 45, 90, 135, 180, 225, 270, 315, 360].map(x => (
          <line key={`v${x}`} x1={x * W / 360} x2={x * W / 360} y1={0} y2={H}
            className="diag-map-grid"/>
        ))}
        {[30, 60, 90, 120, 150].map(y => (
          <line key={`h${y}`} x1={0} x2={W} y1={y} y2={H * y / 180}
            className="diag-map-grid"/>
        ))}
        {/* 赤道 */}
        <line x1={0} x2={W} y1={H / 2} y2={H / 2} className="diag-map-eq"/>

        {/* 化石点 */}
        {occs.map((o, i) => {
          const lat = o.paleolat ?? o.lat
          const lng = o.paleolng ?? o.lng
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
          const x = (lng + 180) / 360 * W
          const y = (90 - lat) / 180 * H
          const phMatch = hoverPhylum ? o.phl === hoverPhylum : true
          const bandCenter = Math.floor((lat + 90) / 10) * 10 - 90 + 5
          const bandMatch = hoverBand === null ? true : Math.abs(bandCenter - hoverBand) < 0.1
          const dim = !(phMatch && bandMatch)
          return (
            <circle key={o.oid || i}
              cx={x} cy={y} r={dim ? 1 : 1.8}
              className={`diag-map-dot${dim ? ' diag-map-dot--dim' : ''}`}/>
          )
        })}
      </svg>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   ▎门级消长双向条形
   ══════════════════════════════════════════════════ */
function PhylaChanges({
  changes, sortMode, setSortMode, hoverPhylum, setHoverPhylum, onPickTaxon,
}: {
  changes: TaxonChange[]
  sortMode: SortMode; setSortMode: (m: SortMode) => void
  hoverPhylum: string | null; setHoverPhylum: (p: string | null) => void
  onPickTaxon: (name: string) => void
}) {
  const maxCount = Math.max(...changes.map(c => Math.max(c.before, c.after)), 1)

  return (
    <section className="diag-phyla">
      <div className="diag-section-head">
        <h3 className="diag-section-title">
          门级消长对比
          <span className="diag-sub">（点击条目聚焦到主界面）</span>
        </h3>
        <div className="diag-sort">
          <button className={sortMode === 'lossRate' ? 'on' : ''}
            onClick={() => setSortMode('lossRate')}>按消亡率</button>
          <button className={sortMode === 'loss' ? 'on' : ''}
            onClick={() => setSortMode('loss')}>按消亡数</button>
          <button className={sortMode === 'before' ? 'on' : ''}
            onClick={() => setSortMode('before')}>按原丰度</button>
        </div>
      </div>

      <ul className="diag-phyla-list">
        {changes.map((c, idx) => {
          const hot = hoverPhylum === c.name
          const dim = hoverPhylum !== null && !hot
          return (
            <motion.li key={c.name}
              className={`diag-phyla-row${hot ? ' diag-phyla-row--hot' : ''}${dim ? ' diag-phyla-row--dim' : ''}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: dim ? 0.4 : 1, x: 0 }}
              transition={{ duration: 0.4, delay: Math.min(idx * 0.04, 0.35) }}
              onMouseEnter={() => setHoverPhylum(c.name)}
              onMouseLeave={() => setHoverPhylum(null)}
              onClick={() => onPickTaxon(c.name)}>

              <div className="diag-phyla-name">{c.name}</div>

              <div className="diag-phyla-bars">
                <div className="diag-phyla-half diag-phyla-half--left">
                  <motion.div className="diag-phyla-bar diag-phyla-bar--before"
                    initial={{ width: 0 }}
                    animate={{ width: `${(c.before / maxCount) * 100}%` }}
                    transition={{ duration: 0.7, delay: 0.1 + idx * 0.02, ease: 'easeOut' }}/>
                  <span className="diag-phyla-num">{c.before}</span>
                </div>
                <div className="diag-phyla-half diag-phyla-half--right">
                  <span className="diag-phyla-num">{c.after}</span>
                  <motion.div className="diag-phyla-bar diag-phyla-bar--after"
                    initial={{ width: 0 }}
                    animate={{ width: `${(c.after / maxCount) * 100}%` }}
                    transition={{ duration: 0.7, delay: 0.15 + idx * 0.02, ease: 'easeOut' }}/>
                </div>
              </div>

              <div className={`diag-phyla-rate${c.lossRate > 0.5 ? ' severe' : c.lossRate > 0.2 ? ' moderate' : ''}`}>
                {c.lossRate < 0
                  ? '新增'
                  : c.before === 0
                    ? '—'
                    : `−${Math.round(c.lossRate * 100)}%`}
              </div>
            </motion.li>
          )
        })}
      </ul>
    </section>
  )
}

/* ══════════════════════════════════════════════════
   ▎自动洞察页脚
   ══════════════════════════════════════════════════ */
function InsightsFooter({ insights }: { insights: string[] }) {
  return (
    <section className="diag-insights">
      <h3 className="diag-section-title">数据洞察</h3>
      <ul>
        {insights.map((line, i) => (
          <motion.li key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 + i * 0.08 }}>
            <span className="diag-insight-marker">▎</span>{line}
          </motion.li>
        ))}
      </ul>
    </section>
  )
}
