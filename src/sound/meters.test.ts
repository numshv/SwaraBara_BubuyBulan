import { describe, expect, it } from 'vitest'
import { generateClimate } from '../data/climate'
import { MONTH_COUNT } from '../data/time'
import { busyEnvelope, envelope, glide, hitLevel, normalise, type MeterEvent } from './meters'

const months = (fill: (f: number) => MeterEvent[]) => Array.from({ length: MONTH_COUNT }, (_, f) => fill(f))

describe('envelope', () => {
  const events = months((f) => (f === 3 ? [{ offset: 0.5, w: 1 }] : []))

  it('is zero before a hit and peaks right on it', () => {
    expect(envelope(events, 3.4, 0.05)).toBe(0)
    expect(envelope(events, 3.5, 0.05)).toBeCloseTo(1)
  })

  it('decays after the hit', () => {
    const later = envelope(events, 3.55, 0.05)
    expect(later).toBeCloseTo(Math.exp(-1))
    expect(envelope(events, 4.5, 0.05)).toBe(0)
  })

  it('reaches into the previous month', () => {
    const edge = months((f) => (f === 3 ? [{ offset: 0.99, w: 1 }] : []))
    expect(envelope(edge, 4.01, 0.05)).toBeGreaterThan(0.5)
  })
})

describe('hitLevel', () => {
  it('maps a busy month near the top and a single hit low', () => {
    const busyMonth = months(() => Array.from({ length: 200 }, (_, i) => ({ offset: i / 200, w: 1 })))
    const busy = busyEnvelope(busyMonth, 0.05)
    expect(hitLevel(envelope(busyMonth, 10.5, 0.05), busy)).toBeGreaterThan(0.9)
    expect(hitLevel(1, busy)).toBeLessThan(0.4)
    expect(hitLevel(0, busy)).toBe(0)
  })
})

describe('glide and normalise', () => {
  it('eases between months and clamps at the ends', () => {
    expect(glide([0, 10, 20], 1.5)).toBe(15)
    expect(glide([0, 10, 20], 9)).toBe(20)
  })
  it('scales into 0–1 within a range', () => {
    expect(normalise(5, [0, 10])).toBe(0.5)
    expect(normalise(-3, [0, 10])).toBe(0)
    expect(normalise(4, [4, 4])).toBe(0)
  })
})

describe('generateClimate', () => {
  const c = generateClimate()

  it('covers 96 months', () => {
    for (const s of [c.oni, c.co2, c.rain, c.rainDays]) expect(s).toHaveLength(MONTH_COUNT)
  })

  it('has La Niña in 2021 and a strong El Niño late in 2023', () => {
    expect(Math.max(...c.oni.slice(36, 48))).toBeLessThan(0)
    expect(Math.max(...c.oni.slice(66, 74))).toBeGreaterThan(1.5)
  })

  it('has a strong positive IOD in 2019, negative 2021–22 and positive 2023', () => {
    expect(c.iod).toHaveLength(MONTH_COUNT)
    expect(Math.max(...c.iod.slice(18, 24))).toBeGreaterThan(1.5)
    expect(Math.min(...c.iod.slice(40, 58))).toBeLessThan(-0.7)
    expect(Math.max(...c.iod.slice(66, 72))).toBeGreaterThan(1.2)
  })

  it('has rising CO₂', () => {
    expect(c.co2[95]).toBeGreaterThan(c.co2[0] + 15)
  })

  it('rains less in the dry season, and least in El Niño dry seasons', () => {
    expect(c.rain[19]).toBeLessThan(c.rain[13]) // Aug 2019 vs Feb 2019
    expect(c.rain[68]).toBeLessThan(c.rain[44]) // Sep 2023 vs Sep 2021
    expect(c.rainDays[68].length).toBeLessThan(c.rainDays[13].length)
  })
})
