import type { FrameData } from '../data/generate'
import { projection, type Placement, type View } from './projection'

/** Charred-earth stamp: ash-black, with only a hint of warmth so it reads as burnt land, not fire. */
function makeScarSprite(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(4,3,2,1)')
  g.addColorStop(0.5, 'rgba(14,9,7,0.7)')
  g.addColorStop(0.85, 'rgba(26,14,10,0.2)')
  g.addColorStop(1, 'rgba(26,14,10,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return c
}

/** Each stamp is faint; scars only turn black where fires return year after year. */
const SCAR_ALPHA = 0.16

/**
 * Burn scars: every fire leaves a permanent dark mark, so the land visibly accumulates damage
 * over the eight years. Drawn incrementally while playing forward; redrawn on seek, zoom or resize.
 */
export class ScarRenderer {
  private sprite = makeScarSprite()
  private key = ''
  private lastT = 0

  draw(canvas: HTMLCanvasElement, frames: FrameData[], t: number, view: View, place: Placement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(canvas.clientWidth * dpr)
    const h = Math.round(canvas.clientHeight * dpr)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    const key = `${view.k}|${view.x}|${view.y}|${place.ox}|${place.oy}|${place.s}|${w}|${h}|${frames.length}|${frames[0]?.dots.length}`
    let from = this.lastT
    if (key !== this.key || t < this.lastT) {
      this.key = key
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, w, h)
      from = -1
    }
    if (t <= from) return

    ctx.setTransform(dpr * place.s, 0, 0, dpr * place.s, dpr * place.ox, dpr * place.oy)
    ctx.globalAlpha = SCAR_ALPHA
    const sizeScale = Math.sqrt(view.k)
    const first = Math.max(0, Math.floor(from))
    const last = Math.min(Math.floor(t), frames.length - 1)
    for (let f = first; f <= last; f++) {
      for (const d of frames[f].dots) {
        const at = f + d.offset
        if (at > t) break // dots are sorted by offset
        if (at <= from) continue
        const p = projection([d.longitude, d.latitude])
        if (!p) continue
        const r = (2.2 + Math.sqrt(d.frp) * 0.7) * sizeScale * 1.7
        ctx.drawImage(this.sprite, view.x + p[0] * view.k - r, view.y + p[1] * view.k - r, r * 2, r * 2)
      }
    }
    ctx.globalAlpha = 1
    this.lastT = t
  }

  /** Forget the cached canvas, e.g. when a different song's fires are shown. */
  reset() {
    this.key = ''
    this.lastT = 0
  }
}
