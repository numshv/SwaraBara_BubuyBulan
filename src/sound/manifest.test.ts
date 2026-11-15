import { describe, expect, it } from 'vitest'
import { CUES } from '../data/narration'
import type { SongId } from '../data/regions'
import {
  SONG_SLICES,
  hasNarrationAudio,
  hasStemAudio,
  narrationUrl,
  sliceIndexAt,
  stemGains,
  stemUrls,
  toggleLinkedLayers,
} from './manifest'

describe('sound manifest and layer mapping', () => {
  it('aligns every cue frame in narration with SONG_SLICES', () => {
    for (const song of Object.keys(SONG_SLICES) as SongId[]) {
      const cues = CUES[song]
      const slices = SONG_SLICES[song]
      if (song === 'indonesia') {
        // 7 narrations sandwiching 6 sound slices (0, 12, 24, 60, 72, 84, plus closing narration at 96)
        expect(cues).toHaveLength(slices.length + 1)
        slices.forEach((slice, i) => {
          expect(cues[i].frame).toBe(slice.startFrame)
        })
        expect(cues[cues.length - 1].frame).toBe(slices[slices.length - 1].endFrame)
      } else {
        expect(cues).toHaveLength(slices.length)
        cues.forEach((cue, i) => {
          expect(cue.frame).toBe(slices[i].startFrame)
        })
      }
    }
  })

  it('links El Niño and IOD toggles to the shared Jenglong stem', () => {
    const base = { wildfire: true, aerosol: true, elnino: true, iod: true, co: true }
    const afterElNinoOff = toggleLinkedLayers(base, 'elnino')
    expect(afterElNinoOff.elnino).toBe(false)
    expect(afterElNinoOff.iod).toBe(false)

    const afterIodOn = toggleLinkedLayers(afterElNinoOff, 'iod')
    expect(afterIodOn.elnino).toBe(true)
    expect(afterIodOn.iod).toBe(true)

    const afterFireOff = toggleLinkedLayers(base, 'wildfire')
    expect(afterFireOff.wildfire).toBe(false)
    expect(afterFireOff.elnino).toBe(true)
  })

  it('maps layer mutes to the 6 instrument stems', () => {
    expect(stemGains({ wildfire: false, aerosol: true, elnino: true, iod: true, co: true })).toEqual({
      peking: 0,
      panerus: 0,
      bonang: 1,
      jenglong: 1,
      rebab: 1,
      gong: 1,
    })

    expect(stemGains({ wildfire: true, aerosol: false, elnino: false, iod: false, co: false })).toEqual({
      peking: 1,
      panerus: 1,
      bonang: 0,
      jenglong: 0,
      rebab: 0,
      gong: 1,
    })
  })

  it('resolves slice indices, stem URLs, and narration URLs accurately', () => {
    expect(sliceIndexAt('java', 0)).toBe(0)
    expect(sliceIndexAt('java', 35.9)).toBe(0)
    expect(sliceIndexAt('java', 36)).toBe(1)
    expect(sliceIndexAt('java', 72)).toBe(2)

    expect(hasStemAudio('java')).toBe(true)
    expect(hasStemAudio('kalimantan')).toBe(false)
    expect(stemUrls('java', '2018-2020')?.jenglong).toBe('/audio/stems/java/2018-2020/jenglong.mp3')

    expect(hasNarrationAudio('java')).toBe(true)
    expect(narrationUrl('java', 1)).toBe('/audio/narration/java_2.mp3')
    expect(hasNarrationAudio('sumatra')).toBe(true)
    expect(narrationUrl('sumatra', 2)).toBe('/audio/narration/sumatra_3.mp3')
    expect(hasNarrationAudio('indonesia')).toBe(true)
    expect(narrationUrl('indonesia', 6)).toBe('/audio/narration/indonesia_7.mp3')
    expect(narrationUrl('indonesia', 7)).toBeNull()
  })
})

