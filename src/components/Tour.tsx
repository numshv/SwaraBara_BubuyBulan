import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import styles from './Tour.module.css'

export interface TourStep {
  target: string
  title: string
  text: string
}

export const INTRO_STEPS: TourStep[] = [
  {
    target: '[data-tour="map"]',
    title: 'Indonesia, region by region',
    text: 'Each glowing dot is a cluster of satellite fire detections. Click a region label, or press its number key 1 to 7, to open its own fire story.',
  },
  {
    target: '[data-tour="player"]',
    title: 'The player',
    text: 'Press Play, or Space, to start eight years of fire at one month per second. Skip between chapters and change the speed here.',
  },
  {
    target: '[data-tour="help"]',
    title: 'Help and settings',
    text: 'Open this guide again from Help, or switch between visual and audio mode in Settings.',
  },
]

export const PLAY_STEPS: TourStep[] = [
  {
    target: '[data-tour="narration"]',
    title: 'Narration',
    text: 'As the years pass, a narrator explains what is happening. The voice can be turned off in Settings, and N repeats the latest chapter.',
  },
  {
    target: '[data-tour="counters"]',
    title: 'Impact counters',
    text: 'A running total of people treated for acute respiratory infections and of land burned. Watch where they end up.',
  },
  {
    target: '[data-tour="layers"]',
    title: 'Sound layers',
    text: 'Each data set is one layer of the music: wildfire, aerosol smoke, carbon monoxide and fine particles. Switch them on or off to hear them separately; Wildfire and Aerosol also show or hide their layer on the map.',
  },
  {
    target: '[data-tour="legend"]',
    title: 'Reading the dots',
    text: 'Bigger dots mean more fire radiative power. Whiter, brighter dots mean more intense fires.',
  },
]

interface Props {
  steps: TourStep[]
  label: string
  onDone: () => void
}

/** Spotlight coach marks for the visual mode. */
export function Tour({ steps, label, onDone }: Props) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<Element | null>(null)
  const step = steps[i]

  useEffect(() => {
    returnFocus.current = document.activeElement
    return () => {
      if (returnFocus.current instanceof HTMLElement) returnFocus.current.focus()
    }
  }, [])

  useLayoutEffect(() => {
    const measure = () => setRect(document.querySelector(step.target)?.getBoundingClientRect() ?? null)
    measure()
    // Targets may still be easing into place (the narration column opens over ~700ms), so follow their size.
    const target = document.querySelector(step.target)
    const ro = new ResizeObserver(measure)
    if (target) ro.observe(target)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [step.target])

  useEffect(() => {
    boxRef.current?.focus()
  }, [i])

  const last = i === steps.length - 1

  // Esc skips; Tab is trapped inside the step card.
  const onKeyDown = useRef<(e: KeyboardEvent) => void>(() => {})
  onKeyDown.current = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onDone()
    if (e.key !== 'Tab') return
    const focusables = boxRef.current?.querySelectorAll<HTMLElement>('button')
    if (!focusables?.length) return
    const first = focusables[0]
    const end = focusables[focusables.length - 1]
    if (e.shiftKey && (document.activeElement === first || document.activeElement === boxRef.current)) {
      e.preventDefault()
      end.focus()
    } else if (!e.shiftKey && document.activeElement === end) {
      e.preventDefault()
      first.focus()
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKeyDown.current(e)
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const pad = 8
  const vw = window.innerWidth
  const vh = window.innerHeight
  const boxW = Math.min(360, vw - 32)
  let top = rect ? rect.bottom + 16 : vh / 2 - 100
  if (rect && top + 220 > vh) top = Math.max(16, rect.top - 236)
  let left = rect ? Math.min(Math.max(16, rect.left + rect.width / 2 - boxW / 2), vw - boxW - 16) : vw / 2 - boxW / 2
  // Tall, narrow targets (the narration panel): sit beside them instead of covering them.
  if (rect && rect.height > vh * 0.4 && rect.right + boxW + 32 < vw) {
    left = rect.right + 24
    top = Math.max(16, rect.top + 24)
  }

  return (
    <div className={styles.layer}>
      {rect && (
        <div
          className={styles.spot}
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
          aria-hidden="true"
        />
      )}
      <div
        ref={boxRef}
        className={styles.box}
        style={{ top, left, width: boxW }}
        role="dialog"
        aria-modal="true"
        aria-label={`${label}: step ${i + 1} of ${steps.length}, ${step.title}`}
        aria-describedby="tour-text"
        tabIndex={-1}
      >
        <p className={`${styles.count} eyebrow`}>
          {label} · {i + 1} / {steps.length}
        </p>
        <h2 className={styles.title}>{step.title}</h2>
        <p id="tour-text" className={styles.text}>
          {step.text}
        </p>
        <div className={styles.dots} aria-hidden="true">
          {steps.map((s, j) => (
            <span key={s.target} data-on={j === i || undefined} />
          ))}
        </div>
        <div className={styles.actions}>
          <button type="button" className="link" onClick={onDone}>
            Skip
          </button>
          <span className={styles.spacer} />
          {i > 0 && (
            <button type="button" className="btn" onClick={() => setI(i - 1)}>
              Back
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => (last ? onDone() : setI(i + 1))}>
            {last ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
