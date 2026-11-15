import { Modal } from './Modal'
import styles from './Guides.module.css'

const SHORTCUTS: [string[], string][] = [
  [['Space'], 'Play or pause'],
  [['←', '→'], 'Back or forward one month'],
  [['1', '–', '7'], 'Open a region: Sumatra, Kalimantan, Java, Sulawesi, Bali & Nusa Tenggara, Maluku, Papua'],
  [['Esc'], 'Back to Indonesia, or close a dialog'],
  [['N'], 'Repeat the latest narration'],
  [['?'], 'Open this guide'],
]

export function ShortcutTable() {
  return (
    <table className={styles.table}>
      <caption className="sr-only">Keyboard shortcuts</caption>
      <thead>
        <tr>
          <th scope="col">Key</th>
          <th scope="col">Action</th>
        </tr>
      </thead>
      <tbody>
        {SHORTCUTS.map(([keys, action]) => (
          <tr key={action}>
            <td>
              {keys.map((k) => (k === '–' ? ' to ' : <kbd key={k}>{k}</kbd>))}
            </td>
            <td>{action}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Linear, screen-reader-first versions of the two onboarding tours. */
export function AudioGuide({ stage, onDone }: { stage: 'intro' | 'play'; onDone: () => void }) {
  return (
    <Modal open title={stage === 'intro' ? 'How this works' : 'New while playing'} onClose={onDone}>
      {stage === 'intro' ? (
        <>
          <p className={styles.p}>
            This piece plays eight years of Indonesian wildfires, from 2018 to 2025, at one month per second. Here is the page,
            from top to bottom:
          </p>
          <ol className={styles.list}>
            <li>The title, with Repository, Help and Settings links.</li>
            <li>
              A map with seven region buttons. Use arrow keys between them to hear each region&apos;s fires for the current
              month, and Enter to open its own fire story.
            </li>
            <li>The player: previous chapter, play, next chapter and a timeline slider.</li>
          </ol>
          <p className={styles.p}>Narration and monthly summaries are read to you automatically. Keyboard shortcuts:</p>
          <ShortcutTable />
        </>
      ) : (
        <>
          <p className={styles.p}>Playback is about to start. These parts of the page are now available:</p>
          <ol className={styles.list}>
            <li>
              Narration panel. Each chapter is read to you and the timeline waits until it&apos;s done. Press Space to continue
              early, or N to hear it again.
            </li>
            <li>Sound layers: Wildfire, Aerosol, El Niño, IOD and CO switches. Each says which gamelan instrument plays it and its value this month, and switching one off also hides it on the map.</li>
            <li>A legend that explains the fire dots on the map.</li>
          </ol>
        </>
      )}
      <div>
        <button type="button" className="btn btn-primary" onClick={onDone}>
          {stage === 'intro' ? 'Got it' : 'Start playing'}
        </button>
      </div>
    </Modal>
  )
}
