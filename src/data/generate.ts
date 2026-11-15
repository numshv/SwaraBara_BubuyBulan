/**
 * Real NASA FIRMS VIIRS (NOAA-20, 375 m) fire detections for Indonesia, 2018–2025.
 * scripts/build-data.mjs assigns every detection to a province, counts them per month, and keeps
 * an unbiased random sample of one detection per DETECTIONS_PER_DOT as the drawn dots.
 */
import { provinces } from './geo'
import { REGIONS, type RegionId, type SongId } from './regions'
import { MONTH_COUNT, daysInMonth, frameMonth, frameYear } from './time'

/** One drawn dot stands for this many VIIRS detections. */
export const DETECTIONS_PER_DOT = 60

/**
 * Approximate yearly burned area and acute respiratory infection cases. They are not part of the
 * satellite datasets, so they are spread across months and regions by each one's share of real detections.
 */
const HECTARES_PER_YEAR: Record<number, number> = {
  2018: 530_000, 2019: 1_650_000, 2020: 300_000, 2021: 360_000,
  2022: 205_000, 2023: 1_160_000, 2024: 120_000, 2025: 75_000,
}
const ARI_PER_YEAR: Record<number, number> = {
  2018: 260_000, 2019: 920_000, 2020: 90_000, 2021: 100_000,
  2022: 70_000, 2023: 480_000, 2024: 120_000, 2025: 60_000,
}

/** A drawn fire dot: one real VIIRS detection standing in for DETECTIONS_PER_DOT. */
export interface FireDot {
  latitude: number
  longitude: number
  /** I-4 channel brightness temperature (K); plays the Peking note. */
  bright_ti4: number
  /** I-5 channel brightness temperature (K); plays the Panerus note. */
  bright_ti5: number
  /** Fire radiative power (MW); drives volume and dot size. */
  frp: number
  acq_date: string
  acq_time: string
  daynight: 'D' | 'N'
  region: RegionId
  province: string
  /** Position within its month, 0–1, used to stagger appearance. */
  offset: number
  /** 0–1 colour intensity derived from brightness and FRP. */
  intensity: number
}

export interface FrameData {
  frame: number
  /** VIIRS detections this month ("fire spots"). */
  detections: number
  hectares: number
  ari: number
  peakFrp: number
  topProvince: string | null
  dots: FireDot[]
}

export interface SongData {
  id: SongId
  frames: FrameData[]
  /** cumulative[i] = totals over frames 0..i-1 (length MONTH_COUNT + 1). */
  cumulativeHectares: number[]
  cumulativeAri: number[]
  totalDetections: number
  yearDetections: Record<number, number>
}

