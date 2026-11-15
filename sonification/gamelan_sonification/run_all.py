"""End-to-end run: datasets -> features -> score -> render -> mastering -> WAV files -> checks -> zips.

    python run_all.py --region {Indonesia,Sumatra,Kalimantan,Jawa,Sulawesi,Maluku,Bali_NusaTenggara,Papua,all}
                      [--start 2018-04-01] [--end 2025-12-31] [--segment year|quarter|month]
                      [--max-duration 150] [--spatial-smoothing off|light|strong]
                      [--slices | --sliced-only] [--zip] [--report] [--out output]
                      [--viirs data/viirs_clean] [--aot ...] [--co ...] [--enso ...]

Per region it writes (WAV only)
    output/<Region>/<Region>_<y0>-<y1>_0_combined.wav, _1_peking ... _6_gong.wav           unsliced
    output/<Region>/sliced/<label>/<Region>_<label>_0_combined.wav ... _6_gong.wav        with --slices / --sliced-only
        (compass + 2 s delay only in the FIRST slice; later slices start on a 0.2 s fade-in lead-in)
        labels: Indonesia 2018, 2019, 2020-2022, 2023, 2024, 2025;  other regions 2018-2020, 2021-2023, 2024-2025
    (+ <Region>_<y0>-<y1>_report.json with --report)
and with --zip
    output/zips/unsliced/<NN>_<Region>_<y0>-<y1>_wav.zip          the 7 unsliced WAVs   (NN: 00 = Indonesia ...)
    output/zips/sliced/<NN>_<Region>_sliced_<y0>-<y1>_wav.zip     <Region>/<label>/ x 7 WAVs per slice
"""
import argparse
import json
import zipfile
from pathlib import Path

import pandas as pd

import analysis as A
import arrange as R
import config as C
import features as F
import master as MS
import synth as S


def slice_windows(region, D, start, end):
    """Slice plan -> [(label, i0, i1)] in day indices, clipped to the window."""
    out = []
    for y0, y1 in C.SLICE_PLAN.get(region, C.SLICE_PLAN_DEFAULT):
        a, b = max(start, pd.Timestamp(f"{y0}-01-01")), min(end, pd.Timestamp(f"{y1}-12-31"))
        if a > b:
            continue
        i0, i1 = (a - start).days, (b - start).days + 1
        out.append((str(y0) if y0 == y1 else f"{y0}-{y1}", i0, i1))
    return out


def write_set(folder, tag, full, layers):
    folder.mkdir(parents=True, exist_ok=True)
    S.write_wav(folder / f"{tag}_0_combined.wav", full)
    for i, k in enumerate(C.LAYERS, 1):
        S.write_wav(folder / f"{tag}_{i}_{k}.wav", layers[k])


def run(region, start, end, seg, max_dur, walk_deg, out, paths, slices=False, report=False, sliced_only=False):
    # ---------------------------------------------------------------- 1-2. acquire + features
    v, D, nat, raw = F.build(region, start, end, paths)
    n = len(D)
    spd = C.sec_per_day(n, max_dur)
    # ---------------------------------------------------------------- 3. score (mappings + arrangement) + render
    sc = R.score(v, D, nat, spd, seg, walk_deg)
    dry, T, data_start = R.render(sc)
    # ---------------------------------------------------------------- 4. mastering
    full, layers, wet, gains = MS.render_layers(dry, C.LAYERS)
    dur = full.shape[1] / C.SR
    assert dur < max_dur, dur
    # ---------------------------------------------------------------- 5. export (WAV only)
    tag = f"{region}_{start.year}-{end.year}"
    if not sliced_only:
        write_set(out, tag, full, layers)
    notes = sc["notes"]
    # ---------------------------------------------------------------- 6. checks
    rep = dict(region=region, window=f"{start.date()} .. {end.date()}", segment=seg, days=n, sec_per_day=spd,
               duration_s=round(dur, 2), data_starts_at_s=C.INTRO,
               listener=dict(lon=C.CENTRE[region][0], lat=C.CENTRE[region][1], facing="north"),
               viirs_detections=len(v), co_series=raw["co_col"], gongs=[{k: g[k] for k in ("t", "date")} for g in sc["gongs"]],
               pitch=A.pitch(notes),
               temporal_alignment=A.temporal_alignment(notes, D, raw, region, start, end, spd, sc["fire_n"]),
               yearly_space=A.yearly_space(v, start, end, spd),
               binaural_renderer_check=A.binaural(wet, notes, v, start, end, spd),
               seamlessness=A.seamlessness(notes, full),
               intro=A.intro_layout(full, layers, C.INTRO, first=True),
               layers={k: dict(notes=len(notes[k]), lufs=round(MS.loudness_lufs(layers[k]), 1)) for k in C.LAYERS},
               mix_lufs=round(MS.loudness_lufs(full), 1))
    del dry, wet
    # ---------------------------------------------------------------- 7. sliced versions (same score, same gains)
    if slices:
        rep["slices"] = []
        for si, (label, i0, i1) in enumerate(slice_windows(region, D, start, end)):
            first = si == 0                                              # compass only in the first slice
            sdry, sT, sds = R.render(sc, (i0, i1), compass=first)
            sfull, slayers, _, _ = MS.render_layers(sdry, C.LAYERS, gains=gains, fade_out=C.SLICE_FADE_OUT_S)
            write_set(out / "sliced" / label, f"{region}_{label}", sfull, slayers)
            rep["slices"].append(A.slice_check(label, D, i0, i1, sc, spd, sds, sfull, slayers, full, n, compass=first))
            del sdry, sfull, slayers
    if report:
        (out / f"{tag}_report.json").write_text(json.dumps(rep, indent=1, default=str))
    return rep


