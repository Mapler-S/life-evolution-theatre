import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAIImage, composePrompt } from '../../hooks/useAIImage'
import { useExploreStore } from '../../stores/useExploreStore'
import {
  buildDefaultPrompt,
  buildExtinctionDiptychPrompt,
  buildTaxonPrompt,
} from '../../utils/promptBuilder'
import type { AIImageResult, AIImageStyle, AIProvider } from '../../types'
import './AICanvas.css'

/* ── 风格选项 ── */
const STYLES: { id: AIImageStyle; label: string; hint: string }[] = [
  { id: 'scientific', label: '科研插画', hint: '博物馆级解剖细节，无文字' },
  { id: 'cinematic',  label: '电影质感', hint: '戏剧光影，National Geographic 风' },
  { id: 'diorama',    label: '展览立体景', hint: '自然史博物馆 diorama 柔光' },
  { id: 'diptych',    label: '对比双联', hint: '左右并置对照（适合灭绝前后）' },
]

/* ── 提供方选项 ── */
const PROVIDERS: { id: AIProvider; label: string }[] = [
  { id: 'stability', label: 'Stability AI' },
  { id: 'dalle',     label: 'OpenAI DALL·E 3' },
  { id: 'replicate', label: 'Replicate SDXL' },
]

/* ══════════════════════════════════════════════════ */
export default function AICanvas() {
  const selExt   = useExploreStore(s => s.selectedExtinction)
  const selTax   = useExploreStore(s => s.selectedTaxon)
  const gallery  = useExploreStore(s => s.gallery)
  const addImg   = useExploreStore(s => s.addGalleryImage)
  const rmImg    = useExploreStore(s => s.removeGalleryImage)
  const clearG   = useExploreStore(s => s.clearGallery)
  const apiKey   = useExploreStore(s => s.aiApiKey)
  const provider = useExploreStore(s => s.aiProvider)
  const setKey   = useExploreStore(s => s.setAiApiKey)
  const setProv  = useExploreStore(s => s.setAiProvider)

  const { generateImage, loading, error } = useAIImage()

  const [style, setStyle]       = useState<AIImageStyle>('scientific')
  const [basePrompt, setBasePrompt] = useState('')
  const [settingsOpen, setSO]   = useState(false)
  const [lightbox, setLightbox] = useState<AIImageResult | null>(null)

  /* 用原始值做依赖，保证上下文切换时 effect 必触发 */
  const taxId = selTax?.oid ?? ''
  const extId = selExt?.id ?? ''

  useEffect(() => {
    const s = buildDefaultPrompt(selExt, selTax)
    setBasePrompt(s.prompt)
    if (s.scene === 'diptych') setStyle('diptych')
    else if (s.scene === 'taxon') setStyle('scientific')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxId, extId])

  /* 最终发送给 API 的完整 prompt（base + 风格尾缀），用户可实时预览 */
  const finalPrompt = useMemo(
    () => basePrompt ? composePrompt(basePrompt, style) : '',
    [basePrompt, style],
  )

  /* Esc 关闭灯箱 */
  useEffect(() => {
    if (!lightbox) return
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null) }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [lightbox])

  /* ── 生成 ── */
  async function onGenerate() {
    if (!basePrompt.trim()) return
    try {
      const result = await generateImage(basePrompt, style)
      const tags: string[] = []
      if (selExt) tags.push(selExt.nameZh)
      if (selTax) tags.push(selTax.nam)
      addImg({ ...result, tags })
    } catch {
      /* 错误已进入 hook 的 error 状态，这里吞掉避免控制台重复 */
    }
  }

  /* 快捷填充：按场景重置 prompt */
  function fillScene(scene: 'taxon' | 'diptych') {
    if (scene === 'diptych' && selExt) {
      setBasePrompt(buildExtinctionDiptychPrompt(selExt))
      setStyle('diptych')
    } else if (scene === 'taxon' && selTax) {
      setBasePrompt(buildTaxonPrompt({
        taxonName: selTax.nam.replace(/\s*\([^)]*\)/g, '').trim(),
      }))
      setStyle('scientific')
    }
  }

  const ctxLabel = selExt ? `${selExt.nameZh} · ${selExt.ma} Ma`
                 : selTax ? selTax.nam
                 : null

  return (
    <div className="ai-box">
      <header className="ai-hd">
        <div className="ai-hd-main">
          <h3>AI 复原画廊</h3>
          <p className="ai-sub">
            {ctxLabel ?? '选中灭绝事件或分类群以获取建议 prompt'}
          </p>
        </div>
        <button className="ai-gear" onClick={() => setSO(v => !v)}
          title="API 设置" aria-label="API 设置">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" fill="none" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4"
              stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>
      </header>

      {/* 设置抽屉 */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div className="ai-settings"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}>
            <div className="ai-settings-inner">
              <label className="ai-field">
                <span>Provider</span>
                <select value={provider} onChange={e => setProv(e.target.value as AIProvider)}>
                  {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </label>
              <label className="ai-field">
                <span>API Key</span>
                <input type="password" placeholder="sk-… 或 sk_live_…"
                  value={apiKey} onChange={e => setKey(e.target.value)}/>
              </label>
              <p className="ai-settings-note">
                密钥仅保存在浏览器 localStorage。生产部署请走后端代理。
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 快捷场景 */}
      <div className="ai-scenes">
        <button className="ai-chip" disabled={!selExt}
          onClick={() => fillScene('diptych')}>
          灭绝前后双联
        </button>
        <button className="ai-chip" disabled={!selTax}
          onClick={() => fillScene('taxon')}>
          类群复原图
        </button>
      </div>

      {/* Prompt 编辑 */}
      <textarea className="ai-prompt"
        value={basePrompt}
        onChange={e => setBasePrompt(e.target.value)}
        placeholder="用英文描述希望生成的画面；留空则按选中上下文自动生成"
        rows={3}/>

      {/* 实际发送 prompt 预览（含风格后缀） */}
      {finalPrompt && (
        <details className="ai-preview">
          <summary>预览完整 prompt（含风格后缀）</summary>
          <p>{finalPrompt}</p>
        </details>
      )}

      {/* 风格选择 */}
      <div className="ai-styles">
        {STYLES.map(s => (
          <button key={s.id} title={s.hint}
            className={`ai-style-btn${style === s.id ? ' ai-style-btn--on' : ''}`}
            onClick={() => setStyle(s.id)}>
            {s.label}
          </button>
        ))}
      </div>

      {/* 生成按钮 + 状态 */}
      <div className="ai-actions">
        <button className="ai-go" disabled={loading || !basePrompt.trim() || !apiKey}
          onClick={onGenerate}>
          {loading ? (<><span className="ai-go-spin"/>生成中…</>) : '生成画像'}
        </button>
        {!apiKey && (
          <span className="ai-actions-hint" onClick={() => setSO(true)}>
            未配置 API Key — 点击设置
          </span>
        )}
      </div>

      {error && <div className="ai-err">{error.message}</div>}

      {/* 画廊 */}
      <div className="ai-gallery-hd">
        <span>已生成 <b>{gallery.length}</b></span>
        {gallery.length > 0 && (
          <button className="ai-clear" onClick={() => {
            if (confirm('确定清空全部已生成图像？')) clearG()
          }}>清空</button>
        )}
      </div>

      <ul className="ai-gallery">
        {gallery.length === 0 && (
          <li className="ai-empty">
            <p>尚未生成图像</p>
            <p className="ai-sm">选择场景、点击「生成画像」，历史将保存在此</p>
          </li>
        )}
        <AnimatePresence initial={false}>
          {gallery.map(img => (
            <motion.li key={img.id} className="ai-card"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.25 }}
              onClick={() => setLightbox(img)}>
              <img src={img.url} alt={img.prompt}
                onError={e => e.currentTarget.classList.add('ai-img-broken')}/>
              <div className="ai-card-meta">
                <div className="ai-card-time">{formatTime(img.createdAt)}</div>
                {img.tags && img.tags.length > 0 && (
                  <div className="ai-card-tags">{img.tags.join(' · ')}</div>
                )}
              </div>
              <button className="ai-card-rm"
                onClick={e => { e.stopPropagation(); rmImg(img.id) }}
                title="删除">×</button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div className="ai-lightbox"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setLightbox(null)}>
            <motion.div className="ai-lightbox-inner"
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}>
              <img src={lightbox.url} alt={lightbox.prompt}/>
              <div className="ai-lightbox-caption">
                <div className="ai-lightbox-prompt">{lightbox.prompt}</div>
                <div className="ai-lightbox-meta">
                  {PROVIDERS.find(p => p.id === lightbox.provider)?.label} · {lightbox.style} · {formatTime(lightbox.createdAt)}
                </div>
                <div className="ai-lightbox-actions">
                  <a href={lightbox.url} download={`lifeevo-${lightbox.id}.png`}
                    target="_blank" rel="noreferrer" className="ai-lightbox-btn">
                    下载
                  </a>
                  <button className="ai-lightbox-btn" onClick={() => setLightbox(null)}>
                    关闭（Esc）
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── 工具 ── */
function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
