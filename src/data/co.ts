/**
 * Real MERRA-2 carbon monoxide (ppb), monthly means (src/data/real/co.json). The source has
 * Indonesia-wide, Sumatra, Kalimantan and Papua series; Java, Sulawesi, Bali & Nusa Tenggara and
 * Maluku use the Indonesia-wide value. CO lives longer than smoke, so it is painted wider on the map.
 */
import coJson from './real/co.json'
import { paintRegions, regionMasks } from './aerosol'
import { REGIONS, type RegionId, type SongId } from './regions'

export interface CoField {
  /** One NX × NY grid of ppb per month. */
  frames: Float32Array[]
  /** CO (ppb) per song and month: the Rebab's volume. */
  values: Record<SongId, number[]>
  /** Song ids that fall back to the Indonesia-wide series. */
  fallback: Set<SongId>
}

const SOURCE = coJson.regions as Partial<Record<SongId, number[]>> & { indonesia: number[] }

export function buildCo(source = SOURCE): CoField {
  const values = { indonesia: source.indonesia } as Record<SongId, number[]>
  const fallback = new Set<SongId>()
  for (const r of REGIONS) {
    const own = source[r.id]
    if (own) values[r.id] = own
    else {
      values[r.id] = source.indonesia
      fallback.add(r.id)
    }
  }
  const floor = Math.min(...Object.values(values).flat())
  const frames = paintRegions(regionMasks(1.6), values as Record<RegionId, number[]>, () => floor)
  return { frames, values, fallback }
}

let cache: CoField | null = null
export function getCo(): CoField {
  cache ??= buildCo()
  return cache
}

/** CO at a fractional playhead position, blending neighbouring months. */
export function coBlend(field: CoField, t: number, k: number): number {
  const last = field.frames.length - 1
  const i = Math.min(Math.max(Math.floor(t), 0), last)
  const j = Math.min(i + 1, last)
  const e = Math.min(1, Math.max(0, t - Math.floor(t)))
  return field.frames[i][k] * (1 - e) + field.frames[j][k] * e
}
