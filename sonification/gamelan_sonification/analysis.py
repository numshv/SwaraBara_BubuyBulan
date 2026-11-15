"""Phase 5 - round-trip checks: measure the notes and the rendered audio to confirm the data reached the sound.

  temporal_alignment   each dataset's peak date vs. the moment the matching sound extreme is heard
  yearly_space         where (compass sector) the region's detections came from, per year
  binaural             measured L/R level of the VIIRS layers vs. the directions the notes were meant to have,
                       and vs. the east-west balance of ALL detections (sampling fidelity)
  seamlessness         note-to-note pitch / pan / velocity steps, gaps, silent frames, sudden loudness jumps
  pitch                every pitched note inside A1..C8 and inside Ab minor pentatonic
"""
import numpy as np
import pandas as pd
from scipy.signal import butter, sosfilt

import config as C
from features import compass
from synth import SR


def corr(a, b):
    a, b = np.asarray(a, float), np.asarray(b, float)
    if len(a) < 3 or a.std() < 1e-12 or b.std() < 1e-12:
        return None
    return round(float(np.corrcoef(a, b)[0, 1]), 3)


def temporal_alignment(notes, D, raw, region, start, end, spd, fire_n):
    n = len(D)
    t_of = lambda d: C.INTRO + (pd.Timestamp(d) - start).days * spd
    date_of = lambda t: str((start + pd.Timedelta(days=int((t - C.INTRO) / spd))).date())
    W = lambda df: df[(df.date >= start) & (df.date <= end)]

    def extreme(layer, idx, expected, tol_days=21):
        """Nearest note sharing the layer's extreme value (pitch idx 2 / velocity idx 3) to the expected time."""
        arr = notes[layer]
        best = max(x[idx] for x in arr)
        ts = np.array([x[0] for x in arr if x[idx] >= best - 1e-9])
        j = int(np.argmin(np.abs(ts - expected)))
        return float(ts[j]), bool(abs(ts[j] - expected) <= tol_days * spd)

    def busiest(times, width=5.0):
        """Centre of the 5 s window holding the most onsets."""
        ts = np.asarray(times)
        grid = np.arange(C.INTRO, C.INTRO + n * spd - width, 0.25)
        return float(grid[int(np.argmax([((ts >= g) & (ts < g + width)).sum() for g in grid]))] + width / 2)

    a, co, e = W(raw["aot"]), W(raw["co"]), W(raw["enso"])
    fire_pk = D.date[int(np.argmax(fire_n))]
    out = [dict(data="VIIRS detections, peak (smoothed)", date=str(fire_pk.date()), expected_t=round(t_of(fire_pk), 1),
                heard="densest peking passage", t=round(busiest([x[0] for x in notes["peking"]]), 1))]
    for name, date, layer, idx, what in (
            ("AOT norm max", a.loc[a[f"{region}_norm"].idxmax(), "date"], "bonang", 2, "highest bonang note"),
            ("AOT anomaly max", a.loc[a[f"{region}_anomaly_norm"].idxmax(), "date"], "bonang", 3, "loudest bonang"),
            ("ENSO max", e.loc[e.enso.idxmax(), "date"], "jenglong", 2, "highest jenglong note"),
            ("IOD max", e.loc[e.iod.idxmax(), "date"], "jenglong", 3, "loudest jenglong")):
        t, ok = extreme(layer, idx, t_of(date))
        out.append(dict(data=name, date=str(pd.Timestamp(date).date()), expected_t=round(t_of(date), 1), heard=what,
                        t=round(t, 1), within_3_weeks=ok))
    cpk = co.loc[co[raw["co_col"]].idxmax(), "date"]
    out.append(dict(data=f"CO max ({raw['co_col']})", date=str(cpk.date()), expected_t=round(t_of(cpk), 1),
                    heard="densest rebab bow changes", t=round(busiest([x[0] for x in notes["rebab"]]), 1)))
    for x in out:
        x["heard_date"] = date_of(x["t"])
    return out


def yearly_space(v, start, end, spd):
    t_of = lambda d: C.INTRO + (pd.Timestamp(d) - start).days * spd
    out = []
    for y in range(start.year, end.year + 1):
        g = v[v.date.dt.year == y]
        if not len(g):
            continue
        sect = pd.Series([compass(z) for z in g.az]).value_counts(normalize=True)
        mx, my = np.average(np.sin(g.az), weights=g.frp + 1e-6), np.average(np.cos(g.az), weights=g.frp + 1e-6)
        out.append(dict(year=y, t_start=round(t_of(max(start, pd.Timestamp(f"{y}-01-01"))), 1), detections=len(g),
                        frp_weighted_direction=compass(np.arctan2(mx, my)),
                        top_directions={k: f"{p:.0%}" for k, p in sect.head(3).items()}))
    return out


def binaural(wet, notes, v, start, end, spd):
    """Per quarter: high-band (>1.5 kHz) R/L level of peking+panerus vs. intended mean sin(az) of the notes
    (weighted by velocity^2) and vs. mean sin(az) of all detections."""
    t_of = lambda d: C.INTRO + (pd.Timestamp(d) - start).days * spd
    h = sosfilt(butter(4, 1500, "high", fs=SR, output="sos"), wet["peking"] + wet["panerus"], axis=1)
    meas, intended, data_ew = [], [], []
    for q in pd.period_range(start, end, freq="Q"):
        s0, s1 = max(q.start_time, start), min(q.end_time, end)
        t0, t1 = t_of(s0), t_of(s1) + spd
        nq = [x for k in ("peking", "panerus") for x in notes[k] if t0 <= x[0] < t1]
        if len(nq) < 8:
            continue
        i0, i1 = int(t0 * SR), int(t1 * SR)
        meas.append(20 * np.log10(np.sqrt((h[1, i0:i1] ** 2).mean() + 1e-12) / np.sqrt((h[0, i0:i1] ** 2).mean() + 1e-12)))
        intended.append(float(np.average([x[4] for x in nq], weights=np.array([x[3] for x in nq]) ** 2)))
        gq = v[(v.date >= s0) & (v.date <= s1)]
        data_ew.append(float(np.mean(np.sin(gq.az))) if len(gq) else 0.0)
    return dict(quarters=len(meas), corr_measured_vs_intended=corr(meas, intended),
                corr_notes_vs_all_detections_EW=corr(intended, data_ew))


