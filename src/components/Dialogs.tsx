import type { Mode, Prefs } from '../prefs'
import { ShortcutTable } from './Guides'
import { Modal } from './Modal'
import styles from './Dialogs.module.css'

interface SettingsProps {
  open: boolean
  prefs: Prefs
  onChange: (patch: Partial<Prefs>) => void
  onReplayOnboarding: () => void
  onClose: () => void
}

export function SettingsDialog({ open, prefs, onChange, onReplayOnboarding, onClose }: SettingsProps) {
  return (
    <Modal open={open} title="Settings" onClose={onClose}>
      <fieldset className={styles.fieldset}>
        <legend>Experience</legend>
        {(['visual', 'audio'] as Mode[]).map((m) => (
          <label key={m} className={styles.radio}>
            <input type="radio" name="mode" checked={prefs.mode === m} onChange={() => onChange({ mode: m })} />
            {m === 'visual' ? 'Visual experience' : 'Audio / screen reader mode'}
          </label>
        ))}
      </fieldset>

      <div className={styles.row}>
        <button type="button" className="btn" onClick={onReplayOnboarding}>
          Show onboarding again
        </button>
      </div>
    </Modal>
  )
}

interface HelpProps {
  open: boolean
  onClose: () => void
  onReplay: (stage: 'intro' | 'play') => void
}

export function HelpDialog({ open, onClose, onReplay }: HelpProps) {
  return (
    <Modal open={open} title="Help" onClose={onClose}>
      <p className={styles.note}>
        A silent mockup of the wildfire sonification. Every number is dummy data, generated to look like NASA FIRMS VIIRS
        detections.
      </p>
      <div className={styles.row}>
        <button type="button" className="btn" onClick={() => onReplay('intro')}>
          Replay intro guide
        </button>
        <button type="button" className="btn" onClick={() => onReplay('play')}>
          Replay player guide
        </button>
      </div>
      <h3 className={styles.sub}>Keyboard shortcuts</h3>
      <ShortcutTable />
    </Modal>
  )
}
