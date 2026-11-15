"""Phase 3b - synthesis: Sundanese degung voices + rebab, binaural renderer, stereo mixer, WAV export.

All voices are synthesized in numpy (no samples). Pitches come from mappings.deg_hz (12-TET Ab minor pentatonic).
"""
import numpy as np
from scipy.io import wavfile
from scipy.signal import bilinear, butter, lfilter, sosfilt

import config as C

SR = C.SR


def _t(dur):
    return np.arange(int(dur * SR)) / SR


# ---------------------------------------------------------------- struck voices
def fm_bell(f, dur=1.5, amp=0.3, ratio=3.5, index=3.0, decay=3.0):
    """Metallophone bar: two-operator FM, bright attack (index decays fast) that mellows."""
    t = _t(dur)
    env = amp * np.exp(-decay * t) * np.minimum(1, t / 0.003)
    mod = index * np.exp(-8 * t) * np.sin(2 * np.pi * f * ratio * t)
    return env * np.sin(2 * np.pi * f * t + mod)


def peking(f, amp):
    """Peking (smallest saron): bar partial ratio 2.76, 1.2 s ring."""
    return fm_bell(f, dur=1.2, amp=amp, ratio=2.76, index=1.2, decay=3.0)


def panerus(f, amp):
    """Saron panerus: one octave below peking, a little darker, 1.6 s ring."""
    return fm_bell(f, dur=1.6, amp=amp, ratio=2.76, index=1.8, decay=2.0)


def _kettle(f, dur, amp, decay, partials, strike_band, strike_amp, seed, shimmer=0.0):
    """Kettle gong: decaying partials (ratio, amp, extra decay) + band-passed mallet noise (+ optional beating)."""
    t = _t(dur)
    s = sum(a * np.exp(-dk * t) * np.sin(2 * np.pi * f * r * t) for r, a, dk in partials)
    if shimmer:
        s += shimmer * np.sin(2 * np.pi * (f + 2.2) * t)
    noise = np.random.default_rng(seed).standard_normal(len(t)) * np.exp(-60 * t)
    strike = sosfilt(butter(2, strike_band, btype="band", fs=SR, output="sos"), noise)
    return amp * np.minimum(1, t / 0.004) * np.exp(-decay * t) * (s / 1.5 + strike_amp * strike)


def bonang(f, amp, dur, seed=0):
    """Bonang kettle, damped by the player after `dur` seconds (45-60 ms release)."""
    x = _kettle(f, 1.6, amp, 2.4, [(1, 1, 0), (2.02, 0.35, 2.0), (3.4, 0.15, 4.0)], [400, 2500], 0.3, seed)
    t = _t(len(x) / SR)
    env = np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.06))
    return (x * env)[:int((dur + 0.35) * SR)]


def jenglong(f, amp, seed=0):
    """Jenglong: low hanging kettle, round and long (3 s), slight 2.2 Hz beating."""
    return _kettle(f, 3.0, amp, 0.9, [(1, 1, 0), (2.0, 0.3, 1.2), (2.98, 0.15, 2.0)], [150, 900], 0.25, seed, 0.25)


GONG_PARTIALS = [(1.0, 0.6, 0.8), (1.007, 0.4, 0.8), (2.02, 0.6, 1.0), (2.93, 0.7, 1.1),
                 (4.12, 0.7, 1.3), (5.40, 0.55, 1.5), (6.85, 0.4, 1.9), (8.6, 0.25, 2.4)]


def gong(f=58.0, dur=4.0, amp=0.5, seed=0):
    """Goong: low fundamental + 1.007 'ombak' beating + inharmonic upper partials + padded-mallet strike."""
    t = _t(dur)
    s = sum(a * np.exp(-d * t) * np.sin(2 * np.pi * f * r * t) for r, a, d in GONG_PARTIALS)
    noise = np.random.default_rng(seed).standard_normal(len(t)) * np.exp(-40 * t)
    strike = sosfilt(butter(2, [200, 1500], btype="band", fs=SR, output="sos"), noise)
    return amp * np.minimum(1, t / 0.008) * (s / 2.2 + 0.5 * strike)


