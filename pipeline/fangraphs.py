"""FanGraphs leaderboard JSON -> {playerid: {stat: value}} per split.

Endpoint is undocumented and may change; verify in the Actions log. `month` selects splits:
0 = full season, 13 = vs LHP/LHB, 14 = vs RHP/RHB (splits exist from 2002).
"""
from mlbhttp import get

URL = "https://www.fangraphs.com/api/leaders/major-league/data"
SPLIT_MONTH = {"all": 0, "vsL": 13, "vsR": 14}
FIRST_SPLIT_SEASON = 2002


def fetch(season: int, role: str, split: str = "all") -> list[dict]:
    params = {
        "age": "", "pos": "all", "stats": "bat" if role == "bat" else "pit", "lg": "all",
        "qual": "0", "season": season, "season1": season, "startdate": "", "enddate": "",
        "month": SPLIT_MONTH[split], "hand": "", "team": "0", "pageitems": "5000", "pagenum": "1",
        "ind": "0", "rost": "0", "players": "0", "type": "8", "sortdir": "default", "sortstat": "WAR",
    }
    j = get(URL, params=params).json()
    return j["data"] if isinstance(j, dict) else j


def table(season: int, role: str) -> dict[int, dict]:
    """{mlbam-or-fg id: {"name":..., "team":..., "all": {...}, "vsL": {...}, "vsR": {...}}}"""
    out: dict[int, dict] = {}
    for split in SPLIT_MONTH:
        if split != "all" and season < FIRST_SPLIT_SEASON:
            continue
        for row in fetch(season, role, split):
            pid = row.get("xMLBAMID") or row.get("playerid")
            if pid is None:
                continue
            e = out.setdefault(int(pid), {"name": row.get("PlayerName") or row.get("Name"), "team": row.get("TeamName") or row.get("Team")})
            e[split] = {k: v for k, v in row.items() if isinstance(v, (int, float)) and k not in ("playerid", "xMLBAMID")}
    return out
