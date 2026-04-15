import { Timeline } from './components/Timeline'
import { PhyloTree } from './components/PhyloTree'
import { GeoMap } from './components/GeoMap'
import { AICanvas } from './components/AICanvas'
import './styles/App.css'

export default function App() {
  return (
    <div className="app">
      <header className="app-hd">
        <h1>生命演化剧场</h1>
        <p>Life Evolution Theatre — 物种灭绝与演化的沉浸式时间旅行</p>
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
    </div>
  )
}
