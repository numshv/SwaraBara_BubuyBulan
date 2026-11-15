import type { LayerId, Layers } from '../components/SoundLayers'
import type { SongId } from '../data/regions'
import { MONTH_COUNT } from '../data/time'

export type StemId = 'peking' | 'panerus' | 'bonang' | 'jenglong' | 'rebab' | 'gong'

export const STEMS: readonly StemId[] = ['peking', 'panerus', 'bonang', 'jenglong', 'rebab', 'gong']

export interface SoundSlice {
  id: string
  startFrame: number
  endFrame: number
  /** Duration of the sliced audio in seconds at 1x speed (refined from AudioBuffer once decoded). */
  defaultDurationSec: number
}

const ISLAND_SLICES: SoundSlice[] = [
  { id: '2018-2020', startFrame: 0, endFrame: 36, defaultDurationSec: 54.394 },
  { id: '2021-2023', startFrame: 36, endFrame: 72, defaultDurationSec: 54.35 },
  { id: '2024-2025', startFrame: 72, endFrame: MONTH_COUNT, defaultDurationSec: 36.52 },
]

const INDONESIA_SLICES: SoundSlice[] = [
  { id: '2018', startFrame: 0, endFrame: 12, defaultDurationSec: 18.575 },
  { id: '2019', startFrame: 12, endFrame: 24, defaultDurationSec: 23.18 },
  { id: '2020-2022', startFrame: 24, endFrame: 60, defaultDurationSec: 59.0 },
  { id: '2023', startFrame: 60, endFrame: 72, defaultDurationSec: 23.18 },
  { id: '2024', startFrame: 72, endFrame: 84, defaultDurationSec: 23.23 },
  { id: '2025', startFrame: 84, endFrame: MONTH_COUNT, defaultDurationSec: 23.18 },
]

export const SONG_SLICES: Record<SongId, SoundSlice[]> = {
  indonesia: INDONESIA_SLICES,
  sumatra: ISLAND_SLICES,
  kalimantan: ISLAND_SLICES,
  java: ISLAND_SLICES,
  sulawesi: ISLAND_SLICES,
  bnt: ISLAND_SLICES,
  maluku: ISLAND_SLICES,
  papua: ISLAND_SLICES,
}

const REGIONS_WITH_STEMS = new Set<SongId>(['indonesia', 'sumatra', 'java', 'sulawesi', 'bnt', 'maluku', 'papua'])
const REGIONS_WITH_NARRATION_AUDIO = new Set<SongId>([
  'indonesia',
  'sumatra',
  'java',
  'kalimantan',
  'sulawesi',
  'bnt',
  'maluku',
  'papua',
])

const SONG_NARRATION_COUNT: Record<SongId, number> = {
  indonesia: 7,
  sumatra: 3,
  kalimantan: 3,
  java: 3,
  sulawesi: 3,
  bnt: 3,
  maluku: 3,
  papua: 3,
}

export function hasStemAudio(song: SongId): boolean {
  return REGIONS_WITH_STEMS.has(song)
}

export function hasNarrationAudio(song: SongId): boolean {
  return REGIONS_WITH_NARRATION_AUDIO.has(song)
}

export function narrationUrl(song: SongId, cueIndex: number): string | null {
  if (!hasNarrationAudio(song)) return null
  if (cueIndex < 0 || cueIndex >= SONG_NARRATION_COUNT[song]) return null
  return `/audio/narration/${song}_${cueIndex + 1}.mp3`
}

export function stemUrls(song: SongId, sliceId: string): Record<StemId, string> | null {
  if (!hasStemAudio(song)) return null
  return {
    peking: `/audio/stems/${song}/${sliceId}/peking.mp3`,
    panerus: `/audio/stems/${song}/${sliceId}/panerus.mp3`,
    bonang: `/audio/stems/${song}/${sliceId}/bonang.mp3`,
    jenglong: `/audio/stems/${song}/${sliceId}/jenglong.mp3`,
    rebab: `/audio/stems/${song}/${sliceId}/rebab.mp3`,
    gong: `/audio/stems/${song}/${sliceId}/gong.mp3`,
  }
}

export function sliceIndexAt(song: SongId, t: number): number {
  const slices = SONG_SLICES[song]
  for (let i = slices.length - 1; i >= 0; i--) {
    if (t >= slices[i].startFrame) return i
  }
  return 0
}

/** Map active layer toggles to per-instrument gain (0 or 1). Goong always marks the 1-year interval. */
export function stemGains(layers: Layers): Record<StemId, number> {
  return {
    peking: layers.wildfire ? 1 : 0,
    panerus: layers.wildfire ? 1 : 0,
    bonang: layers.aerosol ? 1 : 0,
    jenglong: layers.elnino && layers.iod ? 1 : 0,
    rebab: layers.co ? 1 : 0,
    gong: 1,
  }
}

/** Toggling either El Niño or IOD toggles both, since both map to the shared Jenglong stem. */
export function toggleLinkedLayers(layers: Layers, id: LayerId): Layers {
  const next = !layers[id]
  if (id === 'elnino' || id === 'iod') {
    return { ...layers, elnino: next, iod: next }
  }
  return { ...layers, [id]: next }
}

