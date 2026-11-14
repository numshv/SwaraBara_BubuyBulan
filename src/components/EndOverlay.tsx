import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { formatCompact } from '../data/time'
import { Counter } from './NarrationPanel'
import styles from './EndOverlay.module.css'

interface Props {
  scope: string
  ari: number
  hectares: number
  national: boolean
  reducedMotion: boolean
  onReplay: () => void
  onExplore: () => void
}

/** Matches --t-base; the overlay fades out for this long before the action runs. */
const LEAVE_MS = 450

/** The impact counters fly from the narration panel to centre stage when the song ends. */
export function EndOverlay({ scope, ari, hectares, national, reducedMotion, onReplay, onExplore }: Props) {
  const replayRef = useRef<HTMLButtonElement>(null)
  const counterRefs = useRef<Record<'ari' | 'land', HTMLDivElement | null>>({ ari: null, land: null })
  const [leaving, setLeaving] = useState(false)

  function leave(then: () => void) {
    if (leaving) return
    if (reducedMotion) return then()
    setLeaving(true)
    window.setTimeout(then, LEAVE_MS)
  }

  useLayoutEffect(() => {
    if (reducedMotion) return
    for (const id of ['ari', 'land'] as const) {
      const el = counterRefs.current[id]
      const src = document.querySelector(`[data-counter="${id}"]`)?.getBoundingClientRect()
      if (!el || !src) continue
      const dst = el.getBoundingClientRect()
      const dx = src.left + src.width / 2 - (dst.left + dst.width / 2)
      const dy = src.top + src.height / 2 - (dst.top + dst.height / 2)
      const scale = Math.min(1, src.width / dst.width)
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.6 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 1100, delay: id === 'land' ? 150 : 0, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' },
      )
    }
  }, [reducedMotion])

  useEffect(() => {
    replayRef.current?.focus()
  }, [])

  return (
    <section className={styles.overlay} aria-labelledby="end-title" data-leaving={leaving || undefined}>
      <h2 id="end-title" className={`${styles.kicker} eyebrow`}>
        {scope}, 2018–2025
      </h2>
      <div className={styles.counters}>
        <div ref={(el) => void (counterRefs.current.ari = el)}>
          <Counter id="ari" big label="people treated for acute respiratory infections" value={ari} />
        </div>
        <div ref={(el) => void (counterRefs.current.land = el)}>
          <Counter id="land" big label="hectares of land burned" value={hectares} />
        </div>
      </div>
      <p className={styles.closing}>
        Behind every dot: {formatCompact(ari)} people struggling to breathe, and {formatCompact(hectares)} hectares lost.
      </p>
      <div className={styles.actions}>
        <button ref={replayRef} type="button" className="btn btn-primary" onClick={() => leave(onReplay)}>
          Replay
        </button>
        <button type="button" className="btn" onClick={() => leave(onExplore)}>
          {national ? 'Explore an island' : 'Back to Indonesia'}
        </button>
      </div>
    </section>
  )
}
