// Builds the compact JSON the app reads from the real NASA datasets in dataset_source/:
//  - VIIRS-cleaned-2018-2025.zip   NOAA-20 VIIRS fire detections (FIRMS)      -> src/data/real/fires.json
//  - merra2_aot_oc_indonesia_monthly.csv  MERRA-2 organic-carbon AOT per region -> src/data/real/aerosol.json
//  - co_merra2_monthly.csv         MERRA-2 CO per region                        -> src/data/real/co.json
//  - enso_iod.csv                  ENSO & IOD sea-level indices (weekly)        -> src/data/real/climate.json
// Run with: npm run data
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { geoBounds, geoContains } from 'd3-geo'

const SRC = 'dataset_source'
const OUT = 'src/data/real'
const START_YEAR = 2018
const END_YEAR = 2025
const MONTHS = (END_YEAR - START_YEAR + 1) * 12
/** One drawn dot stands for this many detections (keep in sync with DETECTIONS_PER_DOT). */
const PER_DOT = 60
const REGION_IDS = ['sumatra', 'kalimantan', 'java', 'sulawesi', 'bnt', 'maluku', 'papua']

mkdirSync(OUT, { recursive: true })

const frameOf = (y, m) => (y - START_YEAR) * 12 + (m - 1)
const r4 = (v) => Math.round(v * 1e4) / 1e4
const r3 = (v) => Math.round(v * 1e3) / 1e3

function readCsv(text) {
  const lines = text.trim().split(/\r?\n/)
  const head = lines[0].split(',')
  return lines.slice(1).map((l) => {
    const cells = l.split(',')
    return Object.fromEntries(head.map((h, i) => [h, cells[i]]))
  })
}

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------- Fires ----------
const provinces = JSON.parse(readFileSync('src/data/geo/indonesia.json', 'utf8')).features
const boxes = provinces.map((p) => geoBounds(p))
const centres = boxes.map(([[x0, y0], [x1, y1]]) => [(x0 + x1) / 2, (y0 + y1) / 2])

function provinceIndex(lon, lat) {
  for (let i = 0; i < provinces.length; i++) {
    const [[x0, y0], [x1, y1]] = boxes[i]
    if (lon < x0 || lon > x1 || lat < y0 || lat > y1) continue
    if (geoContains(provinces[i], [lon, lat])) return i
  }
  // Coastal pixels and small islets missing from the simplified outline: nearest province box within 0.5°.
  let best = -1
  let bestD = 0.5
  for (let i = 0; i < provinces.length; i++) {
    const [[x0, y0], [x1, y1]] = boxes[i]
    const dx = Math.max(x0 - lon, 0, lon - x1)
    const dy = Math.max(y0 - lat, 0, lat - y1)
    // Ties (inside several boxes) go to the closer box centre.
    const d = Math.hypot(dx, dy) + 1e-3 * Math.hypot(lon - centres[i][0], lat - centres[i][1])
    if (d < bestD) {
      best = i
      bestD = d
    }
  }
  return best
}

const zip = `${SRC}/VIIRS-cleaned-2018-2025.zip`
// groups[frame][province] = detections
const groups = Array.from({ length: MONTHS }, () => new Map())
let total = 0
let dropped = 0
for (let y = START_YEAR; y <= END_YEAR; y++) {
  const text = execFileSync('unzip', ['-p', zip, `viirs_clean/viirs_n20_indonesia_${y}_clean.csv`], {
    maxBuffer: 1 << 28,
  }).toString()
  const rows = readCsv(text)
  for (const r of rows) {
    const [yy, mm, dd] = r.acq_date.split('-').map(Number)
    const f = frameOf(yy, mm)
    if (f < 0 || f >= MONTHS) continue
    const lon = Number(r.longitude)
    const lat = Number(r.latitude)
    const p = provinceIndex(lon, lat)
    if (p < 0) {
      dropped++
      continue
    }
    total++
    const hhmm = Number(r.acq_time)
    // VIIRS overpasses are ~01:30 / ~13:30 local; UTC 00–12 at Indonesian longitudes is local daytime.
    const utcHour = Math.floor(hhmm / 100) + (hhmm % 100) / 60
    const localHour = (utcHour + lon / 15 + 24) % 24
    const det = [lon, lat, Number(r.bright_ti4), Number(r.bright_ti5), Number(r.frp), dd, hhmm, localHour >= 6 && localHour < 18 ? 1 : 0]
    const g = groups[f].get(p)
    if (g) g.push(det)
    else groups[f].set(p, [det])
  }
  console.log(`${y}: ${rows.length} rows`)
}
console.log(`fires: ${total} kept, ${dropped} outside Indonesia dropped`)

