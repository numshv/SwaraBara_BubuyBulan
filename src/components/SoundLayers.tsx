import type { FrameData } from '../data/generate'
import styles from './SoundLayers.module.css'

export type LayerId = 'wildfire' | 'co' | 'pm25'
export type Layers = Record<LayerId, boolean>

interface Props {
  layers: Layers
  frame: FrameData
  onToggle: (id: LayerId) => void
}

export const LAYER_NAMES: Record<LayerId, string> = { wildfire: 'Wildfire', co: 'CO', pm25: 'PM2.5' }

function readout(id: LayerId, f: FrameData): string {
  switch (id) {
    case 'wildfire':
      return `${f.detections.toLocaleString('en-US')} spots`
    case 'co':
      return `${f.co} ppb`
    case 'pm25':
      return `${f.pm25} µg/m³`
  }
}

export function SoundLayers({ layers, frame, onToggle }: Props) {
  return (
    <section className={styles.layers} aria-labelledby="layers-heading" data-tour="layers">
      <h2 id="layers-heading" className="eyebrow">
        Sound layers
      </h2>
      <ul className={styles.list}>
        {(Object.keys(LAYER_NAMES) as LayerId[]).map((id) => {
          const on = layers[id]
          return (
            <li key={id}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                className={styles.layer}
                onClick={() => onToggle(id)}
                aria-label={`${LAYER_NAMES[id]} sound layer`}
                aria-describedby={`layer-${id}-value`}
              >
                <span className={styles.dot} aria-hidden="true" />
                <span className={styles.name}>{LAYER_NAMES[id]}</span>
                <span className={styles.value} id={`layer-${id}-value`}>
                  {on ? readout(id, frame) : 'muted'}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
