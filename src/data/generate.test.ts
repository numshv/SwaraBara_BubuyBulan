import { describe, expect, it } from 'vitest'
import fires from './real/fires.json'
import { DETECTIONS_PER_DOT, buildSongs, cumulativeAt, type FireSource } from './generate'
import { provinces } from './geo'
import { REGIONS } from './regions'
import { MONTH_COUNT, frameYear } from './time'

const src = fires as unknown as FireSource
const songs = buildSongs(src, provinces.map((p) => p.properties.region))
const national = songs.indonesia

describe('real VIIRS fire songs', () => {
  it('covers 96 months for every song', () => {
    for (const song of Object.values(songs)) expect(song.frames).toHaveLength(MONTH_COUNT)
  })

  it('keeps every one of the ~1.1M VIIRS detections in the counts', () => {
    expect(national.totalDetections).toBeGreaterThan(1_100_000)
    expect(src.perDot).toBe(DETECTIONS_PER_DOT)
  })

  it('national detections equal the sum of the regions', () => {
    for (const f of [0, 20, 67, 95]) {
      const sum = REGIONS.reduce((s, r) => s + songs[r.id].frames[f].detections, 0)
      expect(national.frames[f].detections).toBe(sum)
    }
  })

  it('draws about one dot per DETECTIONS_PER_DOT detections', () => {
    const dots = national.frames.reduce((s, f) => s + f.dots.length, 0)
    expect(dots).toBeCloseTo(national.totalDetections / DETECTIONS_PER_DOT, -2)
  })

  it('island songs only contain their own dots', () => {
    for (const r of REGIONS) {
      for (const d of songs[r.id].frames[20].dots) expect(d.region).toBe(r.id)
    }
  })

  it('peaks in the 2019 and 2023 El Niño years and dips in 2020–2022', () => {
    const y = national.yearDetections
    expect(y[2019]).toBeGreaterThan(y[2018] * 2)
    expect(y[2023]).toBeGreaterThan(y[2018])
    for (const quiet of [2020, 2021, 2022]) expect(y[quiet]).toBeLessThan(y[2018] / 2)
  })

  it('accumulates island counters to the national total', () => {
    const islandSum = REGIONS.reduce((s, r) => s + songs[r.id].cumulativeHectares[MONTH_COUNT], 0)
    expect(islandSum).toBeCloseTo(national.cumulativeHectares[MONTH_COUNT], -1)
  })

  it('dots carry the real VIIRS columns, sorted within the month', () => {
    const frame = national.frames[20]
    const d = frame.dots[0]
    expect(d.acq_date.startsWith(String(frameYear(20)))).toBe(true)
    expect(d.bright_ti4).toBeGreaterThan(200)
    expect(d.bright_ti5).toBeGreaterThan(200)
    expect(d.frp).toBeGreaterThan(0)
    expect(d.province).toBeTruthy()
    for (let i = 1; i < frame.dots.length; i++) expect(frame.dots[i].offset).toBeGreaterThanOrEqual(frame.dots[i - 1].offset)
    for (const dd of frame.dots) expect(dd.frp).toBeLessThanOrEqual(frame.peakFrp)
  })
})

describe('cumulativeAt', () => {
  const values = [0, 10, 30, 60]
  it('interpolates within a month', () => {
    expect(cumulativeAt(values, 1.5)).toBe(20)
  })
  it('clamps outside the timeline', () => {
    expect(cumulativeAt(values, -1)).toBe(0)
  })
})
