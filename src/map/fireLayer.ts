import type { FrameData } from '../data/generate'
import { projection, type Placement, type View } from './projection'

const SPRITE = 64
const BUCKETS = 8

/** Ember glow: deep red-orange through amber to near-white at the hottest. */
function makeSprite(intensity: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = SPRITE
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2)
  const core = intensity > 0.75 ? '255,240,205' : intensity > 0.45 ? '255,200,110' : intensity > 0.2 ? '255,140,60' : '235,90,45'
  g.addColorStop(0, `rgba(${core},1)`)
  g.addColorStop(0.18, `rgba(${core},0.95)`)
  g.addColorStop(0.35, 'rgba(255,106,61,0.45)')
  g.addColorStop(1, 'rgba(255,90,40,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, SPRITE, SPRITE)
  return c
}

function makeSparkSprite(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = 16
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8)
  g.addColorStop(0, 'rgba(255,230,170,1)')
  g.addColorStop(0.4, 'rgba(255,140,50,0.8)')
  g.addColorStop(1, 'rgba(255,80,20,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 16, 16)
  return c
}

let sprites: HTMLCanvasElement[] | null = null
let sparkSprite: HTMLCanvasElement | null = null

/** How many months a dot keeps glowing after it appears. */
const FADE_MONTHS = 2.5
const MAX_SPARKS = 500

interface Spark {
  lon: number
  lat: number
  vlon: number
  vlat: number
  age: number
  life: number
  size: number
}

/** Sparks thrown off by the hottest fires, rising north-ish and dying out within a second or two. */
export class EmberSystem {
  sparks: Spark[] = []

  spawnFrom(lon: number, lat: number, intensity: number, dt: number) {
    if (this.sparks.length >= MAX_SPARKS || Math.random() > intensity * 1.4 * dt) return
    this.sparks.push({
      lon,
      lat,
      vlon: (Math.random() - 0.5) * 0.25,
      vlat: 0.15 + Math.random() * 0.25,
      age: 0,
      life: 0.7 + Math.random() * 1.1,
      size: 0.7 + Math.random() * 1.1,
    })
  }

  clear() {
    this.sparks = []
  }
}

export interface FireFx {
  /** Area glow, gentle shimmer, sparks. */
  dramatic: boolean
  /** Wall-clock seconds, drives flicker. */
  time: number
  /** Seconds since the last frame; 0 for a still frame. */
  dt: number
  /** Present only when sparks should animate. */
  embers: EmberSystem | null
  /** Pre-rendered area glow (screen-sized, device pixels), drawn first. */
  glow?: HTMLCanvasElement | null
}

const STILL: FireFx = { dramatic: false, time: 0, dt: 0, embers: null }

export function drawFires(
  canvas: HTMLCanvasElement,
  frames: FrameData[],
  t: number,
  view: View,
  place: Placement,
  fx: FireFx = STILL,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  sprites ??= Array.from({ length: BUCKETS }, (_, i) => makeSprite(i / (BUCKETS - 1)))
  sparkSprite ??= makeSparkSprite()

  const dpr = window.devicePixelRatio || 1
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  ctx.globalCompositeOperation = 'lighter'
  if (fx.dramatic && fx.glow) ctx.drawImage(fx.glow, 0, 0)

  const { s, ox, oy } = place
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy)
  const sizeScale = Math.sqrt(view.k)

  const cur = Math.floor(t)
  const visible: { x: number; y: number; r: number; alpha: number; intensity: number; lon: number; lat: number }[] = []
  for (let f = Math.max(0, cur - Math.ceil(FADE_MONTHS)); f <= Math.min(cur, frames.length - 1); f++) {
    for (const d of frames[f].dots) {
      const age = t - (f + d.offset)
      if (age < 0) break // dots are sorted by offset
      let alpha = age < 0.15 ? age / 0.15 : Math.max(0, 1 - (age - 0.15) / FADE_MONTHS)
      if (alpha <= 0) continue
      const p = projection([d.longitude, d.latitude])
      if (!p) continue
      if (fx.dramatic && fx.dt > 0) {
        // A barely-there shimmer, each fire on its own phase.
        alpha *= 0.94 + 0.06 * Math.sin(fx.time * 4 + d.longitude * 97 + d.latitude * 61)
      }
      visible.push({
        x: view.x + p[0] * view.k,
        y: view.y + p[1] * view.k,
        r: (2.2 + Math.sqrt(d.frp) * 0.7) * sizeScale,
        alpha,
        intensity: d.intensity,
        lon: d.longitude,
        lat: d.latitude,
      })
    }
  }

  for (const v of visible) {
    ctx.globalAlpha = v.alpha * (0.55 + v.intensity * 0.45)
    ctx.drawImage(sprites[Math.round(v.intensity * (BUCKETS - 1))], v.x - v.r, v.y - v.r, v.r * 2, v.r * 2)
  }

  const embers = fx.dramatic ? fx.embers : null
  if (embers) {
    for (const v of visible) if (v.intensity > 0.55 && v.alpha > 0.4) embers.spawnFrom(v.lon, v.lat, v.intensity, fx.dt)
    const alive: Spark[] = []
    for (const sp of embers.sparks) {
      sp.age += fx.dt
      if (sp.age >= sp.life) continue
      sp.lon += sp.vlon * fx.dt
      sp.lat += sp.vlat * fx.dt
      const p = projection([sp.lon, sp.lat])
      if (!p) continue
      const r = sp.size * sizeScale
      ctx.globalAlpha = 1 - sp.age / sp.life
      ctx.drawImage(sparkSprite, view.x + p[0] * view.k - r, view.y + p[1] * view.k - r, r * 2, r * 2)
      alive.push(sp)
    }
    embers.sparks = alive
  }

  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}
