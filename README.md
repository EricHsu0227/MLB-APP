# MLB Stats

Player stats site: FanGraphs yearly stats, Baseball Savant (Statcast) where available, lefty/righty splits on every
stat, self-calculated Statcast stats (prefixed `sc_`, "calc" in the UI), customizable player page and percentiles,
leaderboard, and player comparison. See [PLAN.md](PLAN.md).

```
npm install
npm run sample   # synthetic dev data (NOT real stats) -> public/data
npm run dev
npm test         # JS helpers; python pipeline/tests/test_statcast.py for the Statcast calculator
```

Real data: `pip install -r pipeline/requirements.txt && python pipeline/build.py 2025` (needs network access to
fangraphs.com and baseballsavant.mlb.com; the GitHub Action does this). FanGraphs/Savant endpoints are undocumented
and the pipeline's live fetching has not yet been run against them; check the first Action log.
