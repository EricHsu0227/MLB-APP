"""RRAA (Eric's run metric), ported from rraa_common.py / position_player_rraa.py / pitcher_rraa.py.

  Position player RRAA = Batting Runs + Base Running Runs + Fielding Runs
    Batting Runs = wRAA (wwOBA, which also credits/debits K, GIDP and productive outs)
                   + park adjustment (lgR/PA - wPF * lgR/PA per PA)
                   + league adjustment (lgR/PA - AL/NL non-pitcher wRC/PA per PA)
    Base Running = Savant Baserunning Run Value; Fielding = Savant FRV minus team-average FRV per inning.
  Pitcher RRAA = (lgwOBA - wOBA allowed) / wOBA scale per PA + lgR/PA * (wPF - 1) per PA

Run values come from the season's own 24-state run expectancy. Park factors pool the last 3 seasons, so
each season job writes `rraa_parts.json` (per-player sums plus PA counts by park) and `finalize()` turns
every season's parts into the final numbers once all seasons are on disk (see rraa_finalize.py).
"""
from __future__ import annotations
import io
import json
import re

import numpy as np
import pandas as pd

PF_POOL_YEARS = 3        # seasons pooled for park factors
PF_REGRESSION = 0.6      # share of the raw park factor kept (1.0 = no regression)
PITCHER_BAT_MAX_PA = 120  # under this many PA and pitched in the same game -> pitcher batting

AL_TEAMS = {"BAL", "BOS", "NYY", "TB", "TOR", "CWS", "CLE", "DET", "KC", "MIN", "HOU", "LAA", "OAK", "ATH", "SEA", "TEX"}

EVENT_CAT = {
    "walk": "BB", "hit_by_pitch": "HBP", "single": "1B", "double": "2B", "triple": "3B", "home_run": "HR",
    "strikeout": "K", "strikeout_double_play": "K",
    "grounded_into_double_play": "GIDP", "double_play": "GIDP", "sac_fly_double_play": "GIDP",
    "sac_bunt_double_play": "GIDP", "triple_play": "GIDP",
    "field_error": "ROE",
    "force_out": "OUT", "fielders_choice": "OUT", "fielders_choice_out": "OUT", "field_out": "OUT",
    "sac_fly": "PROD", "sac_bunt": "PROD",
}
REACH = ["BB", "HBP", "1B", "2B", "3B", "HR"]
FIELDER_COLS = [f"fielder_{k}" for k in range(2, 10)]


def _bsum(code):
    code = np.asarray(code, dtype=int)
    return (code & 1) * 1 + ((code >> 1) & 1) * 2 + ((code >> 2) & 1) * 3


