import { describe, expect, it } from 'vitest'
import { NX, NY, generateAerosol } from './aerosol'
import { CO_BACKGROUND, generateCo } from './co'
import { generateAll } from './generate'
import { REGIONS } from './regions'
import { MONTH_COUNT } from './time'

const national = generateAll().indonesia.frames
const co = generateCo(national, generateAerosol(national).wind)
const max = (g: Float32Array) => g.reduce((m, v) => Math.max(m, v), 0)

describe('generateCo', () => {
  it('has one grid per month on the aerosol grid', () => {
    expect(co.frames).toHaveLength(MONTH_COUNT)
    for (const g of co.frames) expect(g).toHaveLength(NX * NY)
  })

  it('never drops below background and peaks near 900 ppb in the 2019 crisis', () => {
    for (const g of co.frames) expect(g.reduce((m, v) => Math.min(m, v), Infinity)).toBeGreaterThanOrEqual(CO_BACKGROUND)
    expect(Math.max(...co.frames.map(max))).toBeCloseTo(900, -1)
    expect(max(co.frames[44])).toBeLessThan(max(co.frames[20]) / 2) // Sep 2021 vs Sep 2019
  })

  it('reports per-song peaks, islands never above the national peak', () => {
    for (const r of REGIONS) {
      co.peaks[r.id].forEach((v, f) => expect(v).toBeLessThanOrEqual(co.peaks.indonesia[f]))
    }
  })
})
