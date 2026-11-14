# Grill Summary: Sound-layer meters (from `.scratch/revisi-guide-2.png`)

Applies on top of `.scratch/wildfire-sonification-mockup/grill-summary.md` and `.scratch/revision-1/grill-summary.md`.

## Rows (6, PM2.5 dropped)
| Data | Placeholder instrument | Map layer? | Number shown (monthly) |
|---|---|---|---|
| Wildfire (VIIRS) | Bonang | yes (dots) | fire spots |
| Aerosol | Gong ageng | yes (smoke) | AOD |
| El Niño | Kendang | no | ONI, signed (+1.4) |
| CO₂ | Gender | no | ppm |
| CO | Saron | no | ppb |
| Rain | Suling | no | mm |
- Instrument names are placeholders, defined in one config.
- El Niño, CO₂ and rain need new dummy series: ONI (La Niña 2020–22, El Niño peaks 2019 and 2023 to ~+1.9), CO₂ rising ~408 → ~427 ppm with a seasonal wiggle, rain mm/month as the inverse of the fire season (drier in El Niño years) plus rain-day events.

## Labels
- Both names: data name first (primary), instrument second (dim).
- Accessible name e.g. "Wildfire, played by bonang"; switch state announced; value read as text.

## Switch
- Pill toggle from the sketch (oval, coral knob when on) replacing the dot.

## Meter
- Display-only DAW-style level meter, minimal: thin 3px track, coral fill, no LED segments or peak hold, not draggable.
- Fill = level relative to that data's own 2018–2025 range (per song).
- Moves at each data's natural rhythm, not once per month:
  - Wildfire: jumps per fire-dot appearance (height by FRP), fast decay.
  - Rain: bursts per rain day, fast decay.
  - Aerosol: smooth glide + gentle wobble. CO: glide + slightly faster wobble.
  - El Niño: very slow glide. CO₂: slow rise + yearly wiggle.
- Muted: meter drops to zero and turns grey. Reduced motion: event meters become a smoothed monthly level, no wobble.
- Meter is aria-hidden; the number carries the information.

## Number
- Kept: small, dim, monthly value with short unit; updates once per month (not per event).

## Layout (comparison build)
- Two variants rendered side by side for evaluation:
  - **b** (two lines, ~240px): line 1 switch · name · number; line 2 instrument · meter. Rows: Wildfire, El Niño, CO.
  - **a** (one line, ~340px): switch · name · instrument · meter · number. Rows: Aerosol, CO₂, Rain.
- Right column widens to ~340px when unlocked for the comparison; to be settled once a variant is chosen.

## Tests
- Pure meter math (event envelope, normalisation) and the new climate series get Vitest coverage.

## Out of scope
- Real audio, draggable volume, map layers for El Niño / CO₂ / CO / rain, per-region rain.

## Outcome (after comparison)
- Chosen: **b (two lines)** for every row; right column narrowed to 240px (220px on tablet).
- Per-layer colour on meter fill and switch knob: Wildfire coral `#ff6a3d`, Aerosol smoke `#c4bcb0`, El Niño teal `#4fd1c5`, CO₂ cream `#fff0cd`, CO amber `#ffc86e`, Rain blue `#5aa9ff`.
