import { describe, expect, it } from 'vitest'
import { NX, NY, aodBlend, buildAerosol, cellIndex, describeHaze } from './aerosol'
import { provinceAt } from './geo'
import { MONTH_COUNT } from './time'

const field = buildAerosol()
const max = (g: Float32Array) => g.reduce((m, v) => Math.max(m, v), 0)

describe('real MERRA-2 aerosol field', () => {
  it('has one 0.625° × 0.5° grid per month', () => {
    expect(field.frames).toHaveLength(MONTH_COUNT)
    for (const g of field.frames) expect(g).toHaveLength(NX * NY)
  })

  it('paints each region its own AOT over land', () => {
    // A cell in Central Kalimantan, September 2019.
    const i = Math.round((113.9 - 94) / 0.625)
    const j = Math.round((-2 + 12) / 0.5)
    expect(provinceAt(94 + i * 0.625, -12 + j * 0.5)?.properties.region).toBe('kalimantan')
    expect(field.frames[20][cellIndex(i, j)]).toBeCloseTo(field.series.kalimantan.aot[20], 4)
  })

  it('peaks in the 2019 haze crisis and stays thin in the quiet years', () => {
    expect(max(field.frames[20])).toBeGreaterThan(0.25) // September 2019
    expect(max(field.frames[44])).toBeLessThan(max(field.frames[20]) / 2) // September 2021
    expect(max(field.frames[20]) * field.visualScale).toBeLessThanOrEqual(3.1 + 1e-6)
  })

  it('names the haziest region', () => {
    const peak = field.peaks.indonesia[20]
    expect(['Kalimantan', 'Sumatra']).toContain(peak.place)
    expect(describeHaze(peak)).toMatch(/^Thick haze over .+, aerosol optical thickness \d\.\d\d$/)
    expect(describeHaze({ ...peak, aod: 0.02 })).toBe('Mostly clear skies')
  })

  it('blends smoothly between months', () => {
    const k = 1000
    expect(aodBlend(field, 20.5, k)).toBeCloseTo((field.frames[20][k] + field.frames[21][k]) / 2, 5)
  })
})
