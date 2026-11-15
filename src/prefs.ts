import { useEffect, useState } from 'react'

export type Mode = 'visual' | 'audio'

export interface Prefs {
  mode: Mode | null
  /** Visual mode: speak narration with the browser's voice. */
  narrationVoice: boolean
  /** Audio mode: speak all announcements for visitors without a screen reader. */
  builtInVoice: boolean
  /** Experiment: burn scars, hotspot glow, sparks and darker smoke. */
  dramaticFx: boolean
  introTourDone: boolean
  playTourDone: boolean
  /** The opening splash only shows on the very first visit. */
  splashSeen: boolean
}

const KEY = 'wildfire-mockup-prefs'
const DEFAULTS: Prefs = {
  mode: null,
  narrationVoice: true,
  builtInVoice: false,
  dramaticFx: true,
  introTourDone: false,
  playTourDone: false,
  splashSeen: false,
}

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(load)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs))
    } catch {
      // Private mode or blocked storage: preferences just won't persist.
    }
  }, [prefs])
  const update = (patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch }))
  const reset = () => setPrefs(DEFAULTS)
  return { prefs, update, reset }
}

export function useReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}
