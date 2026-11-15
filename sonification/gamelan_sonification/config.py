"""Shared constants: paths, time axis, regions, pitch space, mapping ranges, renderer and mastering settings.

Every number that shapes the sound lives here, so a test can be re-tuned without touching the pipeline code.
"""
from pathlib import Path

import numpy as np

# ---------------------------------------------------------------- paths
ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"                     # put the datasets here (or pass --viirs/--aot/--co/--enso)
CACHE = ROOT / "cache"                   # VIIRS detections with region labels (safe to delete; rebuilt on demand)
OUT = ROOT / "output"                    # <Region>/<Region>_<y0>-<y1>_<k>_<layer>.wav + zips/

VIIRS_SRC = DATA / "viirs_clean"         # folder (or .zip) of viirs_n20_indonesia_<YEAR>_clean.csv
AOT_CSV = DATA / "merra2_aot_oc_indonesia_monthly.csv"
CO_CSV = DATA / "co_merra2_monthly.csv"
ENSO_CSV = DATA / "enso_iod.csv"

SR = 44100

# ---------------------------------------------------------------- time axis
DATA_FIRST, DATA_LAST = "2018-04-01", "2025-12-31"   # VIIRS starts 2018-04-01; AOT ends 2025-12
MAX_DURATION = 150.0                     # s; sec_per_day is derived so the file stays below this
COMPASS_S = 2.6                          # compass calibration (combined mix only)
DELAY_S = 2.0                            # silence between the compass and the data
INTRO = COMPASS_S + DELAY_S              # data starts here in EVERY file (layers stay in sync with the mix)
TAIL = 4.0                               # ring-out after the last day
SEGMENTS = ("year", "quarter", "month")  # gong = change of this periodic segment of acq_date

# ---------------------------------------------------------------- sliced versions (--slices)
SLICE_PLAN = {"Indonesia": [(2018, 2018), (2019, 2019), (2020, 2022), (2023, 2023), (2024, 2024), (2025, 2025)]}
SLICE_PLAN_DEFAULT = [(2018, 2020), (2021, 2023), (2024, 2025)]          # every other region: 3 + 3 + 2 years
SLICE_PREROLL_S = 0.2                    # fade-in lead-in BEFORE the first day (every slice except the first one)
SLICE_FADE_OUT_S = 0.5                   # fade-out tail AFTER the last day (every slice)
# compass (+ its 2 s delay) only at the start of the FIRST slice; later slices open directly on their lead-in
SLICE_DELAY_WITHOUT_COMPASS = False      # True: keep the 2 s silence (without compass) at the start of later slices

# ---------------------------------------------------------------- regions (strict choice)
REGIONS = ["Indonesia", "Sumatra", "Kalimantan", "Jawa", "Sulawesi", "Maluku", "Bali_NusaTenggara", "Papua"]
# listener position (approximate geographic centre of each area), facing north
CENTRE = {"Indonesia": (118.0, -2.5), "Sumatra": (101.5, -0.5), "Kalimantan": (113.9, 0.0), "Jawa": (110.2, -7.3),
          "Sulawesi": (121.0, -2.0), "Maluku": (128.8, -3.0), "Bali_NusaTenggara": (119.8, -8.8), "Papua": (136.5, -4.0)}
# CO file columns; regions without their own series use the national one
CO_COLUMN = {"Indonesia": "co_Indonesia", "Sumatra": "co_Sumatra", "Kalimantan": "co_Kalimantan", "Papua": "co_Papua"}

# ---------------------------------------------------------------- pitch space: A-flat minor pentatonic in A1..C8
B1_MIDI = 35                             # degree 0 = B1 (Cb2, 61.7 Hz), the lowest scale tone >= A1 (55 Hz)
PENT = [0, 2, 4, 7, 9]                   # Cb Db Eb Gb Ab, semitones above B
TOP = 30                                 # degree 30 = B7 (Cb8, 3951 Hz), the highest scale tone <= C8 (4186 Hz)
RANGES = dict(jenglong=(0, 10), bonang=(10, 20), panerus=(15, 25), peking=(20, 30))   # degree bands
GONG_DEG, REBAB_DEG = 4, 9               # Ab2 gong (103.8 Hz), Ab3 rebab root (207.7 Hz)

# ---------------------------------------------------------------- mappings
CTRL_SMOOTH_S = 0.8                      # daily controls smoothed over this much AUDIO time (Hann window)
PRESENCE_MIN = 0.02                      # smoothed share of fire days below which peking/panerus rest
PEKING_RATE = (1.0, 9.0)                 # notes/s = a + b * fire_n
PANERUS_RATE = (0.6, 5.4)
VIIRS_AMP, FRP_DB = 0.3, 18.0            # frp (log, national p1..p99) -> -18..0 dB
PEKING_NOTE_S, PANERUS_NOTE_S = 0.25, 0.35   # note lengths in the internal note record (checks only)
CANDIDATES = 12                          # detections considered for each peking/panerus note
WALK_TEMP = 0.8                          # softness of the continuity choice
REPEAT_COST = 1.3                        # an exact pitch repeat costs more than one scale step
FRP_COST = 3.0                           # cost per unit of normalized-frp difference
SPATIAL_SMOOTHING = {"off": float("inf"), "light": 120.0, "strong": 60.0}   # deg of direction change = 1 step
REBAB_RATE = (0.25, 5.75)                # bow changes/s = a + b * co_n
REBAB_AMP, REBAB_DB = 0.085, 4.0         # light volume: -4..0 dB with co_n
BONANG_RATE, BONANG_AMP = 2.0, 0.12
BONANG_DUR = (0.3, 1.9)                  # s = a + b * lognorm
BONANG_DB = 12.0                         # anomaly_norm / max|anomaly_norm| -> +-12 dB
JENGLONG_RATE, JENGLONG_AMP = 0.7, 0.07
ENSO_RANGE = (-2.0, 2.0)                 # enso -> jenglong band (El Nino = higher)
IOD_DB_PER_UNIT, IOD_DB_CLIP = 3.0, (-9.0, 12.0)
GONG_AMP = 0.4

# ---------------------------------------------------------------- binaural renderer
HEAD_A, SOUND_C = 0.0875, 343.0          # head radius (m), speed of sound (m/s)
WIDEN = 0.3                              # extra amplitude-pan ILD on top of the head model
DMAX_PCTL, DMAX_MIN_KM = 98, 150.0       # distance normalisation per region
COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]

# ---------------------------------------------------------------- mastering / export (WAV only)
REVERB_S, REVERB_WET = 2.2, 0.15
TARGET_LUFS = -14.0
LAYERS = ["peking", "panerus", "bonang", "jenglong", "rebab", "gong"]     # file order 1..6 (0 = combined)


def sec_per_day(n_days, max_duration=MAX_DURATION):
    return np.floor((max_duration - INTRO - TAIL - 1.0) / n_days * 1000) / 1000
