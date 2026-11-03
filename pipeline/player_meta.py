"""Player info for leaderboard filters: primary position, bats and throws, from the MLB Stats API.

Writes top-level "pos", "bats" and "throws" into each player of <season>/bat.json and pit.json. One API call per season,
so it runs both in the full build and in the cheap refresh workflow.
"""
from __future__ import annotations
import json, pathlib

URL = "https://statsapi.mlb.com/api/v1/sports/1/players"


def fetch(season: int) -> dict[int, dict]:
    from mlbhttp import get
    people = get(URL, params={"season": season}, min_interval=0.5).json().get("people", [])
    return {int(p["id"]): {"pos": (p.get("primaryPosition") or {}).get("abbreviation"), "bats": (p.get("batSide") or {}).get("code"),
                           "throws": (p.get("pitchHand") or {}).get("code")} for p in people if p.get("id")}


def apply(season: int, root: pathlib.Path, fetch_fn=fetch) -> int:
    try:
        meta = fetch_fn(season)
    except Exception as e:  # noqa: BLE001
        print(f"[warn] {season} player info unavailable: {e}")
        return 0
    hit = 0
    for role in ("bat", "pit"):
        f = root / str(season) / f"{role}.json"
        if not f.exists():
            continue
        d = json.loads(f.read_text())
        for p in d["players"]:
            m = meta.get(p["id"])
            if m:
                p.update({k: v for k, v in m.items() if v})
                hit += 1
        f.write_text(json.dumps(d, separators=(",", ":")))
    print(f"{season}: player info for {hit} rows")
    return hit
