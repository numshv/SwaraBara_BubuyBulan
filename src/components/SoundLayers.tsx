import { useMemo, type CSSProperties } from 'react'
import type { AerosolPeak } from '../data/aerosol'
import type { ClimateSeries } from '../data/climate'
import type { FrameData } from '../data/generate'
import { clampFrame, formatNumber } from '../data/time'
import { busyEnvelope, envelope, glide, hitLevel, normalise, range, type MeterEvent } from '../sound/meters'
import styles from './SoundLayers.module.css'

export type LayerId = 'wildfire' | 'aerosol' | 'elnino' | 'iod' | 'co'
export type Layers = Record<LayerId, boolean>

interface LayerDef {
  id: LayerId
  name: string
  /** Placeholder gamelan voice until the sound mapping is decided. */
  instrument: string
  /** Meter and switch colour, from the project palette; aerosol stays an off-white like smoke. */
  color: string
}

export const LAYERS: LayerDef[] = [
  { id: 'wildfire', name: 'Wildfire', instrument: 'Bonang', color: '#de4a3d' },
  { id: 'aerosol', name: 'Aerosol', instrument: 'Gong ageng', color: '#e8e4dc' },
  { id: 'elnino', name: 'El Niño', instrument: 'Kendang', color: '#efcd57' },
  // Placeholder colour: the palette had no unused colour left.
  { id: 'iod', name: 'IOD', instrument: 'Slenthem', color: '#4fa3bf' },
  { id: 'co', name: 'CO', instrument: 'Saron', color: '#924fbf' },
]

export const LAYER_NAMES = Object.fromEntries(LAYERS.map((l) => [l.id, l.name])) as Record<LayerId, string>

/** White knob on dark tracks, dark knob on light ones (off-white aerosol, yellow El Niño). */
function knobFor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? '#161616' : '#ffffff'
}

/** Decay time in months: fire hits fade fast. */
const FIRE_TAU = 0.05

interface Props {
  layers: Layers
  frames: FrameData[]
  aerosolPeaks: AerosolPeak[]
  climate: ClimateSeries
  t: number
  playing: boolean
  reducedMotion: boolean
  onToggle: (id: LayerId) => void
}

export function SoundLayers({ layers, frames, aerosolPeaks, climate, t, playing, reducedMotion, onToggle }: Props) {
  // Per-song scales, so every meter spans its own 2018–2025 range.
  const scales = useMemo(() => {
    const fireEvents: MeterEvent[][] = frames.map((fr) => fr.dots.map((d) => ({ offset: d.offset, w: Math.sqrt(d.frp) })))
    return {
      fireEvents,
      fireBusy: busyEnvelope(fireEvents, FIRE_TAU),
      detections: range(frames.map((fr) => fr.detections)),
      aod: range(aerosolPeaks.map((p) => p.aod)),
      co: range(frames.map((fr) => fr.co)),
      oni: range(climate.oni),
      iod: range(climate.iod),
    }
  }, [frames, aerosolPeaks, climate])

  const f = clampFrame(t)
  const frame = frames[f]
  const live = playing && !reducedMotion
  const wobble = (amp: number, speed: number, phase: number) => (live ? amp * Math.sin(t * speed + phase) : 0)

  function level(id: LayerId): number {
    switch (id) {
      case 'wildfire':
        return reducedMotion
          ? normalise(glide(frames.map((fr) => fr.detections), t), scales.detections)
          : hitLevel(envelope(scales.fireEvents, t, FIRE_TAU), scales.fireBusy)
      case 'aerosol':
        return normalise(glide(aerosolPeaks.map((p) => p.aod), t), scales.aod) + wobble(0.04, 19, 0)
      case 'co':
        return normalise(glide(frames.map((fr) => fr.co), t), scales.co) + wobble(0.05, 37, 1.3)
      case 'elnino':
        return normalise(glide(climate.oni, t), scales.oni)
      case 'iod':
        return normalise(glide(climate.iod, t), scales.iod)
    }
  }

  // Numbers change once a month; the meters carry the fast movement.
  const values: Record<LayerId, { short: string; spoken: string }> = {
    wildfire: { short: `${formatNumber(frame.detections)} spots`, spoken: `${formatNumber(frame.detections)} fire spots this month` },
    aerosol: { short: `AOD ${aerosolPeaks[f].aod.toFixed(2)}`, spoken: `aerosol optical depth ${aerosolPeaks[f].aod.toFixed(2)}` },
    elnino: {
      short: `${climate.oni[f] > 0 ? '+' : ''}${climate.oni[f].toFixed(1)} ONI`,
      spoken: `Oceanic Niño Index ${climate.oni[f].toFixed(1)}`,
    },
    iod: {
      short: `${climate.iod[f] > 0 ? '+' : ''}${climate.iod[f].toFixed(1)} DMI`,
      spoken: `Indian Ocean Dipole index ${climate.iod[f].toFixed(1)}`,
    },
    co: { short: `${frame.co} ppb`, spoken: `${frame.co} parts per billion` },
  }

  return (
    <section className={styles.layers} aria-labelledby="layers-heading" data-tour="layers">
      <h2 id="layers-heading" className="eyebrow">
        Sound layer controls
      </h2>
      <ul className={styles.list}>
        {LAYERS.map(({ id, name, instrument, color }) => {
          const on = layers[id]
          const lvl = on ? Math.min(1, Math.max(0, level(id))) : 0
          return (
            <li key={id}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                className={styles.row}
                style={{ '--c': color, '--knob': knobFor(color) } as CSSProperties}
                onClick={() => onToggle(id)}
                aria-label={`${name}, played by ${instrument.toLowerCase()}`}
                aria-describedby={`layer-${id}-value`}
              >
                <span className={styles.pill} aria-hidden="true" />
                <span className={styles.name}>{name}</span>
                <span className={styles.instrument}>{instrument}</span>
                <span className={styles.meter} aria-hidden="true">
                  <span style={{ '--level': lvl } as CSSProperties} />
                </span>
                <span className={styles.value} aria-hidden="true">
                  {on ? values[id].short : 'muted'}
                </span>
                <span className="sr-only" id={`layer-${id}-value`}>
                  {on ? values[id].spoken : 'muted'}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
