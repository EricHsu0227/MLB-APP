"""python pipeline/tests/test_savant_sections.py"""
import sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import numpy as np, pandas as pd
import savant_sections as S


def frame(n=400, seed=3):
    rng = np.random.default_rng(seed)
    types = rng.choice(["FF", "SL", "CH"], n, p=[.5, .3, .2])
    desc = rng.choice(["ball", "called_strike", "swinging_strike", "foul", "hit_into_play"], n, p=[.35, .17, .12, .18, .18])
    inplay = desc == "hit_into_play"
    ev = np.where(inplay, rng.normal(90, 10, n), np.nan)
    events = np.where(inplay, rng.choice(["single", "double", "home_run", "field_out"], n, p=[.2, .06, .04, .7]), None)
    events = np.where(desc == "swinging_strike", np.where(rng.random(n) < .3, "strikeout", None), events)
    return pd.DataFrame({
        "batter": 1, "pitcher": 9, "stand": "R", "p_throws": "L", "pitch_type": types, "pitch_name": types,
        "release_speed": np.where(types == "FF", 95.0, 85.0), "release_spin_rate": 2300.0, "pfx_x": np.where(types == "SL", .5, -.6),
        "pfx_z": np.where(types == "FF", 1.3, .2), "release_extension": 6.5, "release_pos_x": -1.8, "release_pos_z": 6.0,
        "plate_x": rng.normal(0, .8, n), "plate_z": rng.normal(2.5, .8, n), "sz_top": 3.4, "sz_bot": 1.6, "zone": rng.integers(1, 15, n).astype(float),
        "description": desc, "events": events, "launch_speed": ev, "launch_angle": np.where(inplay, rng.normal(12, 20, n), np.nan),
        "launch_speed_angle": np.where(inplay, rng.integers(1, 7, n), np.nan), "bb_type": np.where(inplay, rng.choice(["ground_ball", "line_drive", "fly_ball", "popup"], n), None),
        "hc_x": np.where(inplay, rng.normal(125, 40, n), np.nan), "hc_y": np.where(inplay, rng.normal(120, 30, n), np.nan),
        "woba_value": np.where(pd.Series(events).isin(["single"]), .9, np.where(pd.Series(events).isin(["home_run"]), 2.0, 0.0)),
        "woba_denom": np.where(pd.Series(events).notna(), 1, 0), "estimated_woba_using_speedangle": np.nan,
        "delta_run_exp": rng.normal(0, .05, n), "strikes": rng.integers(0, 3, n),
    })


def test_sections():
    f = frame()
    bat = S.player_sections(f, "bat")[1]
    pit = S.player_sections(f, "pit")[9]
    assert bat["n"] == 400 and pit["n"] == 400
    assert abs(sum(a["usage"] for a in pit["ars"]) - 1) < 0.01 and pit["ars"][0]["type"] == "FF"
    ff = next(a for a in pit["ars"] if a["type"] == "FF")
    assert ff["velo"] == 95.0 and ff["ivb"] == 15.6 and ff["hb"] == -7.2
    # run value flips sign for the pitcher
    assert abs(sum(a["rv"] for a in pit["ars"]) + sum(a["rv"] for a in bat["ars"])) < 0.2
    assert set(bat["st"]) <= set(S.REGIONS) and abs(sum(v[1] for v in bat["st"].values()) - 1) < 0.01
    assert abs(sum(bat["bb"]["qoc"]) - 1) < 0.01 and len(bat["spray"]) == bat["bb"]["n"]
    json.dumps(S.shards({1: bat, 9: pit}))  # serializable


def test_hand_keys():
    f = frame()
    f.loc[f.index % 2 == 0, "p_throws"] = "R"
    hk = S.hand_keys(f, "bat")[1]
    assert set(hk) == {"vsL", "vsR"} and "svA_FF%" in hk["vsL"] and "svST_RV" in hk["vsR"]
    pk = S.hand_keys(f, "pit")[9]
    assert set(pk) == {"vsR"}  # every batter in the frame stands R


if __name__ == "__main__":
    test_sections(); test_hand_keys(); print("ok")