const rand = mulberry32(20180101)
// Per region, per month: detections, peak FRP, detections per province.
const stats = Object.fromEntries(
  REGION_IDS.map((id) => [id, { detections: new Array(MONTHS).fill(0), peakFrp: new Array(MONTHS).fill(0), provinces: Array.from({ length: MONTHS }, () => ({})) }]),
)
const dots = []
for (let f = 0; f < MONTHS; f++) {
  for (const [p, dets] of groups[f]) {
    const region = provinces[p].properties.region
    const s = stats[region]
    s.detections[f] += dets.length
    s.provinces[f][p] = dets.length
    for (const d of dets) s.peakFrp[f] = Math.max(s.peakFrp[f], d[4])
    // Unbiased sample: floor(n / PER_DOT) dots, plus one more with the remaining probability.
    const want = Math.floor(dets.length / PER_DOT) + (rand() < (dets.length % PER_DOT) / PER_DOT ? 1 : 0)
    for (let i = dets.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[dets[i], dets[j]] = [dets[j], dets[i]]
    }
    for (const d of dets.slice(0, want)) {
      dots.push([f, r4(d[0]), r4(d[1]), Math.round(d[2] * 10) / 10, Math.round(d[3] * 10) / 10, Math.round(d[4] * 10) / 10, d[5], d[6], d[7], p])
    }
  }
}
dots.sort((a, b) => a[0] - b[0] || a[6] - b[6] || a[7] - b[7])
for (const s of Object.values(stats)) s.peakFrp = s.peakFrp.map((v) => Math.round(v * 10) / 10)
writeFileSync(
  `${OUT}/fires.json`,
  JSON.stringify({
    source: 'NASA FIRMS VIIRS NOAA-20 375 m active fires, 2018–2025',
    perDot: PER_DOT,
    columns: ['frame', 'longitude', 'latitude', 'bright_ti4', 'bright_ti5', 'frp', 'day', 'acq_time', 'daytime', 'province'],
    provinces: provinces.map((p) => p.properties.name),
    regions: stats,
    dots,
  }),
)
console.log(`fires.json: ${dots.length} dots`)

// ---------- Aerosol (MERRA-2 organic-carbon AOT) ----------
const AOT_REGIONS = {
  indonesia: 'Indonesia', sumatra: 'Sumatra', kalimantan: 'Kalimantan', java: 'Jawa',
  sulawesi: 'Sulawesi', bnt: 'Bali_NusaTenggara', maluku: 'Maluku', papua: 'Papua',
}
const aotRows = readCsv(readFileSync(`${SRC}/merra2_aot_oc_indonesia_monthly.csv`, 'utf8'))
const aerosol = {}
for (const [id, col] of Object.entries(AOT_REGIONS)) {
  const s = { aot: new Array(MONTHS).fill(0), norm: new Array(MONTHS).fill(0), lognorm: new Array(MONTHS).fill(0), anomalyNorm: new Array(MONTHS).fill(0) }
  for (const r of aotRows) {
    const f = frameOf(Number(r.year), Number(r.month))
    if (f < 0 || f >= MONTHS) continue
    s.aot[f] = r4(Number(r[`${col}_aot_oc`]))
    s.norm[f] = r4(Number(r[`${col}_norm`]))
    s.lognorm[f] = r4(Number(r[`${col}_lognorm`]))
    s.anomalyNorm[f] = r4(Number(r[`${col}_anomaly_norm`]))
  }
  aerosol[id] = s
}
writeFileSync(`${OUT}/aerosol.json`, JSON.stringify({ source: 'MERRA-2 organic carbon aerosol optical thickness, monthly regional mean', regions: aerosol }))

// ---------- CO (MERRA-2) ----------
const CO_REGIONS = { indonesia: 'co_Indonesia', sumatra: 'co_Sumatra', kalimantan: 'co_Kalimantan', papua: 'co_Papua' }
const coRows = readCsv(readFileSync(`${SRC}/co_merra2_monthly.csv`, 'utf8'))
const co = {}
for (const [id, col] of Object.entries(CO_REGIONS)) {
  co[id] = new Array(MONTHS).fill(0)
  for (const r of coRows) {
    const [yy, mm] = r.date.split('-').map(Number)
    const f = frameOf(yy, mm)
    if (f >= 0 && f < MONTHS) co[id][f] = Math.round(Number(r[col]) * 10) / 10
  }
}
writeFileSync(`${OUT}/co.json`, JSON.stringify({ source: 'MERRA-2 carbon monoxide (ppb), monthly regional mean', regions: co }))

// ---------- ENSO & IOD (weekly -> monthly mean) ----------
const sums = Array.from({ length: MONTHS }, () => [0, 0, 0])
for (const r of readCsv(readFileSync(`${SRC}/enso_iod.csv`, 'utf8'))) {
  const [yy, mm] = r.date.slice(0, 10).split('-').map(Number)
  const f = frameOf(yy, mm)
  if (f < 0 || f >= MONTHS) continue
  sums[f][0] += Number(r.enso)
  sums[f][1] += Number(r.iod)
  sums[f][2]++
}
writeFileSync(
  `${OUT}/climate.json`,
  JSON.stringify({
    source: 'NASA sea-level ENSO and Indian Ocean Dipole indices, monthly mean of weekly values',
    enso: sums.map(([e, , n]) => r3(e / n)),
    iod: sums.map(([, i, n]) => r3(i / n)),
  }),
)
console.log('aerosol.json, co.json, climate.json written')
