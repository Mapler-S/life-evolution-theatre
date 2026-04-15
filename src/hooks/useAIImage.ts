import { useCallback, useState } from 'react'
import { useExploreStore } from '../stores/useExploreStore'
import type { AIImageResult, AIImageStyle, AIProvider } from '../types'

/**
 * AI 绘图封装 — 支持 Stability AI / DALL·E / Replicate 三种后端
 *
 * ⚠️ 浏览器直连注意事项：
 * - OpenAI 与 Stability 端点官方不支持浏览器 CORS 直连，生产环境应走代理
 * - 本项目为展示 Demo，默认使用用户自带 API Key 从浏览器直发
 * - Replicate 需要配置代理或使用 Replicate 的浏览器 SDK
 */

// ============================================================
// 风格预设 — 拼接到 prompt 末尾
// ============================================================

const STYLE_SUFFIXES: Record<AIImageStyle, string> = {
  scientific:
    'rendered as a premium museum scientific plate: hyper-detailed anatomy, fine ink leader-line annotations pointing to key features, parchment-tone border with elegant serif specimen label, inspired by Ernst Haeckel Kunstformen and modern paleoart of Julius Csotonyi, 8K resolution, extreme detail',
  cinematic:
    'rendered as cinematic paleoart: dramatic volumetric god-ray lighting, atmospheric haze, ultra-wide anamorphic lens feel, depth-of-field bokeh, National Geographic cover quality, photorealistic skin and feather textures, subtle film grain, 8K resolution',
  diorama:
    'rendered as a natural history museum diorama scene: soft diffused gallery lighting with warm spotlights, slight tilt-shift miniature effect, painted cyclorama background blending into foreground, realistic scale models with visible brushstroke texture on backdrop, dust motes in light beams',
  diptych:
    'rendered as a grand diptych comparison plate: split composition with dramatic contrast between panels, unified by a geological boundary marker, museum-quality detail in both halves, chiaroscuro lighting, gold-leaf style dividing line, monumental and emotionally resonant',
}

export function composePrompt(base: string, style: AIImageStyle): string {
  return `${base.trim()}, ${STYLE_SUFFIXES[style]}`.replace(/\s+/g, ' ').trim()
}

// ============================================================
// Provider 适配器
// ============================================================

interface GenerateArgs {
  prompt: string
  apiKey: string
  signal?: AbortSignal
}

/** 调用 Stability AI Core 接口，返回 PNG blob URL */
async function generateStability({
  prompt,
  apiKey,
  signal,
}: GenerateArgs): Promise<string> {
  const form = new FormData()
  form.append('prompt', prompt)
  form.append('output_format', 'png')
  form.append('aspect_ratio', '16:9')

  const response = await fetch(
    '/api/stability/v2beta/stable-image/generate/core',
    {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'image/*',
      },
      body: form,
    },
  )
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Stability AI'))
  }
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

/** 调用 OpenAI DALL·E 3 接口，返回 URL */
async function generateDalle({
  prompt,
  apiKey,
  signal,
}: GenerateArgs): Promise<string> {
  const response = await fetch('/api/openai/v1/images/generations', {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      size: '1792x1024',
      n: 1,
      response_format: 'url',
    }),
  })
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'OpenAI'))
  }
  const data = (await response.json()) as { data: Array<{ url: string }> }
  return data.data[0].url
}

/**
 * 调用 Replicate SDXL 接口。
 * Replicate 是异步流程：创建预测 → 轮询 → 取结果
 */
async function generateReplicate({
  prompt,
  apiKey,
  signal,
}: GenerateArgs): Promise<string> {
  const create = await fetch('/api/replicate/v1/predictions', {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({
      // SDXL 模型版本
      version:
        '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
      input: { prompt, width: 1344, height: 768 },
    }),
  })
  if (!create.ok) {
    throw new Error(await extractErrorMessage(create, 'Replicate'))
  }
  const prediction = (await create.json()) as {
    id: string
    status: string
    output?: string[] | string
    urls: { get: string }
  }

  // 若首次即完成（Prefer: wait），直接返回
  if (prediction.status === 'succeeded' && prediction.output) {
    return Array.isArray(prediction.output)
      ? prediction.output[0]
      : prediction.output
  }

  // 否则轮询至多 60 次（~1 分钟）
  for (let i = 0; i < 60; i++) {
    await delay(1000, signal)
    const pollUrl = prediction.urls.get.replace('https://api.replicate.com', '/api/replicate')
    const poll = await fetch(pollUrl, {
      signal,
      headers: { Authorization: `Token ${apiKey}` },
    })
    const state = (await poll.json()) as {
      status: string
      output?: string[] | string
      error?: string
    }
    if (state.status === 'succeeded' && state.output) {
      return Array.isArray(state.output) ? state.output[0] : state.output
    }
    if (state.status === 'failed' || state.status === 'canceled') {
      throw new Error(`Replicate: ${state.error ?? state.status}`)
    }
  }
  throw new Error('Replicate: prediction timed out')
}

const PROVIDERS: Record<AIProvider, (args: GenerateArgs) => Promise<string>> = {
  stability: generateStability,
  dalle: generateDalle,
  replicate: generateReplicate,
}

// ============================================================
// Hook
// ============================================================

export interface UseAIImageReturn {
  imageUrl: string | null
  loading: boolean
  error: Error | null
  /** 生成一张图，返回完整结果对象（便于加入画廊） */
  generateImage: (
    basePrompt: string,
    style?: AIImageStyle,
  ) => Promise<AIImageResult>
  reset: () => void
}

export function useAIImage(): UseAIImageReturn {
  const apiKey = useExploreStore((s) => s.aiApiKey)
  const provider = useExploreStore((s) => s.aiProvider)

  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const generateImage = useCallback(
    async (
      basePrompt: string,
      style: AIImageStyle = 'scientific',
    ): Promise<AIImageResult> => {
      if (!apiKey) {
        const err = new Error('未配置 AI API Key，请在设置面板填写。')
        setError(err)
        throw err
      }

      const prompt = composePrompt(basePrompt, style)
      setLoading(true)
      setError(null)

      try {
        const url = await PROVIDERS[provider]({ prompt, apiKey })
        setImageUrl(url)
        return {
          id: crypto.randomUUID(),
          url,
          prompt,
          provider,
          style,
          createdAt: Date.now(),
        }
      } catch (err) {
        const normalized =
          err instanceof Error ? err : new Error(String(err))
        setError(normalized)
        throw normalized
      } finally {
        setLoading(false)
      }
    },
    [apiKey, provider],
  )

  const reset = useCallback(() => {
    setImageUrl(null)
    setError(null)
    setLoading(false)
  }, [])

  return { imageUrl, loading, error, generateImage, reset }
}

// ============================================================
// 内部工具
// ============================================================

async function extractErrorMessage(
  response: Response,
  label: string,
): Promise<string> {
  const text = await response.text().catch(() => '')
  return `${label} ${response.status}: ${text || response.statusText}`
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}
