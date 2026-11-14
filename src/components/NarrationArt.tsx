import type { ReactNode } from 'react'
import type { ArtKind } from '../data/narration'

const TREES = 'M10 96 l8-22 l8 22 M30 96 l10-30 l10 30 M58 96 l7-18 l7 18 M80 96 l11-34 l11 34 M110 96 l8-24 l8 24 M134 96 l9-28 l9 28 M160 96 l7-20 l7 20'

/** Placeholder line illustrations in the map's hairline style. */
export function NarrationArt({ kind, alt }: { kind: ArtKind; alt: string }) {
  return (
    <svg viewBox="0 0 200 120" role="img" aria-label={alt} className="art">
      <g fill="none" stroke="#8a8883" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        {ART[kind]}
      </g>
    </svg>
  )
}

const glow = (cx: number, cy: number, r: number) => (
  <>
    <circle cx={cx} cy={cy} r={r * 2.2} fill="#ff4d1a" stroke="none" opacity="0.15" />
    <circle cx={cx} cy={cy} r={r} fill="#ffb347" stroke="none" opacity="0.85" />
  </>
)

const ART: Record<ArtKind, ReactNode> = {
  horizon: (
    <>
      <path d="M0 96 H200" />
      <path d={TREES} />
      <circle cx="150" cy="58" r="14" stroke="#ff6a3d" />
      <path d="M48 66 c-6-10 6-14 0-24 c-6-10 6-14 0-24" opacity="0.6" />
      <path d="M100 60 c-6-10 6-14 0-24" opacity="0.5" />
    </>
  ),
  flames: (
    <>
      <path d="M0 96 H200" />
      <path d={TREES} />
      {glow(40, 80, 6)}
      {glow(92, 76, 8)}
      {glow(118, 84, 5)}
      {glow(146, 80, 7)}
      <path d="M92 70 c-8-14 6-20 0-34 M146 72 c-6-10 6-14 0-26" stroke="#ff6a3d" />
    </>
  ),
  haze: (
    <>
      <path d="M0 100 H200" />
      <path d="M20 100 V60 h18 v40 M44 100 V44 h14 v56 M64 100 V70 h20 v30 M92 100 V36 h16 v64 M114 100 V56 h22 v44 M142 100 V66 h14 v34 M162 100 V48 h18 v52" />
      <path d="M0 40 q30-10 60 0 t60 0 t60 0 t60 0 M0 56 q30-10 60 0 t60 0 t60 0 t60 0 M0 72 q30-10 60 0 t60 0 t60 0 t60 0" stroke="#6a6864" opacity="0.8" />
      <circle cx="40" cy="24" r="9" stroke="#ff6a3d" opacity="0.5" />
    </>
  ),
  rain: (
    <>
      <path d="M0 96 H200" />
      <path d={TREES} stroke="#7fb08a" />
      <path d="M30 14 q20-14 40 0 q20-10 30 6 H24 q-6-6 6-6 M110 18 q20-14 40 0 q16-8 26 6 H104 q-4-6 6-6" />
      <path d="M40 30 l-4 12 M56 32 l-4 12 M72 30 l-4 12 M120 34 l-4 12 M138 32 l-4 12 M156 34 l-4 12 M48 52 l-4 12 M130 54 l-4 12" stroke="#5aa9ff" />
    </>
  ),
  sun: (
    <>
      <circle cx="100" cy="46" r="20" stroke="#ff6a3d" />
      <path d="M100 14 v-8 M100 86 v-8 M68 46 h-8 M140 46 h-8 M78 24 l-6-6 M128 74 l-6-6 M122 24 l6-6 M72 74 l6-6" stroke="#ff6a3d" />
      <path d="M0 96 H200 M20 96 l14 8 l-6 10 M60 96 l-8 10 l12 6 M110 96 l6 10 l-10 8 M150 96 l12 6 l-4 12 M180 96 l-10 12" />
    </>
  ),
  peat: (
    <>
      <path d="M0 50 H200" />
      <path d="M14 50 l6-16 l6 16 M60 50 l8-20 l8 20 M130 50 l6-14 l6 14 M170 50 l7-18 l7 18" />
      <path d="M0 66 q50 6 100 0 t100 0 M0 82 q50 6 100 0 t100 0 M0 98 q50 6 100 0 t100 0" stroke="#5e5650" />
      {glow(70, 76, 4)}
      {glow(96, 88, 5)}
      {glow(124, 74, 3)}
      <path d="M96 84 c-4-8 4-12 0-30" stroke="#ff6a3d" opacity="0.6" />
    </>
  ),
  savannah: (
    <>
      <path d="M0 92 q50-8 100 0 t100 0" />
      <path d="M20 92 v-8 M24 92 v-10 M28 92 v-7 M70 90 v-9 M74 90 v-12 M140 92 v-8 M144 92 v-11 M176 92 v-7 M180 92 v-9" />
      <path d="M110 92 v-28 M110 70 q-14-6-20 0 M110 66 q14-8 22 0" />
      {glow(50, 88, 4)}
      {glow(160, 88, 5)}
      {glow(92, 90, 3)}
    </>
  ),
  embers: (
    <>
      <path d="M0 96 H200" />
      <path d="M30 96 l10-6 l16 2 l12-4 l20 6 l18-3 l14 5 l22-4 l16 4" />
      {glow(56, 92, 3)}
      {glow(98, 93, 2.5)}
      {glow(140, 92, 3.5)}
      <path d="M98 88 c-5-10 5-16 0-30 c-5-10 5-16 0-30" opacity="0.5" />
    </>
  ),
}
