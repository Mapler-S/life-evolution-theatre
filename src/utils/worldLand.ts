import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry } from 'geojson'
import type { Topology, GeometryCollection } from 'topojson-specification'
// 110m 分辨率土地轮廓（~100KB），足以做宏观古生物分布底图
import land110m from 'world-atlas/land-110m.json'

/** 预计算的 GeoJSON 土地集合，组件直接使用。 */
export const LAND_FEATURES: FeatureCollection<Geometry> = feature(
  land110m as unknown as Topology,
  (land110m as unknown as Topology).objects.land as GeometryCollection,
) as FeatureCollection<Geometry>
