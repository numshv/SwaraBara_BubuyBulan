/**
 * Dummy ocean-climate series: El Niño (ONI) and the Indian Ocean Dipole (DMI). They are
 * basin-scale signals, so island songs reuse them. Nothing here is real data.
 */
import { mulberry32 } from './generate'
import { MONTH_COUNT } from './time'

/** ONI anchor points [month index, value]: weak El Niño 2018–19, La Niña 2020–22, strong El Niño 2023. */
const ONI_ANCHORS: [number, number][] = [
  [0, -0.9], [6, 0.1], [12, 0.8], [20, 0.4], [27, -0.3], [33, -1.2], [44, -0.8], [50, -1.1],
  [58, -0.9], [63, 0.1], [71, 1.9], [80, 0.0], [86, -0.4], [95, -0.2],
]

/** IOD (DMI) anchor points: strong positive late 2019, negative 2021–22, positive 2023. */
const IOD_ANCHORS: [number, number][] = [
  [0, -0.1], [9, 0.6], [14, 0.0], [21, 2.0], [26, 0.1], [36, -0.2], [43, -0.9], [50, -0.2],
  [55, -0.4], [56, -1.0], [61, -0.2], [69, 1.5], [75, 0.2], [82, -0.5], [88, 0.1], [95, 0.0],
]

export interface ClimateSeries {
  oni: number[]
  /** Indian Ocean Dipole, Dipole Mode Index. */
  iod: number[]
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
  const iod: number[] = []
  for (let f = 0; f < MONTH_COUNT; f++) {
    oni.push(Math.round((interpolate(ONI_ANCHORS, f) + (rand() - 0.5) * 0.1) * 10) / 10)
    iod.push(Math.round((interpolate(IOD_ANCHORS, f) + (rand() - 0.5) * 0.1) * 10) / 10)
  }
  return { oni, iod }
}

let cache: ClimateSeries | null = null
export function getClimate(): ClimateSeries {
  cache ??= generateClimate()
  return cache
}
