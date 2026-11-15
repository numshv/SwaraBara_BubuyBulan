import type { CSSProperties } from 'react'
import type { Cue } from '../data/narration'
import { MONTH_COUNT, SECONDS_PER_MONTH, YEARS, formatClock, frameLabel } from '../data/time'
import type { ClockState } from '../timeline/clock'
import styles from './Player.module.css'

interface Props {
  clock: ClockState
  songLabel: string
  cues: Cue[]
  holding: boolean
  onToggle: () => void
  onSeek: (t: number) => void
  onChapter: (dir: -1 | 1) => void
}

export function Player({ clock, songLabel, cues, holding, onToggle, onSeek, onChapter }: Props) {
  const total = MONTH_COUNT * SECONDS_PER_MONTH
  const elapsed = clock.t * SECONDS_PER_MONTH
  const pct = (clock.t / MONTH_COUNT) * 100

  return (
    <section className={styles.player} aria-label="Player" data-tour="player" id="player">
      <p className={styles.nowPlaying}>
        <span className={styles.caps}>{clock.playing ? 'Now playing' : clock.t > 0 && !clock.ended ? 'Paused' : 'Up next'}:</span>{' '}
        <span key={holding ? 'hold' : songLabel} className={`${styles.song} appear`} data-holding={holding || undefined}>
          {holding ? 'Paused for narration. Press Space to continue.' : songLabel}
        </span>
      </p>

      <div className={styles.buttons}>
        <button type="button" className="icon-btn" onClick={() => onChapter(-1)} aria-label="Previous chapter">
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 2v12M13 2 5 8l8 6z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        <button
          type="button"
          className={styles.play}
          onClick={onToggle}
          aria-label={clock.playing ? 'Pause' : clock.ended ? 'Replay' : 'Play'}
          aria-keyshortcuts="Space"
        >
          {clock.playing ? (
            <svg width="14" height="14" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M4 2h3.5v14H4zM10.5 2H14v14h-3.5z" fill="currentColor" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M5 2l11 7-11 7z" fill="currentColor" />
            </svg>
          )}
        </button>
        <button type="button" className="icon-btn" onClick={() => onChapter(1)} aria-label="Next chapter">
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M13 2v12M3 2l8 6-8 6z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>

      <div className={styles.timeline}>
        <span className={styles.time} aria-hidden="true">
          {formatClock(elapsed)}
        </span>
        <div className={styles.track}>
          <input
            type="range"
            className={styles.range}
            min={0}
            max={MONTH_COUNT}
            step={1}
            value={Math.floor(clock.t)}
            onChange={(e) => onSeek(Number(e.target.value))}
            aria-label="Timeline position"
            aria-valuetext={frameLabel(clock.t)}
            style={{ '--pct': `${pct}%` } as CSSProperties}
          />
          <div className={styles.markers} aria-hidden="true">
            {cues.map((c) => (
              <span key={c.frame} className={styles.marker} style={{ left: `${(c.frame / MONTH_COUNT) * 100}%` }} title={c.title} />
            ))}
          </div>
          {/* Each year label sits under the middle of its twelve months. */}
          <div className={styles.years} aria-hidden="true">
            {YEARS.map((y, i) => (
              <span key={y} style={{ left: `${((i * 12 + 6) / MONTH_COUNT) * 100}%` }}>
                {y}
              </span>
            ))}
          </div>
        </div>
        <span className={styles.time} aria-hidden="true">
          {formatClock(total)}
        </span>
      </div>
    </section>
  )
}
