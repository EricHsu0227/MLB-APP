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

## Deploy (Cloudflare Workers, static assets)
Cloudflare dashboard -> Workers & Pages -> Create -> Import a repository -> MLB-APP.
Build command `npm run build`, deploy command `npx wrangler deploy`. Every push to `main` (including nightly data
commits) redeploys. Keep the site private: Zero Trust -> Access -> Applications -> add the Worker's URL with an
"allow my email" policy (FanGraphs / Savant data terms).
