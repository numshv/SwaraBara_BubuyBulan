import styles from './Legend.module.css'

/** Five colour steps between the six brightness ticks (bright_ti4 saturates at 367 K). */
const STEPS = ['#b8361a', '#eb5a2d', '#ff8c3c', '#ffc86e', '#fff0cd']
const TICKS = [300, 315, 330, 345, 360, 367]

/** Radii roughly match the drawn dots at the national zoom. */
const SIZES = [
  { mw: 5, r: 3 },
  { mw: 50, r: 5 },
  { mw: 500, r: 11 },
]

export function Legend() {
  return (
    <section className={styles.legend} aria-label="Map legend" data-tour="legend">
      <div className={styles.row}>
        {/* Captions sit above each scale, so no separate heading is needed. */}
        <figure className={styles.scale}>
          <figcaption>Fire spot radiative power</figcaption>
          <ul className={styles.sizes}>
            {SIZES.map(({ mw, r }) => (
              <li key={mw}>
                <span className={styles.dotBox} aria-hidden="true">
                  <span className={styles.dot} style={{ width: r * 2, height: r * 2 }} />
                </span>
                {mw} MW
              </li>
            ))}
          </ul>
        </figure>

        <figure className={styles.scale}>
          <figcaption>
            Fire spot brightness (K)
            <span className="sr-only">: colour runs from dark red at 300 kelvin to near-white at 367 kelvin.</span>
          </figcaption>
          <div className={styles.ramp} aria-hidden="true">
            {STEPS.map((c) => (
              <span key={c} style={{ background: c }} />
            ))}
          </div>
          <div className={styles.ticks} aria-hidden="true">
            {TICKS.map((t, i) => (
              <span key={t} style={{ left: `${(i / (TICKS.length - 1)) * 100}%` }}>
                {t}
              </span>
            ))}
          </div>
        </figure>
      </div>
    </section>
  )
}
