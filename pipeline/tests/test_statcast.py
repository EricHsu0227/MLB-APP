import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import numpy as np, pandas as pd
from statcast import calc_player_table


def frame():
    cols = ["batter", "pitcher", "stand", "p_throws", "type", "description", "events", "zone", "bb_type",
            "launch_speed", "launch_angle", "launch_speed_angle", "woba_value", "woba_denom",
            "estimated_woba_using_speedangle"]
    rows = [
        # vs RHP: homer (barrel), strikeout swinging, walk
        (1, 9, "L", "R", "X", "hit_into_play", "home_run", 5, "fly_ball", 105.0, 28, 6, 2.0, 1, 1.9),
        (1, 9, "L", "R", "S", "swinging_strike", "strikeout", 12, None, np.nan, np.nan, np.nan, 0.0, 1, np.nan),
        (1, 9, "L", "R", "B", "ball", "walk", 3, None, np.nan, np.nan, np.nan, 0.7, 1, np.nan),
        # vs LHP: groundout weakly hit
        (1, 8, "L", "L", "X", "hit_into_play", "field_out", 6, "ground_ball", 80.0, -5, 1, 0.0, 1, 0.1),
    ]
    return pd.DataFrame(rows, columns=cols)


def test_batter_split():
    t = calc_player_table(frame(), "bat")[1]
    r = t["vsR"]
    assert r["PA"] == 3
    assert abs(r["wOBA"] - 2.7 / 3) < 1e-9
    assert abs(r["xwOBA"] - (1.9 + 0.0 + 0.7) / 3) < 1e-9  # no tracking on K/BB -> actual value
    assert abs(r["K%"] - 1 / 3) < 1e-9 and abs(r["BB%"] - 1 / 3) < 1e-9
    assert r["Barrel%"] == 1.0 and r["HardHit%"] == 1.0 and r["BBE"] == 1
    assert t["vsL"]["PA"] == 1 and t["vsL"]["HardHit%"] == 0.0
    assert t["all"]["PA"] == 4 and t["all"]["BBE"] == 2


def test_pitcher_splits_by_batter_side():
    t = calc_player_table(frame(), "pit")
    assert t[9]["vsL"]["PA"] == 3 and "vsR" not in t[9]


def test_whiff_and_chase():
    t = calc_player_table(frame(), "bat")[1]["vsR"]
    assert t["Whiff%"] == 0.5  # 2 swings (HR contact, strike), 1 whiff
    assert t["O-Swing%"] == 1.0  # the only out-of-zone pitch seen with zone 12 was swung at


if __name__ == "__main__":
    for n, f in list(globals().items()):
        if n.startswith("test_"):
            f(); print("ok", n)
