"""Download every regular-season pitch of a season from Baseball Savant, by batting team, in two halves."""
import sys, os, time, urllib.request, concurrent.futures as cf
season = int(sys.argv[1]); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
TEAMS = "AZ ATL BAL BOS CHC CWS CIN CLE COL DET HOU KC LAA LAD MIA MIL MIN NYM NYY ATH PHI PIT SD SF SEA STL TB TEX TOR WSH".split()
if season < 2025: TEAMS = [t if t != "ATH" else "OAK" for t in TEAMS]
HALVES = [(f"{season}-03-01", f"{season}-06-30"), (f"{season}-07-01", f"{season}-11-30")]
def url(t, a, b):
    return ("https://baseballsavant.mlb.com/statcast_search/csv?all=true&type=details&player_type=batter"
            f"&hfSea={season}%7C&hfGT=R%7C&hfTeam={t}%7C&game_date_gt={a}&game_date_lt={b}&min_pitches=0&min_results=0&group_by=name")
def get(job):
    t, i, (a, b) = job; fn = f"{out}/{t}_{i}.csv"
    if os.path.exists(fn) and os.path.getsize(fn) > 1000: return fn, "cached"
    for k in range(4):
        try:
            req = urllib.request.Request(url(t, a, b), headers={"User-Agent": "Mozilla/5.0 (team-sheet builder)"})
            data = urllib.request.urlopen(req, timeout=180).read()
            rows = data.count(b"\n")
            if rows < 100: raise RuntimeError(f"only {rows} rows")
            open(fn, "wb").write(data); return fn, rows
        except Exception as e:
            err = e; time.sleep(5 * (k + 1))
    return fn, f"FAILED {err}"
jobs = [(t, i, h) for t in TEAMS for i, h in enumerate(HALVES)]
with cf.ThreadPoolExecutor(3) as ex:
    for fn, r in ex.map(get, jobs): print(fn, r, flush=True)
