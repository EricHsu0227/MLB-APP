"""Build static JSON: python pipeline/build.py 2025 [--role bat|pit]. Output: public/data/<season>/<role>.json"""
import json, math, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import fangraphs, player_meta, rraa, rraa_finalize, savant, savant_boards, savant_sections, statcast

OUT = pathlib.Path(__file__).resolve().parents[1] / "public" / "data"


def clean(d):
    return {k: (None if isinstance(v, float) and math.isnan(v) else (round(v, 4) if isinstance(v, float) else v)) for k, v in d.items()}


def merge(fg: dict, sc: dict) -> list[dict]:
    rows = []
    for pid in fg.keys() | sc.keys():
        f, s = fg.get(pid, {}), sc.get(pid, {})
        splits = {}
        for sp in ("all", "vsL", "vsR"):
            m = {**f.get(sp, {}), **{(k[6:] if k.startswith("__sv__") else f"sc_{k}"): v for k, v in s.get(sp, {}).items()}}  # self-calculated keys prefixed
            if m:
                splits[sp] = clean(m)
        rows.append({"id": pid, "name": f.get("name"), "team": f.get("team"), "splits": splits})
    return rows


def previous_fg(season: int, role: str) -> dict:
    """FanGraphs stats already published for this season (every key except our sc_/RRAA ones)."""
    f = OUT / str(season) / f"{role}.json"
    if not f.exists():
        return {}
    ours = lambda k: k.startswith(("sc_", "sv")) or k in rraa_finalize.KEYS  # noqa: E731
    out = {}
    for p in json.loads(f.read_text())["players"]:
        e = {"name": p.get("name"), "team": p.get("team")}
        for sp, st in p["splits"].items():
            fgs = {k: v for k, v in st.items() if not ours(k)}
            if fgs:
                e[sp] = fgs
        out[p["id"]] = e
    return out


def fg_table(season: int, role: str) -> dict:
    try:
        return fangraphs.table(season, role)
    except Exception as e:  # noqa: BLE001  FanGraphs sometimes blocks CI runners; keep what we published before
        prev = previous_fg(season, role)
        print(f"[warn] FanGraphs {season} {role} failed ({e}); reusing {len(prev)} published rows")
        return prev


def write_sections(season: int, role: str, secs: dict):
    """Savant player-page sections (from pitches), sharded by player id."""
    d = OUT / str(season)
    if not secs:
        return
    for i, shard in savant_sections.shards(secs).items():
        (d / f"savant-{role}-{i}.json").write_text(json.dumps(shard, separators=(",", ":")))
    print(f"{season} {role}: Savant sections for {len(secs)} players")


def main(season: int, roles=("bat", "pit")):
    pitches = None
    if season >= savant.FIRST_STATCAST:
        pitches = savant.season_pitches(season, f"{season}-03-15", f"{season}-11-05")
    have = pitches is not None and len(pitches) > 0
    d = OUT / str(season)
    secs: dict[str, dict] = {}
    for role in roles:
        fg = fg_table(season, role)
        sc = statcast.calc_player_table(pitches, role) if have else {}
        secs[role] = savant_sections.player_sections(pitches, role) if have else {}
        for pid, s in secs[role].items():  # table-friendly Savant numbers become season stat keys (prefix sv)
            sc.setdefault(pid, {}).setdefault("all", {}).update({"__sv__" + k: v for k, v in savant_sections.season_keys(s, role).items()})
        for pid, by in (savant_sections.hand_keys(pitches, role) if have else {}).items():  # the same keys vs LHP/RHP (LHB/RHB)
            for sp, keys in by.items():
                sc.setdefault(pid, {}).setdefault(sp, {}).update({"__sv__" + k: v for k, v in keys.items()})
        if not fg and not sc:  # season not started yet (e.g. nightly run in January): don't publish an empty season
            print(f"{season} {role}: no data yet, skipped")
            continue
        d.mkdir(parents=True, exist_ok=True)
        (d / f"{role}.json").write_text(json.dumps({"season": season, "role": role, "players": merge(fg, sc)}, separators=(",", ":")))
    if have and d.exists():
        (d / "rraa_parts.json").write_text(json.dumps(rraa.season_parts(pitches, season), separators=(",", ":")))
        rraa_finalize.main(OUT)
    if d.exists():
        savant_boards.apply(season, OUT)
        player_meta.apply(season, OUT)
        for role in roles:
            write_sections(season, role, secs.get(role, {}))
    idx = OUT / "index.json"
    seasons = sorted({int(p.name) for p in OUT.iterdir() if p.is_dir() and p.name.isdigit()})
    idx.write_text(json.dumps({"seasons": seasons, "statcastFrom": savant.FIRST_STATCAST}))


if __name__ == "__main__":
    main(int(sys.argv[1]))
