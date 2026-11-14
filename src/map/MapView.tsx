import { geoCentroid } from 'd3-geo'
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { AerosolField } from '../data/aerosol'
import type { FrameData } from '../data/generate'
import { neighbours, provinces } from '../data/geo'
import { REGIONS, type RegionId, type SongId } from '../data/regions'
import { EmberSystem, drawFires } from './fireLayer'
import { GlowRenderer } from './glowLayer'
import { ScarRenderer } from './scarLayer'
import { SmokeRenderer } from './smokeLayer'
import { VH, VW, fit, lerpView, path, toView, viewFor, type Placement, type View } from './projection'
import styles from './MapView.module.css'

interface Props {
  song: SongId
  frames: FrameData[]
  t: number
  wildfireOn: boolean
  aerosol: AerosolField
  smokeOn: boolean
  /** Experiment: burn scars, hotspot glow, sparks, darker smoke. */
  dramatic: boolean
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
  song, frames, t, wildfireOn, aerosol, smokeOn, dramatic, reducedMotion, onOpenRegion, onExploreRegion,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const smokeRef = useRef<HTMLCanvasElement>(null)
  const scarRef = useRef<HTMLCanvasElement>(null)
  const tRef = useRef(t)
  tRef.current = t
  const labelRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [geom, setGeom] = useState({ w: VW, h: VH, left: 0, top: 0, vw: VW, vh: VH })
  const wide = useWide()
  const [view, setView] = useState<View>(() => viewFor(song))
  const [hover, setHover] = useState<RegionId | null>(null)
  const [rovingIndex, setRovingIndex] = useState(0)
  const viewRef = useRef(view)
  viewRef.current = view

  // Track the map box and where it sits on screen: on wide screens the drawing surface
  // extends to the whole viewport, so the map continues under the surrounding UI.
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      // clientWidth/Height exclude scrollbars, so the surface never causes its own overflow.
      const doc = document.documentElement
      setGeom({ w: r.width, h: r.height, left: r.left, top: r.top, vw: doc.clientWidth, vh: doc.clientHeight })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const base = fit(geom.w, geom.h)
  const surface = wide
    ? { left: -geom.left, top: -geom.top, width: geom.vw, height: geom.vh }
    : { left: 0, top: 0, width: geom.w, height: geom.h }
  const place: Placement = { s: base.s, ox: base.ox - surface.left, oy: base.oy - surface.top }
  const placeRef = useRef(place)
  placeRef.current = place
  const viewBox = `${-place.ox / place.s} ${-place.oy / place.s} ${surface.width / place.s} ${surface.height / place.s}`

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

