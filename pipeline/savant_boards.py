"""Season-level Baseball Savant leaderboards merged into the season files.

Season keys (prefix sv_): fielding (OAA, fielding runs prevented, FRV), arm strength, catcher framing and bat-tracking
run value. URLs were checked to return one season.
"""
from __future__ import annotations
import json, pathlib
import pandas as pd
from rraa import _pick, savant_board

B = "https://baseballsavant.mlb.com/leaderboard"
BOARDS = {  # name: (url template, role, id column candidates, {source column: our key})
    "oaa": (B + "/outs_above_average?year={y}&team=&min=1&csv=true", "bat", ("player_id",),
            {"outs_above_average": "sv_OAA", "fielding_runs_prevented": "sv_FRP"}),
    "frv": (B + "/fielding-run-value?minInnings=1&seasonEnd={y}&seasonStart={y}&type=fielder&csv=true", "bat", ("id", "player_id"),
            {"total_runs": "sv_FRV", "range_runs": "sv_FRV_Range", "arm_runs": "sv_FRV_Arm", "framing_runs": "sv_FRV_Framing", "blocking_runs": "sv_FRV_Block", "throwing_runs": "sv_FRV_Throw"}),
    "arm": (B + "/arm-strength?year={y}&team=&min=1&csv=true", "bat", ("player_id",),
            {"arm_overall": "sv_Arm", "max_arm_strength": "sv_ArmMax", "total_throws": "sv_Throws"}),
    "framing": (B + "/catcher-framing?min=1&seasonStart={y}&seasonEnd={y}&sortColumn=rv_tot&sortDirection=desc&type=catcher&csv=true", "bat", ("id",),
                {"rv_tot": "sv_FramingRV", "pct_tot": "sv_Framing%", "pitches": "sv_FramingPitches"}),
    "sprint": (B + "/sprint_speed?year={y}&position=&team=&min=10&csv=true", "bat", ("player_id",),
               {"sprint_speed": "sv_Sprint", "hp_to_1b": "sv_HPto1B", "bolts": "sv_Bolts", "competitive_runs": "sv_CompRuns"}),
    "battrack": (B + "/bat-tracking?seasonStart={y}&seasonEnd={y}&team=&type=batter&csv=true", "bat", ("id",),
                 {"batter_run_value": "sv_SwingRV", "hard_swing_rate": "sv_HardSwing%", "squared_up_per_swing": "sv_SqUpSwing%", "blast_per_swing": "sv_BlastSwing%"}),
}
ADDITIVE = {"sv_OAA", "sv_FRP", "sv_FRV", "sv_FRV_Range", "sv_FRV_Arm", "sv_FRV_Framing", "sv_FRV_Block", "sv_FRV_Throw", "sv_Throws", "sv_FramingRV", "sv_FramingPitches", "sv_SwingRV"}
FIRST_YEAR = {"battrack": 2023, "framing": 2015, "oaa": 2016, "arm": 2020, "frv": 2016}


def _num(s):
    return pd.to_numeric(s, errors="coerce")


def season_keys(year: int, fetch=savant_board) -> dict[str, dict[int, dict]]:
    """{role: {player id: {sv_key: value}}}; a board that fails or does not exist that year is skipped."""
    out: dict[str, dict[int, dict]] = {"bat": {}, "pit": {}}
    for name, (url, role, idc, cols) in BOARDS.items():
        if year < FIRST_YEAR.get(name, 2015):
            continue
        try:
            d = fetch(url.format(y=year))
        except Exception as e:  # noqa: BLE001
            print(f"[warn] Savant {name} {year} unavailable: {e}")
            continue
        pid = _pick(d.columns, *idc)
        if pid is None:
            print(f"[warn] Savant {name} {year}: no id column in {list(d.columns)[:8]}")
            continue
        have = {c: k for c, k in cols.items() if _pick(d.columns, c)}
        if not have:
            print(f"[warn] Savant {name} {year}: none of {list(cols)} in {list(d.columns)[:12]}")
            continue
        d = d[[pid] + [_pick(d.columns, c) for c in have]].copy()
        d.columns = ["id"] + list(have.values())
        d["id"] = _num(d["id"])
        d = d.dropna(subset=["id"])
        for k in have.values():
            d[k] = _num(d[k])
        add = [k for k in have.values() if k in ADDITIVE]
        d = d.groupby("id").agg({k: ("sum" if k in add else "max") for k in have.values()})  # a player listed at several positions
        for i, r in d.iterrows():
            out[role].setdefault(int(i), {}).update({k: round(float(v), 3) for k, v in r.items() if pd.notna(v)})
    return out


def apply(year: int, root: pathlib.Path, fetch=savant_board) -> None:
    """Write the sv_ keys into <year>/bat.json and pit.json (old sv_ keys are replaced)."""
    keys = season_keys(year, fetch)
    for role in ("bat", "pit"):
        f = root / str(year) / f"{role}.json"
        if not f.exists():
            continue
        d = json.loads(f.read_text())
        hit = 0
        for p in d["players"]:
            sp = p["splits"].setdefault("all", {})
            for k in [k for k in sp if k.startswith("sv_")]:
                del sp[k]
            add = keys[role].get(p["id"])
            if add:
                sp.update(add); hit += 1
        f.write_text(json.dumps(d, separators=(",", ":")))
        print(f"{year} {role}: Savant leaderboards for {hit} players")