# ---------------------------------------------------------------- bowed voice
def rebab(t0, t1, onsets, level_at, f0, seed=0):
    """Continuous rebab tone on f0 from t0 to t1 (s). Each onset = bow change: 30 ms dip, accent, bow noise.

    Source: 18-harmonic sawtooth-like wave (1/h^1.1) with 5.2 Hz vibrato (+-0.16 st) and slow intonation drift,
    through three body resonances (560, 1350, 2700 Hz). level_at(t) sets the loudness; 1.5 s fade-in, 3 s fade-out.
    """
    rng = np.random.default_rng(seed)
    n = int((t1 - t0) * SR)
    t = np.arange(n) / SR
    drift = np.interp(t, np.linspace(0, t[-1], 60), rng.normal(0, 0.04, 60))
    semis = 0.16 * np.sin(2 * np.pi * 5.2 * t) + drift
    ph = 2 * np.pi * np.cumsum(f0 * 2 ** (semis / 12)) / SR
    x = sum(np.sin(h * ph) / h ** 1.1 for h in range(1, 19))
    body = sum(g * sosfilt(butter(2, [fc * 0.8, fc * 1.25], btype="band", fs=SR, output="sos"), x)
               for fc, g in ((560, 1.0), (1350, 0.75), (2700, 0.45)))
    x = 0.25 * x + body
    env = np.ones(n)
    noise = np.zeros(n)
    nz = sosfilt(butter(2, [2000, 6000], btype="band", fs=SR, output="sos"), rng.standard_normal(int(0.2 * SR)))
    for o in onsets:
        i = int((o - t0) * SR)
        a, b = max(0, i - int(0.06 * SR)), min(n, i + int(0.25 * SR))
        tau = (np.arange(a, b) - i) / SR
        env[a:b] *= 1 - 0.45 * np.exp(-(tau / 0.03) ** 2) + 0.15 * np.exp(-np.maximum(tau, 0) / 0.08) * (tau > 0)
        m = min(len(nz), n - i)
        if m > 0:
            noise[i:i + m] += nz[:m] * np.exp(-np.arange(m) / SR / 0.035)
    lvl = level_at(t0 + t)
    fade = np.minimum(1, t / 1.5) * np.clip((t[-1] - t) / 3.0, 0, 1)
    return (x / np.abs(x).max() + 0.25 * noise / (np.abs(noise).max() + 1e-9)) * env * lvl * fade


# ---------------------------------------------------------------- binaural renderer (Brown & Duda 1998 head model)
_HP_BACK = butter(2, 2500, btype="high", fs=SR, output="sos")


def _shadow(x, theta_deg, alpha_min=0.1, theta_min=150.0):
    """Head-shadow filter for one ear; theta = angle between the source and that ear's axis."""
    alpha = (1 + alpha_min / 2) + (1 - alpha_min / 2) * np.cos(np.radians(theta_deg / theta_min * 180))
    w0 = C.SOUND_C / C.HEAD_A
    b, a = bilinear([alpha / (2 * w0), 1], [1 / (2 * w0), 1], fs=SR)
    return lfilter(b, a, x)


def binauralize(sig, az, dist_km, dmax_km):
    """Mono -> (2, N). az: radians, 0 = front (north), + = right (east)."""
    dn = float(np.clip(dist_km / dmax_km, 0, 1))
    x = sig * (1.0 / (1 + 1.6 * dn))                                     # distance -> level
    fc = 16000 * (2500 / 16000) ** dn                                    # distance -> air absorption
    x = sosfilt(butter(1, fc, fs=SR, output="sos"), x)
    back = max(0.0, -np.cos(az))                                         # 0 front .. 1 straight behind
    if back > 0:
        x = x - 0.55 * back * sosfilt(_HP_BACK, x)                       # pinna shadow for rear sources
    s = np.sin(az)
    theta_r, theta_l = np.degrees(np.arccos(np.clip(s, -1, 1))), np.degrees(np.arccos(np.clip(-s, -1, 1)))
    lat = abs(np.arcsin(np.clip(s, -1, 1)))
    itd = int(round(C.HEAD_A / C.SOUND_C * (lat + np.sin(lat)) * SR))   # Woodworth ITD, samples
    L, R = _shadow(x, theta_l), _shadow(x, theta_r)
    pad = np.zeros(itd)
    if s >= 0:                                                            # source right -> left ear later
        L, R = np.r_[pad, L], np.r_[R, pad]
    else:
        L, R = np.r_[L, pad], np.r_[pad, R]
    return np.stack([L, R])


# ---------------------------------------------------------------- mixer
class Mix:
    def __init__(self, dur):
        self.buf = np.zeros((2, int(dur * SR) + SR * 5))

    def add(self, sig, start, pan=0.0, index=None):
        """Equal-power pan: -1 = hard left, +1 = hard right (0 = centre, used for all non-VIIRS layers).
        index (samples) overrides start (s) - used for slices so notes shift by a whole number of samples."""
        a = (pan + 1) * np.pi / 4
        i = int(start * SR) if index is None else index
        n = min(len(sig), self.buf.shape[1] - i)
        self.buf[0, i:i + n] += np.cos(a) * sig[:n]
        self.buf[1, i:i + n] += np.sin(a) * sig[:n]

    def add_stereo(self, y, start, index=None):
        i = int(start * SR) if index is None else index
        m = min(y.shape[1], self.buf.shape[1] - i)
        self.buf[:, i:i + m] += y[:, :m]

    def audio(self, length_s):
        return self.buf[:, :int(length_s * SR)]


# ---------------------------------------------------------------- export
def write_wav(path, x):
    """16-bit PCM WAV with TPDF dither (lossless: keeps interaural time/level cues intact)."""
    rng = np.random.default_rng(0)
    d = (rng.random(x.shape) - rng.random(x.shape)) / 32768
    wavfile.write(path, SR, (np.clip(x + d, -1, 1) * 32767).round().astype(np.int16).T)
