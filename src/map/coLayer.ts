import { DLAT, DLON, LAT0, LON0, NX, NY, cellIndex } from '../data/aerosol'
import { coBlend, type CoField } from '../data/co'
import { projection, type Placement, type View } from './projection'

/** The CO switch's purple. */
const CO_RGB = '146,79,191'
/** Contour levels in ppb, from the outer, faint ring to the bright core. */
export const CO_LEVELS = [250, 400, 600, 800]

/** Thin the CO when zoomed in, matching the aerosol smoke. */
const zoomFade = (k: number) => 1 / (1 + 0.15 * (k - 1))

/**
 * Carbon monoxide as thin purple isolines: a gas you can't see, drawn as lines so it never
 * muddies the aerosol smoke underneath.
 */
export class CoRenderer {
  constructor(private field: CoField) {}

  /** time (seconds) drives a slow breathing of the levels; pass 0 for a still frame. */
  draw(canvas: HTMLCanvasElement, t: number, view: View, place: Placement, time: number) {
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
    ctx.setTransform(dpr * place.s, 0, 0, dpr * place.s, dpr * place.ox, dpr * place.oy)

    const v = new Float32Array(NX * NY)
    for (let k = 0; k < v.length; k++) v[k] = coBlend(this.field, t, k)
    const fade = zoomFade(view.k)
    const toXY = (lon: number, lat: number): [number, number] => {
      const p = projection([lon, lat]) ?? [0, 0]
      return [view.x + p[0] * view.k, view.y + p[1] * view.k]
    }

    ctx.lineCap = 'round'
    CO_LEVELS.forEach((base, li) => {
      // A slow breathing of the level makes the rings creep in and out.
      const level = base * (1 + 0.025 * Math.sin(time * 0.7 + li))
      ctx.beginPath()
      // Marching squares on the grid.
      for (let j = 0; j < NY - 1; j++) {
        for (let i = 0; i < NX - 1; i++) {
          const k = cellIndex(i, j)
          const a = v[k]
          const b = v[k + 1]
          const c = v[k + 1 + NX]
          const d = v[k + NX]
          const idx = (a > level ? 1 : 0) | (b > level ? 2 : 0) | (c > level ? 4 : 0) | (d > level ? 8 : 0)
          if (idx === 0 || idx === 15) continue
          const lon = LON0 + i * DLON
          const lat = LAT0 + j * DLAT
          const lerp = (p: number, q: number) => (level - p) / (q - p)
          // Edge crossings: bottom (a-b), right (b-c), top (d-c), left (a-d).
          const pts: Record<string, [number, number]> = {
            B: toXY(lon + lerp(a, b) * DLON, lat),
            R: toXY(lon + DLON, lat + lerp(b, c) * DLAT),
            T: toXY(lon + lerp(d, c) * DLON, lat + DLAT),
            L: toXY(lon, lat + lerp(a, d) * DLAT),
          }
          for (const [p, q] of SEGMENTS[idx]) {
            ctx.moveTo(pts[p][0], pts[p][1])
            ctx.lineTo(pts[q][0], pts[q][1])
          }
        }
      }
      ctx.strokeStyle = `rgba(${CO_RGB},${(0.35 + li * 0.17) * fade})`
      ctx.lineWidth = (0.7 + li * 0.25) / place.s
      ctx.stroke()
    })
  }
}

/** Marching-squares segment table: which cell edges a contour crosses for each corner pattern. */
const SEGMENTS: [string, string][][] = [
  [], [['L', 'B']], [['B', 'R']], [['L', 'R']],
  [['R', 'T']], [['L', 'T'], ['B', 'R']], [['B', 'T']], [['L', 'T']],
  [['L', 'T']], [['B', 'T']], [['L', 'B'], ['R', 'T']], [['R', 'T']],
  [['L', 'R']], [['B', 'R']], [['L', 'B']], [],
]
