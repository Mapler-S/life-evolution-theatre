import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  AIProvider,
  ExtinctionEvent,
  GeoInterval,
  HoveredItem,
  TaxonNode,
  TimeRange,
  ViewMode,
} from '../types'

/**
 * 全局探索状态
 *
 * 设计原则：
 * - 视图组件通过选择器订阅最小必要字段，避免无关重渲染
 * - 仅 AI 凭证（apiKey / provider）与用户偏好（viewMode）持久化到 localStorage
 * - 瞬时交互状态（hoveredItem、selectedTaxon 等）保留在内存
 */

interface ExploreState {
  // —— 数据选择 ——
  currentInterval: GeoInterval | null
  selectedTaxon: TaxonNode | null
  selectedExtinction: ExtinctionEvent | null
  hoveredItem: HoveredItem | null

  // —— 时间范围（Ma，倒序：[older, younger]） ——
  timeRange: TimeRange

  // —— 模式 ——
  viewMode: ViewMode

  // —— AI 绘图配置 ——
  aiApiKey: string
  aiProvider: AIProvider

  // —— Setters ——
  setCurrentInterval: (interval: GeoInterval | null) => void
  setSelectedTaxon: (taxon: TaxonNode | null) => void
  setSelectedExtinction: (event: ExtinctionEvent | null) => void
  setHoveredItem: (item: HoveredItem | null) => void
  setTimeRange: (range: TimeRange) => void
  setViewMode: (mode: ViewMode) => void
  setAiApiKey: (key: string) => void
  setAiProvider: (provider: AIProvider) => void
  resetSelection: () => void
}

const DEFAULT_TIME_RANGE: TimeRange = [4600, 0]

export const useExploreStore = create<ExploreState>()(
  persist(
    (set) => ({
      currentInterval: null,
      selectedTaxon: null,
      selectedExtinction: null,
      hoveredItem: null,
      timeRange: DEFAULT_TIME_RANGE,
      viewMode: 'explore',
      aiApiKey: '',
      aiProvider: 'stability',

      setCurrentInterval: (interval) => set({ currentInterval: interval }),
      setSelectedTaxon: (taxon) => set({ selectedTaxon: taxon }),
      setSelectedExtinction: (event) => set({ selectedExtinction: event }),
      setHoveredItem: (item) => set({ hoveredItem: item }),
      setTimeRange: (range) => set({ timeRange: range }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setAiApiKey: (key) => set({ aiApiKey: key }),
      setAiProvider: (provider) => set({ aiProvider: provider }),
      resetSelection: () =>
        set({
          currentInterval: null,
          selectedTaxon: null,
          selectedExtinction: null,
          hoveredItem: null,
        }),
    }),
    {
      name: 'life-evolution-theatre/explore',
      storage: createJSONStorage(() => localStorage),
      // 仅持久化用户设置，不持久化瞬时交互状态
      partialize: (state) => ({
        viewMode: state.viewMode,
        aiApiKey: state.aiApiKey,
        aiProvider: state.aiProvider,
      }),
    },
  ),
)

// ============================================================
// 预制选择器（避免组件内重复定义，减少重渲染）
// ============================================================

export const selectCurrentInterval = (s: ExploreState) => s.currentInterval
export const selectSelectedTaxon = (s: ExploreState) => s.selectedTaxon
export const selectSelectedExtinction = (s: ExploreState) =>
  s.selectedExtinction
export const selectHoveredItem = (s: ExploreState) => s.hoveredItem
export const selectTimeRange = (s: ExploreState) => s.timeRange
export const selectViewMode = (s: ExploreState) => s.viewMode
export const selectAiConfig = (s: ExploreState) => ({
  apiKey: s.aiApiKey,
  provider: s.aiProvider,
})
