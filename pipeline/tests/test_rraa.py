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
    assert {"RRAA", "RRAA_Bat", "wwOBA", "RRAA_BsR", "RRAA_Fld", "wwRC+"} <= some.keys()
    # wwRC+ is 100 for the PA-weighted league (non-pitcher) hitter, and above 100 exactly when batting runs are positive
    rows = [v["all"] for v in final[2025]["bat"].values() if "wwRC+" in v.get("all", {})]
    avg = sum(r["wwRC+"] * r["RRAA_PA"] for r in rows) / sum(r["RRAA_PA"] for r in rows)
    assert 97 < avg < 103, avg
    assert all((r["wwRC+"] > 100) == (r["RRAA_Bat"] > 0) for r in rows if abs(r["RRAA_Bat"]) > 0.5)
    # pitchers: wwOBA and wwRC+ allowed, PA-weighted league average about 100
    prow = [v["all"] for v in final[2025]["pit"].values()]
    assert all({"wwOBA", "wwRC+", "RRAA_wOBA", "lg_wwOBA"} <= r.keys() for r in prow)
    pavg = sum(r["wwRC+"] * r["RRAA_PA"] for r in prow) / sum(r["RRAA_PA"] for r in prow)
    assert 97 < pavg < 103, pavg
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


def test_scale_and_upgrade():
    p2 = rraa.season_parts(simulate(2025), 2025, fetch_leaderboards=False)
    assert 1.0 < p2["wwoba_scale"] < 2.0 and 1.0 < p2["woba_scale"] < 2.0  # FanGraphs-style scale
    # a v1 file (inverse scale, run sums inflated by k^2) upgrades to the same numbers
    kb, kp = p2["wwoba_scale"], p2["woba_scale"]
    v1 = json.loads(json.dumps(p2)); v1.pop("v"); v1["wwoba_scale"], v1["woba_scale"] = 1 / kb, 1 / kp
    for e in v1["bat"].values():
        for x in e.values():
            if isinstance(x, dict) and "raa" in x:
                x["raa"] *= kb * kb; x["lg"] *= kb * kb
    for e in v1["pit"].values():
        for x in e.values():
            x["raa"] *= kp * kp
    a, b = rraa.finalize({2025: p2}), rraa.finalize({2025: v1})
    pid = next(iter(a[2025]["bat"]))
    assert abs(a[2025]["bat"][pid]["all"]["RRAA"] - b[2025]["bat"][pid]["all"]["RRAA"]) < 1e-6
    # hitter platoon splits carry RRAA too, with baserunning/fielding shared by PA so the splits add up
    p2["bat"][str(pid)]["bsr"], p2["bat"][str(pid)]["fld"] = 3.0, -1.0
    r = rraa.finalize({2025: p2})[2025]["bat"][pid]
    if "vsL" in r and "vsR" in r and r["vsL"]["RRAA_PA"] + r["vsR"]["RRAA_PA"] == r["all"]["RRAA_PA"]:
        assert abs(r["vsL"]["RRAA_BsR"] + r["vsR"]["RRAA_BsR"] - 3.0) < 1e-6
    assert all("RRAA" in r[sp] for sp in r)


def test_fld_team_adjust():
    inn = pd.DataFrame({"batter": [1, 2, 3], "team": ["A", "A", "B"], "inn": [100.0, 100.0, 50.0]})
    out = rraa.team_adjusted_fld({1: 10.0, 2: 0.0, 3: 4.0}, inn)
    assert abs(out[1] - 5.0) < 1e-9 and abs(out[2] + 5.0) < 1e-9 and abs(out[3]) < 1e-9


def test_refresh_and_new_keys():
    import rraa_refresh
    with tempfile.TemporaryDirectory() as d:
        root = pathlib.Path(d)
        (root / "2025").mkdir()
        parts = rraa.season_parts(simulate(2025), 2025, fetch_leaderboards=False)
        pid = next(iter(parts["bat"]))
        (root / "2025" / "rraa_parts.json").write_text(json.dumps(parts))
        (root / "2025" / "bat.json").write_text(json.dumps({"players": [{"id": int(pid), "splits": {"all": {"RRAA_BsR": 99.0}}}]}))
        (root / "2025" / "pit.json").write_text(json.dumps({"players": []}))
        rraa_refresh.refresh(2025, root, bsr=lambda y: {int(pid): 2.5}, frv=lambda y: {int(pid): -3.0})
        rraa_finalize.main(root)
        s = json.loads((root / "2025" / "bat.json").read_text())["players"][0]["splits"]["all"]
        assert s["RRAA_BsR"] == 2.5 and s["RRAA_FRV"] == -3.0
        assert abs(s["RRAA_Bat"] - (s["RRAA_wRAA"] + s["RRAA_Park"] + s["RRAA_Lg"])) < 1e-3
        assert abs(s["RRAA"] - (s["RRAA_Bat"] + s["RRAA_BsR"] + s["RRAA_Fld"])) < 1e-3
        # a failed fetch keeps the old values
        rraa_refresh.refresh(2025, root, bsr=lambda y: (_ for _ in ()).throw(RuntimeError("blocked")), frv=lambda y: {})
        assert json.loads((root / "2025" / "rraa_parts.json").read_text())["bat"][pid]["bsr"] == 2.5


