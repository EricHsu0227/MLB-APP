"""Write RRAA into every season's bat.json / pit.json from the rraa_parts.json files on disk.

Run after season builds (the Build data workflow does it in its publish step) so park factors can pool
the previous seasons: python pipeline/rraa_finalize.py
"""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import rraa

OUT = pathlib.Path(__file__).resolve().parents[1] / "public" / "data"
KEYS = {"RRAA", "RRAA_Bat", "RRAA_BsR", "RRAA_Fld", "RRAA_wOBA", "wwOBA", "RRAA_wRAA", "RRAA_Park", "RRAA_Lg", "RRAA_PA", "RRAA_FRV", "lg_wwOBA", "lg_wOBA", "wwRC+", "RWAR"}


def main(root=OUT):
    parts = {int(f.parent.name): json.loads(f.read_text()) for f in root.glob("*/rraa_parts.json")}
    if not parts:
        print("no rraa_parts.json files; nothing to do")
        return
    for season, p in parts.items():  # persist upgraded parts so they are only rescaled once
        if p.get("v", 1) < 2:
            parts[season] = rraa.upgrade(p)
            (root / str(season) / "rraa_parts.json").write_text(json.dumps(parts[season], separators=(",", ":")))
    final = rraa.finalize(parts)
    for season, roles in final.items():
        for role, vals in roles.items():
            f = root / str(season) / f"{role}.json"
            if not f.exists():
                continue
            d = json.loads(f.read_text())
            hit = 0
            for p in d["players"]:
                for sp in p["splits"].values():
                    for k in KEYS & sp.keys():
                        del sp[k]
                    drop_calc_dupes(sp)
                add = vals.get(p["id"])
                if not add:
                    continue
                hit += 1
                for sp, stats in add.items():
                    p["splits"].setdefault(sp, {}).update({k: round(v, 4) for k, v in stats.items()})
            f.write_text(json.dumps(d, separators=(",", ":")))
            print(f"{season} {role}: RRAA for {hit} players")
        add_rwar(root / str(season), parts[season]["lgR_PA"])


def drop_calc_dupes(split: dict) -> None:
    """Remove our own sc_ calculation of a stat when FanGraphs/Savant already gives it (cleans files built before build.merge did this)."""
    for k in [k for k in split if k.startswith("sc_")]:
        if split.get(k[3:]) is not None:
            del split[k]


def _ip(v) -> float:
    return int(v) + (v - int(v)) * 10 / 3  # 12.2 IP = 12 2/3


def add_rwar(d: pathlib.Path, lgR_PA: float) -> None:
    """RWAR: RRAA turned into wins above replacement, WAR-style.

    Hitters: (RRAA + FanGraphs positional runs + replacement runs) / runs per win.
    Pitchers: (RRAA + replacement runs) / runs per win.
    Replacement runs are a flat rate per PA (hitters) or per batter faced (pitchers), set so the season's
    RWAR totals match the FanGraphs WAR totals for hitters and for pitchers (about 570 / 430 a full season).
    Runs per win uses the FanGraphs formula 9 * (MLB R/IP) * 1.5 + 3. Season totals ("all") only.
    """
    files = {r: d / f"{r}.json" for r in ("bat", "pit")}
    if not all(f.exists() for f in files.values()):
        return
    data = {r: json.loads(f.read_text()) for r, f in files.items()}
    allp = {r: [p["splits"]["all"] for p in data[r]["players"] if "all" in p["splits"]] for r in data}
    tbf = sum(s.get("TBF") or 0 for s in allp["pit"])
    ip = sum(_ip(s["IP"]) for s in allp["pit"] if isinstance(s.get("IP"), (int, float)))
    if not tbf or not ip:
        return
    rpw = 9 * (lgR_PA * tbf / ip) * 1.5 + 3
    for role, base in (("bat", lambda s: s["RRAA"] + (s.get("Positional") or 0.0)), ("pit", lambda s: s["RRAA"])):
        rows = [s for s in allp[role] if isinstance(s.get("RRAA"), (int, float)) and s.get("RRAA_PA")]
        target = sum(s.get("WAR") or 0.0 for s in allp[role])
        n = sum(s["RRAA_PA"] for s in rows)
        if not rows or not n:
            continue
        rep_rate = (target * rpw - sum(base(s) for s in rows)) / n
        for s in rows:
            s["RWAR"] = round((base(s) + rep_rate * s["RRAA_PA"]) / rpw, 2)
        files[role].write_text(json.dumps(data[role], separators=(",", ":")))
        print(f"{d.name} {role}: RWAR for {len(rows)} players (runs/win {rpw:.2f}, replacement {rep_rate * 600:.1f} runs per 600)")


if __name__ == "__main__":
    main()
