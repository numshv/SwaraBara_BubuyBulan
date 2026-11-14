import { geoMercator, geoPath, type GeoProjection } from 'd3-geo'
import { regionCollection } from '../data/geo'
import type { SongId } from '../data/regions'

/** Virtual drawing size; the SVG scales this to fit its box. */
export const VW = 1600
export const VH = 680

export const projection: GeoProjection = geoMercator().fitExtent(
  [
    [40, 40],
    [VW - 40, VH - 40],
  ],
  regionCollection('indonesia'),
)
export const path = geoPath(projection)

export interface View {
  k: number
  x: number
  y: number
}

export const IDENTITY: View = { k: 1, x: 0, y: 0 }

export function viewFor(song: SongId): View {
  if (song === 'indonesia') return IDENTITY
  const [[x0, y0], [x1, y1]] = path.bounds(regionCollection(song))
  const k = Math.min(7, 0.82 * Math.min(VW / (x1 - x0), VH / (y1 - y0)))
  return { k, x: VW / 2 - k * (x0 + x1) / 2, y: VH / 2 - k * (y0 + y1) / 2 }
}

export function lerpView(a: View, b: View, e: number): View {
  return { k: a.k + (b.k - a.k) * e, x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e }
}

/** Projected point after the zoom transform, in viewBox units. */
export function toView([lon, lat]: [number, number], v: View): [number, number] {
  const [px, py] = projection([lon, lat]) ?? [0, 0]
  return [v.x + px * v.k, v.y + py * v.k]
}

/** Where viewBox units land on a drawing surface: CSS px = o + unit × s. */
export interface Placement {
  s: number
  ox: number
  oy: number
}

/** Letterboxing used by preserveAspectRatio="xMidYMid meet". */
export function fit(width: number, height: number): Placement {
  const s = Math.min(width / VW, height / VH)
  return { s, ox: (width - VW * s) / 2, oy: (height - VH * s) / 2 }
}
