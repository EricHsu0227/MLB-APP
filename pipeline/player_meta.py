"""Player info for leaderboard filters: primary position, bats and throws, from the MLB Stats API.

Writes top-level "pos", "bats", "throws" and "rookie" into each player of <season>/bat.json and pit.json. One API call per season,
so it runs both in the full build and in the cheap refresh workflow.
"""
from __future__ import annotations
import json, pathlib

URL = "https://statsapi.mlb.com/api/v1/sports/1/players"


def fetch(season: int) -> dict[int, dict]:
    from mlbhttp import get
    people = get(URL, params={"season": season}, min_interval=0.5).json().get("people", [])
    return {int(p["id"]): {"pos": (p.get("primaryPosition") or {}).get("abbreviation"), "bats": (p.get("batSide") or {}).get("code"),
                           "throws": (p.get("pitchHand") or {}).get("code"),
                           "debut": p.get("mlbDebutDate")} for p in people if p.get("id")}


def prior_totals(season: int, root: pathlib.Path) -> dict[int, list[float]]:
    """{id: [career AB, career IP]} from the seasons before `season` that are in the data (2015 on)."""
    tot: dict[int, list[float]] = {}
    for d in root.iterdir():
        if not (d.name.isdigit() and int(d.name) < season):
            continue
        for role, key, i in (("bat", "AB", 0), ("pit", "IP", 1)):
            f = d / f"{role}.json"
            if f.exists():
                for p in json.loads(f.read_text())["players"]:
                    v = (p.get("splits", {}).get("all") or {}).get(key)
                    if isinstance(v, (int, float)):
                        ip = int(v) + (v - int(v)) * 10 / 3 if key == "IP" else v  # 12.2 IP = 12 2/3
                        tot.setdefault(p["id"], [0.0, 0.0])[i] += ip
    return tot


def is_rookie(season: int, debut: str | None, ab: float, ip: float, first_year: int) -> bool:
    """MLB rookie limits (130 AB / 50 IP before the season; the 45 roster days are not in the data)."""
    if debut:
        y = int(debut[:4])
        if y > season:
            return False
        if y < first_year:  # debuted before our data starts: we can't see those totals, so not a rookie
            return False
    return ab < 130 and ip < 50


def apply(season: int, root: pathlib.Path, fetch_fn=fetch) -> int:
    try:
        meta = fetch_fn(season)
    except Exception as e:  # noqa: BLE001
        print(f"[warn] {season} player info unavailable: {e}")
        return 0
    hit = 0
    years = [int(d.name) for d in root.iterdir() if d.name.isdigit()]
    first = min(years) if years else season
    prior = prior_totals(season, root)
    for role in ("bat", "pit"):
        f = root / str(season) / f"{role}.json"
        if not f.exists():
            continue
        d = json.loads(f.read_text())
        for p in d["players"]:
            m = meta.get(p["id"])
            if m:
                p.update({k: v for k, v in m.items() if v and k != "debut"})
                ab, ip = prior.get(p["id"], [0.0, 0.0])
                p["rookie"] = is_rookie(season, m.get("debut"), ab, ip, first)
                hit += 1
        f.write_text(json.dumps(d, separators=(",", ":")))
    print(f"{season}: player info for {hit} rows")
    return hit
