"""Phase 3c - arrangement: features -> a SCORE (timed note events on one continuous date axis) -> rendered layers.

    t(date) = INTRO + (date - start).days * sec_per_day          (INTRO = compass 2.6 s + delay 2.0 s)

No bars and no grid: every layer's onsets come from a continuous-rate accumulator (an onset each time the integral of
its rate crosses a whole number), with the rate interpolated between day centres.

score()  decides every note once (all random choices happen here, seeded), and synthesizes the continuous rebab.
render() turns the score into one dry stereo buffer per layer, either for the whole window or for a SLICE
         (a run of whole days). A slice holds exactly the notes whose onset day lies inside it, so the same note
         sounds identical in the full piece and in its slice.
"""
import numpy as np

import config as C
import mappings as M
import synth as S
from synth import SR

# dry buffers: 'compass' feeds the combined mix; its peking/panerus parts feed those two layer files
BUFFERS = ("compass", "compass_peking", "compass_panerus", "peking", "panerus", "bonang", "jenglong", "rebab", "gong")


def accumulate(rate, n_days, spd, dt=0.004):
    """Onset times (s, relative to day 0) for a per-day rate array (notes/s)."""
    ts = np.arange(0, n_days * spd, dt)
    r = np.interp(ts, (np.arange(n_days) + 0.5) * spd, rate)
    k = np.floor(np.cumsum(r * dt))
    return ts[np.nonzero(np.diff(k, prepend=0) > 0)[0]]


