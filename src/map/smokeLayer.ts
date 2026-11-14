import { mulberry32 } from '../data/generate'
import { LAT0, LON0, DLAT, DLON, NX, NY, aodBlend, cellIndex, windAt, type AerosolField } from '../data/aerosol'
import { projection, type Placement, type View } from './projection'

type RGB = [number, number, number]
/** Warm grey, like wildfire smoke rather than cloud. */
const SMOKE: RGB = [196, 188, 176]
/** Dramatic mode: heavier, sepia-brown smoke. */
const SMOKE_DRAMATIC: RGB = [138, 104, 78]
const MAX_PUFFS = 1200
/** Puffs only rise from cells hazier than this. */
const PUFF_THRESHOLD = 0.35
/** Visual drift speed in degrees per second for a unit wind vector. */
const DRIFT = 0.28
/** Haze and spawn weights are rebuilt only when the playhead moves this far (months). */
const T_EPSILON = 0.02

/** Thin the smoke when zoomed in, so island labels and borders stay readable. */
const zoomFade = (k: number) => 1 / (1 + 0.15 * (k - 1))

interface Puff {
  lon: number
  lat: number
  age: number
  life: number
  /** Radius in degrees; grows over the puff's life. */
  r0: number
  alpha: number
  seed: number
  sprite: number
}

/** A lumpy cloud made of overlapping soft blobs, so puffs billow instead of looking like discs. */
function makeCloudSprite(seed: number, [r, g, b]: RGB): HTMLCanvasElement {
  const size = 96
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const rand = mulberry32(seed)
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2
    const d = rand() * size * 0.18
    const x = size / 2 + Math.cos(a) * d
    const y = size / 2 + Math.sin(a) * d
    const rad = size * (0.16 + rand() * 0.16)
    const grad = ctx.createRadialGradient(x, y, 0, x, y, rad)
    grad.addColorStop(0, `rgba(${r},${g},${b},0.5)`)
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
  }
  return c
}

/**
 * Two layers: a blurred AOD raster (the extent of the haze, also the reduced-motion fallback)
 * and drifting puffs released where AOD is high, carried by the month's wind.
 */
export class SmokeRenderer {
  private puffs: Puff[] = []
  private raster = document.createElement('canvas')
  private haze = document.createElement('canvas')
  private hazeKey = ''
  private sprites = [11, 23, 37, 51].map((s) => makeCloudSprite(s, SMOKE))
  private dramaticSprites = [11, 23, 37, 51].map((s) => makeCloudSprite(s, SMOKE_DRAMATIC))
  private dramatic = false
  private weights = new Float32Array(NX * NY)
  private totalWeight = 0
  private weightsT = Number.NaN
  private lastT = Number.NaN

  constructor(private field: AerosolField) {
    this.raster.width = NX
    this.raster.height = NY
  }

  private updateWeights(t: number) {
    if (Math.abs(t - this.weightsT) < T_EPSILON) return
    this.weightsT = t
    this.totalWeight = 0
    for (let k = 0; k < this.weights.length; k++) {
      const v = aodBlend(this.field, t, k) - PUFF_THRESHOLD
      const w = v > 0 ? Math.pow(v, 1.3) : 0
      this.weights[k] = w
      this.totalWeight += w
    }
  }