def build_pa(raw: pd.DataFrame, year: int) -> pd.DataFrame:
    """One row per plate appearance with its run value (rv) and category."""
    df = raw.loc[raw["game_type"] == "R"].copy() if "game_type" in raw else raw.copy()
    df = df.sort_values(["game_pk", "at_bat_number", "pitch_number"])
    for c in ("on_1b", "on_2b", "on_3b"):
        df[c] = df[c].notna().astype(int)
    df["outs_when_up"] = df["outs_when_up"].fillna(0).astype(int)
    df["runs"] = df["post_bat_score"] - df["bat_score"]

    pit_pairs = set(zip(df["game_pk"].values, df["pitcher"].values))
    keys = ["game_pk", "at_bat_number"]
    last = df.drop_duplicates(keys, keep="last").reset_index(drop=True)
    first = df.drop_duplicates(keys, keep="first").reset_index(drop=True)

    pa = last.copy()
    pa["s_b"] = pa["on_1b"] + 2 * pa["on_2b"] + 4 * pa["on_3b"]
    pa["s_o"] = pa["outs_when_up"].clip(0, 2)
    pa["_f_b"] = (first["on_1b"] + 2 * first["on_2b"] + 4 * first["on_3b"]).values
    pa["_f_o"] = first["outs_when_up"].values

    g = pa.groupby("game_pk")
    same = (g["inning"].shift(-1) == pa["inning"]) & (g["inning_topbot"].shift(-1) == pa["inning_topbot"])
    pa["e_b"] = np.where(same, g["_f_b"].shift(-1), 0).astype(int)
    pa["e_o"] = np.where(same, g["_f_o"].shift(-1), 3).astype(int)

    # run expectancy for this season, 24 base-out states
    pa["_hi"] = pa["game_pk"].astype(str) + "_" + pa["inning"].astype(str) + pa["inning_topbot"]
    final = pa.groupby("_hi")["post_bat_score"].transform("max")
    pa["_rest"] = final - pa["bat_score"]
    re_ = np.zeros((4, 8))
    for (o, b), v in pa.groupby(["s_o", "s_b"])["_rest"].mean().items():
        re_[int(o), int(b)] = v
    pa["rv"] = re_[pa["e_o"].values, pa["e_b"].values] - re_[pa["s_o"].values, pa["s_b"].values] + pa["runs"]

    pa = pa[pa["events"].isin(EVENT_CAT)].copy()
    pa["cat"] = pa["events"].map(EVENT_CAT)
    outs_added = pa["e_o"] - pa["s_o"]
    progress = _bsum(pa["e_b"]) + 4 * pa["runs"] - _bsum(pa["s_b"])
    pa.loc[(pa["events"] == "field_out") & (outs_added == 1) & (progress > 0), "cat"] = "PROD"

    top = pa["inning_topbot"] == "Top"
    pa["bat_team"] = np.where(top, pa["away_team"], pa["home_team"])
    pa["bat_lg"] = np.where(pa["bat_team"].isin(AL_TEAMS), "AL", "NL")
    pa["park"] = pa["home_team"]
    pa["away"] = pa["away_team"]
    cnt = pa.groupby("batter")["batter"].transform("size")
    is_p = np.array([(a, b) in pit_pairs for a, b in zip(pa["game_pk"].values, pa["batter"].values)], dtype=bool)
    pa["bat_is_pitcher"] = is_p & (cnt.values < PITCHER_BAT_MAX_PA)
    pa["season"] = year
    return pa[["season", "game_pk", "batter", "pitcher", "stand", "p_throws", "cat", "rv", "runs",
               "bat_lg", "park", "away", "bat_is_pitcher"]].reset_index(drop=True)


def add_values(pa: pd.DataFrame):
    """Per-PA wOBA and wwOBA values plus the season's league constants."""
    rv = pa.groupby("cat")["rv"].mean()
    obp = pa["cat"].isin(REACH).mean()
    w_cat = (rv - rv.get("OUT", 0.0)).to_dict()
    w_cat["ROE"] = 0.0
    w = pa["cat"].map(w_cat)
    k_ww = obp / w.mean()
    pa["wwoba"] = k_ww * w
    reach = pa["cat"].isin(REACH)
    base0 = pa.loc[~reach, "rv"].mean()
    w0 = np.where(reach, pa["cat"].map(rv.to_dict()) - base0, 0.0)
    k0 = obp / w0.mean()
    pa["woba"] = k0 * w0
    # wOBA scale is the multiplier k (FanGraphs-style, ~1.2), so (wOBA - lgwOBA) / scale is back in runs per PA.
    # The original scripts stored 1/k, which inflated every run total by k^2 (about 1.6-1.8x).
    info = {"lgR_PA": float(pa["runs"].mean()), "lg_wwoba": float(pa["wwoba"].mean()), "wwoba_scale": float(k_ww),
            "lg_woba": float(pa["woba"].mean()), "woba_scale": float(k0)}
    return pa, info


