---
name: nasa-space-apps-2026-brand
description: Official NASA Space Apps Challenge 2026 Brand Guidelines (Typography, Colors, WCAG AAA Contrast, Logo Rules, and Vector Patterns) integrated with Pitch-Black Bioluminescent Cartography.
---

# NASA SPACE APPS CHALLENGE 2026 — OFFICIAL BRAND & UI DESIGN GUIDE

When styling the application UI, floating HUD panels, typography, icons, and presentation views, strictly adhere to the official **NASA Space Apps Challenge 2026 Brand Guidelines** while preserving the **#000000 Pitch-Black Bioluminescent Map Canvas** for the 6 Karhutla data layers.

---

## 1. Logo & Branding Compliance (CRITICAL RULE)
1. **STRICTLY FORBIDDEN:** NEVER use the official NASA agency logo (the blue "Meatball" sphere or the red "Worm" logotype) anywhere in the web app, header, or favicon.
2. **Approved Event Identity:**
   - **Header Lockup:** Use the official **NASA Space Apps Challenge Horizontal Logo** (White "Orbit" circle with 5 radiating comet/satellite lines + `"NASA"` in Rocket Red `#E43700` + `"SPACE APPS CHALLENGE"` in crisp White `#FFFFFF`).
   - **Favicon & Compact Badge:** Use **The Small Logo** ( ONLY the white "Orbit" circle with 5 radiating lines, without text) on a Deep Blue `#07173F` background for browser favicons and small mobile badges.
   - **Logo Integrity:** Never tilt, rotate, stretch, recolor, add strokes, or place the logo over noisy imagery. Maintain a `1U` clear margin around the mark.

---

## 2. Official Color Palette & 60-30-10 Hierarchy
Combine the official Space Apps 2026 palette on all UI HUD panels with the `#000000` canvas on the interactive map:

### A. Official Space Apps Brand Colors (For Floating HUD Panels, Header, Dock, & Modals)
- **Deep Blue (`#07173F`):** Primary surface background for all floating HUD cards, Instrument Stem Mixer strips, Header bar, and Bottom Dock (`60%` dominant UI surface).
- **Electric Blue (`#0042A6`):** Secondary panel surface, active card borders, and section dividers (`30%` structural accent).
- **Neon Blue (`#0960E1`) & Blue Yonder (`#2E96F5`):** Interactive hover states, secondary links, and subtle `1px` technical grid borders.
- **Neon Yellow (`#EAFE07`):** Official 10% high-visibility accent color!
  - **Usage Rule:** NEVER use `#EAFE07` as a large page background or for main `H1` headlines. Use it strictly for **interactive elements, primary action buttons, active island selection borders, and 4px keyboard focus rings (`focus-visible:ring-4 focus-visible:ring-[#EAFE07]`)**.
- **Rocket Red (`#E43700`) & Martian Red (`#8E1100`):** Critical fire alerts, warning badges, and high-severity indicators (never use Rocket Red as a large body text background).
- **Pure White (`#FFFFFF`):** Primary typography and icon strokes.

### B. Official 45° Smooth Linear Gradient (For Header / Modal Backdrops)
- When a subtle brand background gradient is needed on non-map panels, use a smooth `45°` linear gradient from **Electric Blue (`#0042A6`)** at top-left to **Deep Blue (`#07173F`)** at bottom-right:
  ```css
  background: linear-gradient(135deg, #0042A6 0%, #07173F 100%);
  ```

### C. WCAG 2.0 / 2.2 AA & AAA Approved Contrast Pairs (Mandatory for Low-Vision Users)
Only use these verified high-contrast text-on-background combinations from Page 9 of the Brand Guide:
- **White (`#FFFFFF`) on Deep Blue (`#07173F`):** Contrast Ratio **`17.41:1` (WCAG AAA)** — *Use for all primary telemetry & mixer labels.*
- **Neon Yellow (`#EAFE07`) on Deep Blue (`#07173F`):** Contrast Ratio **`15.49:1` (WCAG AAA)** — *Use for active switches, shortcut badges, and focus states.*
- **Deep Blue (`#07173F`) on Neon Yellow (`#EAFE07`):** Contrast Ratio **`15.49:1` (WCAG AAA)** — *Use for primary Play/Pause & active toggle buttons.*
- **White (`#FFFFFF`) on Electric Blue (`#0042A6`):** Contrast Ratio **`8.99:1` (WCAG AAA)**.
- **White (`#FFFFFF`) on Martian Red (`#8E1100`):** Contrast Ratio **`9.38:1` (WCAG AAA)** — *Use for critical Karhutla danger badges.*

---

## 3. Official Google Fonts Typography System
Load these exact 3 open-source font families in `index.html` via Google Fonts:
1. **Titles & Headings (`H1`, Region Titles, Modal Headers):**
   - **Font Family:** `'Fira Sans'`, weight `800` (ExtraBold) or `900` (Black).
   - **Styling:** `UPPERCASE`, `letter-spacing: 0.05em` (`tracking-wider`), line-height `1.2`.
2. **Body Copy, Subheadings (`H2`, `H3`), & Button Text:**
   - **Font Family:** `'Overpass'`, weights `400` (Regular), `600` (SemiBold), `700` (Bold).
   - **Styling:** `H3` subheadings in `Overpass SemiBold UPPERCASE`; primary buttons in `Overpass Bold` (`#EAFE07` background with `#07173F` text).
3. **Code, Telemetry Metrics, GPS Coordinates, & Shortcuts:**
   - **Font Family:** `'Fira Code'`, weights `400` (Regular) and `700` (Bold).
   - **Styling:** Always apply `font-mono tabular-nums` so live hotspot counts, CO/CO2 values, and timeline years never jitter during audio playback.

### HTML `<head>` Font Import Snippet:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;600;700&family=Fira+Sans:wght@700;800;900&family=Overpass:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">
```

---

## 4. Iconography & Non-Color Semantic Rule
1. **Approved Icon Style:** Use lightweight, line-based vector icons with a consistent `1.5px` or `2px` stroke weight from **Feather Icons (`lucide-react`)** or **Phosphor Icons**.
2. **Power-of-Two Sizing:** Render digital icons at crisp sizes (`16px`, `20px`, `24px`, `32px`) to prevent vector anti-aliasing blur.
3. **Text + Symbol Pairing (Accessibility Mandate):**
   - Never use color or an ambiguous icon alone to communicate state.
   - Always pair colors and icons with explicit text labels (e.g., pair `#E43700` Red with a fire icon AND explicit text `BAHAYA TINGGI`; pair instrument switches with `[AKTIF]` / `[MATI]`).

---

## 5. Official Scientific Vector Patterns (Page 19 Integration)
The Space Apps Brand Guide defines 5 official scientific vector patterns (screened at `15%–25%` opacity in single-color vector strokes):
1. **Topographic Waves / Isolines** -> Directly used for **Layer 3: Karbon Monoksida (CO) Hollow Contours** and **Layer 2: Aerosol Wind Streamlines**.
2. **Coordinate Crosshairs (`+` Grid)** -> Directly used for **Layer 5: El Niño & IOD Oceanic Thermal Matrix** in the Indian & Pacific Oceans and the map graticule mesh.
3. **Voronoi / Cellular Geometry** -> Used for Indonesian regional district subdivisions.
4. **Concentric Orbit Ripples** -> Directly used for **Acoustic Sonar Rings** radiating from the currently playing Indonesian island.
5. **Binary / Telemetry Stream** -> Used as subtle `15%` opacity decorative background texture inside the Header or About modal.