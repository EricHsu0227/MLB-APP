"""Build static JSON: python pipeline/build.py 2025 [--role bat|pit]. Output: public/data/<season>/<role>.json"""
import json, math, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import fangraphs, rraa, rraa_finalize, savant, statcast

OUT = pathlib.Path(__file__).resolve().parents[1] / "public" / "data"


def clean(d):
    return {k: (None if isinstance(v, float) and math.isnan(v) else (round(v, 4) if isinstance(v, float) else v)) for k, v in d.items()}


def merge(fg: dict, sc: dict) -> list[dict]:
    rows = []
    for pid in fg.keys() | sc.keys():
        f, s = fg.get(pid, {}), sc.get(pid, {})
        splits = {}
        for sp in ("all", "vsL", "vsR"):
            m = {**f.get(sp, {}), **{f"sc_{k}": v for k, v in s.get(sp, {}).items()}}  # self-calculated keys prefixed
            if m:
                splits[sp] = clean(m)
        rows.append({"id": pid, "name": f.get("name"), "team": f.get("team"), "splits": splits})
    return rows


def main(season: int, roles=("bat", "pit")):
    pitches = None
    if season >= savant.FIRST_STATCAST:
        pitches = savant.season_pitches(season, f"{season}-03-15", f"{season}-11-05")
    have = pitches is not None and len(pitches) > 0
    d = OUT / str(season)
    for role in roles:
        fg = fangraphs.table(season, role)
        sc = statcast.calc_player_table(pitches, role) if have else {}
        if not fg and not sc:  # season not started yet (e.g. nightly run in January): don't publish an empty season
            print(f"{season} {role}: no data yet, skipped")
            continue
        d.mkdir(parents=True, exist_ok=True)
        (d / f"{role}.json").write_text(json.dumps({"season": season, "role": role, "players": merge(fg, sc)}, separators=(",", ":")))
    if have and d.exists():
        (d / "rraa_parts.json").write_text(json.dumps(rraa.season_parts(pitches, season), separators=(",", ":")))
        rraa_finalize.main(OUT)
    idx = OUT / "index.json"
    seasons = sorted({int(p.name) for p in OUT.iterdir() if p.is_dir() and p.name.isdigit()})
    idx.write_text(json.dumps({"seasons": seasons, "statcastFrom": savant.FIRST_STATCAST}))


if __name__ == "__main__":
    main(int(sys.argv[1]))