def fielding_innings(raw: pd.DataFrame) -> pd.DataFrame:
    """Innings in the field per (batter id, team), estimated from fielder_2..9 on each pitch."""
    cols = [c for c in FIELDER_COLS if c in raw]
    if not cols:
        return pd.DataFrame(columns=["batter", "team", "inn"])
    df = raw[["game_pk", "inning", "inning_topbot", "home_team", "away_team", "outs_when_up"] + cols].copy()
    df["team"] = np.where(df["inning_topbot"] == "Top", df["home_team"], df["away_team"])
    df["outs_when_up"] = df["outs_when_up"].fillna(0)
    long = df.melt(id_vars=["game_pk", "inning", "inning_topbot", "team", "outs_when_up"], value_vars=cols, value_name="batter").dropna(subset=["batter"])
    g = long.groupby(["game_pk", "inning", "inning_topbot", "team", "batter"])["outs_when_up"]
    frac = ((g.max() - g.min() + 1) / 3.0).rename("inn").reset_index()
    s = frac.groupby(["batter", "team"], as_index=False)["inn"].sum()
    s["batter"] = s["batter"].astype(int)
    return s


def _pick(cols, *cands):
    low = {str(c).lower(): c for c in cols}
    return next((low[c.lower()] for c in cands if c.lower() in low), None)


def _find(cols, *subs, exclude=()):
    return next((c for c in cols if any(s in str(c).lower() for s in subs) and not any(x in str(c).lower() for x in exclude)), None)


def savant_board(url: str) -> pd.DataFrame:
    """A Savant leaderboard as a table: CSV first, else the JSON embedded in the page."""
    from mlbhttp import get
    last = ""
    for u in (url, url.replace("&csv=true", "")):
        try:
            text = get(u).text.lstrip("﻿")
        except Exception as e:  # noqa: BLE001
            last = str(e)
            continue
        df = None
        if not text.lstrip().startswith("<"):
            try:
                df = pd.read_csv(io.StringIO(text))
            except Exception:  # noqa: BLE001
                df = None
        if df is None or df.shape[1] < 3:
            m = re.search(r"var data = (\[.*?\]);", text, re.S)
            df = pd.DataFrame(json.loads(m.group(1))) if m else None
        if df is not None and df.shape[1] >= 3 and not df.empty:
            return df
        last = text[:200]
    raise RuntimeError(f"Savant leaderboard unreadable: {last!r}")


BSR_FIRST = 2016  # Savant baserunning run value starts in 2016


def savant_bsr(year: int) -> dict[int, float]:
    if year < BSR_FIRST:
        return {}
    # season_start/season_end pick the season; startYear/endYear are ignored and return the current season
    d = savant_board("https://baseballsavant.mlb.com/leaderboard/baserunning-run-value?game_type=Regular&n=1&team=&type=Runner"
                     f"&sortColumn=runner_runs_tot&sortDirection=desc&split=no&season_start={year}&season_end={year}&csv=true")
    pid = _pick(d.columns, "player_id", "entity_id", "runner_id", "id") or _find(d.columns, "player_id", "entity_id", "runner_id", exclude=("team",))
    tot = _pick(d.columns, "runner_runs_tot", "runner_runs_total", "baserunning_run_value", "total_runs", "runs_total") or _find(d.columns, "runs_tot", "total_runs", "run_value")
    if None in (pid, tot):
        raise RuntimeError(f"baserunning columns not recognized: {list(d.columns)}")
    s = pd.DataFrame({"id": d[pid].astype(int), "v": pd.to_numeric(d[tot], errors="coerce")}).groupby("id")["v"].sum()
    return {int(k): float(v) for k, v in s.items() if pd.notna(v)}


def savant_frv(year: int) -> dict[int, float]:
    d = savant_board(f"https://baseballsavant.mlb.com/leaderboard/fielding-run-value?minInnings=1&seasonEnd={year}&seasonStart={year}&type=fielder&csv=true")
    pid, frv = _pick(d.columns, "id", "player_id", "entity_id"), _pick(d.columns, "total_runs")
    if None in (pid, frv):
        raise RuntimeError(f"fielding columns not recognized: {list(d.columns)}")
    s = pd.DataFrame({"id": d[pid].astype(int), "v": pd.to_numeric(d[frv], errors="coerce")}).groupby("id")["v"].sum()
    return {int(k): float(v) for k, v in s.items() if pd.notna(v)}


