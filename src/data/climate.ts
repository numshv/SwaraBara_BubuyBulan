/**
 * Real ENSO and Indian Ocean Dipole indices derived from NASA sea-level data
 * (dataset_source/enso_iod.csv, weekly), averaged per month (src/data/real/climate.json).
 * Positive ENSO means El Niño, positive IOD a positive dipole: both tend to dry Indonesia out.
 * They are basin-scale signals, so island songs share them.
 */
import climateJson from './real/climate.json'

export interface ClimateSeries {
  /** ENSO index: Jenglong note. */
  enso: number[]
  /** IOD index: Jenglong volume. */
  iod: number[]
}

const climate: ClimateSeries = { enso: climateJson.enso, iod: climateJson.iod }

export function getClimate(): ClimateSeries {
  return climate
}
