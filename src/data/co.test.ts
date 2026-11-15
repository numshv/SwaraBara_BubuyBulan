import { describe, expect, it } from 'vitest'
import { NX, NY } from './aerosol'
import { buildCo } from './co'
import { MONTH_COUNT } from './time'

const co = buildCo()

describe('real MERRA-2 CO field', () => {
  it('has one grid per month on the aerosol grid', () => {
    expect(co.frames).toHaveLength(MONTH_COUNT)
    for (const g of co.frames) expect(g).toHaveLength(NX * NY)
  })

  it('peaks over Kalimantan in September 2019', () => {
    const k = co.values.kalimantan
    expect(k[20]).toBeGreaterThan(150)
    expect(k[44]).toBeLessThan(k[20] / 1.5)
    expect(Math.max(...co.frames[20])).toBeCloseTo(k[20], 0)
  })

  it('falls back to the Indonesia-wide series where the source has no column', () => {
    expect(co.fallback.has('java')).toBe(true)
    expect(co.fallback.has('sumatra')).toBe(false)
    expect(co.values.java).toBe(co.values.indonesia)
  })
})