def team_adjusted_fld(frv: dict[int, float], inn: pd.DataFrame) -> dict[int, float]:
    """FRV minus (team FRV per fielding inning x player's innings for that team); each team then sums to 0."""
    if inn.empty:
        return dict(frv)
    t = inn.copy()
    t["frv"] = t["batter"].map(frv).fillna(0.0)
    tot = t.groupby("batter")["inn"].transform("sum")
    t["frv_pt"] = t["frv"] * t["inn"] / tot
    tm = t.groupby("team").agg(s=("frv_pt", "sum"), n=("inn", "sum"))
    t["exp"] = t["team"].map(tm["s"] / tm["n"]) * t["inn"]
    exp = t.groupby("batter")["exp"].sum()
    return {pid: v - float(exp.get(pid, 0.0)) for pid, v in frv.items()}


def _sides(df: pd.DataFrame, id_col: str, hand_col: str, w_col: str, raa_col: str, lg_col: str | None):
    """{id: {split: {PA, w, raa, lg?, parks{team: n}}}} for all / vsL / vsR."""
    out: dict[int, dict] = {}
    for sp, sub in (("all", df), ("vsL", df[df[hand_col] == "L"]), ("vsR", df[df[hand_col] == "R"])):
        if sub.empty:
            continue
        agg = {"PA": (w_col, "size"), "w": (w_col, "mean"), "raa": (raa_col, "sum")}
        if lg_col:
            agg["lg"] = (lg_col, "sum")
        a = sub.groupby(id_col).agg(**agg)
        parks = sub.groupby([id_col, "park"]).size()
        for pid, r in a.iterrows():
            e = {k: (int(v) if k == "PA" else round(float(v), 5)) for k, v in r.items()}
            e["parks"] = {str(k): int(v) for k, v in parks.loc[pid].items()}
            out.setdefault(int(pid), {})[sp] = e
    return out


def season_parts(raw: pd.DataFrame, year: int, fetch_leaderboards: bool = True) -> dict:
    """Everything a season contributes to RRAA, before park factors are pooled across seasons."""
    pa, info = add_values(build_pa(raw, year))
    home = pa.groupby("park")["runs"].agg(["sum", "size"])
    road = pa.groupby("away")["runs"].agg(["sum", "size"])
    park = {str(t): [float(home.loc[t, "sum"]), int(home.loc[t, "size"]), float(road.loc[t, "sum"]), int(road.loc[t, "size"])] for t in home.index if t in road.index}

    pa["_raa"] = (pa["wwoba"] - info["lg_wwoba"]) / info["wwoba_scale"]
    np_wrc = pa[~pa["bat_is_pitcher"]].groupby("bat_lg")["_raa"].mean() + info["lgR_PA"]
    pa["lg_i"] = info["lgR_PA"] - pa["bat_lg"].map(np_wrc).fillna(info["lgR_PA"])
    pa["raa_p"] = (info["lg_woba"] - pa["woba"]) / info["woba_scale"]

    bat = _sides(pa[~pa["bat_is_pitcher"]], "batter", "p_throws", "wwoba", "_raa", "lg_i")
    pit = _sides(pa, "pitcher", "stand", "woba", "raa_p", None)

    if fetch_leaderboards:
        frv_raw: dict[int, float] = {}

        def fld():
            frv_raw.update(savant_frv(year))
            return team_adjusted_fld(frv_raw, fielding_innings(raw))

        for label, fn in (("bsr", lambda: savant_bsr(year)), ("fld", fld)):
            try:
                vals = fn()
            except Exception as e:  # noqa: BLE001
                print(f"[warn] RRAA {label} for {year} unavailable, counted as 0: {e}")
                vals = {}
            for pid, v in vals.items():
                if pid in bat:
                    bat[pid][label] = round(v, 3)
        for pid, v in frv_raw.items():
            if pid in bat:
                bat[pid]["frv"] = round(v, 3)
    return {"season": year, "v": 2, **{k: round(v, 6) for k, v in info.items()}, "park": park, "bat": {str(k): v for k, v in bat.items()}, "pit": {str(k): v for k, v in pit.items()}}


