import { describe, expect, it } from 'vitest'
import { NX, NY, aodBlend, cellLat, cellLon, describeHaze, generateAerosol } from './aerosol'
import { generateAll } from './generate'
import { MONTH_COUNT } from './time'

const field = generateAerosol(generateAll().indonesia.frames)
const max = (g: Float32Array) => g.reduce((m, v) => Math.max(m, v), 0)

describe('generateAerosol', () => {
  it('has one MERRA-like 0.625° × 0.5° grid per month', () => {
    expect(field.frames).toHaveLength(MONTH_COUNT)
    for (const g of field.frames) expect(g).toHaveLength(NX * NY)
  })

  it('never drops below the clean-air background', () => {
    for (const g of field.frames) expect(g.reduce((m, v) => Math.min(m, v), Infinity)).toBeGreaterThanOrEqual(0.12)
  })

  it('peaks near AOD 3 in the 2019 haze crisis and stays thin in the quiet years', () => {
    expect(max(field.frames[20])).toBeGreaterThan(2.5) // September 2019
    expect(max(field.frames[44])).toBeLessThan(max(field.frames[20]) / 2) // September 2021
  })

  it('pushes dry-season smoke north-west, downwind of the fires', () => {
    expect(field.wind[20][0]).toBeLessThan(0)
    expect(field.wind[20][1]).toBeGreaterThan(0)
    // Haze centre of mass sits west of the fire centre of mass in September 2019.
    const fires = generateAll().indonesia.frames[20].dots
    const fireLon = fires.reduce((s, d) => s + d.longitude, 0) / fires.length
    let w = 0
    let lon = 0
    field.frames[20].forEach((v, k) => {
      const excess = Math.max(0, v - 0.3)
      w += excess
      lon += excess * cellLon(k % NX)
    })
    expect(lon / w).toBeLessThan(fireLon)
  })

  it('names where the haze is worst', () => {
    const peak = field.peaks.indonesia[20]
    expect(peak.place).toBeTruthy()
    expect(cellLat(0)).toBe(-12)
    expect(describeHaze(peak)).toMatch(/^Thick haze over .+, AOD \d\.\d$/)
    expect(describeHaze({ ...peak, aod: 0.2 })).toBe('Mostly clear skies')
  })

  it('blends smoothly between months', () => {
    const k = 1000
    const mid = aodBlend(field, 20.5, k)
    const a = field.frames[20][k]
    const b = field.frames[21][k]
    expect(mid).toBeCloseTo((a + b) / 2, 5)
  })
})
