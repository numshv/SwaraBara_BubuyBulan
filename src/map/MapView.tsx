import { geoCentroid } from 'd3-geo'
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { AerosolField } from '../data/aerosol'
import type { FrameData } from '../data/generate'
import { neighbours, provinces } from '../data/geo'
import { REGIONS, type RegionId, type SongId } from '../data/regions'
import { drawFires } from './fireLayer'
import { SmokeRenderer } from './smokeLayer'
import { VH, VW, fit, lerpView, path, toView, viewFor, type View } from './projection'
import styles from './MapView.module.css'

interface Props {
  song: SongId
  frames: FrameData[]
  t: number
  dateLabel: string
  wildfireOn: boolean
  aerosol: AerosolField
  smokeOn: boolean
  reducedMotion: boolean
  onOpenRegion: (id: RegionId) => void
  onExploreRegion: (id: RegionId) => void
}

const provincePaths = provinces.map((p) => ({ name: p.properties.name, region: p.properties.region, d: path(p) ?? '' }))
const neighbourPath = neighbours.map((n) => path(n) ?? '').join('')
const provinceCentroids = provinces.map((p) => ({
  name: p.properties.name,
  region: p.properties.region,
  at: geoCentroid(p) as [number, number],
}))

export function MapView({
  song, frames, t, dateLabel, wildfireOn, aerosol, smokeOn, reducedMotion, onOpenRegion, onExploreRegion,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const smokeRef = useRef<HTMLCanvasElement>(null)
  const tRef = useRef(t)
  tRef.current = t
  const labelRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [size, setSize] = useState({ w: VW, h: VH })
  const [view, setView] = useState<View>(() => viewFor(song))
  const [hover, setHover] = useState<RegionId | null>(null)
  const [rovingIndex, setRovingIndex] = useState(0)
  const viewRef = useRef(view)
  viewRef.current = view

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Animated zoom between Indonesia and an island.
  useEffect(() => {
    const from = viewRef.current
    const to = viewFor(song)
    if (reducedMotion) {
      setView(to)
      return
    }
    const start = performance.now()
    const duration = 900
    let raf = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
      setView(lerpView(from, to, e))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [song, reducedMotion])

  useEffect(() => {
    if (canvasRef.current) drawFires(canvasRef.current, frames, t, view)
  }, [frames, t, view, size])

  // Smoke runs on its own loop so it keeps drifting while playback is paused.
  const smoke = useMemo(() => new SmokeRenderer(aerosol), [aerosol])
  useEffect(() => {
    const canvas = smokeRef.current
    if (!canvas || !smokeOn) return
    if (reducedMotion) {
      smoke.draw(canvas, tRef.current, viewRef.current, 0, false)
      return
    }
    let raf = 0
    let prev = performance.now()
    const loop = (now: number) => {
      smoke.draw(canvas, tRef.current, viewRef.current, Math.min(0.1, (now - prev) / 1000), true)
      prev = now
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [smoke, smokeOn, reducedMotion])

  // Reduced motion: no loop, so redraw the still haze whenever the month or zoom changes.
  useEffect(() => {
    if (reducedMotion && smokeOn && smokeRef.current) smoke.draw(smokeRef.current, t, view, 0, false)
  }, [reducedMotion, smokeOn, smoke, t, view, size])

  const { s, ox, oy } = fit(size.w, size.h)
  const toScreen = (p: [number, number]) => ({ left: ox + p[0] * s, top: oy + p[1] * s })
  const national = song === 'indonesia'
  const activeRegion = national ? hover : song

  function onLabelKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    let next: number | null = null
    if (delta) next = (i + delta + REGIONS.length) % REGIONS.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = REGIONS.length - 1
    if (next === null) return
    e.preventDefault()
    e.stopPropagation()
    setRovingIndex(next)
    labelRefs.current[next]?.focus()
  }

  return (
    <div className={styles.map} ref={boxRef}>
      <MapBase view={view} active={activeRegion} song={song} onHover={setHover} onOpen={onOpenRegion} />
      <canvas ref={smokeRef} className={styles.smoke} style={{ opacity: smokeOn ? 1 : 0 }} aria-hidden="true" />
      <canvas ref={canvasRef} className={styles.fires} style={{ opacity: wildfireOn ? 1 : 0.25 }} aria-hidden="true" />

      {!national && (
        <div className={styles.provinceLabels} aria-hidden="true">
          {provinceCentroids
            .filter((p) => p.region === song)
            .map((p) => (
              <span key={p.name} style={toScreen(toView(p.at, view))}>
                {p.name}
              </span>
            ))}
        </div>
      )}

      {national && (
        <div
          className={styles.labels}
          role="group"
          aria-label="Regions of Indonesia. Use arrow keys to move between regions and hear this month's fires, Enter to open a region's own fire story."
          data-tour="map"
        >
          {REGIONS.map((r, i) => (
            <button
              key={r.id}
              ref={(el) => {
                labelRefs.current[i] = el
              }}
              type="button"
              className={styles.label}
              data-active={hover === r.id || undefined}
              style={toScreen(toView(r.label, view))}
              tabIndex={i === rovingIndex ? 0 : -1}
              aria-keyshortcuts={r.key}
              onClick={() => onOpenRegion(r.id)}
              onKeyDown={(e) => onLabelKey(e, i)}
              onFocus={() => {
                setRovingIndex(i)
                setHover(r.id)
                onExploreRegion(r.id)
              }}
              onBlur={() => setHover(null)}
              onPointerEnter={() => setHover(r.id)}
              onPointerLeave={() => setHover(null)}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}

      <p className={styles.date} aria-hidden="true">
        {dateLabel}
      </p>
    </div>
  )
}

interface BaseProps {
  view: View
  active: RegionId | null
  song: SongId
  onHover: (id: RegionId | null) => void
  onOpen: (id: RegionId) => void
}

/** Land shapes only, memoised so they don't re-render on every playback tick. */
const MapBase = memo(function MapBase({ view, active, song, onHover, onOpen }: BaseProps) {
  const national = song === 'indonesia'
  const byRegion = useMemo(() => {
    const groups = new Map<RegionId, string[]>()
    for (const p of provincePaths) groups.set(p.region, [...(groups.get(p.region) ?? []), p.d])
    return groups
  }, [])

  return (
    <svg className={styles.svg} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
        <path d={neighbourPath} className={styles.neighbour} vectorEffect="non-scaling-stroke" />
        {REGIONS.map((r) => {
          const dim = (national && active && active !== r.id) || (!national && song !== r.id)
          return (
            // Pointer shortcut only; the keyboard equivalent is the region's label button.
            <g
              key={r.id}
              className={styles.region}
              data-active={active === r.id || undefined}
              data-dim={dim || undefined}
              data-clickable={national || undefined}
              onPointerEnter={national ? () => onHover(r.id) : undefined}
              onPointerLeave={national ? () => onHover(null) : undefined}
              onClick={national ? () => onOpen(r.id) : undefined}
            >
              {byRegion.get(r.id)?.map((d, i) => (
                <path key={i} d={d} vectorEffect="non-scaling-stroke" />
              ))}
            </g>
          )
        })}
      </g>
    </svg>
  )
})
