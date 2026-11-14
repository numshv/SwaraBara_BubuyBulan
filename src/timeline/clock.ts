import { MONTH_COUNT, SECONDS_PER_MONTH } from '../data/time'

export type Speed = 0.5 | 1 | 2
export const SPEEDS: Speed[] = [0.5, 1, 2]

export interface ClockState {
  /** Playhead in months, 0 … MONTH_COUNT. */
  t: number
  playing: boolean
  speed: Speed
  ended: boolean
}

export type ClockAction =
  | { type: 'tick'; dt: number }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'toggle' }
  | { type: 'seek'; t: number }
  | { type: 'step'; months: number }
  | { type: 'chapter'; dir: -1 | 1; frames: number[] }
  | { type: 'speed'; speed: Speed }
  | { type: 'restore'; state: ClockState }

export const initialClock: ClockState = { t: 0, playing: false, speed: 1, ended: false }

const clamp = (t: number) => Math.min(Math.max(t, 0), MONTH_COUNT)

export function clockReducer(state: ClockState, action: ClockAction): ClockState {
  switch (action.type) {
    case 'tick': {
      if (!state.playing) return state
      const t = state.t + (action.dt * state.speed) / SECONDS_PER_MONTH
      if (t >= MONTH_COUNT) return { ...state, t: MONTH_COUNT, playing: false, ended: true }
      return { ...state, t }
    }
    case 'play':
      return state.ended || state.t >= MONTH_COUNT
        ? { ...state, t: 0, playing: true, ended: false }
        : { ...state, playing: true }
    case 'pause':
      return { ...state, playing: false }
    case 'toggle':
      return clockReducer(state, { type: state.playing ? 'pause' : 'play' })
    case 'seek':
      return { ...state, t: clamp(action.t), ended: false }
    case 'step': {
      const base = action.months > 0 ? Math.floor(state.t) : Math.ceil(state.t)
      return { ...state, t: clamp(Math.min(base + action.months, MONTH_COUNT - 1)), ended: false }
    }
    case 'chapter': {
      const cur = Math.floor(state.t)
      if (action.dir > 0) {
        const next = action.frames.find((f) => f > cur)
        return next === undefined ? state : { ...state, t: next, ended: false }
      }
      // Like a music player: "previous" first rewinds to the start of the current chapter.
      const starts = action.frames.filter((f) => f <= cur)
      const current = starts[starts.length - 1] ?? 0
      const target = state.t - current > 1.5 ? current : (starts[starts.length - 2] ?? 0)
      return { ...state, t: target, ended: false }
    }
    case 'speed':
      return { ...state, speed: action.speed }
    case 'restore':
      return action.state
  }
}
