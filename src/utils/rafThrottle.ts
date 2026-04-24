/**
 * requestAnimationFrame 节流 —— 高频事件合并到下一帧，
 * 仅保留最后一次调用参数，避免 state 抖动 / 多余 D3 重渲染。
 *
 * 使用场景：鼠标移动、滚轮缩放、d3.zoom 回调、窗口 resize 等。
 */

export type RafThrottled<A extends readonly unknown[]> = ((...args: A) => void) & {
  /** 取消尚未 flush 的 pending 调用 */
  cancel: () => void
  /** 立即以最后一次参数同步执行（若有 pending） */
  flush: () => void
}

export function rafThrottle<A extends readonly unknown[]>(
  fn: (...args: A) => void,
): RafThrottled<A> {
  let rafId: number | null = null
  let lastArgs: A | null = null

  const throttled = ((...args: A) => {
    lastArgs = args
    if (rafId !== null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      if (lastArgs) {
        const a = lastArgs
        lastArgs = null
        fn(...a)
      }
    })
  }) as RafThrottled<A>

  throttled.cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    lastArgs = null
  }

  throttled.flush = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (lastArgs) {
      const a = lastArgs
      lastArgs = null
      fn(...a)
    }
  }

  return throttled
}

/**
 * React hook 包装：自动在组件卸载时取消 pending 调用。
 * 注意：fn 每次渲染变化时会返回新的节流器。若 fn 引用稳定（useCallback），
 * 则节流器也稳定。
 */
import { useEffect, useMemo } from 'react'

export function useRafThrottle<A extends readonly unknown[]>(
  fn: (...args: A) => void,
): RafThrottled<A> {
  const throttled = useMemo(() => rafThrottle(fn), [fn])
  useEffect(() => () => throttled.cancel(), [throttled])
  return throttled
}
