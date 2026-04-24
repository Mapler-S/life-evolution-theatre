/// <reference lib="webworker" />
/**
 * 演化谱系树布局 Worker
 *
 * 在 Worker 线程中运行 d3.cluster()，把重排序 / 分隔计算从主线程剥离，
 * 避免大树（数百节点）导致的主线程掉帧。
 *
 * 输入：{ id, data: PhyloTreeNode (含 children), radius }
 * 输出：{ id, nodes: NodeOut[], links: LinkOut[] }
 *  - nodes.x 为径向角度（rad），nodes.y 为半径（px）
 *  - links 内嵌 source/target 坐标，主线程可直接传给 d3.linkRadial
 */

import { cluster, hierarchy } from 'd3'
import type { PhyloTreeNode } from '../utils/phyloSeed'

export interface PhyloLayoutRequest {
  id: number
  data: PhyloTreeNode
  radius: number
}

export interface LaidOutNode {
  id: string
  depth: number
  x: number
  y: number
  isLeaf: boolean
}

export interface LaidOutLink {
  sourceId: string
  targetId: string
  sx: number
  sy: number
  tx: number
  ty: number
}

export interface PhyloLayoutResponse {
  id: number
  nodes: LaidOutNode[]
  links: LaidOutLink[]
}

const ctx = self as unknown as DedicatedWorkerGlobalScope

ctx.onmessage = (ev: MessageEvent<PhyloLayoutRequest>) => {
  const { id, data, radius } = ev.data
  const root = cluster<PhyloTreeNode>()
    .size([2 * Math.PI, radius])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.8) / a.depth)(
      hierarchy<PhyloTreeNode>(data),
    )

  const nodes: LaidOutNode[] = root.descendants().map((n) => ({
    id: n.data.id,
    depth: n.depth,
    x: n.x,
    y: n.y,
    isLeaf: !n.children || n.children.length === 0,
  }))

  const links: LaidOutLink[] = root.links().map((l) => ({
    sourceId: l.source.data.id,
    targetId: l.target.data.id,
    sx: l.source.x,
    sy: l.source.y,
    tx: l.target.x,
    ty: l.target.y,
  }))

  const response: PhyloLayoutResponse = { id, nodes, links }
  ctx.postMessage(response)
}
