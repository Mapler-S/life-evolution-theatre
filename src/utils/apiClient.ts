/**
 * 轻量 API 客户端：fetch 封装 + AbortController 支持 + 内存级 Map 缓存
 *
 * 设计要点：
 * - 相同 URL 在 TTL 内直接命中缓存，减少 PBDB API 调用次数
 * - 同一 URL 并发请求时共享 in-flight Promise，避免重复请求
 * - AbortSignal 中断只影响当次调用，不清除缓存
 */

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 分钟

interface CacheEntry<T = unknown> {
  data: T
  timestamp: number
}

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<unknown>>()

export interface FetchOptions {
  signal?: AbortSignal
  /** 是否启用缓存，默认 true */
  cache?: boolean
  /** 自定义 TTL（毫秒），默认 5 分钟 */
  ttl?: number
  /** 附加请求头 */
  headers?: Record<string, string>
}

/**
 * 发起 GET 请求并以 JSON 返回。
 * 命中缓存时不产生网络请求。
 */
export async function fetchJson<T>(
  url: string,
  options: FetchOptions = {},
): Promise<T> {
  const useCache = options.cache !== false
  const ttl = options.ttl ?? CACHE_TTL_MS

  if (useCache) {
    const cached = cache.get(url) as CacheEntry<T> | undefined
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data
    }

    const pending = inflight.get(url) as Promise<T> | undefined
    if (pending) return pending
  }

  const request = fetch(url, {
    signal: options.signal,
    headers: options.headers,
  }).then(async (response) => {
    if (!response.ok) {
      throw new ApiError(
        `Request failed: ${response.status} ${response.statusText}`,
        response.status,
        url,
      )
    }
    const data = (await response.json()) as T
    if (useCache) {
      cache.set(url, { data, timestamp: Date.now() })
    }
    return data
  })

  if (useCache) {
    inflight.set(url, request)
    request.finally(() => inflight.delete(url))
  }

  return request
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
