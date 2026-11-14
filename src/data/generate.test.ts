import { describe, expect, it } from 'vitest'
import { cumulativeAt, generateAll } from './generate'
import { REGIONS } from './regions'
import { MONTH_COUNT, frameYear } from './time'

const songs = generateAll()
const national = songs.indonesia

describe('generateAll', () => {
  it('covers 96 months for every song', () => {
    for (const song of Object.values(songs)) expect(song.frames).toHaveLength(MONTH_COUNT)
  })

  it('is deterministic for a seed', () => {
    const again = generateAll()
    expect(again.indonesia.totalDetections).toBe(national.totalDetections)
    expect(again.kalimantan.frames[20].dots[0]).toEqual(songs.kalimantan.frames[20].dots[0])
  })

  it('national detections equal the sum of the regions', () => {
    for (const f of [0, 20, 67, 95]) {
      const sum = REGIONS.reduce((s, r) => s + songs[r.id].frames[f].detections, 0)
      expect(national.frames[f].detections).toBe(sum)
    }
  })

  it('island songs only contain their own dots', () => {
    for (const r of REGIONS) {
      for (const d of songs[r.id].frames[20].dots) expect(d.region).toBe(r.id)
    }
  })

  it('peaks in the 2019 and 2023 El Niño years and dips in 2020–2022', () => {
    const y = national.yearDetections
    expect(y[2019]).toBeGreaterThan(y[2018] * 2)
    expect(y[2023]).toBeGreaterThan(y[2018] * 1.5)
    for (const quiet of [2020, 2021, 2022]) expect(y[quiet]).toBeLessThan(y[2018])
  })

  it('peaks in the August–October dry season', () => {
    const sept2019 = national.frames[20].detections
    const feb2019 = national.frames[13].detections
    expect(sept2019).toBeGreaterThan(feb2019 * 2)
  })

  it('accumulates counters to roughly 4.4M ha and 2.1M ARI cases', () => {
    expect(national.cumulativeHectares[MONTH_COUNT]).toBeCloseTo(4_400_000, -3)
    expect(national.cumulativeAri[MONTH_COUNT]).toBeCloseTo(2_100_000, -3)
    const islandSum = REGIONS.reduce((s, r) => s + songs[r.id].cumulativeHectares[MONTH_COUNT], 0)
    expect(islandSum).toBeCloseTo(national.cumulativeHectares[MONTH_COUNT], -1)
  })

  it('produces FIRMS-shaped dots on land', () => {
    const d = national.frames[20].dots[0]
    expect(d.acq_date.startsWith(String(frameYear(20)))).toBe(true)
    expect(['l', 'n', 'h']).toContain(d.confidence)
    expect(d.bright_ti4).toBeLessThanOrEqual(367)
    expect(d.frp).toBeGreaterThan(0)
    expect(d.province).toBeTruthy()
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
