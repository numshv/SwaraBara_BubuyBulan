import { useMemo, type CSSProperties } from 'react'
import type { AotSeries } from '../data/aerosol'
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
  instrument: string
  mapping: string
  /** Meter and switch colour, from the project palette. */
  color: string
}

export const LAYERS: LayerDef[] = [
  {
    id: 'wildfire',
    name: 'Wildfire',
    instrument: 'Peking & Panerus',
    mapping: 'VIIRS bright_ti4 (Peking) & bright_ti5 (Panerus) note pitch, FRP volume',
    color: '#de4a3d',
  },
  {
    id: 'aerosol',
    name: 'Aerosol',
    instrument: 'Bonang',
    mapping: 'MERRA-2 AOT: norm pitch, log_norm duration, anomaly-norm volume',
    color: '#ea9a5cff',
  },
  {
    id: 'elnino',
    name: 'El Niño',
    instrument: 'Jenglong',
    mapping: 'Linked with IOD: ENSO pitch, IOD volume',
    color: '#efcd57',
  },
  {
    id: 'iod',
    name: 'IOD',
    instrument: 'Jenglong',
    mapping: 'Linked with El Niño: ENSO pitch, IOD volume',
    color: '#4fa3bf',
  },
  {
    id: 'co',
    name: 'CO',
    instrument: 'Rebab',
    mapping: 'MERRA-2 CO: higher content, louder',
    color: '#924fbf',
  },
]

export const LAYER_NAMES = Object.fromEntries(LAYERS.map((l) => [l.id, l.name])) as Record<LayerId, string>

/** Decay time in months: fire hits fade fast. */
const FIRE_TAU = 0.05

interface Props {
  layers: Layers
  frames: FrameData[]
  /** This song's MERRA-2 AOT series. */
  aot: AotSeries
  /** This song's CO (ppb), per month. */
  co: number[]
  climate: ClimateSeries
  t: number
  playing: boolean
  reducedMotion: boolean
  onToggle: (id: LayerId) => void
}

export function SoundLayers({ layers, frames, aot, co, climate, t, playing, reducedMotion, onToggle }: Props) {
  // Per-song scales, so every meter spans its own 2018–2025 range.
  const scales = useMemo(() => {
    const fireEvents: MeterEvent[][] = frames.map((fr) => fr.dots.map((d) => ({ offset: d.offset, w: Math.sqrt(d.frp) })))
    return {
      fireEvents,
      fireBusy: busyEnvelope(fireEvents, FIRE_TAU),
      detections: range(frames.map((fr) => fr.detections)),
      aot: range(aot.norm),
      co: range(co),
      enso: range(climate.enso),
      iod: range(climate.iod),
    }
  }, [frames, aot, co, climate])

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
        // Bonang's note follows the normalised AOT.
        return normalise(glide(aot.norm, t), scales.aot) + wobble(0.04, 19, 0)
      case 'co':
        return normalise(glide(co, t), scales.co) + wobble(0.05, 37, 1.3)
      case 'elnino':
        return normalise(glide(climate.enso, t), scales.enso)
      case 'iod':
        return normalise(glide(climate.iod, t), scales.iod)
    }
  }

  // Numbers change once a month; the meters carry the fast movement.
  const values: Record<LayerId, { short: string; spoken: string }> = {
    wildfire: { short: `${formatNumber(frame.detections)} spots`, spoken: `${formatNumber(frame.detections)} fire spots this month` },
    aerosol: { short: `AOT ${aot.aot[f].toFixed(3)}`, spoken: `organic carbon aerosol optical thickness ${aot.aot[f].toFixed(3)}` },
    elnino: {
      short: `ENSO ${climate.enso[f] > 0 ? '+' : ''}${climate.enso[f].toFixed(2)}`,
      spoken: `ENSO index ${climate.enso[f].toFixed(2)}`,
    },
    iod: {
      short: `IOD ${climate.iod[f] > 0 ? '+' : ''}${climate.iod[f].toFixed(2)}`,
      spoken: `Indian Ocean Dipole index ${climate.iod[f].toFixed(2)}`,
    },
    co: { short: `${Math.round(co[f])} ppb`, spoken: `carbon monoxide ${Math.round(co[f])} parts per billion` },
  }

  return (
    <section className={styles.layers} aria-labelledby="layers-heading" data-tour="layers">
      <h2 id="layers-heading" className="eyebrow">
        Sound layer controls
      </h2>
      <ul className={styles.list}>
        {LAYERS.map(({ id, name, instrument, mapping, color }) => {
          const on = layers[id]
          const lvl = on ? Math.min(1, Math.max(0, level(id))) : 0
          return (
            <li key={id}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                className={styles.row}
                style={{ '--c': color } as CSSProperties}
                onClick={() => onToggle(id)}
                title={mapping}
                aria-label={`${name}, played by ${instrument.toLowerCase()}. ${mapping}`}
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
      <p className={styles.note}>Goong marks every 1-year interval during playback.</p>
    </section>
  )
}
