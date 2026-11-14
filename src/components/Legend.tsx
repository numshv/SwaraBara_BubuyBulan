import styles from './Legend.module.css'

/** Five colour steps between the six brightness ticks (bright_ti4 saturates at 367 K). */
const STEPS = ['#b8361a', '#eb5a2d', '#ff8c3c', '#ffc86e', '#fff0cd']
const TICKS = [300, 315, 330, 345, 360, 367]

const AOD_TICKS = ['0', '1', '2', '3+']

/** Radii roughly match the drawn dots at the national zoom. */
const SIZES = [
  { mw: 5, r: 3 },
  { mw: 50, r: 5 },
  { mw: 500, r: 11 },
]

export function Legend() {
  return (
    <section className={styles.legend} aria-label="Map legend" data-tour="legend">
      {/* Aerosol on top; fire brightness and radiative power side by side below. Captions sit above each scale. */}
      <figure className={styles.scale}>
        <figcaption>
          Aerosol optical depth
          <span className="sr-only">: smoke haze from clear at 0 to thick at 3 or more.</span>
        </figcaption>
        <div className={styles.haze} aria-hidden="true" />
        <div className={styles.ticks} aria-hidden="true">
          {AOD_TICKS.map((t, i) => (
            <span key={t} style={{ left: `${(i / (AOD_TICKS.length - 1)) * 100}%` }}>
              {t}
            </span>
          ))}
        </div>
      </figure>

      <div className={styles.fire}>
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
      </div>
    </section>
  )
}
