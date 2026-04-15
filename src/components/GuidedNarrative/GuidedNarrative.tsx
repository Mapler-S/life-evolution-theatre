import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BIG_FIVE_EXTINCTIONS } from '../../utils/geoTimeScale'
import { useExploreStore } from '../../stores/useExploreStore'
import type { ExtinctionEvent } from '../../types'
import './GuidedNarrative.css'

/* ── 章节叙事文本 ── */
interface Chapter {
  event: ExtinctionEvent
  title: string
  narrative: string[]
}

const NARRATIVES: Record<string, { title: string; narrative: string[] }> = {
  'ordovician-silurian': {
    title: '第一章 · 冰封海洋',
    narrative: [
      '4.45 亿年前，奥陶纪的海洋正处于生命的盛宴。三叶虫在浅海中穿行，笔石在洋流中漂浮，腕足动物铺满了海底。',
      '然而冈瓦纳大陆正在向南极漂移。冰盖扩张，海平面骤降，曾经温暖的浅海大面积裸露。',
      '约 57% 的属在这场冰期中消亡 —— 这是地球生命经历的第一次大规模灭绝。',
    ],
  },
  'late-devonian': {
    title: '第二章 · 鱼类的黄昏',
    narrative: [
      '3.72 亿年前，泥盆纪被称为"鱼类时代"。盾皮鱼邓氏鱼长达 6 米，是海洋中无可争议的霸主。',
      'Kellwasser 和 Hangenberg 两次灭绝脉冲接连袭来，持续数百万年。造礁生物崩溃，盾皮鱼全部消亡。',
      '约 50% 的属在这漫长的衰退中灭绝。但生命的韧性令人惊叹 —— 四足动物正在此时迈出登陆的第一步。',
    ],
  },
  'permian-triassic': {
    title: '第三章 · 大死亡',
    narrative: [
      '2.52 亿年前，二叠纪末，地球经历了史上最惨烈的一次灭绝 —— "The Great Dying"。',
      '西伯利亚地盾喷发了约 300 万立方千米的岩浆。CO₂ 浓度飙升，全球温度上升 10°C，海洋酸化、缺氧。',
      '三叶虫、海蝎在延续了三亿年后全部消亡；96% 的海洋物种和 70% 的陆地脊椎动物灭绝。生命跌入谷底。',
      '地球花了近 1000 万年才恢复到灭绝前的多样性水平。',
    ],
  },
  'triassic-jurassic': {
    title: '第四章 · 恐龙的崛起',
    narrative: [
      '2.01 亿年前，三叠纪末，中大西洋岩浆省（CAMP）大规模喷发，盘古大陆开始裂解。',
      '牙形石彻底消失，多种非恐龙主龙类灭绝。约 48% 的属在这次事件中消亡。',
      '但灾难也是机遇 —— 恐龙在竞争者被清除后迅速辐射演化，开启了长达 1.35 亿年的统治时代。',
    ],
  },
  'cretaceous-paleogene': {
    title: '第五章 · 天降之火',
    narrative: [
      '6600 万年前，一颗直径约 10 千米的小行星以 20 千米/秒的速度撞入墨西哥尤卡坦半岛。',
      '希克苏鲁伯撞击释放的能量相当于 100 万亿吨 TNT。海啸席卷全球，森林大火蔓延，撞击冬季遮蔽阳光长达数年。',
      '非鸟类恐龙、翼龙、菊石、沧龙、蛇颈龙 —— 这些统治了中生代的巨兽，全部在这一瞬间画上句号。',
      '但鸟类幸存了下来，哺乳动物走出洞穴，迎来了属于它们的时代。而我们 —— 智人，正是这场灾难的间接产物。',
    ],
  },
}

const CHAPTERS: Chapter[] = BIG_FIVE_EXTINCTIONS.map(ev => ({
  event: ev,
  ...NARRATIVES[ev.id],
}))

