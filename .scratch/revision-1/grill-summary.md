# Grill Summary: Revision 1 (from `.scratch/revisi-guide-1.png`)

Applies on top of `.scratch/wildfire-sonification-mockup/grill-summary.md`.

## Header
- Remove the "Indonesia · 2018–2025" eyebrow above the title.
- New title (sentence case, no question mark): **"How wildfires in Indonesia changed from 2018 to 2025"**; islands: "How wildfires in {Region} changed from 2018 to 2025". Same title on the mode gate.
- Nav "Data" → **"Repository ↗"** external link, new tab, accessible label "Project repository on GitHub (opens in new tab)". URL lives in `src/config.ts` as `REPO_URL`, a placeholder for now (TODO).
- **Data table dialog removed entirely** (not reachable anywhere). Accepted trade-off: screen-reader users keep arrow-key region exploration, monthly summaries and narration, but lose the year-by-year overview.

## Typography
- No all-caps text anywhere **except "NOW PLAYING"**. Section headings ("Fire spots", "Sound layers"), tour step labels, gate kicker, ending kicker, island province labels and table headers become sentence case.

## Bottom bar
- Remove the top border (and any background) of the bottom bar.
- Delete the "Mockup · dummy data…" line and the "Colour = intensity. One dot ≈ 60 detections" note.

## Legend (left, horizontal)
- Heading "Fire spots".
- Stepped colour bar (220px), 5 steps deep red → near-white between 6 boundary labels **300 · 315 · 330 · 345 · 360 · 367**, caption "Brightness (K)".
- Beside it on the same row: 3 glow circles sized as on the map, labelled **5 · 50 · 500 MW**, caption "Fire radiative power".

## Player (centre, centred)
- Line 1: "NOW PLAYING: {song}" on one line, centred (narration hold message replaces the song name).
- Line 2: ⏮ ⏯ ⏭ centred exactly under it.
- Line 3: timeline capped at ~480px, elapsed / total time either side, year labels under each year's midpoint.
- **Speed control removed** (playback fixed at 1×; clock reducer keeps speed support internally).

## Unchanged / out of scope
- Sound layers, map, narration, onboarding flow, keyboard shortcuts, data generation.
