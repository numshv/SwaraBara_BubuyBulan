import { LAT0, LON0, DLAT, DLON, NX, NY } from '../data/aerosol'
import type { FrameData } from '../data/generate'
import type { Placement, View } from './projection'
import { projection } from './projection'

/**
 * A faint, steady orange light over areas with many intense fires (dramatic mode).
 * Built from monthly fire density on the aerosol grid and blended smoothly between months,
 * so it swells and fades with the season instead of popping with each new fire.
 */
export class GlowRenderer {
  private grids: Float32Array[]
  private raster = document.createElement('canvas')
  private out = document.createElement('canvas')
  private key = ''

  constructor(frames: FrameData[]) {
    const raw = frames.map((fr) => {
      const g = new Float32Array(NX * NY)
      for (const d of fr.dots) {
        const ci = Math.round((d.longitude - LON0) / DLON)
        const cj = Math.round((d.latitude - LAT0) / DLAT)
        const w = Math.sqrt(d.frp) * (0.5 + d.intensity)
        for (let j = Math.max(0, cj - 2); j <= Math.min(NY - 1, cj + 2); j++) {
          for (let i = Math.max(0, ci - 2); i <= Math.min(NX - 1, ci + 2); i++) {
            const dx = (LON0 + i * DLON - d.longitude) / 0.5
            const dy = (LAT0 + j * DLAT - d.latitude) / 0.5
            g[j * NX + i] += w * Math.exp(-(dx * dx + dy * dy) / 2)
          }
        }
      }
      return g
    })
    // Smooth across months so a single busy month doesn't flash on and off.
    this.grids = raw.map((g, f) => {
      const prev = raw[f - 1] ?? g
      return g.map((v, k) => 0.65 * v + 0.35 * prev[k])
    })
    const max = this.grids.reduce((m, g) => Math.max(m, ...g), 1e-6)
    for (const g of this.grids) for (let k = 0; k < g.length; k++) g[k] /= max
    this.raster.width = NX
    this.raster.height = NY
  }

  private value(t: number, k: number): number {
    const last = this.grids.length - 1
    const i = Math.min(Math.max(Math.floor(t), 0), last)
    const j = Math.min(i + 1, last)
    const e = Math.min(1, Math.max(0, t - Math.floor(t)))
    return this.grids[i][k] * (1 - e) + this.grids[j][k] * e
  }

  /** Returns a blurred, screen-sized glow image, rebuilt only when month, zoom or size change. */
  render(t: number, view: View, place: Placement, width: number, height: number, dpr: number): HTMLCanvasElement {
    const key = `${Math.round(t * 50)}|${view.k.toFixed(3)}|${view.x.toFixed(1)}|${view.y.toFixed(1)}|${place.ox.toFixed(1)}|${place.oy.toFixed(1)}|${place.s.toFixed(4)}|${width}|${height}`
    if (key === this.key) return this.out
    this.key = key

    const rctx = this.raster.getContext('2d')!
    const img = rctx.createImageData(NX, NY)
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const v = this.value(t, j * NX + i)
        const o = ((NY - 1 - j) * NX + i) * 4
        img.data[o] = 255
        img.data[o + 1] = 112
        img.data[o + 2] = 44
        // Only real hotspots light up; scattered fires stay dark.
        img.data[o + 3] = Math.round(Math.pow(v, 1.5) * 0.32 * 255)
      }
    }
    rctx.putImageData(img, 0, 0)

    this.out.width = width
    this.out.height = height
    const ctx = this.out.getContext('2d')!
    ctx.setTransform(dpr * place.s, 0, 0, dpr * place.s, dpr * place.ox, dpr * place.oy)
    const nw = projection([LON0 - DLON / 2, LAT0 + (NY - 0.5) * DLAT])!
    const se = projection([LON0 + (NX - 0.5) * DLON, LAT0 - DLAT / 2])!
    ctx.filter = `blur(${Math.round(16 * Math.sqrt(view.k) * dpr)}px)`
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(this.raster, view.x + nw[0] * view.k, view.y + nw[1] * view.k, (se[0] - nw[0]) * view.k, (se[1] - nw[1]) * view.k)
    return this.out
  }
}
