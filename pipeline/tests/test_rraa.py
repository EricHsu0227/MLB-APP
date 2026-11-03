"""RRAA on a small simulated season: run with python pipeline/tests/test_rraa.py"""
import sys, pathlib, json, tempfile
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import numpy as np, pandas as pd
import rraa, rraa_finalize

TEAMS = ["NYY", "BOS", "LAD", "SFG"]
EVENTS = [("single", .15), ("double", .05), ("home_run", .03), ("walk", .09), ("strikeout", .22), ("field_out", .40), ("grounded_into_double_play", .03), ("field_error", .01), ("hit_by_pitch", .02)]


def simulate(season, games=120, seed=1):
    rng = np.random.default_rng(seed + season)
    names, probs = zip(*EVENTS)
    rows = []
    for gpk in range(games):
        home, away = rng.choice(TEAMS, 2, replace=False)
        score = {"Top": 0, "Bot": 0}
        ab = 0
        for inning in range(1, 10):
            for half in ("Top", "Bot"):
                bat_t = away if half == "Top" else home
                lineup = [hash((bat_t, i)) % 10_000 + 1000 for i in range(9)]
                pitcher = hash((home if half == "Top" else away, "p")) % 1000 + 50
                bases, outs = [0, 0, 0], 0
                while outs < 3:
                    ab += 1
                    ev = rng.choice(names, p=np.array(probs) / sum(probs))
                    batter = lineup[ab % 9]
                    pre = score[half]
                    b0, o0 = bases[:], outs
                    if ev in ("single", "field_error"):
                        runs = bases[2]; bases = [1, bases[0], bases[1]]
                    elif ev == "double":
                        runs = bases[2] + bases[1]; bases = [0, 1, bases[0]]
                    elif ev == "home_run":
                        runs = sum(bases) + 1; bases = [0, 0, 0]
                    elif ev in ("walk", "hit_by_pitch"):
                        runs = 1 if all(bases) else 0
                        bases = [1, bases[0] or bases[1], (bases[0] and bases[1]) or bases[2]] if not all(bases) else [1, 1, 1]
                    elif ev == "grounded_into_double_play" and bases[0] and outs < 2:
                        runs = 0; bases = [0, bases[1], bases[2]]; outs += 2
                    else:
                        runs = 0; outs += 1
                        if ev == "grounded_into_double_play":
                            ev = "field_out"
                    if outs > 3:
                        outs = 3
                    score[half] += runs
                    for pn in (1, 2):
                        last = pn == 2
                        rows.append({"game_type": "R", "game_pk": season * 1000 + gpk, "game_date": f"{season}-05-01", "home_team": home, "away_team": away,
                                     "inning": inning, "inning_topbot": half, "at_bat_number": ab, "pitch_number": pn, "batter": batter, "pitcher": pitcher,
                                     "stand": "L" if batter % 2 else "R", "p_throws": "L" if pitcher % 2 else "R", "events": ev if last else None,
                                     "outs_when_up": o0, "on_1b": 1 if b0[0] else np.nan, "on_2b": 1 if b0[1] else np.nan, "on_3b": 1 if b0[2] else np.nan,
                                     "bat_score": pre, "post_bat_score": score[half] if last else pre,
                                     **{f"fielder_{k}": hash((home if half == "Top" else away, k)) % 10_000 + 1000 for k in range(2, 10)}})
    return pd.DataFrame(rows)


def test_rraa():
    parts = {}
    for y in (2024, 2025):
        parts[y] = json.loads(json.dumps(rraa.season_parts(simulate(y), y, fetch_leaderboards=False)))
        p = parts[y]
        assert 0.05 < p["lgR_PA"] < 0.3 and p["wwoba_scale"] > 0 and p["woba_scale"] > 0
        # league-wide wRAA sums to ~0 for pitchers (every PA counted once)
        tot = sum(e["all"]["raa"] for e in p["pit"].values())
        assert abs(tot) < 1e-3 * sum(e["all"]["PA"] for e in p["pit"].values()), tot
        b = next(iter(p["bat"].values()))
        assert sum(b["all"]["parks"].values()) == b["all"]["PA"]
    pf = rraa.park_factors(parts)
    assert set(pf[2025]) == set(TEAMS) and all(0.5 < v < 1.5 for v in pf[2025].values())
    final = rraa.finalize(parts)
    some = next(iter(final[2025]["bat"].values()))["all"]
    assert {"RRAA", "RRAA_Bat", "wwOBA", "RRAA_BsR", "RRAA_Fld"} <= some.keys()
    # park and league adjustments are zero-sum-ish across the league: total pitcher RRAA close to 0
    assert abs(sum(v["all"]["RRAA"] for v in final[2025]["pit"].values())) < 5

    # finalize writes into season files and replaces old values
    with tempfile.TemporaryDirectory() as t:
        root = pathlib.Path(t)
        for y, p in parts.items():
            (root / str(y)).mkdir()
            (root / str(y) / "rraa_parts.json").write_text(json.dumps(p))
            pid = int(next(iter(p["bat"])))
            (root / str(y) / "bat.json").write_text(json.dumps({"players": [{"id": pid, "splits": {"all": {"PA": 1, "RRAA": 999}}}]}))
        rraa_finalize.main(root)
        d = json.loads((root / "2025" / "bat.json").read_text())
        assert d["players"][0]["splits"]["all"]["RRAA"] != 999 and "vsL" in d["players"][0]["splits"] or "vsR" in d["players"][0]["splits"]


def test_fld_team_adjust():
    inn = pd.DataFrame({"batter": [1, 2, 3], "team": ["A", "A", "B"], "inn": [100.0, 100.0, 50.0]})
    out = rraa.team_adjusted_fld({1: 10.0, 2: 0.0, 3: 4.0}, inn)
    assert abs(out[1] - 5.0) < 1e-9 and abs(out[2] + 5.0) < 1e-9 and abs(out[3]) < 1e-9


if __name__ == "__main__":
    test_rraa(); test_fld_team_adjust(); print("ok")
