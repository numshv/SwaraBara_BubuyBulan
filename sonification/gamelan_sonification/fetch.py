"""Phase 1 - data acquisition: read the four local datasets into pandas, with a common `date` column.

  VIIRS     viirs_n20_indonesia_<YEAR>_clean.csv  (folder or .zip)  -> one row per fire detection
  AOT       merra2_aot_oc_indonesia_monthly.csv                     -> one row per month
  CO        co_merra2_monthly.csv                                   -> one row per month
  ENSO/IOD  enso_iod.csv                                            -> one row per week
"""
import io
import zipfile
from pathlib import Path

import pandas as pd

VIIRS_COLS = ["latitude", "longitude", "bright_ti4", "bright_ti5", "frp", "acq_date"]


def viirs(src):
    """All detections, files in year order. `src` is a folder or a .zip holding the yearly CSVs."""
    src = Path(src)
    if src.suffix == ".zip":
        with zipfile.ZipFile(src) as z:
            names = sorted(n for n in z.namelist() if Path(n).name.startswith("viirs_n20_indonesia_") and n.endswith("_clean.csv"))
            parts = [pd.read_csv(io.BytesIO(z.read(n)), usecols=VIIRS_COLS) for n in names]
    else:
        parts = [pd.read_csv(f, usecols=VIIRS_COLS) for f in sorted(src.glob("viirs_n20_indonesia_*_clean.csv"))]
    if not parts:
        raise SystemExit(f"no viirs_n20_indonesia_<YEAR>_clean.csv found in {src}")
    d = pd.concat(parts, ignore_index=True)
    d["date"] = pd.to_datetime(d.pop("acq_date"))
    return d


def aot(path):
    a = pd.read_csv(path)
    a["date"] = pd.to_datetime(a.date) + pd.Timedelta(days=14)      # monthly value anchored mid-month
    return a


def co(path):
    c = pd.read_csv(path)
    c["date"] = pd.to_datetime(c.date) + pd.Timedelta(days=14)      # monthly value anchored mid-month
    return c


def enso_iod(path):
    e = pd.read_csv(path)
    e["date"] = pd.to_datetime(e.date).dt.normalize()               # weekly value at its own date
    return e
