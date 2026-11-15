/**
 * Real MERRA-2 organic-carbon aerosol optical thickness (AOT), monthly means per region
 * (src/data/real/aerosol.json). The data has one value per region, so the map paints each
 * region's value over its land, softly blurred out to sea, on a 0.625° × 0.5° grid.
 */
import aerosolJson from './real/aerosol.json'
import { provinceAt } from './geo'
import { REGIONS, REGION_BY_ID, type RegionId, type SongId } from './regions'
import { MONTH_COUNT, clampFrame, frameMonth } from './time'

export const LON0 = 94
export const LAT0 = -12
export const DLON = 0.625
export const DLAT = 0.5
export const NX = Math.round((142 - LON0) / DLON) + 1
export const NY = Math.round((8 - LAT0) / DLAT) + 1

export const cellIndex = (i: number, j: number) => j * NX + i
export const cellLon = (i: number) => LON0 + i * DLON
export const cellLat = (j: number) => LAT0 + j * DLAT

/** One song's AOT series, all columns as in the source CSV. */
export interface AotSeries {
  /** Organic carbon AOT (unitless). */
  aot: number[]
  /** Normalised AOT: Bonang note. */
  norm: number[]
  /** Log-normalised AOT: Bonang note duration. */
  lognorm: number[]
  /** Normalised anomaly from the monthly climatology: Bonang volume. */
  anomalyNorm: number[]
}

export interface AerosolPeak {
  aod: number
  place: string
}

export interface AerosolField {
  /** One NX × NY grid of AOT per month, row-major from the south-west corner. */
  frames: Float32Array[]
  /** Multiplier from AOT to the smoke renderer's visual scale (its thick haze sits near 3). */
  visualScale: number
  /** Unit-ish wind vector [east, north] per month, used only for smoke drift. */
  wind: [number, number][]
  /** Per-song monthly series. */
  series: Record<SongId, AotSeries>
  /** Haziest region per song and month, for announcements. */
  peaks: Record<SongId, AerosolPeak[]>
}

const SOURCE = aerosolJson.regions as Record<SongId, AotSeries>

/**
 * Climatological low-level wind per calendar month: the SE monsoon pushes smoke NW in the dry season.
 * Only animates the drifting puffs; the haze amount itself is the data.
 */
const WIND: [number, number][] = [
  [0.9, -0.4], [0.8, -0.4], [0.5, -0.2], [0.1, 0.1], [-0.4, 0.4], [-0.8, 0.6],
  [-1, 0.7], [-1.1, 0.8], [-1.1, 0.8], [-0.9, 0.6], [-0.2, 0.2], [0.6, -0.3],
]

/** Thick haze in the smoke renderer's own units. */
const VISUAL_PEAK = 3.1

/**
 * Soft per-region weight on the grid: 1 over the region's land, fading out over `sigma` degrees.
 * Built once from the province outlines.
 */
export function regionMasks(sigma: number): Record<RegionId, Float32Array> {
  const owner = new Int8Array(NX * NY).fill(-1)
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const p = provinceAt(cellLon(i), cellLat(j))
      if (p) owner[cellIndex(i, j)] = REGIONS.findIndex((r) => r.id === p.properties.region)
    }
  }
  const ri = Math.ceil((sigma * 2.5) / DLON)
  const rj = Math.ceil((sigma * 2.5) / DLAT)
  const masks = {} as Record<RegionId, Float32Array>
  REGIONS.forEach((r, ridx) => {
    const m = new Float32Array(NX * NY)
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        if (owner[cellIndex(i, j)] === ridx) {
          m[cellIndex(i, j)] = 1
          continue
        }
        // Distance to the nearest land cell of this region, within the search window.
        let best = Infinity
        for (let jj = Math.max(0, j - rj); jj <= Math.min(NY - 1, j + rj); jj++) {
          for (let ii = Math.max(0, i - ri); ii <= Math.min(NX - 1, i + ri); ii++) {
            if (owner[cellIndex(ii, jj)] !== ridx) continue
            const dx = (ii - i) * DLON
            const dy = (jj - j) * DLAT
            best = Math.min(best, dx * dx + dy * dy)
          }
        }
        if (best < Infinity) m[cellIndex(i, j)] = Math.exp(-best / (2 * sigma * sigma))
      }
    }
    masks[r.id] = m
  })
  return masks
}

