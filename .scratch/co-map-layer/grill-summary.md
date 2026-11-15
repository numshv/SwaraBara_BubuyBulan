# Grill Summary: CO on the map (comparison build)

## Goal
Show carbon monoxide on the map, in the CO toggle's purple (`#924fbf`), without clashing with the aerosol smoke.

## Options under comparison (user will pick one)
| Option | Look | Regions |
|---|---|---|
| **a. Contours** | thin purple isolines at 250 / 400 / 600 / 800 ppb, brighter towards the core, dashes drifting slowly | **Kalimantan**, Sulawesi, Maluku |
| **b. Purple smoke** | same drifting-puff smoke as aerosol, tinted purple | **Sumatra**, Bali & Nusa Tenggara |
| **c. Stipple** | tiny purple dots drifting with the wind, density = concentration | **Papua**, Java |
- Each grid cell takes the style of the region it belongs to (land: its province; sea: nearest region).
- Recommended by me: (a) contours — line vs. the smoke's fill, so the two never muddy each other; gas shown as an invisible field.

## Data (defaults)
- Dummy surface CO (ppb), shaped like MERRA-2 surface CO, on the aerosol grid (0.625° × 0.5°). Deposited downwind of fires with a wider spread than aerosol (CO lives longer); ~100 ppb background, peak ≈ 900 ppb (Sep 2019). Same monthly wind as the smoke.
- CO number + meter in the sound panel now read the grid's peak in view (like aerosol), replacing the old single-number series.
- CO toggle shows/hides all CO visuals.

## Out of scope (until a style is chosen)
- CO legend entry, audio-summary mention of CO, real data.

## Tests
- CO grid: 96 months, background floor, Sep 2019 peak ≈ 900 ppb, quiet years lower, every cell assigned a region/style.

## Build notes
- Files: `src/data/co.ts` (grid, region styles, peaks), `src/map/coLayer.ts` (contours + stipple), purple smoke via `SmokeRenderer` with a colour option. The old per-song CO number (`frame.co`) was removed; the CO meter/number now read `co.peaks[song]`.
- Peaks seen: Kalimantan 900 ppb, Sumatra 735, Papua 327 (Oct 2023), Java 185. Stipple starts at ~130 ppb (so low CO still shows) and adds dots when zoomed in; contours use fixed 250/400/600/800 levels.
- Observations from the build: contours stay legible over the brown smoke; purple smoke is the most visible but mixes with the aerosol smoke over Sumatra/Malacca; stipple is the subtlest and gets lost under the fire glow and smoke in Papua.
- CO drawing cost ≈ 2.7 ms/frame (contours + stipple), plus the purple smoke loop.

## Decision (2026-11-15)
- **Option (a) contours everywhere.** Purple smoke and stipple code removed, along with the per-region style map.
- Added: legend entry "Carbon monoxide (ppb)" (four purple strokes, 250 / 400 / 600 / 800, faint to bright); audio-mode monthly summaries now say "Carbon monoxide up to N ppb".
