// Builds the trimmed GeoJSON used by the map from:
//  - scripts/raw/indonesia-province-simple.json (github.com/superpikar/indonesia-geojson)
//  - world-atlas countries-50m (neighbouring land, drawn faintly for context)
import { readFileSync, writeFileSync } from 'node:fs'
import { geoArea } from 'd3-geo'
import { feature } from 'topojson-client'

const PROVINCES = {
  'DI. ACEH': ['Aceh', 'sumatra'],
  'SUMATERA UTARA': ['North Sumatra', 'sumatra'],
  'SUMATERA BARAT': ['West Sumatra', 'sumatra'],
  RIAU: ['Riau', 'sumatra'],
  JAMBI: ['Jambi', 'sumatra'],
  'SUMATERA SELATAN': ['South Sumatra', 'sumatra'],
  BENGKULU: ['Bengkulu', 'sumatra'],
  LAMPUNG: ['Lampung', 'sumatra'],
  'BANGKA BELITUNG': ['Bangka Belitung', 'sumatra'],
  'KALIMANTAN BARAT': ['West Kalimantan', 'kalimantan'],
  'KALIMANTAN TENGAH': ['Central Kalimantan', 'kalimantan'],
  'KALIMANTAN SELATAN': ['South Kalimantan', 'kalimantan'],
  'KALIMANTAN TIMUR': ['East Kalimantan', 'kalimantan'],
  PROBANTEN: ['Banten', 'java'],
  'DKI JAKARTA': ['Jakarta', 'java'],
  'JAWA BARAT': ['West Java', 'java'],
  'JAWA TENGAH': ['Central Java', 'java'],
  'DAERAH ISTIMEWA YOGYAKARTA': ['Yogyakarta', 'java'],
  'JAWA TIMUR': ['East Java', 'java'],
  BALI: ['Bali', 'bnt'],
  'NUSATENGGARA BARAT': ['West Nusa Tenggara', 'bnt'],
  'NUSA TENGGARA TIMUR': ['East Nusa Tenggara', 'bnt'],
  'SULAWESI UTARA': ['North Sulawesi', 'sulawesi'],
  GORONTALO: ['Gorontalo', 'sulawesi'],
  'SULAWESI TENGAH': ['Central Sulawesi', 'sulawesi'],
  'SULAWESI SELATAN': ['South Sulawesi', 'sulawesi'],
  'SULAWESI TENGGARA': ['Southeast Sulawesi', 'sulawesi'],
  'MALUKU UTARA': ['North Maluku', 'maluku'],
  MALUKU: ['Maluku', 'maluku'],
  'IRIAN JAYA BARAT': ['West Papua', 'papua'],
  'IRIAN JAYA TENGAH': ['Central Papua', 'papua'],
  'IRIAN JAYA TIMUR': ['Papua', 'papua'],
}

// Malaysia, Brunei, Singapore, Timor-Leste, Papua New Guinea, Philippines, Australia
const NEIGHBOURS = new Set(['458', '096', '702', '626', '598', '608', '036'])

const round = (c) => [Math.round(c[0] * 1000) / 1000, Math.round(c[1] * 1000) / 1000]

// d3-geo expects clockwise exterior rings; flip any polygon that covers "the rest of the globe".
function fixPolygon(rings) {
  const poly = rings.map((r) => r.map(round))
  return geoArea({ type: 'Polygon', coordinates: poly }) > 2 * Math.PI ? poly.map((r) => r.slice().reverse()) : poly
}

function fixGeometry(g) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  return { type: 'MultiPolygon', coordinates: polys.map(fixPolygon) }
}

const raw = JSON.parse(readFileSync(new URL('./raw/indonesia-province-simple.json', import.meta.url)))
const provinces = raw.features.map((f) => {
  const entry = PROVINCES[f.properties.Propinsi]
  if (!entry) throw new Error(`Unmapped province ${f.properties.Propinsi}`)
  return {
    type: 'Feature',
    properties: { name: entry[0], region: entry[1] },
    geometry: fixGeometry(f.geometry),
  }
})

const world = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/countries-50m.json', import.meta.url)))
const neighbours = feature(world, world.objects.countries).features
  .filter((f) => NEIGHBOURS.has(f.id))
  .map((f) => ({ type: 'Feature', properties: { name: f.properties.name }, geometry: fixGeometry(f.geometry) }))

const out = new URL('../src/data/geo/', import.meta.url)
writeFileSync(new URL('indonesia.json', out), JSON.stringify({ type: 'FeatureCollection', features: provinces }))
writeFileSync(new URL('neighbours.json', out), JSON.stringify({ type: 'FeatureCollection', features: neighbours }))
console.log(`provinces: ${provinces.length}, neighbours: ${neighbours.length}`)
