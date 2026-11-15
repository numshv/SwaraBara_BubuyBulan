"""Phase 2 - feature extraction: raw tables -> region-specific, date-aligned features.

  * region of every VIIRS detection (lon/lat rules, precedence order)
  * position of every detection relative to the region's listener: azimuth (0 = N, +90 = E) and distance (km)
  * national scales (p1/p99) for bright_ti4, bright_ti5 and log(1+frp): one value -> same pitch/volume everywhere
  * one row per DAY of the window: daily detection count + AOT, CO, ENSO, IOD interpolated on the date axis (PCHIP)
"""
import numpy as np
import pandas as pd
from scipy.interpolate import PchipInterpolator

import config as C
import fetch


# ---------------------------------------------------------------- regions
def assign_region(lon, lat):
    """Island-group rules applied in precedence order (first match wins).

    Kalimantan (Indonesian part; Sulawesi's west coast excluded) > Bali-Nusa Tenggara > Jawa (incl. Madura, Kangean,
    Thousand Is.) > Papua (incl. Raja Ampat, Fakfak; Seram excluded) > Maluku (North + South; North Sulawesi and
    Sangihe-Talaud excluded) > Sumatra (incl. Riau Is., Bangka-Belitung, Natuna) > Sulawesi (incl. Buton, Wakatobi,
    Selayar). Anything left is 'Unassigned' (2 open-sea points in 2018-2025) and only counts towards Indonesia.
    """
    lon, lat = np.asarray(lon), np.asarray(lat)
    out = np.full(lon.shape, "Unassigned", dtype=object)
    free = np.ones(lon.shape, bool)

    def take(name, m):
        nonlocal free
        m = m & free
        out[m] = name
        free &= ~m

    take("Kalimantan", (lon > 108.5) & (lon < 119.3) & (lat > -4.25) & (lat < 4.5) & ~((lon >= 118.0) & (lat < 0.3)))
    take("Bali_NusaTenggara", (lon >= 114.45) & (lon < 125.3) & (lat < -7.9) & (lat > -11.5))
    take("Jawa", (lon >= 105.0) & (lon < 116.0) & (lat < -5.4) & (lat > -9.0) & ((lon >= 106.2) | (lat < -5.9)))
    seram = (lat < -2.7) & (lon < 131.0)
    take("Papua", ((lon >= 129.3) & (lat > -4.0) & ~seram) | ((lon >= 135.5) & (lat <= -4.0)))
    n_sul = ((lat > 0.3) & (lon < 126.0)) | ((lat > 3.3) & (lon < 127.3))
    take("Maluku", (lon >= 124.3) & ~n_sul & (lat > -9.0))
    take("Sumatra", (lon < 109.0) & (lat > -6.0))
    take("Sulawesi", (lon >= 118.0) & (lon < 127.3) & (lat > -7.9) & (lat < 5.0))
    return out


def viirs_with_regions(src):
    """All detections + `region` column, cached as a pickle (built once from the CSVs)."""
    p = C.CACHE / "viirs_regions.pkl"
    if p.exists():
        return pd.read_pickle(p)
    d = fetch.viirs(src)
    d["region"] = assign_region(d.longitude.values, d.latitude.values)
    C.CACHE.mkdir(parents=True, exist_ok=True)
    d.to_pickle(p)
    return d


# ---------------------------------------------------------------- geometry
def polar(lat, lon, centre):
    """Equirectangular offsets from the listener -> (azimuth rad: 0 = N, +pi/2 = E; distance km)."""
    lon0, lat0 = centre
    dx = (np.asarray(lon) - lon0) * 111.32 * np.cos(np.radians(lat0))
    dy = (np.asarray(lat) - lat0) * 110.57
    return np.arctan2(dx, dy), np.hypot(dx, dy)


def compass(az):
    return C.COMPASS[int(round(np.degrees(az) % 360 / 45)) % 8]


# ---------------------------------------------------------------- date axis
def series(df, col, days, start):
    """Monotone cubic (PCHIP) interpolation of one column onto the daily axis (no overshoot, no corners)."""
    x = (df.date - start).dt.days.values.astype(float)
    y = df[col].values.astype(float)
    o = np.argsort(x)
    return PchipInterpolator(x[o], y[o], extrapolate=True)((days - start).days.values.astype(float))


def build(region, start, end, paths):
    """-> v (detections in region+window, with az/km), D (one row per day), nat (national scales), raw (tables)."""
    allv = viirs_with_regions(paths["viirs"])
    nat = dict(p4=np.percentile(allv.bright_ti4, [1, 99]), p5=np.percentile(allv.bright_ti5, [1, 99]),
               pf=np.percentile(np.log1p(allv.frp), [1, 99]))
    v = allv if region == "Indonesia" else allv[allv.region == region]
    v = v[(v.date >= start) & (v.date <= end)].sort_values("date").reset_index(drop=True)
    v["az"], v["km"] = polar(v.latitude.values, v.longitude.values, C.CENTRE[region])
    days = pd.date_range(start, end, freq="D")

    a, co, e = fetch.aot(paths["aot"]), fetch.co(paths["co"]), fetch.enso_iod(paths["enso"])
    co_col = C.CO_COLUMN.get(region, "co_Indonesia")
    D = pd.DataFrame(dict(date=days,
                          aot_norm=series(a, f"{region}_norm", days, start),
                          aot_lognorm=series(a, f"{region}_lognorm", days, start),
                          aot_anom=series(a, f"{region}_anomaly_norm", days, start),
                          co=series(co, co_col, days, start),
                          enso=series(e, "enso", days, start), iod=series(e, "iod", days, start)))
    D["count"] = v.groupby("date").size().reindex(days, fill_value=0).values
    raw = dict(aot=a, co=co, enso=e, co_col=co_col)
    return v, D, nat, raw
