import { geoBounds, geoContains } from 'd3-geo'
import type { Feature, FeatureCollection, MultiPolygon } from 'geojson'
import indonesiaJson from './geo/indonesia.json'
import neighboursJson from './geo/neighbours.json'
import type { RegionId } from './regions'

export type ProvinceFeature = Feature<MultiPolygon, { name: string; region: RegionId }>
export type LandFeature = Feature<MultiPolygon, { name: string }>

export const provinces = (indonesiaJson as FeatureCollection<MultiPolygon, { name: string; region: RegionId }>)
  .features as ProvinceFeature[]
export const neighbours = (neighboursJson as FeatureCollection<MultiPolygon, { name: string }>)
  .features as LandFeature[]

export function regionCollection(region: RegionId | 'indonesia'): FeatureCollection<MultiPolygon> {
  return {
    type: 'FeatureCollection',
    features: region === 'indonesia' ? provinces : provinces.filter((p) => p.properties.region === region),
  }
}

const boxes = provinces.map((p) => geoBounds(p))

/** Province containing the point, or null if it falls in the sea. Bounding boxes keep this cheap. */
export function provinceAt(lon: number, lat: number, region?: RegionId): ProvinceFeature | null {
  for (let i = 0; i < provinces.length; i++) {
    const p = provinces[i]
    if (region && p.properties.region !== region) continue
    const [[x0, y0], [x1, y1]] = boxes[i]
    if (lon < x0 || lon > x1 || lat < y0 || lat > y1) continue
    if (geoContains(p, [lon, lat])) return p
  }
  return null
}
