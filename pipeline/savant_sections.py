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
SPRAY_MAX = 300
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
    for c in ("balls", "strikes", "inning", "outs_when_up"):
        d[c] = pd.to_numeric(d[c], errors="coerce") if c in d else np.nan
    d["month"] = pd.to_datetime(d["game_date"], errors="coerce").dt.month if "game_date" in d else np.nan
    d["home"] = (d["inning_topbot"] == "Bot") if "inning_topbot" in d else None
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


REACH = {"single", "double", "triple", "home_run", "walk", "intent_walk", "hit_by_pitch"}
NOT_AB = {"walk", "intent_walk", "hit_by_pitch", "sac_fly", "sac_bunt", "catcher_interf", "sac_fly_double_play", "sac_bunt_double_play"}


def _split_line(g: pd.DataFrame) -> list:
    """[PA, AVG, OBP, SLG, wOBA, xwOBA, K%, BB%, Whiff%, EV, HardHit%]"""
    pa = g[g["is_pa"]]
    n = len(pa)
    if not n:
        return None
    ab = int((~pa["events"].isin(NOT_AB)).sum())
    h = pa["events"].isin(set(HIT_CODE)).sum()
    tb = pa["events"].map(HIT_CODE).fillna(0).sum()
    obp_den = ab + pa["events"].isin({"walk", "intent_walk", "hit_by_pitch", "sac_fly"}).sum()
    den = pa["woba_denom"].fillna(0).sum()
    sw = int(g["swing"].sum())
    b = g[g["bbe"]]
    return [n, _r(_div(h, ab)), _r(_div(pa["events"].isin(REACH).sum(), obp_den)), _r(_div(tb, ab)),
            _r(_div(pa["woba_value"].fillna(0).sum(), den)), _r(_div(pa["xw"].fillna(0).sum(), den)),
            _r(_div(pa["is_k"].sum(), n)), _r(_div(pa["events"].isin({"walk", "intent_walk"}).sum(), n)),
            _r(_div(g["whiff"].sum(), sw)), _r(b["launch_speed"].mean(), 1) if len(b) else None, _r(_div((b["launch_speed"] >= 95).sum(), len(b)))]


SPLIT_COLS = ["PA", "AVG", "OBP", "SLG", "wOBA", "xwOBA", "K%", "BB%", "Whiff%", "EV", "HardHit%"]
MONTHS = {3: "Mar/Apr", 4: "Mar/Apr", 5: "May", 6: "Jun", 7: "Jul", 8: "Aug", 9: "Sep/Oct", 10: "Sep/Oct", 11: "Sep/Oct"}


def _splits(g: pd.DataFrame, role: str) -> dict:
    """{group: [[label, *line], ...]} for month, count (when the PA ended), inning, outs, home/away and opponent hand."""
    pa_rows = g[g["is_pa"]]
    hand_col = "p_throws" if role == "bat" else "stand"
    out = {}
    groups = {
        "Month": (g["month"].map(MONTHS), list(dict.fromkeys(MONTHS.values()))),
        "Inning": (pd.cut(g["inning"], [0, 3, 6, 9, 99], labels=["1-3", "4-6", "7-9", "Extra"]).astype(str), ["1-3", "4-6", "7-9", "Extra"]),
        "Outs": (g["outs_when_up"].map(lambda v: f"{int(v)} out" if pd.notna(v) else None), ["0 out", "1 out", "2 out"]),
        "Home/Away": (g["home"].map(lambda v: None if v is None or (isinstance(v, float) and math.isnan(v)) else (("Home" if v else "Away") if role == "bat" else ("Away" if v else "Home"))), ["Home", "Away"]),
        "Vs hand": (g[hand_col].map({"L": "vs L", "R": "vs R"}), ["vs L", "vs R"]),
    }
    for name, (key, order) in groups.items():
        rows = []
        for lab in order:
            line = _split_line(g[key == lab])
            if line:
                rows.append([lab, *line])
        if rows:
            out[name] = rows
    # count when the plate appearance ended: the pitch-level count of its last pitch
    if len(pa_rows) and pa_rows["balls"].notna().any():
        cnt = (pa_rows["balls"].fillna(0).astype(int).astype(str) + "-" + pa_rows["strikes"].fillna(0).astype(int).astype(str))
        rows = []
        for lab in ["0-0", "1-0", "0-1", "2-0", "1-1", "0-2", "3-0", "2-1", "1-2", "3-1", "2-2", "3-2"]:
            sub = g.loc[cnt[cnt == lab].index]
            line = _split_line(sub)
            if line:
                rows.append([lab, *line])
        ahead = cnt.isin(["1-0", "2-0", "3-0", "2-1", "3-1"]) if role == "bat" else cnt.isin(["0-1", "0-2", "1-2"])
        behind = cnt.isin(["0-1", "0-2", "1-2"]) if role == "bat" else cnt.isin(["1-0", "2-0", "3-0", "2-1", "3-1"])
        for lab, m in (("Ahead", ahead), ("Behind", behind), ("Two strikes", cnt.str.endswith("-2"))):
            line = _split_line(g.loc[cnt[m].index])
            if line:
                rows.append([lab, *line])
        out["Count"] = rows
    return out