def test_player_meta():
    import player_meta
    with tempfile.TemporaryDirectory() as d:
        root = pathlib.Path(d); (root / "2025").mkdir()
        (root / "2025" / "bat.json").write_text(json.dumps({"players": [{"id": 1, "name": "A", "team": "NYY", "splits": {}}, {"id": 2, "name": "B", "team": "NYY", "splits": {}}]}))
        assert player_meta.apply(2025, root, lambda y: {1: {"pos": "SS", "bats": "S", "throws": "R"}}) == 1
        ps = json.loads((root / "2025" / "bat.json").read_text())["players"]
        assert ps[0]["pos"] == "SS" and ps[0]["bats"] == "S" and "pos" not in ps[1]
        assert player_meta.apply(2025, root, lambda y: (_ for _ in ()).throw(RuntimeError("blocked"))) == 0
        # rookie: under 130 AB / 50 IP in earlier seasons, debut not before the data starts
        (root / "2024").mkdir()
        (root / "2024" / "bat.json").write_text(json.dumps({"players": [{"id": 1, "splits": {"all": {"AB": 200}}}, {"id": 2, "splits": {"all": {"AB": 60}}}]}))
        (root / "2024" / "pit.json").write_text(json.dumps({"players": [{"id": 3, "splits": {"all": {"IP": 49.2}}}]}))
        (root / "2025" / "pit.json").write_text(json.dumps({"players": [{"id": 3, "splits": {}}]}))
        meta = {1: {"debut": "2024-04-01"}, 2: {"debut": "2024-09-01"}, 3: {"debut": "2024-05-01"}}
        player_meta.apply(2025, root, lambda y: meta)
        bat = {p["id"]: p for p in json.loads((root / "2025" / "bat.json").read_text())["players"]}
        pit = json.loads((root / "2025" / "pit.json").read_text())["players"][0]
        assert bat[1]["rookie"] is False and bat[2]["rookie"] is True and pit["rookie"] is True  # 49 2/3 IP < 50
        assert player_meta.is_rookie(2025, "2010-04-01", 0, 0, 2015) is False


def test_rwar():
    with tempfile.TemporaryDirectory() as t:
        d = pathlib.Path(t) / "2025"; d.mkdir()
        bat = [{"id": 1, "splits": {"all": {"RRAA": 30.0, "Positional": -10.0, "RRAA_PA": 600, "WAR": 4.0}}},
               {"id": 2, "splits": {"all": {"RRAA": -10.0, "Positional": 5.0, "RRAA_PA": 400, "WAR": 0.5}}},
               {"id": 3, "splits": {"all": {"PA": 3, "WAR": 0.0}}}]  # no RRAA: left alone
        pit = [{"id": 4, "splits": {"all": {"RRAA": 20.0, "RRAA_PA": 800, "TBF": 800, "IP": 190.1, "WAR": 4.0}}},
               {"id": 5, "splits": {"all": {"RRAA": -5.0, "RRAA_PA": 300, "TBF": 300, "IP": 70.2, "WAR": 0.2}}}]
        (d / "bat.json").write_text(json.dumps({"players": bat})); (d / "pit.json").write_text(json.dumps({"players": pit}))
        rraa_finalize.add_rwar(d, 0.12)
        b = [p["splits"]["all"] for p in json.loads((d / "bat.json").read_text())["players"]]
        q = [p["splits"]["all"] for p in json.loads((d / "pit.json").read_text())["players"]]
        assert abs(b[0]["RWAR"] + b[1]["RWAR"] - 4.5) < 0.02 and "RWAR" not in b[2]  # totals match FanGraphs WAR
        assert abs(q[0]["RWAR"] + q[1]["RWAR"] - 4.2) < 0.02
        assert b[0]["RWAR"] > b[1]["RWAR"] and q[0]["RWAR"] > q[1]["RWAR"]


if __name__ == "__main__":
    test_rraa(); test_scale_and_upgrade(); test_fld_team_adjust(); test_refresh_and_new_keys(); test_player_meta(); test_rwar(); print("ok")
