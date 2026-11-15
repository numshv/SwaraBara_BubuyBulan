"""Phase 4 - mastering: one shared room -> bus compression -> loudness normalization -> peak limiter -> fades.

render_layers() masters the combined mix and derives every single-layer file with the SAME reverb, the same
average compression gain and the same loudness gain, so the layers keep the level they have inside the mix.
"""
import numpy as np
from scipy.ndimage import maximum_filter1d
from scipy.signal import butter, fftconvolve, lfilter, sosfilt

import config as C
from synth import SR


def reverb(x, seconds=1.8, wet=0.18, seed=7):
    """Synthetic hall: decorrelated exponentially-decaying noise IR per channel, darkened (5 kHz low-pass)."""
    rng = np.random.default_rng(seed)
    t = np.arange(int(seconds * SR)) / SR
    out = np.empty_like(x)
    for ch in range(2):
        ir = rng.standard_normal(len(t)) * np.exp(-t * 6.9 / seconds)
        ir = sosfilt(butter(1, 5000, fs=SR, output="sos"), ir)
        ir /= np.sqrt((ir ** 2).sum())
        out[ch] = fftconvolve(x[ch], ir)[:x.shape[1]]
    return (1 - wet) * x + wet * out


def compress(x, threshold_db=-20, ratio=2.5, attack=0.01, release=0.25):
    """Feed-forward RMS compressor, stereo-linked (the same gain on both ears keeps the binaural level cues)."""
    lvl = (x ** 2).mean(0)
    a, r = np.exp(-1 / (attack * SR)), np.exp(-1 / (release * SR))
    env = lfilter([1 - r], [1, -r], lfilter([1 - a], [1, -a], lvl))
    db = 10 * np.log10(env + 1e-12)
    gain_db = np.minimum(0, (threshold_db - db) * (1 - 1 / ratio))
    return x * 10 ** (gain_db / 20)


def _shelf(f0=1681.0, gain_db=4.0, q=0.707):
    """RBJ high-shelf biquad (approximation of the ITU-R BS.1770 K-weighting pre-filter)."""
    A, w = 10 ** (gain_db / 40), 2 * np.pi * f0 / SR
    al = np.sin(w) / (2 * q)
    c = np.cos(w)
    b = [A * ((A + 1) + (A - 1) * c + 2 * np.sqrt(A) * al), -2 * A * ((A - 1) + (A + 1) * c),
         A * ((A + 1) + (A - 1) * c - 2 * np.sqrt(A) * al)]
    a = [(A + 1) - (A - 1) * c + 2 * np.sqrt(A) * al, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - 2 * np.sqrt(A) * al]
    return np.array(b) / a[0], np.array(a) / a[0]


def loudness_lufs(x):
    """Approximate integrated loudness (K-weighted, 400 ms blocks with 75 % overlap, -70 LUFS absolute gate)."""
    b, a = _shelf()
    k = sosfilt(butter(2, 38, btype="high", fs=SR, output="sos"), lfilter(b, a, x, axis=1), axis=1)
    n = int(0.4 * SR)
    blocks = [(k[:, i:i + n] ** 2).mean(1).sum() for i in range(0, k.shape[1] - n, n // 4)]
    blocks = np.array([v for v in blocks if -0.691 + 10 * np.log10(v + 1e-12) > -70])
    return float(-0.691 + 10 * np.log10(blocks.mean() + 1e-12)) if len(blocks) else -70.0


def limit(x, ceiling_db=-1.0, release=0.08):
    """Peak limiter: gain = ceiling/peak (5 ms look-around), 80 ms smooth recovery."""
    ceil = 10 ** (ceiling_db / 20)
    peak = maximum_filter1d(np.abs(x).max(0), size=int(0.005 * SR))
    g = np.minimum(1, ceil / np.maximum(peak, 1e-9))
    r = np.exp(-1 / (release * SR))
    g = 1 - lfilter([1 - r], [1, -r], 1 - g)
    g = np.minimum(g, np.minimum(1, ceil / np.maximum(peak, 1e-9)))
    return np.clip(x * g, -ceil, ceil)


def fades(x, fade_in=0.5, fade_out=2.0):
    n = x.shape[1]
    env = np.ones(n)
    i, o = int(fade_in * SR), int(fade_out * SR)
    env[:i] = np.linspace(0, 1, i)
    env[-o:] = np.minimum(env[-o:], np.linspace(1, 0, o))
    return x * env


def render_layers(dry, layers, gains=None, fade_out=3.0):
    """dry: buffer -> (2, N) from arrange.render. -> (combined, {layer: mastered layer file}, wet, gains).

    combined  = fades(limit(compress(sum(reverb(b))) * g))        b over 'compass' + the 6 layers; g: gain to TARGET_LUFS
    layer k   = fades(limit((reverb(k) + reverb(compass_k)) * gc * g))
                gc: RMS ratio compressed/uncompressed mix; compass_k exists for peking and panerus (the instruments
                that play the compass), so those two files carry the compass and the others are silent there.
    gains     = (g, gc). Pass the full piece's gains when mastering a slice, so a slice keeps the full piece's level.
    """
    wet = {k: reverb(dry[k], seconds=C.REVERB_S, wet=C.REVERB_WET) for k in dry}   # reverb is linear
    mixr = sum(wet[k] for k in ["compass"] + list(layers))
    comp = compress(mixr)
    if gains is None:
        gc = np.sqrt((comp ** 2).mean() / (mixr ** 2).mean())
        g = 10 ** ((C.TARGET_LUFS - loudness_lufs(comp)) / 20)
    else:
        g, gc = gains
    full = fades(limit(comp * g), fade_in=0.02, fade_out=fade_out)
    out = {}
    for k in layers:
        x = wet[k] + wet["compass_" + k] if ("compass_" + k) in wet else wet[k]
        out[k] = fades(limit(x * gc * g), fade_in=0.02, fade_out=fade_out)
    return full, out, wet, (g, gc)
