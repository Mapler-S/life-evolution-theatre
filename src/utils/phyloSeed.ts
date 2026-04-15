/**
 * 精选动物界演化树 — 约 55 个节点
 *
 * 用 curated 静态数据而非 PBDB 全量查询：
 * - PBDB all_children 返回数千行未分类噪音，不适合径向树视觉
 * - 每个叶节点精确标注被哪次大灭绝事件所灭，驱动"坍缩"动画
 */

import { BIG_FIVE_EXTINCTIONS } from './geoTimeScale'

export interface PhyloTreeNode {
  id: string
  name: string
  nameZh: string
  rank: 'kingdom' | 'phylum' | 'class' | 'order' | 'subphylum'
  extant: boolean
  /** 对应 BIG_FIVE_EXTINCTIONS 的 id；'pre-big-five' 表示更早灭绝 */
  extinctInEvent?: string
  /** 灭绝 Ma（用于非五大灭绝类群） */
  extinctMa?: number
  /** 规模权重 1-10，映射节点半径 */
  size: number
  description?: string
  children?: PhyloTreeNode[]
}

const EX = {
  ORD: 'ordovician-silurian',
  DEV: 'late-devonian',
  PER: 'permian-triassic',
  TRI: 'triassic-jurassic',
  KPG: 'cretaceous-paleogene',
} as const