/* ══════════════════════════════════════════════════ */
export default function GuidedNarrative() {
  const viewMode = useExploreStore(s => s.viewMode)
  const setExt   = useExploreStore(s => s.setSelectedExtinction)
  const setMode  = useExploreStore(s => s.setViewMode)

  const [chapterIdx, setChapterIdx] = useState(0)
  const [paraIdx, setParaIdx]       = useState(0)
  const [exiting, setExiting]       = useState(false)

  const chapter = CHAPTERS[chapterIdx]
  const isLast  = chapterIdx === CHAPTERS.length - 1 && paraIdx === chapter.narrative.length - 1

  /* 进入引导模式时，选中第一个灭绝事件 */
  useEffect(() => {
    if (viewMode === 'guided') {
      setChapterIdx(0)
      setParaIdx(0)
      setExt(CHAPTERS[0].event)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode])

  /* 切换章节时同步选中灭绝事件 */
  useEffect(() => {
    if (viewMode === 'guided') {
      setExt(CHAPTERS[chapterIdx].event)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterIdx])

  const next = useCallback(() => {
    if (paraIdx < chapter.narrative.length - 1) {
      setParaIdx(p => p + 1)
    } else if (chapterIdx < CHAPTERS.length - 1) {
      setChapterIdx(i => i + 1)
      setParaIdx(0)
    }
  }, [paraIdx, chapterIdx, chapter])

  const prev = useCallback(() => {
    if (paraIdx > 0) {
      setParaIdx(p => p - 1)
    } else if (chapterIdx > 0) {
      setChapterIdx(i => {
        const prevChapter = CHAPTERS[i - 1]
        setParaIdx(prevChapter.narrative.length - 1)
        return i - 1
      })
    }
  }, [paraIdx, chapterIdx])

  const exit = useCallback(() => {
    setExiting(true)
    setTimeout(() => {
      setMode('explore')
      setExiting(false)
    }, 350)
  }, [setMode])

  /* 键盘导航 */
  useEffect(() => {
    if (viewMode !== 'guided') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
      else if (e.key === 'Escape') exit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewMode, next, prev, exit])

  if (viewMode !== 'guided') return null

  const progress = ((chapterIdx * chapter.narrative.length + paraIdx + 1) /
    CHAPTERS.reduce((s, c) => s + c.narrative.length, 0)) * 100

  return (
    <motion.div
      className={`gn-overlay${exiting ? ' gn-overlay--exit' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}>

      {/* 进度条 */}
      <div className="gn-progress">
        <motion.div className="gn-progress-bar"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}/>
      </div>

      {/* 章节指示器 */}
      <div className="gn-chapters">
        {CHAPTERS.map((c, i) => (
          <button key={c.event.id}
            className={`gn-chapter-dot${i === chapterIdx ? ' gn-chapter-dot--on' : ''}${i < chapterIdx ? ' gn-chapter-dot--done' : ''}`}
            onClick={() => { setChapterIdx(i); setParaIdx(0) }}
            title={c.event.nameZh}/>
        ))}
      </div>

      {/* 叙事卡片 */}
      <div className="gn-card">
        <AnimatePresence mode="wait">
          <motion.div key={`${chapterIdx}-${paraIdx}`} className="gn-card-inner"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35 }}>

            <div className="gn-card-header">
              <span className="gn-card-chapter">{chapter.title}</span>
              <span className="gn-card-ma">{chapter.event.ma} Ma</span>
            </div>

            <h2 className="gn-card-name">{chapter.event.nameZh}</h2>

            <div className="gn-card-severity">
              <div className="gn-card-severity-bar">
                <motion.div className="gn-card-severity-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${chapter.event.severity * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.2 }}/>
              </div>
              <span>{Math.round(chapter.event.severity * 100)}% 属级灭绝率</span>
            </div>

            <p className="gn-card-text">{chapter.narrative[paraIdx]}</p>

            <div className="gn-card-para-dots">
              {chapter.narrative.map((_, i) => (
                <span key={i} className={`gn-para-dot${i === paraIdx ? ' gn-para-dot--on' : ''}`}/>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* 导航 */}
        <div className="gn-nav">
          <button className="gn-nav-btn" onClick={prev}
            disabled={chapterIdx === 0 && paraIdx === 0}>
            ← 上一段
          </button>

          <button className="gn-nav-exit" onClick={exit}>
            退出引导
          </button>

          {isLast ? (
            <button className="gn-nav-btn gn-nav-btn--end" onClick={exit}>
              开始探索 →
            </button>
          ) : (
            <button className="gn-nav-btn" onClick={next}>
              下一段 →
            </button>
          )}
        </div>
      </div>

      {/* 键盘提示 */}
      <div className="gn-keys">
        ← → 翻页 · Space 下一段 · Esc 退出
      </div>
    </motion.div>
  )
}
