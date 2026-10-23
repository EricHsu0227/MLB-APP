"""Baseball Savant: pitch-level Statcast (statcast_search CSV) with a per-day parquet cache."""
import io, pathlib
import pandas as pd
from mlbhttp import get

SEARCH = "https://baseballsavant.mlb.com/statcast_search/csv"
CACHE = pathlib.Path(__file__).parent / "cache"
FIRST_STATCAST = 2015  # batted-ball tracking; pitch tracking exists from 2008


def day(date: str) -> pd.DataFrame:
    CACHE.mkdir(exist_ok=True)
    f = CACHE / f"pitches_{date}.parquet"
    if f.exists():
        return pd.read_parquet(f)
    params = {"all": "true", "hfGT": "R|", "game_date_gt": date, "game_date_lt": date, "type": "details", "player_type": "batter"}
    df = pd.read_csv(io.StringIO(get(SEARCH, params=params, min_interval=3.0).text), low_memory=False)
    df.to_parquet(f)
    return df


def season_pitches(season: int, start: str, end: str) -> pd.DataFrame:
    days = pd.date_range(start, end).strftime("%Y-%m-%d")
    frames = [d for d in (day(x) for x in days) if len(d)]
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def leaderboard(kind: str, season: int, role: str) -> pd.DataFrame:
    """Official Savant leaderboards, e.g. kind='expected_statistics'|'percentile-rankings'|'sprint_speed'."""
    url = f"https://baseballsavant.mlb.com/leaderboard/{kind}"
    return pd.read_csv(io.StringIO(get(url, params={"type": "batter" if role == "bat" else "pitcher", "year": season, "csv": "true"}).text))
