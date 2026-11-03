"""Write RRAA into every season's bat.json / pit.json from the rraa_parts.json files on disk.

Run after season builds (the Build data workflow does it in its publish step) so park factors can pool
the previous seasons: python pipeline/rraa_finalize.py
"""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import rraa

OUT = pathlib.Path(__file__).resolve().parents[1] / "public" / "data"
KEYS = {"RRAA", "RRAA_Bat", "RRAA_BsR", "RRAA_Fld", "RRAA_wOBA", "wwOBA"}


def main(root=OUT):
    parts = {int(f.parent.name): json.loads(f.read_text()) for f in root.glob("*/rraa_parts.json")}
    if not parts:
        print("no rraa_parts.json files; nothing to do")
        return
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
                add = vals.get(p["id"])
                if not add:
                    continue
                hit += 1
                for sp, stats in add.items():
                    p["splits"].setdefault(sp, {}).update({k: round(v, 4) for k, v in stats.items()})
            f.write_text(json.dumps(d, separators=(",", ":")))
            print(f"{season} {role}: RRAA for {hit} players")


if __name__ == "__main__":
    main()
