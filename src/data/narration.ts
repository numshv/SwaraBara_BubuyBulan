import narrationData from './narration.json'
import type { SongId } from './regions'

export type ArtKind = 'horizon' | 'flames' | 'haze' | 'rain' | 'sun' | 'peat' | 'savannah' | 'embers'

export interface Cue {
  /** Month index (0 = January 2018) at which this chapter starts. */
  frame: number
  title: string
  text: string
  art: ArtKind
  alt: string
}

interface RawCue {
  frame: number
  title: string
  text: string
  art: ArtKind
}

const ALT: Record<ArtKind, string> = {
  horizon: 'Line drawing of a forest horizon under a low sun, with thin smoke rising.',
  flames: 'Line drawing of flames spreading through a row of trees.',
  haze: 'Line drawing of a city skyline fading into thick grey haze.',
  rain: 'Line drawing of rain falling over a calm, green forest.',
  sun: 'Line drawing of a large, harsh sun over cracked, dry ground.',
  peat: 'Cross-section drawing of peat soil with fire smouldering underground.',
  savannah: 'Line drawing of open grassland with scattered small fires.',
  embers: 'Line drawing of fading embers glowing on dark ground.',
}

function withAlt(raw: RawCue): Cue {
  return { ...raw, alt: ALT[raw.art] }
}

const rawRegions = narrationData.regions as Record<SongId, RawCue[]>

export const CUES: Record<SongId, Cue[]> = Object.fromEntries(
  (Object.keys(rawRegions) as SongId[]).map((id) => [id, rawRegions[id].map(withAlt)]),
) as Record<SongId, Cue[]>

/** Index of the chapter active at playhead t. */
export function cueIndexAt(cues: Cue[], t: number): number {
  let idx = 0
  for (let i = 0; i < cues.length; i++) if (cues[i].frame <= Math.floor(t)) idx = i
  return idx
}

export const INTRO_TEXT: string = narrationData.intro
