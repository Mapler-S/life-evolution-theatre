/**
 * 轻量 API 客户端：fetch + AbortController + stale-while-revalidate 内存缓存
 *
 * 设计要点：
 * - fresh（< ttl）：直接返回缓存，不发请求
 * - stale（ttl ~ maxAge）：立即返回旧数据，后台静默刷新（SWR）
 * - expired（> maxAge）或无缓存：发网络请求；并发相同 URL 共享 Promise
 * - AbortSignal 仅中断当次调用者，不影响后台刷新 / 其他订阅者
 * - 后台刷新用独立的 AbortController，不被调用方的 signal 关闭
 */

const CACHE_TTL_MS     = 5 * 60 * 1000        // 5 分钟内视为新鲜
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000  // 24 小时后彻底失效

interface CacheEntry<T = unknown> {
  data: T
  timestamp: number
}

const cache    = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<unknown>>()

export interface FetchOptions {
  signal?: AbortSignal
  /** 是否启用缓存，默认 true */
  cache?: boolean
  /** 新鲜期（毫秒），默认 5 分钟 */
  ttl?: number
  /** 最大保留期（毫秒），默认 24 小时；过期后强制重新请求 */
  maxAge?: number
  /** 附加请求头 */
  headers?: Record<string, string>
}

/** 请求超时（ms） —— PBDB 偶尔响应很慢，30s 兜底 */
const REQUEST_TIMEOUT_MS = 30_000
/** 失败重试次数（仅对网络错误 / 5xx / 429） */
const RETRY_ATTEMPTS = 2
/** 重试基准退避（ms），按指数 300 / 900 / 2700 */
const RETRY_BASE_MS = 300

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')) })
  })
}

/** 合并外部 signal 与 timeout signal */
function withTimeout(external?: AbortSignal): { signal: AbortSignal; cleanup: () => void } {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new DOMException('Request timed out', 'TimeoutError')), REQUEST_TIMEOUT_MS)
  const onAbort = () => ctrl.abort(external!.reason)
  if (external) {
    if (external.aborted) ctrl.abort(external.reason)
    else external.addEventListener('abort', onAbort)
  }
  return {
    signal: ctrl.signal,
    cleanup: () => { clearTimeout(timer); external?.removeEventListener('abort', onAbort) },
  }
}

/** 判断是否值得重试：网络层错误 / 5xx / 429 */
function isRetryable(err: unknown): boolean {
  if (err instanceof ApiError) return err.status >= 500 || err.status === 429
  if (err instanceof DOMException && err.name === 'AbortError') return false  // 调用方主动取消
  if (err instanceof DOMException && err.name === 'TimeoutError') return true
  // fetch 网络层失败（DNS / 连接重置 / 断网） → TypeError('Failed to fetch')
  if (err instanceof TypeError) return true
  return false
}

/**
 * 核心网络请求：带超时 + 指数退避重试。
 * 只对网络错误、5xx、429、超时重试；调用方主动 abort 不重试。
 */
async function doFetch<T>(
  url: string,
  headers?: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
    const { signal: s, cleanup } = withTimeout(signal)
    try {
      const response = await fetch(url, { signal: s, headers })
      if (!response.ok) {
        const apiErr = new ApiError(
          `Request failed: ${response.status} ${response.statusText}`,
          response.status,
          url,
        )
        if (attempt < RETRY_ATTEMPTS && isRetryable(apiErr)) {
          lastErr = apiErr
          cleanup()
          await delay(RETRY_BASE_MS * Math.pow(3, attempt), signal)
          continue
        }
        throw apiErr
      }
      return (await response.json()) as T
    } catch (err) {
      lastErr = err
      if (signal?.aborted) throw err
      if (attempt < RETRY_ATTEMPTS && isRetryable(err)) {
        await delay(RETRY_BASE_MS * Math.pow(3, attempt), signal)
        continue
      }
      throw err
    } finally {
      cleanup()
    }
  }
  throw lastErr ?? new Error('Request failed after retries')
}

/**
 * 以 stale-while-revalidate 策略发起 GET 请求。
 */
export async function fetchJson<T>(
  url: string,
  options: FetchOptions = {},
): Promise<T> {
  const useCache = options.cache !== false
  const ttl      = options.ttl    ?? CACHE_TTL_MS
  const maxAge   = options.maxAge ?? CACHE_MAX_AGE_MS

  if (useCache) {
    const cached = cache.get(url) as CacheEntry<T> | undefined
    if (cached) {
      const age = Date.now() - cached.timestamp
      if (age < ttl) {
        // fresh：直接返回
        return cached.data
      }
      if (age < maxAge) {
        // stale：立即返回旧数据，后台静默刷新
        scheduleRevalidate<T>(url, options.headers)
        return cached.data
      }
    }

    // 无缓存或彻底过期：去并发请求 / 发起新请求
    const pending = inflight.get(url) as Promise<T> | undefined
    if (pending) return pending
  }

  const request = doFetch<T>(url, options.headers, options.signal).then((data) => {
    if (useCache) cache.set(url, { data, timestamp: Date.now() })
    return data
  })

  if (useCache) {
    inflight.set(url, request)
    request.finally(() => inflight.delete(url)).catch(() => {})
  }
  return request
}

/**
 * 后台刷新：使用独立 AbortController，失败静默（保留旧缓存）。
 * 若当前 URL 已有 in-flight 请求，不重复发起。
 */
function scheduleRevalidate<T>(url: string, headers?: Record<string, string>): void {
  if (inflight.has(url)) return
  const revalidate = doFetch<T>(url, headers).then((data) => {
    cache.set(url, { data, timestamp: Date.now() })
    return data
  })
  inflight.set(url, revalidate)
  revalidate.finally(() => inflight.delete(url)).catch(() => {
    /* 后台刷新失败：保留旧缓存，不抛给调用方 */
  })
}

/**
 * 发起 POST 请求（用于 AI 绘图等写操作），不做缓存。
 */
export async function postJson<T>(
  url: string,
  body: unknown,
  options: Omit<FetchOptions, 'cache' | 'ttl'> = {},
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    signal: options.signal,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new ApiError(
      `Request failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ''}`,
      response.status,
      url,
    )
  }
  return response.json() as Promise<T>
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** 手动清空缓存（例如用户切换数据源时） */
export function clearApiCache(): void {
  cache.clear()
  inflight.clear()
}
