"""Baseball Savant player-page sections built from pitch-level Statcast rows.

For each player and season: pitch arsenal / run value by pitch type, zone chart, swing-take regions,
batted-ball direction profile, quality of contact, spray chart and (pitchers) release points.
Written as shards: public/data/<season>/savant-<role>-<id % SHARDS>.json = {id: sections}.
"""
from __future__ import annotations
import math
import numpy as np
import pandas as pd

SHARDS = 16
SWING = {"swinging_strike", "swinging_strike_blocked", "foul", "foul_tip", "hit_into_play", "foul_bunt", "missed_bunt", "bunt_foul_tip"}
WHIFF = {"swinging_strike", "swinging_strike_blocked", "missed_bunt"}
K_EVENTS = {"strikeout", "strikeout_double_play"}
HIT_CODE = {"single": 1, "double": 2, "triple": 3, "home_run": 4}
ZONE_HALF_W = 0.83  # ft: half the plate plus a ball's radius
SPRAY_MAX = 450
REGIONS = ("heart", "shadow", "chase", "waste")
QOC = ("weak", "topped", "under", "flare", "solid", "barrel")  # launch_speed_angle 1..6


def _r(v, n=3):
    return None if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))) else round(float(v), n)


def _div(a, b):
    return float(a) / b if b else None


def prepare(df: pd.DataFrame) -> pd.DataFrame:
    """Add the derived columns every section needs (vectorized once per season)."""
    d = df.copy()
    for c in ("delta_run_exp", "release_speed", "release_spin_rate", "pfx_x", "pfx_z", "release_extension", "release_pos_x",
              "release_pos_z", "plate_x", "plate_z", "sz_top", "sz_bot", "hc_x", "hc_y", "launch_speed", "launch_angle",
              "launch_speed_angle", "woba_value", "woba_denom", "estimated_woba_using_speedangle", "zone"):
        if c not in d:
            d[c] = np.nan
        d[c] = pd.to_numeric(d[c], errors="coerce")
    for c in ("pitch_type", "pitch_name", "description", "events", "bb_type", "stand", "p_throws"):
        if c not in d:
            d[c] = None
    d["swing"] = d["description"].isin(SWING)
    d["whiff"] = d["description"].isin(WHIFF)
    d["is_pa"] = d["events"].notna() & (d["events"] != "")
    d["is_k"] = d["events"].isin(K_EVENTS)
    d["bbe"] = d["launch_speed"].notna() & d["description"].eq("hit_into_play")
    d["two_k"] = pd.to_numeric(d.get("strikes"), errors="coerce").eq(2) if "strikes" in d else False
    # swing/take regions, Savant style: distance from the zone center in zone half-widths
    mid = (d["sz_top"] + d["sz_bot"]) / 2
    half_h = ((d["sz_top"] - d["sz_bot"]) / 2).where(lambda s: s > 0)
    r = np.maximum((d["plate_x"] / ZONE_HALF_W).abs(), ((d["plate_z"] - mid) / half_h).abs())
    d["region"] = np.select([r < 0.67, r < 1.33, r < 2.0, r >= 2.0], REGIONS, default=None)
    # spray angle (deg, 0 = straight away, negative = 3B side) and pull / straight / oppo by batter side
    ang = np.degrees(np.arctan2(d["hc_x"] - 125.42, 198.27 - d["hc_y"]))
    d["spray"] = ang
    pull = np.where(d["stand"] == "L", ang > 15, ang < -15)
    oppo = np.where(d["stand"] == "L", ang < -15, ang > 15)
    d["dir"] = np.select([pull, oppo, ang.notna()], ["pull", "oppo", "straight"], default=None)
    d["xw"] = d["estimated_woba_using_speedangle"].where(d["estimated_woba_using_speedangle"].notna(), d["woba_value"])
    return d


def _line(g: pd.DataFrame, rv_sign: float) -> dict:
    pa = g[g["is_pa"]]
    den = pa["woba_denom"].fillna(0).sum()
    ab_ev = pa["events"].isin(set(HIT_CODE) | {"field_out", "strikeout", "grounded_into_double_play", "force_out", "double_play",
                                               "fielders_choice", "fielders_choice_out", "field_error", "strikeout_double_play", "triple_play"})
    ab = int(ab_ev.sum())
    hits = pa["events"].isin(set(HIT_CODE))
    tb = pa["events"].map(HIT_CODE).fillna(0).sum()
    sw = int(g["swing"].sum())
    bbe = g[g["bbe"]]
    rv = g["delta_run_exp"].sum(min_count=1)
    return {
        "n": int(len(g)), "pa": int(len(pa)),
        "ba": _r(_div(hits.sum(), ab)), "slg": _r(_div(tb, ab)), "woba": _r(_div(pa["woba_value"].fillna(0).sum(), den)),
        "xwoba": _r(_div(pa["xw"].fillna(0).sum(), den)),
        "whiff": _r(_div(g["whiff"].sum(), sw)), "k": _r(_div(pa["is_k"].sum(), len(pa))),
        "putaway": _r(_div((pa["is_k"] & pa["two_k"]).sum(), int(g["two_k"].sum()))),
        "hh": _r(_div((bbe["launch_speed"] >= 95).sum(), len(bbe))), "ev": _r(bbe["launch_speed"].mean(), 1) if len(bbe) else None,
        "la": _r(bbe["launch_angle"].mean(), 1) if len(bbe) else None,
        "rv": _r(rv_sign * rv, 1) if pd.notna(rv) else None,
        "rv100": _r(rv_sign * rv * 100 / len(g), 2) if pd.notna(rv) and len(g) else None,
    }


