import type { ExtinctionEvent } from '../types'

/**
 * 五大灭绝事件（Big Five Mass Extinctions）
 * 数据参考：Sepkoski (1982), Raup & Sepkoski (1982)
 * 属级灭绝率来自 Barnosky et al. (2011) 的估计
 */
export const BIG_FIVE_EXTINCTIONS: readonly ExtinctionEvent[] = [
  {
    id: 'ordovician-silurian',
    name: 'Ordovician–Silurian extinction',
    nameZh: '奥陶纪末大灭绝',
    ma: 445,
    severity: 0.57,
    description:
      '冈瓦纳大陆南移导致的冰期与海退造成海洋生物大规模灭绝，笔石、腕足、三叶虫类群受创严重。',
    affectedTaxa: ['Graptolithina', 'Brachiopoda', 'Trilobita', 'Conodonta'],
    intervalBefore: 'Late Ordovician',
    intervalAfter: 'Early Silurian',
  },
  {
    id: 'late-devonian',
    name: 'Late Devonian extinction',
    nameZh: '泥盆纪晚期大灭绝',
    ma: 372,
    severity: 0.5,
    description:
      '一系列持续数百万年的灭绝脉冲（Kellwasser 与 Hangenberg 事件），造礁生物与无颌鱼类几近消失。',
    affectedTaxa: ['Placodermi', 'Agnatha', 'Stromatoporoidea', 'Trilobita'],
    intervalBefore: 'Frasnian',
    intervalAfter: 'Famennian',
  },
  {
    id: 'permian-triassic',
    name: 'Permian–Triassic extinction',
    nameZh: '二叠纪末大灭绝',
    ma: 252,
    severity: 0.83,
    description:
      '史上最大灭绝事件（"The Great Dying"），西伯利亚大火成岩省喷发引发全球暖化与海洋缺氧，约 96% 的海洋物种消亡。',
    affectedTaxa: [
      'Trilobita',
      'Eurypterida',
      'Anthozoa',
      'Synapsida',
      'Crinoidea',
    ],
    intervalBefore: 'Changhsingian',
    intervalAfter: 'Induan',
  },
  {
    id: 'triassic-jurassic',
    name: 'Triassic–Jurassic extinction',
    nameZh: '三叠纪末大灭绝',
    ma: 201,
    severity: 0.48,
    description:
      '中大西洋岩浆省（CAMP）喷发相关的气候剧变，多种非恐龙主龙类灭绝，为恐龙的辐射演化扫清道路。',
    affectedTaxa: ['Conodonta', 'Crurotarsi', 'Ammonoidea', 'Therapsida'],
    intervalBefore: 'Rhaetian',
    intervalAfter: 'Hettangian',
  },
  {
    id: 'cretaceous-paleogene',
    name: 'Cretaceous–Paleogene extinction',
    nameZh: '白垩纪末大灭绝',
    ma: 66,
    severity: 0.5,
    description:
      '希克苏鲁伯陨石撞击（Chicxulub impact）导致的全球气候崩塌，非鸟类恐龙、菊石与大量海生爬行类全部灭绝。',
    affectedTaxa: [
      'Dinosauria',
      'Pterosauria',
      'Ammonoidea',
      'Mosasauridae',
      'Plesiosauria',
    ],
    intervalBefore: 'Maastrichtian',
    intervalAfter: 'Danian',
  },
] as const

/** 按时间排序（从最古老到最年轻） */
export const EXTINCTIONS_BY_AGE = [...BIG_FIVE_EXTINCTIONS].sort(
  (a, b) => b.ma - a.ma,
)

/** 地球历史的整体时间范围（Ma） */
export const EARTH_TIMELINE = {
  earthFormation: 4600,
  present: 0,
  firstLife: 3800,
  cambrianExplosion: 538.8,
} as const
