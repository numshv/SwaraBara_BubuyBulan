import { CO_LEVELS } from '../map/coLayer'
import styles from './Legend.module.css'

/** Five colour steps between the six brightness ticks (bright_ti4 saturates at 367 K). */
const STEPS = ['#b8361a', '#eb5a2d', '#ff8c3c', '#ffc86e', '#fff0cd']
const TICKS = [300, 315, 330, 345, 360, 367]

const AOD_TICKS = ['0', '1', '2', '3+']
const OCEAN_TICKS = ['−2 wetter', '0', '+2 drier']

/** Radii roughly match the drawn dots at the national zoom. */
const SIZES = [
  { mw: 5, r: 3 },
  { mw: 50, r: 5 },
  { mw: 500, r: 11 },
]

export function Legend() {
  return (
    <section className={styles.legend} aria-label="Map legend" data-tour="legend">
      {/* Radiative power, then fire brightness, then aerosol, stacked. Captions sit above each scale. */}
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

      <figure className={styles.scale}>
        <figcaption>
          Carbon monoxide (ppb)
          <span className="sr-only">: purple contour lines at 250, 400, 600 and 800 parts per billion, brighter towards the core.</span>
        </figcaption>
        <ul className={styles.contours} aria-hidden="true">
          {CO_LEVELS.map((level, i) => (
            <li key={level}>
              <span className={styles.contourLine} style={{ opacity: 0.35 + i * 0.17, height: 0.7 + i * 0.25 }} />
              {level}
            </li>
          ))}
        </ul>
      </figure>

      {/* One entry for both: same edge glow and colours, only the side differs. */}
      <figure className={styles.scale}>
        <figcaption>
          El Niño (east) · IOD (west)
          <span className="sr-only">
            : glow at the map edges. Blue means the ocean pushes Indonesia wetter, orange means drier; stronger colour, stronger
            signal, from minus 2 to plus 2.
          </span>
        </figcaption>
        <div className={styles.ocean} aria-hidden="true" />
        <div className={styles.ticks} aria-hidden="true">
          {OCEAN_TICKS.map((label, i) => (
            <span key={label} style={{ left: `${(i / (OCEAN_TICKS.length - 1)) * 100}%` }}>
              {label}
            </span>
          ))}
        </div>
      </figure>
    </section>
  )
}
