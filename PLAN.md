# MLB Stats — plan

## Goal
Player stats site: every FanGraphs season, every Baseball Savant season available, lefty/righty splits for
every stat, Statcast stats calculated by us from pitch-level data, customizable player page and percentiles,
a leaderboard over all stats/splits, and a compare tool over all stats.

## Stack
- Frontend: Vite + React 18 + react-router (static site, no server). Preferences in localStorage.
- Data: Python pipeline (pandas) run by GitHub Actions, which writes static JSON to `public/data/`.
  Sessions in the Claude cloud environment cannot reach FanGraphs / Savant / MLB Stats API (proxy 403),
  GitHub Actions runners can. The pipeline is therefore tested here on synthetic pitch data only.
- Hosting: any static host (Cloudflare Pages/Workers, GitHub Pages).

## Data pipeline
| Source | What | How |
|---|---|---|
| FanGraphs leaders API | Yearly bat/pit stats, all seasons (1871+ for standard, advanced stats from when available) | `/api/leaders/major-league/data`, one request per season/type, throttled. Splits: `month=13` (vs L) / `14` (vs R), available 2002+ |
| Baseball Savant | Pitch-level Statcast (2015+; pitch tracking 2008+) | `statcast_search/csv`, one day per request, cached to parquet |
| Baseball Savant leaderboards | Official percentile/expected/sprint/OAA CSVs for available years | `leaderboard/...?csv=true` |
| Self-calculated | wOBA, xwOBA, EV, LA, barrel%, hard-hit%, sweet-spot%, whiff%, chase%, zone-contact%, K%, BB%, GB/FB/LD%, pull/oppo% — for all / vs L / vs R (pitchers: vs LHB / RHB) | `pipeline/statcast.py` from pitch rows |

Output: `public/data/index.json` (seasons + stat catalog version), `public/data/{season}/{bat|pit}.json`
(rows = players, each with `splits: {all, vsL, vsR}` of stat-key -> value).

## Terms of use
FanGraphs and Savant data is for personal / non-commercial use; both discourage heavy automated scraping and
FanGraphs' terms restrict redistribution. Pipeline throttles requests, caches, and fetches nightly only for the
current season. Re-publishing their raw data on a public site is Eric's call — default is a private deploy.

## Stages
1. Data ingest + self-calculated Statcast (pipeline, tests)
2. App shell, stat catalog, data loader
3. Player page: show/hide every section and stat, reorder, layout (columns/density), theme/colors
4. Percentiles: choose stats, season, split, pool (qualified / min PA / position), colors
5. Leaderboard: every stat x split, filters, sort, column picker, CSV export
6. Compare: any players x any stats x any split