def upgrade(p: dict) -> dict:
    """Parts written before v2 stored the inverse wOBA scale; rescale their run sums instead of re-downloading."""
    if p.get("v", 1) >= 2:
        return p
    kb, kp = 1 / p["wwoba_scale"], 1 / p["woba_scale"]
    for e in p["bat"].values():
        for sp in ("all", "vsL", "vsR"):
            if sp in e:
                e[sp]["raa"] /= kb * kb
                e[sp]["lg"] /= kb * kb
    for e in p["pit"].values():
        for x in e.values():
            x["raa"] /= kp * kp
    return {**p, "v": 2, "wwoba_scale": kb, "woba_scale": kp}


def park_factors(parts: dict[int, dict]) -> dict[int, dict[str, float]]:
    """{season: {team: wPF}} pooling up to PF_POOL_YEARS seasons ending at that season."""
    out = {}
    for s in parts:
        acc: dict[str, list[float]] = {}
        for y in range(s - PF_POOL_YEARS + 1, s + 1):
            for t, (rh, nh, rr, nr) in parts.get(y, {}).get("park", {}).items():
                a = acc.setdefault(t, [0.0, 0, 0.0, 0])
                a[0] += rh; a[1] += nh; a[2] += rr; a[3] += nr
        out[s] = {t: 1.0 + PF_REGRESSION * ((rh / nh) / (rr / nr) - 1.0) for t, (rh, nh, rr, nr) in acc.items() if nh and nr and rr}
    return out


def finalize(parts: dict[int, dict]) -> dict[int, dict[str, dict]]:
    """{season: {"bat": {id: {split: {stat: v}}}, "pit": {...}}} with the stats that go into the season files."""
    parts = {s: upgrade(p) for s, p in parts.items()}
    pfs = park_factors(parts)
    out = {}
    for s, p in parts.items():
        pf, lg = pfs[s], p["lgR_PA"]
        park_sum = lambda parks, sign: lg * sum(n * sign * (pf.get(t, 1.0) - 1.0) for t, n in parks.items())  # noqa: E731
        bat, pit = {}, {}
        for pid, e in p["bat"].items():
            row = {}
            for sp in ("all", "vsL", "vsR"):
                x = e.get(sp)
                if not x:
                    continue
                park = park_sum(x["parks"], -1)
                runs = x["raa"] + park + x["lg"]
                row[sp] = {"wwOBA": x["w"], "RRAA_Bat": runs, "RRAA_wRAA": x["raa"], "RRAA_Park": park, "RRAA_Lg": x["lg"], "RRAA_PA": x["PA"]}
                if sp == "all":
                    bsr, fld = e.get("bsr", 0.0), e.get("fld", 0.0)
                    row[sp].update({"RRAA_BsR": bsr, "RRAA_Fld": fld, "RRAA": runs + bsr + fld, "lg_wwOBA": p["lg_wwoba"]})
                    if "frv" in e:
                        row[sp]["RRAA_FRV"] = e["frv"]
            bat[int(pid)] = row
        for pid, e in p["pit"].items():
            pit[int(pid)] = {sp: {"RRAA": x["raa"] + park_sum(x["parks"], 1), "RRAA_wOBA": x["w"], "RRAA_wRAA": x["raa"],
                                  "RRAA_Park": park_sum(x["parks"], 1), "RRAA_PA": x["PA"], **({"lg_wOBA": p["lg_woba"]} if sp == "all" else {})}
                             for sp, x in e.items()}
        out[s] = {"bat": bat, "pit": pit}
    return out
