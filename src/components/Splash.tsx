import { useEffect, useState } from 'react'
import styles from './Splash.module.css'

const SHOW_MS = 2200
const FADE_MS = 500

/** Opening screen: logo, name and tagline. Click or any key skips it. */
export function Splash({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const fade = window.setTimeout(() => setLeaving(true), SHOW_MS)
    const done = window.setTimeout(onDone, SHOW_MS + FADE_MS)
    const skip = () => setLeaving(true)
    window.addEventListener('keydown', skip)
    window.addEventListener('pointerdown', skip)
    return () => {
      window.clearTimeout(fade)
      window.clearTimeout(done)
      window.removeEventListener('keydown', skip)
      window.removeEventListener('pointerdown', skip)
    }
  }, [onDone])

  // Skipping (click or key) fades out, then hands over.
  useEffect(() => {
    if (!leaving) return
    const id = window.setTimeout(onDone, FADE_MS)
    return () => window.clearTimeout(id)
  }, [leaving, onDone])

  return (
    <div className={styles.splash} data-leaving={leaving || undefined} role="status">
      <img src="/spaceappslogo.png" alt="NASA Space Apps Challenge" className={styles.logo} />
      <h1 className={styles.name}>Swara Bara</h1>
      <p className={styles.tagline}>Listening to Indonesia&apos;s wildfires, 2018–2025</p>
      <div className={styles.bar} aria-hidden="true">
        <span />
      </div>
      <p className="sr-only">Loading.</p>
    </div>
  )
}

