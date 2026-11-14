# Grill Summary: Indonesian Wildfire Sonification — Interactive Mockup

Goal: a dummy, interactable frontend mockup (in `src/`) of the wildfire data-sonification web app described in `.scratch/project_context.md` and the wireframes (`default.png`, `music-playing.png`, `per-island.png`). Visual vibe (revised 2026-11-15) = `inspo-2.jpg` as the single anchor, map rendering after inspo-1/3. The earlier dense-linework / condensed-uppercase look read as a sci-fi dashboard and was dropped.

## Stack
- Vite + React + TypeScript (strict), CSS modules, d3-geo SVG map from bundled GeoJSON.
- Inter only, self-hosted via `@fontsource`.

## Language
- Everything in English (UI, narration, onboarding, TTS `en-US`). Title (sentence case): "What is the history of Indonesia's wildfires?".

## Playback ("song")
- **Silent fake timeline** — no audio. Clock drives map, narration, counters, layer readouts.
- Monthly steps Jan 2018 → Dec 2025 = 96 frames, ~1 s/month (~96 s).
- Big date readout on map.
- Player: ⏮/⏭ = previous/next narration chapter; Play/Pause; scrubbable `<input type="range">` with `aria-valuetext` ("September 2019"), year ticks, chapter markers (hover title); elapsed/total time; speed 0.5×/1×/2×; "Up next: <song name>" label.

## Dummy data
- Fire spots shaped like FIRMS VIIRS N20 rows (lat, lon, frp, bright_ti4, confidence, acq_date).
- Realistic patterns: hotspots in Riau, Jambi, South Sumatra, Central/West/South Kalimantan, south Papua; dry-season peak Aug–Oct; spikes in 2019 & 2023; quieter 2020–2022.
- Dot size = FRP, colour intensity = brightness/confidence; red → orange → yellow-white additive glow; dots fade over 2–3 frames.
- "Mockup — dummy data" badge in footer.

## Narration
- ~8 cues on national timeline (intro, 2018 season, 2019 haze crisis, quiet 2020–22, 2023 El Niño, 2024, 2025, outro); 2–3 cues per island.
- Narasi panel: title, 2–3 sentences, SVG placeholder illustration with real alt text.
- Visual mode: Web Speech API `en-US`, "Narration voice" toggle, timeline keeps running.
- Audio mode: text to `aria-live`; built-in TTS off by default; timeline auto-pauses until cue is read; **N** repeats.

## Impact counters & ending
- "People treated for acute respiratory infections (ARI)" (red) and "Hectares of land burned" (blue), cumulative, in Narasi panel. Totals ~2.1M ARI, ~4.4M ha (2019 ≈1.6M ha, 2023 ≈1.1M ha).
- On song end: map dims/blurs, counters animate to centre and scale up, closing line, buttons "Replay" and "Explore an island". Audio mode: summary read via `aria-live`, focus → Replay. Reduced-motion: fade.
- Island songs: same counters scoped to island, same ending.

## Sound-layer toggles & legend
- Toggles (bottom-right): Wildfire, CO, PM2.5 as `role="switch"`, each with a dot indicator + current dummy value (e.g. "CO 412 ppb", "PM2.5 87 µg/m³"). Off → greyed + "muted"; announced in audio mode.
- Wildfire toggle also dims dots to 30%; dots otherwise always visible.
- Legend (bottom-left, HTML): size = FRP (small/medium/large), colour = Smouldering / Burning / Extreme.

## Islands
- 7 regions: Sumatra, Kalimantan, Java, Sulawesi, Bali & Nusa Tenggara, Maluku, Papua (Indonesian parts only).
- Shape + label clickable; labels are `<button>`s; keys 1–7. Hover/focus highlights, others dim.
- Click → animated zoom (crossfade if reduced motion), title changes, "← Back to Indonesia" top-left, island timeline starts at Jan 2018 **paused** (no autoplay). Narration, counters, layer readouts switch to island data.
- Back (link or Esc) zooms out and restores national timeline position.
- Audio mode: focus to island heading announcing "Kalimantan. 96 months, 2018 to 2025. Press Space to play."

## Mode gate & onboarding
- First screen: "Visual experience" vs "Audio / screen-reader mode" (audio button focused first, `aria-live` hint). Saved in localStorage; switchable via settings.
- Stage 1 (first visit): visual = 3-step spotlight coach marks (map/islands, player, ? help); audio = modal with ordered list + shortcut table, "Got it".
- Default state shows only title, intro, map, player. Stage 2 on first Play: playback holds, new UI fades in (narration, counters, sound layers, legend), tour runs, then playback starts.
- Each stage once (localStorage); ? replays; Esc skips; focus restored; `role="dialog"`. Islands don't retrigger.

## Accessibility
- Rely on user's own screen reader (NVDA/JAWS/VoiceOver/TalkBack); no hover-to-speak.
- Full keyboard: Space play/pause, ←/→ month, 1–7 islands, Esc back, N repeat narration.
- Semantic HTML/ARIA landmarks, switches, slider, headings; live regions for narration, month summaries ("September 2019: 1,240 fire spots, most in Central Kalimantan"), toggle changes, ending.
- "View data as table" (fire spots by region × year).
- Arrow-key map exploration announcing region stats for the current month.
- Optional "Built-in voice" switch in audio mode (off by default) for users without a screen reader.
- WCAG AA contrast, always-visible orange focus ring, works at 200% zoom, `prefers-reduced-motion` respected.

## Visual style (minimal, after inspo-2)
- Flat charcoal ; no panels, card borders, blur or glows on UI. Content floats; structure comes from whitespace and 1px hairline rules.
- One sans (Inter), sentence case; small uppercase eyebrow labels used sparingly.
- One accent: coral-orange  for fire, the playhead and on-states. Counters are white (no red/blue).
- Map: land shapes only ( on ), faint province borders, no graticule / ticks / north arrow / scale bar / texture lines. Region labels are plain text. Fire dots keep the ember glow (deep red → amber → near-white).
- Counters: number over a bracketed hairline with a small label (inspo-2's stats row).
- Controls are text links or thin outlined circles/pills; sound layers are dot + name + value (no meters). Legend = one gradient ramp + three size dots.

## Layout
- Desktop-first ≥1280px (wireframe layout); tablet landscape ≥1024px compressed; <1024px functional stacked fallback.

## Quality
- `npm run build` (strict TS) must pass; ESLint + `eslint-plugin-jsx-a11y`; Vitest for data generator and timeline clock only. No component/E2E tests.
- Manual checklist: keyboard-only walkthrough, NVDA walkthrough of audio mode, reduced-motion check.

## Manual a11y checklist (run before demoing)
- [ ] Keyboard only: gate → intro guide → Space to play → player guide → ←/→, 1–7, Esc, N, ? all work; focus ring always visible.
- [ ] NVDA (Windows) in audio mode: gate hint is read; chapters are read and playback waits; January / peak-month summaries are read; arrow keys between region buttons read that region's stats; ending summary is read and focus lands on Replay.
- [ ] Data table dialog reads as a proper table (headers announced).
- [ ] OS "reduce motion" on: zoom is instant, ending fades instead of flying.
- [ ] Browser zoom 200%: nothing is cut off; <1024px stacked layout is usable.

## Out of scope
- Real data, any audio/sonification, backend/API/accounts/analytics, non-English languages, real photos, deployment.
