// ============================================================
// 地质年代
// ============================================================

/** PBDB intervals API 返回的单个地质时期 */
export interface GeoInterval {
  /** 唯一ID，如 "int:1" */
  oid: string
  /** 名称，如 "Cambrian"、"Permian" */
  nam: string
  /** 级别数值：宙=1，代=2，纪=3，世=4，期=5 */
  lvl: number
  /** 早期边界（百万年前） */
  eag: number
  /** 晚期边界（百万年前） */
  lag: number
  /** ICS 标准色（十六进制） */
  col?: string
  /** 父级时期ID */
  pid?: string
  /** 缩写 */
  abr?: string
}

/** 时间范围（百万年前） */
export type TimeRange = [startMa: number, endMa: number]

// ============================================================
// 物种多样性
// ============================================================

/** 多样性数据点（某时期的某统计指标） */
export interface DiversityPoint {
  /** 时期名称 */
  interval_name: string
  /** 早期边界（Ma） */
  max_ma: number
  /** 晚期边界（Ma） */
  min_ma: number
  /** 分类单元计数（属/种级） */
  sampled_in_bin: number
  /** 范围穿越此期的分类群数 */
  range_through?: number
  /** 首次出现 */
  originations?: number
  /** 最后出现（灭绝） */
  extinctions?: number
}

/** 多样性统计分辨率 */
export type DiversityResolution = 'period' | 'epoch' | 'stage' | 'age'

// ============================================================
// 分类学
// ============================================================

/** PBDB 分类群节点 */
export interface TaxonNode {
  oid: string
  /** 分类群名 */
  nam: string
  /** 级别数值（越大越高阶） */
  rnk: number
  /** 父级ID */
  par?: string
  /** 是否现存 */
  ext?: 0 | 1
  /** 该分类群下的化石出现次数 */
  noc?: number
  /** 子节点（客户端构建） */
  children?: TaxonNode[]
}

// ============================================================
// 化石产地
// ============================================================

/** 化石出现记录 */
export interface Occurrence {
  oid: string
  /** 采集点ID */
  cid?: string
  /** 鉴定名称 */
  idn?: string
  /** 标准化分类名 */
  tna?: string
  /** 经度（现代） */
  lng: number
  /** 纬度（现代） */
  lat: number
  /** 古经度（paleoloc） */
  paleolng?: number
  /** 古纬度（paleoloc） */
  paleolat?: number
  /** 门 */
  phl?: string
  /** 纲 */
  cll?: string
  /** 目 */
  odl?: string
  /** 早期时期 */
  oei?: string
  /** 晚期时期 */
  oli?: string
  /** 早期年龄（Ma） */
  eag?: number
  /** 晚期年龄（Ma） */
  lag?: number
}

// ============================================================
// 大灭绝事件
// ============================================================

export interface ExtinctionEvent {
  id: string
  /** 英文名 */
  name: string
  /** 中文名 */
  nameZh: string
  /** 发生时间（Ma） */
  ma: number
  /** 属级灭绝率 0-1 */
  severity: number
  /** 简述 */
  description: string
  /** 受影响最大的分类群 */
  affectedTaxa: string[]
  /** 灭绝前地质时期 */
  intervalBefore: string
  /** 灭绝后地质时期 */
  intervalAfter: string
}

// ============================================================
// AI 绘图
// ============================================================

export type AIProvider = 'nanobanana' | 'stability' | 'dalle' | 'replicate'

export type AIImageStyle =
  | 'scientific'
  | 'cinematic'
  | 'diorama'
  | 'diptych'

export interface AIImageResult {
  id: string
  url: string
  prompt: string
  provider: AIProvider
  style: AIImageStyle
  createdAt: number
  /** 关联的上下文 */
  tags?: string[]
}

// ============================================================
// 全局探索状态
// ============================================================

export type ViewMode = 'guided' | 'explore'

export interface HoveredItem {
  type: 'interval' | 'taxon' | 'occurrence' | 'extinction'
  id: string
  data?: unknown
}

// ============================================================
// 通用异步结果
// ============================================================

export interface AsyncResult<T> {
  data: T | null
  loading: boolean
  error: Error | null
}
