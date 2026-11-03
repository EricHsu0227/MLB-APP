"""Re-fetch the Savant baserunning and fielding leaderboards for seasons already built, then rewrite RRAA.
Also refreshes the Savant leaderboard keys (sv_: OAA, FRV, arm, framing, sprint speed, bat tracking).

Cheaper than rebuilding a season (no pitch-level download). Run by the "Refresh RRAA leaderboards" workflow:
python pipeline/rraa_refresh.py [2016-2026]
"""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import player_meta, rraa, rraa_finalize, savant_boards

OUT = rraa_finalize.OUT


def refresh(year: int, root=OUT, bsr=rraa.savant_bsr, frv=rraa.savant_frv) -> bool:
    f = root / str(year) / "rraa_parts.json"
    if not f.exists():
        return False
    p = rraa.upgrade(json.loads(f.read_text()))
    try:
        b = bsr(year)
    except Exception as e:  # noqa: BLE001
        print(f"[warn] {year} baserunning unavailable, kept old values: {e}")
        b = None
    try:
        r = frv(year)
    except Exception as e:  # noqa: BLE001
        print(f"[warn] {year} fielding unavailable: {e}")
        r = None
    for pid, e in p["bat"].items():
        if b is not None:
            e.pop("bsr", None)
            if int(pid) in b:
                e["bsr"] = round(b[int(pid)], 3)
        if r is not None and int(pid) in r:
            e["frv"] = round(r[int(pid)], 3)
    f.write_text(json.dumps(p, separators=(",", ":")))
    print(f"{year}: baserunning for {len(b or {})} runners, fielding for {len(r or {})} fielders")
    return True


def main(arg: str | None = None, root=OUT):
    years = sorted(int(x.parent.name) for x in root.glob("*/rraa_parts.json"))
    if arg:
        a, _, b = arg.partition("-")
        years = [y for y in years if int(a) <= y <= int(b or a)]
    for y in years:
        refresh(y, root)
        savant_boards.apply(y, root)
        player_meta.apply(y, root)
    rraa_finalize.main(root)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
