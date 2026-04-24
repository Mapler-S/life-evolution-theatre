import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Timeline } from './components/Timeline'
import { PhyloTree } from './components/PhyloTree'
import { GeoMap } from './components/GeoMap'
import { AICanvas } from './components/AICanvas'
import { GuidedNarrative } from './components/GuidedNarrative'
import { ExtinctionDiagnostic } from './components/ExtinctionDiagnostic'
import { useExploreStore } from './stores/useExploreStore'
import './styles/App.css'

export default function App() {
  const viewMode = useExploreStore(s => s.viewMode)
  const setMode  = useExploreStore(s => s.setViewMode)
  const selExt   = useExploreStore(s => s.selectedExtinction)
  const setDiag  = useExploreStore(s => s.setDiagnosticOpen)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [flashKey, setFlashKey] = useState(0)

  /* 每次切换灭绝事件时触发闪烁 */
  useEffect(() => {
    if (selExt) setFlashKey(k => k + 1)
  }, [selExt])

  return (
    <div className="app" key={`flash-${flashKey}`} style={selExt ? { animation: 'ext-flash 0.6s ease-out' } : undefined}>
      <header className="app-hd">
        <div className="app-hd-left">
          <h1>生命演化剧场</h1>
          <p>Life Evolution Theatre</p>
        </div>

        <nav className="app-nav">
          {/* 模式切换 */}
          <div className="app-mode">
            <button
              className={`app-mode-btn${viewMode === 'guided' ? ' app-mode-btn--on' : ''}`}
              onClick={() => setMode('guided')}>
              引导叙事
            </button>
            <button
              className={`app-mode-btn${viewMode === 'explore' ? ' app-mode-btn--on' : ''}`}
              onClick={() => setMode('explore')}>
              自由探索
            </button>
          </div>

          {/* 灭绝事件指示器 */}
          <AnimatePresence>
            {selExt && (
              <motion.button className="app-ext-badge app-ext-badge--btn"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                onClick={() => setDiag(true)}
                title="打开深度诊断">
                <span className="app-ext-dot"/>
                {selExt.nameZh} · {selExt.ma} Ma
                <span className="app-ext-badge-arrow">⊹</span>
              </motion.button>
            )}
          </AnimatePresence>

          {/* 关于 */}
          <div className="app-about-wrap">
            <button className="app-about-btn" onClick={() => setAboutOpen(v => !v)}
              aria-label="关于">?</button>
            <AnimatePresence>
              {aboutOpen && (
                <motion.div className="app-about-pop"
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
                  <h4>生命演化剧场 v0.1</h4>
                  <p>物种灭绝与演化的沉浸式时间旅行。</p>
                  <ul>
                    <li>数据来源：Paleobiology Database (PBDB)</li>
                    <li>AI 绘图：Stability AI / DALL·E / Replicate</li>
                    <li>可视化：D3.js + Framer Motion</li>
                  </ul>
                  <p className="app-about-copy">Built with React + TypeScript</p>
                  <a className="app-about-link"
                    href={`${import.meta.env.BASE_URL}report.html`}
                    target="_blank" rel="noreferrer">
                    📄 查看项目说明文档 →
                  </a>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>
      </header>

      <main className="app-main">
        <section className="app-panel app-panel--tree">
          <PhyloTree />
        </section>

        <section className="app-panel app-panel--map">
          <GeoMap />
        </section>

        <section className="app-panel app-panel--ai">
          <AICanvas />
        </section>
      </main>

      <footer className="app-ft">
        <Timeline />
      </footer>

      <GuidedNarrative />
      <ExtinctionDiagnostic />
    </div>
  )
}
