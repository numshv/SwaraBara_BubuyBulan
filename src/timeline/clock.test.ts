import { describe, expect, it } from 'vitest'
import { MONTH_COUNT } from '../data/time'
import { clockReducer, initialClock, type ClockState } from './clock'

const playing: ClockState = { ...initialClock, playing: true }

describe('clockReducer', () => {
  it('advances one month per second at 1×', () => {
    expect(clockReducer(playing, { type: 'tick', dt: 1 }).t).toBeCloseTo(1)
  })

  it('respects playback speed', () => {
    expect(clockReducer({ ...playing, speed: 2 }, { type: 'tick', dt: 1 }).t).toBeCloseTo(2)
    expect(clockReducer({ ...playing, speed: 0.5 }, { type: 'tick', dt: 1 }).t).toBeCloseTo(0.5)
  })

  it('ignores ticks while paused', () => {
    expect(clockReducer(initialClock, { type: 'tick', dt: 5 })).toBe(initialClock)
  })

  it('stops and flags the end of the song', () => {
    const s = clockReducer({ ...playing, t: MONTH_COUNT - 0.2 }, { type: 'tick', dt: 1 })
    expect(s).toMatchObject({ t: MONTH_COUNT, playing: false, ended: true })
  })

  it('restarts from the beginning when played after ending', () => {
    const s = clockReducer({ ...initialClock, t: MONTH_COUNT, ended: true }, { type: 'play' })
    expect(s).toMatchObject({ t: 0, playing: true, ended: false })
  })

  it('clamps seeking to the timeline', () => {
    expect(clockReducer(initialClock, { type: 'seek', t: -4 }).t).toBe(0)
    expect(clockReducer(initialClock, { type: 'seek', t: 500 }).t).toBe(MONTH_COUNT)
  })

  it('steps whole months', () => {
    expect(clockReducer({ ...initialClock, t: 3.4 }, { type: 'step', months: 1 }).t).toBe(4)
    expect(clockReducer({ ...initialClock, t: 3.4 }, { type: 'step', months: -1 }).t).toBe(3)
    expect(clockReducer({ ...initialClock, t: 0 }, { type: 'step', months: -1 }).t).toBe(0)
  })

  describe('chapter jumps', () => {
    const frames = [0, 7, 19, 27]
    it('jumps to the next chapter', () => {
      expect(clockReducer({ ...initialClock, t: 8 }, { type: 'chapter', dir: 1, frames }).t).toBe(19)
    })
    it('stays put after the last chapter', () => {
      const s = { ...initialClock, t: 40 }
      expect(clockReducer(s, { type: 'chapter', dir: 1, frames })).toBe(s)
    })
    it('rewinds to the current chapter start, then the previous one', () => {
      expect(clockReducer({ ...initialClock, t: 23 }, { type: 'chapter', dir: -1, frames }).t).toBe(19)
      expect(clockReducer({ ...initialClock, t: 19.5 }, { type: 'chapter', dir: -1, frames }).t).toBe(7)
    })
  })
})
