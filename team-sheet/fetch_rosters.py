"""Snapshot every team's active (26-man) roster for every day of the regular season -> raw/<season>/active.json
   {"start": "YYYY-MM-DD", "end": ..., "days": {"<teamId>": {"<YYYY-MM-DD>": [playerIds...]}}}"""
import sys, os, json, datetime as dt, urllib.request, concurrent.futures as cf, time
season, out = int(sys.argv[1]), sys.argv[2]
API = "https://statsapi.mlb.com/api/v1"
def get(url):
    for k in range(5):
        try: return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "team-sheet builder"}), timeout=60).read())
        except Exception:
            if k == 4: raise
            time.sleep(2 * (k + 1))
dates = [d["date"] for d in get(f"{API}/schedule?sportId=1&season={season}&gameType=R&fields=dates,date")["dates"]]
start, end = dt.date.fromisoformat(dates[0]), dt.date.fromisoformat(dates[-1])
days = [(start + dt.timedelta(i)).isoformat() for i in range((end - start).days + 1)]
teams = [t["id"] for t in get(f"{API}/teams?sportId=1&season={season}")["teams"]]
cache = os.path.join(out, "active.json")
res = json.load(open(cache))["days"] if os.path.exists(cache) else {}
jobs = [(t, d) for t in teams for d in days if d not in res.get(str(t), {})]
def one(job):
    t, d = job
    r = get(f"{API}/teams/{t}/roster?rosterType=active&date={d}&fields=roster,person,id")
    return t, d, [x["person"]["id"] for x in r.get("roster", [])]
with cf.ThreadPoolExecutor(16) as ex:
    for i, (t, d, ids) in enumerate(ex.map(one, jobs)):
        res.setdefault(str(t), {})[d] = ids
        if i % 500 == 0: print(i, "/", len(jobs), flush=True)
json.dump({"start": days[0], "end": days[-1], "days": res}, open(cache, "w"))
print("saved", cache, sum(len(v) for v in res.values()), "team-days")