def _arsenal(g: pd.DataFrame, role: str) -> list:
    sign = -1.0 if role == "pit" else 1.0
    out = []
    tot = len(g)
    for pt, s in g[g["pitch_type"].notna()].groupby("pitch_type"):
        e = _line(s, sign)
        e.update({"type": pt, "name": s["pitch_name"].dropna().iloc[0] if s["pitch_name"].notna().any() else pt, "usage": _r(len(s) / tot)})
        if role == "pit":
            e.update({"velo": _r(s["release_speed"].mean(), 1), "spin": _r(s["release_spin_rate"].mean(), 0),
                      "hb": _r(s["pfx_x"].mean() * 12, 1), "ivb": _r(s["pfx_z"].mean() * 12, 1),
                      "ext": _r(s["release_extension"].mean(), 1), "rx": _r(s["release_pos_x"].mean(), 2), "rz": _r(s["release_pos_z"].mean(), 2)})
        else:
            e["velo"] = _r(s["release_speed"].mean(), 1)
        out.append(e)
    return sorted(out, key=lambda e: -(e["n"]))


def _zones(g: pd.DataFrame) -> dict:
    out = {}
    for z, s in g[g["zone"].notna()].groupby("zone"):
        sw = int(s["swing"].sum())
        pa = s[s["is_pa"]]
        den = pa["woba_denom"].fillna(0).sum()
        out[str(int(z))] = [int(len(s)), _r(_div(sw, len(s))), _r(_div(s["whiff"].sum(), sw)), _r(_div(pa["xw"].fillna(0).sum(), den))]
    return out


def _swing_take(g: pd.DataFrame, role: str) -> dict:
    sign = -1.0 if role == "pit" else 1.0
    out = {}
    for reg in REGIONS:
        s = g[g["region"] == reg]
        if s.empty:
            continue
        sw, tk = s[s["swing"]], s[~s["swing"]]
        rs, rt = sw["delta_run_exp"].sum(min_count=1), tk["delta_run_exp"].sum(min_count=1)
        out[reg] = [int(len(s)), _r(len(s) / len(g)), _r(_div(len(sw), len(s))),
                    _r(sign * rs, 1) if pd.notna(rs) else None, _r(sign * rt, 1) if pd.notna(rt) else None]
    return out


def _batted(g: pd.DataFrame) -> dict:
    b = g[g["bbe"]]
    n = len(b)
    if not n:
        return {}
    dirs = {}
    for dname in ("pull", "straight", "oppo"):
        s = b[b["dir"] == dname]
        dirs[dname] = [_r(len(s) / n)] + [_r(_div((s["bb_type"] == t).sum(), len(s))) for t in ("ground_ball", "line_drive", "fly_ball", "popup")]
    qoc = [_r((b["launch_speed_angle"] == i).sum() / n) for i in range(1, 7)]
    la = b["launch_angle"]
    return {"n": n, "dir": dirs, "qoc": qoc,
            "la": [_r((la < 10).mean()), _r(la.between(10, 25, inclusive="left").mean()), _r(la.between(25, 50).mean()), _r((la > 50).mean())],
            "sweet": _r(la.between(8, 32).mean())}


def _spray(g: pd.DataFrame) -> list:
    b = g[g["bbe"] & g["hc_x"].notna() & g["hc_y"].notna()]
    if len(b) > SPRAY_MAX:
        b = b.sample(SPRAY_MAX, random_state=0)
    code = b["events"].map(HIT_CODE).fillna(0).astype(int)
    return [[int(round(x)), int(round(y)), int(round(ev)) if pd.notna(ev) else 0, int(c)] for x, y, ev, c in zip(b["hc_x"], b["hc_y"], b["launch_speed"], code)]


def player_sections(pitches: pd.DataFrame, role: str, min_pitches: int = 50) -> dict[int, dict]:
    if pitches is None or pitches.empty:
        return {}
    d = prepare(pitches)
    id_col = "batter" if role == "bat" else "pitcher"
    out = {}
    for pid, g in d.groupby(id_col):
        if len(g) < min_pitches:
            continue
        sec = {"n": int(len(g)), "ars": _arsenal(g, role), "zones": _zones(g), "st": _swing_take(g, role), "bb": _batted(g), "spray": _spray(g)}
        if role == "pit":
            sec["hand"] = g["p_throws"].dropna().iloc[0] if g["p_throws"].notna().any() else None
        else:
            sec["hand"] = g["stand"].dropna().mode().iloc[0] if g["stand"].notna().any() else None
        out[int(pid)] = sec
    return out


def shards(sections: dict[int, dict]) -> dict[int, dict]:
    out: dict[int, dict] = {i: {} for i in range(SHARDS)}
    for pid, s in sections.items():
        out[pid % SHARDS][str(pid)] = s
    return out
