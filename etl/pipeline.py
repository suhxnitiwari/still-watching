"""Turn Netflix's viewing-history export into clean tables.

Netflix's "Viewing activity" download has two columns, Title and Date, and packs
the show, season and episode into one Title string, e.g.
"Gilmore Girls: Season 2: The Bracebridge Dinner".

    .venv/bin/python etl/pipeline.py [path/to/SuhaniNetflixViewingHistory.csv]
"""
import re
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "SuhaniNetflixViewingHistory.csv"
OUT = ROOT / "build"

# Dates that frame the story.
CRACKDOWN = pd.Timestamp("2023-05-23")  # Netflix starts enforcing paid sharing in the US
MOVED_TO_AUSTIN = pd.Timestamp("2024-08-15")

# Titles that never reach the site: sexual, political or otherwise inappropriate. The list is private
# (etl/private/ is gitignored) because publishing it would reveal exactly what it hides.
_BLOCK = ROOT / "etl" / "private" / "blocklist.txt"
BLOCKED = {l.strip() for l in _BLOCK.read_text().splitlines() if l.strip() and not l.startswith("#")} if _BLOCK.exists() else set()

SEASON = re.compile(r"^(season|series|part|volume|chapter|book|limited series|collection)\b", re.I)


def split_title(title):
    """Split a Netflix title into (show, season, episode)."""
    parts = [p.strip() for p in title.split(":")]
    if len(parts) == 1:
        return title.strip(), None, None
    show, rest = parts[0], parts[1:]
    season = rest.pop(0) if len(rest) > 1 and SEASON.match(rest[0]) else None
    return show, season, ": ".join(rest) or None


def extract(path):
    df = pd.read_csv(path, encoding="utf-8-sig")
    df["date"] = pd.to_datetime(df["Date"], format="%m/%d/%y")
    return df.rename(columns={"Title": "title"})[["title", "date"]]


def transform(df):
    df = df.drop_duplicates().copy()
    df[["show", "season", "episode"]] = df["title"].apply(lambda t: pd.Series(split_title(t)))
    df = df[~df["show"].isin(BLOCKED)].copy()
    # A show that only ever appears as a bare title is a movie or a special.
    episodes_per_show = df.groupby("show")["episode"].transform("count")
    df["kind"] = (episodes_per_show > 0).map({True: "series", False: "movie"})
    df["era"] = (df["date"] >= MOVED_TO_AUSTIN).map({False: "Dallas", True: "Austin"})
    df["month"] = df["date"].dt.to_period("M").astype(str)
    df["weekday"] = df["date"].dt.day_name()
    return df.sort_values("date").reset_index(drop=True)


def binges(df):
    """Episodes of one show watched on one day; 3+ counts as a binge."""
    days = df[df["kind"] == "series"].groupby(["date", "show"]).size().rename("episodes").reset_index()
    return days[days["episodes"] >= 3].sort_values("episodes", ascending=False)


def main():
    df = transform(extract(RAW))
    OUT.mkdir(exist_ok=True)
    df.to_csv(OUT / "views.csv", index=False)
    b = binges(df)
    b.to_csv(OUT / "binges.csv", index=False)
    monthly = df.groupby("month").size().rename("views")
    monthly.to_csv(OUT / "monthly.csv")

    print(f"{len(df):,} views, {df['date'].min():%b %d, %Y} to {df['date'].max():%b %d, %Y}")
    print(f"  {df['show'].nunique():,} titles: {(df.drop_duplicates('show')['kind'] == 'series').sum()} series, "
          f"{(df.drop_duplicates('show')['kind'] == 'movie').sum()} movies")
    print(f"  {len(b):,} binge days (3+ episodes of one show)")
    for label, start, end in [("year before the crackdown", CRACKDOWN - pd.DateOffset(years=1), CRACKDOWN),
                              ("crackdown to Austin", CRACKDOWN, MOVED_TO_AUSTIN),
                              ("since Austin", MOVED_TO_AUSTIN, df["date"].max() + pd.Timedelta(days=1))]:
        span = df[(df["date"] >= start) & (df["date"] < end)]
        months = max((end - start).days / 30.44, 1)
        print(f"  {label:26} {len(span) / months:5.1f} views/month")


if __name__ == "__main__":
    main()
