import { useEffect, useRef, useState } from 'react'
import type { Mode } from '../prefs'
import styles from './ModeGate.module.css'

export function ModeGate({ onChoose }: { onChoose: (mode: Mode) => void }) {
  const audioRef = useRef<HTMLButtonElement>(null)
  const [hint, setHint] = useState('')

  useEffect(() => {
    audioRef.current?.focus()
    // Filled after mount so screen readers announce it on arrival.
    const id = window.setTimeout(
      () => setHint('Welcome. Press Enter for audio and screen reader mode, or Tab for the visual experience.'),
      400,
    )
    return () => window.clearTimeout(id)
  }, [])

  return (
    <main className={styles.gate} aria-labelledby="gate-title">
      <div className={styles.inner}>
        <div className={styles.kickerRow}>
          <img src="/spaceappslogo.png" alt="NASA Space Apps Challenge" className={styles.brandLogo} />
          <span className={styles.kickerSep} aria-hidden="true">·</span>
          <p className={`${styles.kicker} eyebrow`}>A data sonification</p>
        </div>
        <div className={styles.headingGroup}>
          <h1 id="gate-title" className={styles.title}>
            Swara Bara
          </h1>
          <p className={styles.tagline}>Listening to Indonesia&apos;s wildfires, 2018–2025</p>
        </div>
        <p className={styles.lead}>How would you like to experience this piece?</p>
        <div className={styles.choices}>
          <button ref={audioRef} type="button" className={styles.choice} onClick={() => onChoose('audio')}>
            <span className={styles.choiceTitle}>Audio / screen reader mode</span>
            <span className={styles.choiceText}>
              Narration and map summaries are read to you, with full keyboard control. Best if you use a screen reader or prefer
              to listen.
            </span>
          </button>
          <button type="button" className={styles.choice} onClick={() => onChoose('visual')}>
            <span className={styles.choiceTitle}>Visual experience</span>
            <span className={styles.choiceText}>
              Watch the fire map unfold with a guided tour of the controls. Keyboard shortcuts still work.
            </span>
          </button>
        </div>
        <p className={styles.note}>You can switch modes at any time in Settings.</p>
      </div>
      <div className="sr-only" aria-live="polite">
        {hint}
      </div>
    </main>
  )
}