/** Shape of src/data/real/fires.json. */
export interface FireSource {
  perDot: number
  /** frame, longitude, latitude, bright_ti4, bright_ti5, frp, day, acq_time, daytime, province */
  dots: number[][]
  provinces: string[]
  regions: Record<RegionId, { detections: number[]; peakFrp: number[]; provinces: Record<string, number>[] }>
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** bright_ti4 saturates near 367 K; very high FRP marks the fiercest fires. */
export function fireIntensity(ti4: number, frp: number): number {
  const heat = Math.min(1, Math.max(0, (ti4 - 300) / 67))
  return Math.min(1, heat * 0.8 + Math.min(1, frp / 150) * 0.2)
}

function toDot(row: number[], src: FireSource, regionOf: RegionId[]): FireDot {
  const [f, lon, lat, ti4, ti5, frp, day, time, daytime, p] = row
  const days = daysInMonth(f)
  const mm = String(frameMonth(f) + 1).padStart(2, '0')
  const hhmm = String(time).padStart(4, '0')
  return {
    latitude: lat,
    longitude: lon,
    bright_ti4: ti4,
    bright_ti5: ti5,
    frp,
    acq_date: `${frameYear(f)}-${mm}-${String(day).padStart(2, '0')}`,
    acq_time: hhmm,
    daynight: daytime ? 'D' : 'N',
    region: regionOf[p],
    province: src.provinces[p],
    offset: Math.min(0.999, (day - 1 + (Number(hhmm.slice(0, 2)) + Number(hhmm.slice(2)) / 60) / 24) / days),
    intensity: fireIntensity(ti4, frp),
  }
}

function cumulative(values: number[]): number[] {
  const out = [0]
  for (const v of values) out.push(out[out.length - 1] + v)
  return out
}

export function buildSongs(src: FireSource, provinceRegions: RegionId[]): Record<SongId, SongData> {
  // Dots per region per month.
  const byRegion = Object.fromEntries(
    REGIONS.map((r) => [r.id, Array.from({ length: MONTH_COUNT }, () => [] as FireDot[])]),
  ) as Record<RegionId, FireDot[][]>
  for (const row of src.dots) {
    const d = toDot(row, src, provinceRegions)
    byRegion[d.region][row[0]].push(d)
  }

  const nationalByYear: Record<number, number> = {}
  for (let f = 0; f < MONTH_COUNT; f++) {
    const total = REGIONS.reduce((s, r) => s + src.regions[r.id].detections[f], 0)
    nationalByYear[frameYear(f)] = (nationalByYear[frameYear(f)] ?? 0) + total
  }

  const build = (id: SongId): SongData => {
    const regions = id === 'indonesia' ? REGIONS.map((r) => r.id) : [id]
    const frames: FrameData[] = []
    const yearDetections: Record<number, number> = {}
    for (let f = 0; f < MONTH_COUNT; f++) {
      const year = frameYear(f)
      let detections = 0
      let peakFrp = 0
      const dots: FireDot[] = []
      const byProvince = new Map<string, number>()
      for (const r of regions) {
        const s = src.regions[r]
        detections += s.detections[f]
        peakFrp = Math.max(peakFrp, s.peakFrp[f])
        dots.push(...byRegion[r][f])
        for (const [p, n] of Object.entries(s.provinces[f])) {
          const name = src.provinces[Number(p)]
          byProvince.set(name, (byProvince.get(name) ?? 0) + n)
        }
      }
      dots.sort((a, b) => a.offset - b.offset)
      yearDetections[year] = (yearDetections[year] ?? 0) + detections
      const share = nationalByYear[year] ? detections / nationalByYear[year] : 0
      frames.push({
        frame: f,
        detections,
        hectares: HECTARES_PER_YEAR[year] * share,
        ari: ARI_PER_YEAR[year] * share,
        peakFrp,
        topProvince: [...byProvince.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
        dots,
      })
    }
    return {
      id,
      frames,
      cumulativeHectares: cumulative(frames.map((fr) => fr.hectares)),
      cumulativeAri: cumulative(frames.map((fr) => fr.ari)),
      totalDetections: frames.reduce((s, fr) => s + fr.detections, 0),
      yearDetections,
    }
  }

  const songs = { indonesia: build('indonesia') } as Record<SongId, SongData>
  for (const r of REGIONS) songs[r.id] = build(r.id)
  return songs
}

let cache: Promise<Record<SongId, SongData>> | null = null
/** The fire file is ~1 MB, so it loads as its own chunk after the page paints. */
export function loadSongs(): Promise<Record<SongId, SongData>> {
  cache ??= import('./real/fires.json').then((fires) =>
    buildSongs(fires.default as unknown as FireSource, provinces.map((p) => p.properties.region)),
  )
  return cache
}

/** Totals accumulated up to a fractional playhead position. */
export function cumulativeAt(values: number[], t: number): number {
  const clamped = Math.min(Math.max(t, 0), MONTH_COUNT)
  const i = Math.floor(clamped)
  if (i >= MONTH_COUNT) return values[MONTH_COUNT]
  return values[i] + (values[i + 1] - values[i]) * (clamped - i)
}
