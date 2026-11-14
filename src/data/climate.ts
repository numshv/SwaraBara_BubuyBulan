/**
 * Dummy sound-only series: El Niño (ONI), CO₂ and rain. They are national / global signals,
 * so island songs reuse them. Nothing here is real data.
 */
import { mulberry32 } from './generate'
import { MONTH_COUNT, frameMonth } from './time'

/** ONI anchor points [month index, value]: weak El Niño 2018–19, La Niña 2020–22, strong El Niño 2023. */
const ONI_ANCHORS: [number, number][] = [
  [0, -0.9], [6, 0.1], [12, 0.8], [20, 0.4], [27, -0.3], [33, -1.2], [44, -0.8], [50, -1.1],
  [58, -0.9], [63, 0.1], [71, 1.9], [80, 0.0], [86, -0.4], [95, -0.2],
]

/** Rain (mm/month) by calendar month: wet monsoon Nov–Mar, driest Aug–Sep. */
const RAIN_SEASON = [310, 280, 290, 240, 190, 140, 110, 80, 90, 160, 250, 320]

export interface RainEvent {
  /** Position within the month, 0–1. */
  offset: number
  /** Relative storm size, 0–1. */
  size: number
}

export interface ClimateSeries {
  oni: number[]
  co2: number[]
  rain: number[]
  /** Rain days per month, sorted by offset. */
  rainDays: RainEvent[][]
}

function interpolate(anchors: [number, number][], f: number): number {
  for (let i = 0; i < anchors.length - 1; i++) {
    const [f0, v0] = anchors[i]
    const [f1, v1] = anchors[i + 1]
    if (f >= f0 && f <= f1) {
      const e = (f - f0) / (f1 - f0)
      return v0 + (v1 - v0) * (0.5 - Math.cos(Math.PI * e) / 2)
    }
  }
  return anchors[anchors.length - 1][1]
}

export function generateClimate(seed = 99): ClimateSeries {
  const rand = mulberry32(seed)
  const oni: number[] = []
  const co2: number[] = []
  const rain: number[] = []
  const rainDays: RainEvent[][] = []

  for (let f = 0; f < MONTH_COUNT; f++) {
    const o = interpolate(ONI_ANCHORS, f) + (rand() - 0.5) * 0.1
    oni.push(Math.round(o * 10) / 10)

    // ~2.4 ppm/yr trend with a small seasonal cycle.
    const years = f / 12
    co2.push(Math.round((408 + 2.4 * years + 1.4 * Math.sin(((frameMonth(f) - 2) / 12) * 2 * Math.PI)) * 10) / 10)

    // El Niño dries out the dry season; La Niña makes it wetter.
    const dry = frameMonth(f) >= 5 && frameMonth(f) <= 9
    const enso = dry ? Math.max(0.35, 1 - o * 0.3) : 1 - o * 0.08
    const mm = Math.round(RAIN_SEASON[frameMonth(f)] * enso * (0.85 + rand() * 0.3))
    rain.push(mm)

    const days = Math.min(28, Math.max(1, Math.round(mm / 12)))
    const events: RainEvent[] = []
    for (let d = 0; d < days; d++) events.push({ offset: rand(), size: 0.3 + rand() * 0.7 })
    rainDays.push(events.sort((a, b) => a.offset - b.offset))
  }
  return { oni, co2, rain, rainDays }
}

let cache: ClimateSeries | null = null
export function getClimate(): ClimateSeries {
  cache ??= generateClimate()
  return cache
}

