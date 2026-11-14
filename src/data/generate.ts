/**
 * Seeded dummy data shaped after NASA FIRMS VIIRS (NOAA-20) detections for Indonesia, 2018–2025.
 * Nothing here is real: magnitudes and seasonality are only meant to look plausible.
 */
import { provinceAt } from './geo'
import { REGIONS, type Region, type RegionId, type SongId } from './regions'
import { MONTH_COUNT, daysInMonth, frameMonth, frameYear } from './time'

/** One drawn dot stands for this many VIIRS detections. */
export const DETECTIONS_PER_DOT = 60

/** El Niño (2019, 2023) vs La Niña (2020–2022) years, applied nationally. */
const YEAR_FACTOR: Record<number, number> = {
  2018: 1, 2019: 2.9, 2020: 0.35, 2021: 0.45, 2022: 0.3, 2023: 2.1, 2024: 0.9, 2025: 0.6,
}
/** National yearly totals that the counters accumulate to. */
const HECTARES_PER_YEAR: Record<number, number> = {
  2018: 530_000, 2019: 1_650_000, 2020: 300_000, 2021: 360_000,
  2022: 205_000, 2023: 1_160_000, 2024: 120_000, 2025: 75_000,
}
const ARI_PER_YEAR: Record<number, number> = {
  2018: 260_000, 2019: 920_000, 2020: 90_000, 2021: 100_000,
  2022: 70_000, 2023: 480_000, 2024: 120_000, 2025: 60_000,
}

export type Confidence = 'l' | 'n' | 'h'

/** A drawn fire dot, carrying the raw FIRMS-style columns it was "aggregated" from. */
export interface FireDot {
  latitude: number
  longitude: number
  bright_ti4: number
  frp: number
  confidence: Confidence
  acq_date: string
  acq_time: string
  daynight: 'D' | 'N'
  region: RegionId
  province: string
  /** Position within its month, 0–1, used to stagger appearance. */
  offset: number
  /** 0–1 colour intensity derived from brightness and confidence. */
  intensity: number
}

