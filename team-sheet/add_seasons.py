"""
Add full-stat (★) seasons to MLB Team Sheet, then rebuild the page (public/team-sheet/) and the offline file.

    pip install pandas numpy
    python team-sheet/add_seasons.py 2025 2024        # any season from 2015 on (Statcast era)

Per season: every regular-season pitch from Baseball Savant (≈30–45 min, ≈500 MB in build/raw/<season>/,
safe to delete afterwards), daily active rosters + official stats from the MLB Stats API -> build/data/<season>.json.
Re-running skips files already downloaded. To rebuild only the site: python team-sheet/make_site.py
"""
import sys, subprocess, os
here = os.path.dirname(os.path.abspath(__file__)); os.chdir(here)
for y in [int(a) for a in sys.argv[1:]]:
    if y < 2015: sys.exit(f"{y}: pitch-by-pitch data only exists from 2015 on")
    for cmd in (["fetch_statcast.py", str(y), f"raw/{y}"], ["fetch_rosters.py", str(y), f"raw/{y}"],
                ["build_data.py", str(y), f"raw/{y}", f"data/{y}.json"]):
        subprocess.run([sys.executable, *cmd], check=True)
subprocess.run([sys.executable, "make_site.py"], check=True)
subprocess.run([sys.executable, "make_app.py", "template.html", "data", "mlb-team-sheet.html"], check=True)
print("Done: public/team-sheet/ rebuilt; offline copy at team-sheet/mlb-team-sheet.html")