def package(out_root, regions, start, end, slices, sliced_only=False):
    """unsliced: one zip per region with its 7 WAVs; sliced: one zip per region with <Region>/<label>/ folders."""
    kinds = ("sliced",) if sliced_only else ("unsliced", "sliced") if slices else ("unsliced",)
    for kind in kinds:
        zdir = out_root / "zips" / kind
        zdir.mkdir(parents=True, exist_ok=True)
        for r in regions:
            i = C.REGIONS.index(r)
            if kind == "unsliced":
                z = zdir / f"{i:02d}_{r}_{start.year}-{end.year}_wav.zip"
                files = [(f, f"{r}/{f.name}") for f in sorted((out_root / r).glob(f"{r}_{start.year}-{end.year}_*.wav"))]
            else:
                z = zdir / f"{i:02d}_{r}_sliced_{start.year}-{end.year}_wav.zip"
                files = [(f, f"{r}/{f.parent.name}/{f.name}") for f in sorted((out_root / r / "sliced").glob("*/*.wav"))]
            with zipfile.ZipFile(z, "w", zipfile.ZIP_STORED) as zf:
                for f, arc in files:
                    zf.write(f, arc)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--region", required=True, choices=C.REGIONS + ["all"])
    ap.add_argument("--start", default=C.DATA_FIRST)
    ap.add_argument("--end", default=C.DATA_LAST)
    ap.add_argument("--segment", default="year", choices=C.SEGMENTS)
    ap.add_argument("--max-duration", type=float, default=C.MAX_DURATION)
    ap.add_argument("--spatial-smoothing", default="off", choices=list(C.SPATIAL_SMOOTHING))
    ap.add_argument("--slices", action="store_true", help="also write the sliced versions (see config.SLICE_PLAN)")
    ap.add_argument("--sliced-only", action="store_true", help="write only the sliced WAVs (implies --slices)")
    ap.add_argument("--zip", action="store_true")
    ap.add_argument("--report", action="store_true", help="also write <Region>_report.json")
    ap.add_argument("--out", default=str(C.OUT))
    ap.add_argument("--viirs", default=str(C.VIIRS_SRC))
    ap.add_argument("--aot", default=str(C.AOT_CSV))
    ap.add_argument("--co", default=str(C.CO_CSV))
    ap.add_argument("--enso", default=str(C.ENSO_CSV))
    a = ap.parse_args()
    start, end = pd.Timestamp(a.start), pd.Timestamp(a.end)
    if start < pd.Timestamp(C.DATA_FIRST) or end > pd.Timestamp(C.DATA_LAST) or start >= end:
        raise SystemExit(f"window must lie inside {C.DATA_FIRST} .. {C.DATA_LAST}")
    paths = dict(viirs=a.viirs, aot=a.aot, co=a.co, enso=a.enso)
    regions = C.REGIONS if a.region == "all" else [a.region]
    out_root = Path(a.out)
    for r in regions:
        rep = run(r, start, end, a.segment, a.max_duration, C.SPATIAL_SMOOTHING[a.spatial_smoothing],
                  out_root / r, paths, a.slices or a.sliced_only, a.report, a.sliced_only)
        print(json.dumps(dict(region=r, duration_s=rep["duration_s"], gongs=len(rep["gongs"]),
                              aligned=all(x.get("within_3_weeks", True) for x in rep["temporal_alignment"]),
                              pitch_ok=rep["pitch"]["inside_A1_C8"] and rep["pitch"]["pitch_classes_ok"],
                              binaural=rep["binaural_renderer_check"],
                              slices=[dict(label=s["label"], dur=s["duration_s"], gongs=s["gong_dates"],
                                           match_db=s["content_vs_unsliced_residual_db"]) for s in rep.get("slices", [])])))
    if a.zip:
        package(out_root, regions, start, end, a.slices or a.sliced_only, a.sliced_only)


if __name__ == "__main__":
    main()