  /** Rebuilds the blurred haze only when the month, zoom or canvas size changes. */
  private updateHaze(t: number, view: View, place: Placement, width: number, height: number, dpr: number) {
    const key = `${this.dramatic}|${Math.round(t / T_EPSILON)}|${view.k.toFixed(3)}|${view.x.toFixed(1)}|${view.y.toFixed(1)}|${place.ox.toFixed(1)}|${place.oy.toFixed(1)}|${place.s.toFixed(4)}|${width}|${height}`
    if (key === this.hazeKey) return
    this.hazeKey = key

    const rctx = this.raster.getContext('2d')!
    const img = rctx.createImageData(NX, NY)
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const aod = aodBlend(this.field, t, cellIndex(i, j))
        // Canvas rows run north to south; the grid runs south to north.
        const o = ((NY - 1 - j) * NX + i) * 4
        const [r, g, b] = this.dramatic ? SMOKE_DRAMATIC : SMOKE
        img.data[o] = r
        img.data[o + 1] = g
        img.data[o + 2] = b
        img.data[o + 3] = Math.round(Math.min(1, Math.max(0, (aod - 0.2) / 2.8)) * (this.dramatic ? 150 : 90))
      }
    }
    rctx.putImageData(img, 0, 0)

    this.haze.width = width
    this.haze.height = height
    const ctx = this.haze.getContext('2d')!
    const { s, ox, oy } = place
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy)
    // The grid is near-equirectangular at these latitudes, so its corners are enough.
    const nw = projection([LON0 - DLON / 2, LAT0 + (NY - 0.5) * DLAT])!
    const se = projection([LON0 + (NX - 0.5) * DLON, LAT0 - DLAT / 2])!
    ctx.filter = `blur(${Math.round(12 * Math.sqrt(view.k) * dpr)}px)`
    ctx.imageSmoothingEnabled = true
    ctx.globalAlpha = zoomFade(view.k)
    ctx.drawImage(
      this.raster,
      view.x + nw[0] * view.k,
      view.y + nw[1] * view.k,
      (se[0] - nw[0]) * view.k,
      (se[1] - nw[1]) * view.k,
    )
  }

  private spawn(t: number, dt: number) {
    this.updateWeights(t)
    const total = this.totalWeight
    if (total <= 0) return
    // Target population scales with how much haze there is; puffs live ~7 s.
    const target = Math.min(MAX_PUFFS, total * 8)
    let n = (target / 7) * dt
    while (n > 0 && this.puffs.length < MAX_PUFFS) {
      if (n < 1 && Math.random() > n) break
      n -= 1
      let r = Math.random() * total
      let k = 0
      while (k < this.weights.length - 1 && r > this.weights[k]) r -= this.weights[k++]
      const aod = aodBlend(this.field, t, k)
      const i = k % NX
      const j = Math.floor(k / NX)
      this.puffs.push({
        lon: LON0 + (i + Math.random() - 0.5) * DLON,
        lat: LAT0 + (j + Math.random() - 0.5) * DLAT,
        age: 0,
        life: 5 + Math.random() * 4,
        r0: 0.4 + Math.random() * 0.35 + Math.min(aod, 3) * 0.12,
        alpha: 0.05 + Math.min(aod, 3) * 0.03,
        seed: Math.random() * 100,
        sprite: Math.floor(Math.random() * this.sprites.length),
      })
    }
  }

  /** dt in seconds of wall time; pass animate=false for a still frame (reduced motion). */
  draw(canvas: HTMLCanvasElement, t: number, view: View, place: Placement, dt: number, animate: boolean, dramatic = false) {
    this.dramatic = dramatic
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(canvas.clientWidth * dpr)
    const h = Math.round(canvas.clientHeight * dpr)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, w, h)

    this.updateHaze(t, view, place, w, h, dpr)
    ctx.drawImage(this.haze, 0, 0)

    if (!animate) {
      this.puffs = []
      return
    }

    const { s, ox, oy } = place
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy)
    // A seek or song change: let the old smoke clear quickly instead of drifting on for seconds.
    if (Math.abs(t - this.lastT) > 1) for (const p of this.puffs) p.life = Math.min(p.life, p.age + 0.6)
    this.lastT = t
    this.spawn(t, dt)
    const [wx, wy] = windAt(this.field, t)
    const pxPerDeg = (projection([1, 0])![0] - projection([0, 0])![0]) * view.k
    const fade = zoomFade(view.k) * (dramatic ? 1.6 : 1)
    const sprites = dramatic ? this.dramaticSprites : this.sprites
    const alive: Puff[] = []
    for (const p of this.puffs) {
      p.age += dt
      if (p.age >= p.life) continue
      // Drift with the wind plus a slow sideways curl so the smoke billows rather than slides.
      const curl = Math.sin(p.seed + p.age * 0.8) * 0.12
      p.lon += (wx * DRIFT - wy * curl) * dt
      p.lat += (wy * DRIFT + wx * curl) * dt
      const q = projection([p.lon, p.lat])
      if (!q) continue
      const life = p.age / p.life
      const r = p.r0 * (1 + life * 1.6) * pxPerDeg
      ctx.globalAlpha = p.alpha * fade * Math.sin(Math.PI * life)
      ctx.drawImage(sprites[p.sprite], view.x + q[0] * view.k - r, view.y + q[1] * view.k - r, r * 2, r * 2)
      alive.push(p)
    }
    ctx.globalAlpha = 1
    this.puffs = alive
  }
}
