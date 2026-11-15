"""Phase 3a - data -> sound parameter mappings (pure functions; no timing, no audio).

  pitch space   degree (0..30) <-> Hz (and MIDI note number, used by the checks) in A-flat minor pentatonic, B1..B7
  VIIRS         bright_ti4 -> peking degree, bright_ti5 -> panerus degree, frp -> amplitude, count -> note rate,
                lat/lon -> azimuth/distance -> binaural placement
  CO            -> rebab bow-change rate + light level
  AOT           norm -> bonang degree, lognorm -> duration, anomaly_norm -> dB
  ENSO/IOD      enso -> jenglong degree, iod -> dB
"""
import numpy as np
import pandas as pd

import config as C
import synth as S


# ---------------------------------------------------------------- pitch space
def deg_hz(d):
    o, s = divmod(int(np.clip(d, 0, C.TOP)), 5)
    return 440 * 2 ** ((C.B1_MIDI - 69) / 12) * 2 ** (o + C.PENT[s] / 12)


def deg_midi(d):
    o, s = divmod(int(np.clip(d, 0, C.TOP)), 5)
    return C.B1_MIDI + 12 * o + C.PENT[s]


def to_deg(x, lo, hi, layer):
    """Linear map of x in [lo, hi] onto the layer's degree band, rounded and clipped."""
    a, b = C.RANGES[layer]
    return np.clip(np.round(a + (b - a) * (np.asarray(x, float) - lo) / (hi - lo)), a, b).astype(int)


# ---------------------------------------------------------------- shared helpers
def smoother(spd):
    """Hann moving average whose length is CTRL_SMOOTH_S of audio (>= 3 days)."""
    win = max(3, int(round(C.CTRL_SMOOTH_S / spd)))
    return lambda x: pd.Series(x).rolling(win, center=True, min_periods=1, win_type="hann").mean().values


# ---------------------------------------------------------------- VIIRS
def fire_density(count, spd):
    """Daily count -> fire_n (log, 0..1, smoothed) and `present` (are there fires nearby in time?)."""
    smooth = smoother(spd)
    ln = np.log1p(count)
    fire_n = smooth(ln / max(ln.max(), 1e-9))
    present = smooth((count > 0).astype(float)) > C.PRESENCE_MIN
    return fire_n, present


def viirs_rates(fire_n):
    return dict(peking=C.PEKING_RATE[0] + C.PEKING_RATE[1] * fire_n,
                panerus=C.PANERUS_RATE[0] + C.PANERUS_RATE[1] * fire_n)


def detection_table(v, nat):
    """Per detection: peking degree (ti4), panerus degree (ti5), normalized frp (vn), azimuth, distance."""
    return dict(d4=to_deg(v.bright_ti4, *nat["p4"], "peking"), d5=to_deg(v.bright_ti5, *nat["p5"], "panerus"),
                vn=np.clip((np.log1p(v.frp.values) - nat["pf"][0]) / (nat["pf"][1] - nat["pf"][0]), 0, 1),
                az=v.az.values, km=v.km.values)


def frp_amp(vn):
    return C.VIIRS_AMP * 10 ** ((-C.FRP_DB + C.FRP_DB * vn) / 20)


def place(sig, az, km, dmax):
    """Binaural placement (head model) + extra amplitude-pan widening."""
    y = S.binauralize(sig, az, km, dmax)
    s = np.sin(az)
    return y * np.array([[1 - C.WIDEN * s], [1 + C.WIDEN * s]]) / (1 + C.WIDEN * abs(s)) * (1 + C.WIDEN)


# ---------------------------------------------------------------- CO
def co_norm(co):
    return (co - co.min()) / max(co.max() - co.min(), 1e-9)


def rebab_rate(co_n):
    return C.REBAB_RATE[0] + C.REBAB_RATE[1] * co_n


def rebab_level(co_n_at_t):
    return C.REBAB_AMP * 10 ** ((-C.REBAB_DB + C.REBAB_DB * co_n_at_t) / 20)


# ---------------------------------------------------------------- AOT
def bonang_params(norm, lognorm, anom, amax):
    """-> degree, duration (s), dB."""
    d = int(to_deg(norm, 0.0, 1.0, "bonang"))
    dur = C.BONANG_DUR[0] + C.BONANG_DUR[1] * float(np.clip(lognorm, 0, 1))
    db = float(np.clip(C.BONANG_DB * anom / amax, -C.BONANG_DB, C.BONANG_DB))
    return d, dur, db


# ---------------------------------------------------------------- ENSO / IOD
def jenglong_params(enso, iod):
    """-> degree, dB."""
    d = int(to_deg(enso, *C.ENSO_RANGE, "jenglong"))
    db = float(np.clip(C.IOD_DB_PER_UNIT * iod, *C.IOD_DB_CLIP))
    return d, db