export const PHYLO_SEED: PhyloTreeNode = {
  id: 'animalia', name: 'Animalia', nameZh: '动物界', rank: 'kingdom', extant: true, size: 10,
  description: '多细胞动物共同祖先，约 6.5 亿年前诞生于前寒武纪海洋。',
  children: [
    /* ── Porifera ── */
    { id: 'porifera', name: 'Porifera', nameZh: '海绵动物门', rank: 'phylum', extant: true, size: 5, children: [
      { id: 'demospongiae', name: 'Demospongiae', nameZh: '寻常海绵', rank: 'class', extant: true, size: 5 },
      { id: 'calcarea', name: 'Calcarea', nameZh: '钙质海绵', rank: 'class', extant: true, size: 3 },
      { id: 'hexactinellida', name: 'Hexactinellida', nameZh: '玻璃海绵', rank: 'class', extant: true, size: 3 },
      { id: 'archaeocyatha', name: 'Archaeocyatha', nameZh: '古杯动物', rank: 'class', extant: false, extinctInEvent: 'pre-big-five', extinctMa: 510, size: 4, description: '早寒武世造礁生物，寒武纪中期消失。' },
    ]},

    /* ── Cnidaria ── */
    { id: 'cnidaria', name: 'Cnidaria', nameZh: '刺胞动物门', rank: 'phylum', extant: true, size: 7, children: [
      { id: 'anthozoa', name: 'Anthozoa', nameZh: '珊瑚虫纲', rank: 'class', extant: true, size: 8 },
      { id: 'scyphozoa', name: 'Scyphozoa', nameZh: '钵水母纲', rank: 'class', extant: true, size: 4 },
      { id: 'hydrozoa', name: 'Hydrozoa', nameZh: '水螅纲', rank: 'class', extant: true, size: 4 },
      { id: 'rugosa', name: 'Rugosa', nameZh: '皱纹珊瑚', rank: 'order', extant: false, extinctInEvent: EX.PER, size: 6, description: '古生代主要造礁珊瑚，二叠纪末消失。' },
      { id: 'tabulata', name: 'Tabulata', nameZh: '床板珊瑚', rank: 'order', extant: false, extinctInEvent: EX.PER, size: 6 },
    ]},

    /* ── Brachiopoda ── */
    { id: 'brachiopoda', name: 'Brachiopoda', nameZh: '腕足动物门', rank: 'phylum', extant: true, size: 6, description: '古生代海底霸主，二叠纪末重创后再未恢复。', children: [
      { id: 'lingulata', name: 'Lingulata', nameZh: '舌形贝', rank: 'class', extant: true, size: 3 },
      { id: 'rhynchonellata', name: 'Rhynchonellata', nameZh: '小嘴贝', rank: 'class', extant: true, size: 4 },
      { id: 'strophomenata', name: 'Strophomenata', nameZh: '扭月贝', rank: 'class', extant: false, extinctInEvent: EX.TRI, size: 5 },
    ]},

    /* ── Bryozoa ── */
    { id: 'bryozoa', name: 'Bryozoa', nameZh: '苔藓虫门', rank: 'phylum', extant: true, size: 4 },

    /* ── Mollusca ── */
    { id: 'mollusca', name: 'Mollusca', nameZh: '软体动物门', rank: 'phylum', extant: true, size: 9, children: [
      { id: 'bivalvia', name: 'Bivalvia', nameZh: '双壳纲', rank: 'class', extant: true, size: 8 },
      { id: 'gastropoda', name: 'Gastropoda', nameZh: '腹足纲', rank: 'class', extant: true, size: 9 },
      { id: 'nautiloidea', name: 'Nautiloidea', nameZh: '鹦鹉螺', rank: 'class', extant: true, size: 5 },
      { id: 'coleoidea', name: 'Coleoidea', nameZh: '蛸亚纲', rank: 'class', extant: true, size: 4 },
      { id: 'ammonoidea', name: 'Ammonoidea', nameZh: '菊石', rank: 'class', extant: false, extinctInEvent: EX.KPG, size: 8, description: '中生代标志性海洋游泳类群，与恐龙同日灭绝。' },
      { id: 'belemnoidea', name: 'Belemnoidea', nameZh: '箭石', rank: 'order', extant: false, extinctInEvent: EX.KPG, size: 4 },
      { id: 'rostroconchia', name: 'Rostroconchia', nameZh: '喙壳纲', rank: 'class', extant: false, extinctInEvent: EX.PER, size: 3 },
    ]},

    /* ── Arthropoda ── */
    { id: 'arthropoda', name: 'Arthropoda', nameZh: '节肢动物门', rank: 'phylum', extant: true, size: 10, children: [
      { id: 'chelicerata', name: 'Chelicerata', nameZh: '螯肢亚门', rank: 'subphylum', extant: true, size: 7 },
      { id: 'crustacea', name: 'Crustacea', nameZh: '甲壳亚门', rank: 'subphylum', extant: true, size: 8 },
      { id: 'hexapoda', name: 'Hexapoda', nameZh: '六足亚门（昆虫）', rank: 'subphylum', extant: true, size: 10 },
      { id: 'myriapoda', name: 'Myriapoda', nameZh: '多足亚门', rank: 'subphylum', extant: true, size: 5 },
      { id: 'trilobita', name: 'Trilobita', nameZh: '三叶虫', rank: 'class', extant: false, extinctInEvent: EX.PER, size: 7, description: '古生代标志性海洋节肢动物，历经三亿年后在大灭绝中全数消亡。' },
      { id: 'eurypterida', name: 'Eurypterida', nameZh: '板足鲎（海蝎）', rank: 'order', extant: false, extinctInEvent: EX.PER, size: 5 },
    ]},

    /* ── Echinodermata ── */
    { id: 'echinodermata', name: 'Echinodermata', nameZh: '棘皮动物门', rank: 'phylum', extant: true, size: 7, children: [
      { id: 'crinoidea', name: 'Crinoidea', nameZh: '海百合', rank: 'class', extant: true, size: 6 },
      { id: 'asteroidea', name: 'Asteroidea', nameZh: '海星', rank: 'class', extant: true, size: 5 },
      { id: 'echinoidea', name: 'Echinoidea', nameZh: '海胆', rank: 'class', extant: true, size: 5 },
      { id: 'holothuroidea', name: 'Holothuroidea', nameZh: '海参', rank: 'class', extant: true, size: 4 },
      { id: 'blastoidea', name: 'Blastoidea', nameZh: '海蕾', rank: 'class', extant: false, extinctInEvent: EX.PER, size: 4 },
      { id: 'cystoidea', name: 'Cystoidea', nameZh: '海林檎', rank: 'class', extant: false, extinctInEvent: EX.DEV, size: 4 },
    ]},

    /* ── 笔石 ── */
    { id: 'graptolithina', name: 'Graptolithina', nameZh: '笔石', rank: 'class', extant: false, extinctInEvent: 'pre-big-five', extinctMa: 320, size: 5, description: '奥陶纪受重创，石炭纪消亡。' },

    /* ── 牙形石 ── */
    { id: 'conodonta', name: 'Conodonta', nameZh: '牙形石', rank: 'class', extant: false, extinctInEvent: EX.TRI, size: 4, description: '地层"金钉子"微体化石，三叠纪末消失。' },

    /* ── Chordata ── */
    { id: 'chordata', name: 'Chordata', nameZh: '脊索动物门', rank: 'phylum', extant: true, size: 10, children: [
      { id: 'placodermi', name: 'Placodermi', nameZh: '盾皮鱼', rank: 'class', extant: false, extinctInEvent: EX.DEV, size: 6, description: '泥盆纪鱼类时代的披甲霸主。' },
      { id: 'chondrichthyes', name: 'Chondrichthyes', nameZh: '软骨鱼（鲨鳐）', rank: 'class', extant: true, size: 6 },
      { id: 'osteichthyes', name: 'Osteichthyes', nameZh: '硬骨鱼', rank: 'class', extant: true, size: 9 },
      { id: 'amphibia', name: 'Amphibia', nameZh: '两栖纲', rank: 'class', extant: true, size: 5 },
      { id: 'synapsida', name: 'Synapsida', nameZh: '合弓纲', rank: 'class', extant: true, size: 5, description: '多数在二叠纪末灭绝，幸存者演化为哺乳类。' },
      { id: 'lepidosauria', name: 'Lepidosauria', nameZh: '鳞龙（蜥蛇）', rank: 'order', extant: true, size: 6 },
      { id: 'crocodylia', name: 'Crocodylia', nameZh: '鳄目', rank: 'order', extant: true, size: 4 },
      { id: 'dinosauria', name: 'Dinosauria (non-avian)', nameZh: '恐龙（非鸟）', rank: 'order', extant: false, extinctInEvent: EX.KPG, size: 9, description: '陆地霸主统治 1.6 亿年，希克苏鲁伯撞击后灭绝，仅鸟类幸存。' },
      { id: 'pterosauria', name: 'Pterosauria', nameZh: '翼龙', rank: 'order', extant: false, extinctInEvent: EX.KPG, size: 6 },
      { id: 'mosasauridae', name: 'Mosasauridae', nameZh: '沧龙', rank: 'order', extant: false, extinctInEvent: EX.KPG, size: 5 },
      { id: 'plesiosauria', name: 'Plesiosauria', nameZh: '蛇颈龙', rank: 'order', extant: false, extinctInEvent: EX.KPG, size: 5 },
      { id: 'aves', name: 'Aves', nameZh: '鸟纲', rank: 'class', extant: true, size: 8, description: '唯一在 K-Pg 灭绝中幸存的恐龙分支。' },
      { id: 'mammalia', name: 'Mammalia', nameZh: '哺乳纲', rank: 'class', extant: true, size: 9 },
    ]},
  ],
}

/* ══════════════════════════════════════════════════
   节点状态推导
   ══════════════════════════════════════════════════ */

const EVENT_MA: Record<string, number> = Object.fromEntries(
  BIG_FIVE_EXTINCTIONS.map(e => [e.id, e.ma]),
)

function deathMa(n: PhyloTreeNode): number {
  if (n.extant) return -1
  if (n.extinctInEvent && EVENT_MA[n.extinctInEvent] !== undefined) return EVENT_MA[n.extinctInEvent]
  return n.extinctMa ?? Infinity
}

export type NodeStatus = 'alive' | 'dying-now' | 'dead-earlier' | 'dead'

export function nodeStatus(
  node: PhyloTreeNode,
  event: { id: string; ma: number } | null,
): NodeStatus {
  if (!event) return node.extant ? 'alive' : 'dead'
  if (node.extant) return 'alive'
  if (node.extinctInEvent === event.id) return 'dying-now'
  const dm = deathMa(node)
  if (dm > event.ma) return 'dead-earlier' // 更古老 = Ma 更大 = 更早灭绝
  return 'alive' // 还没到它灭绝的时候
}
