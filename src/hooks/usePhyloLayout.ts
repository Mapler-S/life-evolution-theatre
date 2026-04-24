import { useEffect, useMemo, useRef, useState } from 'react'
import { cluster, hierarchy } from 'd3'
import type { PhyloTreeNode } from '../utils/phyloSeed'
import type {
  LaidOutLink,
  LaidOutNode,
  PhyloLayoutRequest,
  PhyloLayoutResponse,
} from '../workers/phyloLayout.worker'

export interface PhyloLayout {
  nodes: LaidOutNode[]
  links: LaidOutLink[]
}

/**
 * 同步计算（fallback）—— 用于首次渲染 / Worker 不可用环境。
 * 对当前规模（百来个节点）延迟约 1ms，可忽略。
 */
function computeSync(data: PhyloTreeNode, radius: number): PhyloLayout {
  const root = cluster<PhyloTreeNode>()
    .size([2 * Math.PI, radius])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.8) / a.depth)(
      hierarchy<PhyloTreeNode>(data),
    )
  return {
    nodes: root.descendants().map((n) => ({
      id: n.data.id,
      depth: n.depth,
      x: n.x,
      y: n.y,
      isLeaf: !n.children || n.children.length === 0,
    })),
    links: root.links().map((l) => ({
      sourceId: l.source.data.id,
      targetId: l.target.data.id,
      sx: l.source.x,
      sy: l.source.y,
      tx: l.target.x,
      ty: l.target.y,
    })),
  }
}

/**
 * 用 Web Worker 异步计算径向树布局。
 * - 组件 mount 时创建单例 Worker，unmount 时 terminate
 * - 每次 data/radius 变化发起新请求，用 id 过滤过期响应
 * - Worker 尚未返回前使用同步 fallback（避免空白闪烁）
 */
export function usePhyloLayout(
  data: PhyloTreeNode,
  radius: number,
): PhyloLayout {
  const workerRef = useRef<Worker | null>(null)
  const reqIdRef = useRef(0)
  const [workerResult, setAsync] = useState<PhyloLayout | null>(null)

  // 同步 fallback（也作为 Worker 就绪前的初值）
  const fallback = useMemo(() => computeSync(data, radius), [data, radius])

  /* 创建 Worker（惰性，只创建一次） */
  useEffect(() => {
    let worker: Worker
    try {
      worker = new Worker(
        new URL('../workers/phyloLayout.worker.ts', import.meta.url),
        { type: 'module' },
      )
    } catch {
      // Worker 不可用（例如 SSR / 旧浏览器），直接返回，组件将持续使用 fallback
      return
    }
    workerRef.current = worker

    worker.onmessage = (ev: MessageEvent<PhyloLayoutResponse>) => {
      if (ev.data.id !== reqIdRef.current) return // 过期响应
      setAsync({ nodes: ev.data.nodes, links: ev.data.links })
    }

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  /* 参数变化 → 发送新请求 */
  useEffect(() => {
    const worker = workerRef.current
    if (!worker) return
    const id = ++reqIdRef.current
    const req: PhyloLayoutRequest = { id, data, radius }
    worker.postMessage(req)
  }, [data, radius])

  return workerResult ?? fallback
}
