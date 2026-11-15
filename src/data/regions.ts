export type RegionId = 'sumatra' | 'kalimantan' | 'java' | 'sulawesi' | 'bnt' | 'maluku' | 'papua'
export type SongId = 'indonesia' | RegionId

export interface Cluster {
  lon: number
  lat: number
  /** Standard deviation in degrees. */
  spread: number
  weight: number
}

export interface Region {
  id: RegionId
  name: string
  /** Shortcut key that opens this region. */
  key: string
  /** Map label anchor [lon, lat]. */
  label: [number, number]
  /** Detections in a peak dry-season month of an average year. */
  scale: number
  /** Relative fire activity per calendar month (Jan–Dec). */
  season: number[]
  /** Per-year multiplier on top of the national El Niño / La Niña pattern. */
  yearBoost?: Partial<Record<number, number>>
  clusters: Cluster[]
  blurb: string
}

const DRY = [0.15, 0.2, 0.2, 0.15, 0.2, 0.3, 0.55, 1, 1.4, 1, 0.4, 0.15]

export const REGIONS: Region[] = [
  {
    id: 'sumatra',
    name: 'Sumatra',
    key: '1',
    label: [97.6, 3.6],
    scale: 3200,
    season: [0.3, 0.55, 0.5, 0.25, 0.25, 0.4, 0.7, 1, 1.4, 0.9, 0.3, 0.15],
    yearBoost: { 2023: 0.9 },
    clusters: [
      { lon: 101.5, lat: 1.0, spread: 0.45, weight: 4 },
      { lon: 102.1, lat: 1.3, spread: 0.25, weight: 2 },
      { lon: 103.7, lat: -1.5, spread: 0.4, weight: 3 },
      { lon: 105.3, lat: -3.3, spread: 0.35, weight: 4 },
      { lon: 104.2, lat: -2.7, spread: 0.4, weight: 2 },
      { lon: 105.2, lat: -4.7, spread: 0.3, weight: 1 },
      { lon: 99.4, lat: 2.2, spread: 0.4, weight: 0.7 },
      { lon: 96.6, lat: 4.3, spread: 0.35, weight: 0.5 },
      { lon: 100.7, lat: -0.8, spread: 0.3, weight: 0.4 },
      { lon: 106.1, lat: -2.3, spread: 0.25, weight: 0.6 },
      { lon: 102.4, lat: -3.7, spread: 0.25, weight: 0.3 },
    ],
    blurb:
      'Drained peat swamps in Riau, Jambi and South Sumatra make this island one of the most fire-prone places in Southeast Asia.',
  },
  {
    id: 'kalimantan',
    name: 'Kalimantan',
    key: '2',
    label: [113.6, 0.8],
    scale: 3800,
    season: DRY,
    yearBoost: { 2019: 1.25, 2023: 1.1 },
    clusters: [
      { lon: 114.1, lat: -2.6, spread: 0.45, weight: 5 },
      { lon: 113.9, lat: -2.1, spread: 0.3, weight: 2 },
      { lon: 112.5, lat: -2.3, spread: 0.45, weight: 3 },
      { lon: 110.4, lat: -1.6, spread: 0.45, weight: 3 },
      { lon: 109.7, lat: -0.2, spread: 0.35, weight: 2 },
      { lon: 115.2, lat: -2.8, spread: 0.3, weight: 2 },
      { lon: 116.6, lat: 0.2, spread: 0.5, weight: 1.5 },
      { lon: 116.6, lat: 2.4, spread: 0.4, weight: 0.5 },
    ],
    blurb:
      'Central and West Kalimantan hold vast peatlands, cleared and drained for plantations, that smoulder for weeks once they ignite.',
  },
  {
    id: 'java',
    name: 'Java',
    key: '3',
    label: [109.6, -5.6],
    scale: 350,
    season: DRY,
    clusters: [
      { lon: 112.6, lat: -7.9, spread: 0.3, weight: 1 },
      { lon: 110.5, lat: -7.2, spread: 0.3, weight: 0.7 },
      { lon: 107.6, lat: -7.1, spread: 0.3, weight: 0.5 },
    ],
    blurb:
      "Indonesia's most crowded island burns less, but its teak forests, savannah slopes and volcano flanks still catch fire every dry season.",
  },
  {
    id: 'sulawesi',
    name: 'Sulawesi',
    key: '4',
    label: [120.4, 2.2],
    scale: 600,
    season: DRY,
    clusters: [
      { lon: 120.0, lat: -4.0, spread: 0.35, weight: 1.5 },
      { lon: 122.1, lat: -4.0, spread: 0.3, weight: 1 },
      { lon: 120.9, lat: -1.4, spread: 0.45, weight: 1 },
      { lon: 122.5, lat: 0.7, spread: 0.2, weight: 0.4 },
      { lon: 124.5, lat: 0.9, spread: 0.2, weight: 0.3 },
    ],
    blurb: 'Farm burning and grassland fires flicker across the arms of Sulawesi, peaking late in the dry season.',
  },
  {
    id: 'bnt',
    name: 'Bali & Nusa Tenggara',
    key: '5',
    label: [119.2, -10.9],
    scale: 900,
    season: [0.05, 0.05, 0.1, 0.2, 0.4, 0.6, 0.9, 1.2, 1.3, 1, 0.4, 0.1],
    clusters: [
      { lon: 119.9, lat: -9.7, spread: 0.25, weight: 1.5 },
      { lon: 124.2, lat: -9.8, spread: 0.3, weight: 1.5 },
      { lon: 121.3, lat: -8.6, spread: 0.3, weight: 1 },
      { lon: 117.7, lat: -8.7, spread: 0.3, weight: 1 },
      { lon: 115.1, lat: -8.35, spread: 0.12, weight: 0.2 },
    ],
    blurb:
      'On the dry savannah islands of Sumba, Timor and Flores, grassland is burned for grazing and farming nearly every year.',
  },
  {
    id: 'maluku',
    name: 'Maluku',
    key: '6',
    label: [129.4, -0.6],
    scale: 250,
    season: DRY,
    clusters: [
      { lon: 128.0, lat: 1.2, spread: 0.3, weight: 1 },
      { lon: 129.5, lat: -3.1, spread: 0.3, weight: 1 },
      { lon: 126.6, lat: -3.4, spread: 0.2, weight: 0.8 },
      { lon: 134.4, lat: -6.2, spread: 0.2, weight: 0.6 },
    ],
    blurb: 'The Spice Islands see small, scattered fires, mostly land clearing on Seram, Buru and Halmahera.',
  },
  {
    id: 'papua',
    name: 'Papua',
    key: '7',
    label: [138.6, -1.4],
    scale: 900,
    season: [0.1, 0.1, 0.1, 0.1, 0.15, 0.2, 0.3, 0.6, 1, 1.4, 1.1, 0.3],
    yearBoost: { 2023: 1.5 },
    clusters: [
      { lon: 140.5, lat: -8.0, spread: 0.45, weight: 5 },
      { lon: 140.3, lat: -6.5, spread: 0.45, weight: 2 },
      { lon: 139.3, lat: -7.0, spread: 0.4, weight: 1.5 },
      { lon: 136.8, lat: -4.6, spread: 0.3, weight: 0.6 },
      { lon: 133.5, lat: -2.3, spread: 0.4, weight: 0.6 },
      { lon: 140.4, lat: -2.9, spread: 0.25, weight: 0.4 },
    ],
    blurb: 'The southern lowlands around Merauke burn late in the year, as savannah and expanding plantations dry out.',
  },
]

export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<RegionId, Region>

export function songName(song: SongId): string {
  return song === 'indonesia' ? 'Indonesia' : REGION_BY_ID[song].name
}

export function songTitle(song: SongId): string {
  return song === 'indonesia'
    ? "Swara Bara — listening to Indonesia's wildfires, 2018–2025"
    : `How wildfires in ${songName(song)} changed from 2018 to 2025`
}