  // Fire: dramatic mode with motion runs its own loop (flicker, sparks); otherwise draw on change.
  const scars = useMemo(() => new ScarRenderer(), [])
  const embers = useMemo(() => new EmberSystem(), [])
  const framesRef = useRef(frames)
  framesRef.current = frames
  const animateFire = dramatic && !reducedMotion
  const glow = useMemo(() => new GlowRenderer(frames), [frames])
  const glowImage = (canvas: HTMLCanvasElement, time: number, v: View) => {
    const dpr = window.devicePixelRatio || 1
    return glow.render(time, v, placeRef.current, Math.round(canvas.clientWidth * dpr), Math.round(canvas.clientHeight * dpr), dpr)
  }
  useEffect(() => {
    scars.reset()
    embers.clear()
  }, [frames, scars, embers])
  useEffect(() => {
    if (animateFire) return
    if (dramatic && scarRef.current) scars.draw(scarRef.current, frames, t, view, placeRef.current)
    if (canvasRef.current) {
      const glowCanvas = dramatic ? glowImage(canvasRef.current, t, view) : null
      drawFires(canvasRef.current, frames, t, view, placeRef.current, { dramatic, time: 0, dt: 0, embers: null, glow: glowCanvas })
    }
    // glowImage only reads refs and the memoised renderer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animateFire, dramatic, scars, glow, frames, t, view, geom, wide])
  useEffect(() => {
    if (!animateFire) return
    let raf = 0
    let prev = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - prev) / 1000)
      prev = now
      if (scarRef.current) scars.draw(scarRef.current, framesRef.current, tRef.current, viewRef.current, placeRef.current)
      if (canvasRef.current) {
        drawFires(canvasRef.current, framesRef.current, tRef.current, viewRef.current, placeRef.current, {
          dramatic: true,
          time: now / 1000,
          dt,
          embers,
          glow: glowImage(canvasRef.current, tRef.current, viewRef.current),
        })
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // glowImage only reads refs and the memoised renderer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animateFire, scars, embers, glow])

  // Smoke runs on its own loop so it keeps drifting while playback is paused.
  const smoke = useMemo(() => new SmokeRenderer(aerosol), [aerosol])
  useEffect(() => {
    const canvas = smokeRef.current
    if (!canvas || !smokeOn) return
    if (reducedMotion) {
      smoke.draw(canvas, tRef.current, viewRef.current, placeRef.current, 0, false, dramatic)
      return
    }
    let raf = 0
    let prev = performance.now()
    const loop = (now: number) => {
      smoke.draw(canvas, tRef.current, viewRef.current, placeRef.current, Math.min(0.1, (now - prev) / 1000), true, dramatic)
      prev = now
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [smoke, smokeOn, reducedMotion, dramatic])

  // Reduced motion: no loop, so redraw the still haze whenever the month or zoom changes.
  useEffect(() => {
    if (reducedMotion && smokeOn && smokeRef.current) smoke.draw(smokeRef.current, t, view, placeRef.current, 0, false, dramatic)
  }, [reducedMotion, smokeOn, smoke, t, view, geom, wide, dramatic])

  const { s, ox, oy } = base
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
    <div className={styles.map} ref={boxRef} data-wide={wide || undefined}>
      <div className={styles.surface} style={surface}>
        <MapBase view={view} viewBox={viewBox} active={activeRegion} song={song} onHover={setHover} onOpen={onOpenRegion} />
        <canvas
          ref={scarRef}
          className={styles.scars}
          style={{ opacity: dramatic ? (wildfireOn ? 1 : 0.25) : 0 }}
          aria-hidden="true"
        />
        <canvas ref={smokeRef} className={styles.smoke} style={{ opacity: smokeOn ? 1 : 0 }} aria-hidden="true" />
        <canvas ref={canvasRef} className={styles.fires} style={{ opacity: wildfireOn ? 1 : 0.25 }} aria-hidden="true" />
        {/* Fades the map into the page towards the screen edges, under the surrounding UI. */}
        <div className={styles.vignette} aria-hidden="true" />
      </div>

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

    </div>
  )
}

interface BaseProps {
  view: View
  viewBox: string
  active: RegionId | null
  song: SongId
  onHover: (id: RegionId | null) => void
  onOpen: (id: RegionId) => void
}

/** Land shapes only, memoised so they don't re-render on every playback tick. */
const MapBase = memo(function MapBase({ view, viewBox, active, song, onHover, onOpen }: BaseProps) {
  const national = song === 'indonesia'
  const byRegion = useMemo(() => {
    const groups = new Map<RegionId, string[]>()
    for (const p of provincePaths) groups.set(p.region, [...(groups.get(p.region) ?? []), p.d])
    return groups
  }, [])

  return (
    <svg className={styles.svg} viewBox={viewBox} preserveAspectRatio="none" aria-hidden="true">
      <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
        <path d={neighbourPath} className={styles.neighbour} vectorEffect="non-scaling-stroke" />
        {REGIONS.map((r) => {
          const dim = national && active && active !== r.id
          const away = !national && song !== r.id
          return (
            // Pointer shortcut only; the keyboard equivalent is the region's label button.
            <g
              key={r.id}
              className={styles.region}
              data-active={active === r.id || undefined}
              data-dim={dim || undefined}
              data-away={away || undefined}
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

const WIDE_QUERY = '(min-width: 1024px)'

/** Full-bleed map only on the desktop layout; the stacked mobile layout keeps it in its box. */
function useWide(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(WIDE_QUERY)
    const onChange = () => setWide(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return wide
}
