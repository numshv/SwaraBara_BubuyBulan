import type { FrameData } from '../data/generate'
import { fit, projection, type View } from './projection'

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

let sprites: HTMLCanvasElement[] | null = null

/** How many months a dot keeps glowing after it appears. */
const FADE_MONTHS = 2.5

export function drawFires(canvas: HTMLCanvasElement, frames: FrameData[], t: number, view: View) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  sprites ??= Array.from({ length: BUCKETS }, (_, i) => makeSprite(i / (BUCKETS - 1)))

  const dpr = window.devicePixelRatio || 1
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const { s, ox, oy } = fit(w, h)
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy)
  ctx.globalCompositeOperation = 'lighter'
  const sizeScale = Math.sqrt(view.k)

  const cur = Math.floor(t)
  for (let f = Math.max(0, cur - Math.ceil(FADE_MONTHS)); f <= Math.min(cur, frames.length - 1); f++) {
    for (const d of frames[f].dots) {
      const age = t - (f + d.offset)
      if (age < 0) break // dots are sorted by offset
      const alpha = age < 0.15 ? age / 0.15 : Math.max(0, 1 - (age - 0.15) / FADE_MONTHS)
      if (alpha <= 0) continue
      const p = projection([d.longitude, d.latitude])
      if (!p) continue
      const x = view.x + p[0] * view.k
      const y = view.y + p[1] * view.k
      const r = (2.2 + Math.sqrt(d.frp) * 0.7) * sizeScale
      ctx.globalAlpha = alpha * (0.55 + d.intensity * 0.45)
      ctx.drawImage(sprites[Math.round(d.intensity * (BUCKETS - 1))], x - r, y - r, r * 2, r * 2)
    }
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}