/**
 * Paints per-region monthly values onto the grid. Where regions overlap the stronger weight wins
 * proportionally; open sea fades to `floor`.
 */
export function paintRegions(
  masks: Record<RegionId, Float32Array>,
  values: Record<RegionId, number[]>,
  floor: (f: number) => number,
): Float32Array[] {
  const out: Float32Array[] = []
  for (let f = 0; f < MONTH_COUNT; f++) {
    const g = new Float32Array(NX * NY)
    const base = floor(f)
    for (let k = 0; k < g.length; k++) {
      let w = 0
      let v = 0
      for (const r of REGIONS) {
        const m = masks[r.id][k]
        if (!m) continue
        w += m
        v += m * values[r.id][f]
      }
      g[k] = w > 0 ? (v / w) * Math.min(1, w) + base * (1 - Math.min(1, w)) : base
    }
    out.push(g)
  }
  return out
}

export function buildAerosol(series: Record<SongId, AotSeries> = SOURCE): AerosolField {
  const masks = regionMasks(0.9)
  const values = Object.fromEntries(REGIONS.map((r) => [r.id, series[r.id].aot])) as Record<RegionId, number[]>
  const minAot = Math.min(...REGIONS.flatMap((r) => series[r.id].aot))
  const frames = paintRegions(masks, values, () => minAot)
  const maxAot = Math.max(...REGIONS.flatMap((r) => series[r.id].aot))

  const peaks = {} as Record<SongId, AerosolPeak[]>
  peaks.indonesia = Array.from({ length: MONTH_COUNT }, (_, f) => {
    const top = REGIONS.reduce((a, b) => (series[b.id].aot[f] > series[a.id].aot[f] ? b : a))
    return { aod: series[top.id].aot[f], place: top.name }
  })
  for (const r of REGIONS) {
    peaks[r.id] = series[r.id].aot.map((aod) => ({ aod, place: REGION_BY_ID[r.id].name }))
  }

  return {
    frames,
    visualScale: VISUAL_PEAK / maxAot,
    wind: Array.from({ length: MONTH_COUNT }, (_, f) => WIND[frameMonth(f)]),
    series,
    peaks,
  }
}

let cache: AerosolField | null = null
export function getAerosol(): AerosolField {
  cache ??= buildAerosol()
  return cache
}

/** AOT at a fractional playhead position, blending neighbouring months. */
export function aodBlend(field: Pick<AerosolField, 'frames'>, t: number, k: number): number {
  const f0 = clampFrame(t)
  const f1 = clampFrame(t + 1)
  const e = Math.min(1, Math.max(0, t - Math.floor(t)))
  return field.frames[f0][k] * (1 - e) + field.frames[f1][k] * e
}

export function windAt(field: Pick<AerosolField, 'wind'>, t: number): [number, number] {
  const a = field.wind[clampFrame(t)]
  const b = field.wind[clampFrame(t + 1)]
  const e = Math.min(1, Math.max(0, t - Math.floor(t)))
  return [a[0] * (1 - e) + b[0] * e, a[1] * (1 - e) + b[1] * e]
}

/** Organic-carbon AOT bands: ~0.02 is a clean month, the 2019 crisis peaked above 0.3. */
export const AOT_LEVELS = { light: 0.05, haze: 0.1, thick: 0.18 }

export function describeHaze(peak: AerosolPeak): string {
  const level =
    peak.aod >= AOT_LEVELS.thick ? 'Thick haze' : peak.aod >= AOT_LEVELS.haze ? 'Haze' : peak.aod >= AOT_LEVELS.light ? 'Light haze' : null
  if (!level) return 'Mostly clear skies'
  return `${level} over ${peak.place}, aerosol optical thickness ${peak.aod.toFixed(2)}`
}