def _movement_sample(g: pd.DataFrame, n: int = 200) -> list:
    m = g[g["pitch_type"].notna() & g["pfx_x"].notna() & g["pfx_z"].notna()]
    if len(m) > n:
        m = m.sample(n, random_state=0)
    return [[t, _r(x * 12, 1), _r(z * 12, 1)] for t, x, z in zip(m["pitch_type"], m["pfx_x"], m["pfx_z"])]


def season_keys(sec: dict, role: str) -> dict:
    """Flatten the table-friendly parts of a player's sections into season stat keys (prefix sv)."""
    k = {}
    for a in sec.get("ars", []):
        t = a["type"]
        for src, dst in (("usage", "%"), ("velo", " Velo"), ("spin", " Spin"), ("hb", " HB"), ("ivb", " IVB"), ("ext", " Ext"),
                         ("whiff", " Whiff%"), ("putaway", " PutAway%"), ("k", " K%"), ("ba", " BA"), ("slg", " SLG"), ("woba", " wOBA"),
                         ("xwoba", " xwOBA"), ("hh", " HardHit%"), ("rv", " RV"), ("rv100", " RV/100"), ("n", " Pitches")):
            if a.get(src) is not None:
                k[f"svA_{t}{dst}"] = a[src]
    st = sec.get("st", {})
    for reg, (n, share, swing, rvs, rvt) in st.items():
        R = reg.capitalize()
        k[f"svST_{R}%"] = share
        k[f"svST_{R} Swing%"] = swing
        if rvs is not None and rvt is not None:
            k[f"svST_{R} RV"] = _r(rvs + rvt, 1); k[f"svST_{R} Swing RV"] = rvs; k[f"svST_{R} Take RV"] = rvt
    if st and all(v[3] is not None and v[4] is not None for v in st.values()):
        k["svST_RV"] = _r(sum(v[3] + v[4] for v in st.values()), 1)
        k["svST_Swing RV"] = _r(sum(v[3] for v in st.values()), 1)
        k["svST_Take RV"] = _r(sum(v[4] for v in st.values()), 1)
    bb = sec.get("bb") or {}
    if bb:
        for d, v in bb["dir"].items():
            k[f"svBB_{d.capitalize()}%"] = v[0]
        pull = bb["dir"].get("pull")
        if pull and pull[0] is not None and pull[2] is not None and pull[3] is not None:
            k["svBB_Pull Air%"] = _r(pull[0] * (pull[2] + pull[3]))
        for name, v in zip(("Weak", "Topped", "Under", "Flare/Burner", "Solid", "Barrel"), bb["qoc"]):
            k[f"svBB_{name}%"] = v
        k["svBB_Sweet Spot%"] = bb["sweet"]
    return {kk: v for kk, v in k.items() if v is not None}


def player_sections(pitches: pd.DataFrame, role: str, min_pitches: int = 50) -> dict[int, dict]:
    if pitches is None or pitches.empty:
        return {}
    d = prepare(pitches)
    id_col = "batter" if role == "bat" else "pitcher"
    out = {}
    for pid, g in d.groupby(id_col):
        if len(g) < min_pitches:
            continue
        sec = {"n": int(len(g)), "ars": _arsenal(g, role), "zones": _zones(g), "st": _swing_take(g, role), "bb": _batted(g), "spray": _spray(g),
               "splits": _splits(g, role)}
        if role == "pit":
            sec["mov"] = _movement_sample(g)
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
