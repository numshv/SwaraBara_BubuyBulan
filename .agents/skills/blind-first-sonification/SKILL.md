
---

name: blind-first-sonification

description: Enforce WCAG 2.2 AAA blind-first web accessibility, WAI-ARIA 1.2 interactive patterns, iSonic non-visual geographic map navigation, audio-ducked TTS feedback, and non-conflicting single-key shortcuts for data sonification apps.

---



# Blind & Low-Vision Web Engineering Rules (WAI-ARIA & Sonification UX)



## 1. Core Paradigm: 1D Linear Navigation & Zero Silent States

1. **100% Keyboard Operability:** Every interactive feature (selecting Indonesian islands, toggling the 4 instrument stems, soloing, scrubbing the timeline, and playing/pausing) MUST work without a mouse.

2. **Zero Silent State Changes:** Whenever a visual state changes on screen, expose it programmatically via ARIA state attributes (`aria-checked`, `aria-pressed`, `aria-selected`) AND dispatch a concise message to the centralized live announcer.

3. **Speech vs. Sonification Separation (Audio Ducking):** Whenever spoken TTS feedback is triggered, automatically duck (lower) the Web Audio master gain by `-12 dB` and restore it to `0 dB` when speech finishes.



## 2. Strict Semantic Landmark Order (DOM Sequence)

Ensure the React DOM follows this exact top-to-bottom sequence:

1. **Skip-to-Content Link (`First Tab Stop`):** `<a href="#island-selector" className="sr-only focus:not-sr-only ...">Lewati ke Pemilih Wilayah</a>`.

2. **`<header role="banner">`:** App title, built-in **Voice Guide Toggle (`Key G`)**, and **Keyboard Shortcuts Modal Trigger (`Key ?`)**.

3. **`<nav id="island-selector" aria-label="Pemilih Wilayah Peta Indonesia">`:** Accessible region selector placed directly before or synced with the map canvas.

4. **`<main role="main" aria-label="Peta Telemetri dan Visualisasi Karhutla">`:** Interactive map viewport.

5. **`<aside aria-label="Mixer Instrumen dan Filter Data NASA">`:** 4-channel stem controller (**Gamelan/VIIRS**, **Strings/Aerosol**, **Cymbal/CO2**, **Calung/GEDI**).

6. **`<footer role="contentinfo">`:** Master Play/Pause (`Space`), historical year scrubber (`2015–2026`), and visible + `aria-live="polite"` telemetry status bar.



## 3. Accessible Geographic Map Pattern (iSonic Standard)

1. **Silence Decorative Map Internals:** Wrap raw Leaflet tile containers, decorative grid lines, and zoom controls with `aria-hidden="true"` and `tabIndex={-1}` so keyboard users never get trapped inside the map canvas.

2. **Synced Region `radiogroup`:** Render the 7 selectable Indonesian zones (`[0] Seluruh Indonesia`, `[Q] Sumatera`, `[W] Kalimantan`, `[E] Jawa & Bali`, `[R] Sulawesi`, `[T] Maluku & Nusa Tenggara`, `[Y] Papua`) as an accessible `role="radiogroup"` with `role="radio"`, `aria-checked={isSelected}`, and `aria-keyshortcuts={shortcutKey}`.



## 4. Accessible 4-Channel Instrument Stem Mixer

Each dataset/instrument strip (**1: Gamelan/VIIRS**, **2: Strings/Aerosol**, **3: Cymbal/CO2**, **4: Calung/GEDI**) must implement:

1. **Explicit Toggle Switch (`role="switch"`):** Include `aria-checked={isActive}`, `aria-keyshortcuts={key}`, and an explicit text badge (`[AKTIF]` / `[MATI]`).

2. **Solo Toggle Button:** Use `aria-pressed={isSolo}` and announce when other instruments are muted.

3. **Accessible Range Slider:** Associate `<label className="sr-only">` and `aria-valuetext={`${volume} persen`}`.



## 5. Safe Global Keyboard Shortcuts (Screen-Reader Guardrails)

Always include these two guardrails at the top of `keydown` listeners:

- `if (e.ctrlKey || e.altKey || e.metaKey) return;`

- `if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;`



Shortcut Matrix:

- `Space`: Play / Pause Master Sonification (`e.preventDefault()`)

- `0`: Select All Indonesia

- `Q, W, E, R, T, Y`: Select Sumatera, Kalimantan, Jawa & Bali, Sulawesi, Maluku-NT, Papua

- `1, 2, 3, 4`: Toggle ON/OFF Gamelan (VIIRS), Strings (Aerosol), Cymbal (CO2), Calung (GEDI)

- `S`: Speak full regional telemetry summary on demand

- `G`: Toggle built-in Web Speech API Voice Guide ON/OFF

- `?`: Open/Close Accessible Keyboard Shortcuts Help Dialog



## 6. WCAG AAA Low-Vision Visual Rules

- Every interactive element MUST include `focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FACC15]`.

- Maintain `>= 10:1` solid contrast (`#FFFFFF` on `#000000` / `#0B0F17` / `#111827`). Zero `backdrop-blur`.

- Use `font-mono tabular-nums` on all telemetry numbers.

