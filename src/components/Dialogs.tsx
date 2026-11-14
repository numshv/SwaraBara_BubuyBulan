import { speechSupported } from '../a11y/speech'
import type { Mode, Prefs } from '../prefs'
import { ShortcutTable } from './Guides'
import { Modal } from './Modal'
import styles from './Dialogs.module.css'

interface SettingsProps {
  open: boolean
  prefs: Prefs
  onChange: (patch: Partial<Prefs>) => void
  onClose: () => void
}

export function SettingsDialog({ open, prefs, onChange, onClose }: SettingsProps) {
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

      <Switch
        label="Narration voice"
        description={
          prefs.mode === 'audio'
            ? 'Only used in visual mode. In audio mode your screen reader reads the narration.'
            : 'Read narration aloud with the browser voice.'
        }
        checked={prefs.narrationVoice}
        disabled={!speechSupported || prefs.mode === 'audio'}
        onChange={(v) => onChange({ narrationVoice: v })}
      />
      <Switch
        label="Built-in voice"
        description="For audio mode without a screen reader: the page speaks narration, summaries and focused controls itself."
        checked={prefs.builtInVoice}
        disabled={!speechSupported || prefs.mode !== 'audio'}
        onChange={(v) => onChange({ builtInVoice: v })}
      />
      <Switch
        label="Dramatic fire and smoke"
        description="Experimental: burn scars that stay, a faint glow over fire hotspots, sparks and heavier smoke."
        checked={prefs.dramaticFx}
        onChange={(v) => onChange({ dramaticFx: v })}
      />
      {!speechSupported && <p className={styles.note}>This browser does not support speech, so voice options are unavailable.</p>}

      <div className={styles.row}>
        <button type="button" className="btn" onClick={() => onChange({ introTourDone: false, playTourDone: false })}>
          Show onboarding again
        </button>
      </div>
    </Modal>
  )
}

function Switch(props: { label: string; description: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  const id = props.label.replace(/\s+/g, '-').toLowerCase()
  return (
    <div className={styles.switchRow} data-disabled={props.disabled || undefined}>
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={props.checked}
        aria-describedby={`${id}-desc`}
        disabled={props.disabled}
        className={styles.switch}
        onClick={() => props.onChange(!props.checked)}
      >
        <span aria-hidden="true" />
        {props.label}
      </button>
      <p id={`${id}-desc`} className={styles.note}>
        {props.description}
      </p>
    </div>
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
