"""Self-calculated Statcast stats from pitch-level rows (Savant statcast_search CSV columns).

Batter view: group by `batter`, split by pitcher hand `p_throws` (vsL / vsR).
Pitcher view: group by `pitcher`, split by batter side `stand` (vsL / vsR = vs LHB / RHB).
"""
from __future__ import annotations
import numpy as np
import pandas as pd

SWING = {"swinging_strike", "swinging_strike_blocked", "foul", "foul_tip", "hit_into_play", "foul_bunt", "missed_bunt"}
WHIFF = {"swinging_strike", "swinging_strike_blocked", "missed_bunt"}
CONTACT = {"foul", "foul_tip", "hit_into_play", "foul_bunt"}
K_EVENTS = {"strikeout", "strikeout_double_play"}
BB_EVENTS = {"walk", "intent_walk"}
HARD_HIT = 95.0


def _pct(num, den):
    return float(num) / den if den else np.nan


def _stats(g: pd.DataFrame) -> dict:
    # plate appearances: rows with a terminal event
    pa = g[g["events"].notna()]
    n_pa = len(pa)
    denom = pa["woba_denom"].fillna(0).sum()
    woba = _pct(pa["woba_value"].fillna(0).sum(), denom)
    # xwOBA: Statcast expected value on batted balls with tracking, actual value otherwise
    xv = pa["estimated_woba_using_speedangle"].where(pa["estimated_woba_using_speedangle"].notna(), pa["woba_value"])
    xwoba = _pct(xv.fillna(0).sum(), denom)

    desc = g["description"]
    swings = desc.isin(SWING)
    whiffs = desc.isin(WHIFF)
    in_zone = g["zone"].between(1, 9)
    out_zone = g["zone"].between(11, 14)
    z_swing = (swings & in_zone).sum()
    o_swing = (swings & out_zone).sum()

    bbe = g[g["launch_speed"].notna() & g["launch_angle"].notna() & (g["type"] == "X")]
    n_bbe = len(bbe)
    ev, la = bbe["launch_speed"], bbe["launch_angle"]
    bb_type = bbe["bb_type"]
    ev90 = float(np.nanpercentile(ev, 90)) if n_bbe else np.nan

    return {
        "PA": n_pa,
        "wOBA": woba,
        "xwOBA": xwoba,
        "K%": _pct(pa["events"].isin(K_EVENTS).sum(), n_pa),
        "BB%": _pct(pa["events"].isin(BB_EVENTS).sum(), n_pa),
        "Pitches": len(g),
        "Swing%": _pct(swings.sum(), len(g)),
        "Whiff%": _pct(whiffs.sum(), swings.sum()),
        "Z-Swing%": _pct(z_swing, in_zone.sum()),
        "O-Swing%": _pct(o_swing, out_zone.sum()),
        "Z-Contact%": _pct((desc.isin(CONTACT) & in_zone).sum(), z_swing),
        "O-Contact%": _pct((desc.isin(CONTACT) & out_zone).sum(), o_swing),
        "BBE": n_bbe,
        "EV": float(ev.mean()) if n_bbe else np.nan,
        "maxEV": float(ev.max()) if n_bbe else np.nan,
        "EV90": ev90,
        "LA": float(la.mean()) if n_bbe else np.nan,
        "HardHit%": _pct((ev >= HARD_HIT).sum(), n_bbe),
        "SweetSpot%": _pct(la.between(8, 32).sum(), n_bbe),
        "Barrel%": _pct((bbe["launch_speed_angle"] == 6).sum(), n_bbe),
        "GB%": _pct((bb_type == "ground_ball").sum(), n_bbe),
        "LD%": _pct((bb_type == "line_drive").sum(), n_bbe),
        "FB%": _pct((bb_type == "fly_ball").sum(), n_bbe),
        "PU%": _pct((bb_type == "popup").sum(), n_bbe),
    }


def calc_player_table(pitches: pd.DataFrame, role: str) -> dict[int, dict[str, dict]]:
    """Return {player_id: {"all": stats, "vsL": stats, "vsR": stats}}."""
    id_col, split_col = ("batter", "p_throws") if role == "bat" else ("pitcher", "stand")
    out: dict[int, dict] = {}
    for pid, g in pitches.groupby(id_col):
        entry = {"all": _stats(g)}
        for key, hand in (("vsL", "L"), ("vsR", "R")):
            sub = g[g[split_col] == hand]
            if len(sub):
                entry[key] = _stats(sub)
        out[int(pid)] = entry
    return out