def seamlessness(notes, full):
    out = {}
    for k in ("peking", "panerus"):
        nn = notes[k]
        if len(nn) < 3:
            continue
        m = np.array([x[2] for x in nn]); p = np.array([x[4] for x in nn]); vel = np.array([x[3] for x in nn])
        ts = np.array([x[0] for x in nn])
        out[k] = dict(median_semitone_step=float(np.median(np.abs(np.diff(m)))),
                      median_pan_step_0_127=float(np.median(np.abs(np.diff(np.round(64 + 63 * p))))),
                      median_velocity_step_0_127=float(np.median(np.abs(np.diff(np.round(vel * 127))))),
                      gaps_over_1s=int((np.diff(ts) > 1).sum()), longest_gap_s=round(float(np.diff(ts).max()), 2))
    x = full.mean(0)
    f = int(0.05 * SR)
    r = np.sqrt((x[:len(x) // f * f].reshape(-1, f) ** 2).mean(1))
    db = 20 * np.log10(r + 1e-9)[int(C.INTRO / 0.05):-int(C.TAIL / 0.05)]
    out["mix"] = dict(frames_below_minus40dBFS=round(float((db < -40).mean()), 3),
                      jumps_over_6dB_per_s=round(float((np.abs(np.diff(db)) > 6).sum() / (len(db) * 0.05)), 2))
    return out


def pitch(notes):
    midis = [x[2] for k in C.LAYERS for x in notes[k]]
    return dict(lowest_hz=round(440 * 2 ** ((min(midis) - 69) / 12), 1), highest_hz=round(440 * 2 ** ((max(midis) - 69) / 12), 1),
                inside_A1_C8=bool(min(midis) >= 33 and max(midis) <= 108),
                pitch_classes_ok=set(m % 12 for m in midis) <= {1, 3, 6, 8, 11})


def _peak_db(x, t0, t1):
    a, b = int(max(t0, 0) * SR), int(max(t1, 0) * SR)
    seg = x[:, a:b]
    return round(float(20 * np.log10(np.abs(seg).max() + 1e-12)), 1) if seg.size else None


def intro_layout(full, layers, data_start, first):
    """Peak level (dBFS) of every file during the compass (0-2.6 s) and during the silent delay before the data
    (lead-in excluded). Expected: compass heard in combined, peking and panerus; the other layers silent."""
    quiet_end = data_start - (0.0 if first else C.SLICE_PREROLL_S)
    files = dict(combined=full, **layers)
    return {k: dict(compass_dbfs=_peak_db(x, 0.0, C.COMPASS_S), delay_dbfs=_peak_db(x, C.COMPASS_S + 1.3, quiet_end))
            for k, x in files.items()}


def slice_check(label, D, i0, i1, sc, spd, sds, sfull, slayers, full, n, compass=True):
    """One slice vs. the unsliced piece.

    content_vs_unsliced_residual_db: level of (slice - unsliced) relative to the unsliced signal over the slice's
    data, skipping the first 3.5 s (the unsliced piece still rings with the previous period there; 0.5 s for the
    first slice) and, for the last slice, the final 3.5 s (the unsliced piece fades out there).
    Very negative = the slice's content is the full piece's content.
    """
    dur_data = (i1 - i0) * spd
    skip0 = 0.5 if i0 == 0 else 3.5
    skip1 = 3.5 if i1 == n else 0.1
    a0, a1 = int((sds + skip0) * SR), int((sds + dur_data - skip1) * SR)
    off = int(round((C.INTRO + i0 * spd) * SR)) - int(round(sds * SR))     # same exact sample shift as arrange.render
    s = sfull[:, a0:a1]
    u = full[:, a0 + off:a1 + off]
    resid = 20 * np.log10(np.sqrt(((s - u) ** 2).mean()) / (np.sqrt((u ** 2).mean()) + 1e-12) + 1e-12)
    gd = [str(D.date[g["day"]].date()) for g in sc["gongs"] if i0 <= g["day"] < i1]
    pre = 0.0 if i0 == 0 else C.SLICE_PREROLL_S
    if compass:
        intro = intro_layout(sfull, slayers, sds, first=(i0 == 0))
    else:   # no compass: before the data only the rebab lead-in may sound
        files = dict(combined=sfull, **slayers)
        intro = dict(compass="none", before_data_dbfs={k: _peak_db(x, 0.0, sds) for k, x in files.items()})
    return dict(label=label, compass=compass, first_day=str(D.date[i0].date()), last_day=str(D.date[i1 - 1].date()), days=i1 - i0,
                duration_s=round(sfull.shape[1] / SR, 2), data_starts_at_s=round(sds, 2),
                lead_in_fade_s=0.0 if i0 == 0 else C.SLICE_PREROLL_S, end_fade_s=C.SLICE_FADE_OUT_S,
                gong_dates=gd, gong_at_slice_start=bool(gd and gd[0] == str(D.date[i0].date())),
                content_vs_unsliced_residual_db=round(float(resid), 1),
                last_5ms_dbfs=_peak_db(sfull, sfull.shape[1] / SR - 0.005, sfull.shape[1] / SR),
                intro=intro)