def segment_key(d, seg):
    return d.year if seg == "year" else (d.year, (d.month - 1) // 3) if seg == "quarter" else (d.year, d.month)


def score(v, D, nat, spd, seg, walk_deg):
    """-> dict(events, notes, gongs, rebab, t0, n, spd, dmax, fire_n).

    events = [(layer, day_index or None, t, kind, params)] in generation order (compass events have day None).
    notes[layer] = [(t, dur, midi_note, velocity 0..1, pan -1..1 or None)]: internal note record for the checks.
    """
    n = len(D)
    events = []
    notes = {k: [] for k in ("compass", "peking", "panerus", "bonang", "jenglong", "rebab", "gong")}
    day_of = lambda t: np.clip(((np.asarray(t) - C.INTRO) / spd).astype(int), 0, n - 1)
    dmax = max(float(np.percentile(v.km, C.DMAX_PCTL)) if len(v) else 500.0, C.DMAX_MIN_KM)

    def ev(layer, day, t, kind, params, note):
        events.append((layer, day, t, kind, params))
        notes[layer].append((t,) + note)

    # ---- 1. compass calibration: N NE E SE S SW W NW, clockwise, rising (peking + panerus)
    for k, _ in enumerate(C.COMPASS):
        dd = 20 + k
        ev("compass", None, 0.1 + k * 0.29, "compass", (dd, np.radians(45 * k)),
           (0.25, M.deg_midi(dd), 0.75, float(np.sin(np.radians(45 * k)))))

    # ---- 2. VIIRS -> peking (ti4) + panerus (ti5): soft-continuity walk through the day's real detections
    fire_n, present = M.fire_density(D["count"].values, spd)
    rates = M.viirs_rates(fire_n)
    vday = ((v.date - D.date[0]).dt.days.values) if len(v) else np.array([], int)
    starts = np.searchsorted(vday, np.arange(n + 1))                     # detections of day i: starts[i]..starts[i+1]
    tab = M.detection_table(v, nat)
    rng = np.random.default_rng(5)

    def pool(i):
        """Up to CANDIDATES random detections of day i (widening to +-1, 2, 4 days if the day is empty)."""
        for w in (0, 1, 2, 4):
            a, b = starts[max(0, i - w)], starts[min(n, i + w + 1)]
            if b > a:
                return rng.integers(a, b, size=min(C.CANDIDATES, b - a) if b - a < C.CANDIDATES else C.CANDIDATES)
        return None

    for layer, key, dur_note in (("peking", "d4", C.PEKING_NOTE_S), ("panerus", "d5", C.PANERUS_NOTE_S)):
        prev = None
        for t in accumulate(np.where(present, rates[layer], 0), n, spd) + C.INTRO:
            day = int(day_of(t))
            c = pool(day)
            if c is None:
                continue
            if prev is None:
                j = c[0]
            else:
                dd = tab[key][c]
                dang = np.degrees(np.abs(np.angle(np.exp(1j * (tab["az"][c] - tab["az"][prev])))))
                cost = (np.abs(dd - tab[key][prev]) + C.REPEAT_COST * (dd == tab[key][prev]) + dang / walk_deg
                        + C.FRP_COST * np.abs(tab["vn"][c] - tab["vn"][prev]))
                p_ = np.exp(-(cost - cost.min()) / C.WALK_TEMP)
                j = c[int(rng.choice(len(c), p=p_ / p_.sum()))]
            prev = j
            d_, vn = int(tab[key][j]), float(tab["vn"][j])
            ev(layer, day, t, layer, (d_, vn, float(tab["az"][j]), float(tab["km"][j])),
               (dur_note, M.deg_midi(d_), 0.15 + 0.85 * vn, float(np.sin(tab["az"][j]))))

    # ---- 3. CO -> rebab on the root Ab3: bow-change density + light volume, one continuous tone
    co_n = M.co_norm(D.co)
    on = accumulate(M.rebab_rate(co_n.values), n, spd) + C.INTRO
    tc = C.INTRO + (np.arange(n) + 0.5) * spd
    level = lambda tt: M.rebab_level(np.interp(tt, tc, co_n.values))
    t0, t1 = C.INTRO, C.INTRO + n * spd + 2.5
    rebab = S.rebab(t0, t1, on, level, M.deg_hz(C.REBAB_DEG))
    for o, o2 in zip(on, list(on[1:]) + [t1]):
        c = float(np.interp(o, tc, co_n.values))
        notes["rebab"].append((o, max(0.05, o2 - o), M.deg_midi(C.REBAB_DEG), 0.35 + 0.4 * c, None))

    # ---- 4. AOT -> bonang: norm = pitch, lognorm = duration, anomaly_norm = volume
    amax = max(float(np.abs(D.aot_anom).max()), 1e-9)
    for k, t in enumerate(accumulate(np.full(n, C.BONANG_RATE), n, spd) + C.INTRO):
        i = int(day_of(t))
        d_, dur, db = M.bonang_params(D.aot_norm[i], D.aot_lognorm[i], D.aot_anom[i], amax)
        ev("bonang", i, t, "bonang", (d_, dur, db, k), (dur, M.deg_midi(d_), float(np.clip((db + 12) / 24, 0.05, 1)), None))

    # ---- 5. ENSO/IOD -> jenglong: enso = pitch, iod = volume
    for k, t in enumerate(accumulate(np.full(n, C.JENGLONG_RATE), n, spd) + C.INTRO):
        i = int(day_of(t))
        d_, db = M.jenglong_params(D.enso[i], D.iod[i])
        ev("jenglong", i, t, "jenglong", (d_, db, k), (1.3, M.deg_midi(d_), float(np.clip((db + 9) / 21, 0.05, 1)), None))

    # ---- 6. gong: ONLY when the periodic segment of the date changes (onset = first day of the new segment)
    gongs = []
    for i in range(1, n):
        if segment_key(D.date[i], seg) != segment_key(D.date[i - 1], seg):
            t = C.INTRO + i * spd
            ev("gong", i, t, "gong", (), (3.0, M.deg_midi(C.GONG_DEG), 1.0, None))
            gongs.append(dict(t=round(t, 2), date=str(D.date[i].date()), day=i))
    return dict(events=events, notes=notes, gongs=gongs, rebab=rebab, t0=t0, n=n, spd=spd, dmax=dmax, fire_n=fire_n)


def _place(sig, az, km, dmax):
    return M.place(sig, az, km, dmax)


def render(sc, window=None, compass=True):
    """-> (dry: buffer -> (2, N), length T, data_start).

    window None          : the whole piece; data starts at INTRO (4.6 s), TAIL (4 s) after the last day.
    window (i0, i1)      : days i0..i1-1. With compass=True (first slice): compass + 2 s silence first; with
                           compass=False (later slices): no compass and no delay (unless
                           SLICE_DELAY_WITHOUT_COMPASS). Then, except when i0 = 0, a SLICE_PREROLL_S lead-in where
                           only the continuous rebab fades in; then the days; then SLICE_FADE_OUT_S of ring-out
                           (faded later in mastering). Events whose onset day is outside the window are left out,
                           so the fades never touch the slice's own notes.
    """
    n, spd, dmax = sc["n"], sc["spd"], sc["dmax"]
    if window is None:
        i0, i1, pre = 0, n, 0.0
        data_start = C.INTRO
        T = C.INTRO + n * spd + C.TAIL
        shift = None
    else:
        i0, i1 = window
        pre = 0.0 if i0 == 0 else C.SLICE_PREROLL_S
        head = C.INTRO if compass else (C.DELAY_S if C.SLICE_DELAY_WITHOUT_COMPASS else 0.0)
        data_start = head + pre
        T = data_start + (i1 - i0) * spd + C.SLICE_FADE_OUT_S
        # exact sample shift: full-piece sample F -> slice sample F + shift (so every note is sample-identical)
        shift = int(round(data_start * SR)) - int(round((C.INTRO + i0 * spd) * SR))
    L = {k: S.Mix(T) for k in BUFFERS}

    for layer, day, t, kind, p in sc["events"]:
        if day is not None and not (i0 <= day < i1):
            continue
        if day is None and not compass:
            continue
        ts = t
        ix = None if (shift is None or day is None) else int(t * SR) + shift
        if kind == "compass":
            dd, az = p
            sig = np.zeros(int(1.6 * SR))
            a_, b_ = S.peking(M.deg_hz(dd), 0.2), S.panerus(M.deg_hz(dd - 5), 0.1)
            sig[:len(a_)] += a_
            sig[:len(b_)] += b_
            L["compass"].add_stereo(_place(sig, az, 0.0, dmax), ts)          # combined mix
            L["compass_peking"].add_stereo(_place(a_, az, 0.0, dmax), ts)    # -> peking layer file
            L["compass_panerus"].add_stereo(_place(b_, az, 0.0, dmax), ts)   # -> panerus layer file (compass: never shifted)
        elif kind in ("peking", "panerus"):
            d_, vn, az, km = p
            voice = S.peking if kind == "peking" else S.panerus
            L[layer].add_stereo(_place(voice(M.deg_hz(d_), M.frp_amp(vn)), az, km, dmax), ts, ix)
        elif kind == "bonang":
            d_, dur, db, k = p
            L[layer].add(S.bonang(M.deg_hz(d_), C.BONANG_AMP * 10 ** (db / 20), dur, seed=k), ts, 0.0, ix)
        elif kind == "jenglong":
            d_, db, k = p
            L[layer].add(S.jenglong(M.deg_hz(d_), C.JENGLONG_AMP * 10 ** (db / 20), seed=k), ts, 0.0, ix)
        elif kind == "gong":
            L[layer].add(S.gong(f=M.deg_hz(C.GONG_DEG), amp=C.GONG_AMP), ts, 0.0, ix)

    rb = sc["rebab"]
    if window is None:
        L["rebab"].add(rb, sc["t0"], 0.0)
    else:
        k = int(round(pre * SR))
        f0 = int(round((C.INTRO + i0 * spd) * SR)) - k                       # first full-piece sample of the lead-in
        a = f0 - int(sc["t0"] * SR)                                          # same sample inside the rebab signal
        m = int(T * SR) - (f0 + shift)
        seg = rb[a:a + m].copy()
        if k > 0:
            seg[:k] *= np.linspace(0, 1, k)                                     # lead-in: rebab fades in
        L["rebab"].add(seg, 0.0, 0.0, f0 + shift)
    return {k: L[k].audio(T) for k in BUFFERS}, T, data_start
