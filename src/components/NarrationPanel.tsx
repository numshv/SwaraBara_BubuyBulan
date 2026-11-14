import type { Cue } from '../data/narration'
import { formatNumber } from '../data/time'
import { NarrationArt } from './NarrationArt'
import styles from './NarrationPanel.module.css'

interface Props {
  cue: Cue
  index: number
  count: number
  scope: string
}

export function NarrationPanel({ cue, index, count, scope }: Props) {
  return (
    <aside className={styles.panel} aria-labelledby="narration-heading" data-tour="narration">
      <h2 id="narration-heading" className="sr-only">
        Narration
      </h2>
      <div key={`${scope}-${index}`} className={`${styles.story} appear`}>
        <NarrationArt kind={cue.art} alt={cue.alt} />
        <p className="eyebrow">
          {index + 1} / {count}
        </p>
        <h3 className={styles.title}>{cue.title}</h3>
        <p className={styles.text}>{cue.text}</p>
      </div>

    </aside>
  )
}

/** Number over a bracketed hairline, after inspo-2's "8 / 54 / 1235" stats. Used by the ending screen. */
export function Counter({ id, label, value, big = false }: { id: 'ari' | 'land'; label: string; value: number; big?: boolean }) {
  return (
    <div className={big ? `${styles.counter} ${styles.big}` : styles.counter} data-counter={big ? undefined : id}>
      <span className={styles.value}>{formatNumber(value)}</span>
      <span className={styles.label}>{label}</span>
    </div>
  )
}