export interface FrameData {
  frame: number
  /** VIIRS detections this month ("fire spots"). */
  detections: number
  hectares: number
  ari: number
  /** Carbon monoxide, ppb. */
  co: number
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

function gaussian(rand: () => number): number {
  const u = 1 - rand()
  const v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function pickCluster(region: Region, rand: () => number) {
  const total = region.clusters.reduce((s, c) => s + c.weight, 0)
  let r = rand() * total
  for (const c of region.clusters) {
    r -= c.weight
    if (r <= 0) return c
  }
  return region.clusters[region.clusters.length - 1]
}

function monthlyDetections(region: Region, frame: number, rand: () => number): number {
  const year = frameYear(frame)
  const noise = 0.8 + rand() * 0.4
  return Math.round(
    region.scale * YEAR_FACTOR[year] * (region.yearBoost?.[year] ?? 1) * region.season[frameMonth(frame)] * noise,
  )
}

function makeDot(region: Region, frame: number, heat: number, rand: () => number): FireDot | null {
  for (let attempt = 0; attempt < 6; attempt++) {
    const c = pickCluster(region, rand)
    const lon = c.lon + gaussian(rand) * c.spread
    const lat = c.lat + gaussian(rand) * c.spread
    const province = provinceAt(lon, lat, region.id)
    if (!province) continue
    // FRP is heavily right-skewed; hotter months skew it further.
    const frp = Math.min(1500, Math.max(1, Math.exp(2.3 + gaussian(rand) * 1 + heat * 0.6)))
    const bright = Math.min(367, 300 + 67 * (1 - Math.exp(-frp / 40)) * (0.7 + rand() * 0.3))
    const confidence: Confidence = bright > 350 ? 'h' : bright > 325 ? 'n' : 'l'
    const days = daysInMonth(frame)
    const day = 1 + Math.floor(rand() * days)
    const night = rand() < 0.3
    const mm = String(frameMonth(frame) + 1).padStart(2, '0')
    return {
      latitude: Math.round(lat * 1e4) / 1e4,
      longitude: Math.round(lon * 1e4) / 1e4,
      bright_ti4: Math.round(bright * 100) / 100,
      frp: Math.round(frp * 10) / 10,
      confidence,
      acq_date: `${frameYear(frame)}-${mm}-${String(day).padStart(2, '0')}`,
      acq_time: night ? '1830' : '0630',
      daynight: night ? 'N' : 'D',
      region: region.id,
      province: province.properties.name,
      offset: (day - 1) / days,
      intensity: Math.min(1, ((bright - 300) / 67) * 0.75 + (confidence === 'h' ? 0.25 : confidence === 'n' ? 0.1 : 0)),
    }
  }
  return null
}

interface RegionSeries {
  detections: number[]
  dots: FireDot[][]
}

function generateRegion(region: Region, seed: number): RegionSeries {
  const rand = mulberry32(seed)
  const detections: number[] = []
  const dots: FireDot[][] = []
  for (let f = 0; f < MONTH_COUNT; f++) {
    const count = monthlyDetections(region, f, rand)
    detections.push(count)
    const heat = Math.min(1, count / 15_000)
    const n = Math.round(count / DETECTIONS_PER_DOT + rand() * 0.6)
    const frameDots: FireDot[] = []
    for (let i = 0; i < n; i++) {
      const d = makeDot(region, f, heat, rand)
      if (d) frameDots.push(d)
    }
    dots.push(frameDots.sort((a, b) => a.offset - b.offset))
  }
  return { detections, dots }
}

function cumulative(values: number[]): number[] {
  const out = [0]
  for (const v of values) out.push(out[out.length - 1] + v)
  return out
}

function buildSong(id: SongId, series: Record<RegionId, RegionSeries>, nationalByYear: Record<number, number>, peak: number): SongData {
  const regions = id === 'indonesia' ? REGIONS.map((r) => r.id) : [id]
  const rand = mulberry32(id.length * 7919 + 17)
  const frames: FrameData[] = []
  const yearDetections: Record<number, number> = {}

  for (let f = 0; f < MONTH_COUNT; f++) {
    const year = frameYear(f)
    let detections = 0
    const dots: FireDot[] = []
    for (const r of regions) {
      detections += series[r].detections[f]
      dots.push(...series[r].dots[f])
    }
    dots.sort((a, b) => a.offset - b.offset)
    yearDetections[year] = (yearDetections[year] ?? 0) + detections

    const share = detections / nationalByYear[year]
    const level = Math.pow(detections / peak, 0.6)
    const byProvince = new Map<string, number>()
    for (const d of dots) byProvince.set(d.province, (byProvince.get(d.province) ?? 0) + 1)
    const topProvince = [...byProvince.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    frames.push({
      frame: f,
      detections,
      hectares: HECTARES_PER_YEAR[year] * share,
      ari: ARI_PER_YEAR[year] * share,
      co: Math.round(110 + 780 * level + rand() * 25),
      peakFrp: dots.reduce((m, d) => Math.max(m, d.frp), 0),
      topProvince,
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

export function generateAll(seed = 20180101): Record<SongId, SongData> {
  const series = Object.fromEntries(
    REGIONS.map((r, i) => [r.id, generateRegion(r, seed + i * 104729)]),
  ) as Record<RegionId, RegionSeries>

  const nationalByYear: Record<number, number> = {}
  let peak = 0
  for (let f = 0; f < MONTH_COUNT; f++) {
    const total = REGIONS.reduce((s, r) => s + series[r.id].detections[f], 0)
    nationalByYear[frameYear(f)] = (nationalByYear[frameYear(f)] ?? 0) + total
    peak = Math.max(peak, total)
  }

  const songs = { indonesia: buildSong('indonesia', series, nationalByYear, peak) } as Record<SongId, SongData>
  for (const r of REGIONS) songs[r.id] = buildSong(r.id, series, nationalByYear, peak)
  return songs
}

let cache: Record<SongId, SongData> | null = null
export function getSongs(): Record<SongId, SongData> {
  cache ??= generateAll()
  return cache
}

/** Totals accumulated up to a fractional playhead position. */
export function cumulativeAt(values: number[], t: number): number {
  const clamped = Math.min(Math.max(t, 0), MONTH_COUNT)
  const i = Math.floor(clamped)
  if (i >= MONTH_COUNT) return values[MONTH_COUNT]
  return values[i] + (values[i + 1] - values[i]) * (clamped - i)
}

