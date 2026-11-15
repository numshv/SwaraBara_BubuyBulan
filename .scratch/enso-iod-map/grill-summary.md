# Grill Summary: ENSO + IOD on the map

Applies on top of `.scratch/sound-layer-meters/grill-summary.md`. User approved Q1 and asked to execute; remaining choices are defaults listed here for review.

## Representation (agreed)
- ENSO and IOD are one value per month, but each belongs to an ocean: ENSO = Pacific (Niño 3.4, east of the map), IOD = Indian Ocean (east pole lies SW of Sumatra/Java, west edge of the map).
- Shown as **ocean-edge glows**: west edge = IOD, east edge = ENSO.
  - Positive (El Niño / positive IOD → drier, more fire): warm orange-red. Negative (La Niña / negative IOD → wetter): cool blue. Near zero: invisible.
  - Strength follows |value| (max opacity 0.35 at |value| ≥ 2), eased over 1.2 s. Sits on top of the vignette as light (screen blend), so it doesn't hide fires or smoke.
- No sea-surface-temperature field (needs gridded SST, would clash with the smoke).

## Defaults chosen while executing
- **IOD added as a sound layer** (7th row, under El Niño), placeholder instrument **Slenthem**, colour `#4fa3bf` (the palette had no unused colour left; replace when you pick one). Value shown as DMI, e.g. "+1.8 DMI".
- Switches control the glows: El Niño row → east (ENSO) glow, IOD row → west (IOD) glow.
- Small vertical labels inside the map's left/right edges, sentence case: "Indian Ocean · IOD +1.8 · drier", "Pacific · ENSO +0.4 · drier". No extra legend entry.
- Dummy IOD (DMI): weak positive late 2018, strong positive peak ≈ +2.0 in Oct 2019, negative 2021–2022 (≈ −1.0), positive 2023 (≈ +1.5), near-neutral 2024–2025.
- Audio mode: monthly summaries append "ENSO +0.4, IOD +1.8".
- Same glows in island view (both are basin-scale signals).

## Tests
- IOD series: 96 months, 2019 peak > 1.5, negative in 2021–2022, positive in 2023.

## Out of scope
- Real ENSO/IOD data, SST maps, per-region effects.

## Legend (added 2026-11-15)
- One combined entry, "El Niño (east) · IOD (west)": both use the same edge glow and colours, only the side differs. Diverging bar blue → clear → orange with ticks "−2 wetter · 0 · +2 drier".
- Legend is a single column (power, brightness, aerosol, CO, El Niño · IOD) that **floats** over the bottom-left corner (absolute, above the map), so it never takes height from the map. The narration column keeps 170px clear at its bottom for it (long text scrolls). Normal flow again in the stacked layout below 1024px.
