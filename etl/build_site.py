"""Summarize the cleaned views into data/site.json for the website.

The site ships per-show and per-month summaries, never the raw history.

    .venv/bin/python etl/pipeline.py && .venv/bin/python etl/build_site.py
"""
import json
import re
from collections import Counter
from pathlib import Path

import pandas as pd

from pipeline import CRACKDOWN, MOVED_TO_AUSTIN

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
OUT = ROOT / "data" / "site.json"


def day(ts):
    return ts.strftime("%Y-%m-%d")


def show_summary(df, show):
    s = df[df["show"] == show]
    per_day = s.groupby("date").size()
    seasons = (s.dropna(subset=["season"]).groupby("season").size()
               .sort_index(key=lambda idx: idx.str.extract(r"(\d+)")[0].astype(float).fillna(0)))
    return {
        "show": show,
        "kind": s["kind"].iloc[0],
        "views": int(len(s)),
        "first": day(s["date"].min()),
        "last": day(s["date"].max()),
        "days": int(per_day.size),
        "best_day": {"date": day(per_day.idxmax()), "episodes": int(per_day.max())},
        "binge_days": int((per_day >= 3).sum()),
        "seasons": {k: int(v) for k, v in seasons.items()},
        "by_year": {str(k): int(v) for k, v in s.groupby(s["date"].dt.year).size().items()},
        "eras": {k: int(v) for k, v in s.groupby("era").size().items()},
    }


def gaps(dates):
    s = pd.Series(sorted(dates.unique()))
    g = s.diff().dt.days
    out = []
    for i in g.sort_values(ascending=False).head(5).index:
        out.append({"from": day(s[i - 1]), "to": day(s[i]), "days": int(g[i])})
    return out


def longest_streak(dates):
    days = sorted(dates.unique())
    best, run, end = 1, 1, days[0]
    for a, b in zip(days, days[1:]):
        run = run + 1 if (b - a).days == 1 else 1
        if run > best:
            best, end = run, b
    end = pd.Timestamp(end)
    return {"days": best, "from": day(end - pd.Timedelta(days=best - 1)), "to": day(end)}


# School eras: elementary (new in America, on Dad's profile), middle school, high school, and after graduating in May 2024.
LIFE = [("elementary", "Elementary", "2015-01-01", "2017-07-31"),
        ("middle", "Middle School", "2017-08-01", "2020-07-31"),
        ("high", "High School", "2020-08-01", "2024-05-31"),
        ("after", "After Graduation", "2024-06-01", None)]


# Hindi-language films in my history, tagged by hand. Kept in etl/private/ because the list names titles from my history.
_HINDI = ROOT / "etl" / "private" / "hindi_films.txt"
HINDI_FILMS = {l.strip() for l in _HINDI.read_text().splitlines() if l.strip() and not l.startswith("#")} if _HINDI.exists() else set()


def lifestyle(df):
    """Summers vs school by era, when movies happen, and how often anything is on."""
    eras = [("Middle", "2017-08-01", "2020-07-31"), ("High", "2020-08-01", "2024-05-31"), ("College", "2024-08-15", "2026-09-30")]
    out = {"summers": []}
    for name, a, b in eras:
        s = df[(df["date"] >= a) & (df["date"] <= b)]
        days = pd.Series(pd.date_range(a, b))
        summer_days = days.dt.month.isin([6, 7]).sum()
        school_days = (~days.dt.month.isin([6, 7, 8, 12])).sum()
        per_summer = s["date"].dt.month.isin([6, 7]).sum() / summer_days
        per_school = (~s["date"].dt.month.isin([6, 7, 8, 12])).sum() / school_days
        out["summers"].append({"era": name, "ratio": round(per_summer / per_school, 1)})
    movies = df[df["kind"] == "movie"]
    out["movies_on_breaks"] = round(movies["date"].dt.month.isin([12, 1, 6, 7]).mean() * 100)
    return out


def mood(df, meta, min_eps=15):
    """The mood of what I reached for, month by month: light genres (comedy, family, romance) against dark ones
    (crime, thriller, horror, medical...). It measures what I chose, not how I felt."""
    light = {"Comedy", "Family", "Romance", "Children", "Music", "Food"}
    dark = {"Crime", "Thriller", "Horror", "Mystery", "War", "Medical", "Supernatural"}
    ser = df[df["kind"] == "series"].copy()
    genres = ser["show"].map(lambda x: set((meta.get(x) or {}).get("genres") or []))
    ser["score"] = genres.map(lambda g: (len(g & light) - len(g & dark)) / len(g & (light | dark)) if g & (light | dark) else None)
    ser = ser.dropna(subset=["score"])
    m = ser.groupby(ser["date"].dt.to_period("M")).agg(score=("score", "mean"), n=("score", "size"),
                                                        top=("show", lambda x: x.value_counts().index[0]))
    m = m[m["n"] >= min_eps]
    pick = lambda row, k: {"month": str(k), "show": row["top"], "episodes": int(row["n"])}
    darkest, lightest = m["score"].idxmin(), m["score"].idxmax()
    lightest = m[m["score"] == m["score"].max()]["n"].idxmax()  # ties: the biggest month
    return {"darkest": pick(m.loc[darkest], darkest), "lightest": pick(m.loc[lightest], lightest)}


def comebacks(df, min_gap_years=3, min_after=5):
    """Shows I came back to after years away: a gap of 3+ years, then 5+ episodes."""
    out = []
    for name, g in df[df["kind"] == "series"].groupby("show")["date"]:
        g = g.sort_values().reset_index(drop=True)
        gaps = g.diff().dt.days
        if gaps.max() >= min_gap_years * 365:
            i = gaps.idxmax()
            if len(g) - i >= min_after:
                out.append({"show": name, "years": round(gaps.max() / 365.25, 1), "after": int(len(g) - i)})
    return sorted(out, key=lambda x: -x["years"])


# Hand-coded facts TVmaze doesn't have, for my most-watched series: the lead's age in season 1,
# where the show is set, and whether it's a mother-daughter story.
LEAD_AGE = {"Friends": 25, "The Vampire Diaries": 17, "Grey's Anatomy": 26, "Gilmore Girls": 16, "Gossip Girl": 17, "Jessie": 18,
            "Jane The Virgin": 23, "The Fosters": 16, "Switched at Birth": 16, "Good Luck Charlie": 15, "Lab Rats": 15, "Baby Daddy": 23,
            "Liv and Maddie": 15, "A.N.T. Farm": 11, "Mighty Med": 15, "Stranger Things": 12, "Never Have I Ever": 15, "Bridgerton": 21,
            "13 Reasons Why": 17, "Ginny & Georgia": 15, "Riverdale": 16, "XO, Kitty": 16, "Mismatched": 19}
SETTING = {"Friends": "New York", "Gossip Girl": "New York", "Jessie": "New York", "Baby Daddy": "New York", "Manifest": "New York",
           "The Vampire Diaries": "a small town", "Gilmore Girls": "a small town", "Liv and Maddie": "a small town", "Stranger Things": "a small town",
           "Ginny & Georgia": "a small town", "Riverdale": "a small town", "13 Reasons Why": "a small town", "Bunk'd": "a small town",
           "Grey's Anatomy": "Seattle", "Fuller House": "San Francisco", "A.N.T. Farm": "San Francisco", "Jane The Virgin": "Miami",
           "The Fosters": "San Diego", "Switched at Birth": "Kansas City", "Good Luck Charlie": "Denver", "Lab Rats": "California",
           "Never Have I Ever": "Los Angeles", "The Originals": "New Orleans", "Mighty Med": "Philadelphia", "Bridgerton": "London",
           "Emily in Paris": "Paris", "The Night Agent": "Washington", "Dubai Bling": "Dubai", "The Great Indian Kapil Show": "Mumbai",
           "Fabulous Lives of Bollywood Wives": "Mumbai", "Mismatched": "Jaipur", "XO, Kitty": "Seoul", "Delhi Crime": "Delhi",
           "Workin' Moms": "Toronto", "AMERICA'S SWEETHEARTS": "Dallas"}
MOTHER_DAUGHTER = {"Gilmore Girls", "Jane The Virgin", "Ginny & Georgia", "Never Have I Ever", "Switched at Birth", "The Fosters", "Workin' Moms"}
SCHOOL = [(0, 11, "elementary"), (11, 14, "middle"), (14, 18, "high"), (18, 30, "college")]


def profile(df, meta):
    """The detective file: what the history gives away without being told."""
    per_day = lambda s, a, b: round(len(s[(s["date"] >= a) & (s["date"] <= b)]) / ((pd.Timestamp(b) - pd.Timestamp(a)).days + 1), 2)
    kids = df["show"].map(lambda x: bool(meta.get(x)) and (meta[x].get("type") == "Animation" or "Children" in meta[x].get("genres", [])
                                                         or meta[x].get("network") in ("Disney Channel", "DisneyNOW")))
    kids_by_year = (df.assign(k=kids).groupby(df["date"].dt.year)["k"].mean() * 100).round(1)
    movies = df[df["kind"] == "movie"]
    hindi = movies["show"].isin(HINDI_FILMS)
    dec = df[df["date"].dt.month == 12]
    school = df[~df["date"].dt.month.isin([6, 7])]
    summer = df[df["date"].dt.month.isin([6, 7])]
    ser = df[df["kind"] == "series"]
    romance = ser["show"].map(lambda x: "Romance" in (meta.get(x) or {}).get("genres", [])).mean()
    life = []
    for key, name, start, end in LIFE:
        m = movies[(movies["date"] >= start) & ((movies["date"] <= end) if end else True)]
        life.append({"key": key, "movies": int(len(m)), "hindi": int(m["show"].isin(HINDI_FILMS).sum())})
    masha = df[df["show"] == "Masha and the Bear"]
    jan26 = movies[(movies["date"] >= "2026-01-01") & (movies["date"] <= "2026-01-31")]
    valentines = df[(df["date"].dt.month == 2) & (df["date"].dt.day == 14)]
    # Senior spring: January to graduation, 2024.
    spring = df[(df["date"] >= "2024-01-01") & (df["date"] <= "2024-06-26")]
    # Racing Friends off US Netflix (it left on Jan 1, 2020).
    friends = df[df["show"] == "Friends"]
    # In college: Hindi when I'm away vs home for summer.
    meta_lang = df["show"].map(lambda x: (meta.get(x) or {}).get("language"))
    col = df[(df["date"] >= "2024-08-15") & (df["kind"] == "series")]
    home = col["date"].dt.month.isin([6, 7]) | ((col["date"].dt.month == 8) & (col["date"].dt.day < 15)) | \
        ((col["date"].dt.month == 5) & (col["date"].dt.day > 10))
    hindi_col = meta_lang.loc[col.index] == "Hindi"
    xmas = df[(df["date"].dt.month == 12) & (df["date"].dt.day.between(24, 26))]
    daily = df.groupby("date").size()
    counts_path = BUILD / "episode_counts.json"
    totals = json.loads(counts_path.read_text()) if counts_path.exists() else {}
    finished = [{"show": k, "watched": int((df["show"] == k).sum()), "total": v} for k, v in totals.items()
                if v >= 40 and (df["show"] == k).sum() / v >= .95]
    # What I watch, beyond genre: how old the shows are, whose network they're from, and release-day seasons.
    ser = df[df["kind"] == "series"]
    year_of = lambda x: int(str((meta.get(x) or {}).get("premiered") or "")[:4] or 0) or None
    aged = ser.assign(p=ser["show"].map(year_of)).dropna(subset=["p"])
    older = aged[aged["p"] < 2006]
    nets = ser["show"].map(lambda x: (meta.get(x) or {}).get("network")).value_counts(normalize=True)
    cw = ser[ser["show"].map(lambda x: (meta.get(x) or {}).get("network") == "The CW")]["show"].value_counts()
    release = []
    sd_path = BUILD / "season_dates.json"
    for show, seasons in (json.loads(sd_path.read_text()) if sd_path.exists() else {}).items():
        for n, rel in seasons.items():
            x = ser[(ser["show"] == show) & ser["season"].fillna("").str.fullmatch(rf"(?:Season|Part|Volume) {n}")]
            rel = pd.Timestamp(rel)
            # Netflix keeps each episode's latest date, so only a whole season inside its release week counts.
            if len(x) >= 6 and x["date"].min() >= rel and (x["date"].max() - rel).days <= 3:
                release.append({"show": show, "season": int(n), "month": rel.strftime("%Y-%m"), "days": int((x["date"].max() - rel).days) + 1, "episodes": int(len(x))})
    wd = df["date"].dt.day_name().value_counts(normalize=True)
    born = pd.Timestamp("2006-03-06")
    era_of = lambda a: next(name for lo, hi, name in SCHOOL if lo <= a < hi)
    aged_me = ser.assign(age=(ser["date"] - born).dt.days / 365.25)
    aged_me = aged_me.assign(era=aged_me["age"].map(era_of))
    lead = aged_me[aged_me["show"].isin(LEAD_AGE)]
    lead = lead.assign(gap=lead["show"].map(LEAD_AGE) - lead["age"])
    mom_d = aged_me["show"].isin(MOTHER_DAUGHTER)
    in_college = aged_me["date"] >= MOVED_TO_AUSTIN
    june_july = aged_me["date"].dt.month.isin([6, 7])
    where = ser["show"].map(SETTING).value_counts()
    eras = [e for _, _, e in SCHOOL]
    what_more = {
        "ahead": {"coverage": round(len(lead) / len(ser) * 100), "older_pct": round((lead["gap"] > 0).mean() * 100),
                  "by_era": {e: round(float(lead[lead["era"] == e]["gap"].mean()), 1) for e in eras if (lead["era"] == e).any()},
                  "example": {"show": "The Vampire Diaries", "lead": LEAD_AGE["The Vampire Diaries"],
                              "me": int(lead[lead["show"] == "The Vampire Diaries"]["age"].min())},
                  "college": lead[lead["era"] == "college"]["show"].value_counts().index[:2].tolist()},
        "mothers": {"pct": round(mom_d.mean() * 100, 1), "by_era": {e: round(float(mom_d[aged_me["era"] == e].mean() * 100), 1) for e in eras},
                    "top": aged_me[mom_d]["show"].value_counts().index[:3].tolist(),
                    "away": round(float(mom_d[in_college & ~june_july].mean() * 100), 1), "home": round(float(mom_d[in_college & june_july].mean() * 100), 1)},
        "places": {"coverage": round(ser["show"].map(SETTING).notna().mean() * 100),
                   "top": [{"place": k, "views": int(v)} for k, v in where.head(6).items()],
                   "nyc": ser[ser["show"].map(SETTING) == "New York"]["show"].value_counts().index[:3].tolist(),
                   "town": ser[ser["show"].map(SETTING) == "a small town"]["show"].value_counts().index[:3].tolist()},
    }
    favs = ser["show"].value_counts().head(4).index
    fav_years = [year_of(x) for x in favs if year_of(x)]
    what_more["show_age"] = {"favorites": [{"show": x, "year": year_of(x)} for x in favs], "fav_year": round(sum(fav_years) / len(fav_years)),
                             "median_year": int(aged["p"].median())}
    what = {**what_more, "older_pct": round(len(older) / len(aged) * 100, 1),
            "older": [{"show": k, "year": year_of(k), "views": int(v)} for k, v in older["show"].value_counts().head(3).items()],
            "median_age": int((aged["date"].dt.year - aged["p"]).median()),
            "fresh_pct": round(((aged["date"].dt.year - aged["p"]) <= 1).mean() * 100),
            "netflix_pct": round(nets.get("Netflix", 0) * 100), "cw_pct": round(nets.get("The CW", 0) * 100),
            "cw_top": cw.index[:3].tolist(), "networks": [{"network": k, "pct": round(v * 100)} for k, v in nets.head(5).items()],
            "release": sorted(release, key=lambda r: (r["days"], r["month"])),
            "top_day": wd.index[0], "top_day_pct": round(wd.iloc[0] * 100), "low_day": wd.index[-1], "low_day_pct": round(wd.iloc[-1] * 100)}
    return {
        "what": what,
        "senior_spring": {"views": int(len(spring)), "days": int(spring["date"].nunique()), "months": 6,
                          # The same January–June stretch in every high school year, for comparison.
                          "by_year": {str(y): int(((df["date"] >= f"{y}-01-01") & (df["date"] <= f"{y}-06-26")).sum()) for y in range(2021, 2025)},
                          "summer_after": int(((df["date"] >= "2024-06-27") & (df["date"] <= "2024-08-14")).sum())},
        "friends_race": {"december": int(((friends["date"] >= "2019-12-01") & (friends["date"] <= "2019-12-31")).sum()),
                         "last_week": int(((friends["date"] >= "2019-12-25") & (friends["date"] <= "2019-12-31")).sum()),
                         "watched": int(len(friends)), "total": totals.get("Friends"),
                         "jan1": int((friends["date"] == "2020-01-01").sum()),
                         "nye_last": friends[friends["date"] == "2019-12-31"]["episode"].dropna().iloc[-1] if (friends["date"] == "2019-12-31").any() else None},
        "hindi_away": round(hindi_col[~home].mean() * 100, 1), "hindi_home": round(hindi_col[home].mean() * 100, 1),
        "kapil_away": int((col[~home]["show"] == "The Great Indian Kapil Show").sum()),
        "kapil_home": int((col[home]["show"] == "The Great Indian Kapil Show").sum()),
        "christmas_years": int(xmas["date"].dt.year.nunique()),
        "series_share": round((df["kind"] == "series").mean() * 100, 1),
        "big_days": int((daily >= 10).sum()),
        "finished": sorted(finished, key=lambda x: -x["total"]),
        "lifestyle": lifestyle(df),
        "mood": mood(df, meta),
        # Shows I came back to after years away (20+ episodes, a gap of 3+ years between episodes).
        "comebacks": comebacks(df),
        # Spooky, not scary: horror-tagged series are all teen/kids spooky; real horror films are rare.
        "spooky": [{"show": k, "views": int(v)} for k, v in df[(df["kind"] == "series") & df["show"].map(
            lambda x: "Horror" in ((meta.get(x) or {}).get("genres") or []))]["show"].value_counts().head(5).items()],
        "horror_films": [{"show": r.show, "date": day(r.date)} for r in
                         df[df["show"].isin({"Cult of Chucky", "Killing Ground", "Scream", "Annabelle", "Insidious", "The Conjuring"})].itertuples()],
        "kids_by_year": {str(k): v for k, v in kids_by_year.items()},
        "kids_early_top": df[kids & (df["date"].dt.year <= 2017)]["show"].value_counts().head(3).index.tolist(),
        "first_title": df.sort_values("date")["show"].iloc[0],
        "teen_romcoms": [t for t in ["Sierra Burgess Is a Loser", "The Perfect Date", "F the Prom", "Tall Girl", "The Kissing Booth"]
                         if t in set(movies["show"])],
        "masha": {"first": day(masha["date"].min()), "last": day(masha["date"].max()), "views": int(len(masha))} if len(masha) else None,
        "covid": {"march_2020": int(((df["date"] >= "2020-03-01") & (df["date"] <= "2020-03-31")).sum()),
                  "feb_2020": int(((df["date"] >= "2020-02-01") & (df["date"] <= "2020-02-29")).sum()),
                  "after_closure": int(((df["date"] >= "2020-03-13") & (df["date"] <= "2020-03-31")).sum()),
                  "top": df[(df["date"] >= "2020-03-13") & (df["date"] <= "2020-03-31")]["show"].value_counts().index[0]},
        "december": {"before_20": int((dec["date"].dt.day < 20).sum()), "after_20": int((dec["date"].dt.day >= 20).sum())},
        "weekday_share": {"school": round((school["date"].dt.dayofweek < 5).mean() * 100, 1),
                          "summer": round((summer["date"].dt.dayofweek < 5).mean() * 100, 1)},
        "college": {"fall_2024": per_day(df, "2024-08-26", "2024-12-13"), "summer_2025": per_day(df, "2025-05-10", "2025-08-24"),
                    "fall_2025": per_day(df, "2025-08-25", "2025-12-12"), "winter_2025": per_day(df, "2025-12-13", "2026-01-11")},
        "hindi_films": {"total": int(hindi.sum()), "movies": int(len(movies)), "by_era": life,
                        "first": movies[hindi]["show"].iloc[0], "first_date": day(movies[hindi]["date"].iloc[0])},
        "jan_2026": {"movies": int(len(jan26)), "hindi": int(jan26["show"].isin(HINDI_FILMS).sum())},
        "romance_share": round(romance * 100, 1),
        "valentines": [{"date": day(r.date), "show": r.show} for r in valentines.itertuples()],
    }


FAVORITE_YEARS = {2017: "Little Baby Bum", 2018: "Little Baby Bum", 2019: "Masha and the Bear"}


def amaira(h):
    """My sister's top 10 shows, and the show she watched most each year."""
    a = h[h["who"] == "Sister"]
    top = a["show"].value_counts().head(10)
    years = []
    for y, g in a.groupby(a["date"].dt.year):
        vc = g["show"].value_counts()
        years.append({"year": int(y), "show": vc.index[0], "episodes": int(vc.iloc[0]), "views": int(len(g))})
    # Her real favorites, per Suhani: Netflix can't count rewatches (one date per episode per profile),
    # so her most rewatched shows undercount. Little Baby Bum first, then Masha.
    for y in years:
        if y["year"] in FAVORITE_YEARS:
            show = FAVORITE_YEARS[y["year"]]
            y.update(show=show, episodes=int(((a["show"] == show) & (a["date"].dt.year == y["year"])).sum()), rewatched=True)
    m = a[a["show"] == "Masha and the Bear"]
    masha = {"episodes": int(m["title"].nunique()), "profiles": int(m["profile"].nunique()),
             "per_episode": round(len(m) / m["title"].nunique(), 1)} if len(m) else None
    lbb = a[a["show"] == "Little Baby Bum"]
    bum = {"episodes": int(lbb["title"].nunique()), "profiles": int(lbb["profile"].nunique())} if len(lbb) else None
    # Growing up with Netflix from day one: whose profile raised her.
    share = a["profile"].value_counts(normalize=True)
    return {"views": int(len(a)), "top": [{"show": k, "views": int(v)} for k, v in top.items()], "years": years, "masha": masha, "bum": bum,
            "on_dad": round(float(share.get("Dad", 0)) * 100), "on_own": round(float(share.get("Sister", 0)) * 100), "titles": int(a["show"].nunique())}


# Watched together on Mom's account, so they don't count as her favorites.
FAMILY_TOGETHER = {"The Great Indian Kapil Show", "The Night Agent"}
SRK = ["Om Shanti Om", "Chennai Express", "Dilwale", "Dunki", "Raees", "Kabhi Khushi Kabhie Gham", "Dil To Pagal Hai",
       "Phir Bhi Dil Hai Hindustani", "Deewana", "Anjaam", "Chak De! India", "Dear Zindagi", "Jawan", "Zero"]
SRK_YEARS = {"Om Shanti Om": 2007, "Chennai Express": 2013, "Dilwale": 2015, "Dunki": 2023, "Raees": 2017,
             "Kabhi Khushi Kabhie Gham": 2001, "Dil To Pagal Hai": 1997, "Phir Bhi Dil Hai Hindustani": 2000, "Deewana": 1992,
             "Anjaam": 1994, "Chak De! India": 2007, "Dear Zindagi": 2016, "Jawan": 2023, "Zero": 2018}


DIWALI = {2015: "11-11", 2016: "10-30", 2017: "10-19", 2018: "11-07", 2019: "10-27", 2020: "11-14", 2021: "11-04",
          2022: "10-24", 2023: "11-12", 2024: "11-01", 2025: "10-20"}


def special_days(d):
    """What one person watched on the days that matter (Valentine's Day stays private)."""
    def nth(y, m, wd, k):
        x = pd.Timestamp(y, m, 1)
        return x + pd.Timedelta(days=(wd - x.dayofweek) % 7) + pd.Timedelta(weeks=k - 1)
    days = {}
    for y in range(2015, 2027):
        days.update({pd.Timestamp(y, 4, 26): "His birthday", nth(y, 5, 6, 2): "Mother's Day", nth(y, 6, 6, 3): "Father's Day",
                     pd.Timestamp(y, 12, 24): "Christmas Eve", pd.Timestamp(y, 12, 25): "Christmas", pd.Timestamp(y, 1, 1): "New Year's Day",
                     pd.Timestamp(y, 12, 31): "New Year's Eve", nth(y, 11, 3, 4): "Thanksgiving", pd.Timestamp(y, 10, 31): "Halloween"})
        if y >= 2016:
            days[pd.Timestamp(y, 11, 13)] = "My sister's birthday"
        if y in DIWALI:
            days[pd.Timestamp(f"{y}-{DIWALI[y]}")] = "Diwali"
    x = d[d["date"].isin(days) & ~d["show"].isin({"Swan Princess", "The Chronicles of Narnia", "Supergirl"})]  # kids' picks, not his
    out = []
    for (day, show), g in x.groupby([x["date"].map(days), "show"]):
        out.append({"day": day, "year": int(g["date"].dt.year.min()), "show": show, "views": int(len(g))})
    order = list(dict.fromkeys(days.values()))
    return sorted(out, key=lambda r: (order.index(r["day"]), r["year"]))


# Dad's impeccable timing, written up: what the title is, what day it was, and the irony. Every pick is checked
# against his history in special_days(); the notes are mine.
DAD_TIMING = [
    ("His birthday", 2018, "24 Hours to Live", "An action movie about a hitman brought back from the dead with one day left to live.",
     "April 26: Papa's birthday.", "Another year older, and he picks a man with 24 hours left."),
    ("The week my sister was born", 2016, "Roman Empire", "A docudrama about Commodus, the emperor's son who was raised to rule Rome.",
     "November 20, 2016: my sister was one week old.", "The episode was called \"Born in the Purple.\" New baby, new heir."),
    ("Mother's Day", 2017, "Peaky Blinders", "A Birmingham gangster family in the 1920s, run by brothers with razor blades in their caps.",
     "Mother's Day.", "Three episodes. The closest thing to a mom on screen was Aunt Polly, who runs the gang's money."),
    ("Mother's Day", 2018, "City of God", "Two boys grow up in a Rio favela as gang wars take over their neighborhood.",
     "Mother's Day.", "Happy Mother's Day, from the drug wars of Rio."),
    ("Mother's Day", 2023, "The Mother", "Jennifer Lopez as an assassin who comes out of hiding to protect the daughter she gave up.",
     "Mother's Day.", "Technically on theme."),
    ("Father's Day", 2018, "Money Heist", "A crew in red jumpsuits and Dalí masks takes over Spain's Royal Mint.",
     "Father's Day.", "He treated himself to six episodes of a heist."),
    ("Father's Day", 2024, "Hit Man", "A mild-mannered professor goes undercover as a fake hitman for the police.",
     "Father's Day.", "A dad who secretly moonlights as a hitman. Relatable?"),
    ("Christmas Eve", 2017, "72 Dangerous Animals", "A countdown of Latin America's deadliest animals.",
     "Christmas Eve.", "The episode was \"Deathly Bite.\" Silent night."),
    ("Christmas", 2018, "Watership Down", "An animated series about rabbits fleeing the destruction of their warren. Not many make it.",
     "Christmas Day. He watched all four episodes, plus four of a Montreal mafia show.", "Bunnies for Christmas. Doomed bunnies."),
    ("Christmas", 2024, "Escape at Dannemora", "The true story of two inmates who broke out of a New York prison with help from a worker inside.",
     "Christmas Day.", "Home for the holidays: a prison break."),
    ("Thanksgiving", 2015, "Apocalypse", "World War II in restored color, from the invasion of Poland to the bomb.",
     "Thanksgiving.", "Episodes \"The World Ablaze\" and \"Inferno.\" Pass the turkey."),
    ("Thanksgiving", 2023, "MADOFF", "The story of Bernie Madoff's $65 billion Ponzi scheme.",
     "Thanksgiving.", "The episode was \"A Liar, Not a Failure.\" Grateful? His investors weren't."),
    ("Halloween", 2025, "Mob War", "How Philadelphia's mafia tore itself apart in the 1980s.",
     "Halloween.", "The episode was \"Kill, Kill, Kill.\" Scarier than any costume."),
    ("Diwali", 2016, "The Borgias", "Renaissance Rome's most notorious family, poisoning its way through the Vatican.",
     "Diwali, the festival of lights.", "Seven episodes, including \"The Poisoned Chalice.\" Happy Diwali."),
    ("My sister's birthday", 2017, "Inglourious Basterds", "Tarantino's World War II revenge fantasy.",
     "November 13: my sister turned one.", "Party energy."),
    ("My sister's birthday", 2021, "Narcos", "Narcos: Mexico, the rise of the Guadalajara cartel.",
     "November 13: my sister turned five.", "Four episodes of cartels. Cake, anyone?"),
]


def dad_timing(h):
    d = h[h["who"] == "Dad"]
    out = []
    for day, year, show, about, when, irony in DAD_TIMING:
        hit = d[(d["show"] == show) & (d["date"].dt.year == year)]
        if len(hit):  # only keep picks the data still backs up
            out.append({"day": day, "year": year, "show": show, "about": about, "when": when, "irony": irony})
    return out


def parents(h, meta):
    """What Dad's and Mom's profiles show (approved by Suhani): top 10, each year, top genre, and how fast they finish."""
    def genres(d):
        c = Counter()
        for show, n in d["show"].value_counts().items():
            for g in (meta.get(show) or {}).get("genres", []):
                c[g] += int(n)
        return [{"genre": g, "pct": round(n / len(d) * 100)} for g, n in c.most_common(3)]
    def fast(d):
        d = d[d["kind"] == "series"].assign(season=d["title"].str.extract(r"(Season \d+|Series \d+|Volume \d+)")[0].fillna("S1"))
        g = d.groupby(["show", "season"])["date"].agg(["size", lambda s: (s.max() - s.min()).days + 1])
        g = g[g["size"] >= 4]
        return round(float((g.iloc[:, 1] <= 3).mean()) * 100) if len(g) else None
    dad = h[h["who"] == "Dad"]
    dad_years = []
    for y, g in dad.groupby(dad["date"].dt.year):
        vc = g["show"].value_counts()
        dad_years.append({"year": int(y), "show": vc.index[0], "episodes": int(vc.iloc[0])})
    mom = h[(h["who"] == "Mom") & ~h["show"].isin(FAMILY_TOGETHER)]
    mser, mmov = mom[mom["kind"] == "series"], mom[mom["kind"] == "movie"]
    mom_years = []
    for y, g in mom.groupby(mom["date"].dt.year):
        sv = g[g["kind"] == "series"]["show"].value_counts()
        mom_years.append({"year": int(y), "movies": int((g["kind"] == "movie").sum()),
                          "titles": g["show"].value_counts().index[:12].tolist(),
                          "show": sv.index[0] if len(sv) and sv.iloc[0] >= 5 else None, "episodes": int(sv.iloc[0]) if len(sv) else 0})
    # "Who he is / who she is": what each parent's history gives away, beyond their favorites.
    def who(d):
        ser = d[d["kind"] == "series"]
        docs = ser[ser["show"].map(lambda x: (meta.get(x) or {}).get("type") == "Documentary")]
        hist = docs[docs["show"].map(lambda x: "History" in (meta.get(x) or {}).get("genres", []) or "War" in (meta.get(x) or {}).get("genres", []))]
        wd = d["date"].dt.day_name().value_counts(normalize=True)
        year_of = lambda x: int(str((meta.get(x) or {}).get("premiered") or "")[:4] or 0) or None
        fresh = ser.assign(p=ser["show"].map(year_of)).dropna(subset=["p"])
        prem = fresh["p"].astype(int)
        return {"docs": int(len(docs)), "history_docs": hist["show"].value_counts().index[:4].tolist(),
                "top_day": wd.index[0], "top_day_pct": round(wd.iloc[0] * 100), "low_day": wd.index[-1], "low_day_pct": round(wd.iloc[-1] * 100),
                "median_premiere": int(prem.median()) if len(prem) else None,
                "fresh_pct": round(((fresh["date"].dt.year - fresh["p"].astype(int)) <= 1).mean() * 100) if len(fresh) else None,
                "by_year": {str(k): int(v) for k, v in d.groupby(d["date"].dt.year).size().items()}}
    return {
        "Dad": {"who": who(dad), "top": [{"show": k, "views": int(v)} for k, v in dad["show"].value_counts().head(10).items()],
                "years": dad_years, "genres": genres(dad), "fast": fast(dad), "special": special_days(dad), "timing": dad_timing(h)},
        "Mom": {"top": [{"show": k, "views": int(v)} for k, v in mser["show"].value_counts().head(10).items()],
                "years": [y for y in mom_years if y["movies"] or y["show"]], "genres": genres(mser), "fast": fast(mom),
                "movies": int(mmov["show"].nunique()), "movie_pct": round(len(mmov) / len(mom) * 100),
                "srk": [t for t in SRK if t in set(mom["show"])],
                "srk_years": {t: SRK_YEARS[t] for t in SRK if t in set(mom["show"])}, "who": who(mom)},
    }


day_str = lambda ts: ts.strftime("%Y-%m-%d")


def arrival(h):
    """November 13, 2016: my sister comes home. Weekly watching before and after, by person."""
    born = pd.Timestamp("2016-11-13")
    def weekly(w, lo, hi):
        d = h[(h["who"] == w) & (h["date"] >= born + pd.Timedelta(days=lo)) & (h["date"] <= born + pd.Timedelta(days=hi))]
        return round(len(d) / ((hi - lo + 1) / 7), 1)
    me = h[(h["who"] == "Suhani") & (h["date"] >= born) & (h["date"] <= born + pd.Timedelta(days=60))]
    glc = h[(h["who"] == "Suhani") & (h["show"] == "Good Luck Charlie") & (h["date"] >= born) & (h["date"] <= born + pd.Timedelta(days=180))]
    return {"me_before": weekly("Suhani", -60, -1), "me_after": weekly("Suhani", 14, 60),
            "dad_before": weekly("Dad", -60, -1), "dad_after": weekly("Dad", 14, 60),
            "mom_after": weekly("Mom", 0, 180), "top_after": me["show"].value_counts().index[0],
            "glc_6mo": int(len(glc)), "glc_6wk": int(((glc["date"] >= born + pd.Timedelta(days=14)) & (glc["date"] <= born + pd.Timedelta(days=60))).sum())}


def detective(h):
    """What the four files give away with no names: who owned which profile, read from the data alone."""
    dad_file = h[h["profile"] == "Dad"]
    by_year = dad_file.groupby(dad_file["date"].dt.year).size()
    mom_file = h[h["profile"] == "Mom"]
    hindi = mom_file["show"].map(lambda x: x in HINDI_FILMS)
    day = mom_file.assign(hi=hindi).groupby(mom_file["date"].dt.normalize())["hi"].agg(["any", "all"])
    freeze = h[(h["date"] >= "2021-02-14") & (h["date"] <= "2021-02-20")]
    week_after = h[(h["date"] >= "2021-02-21") & (h["date"] <= "2021-02-27")]
    share = h.groupby(["profile", "who"]).size().unstack(fill_value=0)
    pct = lambda prof, who: round(share.loc[prof, who] / share.loc[prof].sum() * 100) if prof in share.index and who in share.columns else 0
    return {"kids_file": {str(k): int(v) for k, v in by_year.items()},
            "my_profile_from": day_str(h[h["profile"] == "Suhani"]["date"].min()),
            "sister_profile_from": day_str(h[h["profile"] == "Sister"]["date"].min()),
            "freeze": int(len(freeze)), "week_after": int(len(week_after)),
            "dad_file_daughters": pct("Dad", "Suhani") + pct("Dad", "Sister"), "dad_file_dad": pct("Dad", "Dad"),
            "mom_file_dad": pct("Mom", "Dad"), "mom_file_mom": pct("Mom", "Mom")}


def family(meta):
    """Family comparisons Suhani's family agreed to share: aggregates only, Mom and Dad unnamed, my sister
    unnamed, and no dates."""
    path = BUILD / "household.csv"
    if not path.exists():
        return None
    h = pd.read_csv(path, parse_dates=["date"])
    h = h[h["show"].notna()]
    label = {"Suhani": "Me", "Mom": "Mom", "Dad": "Dad", "Sister": "My sister"}
    ser = h[h["kind"] == "series"]
    quitters = {label[w]: int((ser[ser["who"] == w]["show"].value_counts() == 1).sum()) for w in label}
    started = {label[w]: int(ser[ser["who"] == w]["show"].nunique()) for w in label}
    quit_rate = {w: round(quitters[w] / started[w] * 100) for w in quitters if started[w]}
    kapil = h[h["show"] == "The Great Indian Kapil Show"]
    same_day = kapil.groupby("date")["who"].nunique()
    birthdays = h[(h["who"] == "Dad") & (h["date"] >= "2016-11-13") & (h["date"].dt.month == 11) &
                  (h["date"].dt.day == 13)]["show"].unique().tolist()
    # Who watched shared titles first, pair by pair (counts only).
    def lead(a, b):
        f = h[h["who"].isin([a, b])].groupby(["show", "who"])["date"].min().unstack().dropna()
        gap = (f[b] - f[a]).dt.days
        return {"shared": int(len(f)), "first": int((gap > 0).sum()), "second": int((gap < 0).sum()),
                "within_week": int(((gap > 0) & (gap <= 7)).sum())}
    hindi = lambda x: (meta.get(x) or {}).get("language") == "Hindi" or x in HINDI_FILMS
    hh = h[h["show"].map(hindi)]
    f = hh[hh["who"].isin(["Mom", "Suhani"])].groupby(["show", "who"])["date"].min().unstack().dropna()
    g = (f["Suhani"] - f["Mom"]).dt.days
    freeze = h[(h["date"] >= "2021-02-14") & (h["date"] <= "2021-02-20")]
    def nth_sunday(y, m, n):
        d = pd.Timestamp(y, m, 1)
        return d + pd.Timedelta(days=(6 - d.dayofweek) % 7) + pd.Timedelta(weeks=n - 1)
    mothers_days = {nth_sunday(y, 5, 2) for y in range(2015, 2027)}
    dad_md = h[(h["who"] == "Dad") & h["date"].isin(mothers_days)]
    fam_word = r"\b(?:Mom|Mother|Mummy|Mumma|Maa|Mai|Dad|Daddy|Papa|Father|Baap|Pitaah|Nani|Daadi|Dadi|Grandson)\b"
    titles_of = lambda w: sorted(set(h[(h["who"] == w) & h["show"].str.contains(fam_word, regex=True)]["show"]))
    # A peek at each profile: top shows and how often they rewatch (same full title on two profiles).
    def peek(w):
        d = h[h["who"] == w]
        reps = d[d["episode"].notna()].groupby("title").size()
        return {"top": [{"show": k, "views": int(v)} for k, v in d["show"].value_counts().head(3).items()],
                "views": int(len(d)), "rewatched": int((reps > 1).sum()), "rewatch_pct": round((reps > 1).sum() / max(len(d), 1) * 100, 1)}
    def habits(w):
        d = h[h["who"] == w]
        per = d.groupby(d["date"].dt.normalize()).size()
        n = d[d["kind"] == "series"].groupby("show").size()
        return {"binge_days": int((per >= 6).sum()), "eps_per_show": round(float(n.mean()), 1), "titles": int(d["show"].nunique()),
                "movie_pct": round((d["kind"] == "movie").mean() * 100), "top5_pct": round(d["show"].value_counts().head(5).sum() / len(d) * 100),
                "per_day": round(float(per.mean()), 1), "month": int(d["date"].dt.month.value_counts().idxmax()),
                "hindi_pct": round(d["show"].map(lambda x: hindi(x)).mean() * 100),
                "netflix_pct": round(float((d[d["kind"] == "series"]["show"].map(lambda x: (meta.get(x) or {}).get("network")).dropna() == "Netflix").mean() * 100))}
    return {
        "habits": {label[w]: habits(w) for w in label},
        "profiles": {label[w]: peek(w) for w in label},
        "parents": parents(h, meta),
        "arrival": arrival(h),
        "detective": detective(h),
        # Copy cat: every title my sister and I share, with when I found it and when she did.
        "copy_cat": [{"show": k, "me": int(r["Suhani"].year), "her": int(r["Sister"].year), "years": round((r["Sister"] - r["Suhani"]).days / 365.25, 1)}
                     for k, r in h[h["who"].isin(["Suhani", "Sister"])].groupby(["show", "who"])["date"].min().unstack().dropna()
                     .assign(g=lambda f: f["Sister"] - f["Suhani"]).sort_values("g", ascending=False).iterrows()],
        # Amaira's own section (her family said yes): her 10 favorites and her #1 show each year.
        "amaira": amaira(h),
        "freeze": {"family": int(len(freeze)), "mine": sorted(set(freeze[freeze["who"] == "Suhani"]["show"]))},
        "dad_holidays": {
            "christmas": sorted(set(h[(h["who"] == "Dad") & (h["date"].dt.month == 12) & (h["date"].dt.day == 25)]["show"])),
            "fathers_day": [{"show": k, "views": int(v)} for k, v in h[(h["who"] == "Dad") & h["date"].isin(
                {nth_sunday(y, 6, 3) for y in range(2015, 2027)})]["show"].value_counts().head(3).items()],
        },
        "dad_on_mothers_day": [{"show": r.show, "year": int(r.date.year)} for r in dad_md.drop_duplicates("show").itertuples()],
        "mom_parent_titles": titles_of("Mom"), "dad_parent_titles": titles_of("Dad"),
        "mom_first_titles": [t for t in g[g > 0].sort_values().index.tolist()][:10],
        "mom_hindi_lead": {"shared": int(len(f)), "mom_first": int((g > 0).sum()), "me_first": int((g < 0).sum()),
                           "next_week": int(((g > 0) & (g <= 7)).sum())},
        "me_to_sister": lead("Suhani", "Sister"),
        "dad_and_me": lead("Dad", "Suhani"),
        "pilot_quitters": dict(sorted(quitters.items(), key=lambda x: -x[1])),
        "shows_started": started,
        "quit_rate": dict(sorted(quit_rate.items(), key=lambda x: -x[1])),
        "kapil": {label[w]: int(n) for w, n in kapil["who"].value_counts().items()},
        "kapil_same_day": int((same_day > 1).sum()),
        "dad_sister_birthday_picks": birthdays,
    }


def life_eras(df, meta):
    """How my taste changed: language, type, genre, how new the shows were, how much I explored."""
    out = []
    for key, name, start, end in LIFE:
        s = df[(df["date"] >= start) & ((df["date"] <= end) if end else True)]
        months = max((s["date"].max() - s["date"].min()).days / 30.44, 1)
        ser = s[s["kind"] == "series"]
        info = ser["show"].map(lambda x: meta.get(x) or {})
        share = lambda counter: {k: round(v / len(ser) * 100, 1) for k, v in counter.most_common() if k}
        premiered = pd.to_numeric(info.map(lambda x: x.get("premiered")), errors="coerce")
        top = s["show"].value_counts().head(8)
        out.append({
            "key": key, "name": name, "from": day(s["date"].min()), "to": day(s["date"].max()),
            "views": int(len(s)), "per_month": round(len(s) / months, 1),
            "titles": int(s["show"].nunique()), "titles_per_month": round(s["show"].nunique() / months, 1),
            "movie_share": round((s["kind"] == "movie").mean() * 100, 1),
            "language": share(Counter(x.get("language") for x in info)),
            "type": share(Counter(x.get("type") for x in info)),
            "genres": share(Counter(g for x in info for g in x.get("genres", []))),
            "netflix_share": round((info.map(lambda x: x.get("network")) == "Netflix").mean() * 100, 1),
            "median_premiere": int(premiered.median()),
            "classic_share": round((premiered < 2006).mean() * 100, 1),
            "fresh_share": round(((ser["date"].dt.year - premiered) <= 2).mean() * 100, 1),
            "top": [{"show": k, "views": int(v)} for k, v in top.items()],
            # The shows behind each number, so the site can show them instead of describing them.
            "examples": {
                "hindi": examples(ser, info, lambda x: x.get("language") == "Hindi"),
                "family": examples(ser, info, lambda x: "Family" in x.get("genres", [])),
                "drama": examples(ser, info, lambda x: "Drama" in x.get("genres", [])),
                "medical_crime": examples(ser, info, lambda x: {"Medical", "Crime"} & set(x.get("genres", []))),
                "talk": examples(ser, info, lambda x: x.get("type") == "Talk Show"),
                "romance": examples(ser, info, lambda x: "Romance" in x.get("genres", [])),
            },
            "by_premiere": [{"show": k, "year": int(v)} for k, v in
                            ser.assign(p=premiered).dropna(subset=["p"]).groupby("show")["p"].first()
                            .loc[lambda x: x.index.isin(top.index)].sort_values().items()][:6],
            "movies": int((s["kind"] == "movie").sum()),
            "series_views": int(len(ser)),
        })
    return out


def examples(ser, info, test, k=4):
    hits = ser[info.map(lambda x: bool(test(x)))]
    return [{"show": name, "views": int(v)} for name, v in hits["show"].value_counts().head(k).items()]

# Show naming formulas don't count as my words: Liv and Maddie's -A-Rooney, Friends' "The One With", Jane's chapters.
FORMULAS = [r"-A-Rooney", r"^The (One|Last One)\b.*", r"\bChapter\b.*", r"\bEpisode \d+", r"Masters of Spinjitzu", r"\bwith Boys\b",
            r"\bPart \d+|\bPt\. ?\d", r"^Specials:", r"Trust No One:"]
BEGIN = r"\b(pilot|first|beginning|begins?|start|new|welcome|hello)\b"
END = r"\b(last|end|ending|goodbye|bye|farewell|finale|final|leaving)\b"


# Last episodes, to see what I did after the goodbye.
FINALES = {"Good Luck Charlie": "Goodbye Charlie: Pt. 2", "Jessie": "Jessie's Big Break", "Jane The Virgin": "Chapter One Hundred",
           "Baby Daddy": "Daddy's Girl", "Friends": "The Last One", "Fuller House": "Our Very Last Show, Again", "Gilmore Girls": "Bon Voyage"}


def loyalty(df):
    """Picky about pilots, then I never leave: rewatches and episodes after the finale."""
    ep = df[df["episode"].notna()]
    # Same full title on two profiles; "Episode 1" alone repeats across seasons.
    twice = ep[ep.duplicated("title", keep=False)].drop_duplicates("title")
    after = []
    for show, last in FINALES.items():
        s = ep[ep["show"] == show]
        fin = s[s["episode"].str.contains(last, regex=False)]
        if len(fin):
            n = int((s["date"] > fin["date"].max()).sum())
            if n:
                after.append({"show": show, "after": n, "finale": day(fin["date"].max())})
    words = ep.drop_duplicates(["show", "episode"]).assign(era=pd.cut(ep["date"], pd.to_datetime([l[2] for l in LIFE] + ["2100-01-01"]),
                                                                       labels=[l[1] for l in LIFE], right=False))
    me = words.groupby("era", observed=False)["episode"].apply(
        lambda t: round(t.str.contains(r"(?i)^(?:i|i'm|i'll|i've)\b|\b(?:me|my|myself)\b").mean() * 100, 1))
    mv = df[df["kind"] == "movie"]
    again = mv[mv.duplicated("title", keep=False)]["title"].unique().tolist()
    return {"movies_twice": [t for t in ["13 Going on 30", "Anyone But You", "The Kissing Booth", "To All the Boys I’ve Loved Before", "Set It Up", "Wedding Season"] if t in again],
            "rewatched": int(len(twice)), "rewatch_top": twice["show"].value_counts().head(2).to_dict(),
            "after_finale": sorted(after, key=lambda x: -x["after"]), "me_titles": me.to_dict()}


def picky(df, meta):
    """The shows I quit after one episode vs the ones I stayed with (10+), English scripted only."""
    ser = df[df["kind"] == "series"]
    n = ser.groupby("show").size()
    info = lambda x: meta.get(x) or {}
    scripted = lambda x: info(x).get("type") == "Scripted" and info(x).get("language") == "English"
    quit, kept = [x for x in n[n == 1].index if scripted(x)], [x for x in n[n >= 10].index if scripted(x)]
    share = lambda xs, f: round(sum(map(f, xs)) / len(xs) * 100)
    netflix = lambda x: info(x).get("network") == "Netflix"
    romance = lambda x: "Romance" in info(x).get("genres", [])
    korean = [x for x in n.index if info(x).get("language") == "Korean" and info(x).get("type") == "Scripted"]
    return {"quit": len(quit), "kept": len(kept),
            "netflix_quit": share(quit, netflix), "netflix_kept": share(kept, netflix),
            "romance_quit": share(quit, romance), "romance_kept": share(kept, romance),
            "network_kept": [x for x in ["The Vampire Diaries", "Gossip Girl", "Jane The Virgin", "Switched at Birth", "The Fosters", "Baby Daddy"] if x in kept],
            "dark_quits": [x for x in ["Outer Banks", "You"] if x in quit],
            "korean_tried": len(korean), "korean_kept": int(sum(n[k] >= 10 for k in korean)),
            "dating_quit": [x for x in ["Love Is Blind", "Pop the Balloon LIVE"] if n.get(x, 0) == 1],
            "matchmaking": int(n.get("Indian Matchmaking", 0)),
            "drama_views": int(sum(c for x, c in df.groupby("show").size().items() if "Drama" in info(x).get("genres", []))),
            "views": int(len(df)),
            "korean_quit": [x for x in ["Crash Landing on You", "Hometown Cha-Cha-Cha", "When Life Gives You Tangerines"] if n.get(x, 0) == 1]}


def favorites(df):
    """Guessing my favorite characters from which episodes I went back to."""
    gg = df[df["show"] == "Gossip Girl"]
    fr = df[df["show"] == "Friends"]
    twice = gg[gg.duplicated("episode", keep=False)].drop_duplicates("episode")
    return {"gg_early": gg[gg["date"] < "2021-01-01"].sort_values("date")["episode"].tolist(),
            "gg_twice": [e for e in ["Victor, Victrola", "Seventeen Candles"] if e in set(twice["episode"])],
            "gg_first_back": gg[gg["date"] >= "2025-01-01"].sort_values("date")["episode"].drop_duplicates().head(3).tolist(),
            "rachel_titles": int(fr["episode"].str.contains("Rachel", na=False).sum()),
            "ross_titles": int(fr["episode"].str.contains("Ross", na=False).sum())}


def longest_show_run(df):
    """The most consecutive days I watched one show."""
    best = {"days": 0}
    for show, g in df[df["kind"] == "series"].groupby("show"):
        days = sorted(g["date"].dt.normalize().unique())
        start = prev = days[0]
        for d in days[1:] + [None]:
            if d is not None and (d - prev).days == 1:
                prev = d
                continue
            run = (prev - start).days + 1
            if run > best["days"]:
                eps = int(((g["date"] >= start) & (g["date"] <= prev)).sum())
                best = {"days": run, "show": show, "from": day(start), "to": day(prev), "episodes": eps}
            if d is not None:
                start = prev = d
    return best


def friends_origin(df):
    """From a three-episode sample at 11 to racing the Jan 1, 2020 deadline at 13."""
    f = df[df["show"] == "Friends"].sort_values("date")
    run = f[(f["date"] >= "2019-11-01") & (f["date"] <= "2020-01-01")]
    start = run["date"].min()
    born = pd.Timestamp("2006-03-06")
    age = lambda d: int((d - born).days // 365.25)
    return {"sample": day(f["date"].min()), "sample_eps": int((f["date"] == f["date"].min()).sum()), "sample_age": age(f["date"].min()),
            "start": day(start), "start_ep": run.iloc[0]["episode"], "age": age(start),
            "before_thanksgiving": int((run["date"] < "2019-11-28").sum()), "thanksgiving": int((run["date"] == "2019-11-28").sum()),
            "thanksgiving_weekend": int(((run["date"] >= "2019-11-28") & (run["date"] <= "2019-12-01")).sum()),
            "days": int((pd.Timestamp("2020-01-01") - start).days) + 1, "episodes": int(len(run))}


def big_december(df):
    """December against every other month."""
    by_month = df.groupby(df["date"].dt.month).size()
    dec = df[df["date"].dt.month == 12]
    top_days = df.groupby(df["date"].dt.normalize()).size().nlargest(20)
    years = dec.groupby(dec["date"].dt.year)
    big = [{"year": int(y), "views": int(len(g)), "show": g["show"].value_counts().index[0]} for y, g in years]
    return {"views": int(by_month[12]), "share": round(by_month[12] / len(df) * 100, 1),
            "quietest": {"month": int(by_month.idxmin()), "views": int(by_month.min())},
            "top_days": int(sum(d.month == 12 for d in top_days.index)),
            "years": sorted(big, key=lambda x: -x["views"])[:3]}


DISNEY = {"Jessie", "Good Luck Charlie", "Liv and Maddie", "Lab Rats", "Mighty Med", "Bunk'd", "A.N.T. Farm", "Austin & Ally", "Girl Meets World"}


def genre_pie(df, meta):
    """One genre per show, so the slices add up to 100% of my series episodes."""
    def cat(show):
        d = meta.get(show) or {}
        g, t = set(d.get("genres", [])), d.get("type")
        if show in DISNEY or t == "Animation" or "Children" in g or d.get("network") in ("Disney Channel", "DisneyNOW", "Disney XD", "Nickelodeon"):
            return "Kids & Disney"
        if t in ("Reality", "Talk Show", "Variety", "Game Show", "Documentary"):
            return "Reality & talk"
        for name, tags in [("Supernatural", {"Supernatural", "Fantasy", "Science-Fiction", "Horror"}), ("Medical", {"Medical"}),
                           ("Romance", {"Romance"}), ("Crime & thriller", {"Crime", "Thriller", "Mystery", "Espionage", "Legal"}),
                           ("Comedy", {"Comedy"}), ("Drama", {"Drama", "Family"})]:
            if g & tags:
                return name
        return "Other"
    ser = df[df["kind"] == "series"]
    counts = ser["show"].value_counts()
    by = {}
    for show, n in counts.items():
        k = cat(show)
        by.setdefault(k, {"genre": k, "views": 0, "shows": []})
        by[k]["views"] += int(n)
        by[k]["shows"].append(show)
    total = sum(x["views"] for x in by.values())
    out = sorted(by.values(), key=lambda x: -x["views"])
    for x in out:
        x["pct"] = round(x["views"] / total * 100, 1)
        x["shows"] = x["shows"][:3]
    return out


def dark_years(df, meta):
    """Crime, thriller, horror and mystery, by year. Jane the Virgin is tagged Crime but it's a telenovela."""
    dark = {"Crime", "Thriller", "Horror", "Mystery"}
    is_dark = df["show"].map(lambda x: x != "Jane The Virgin" and bool(set((meta.get(x) or {}).get("genres", [])) & dark))
    by_year = (is_dark.groupby(df["date"].dt.year).mean() * 100).round().astype(int)
    window = df[is_dark & (df["date"] >= "2020-01-01") & (df["date"] <= "2021-12-31")]
    hindi = df[is_dark & df["show"].map(lambda x: (meta.get(x) or {}).get("language") == "Hindi")]["show"].value_counts()
    return {"by_year": {str(k): int(v) for k, v in by_year.items()},
            "hindi": [{"show": k, "views": int(v)} for k, v in hindi[hindi > 1].head(4).items()],
            "shows": [{"show": k, "views": int(v)} for k, v in window["show"].value_counts().head(4).items()]}


def front_row(df, meta):
    """Late to season 1, then there the week a new season drops; and how far one, two or three episodes get a show."""
    path = BUILD / "season_dates.json"
    lags = []
    if path.exists():
        for show, seasons in json.loads(path.read_text()).items():
            w = df[df["show"] == show]
            season = w["title"].str.extract(r"Season (\d+)")[0]
            for sn, g in w.groupby(season):
                if sn in seasons:
                    lags.append({"show": show, "season": int(sn), "lag": int((g["date"].min() - pd.Timestamp(seasons[sn])).days)})
    first = [x["lag"] for x in lags if x["season"] == 1]
    later = [x["lag"] for x in lags if x["season"] > 1]
    ser = df[(df["kind"] == "series") & df["show"].map(lambda x: (meta.get(x) or {}).get("type") == "Scripted")]
    n = ser.groupby("show").size()
    stay = {str(k): round(float((n[n >= k] >= 10).mean()) * 100) for k in (1, 2, 3, 5)}
    late = sorted([x for x in lags if x["season"] == 1], key=lambda x: -x["lag"])[:3]
    quick = sorted([x for x in lags if x["lag"] <= 3], key=lambda x: x["lag"])
    return {"s1_median": int(pd.Series(first).median()) if first else None, "later_median": int(pd.Series(later).median()) if later else None,
            "within_3": len(quick), "same_day": [x for x in quick if x["lag"] == 0], "late": late, "stay": stay,
            "tried": int(len(n)), "past_pilot": round(float((n >= 2).mean()) * 100)}


def title_words(df):
    """Patterns in the words of what I watch, not in how much."""
    ep = df[(df["kind"] == "series") & df["episode"].notna()].drop_duplicates(["show", "episode"])
    ep = ep[~ep["show"].isin(["The Great Indian Kapil Show", "Jane The Virgin", "Stranger Things"])]
    clean = ep["episode"].map(lambda t: re.sub("|".join(FORMULAS), " ", t, flags=re.I))
    has = lambda rx: clean.str.contains(rx.replace("(", "(?:"), case=False, regex=True)
    b, e = has(BEGIN), has(END)
    names = sorted(df["show"].dropna().unique())
    named = lambda rx: [t for t in names if re.search(rx, t, re.I)]
    girl, boy = named(r"\bgirls?\b"), named(r"\bboys?\b")
    love, pyaar = named(r"\blove\b"), named(r"\b(pyaar|pyar|dil|ishq|dulhania)\b")
    return {
        "episodes": int(len(ep)), "shows": int(ep["show"].nunique()),
        "beginnings": int(b.sum()), "endings": int(e.sum()),
        "begin_examples": [t for t in ep.loc[b, "episode"] if t != "Pilot"][:3], "pilots": int((ep["episode"] == "Pilot").sum()),
        "girl": girl, "boy": boy,
        "girl_shows": int(ep.loc[has(r"\bgirls?\b"), "show"].nunique()), "boy_shows": int(ep.loc[has(r"\bboys?\b"), "show"].nunique()),
        "love": love, "hindi_love": pyaar,
        "love_eps": int(has(r"\blove").sum()), "love_shows": int(ep.loc[has(r"\blove"), "show"].nunique()), "hate_eps": int(has(r"\bhate").sum()),
    }


def main():
    df = pd.read_csv(BUILD / "views.csv", parse_dates=["date"])
    # Silences and streaks come from every day I watched anything, so hidden titles can't fake a gap.
    active_path = BUILD / "active_days.csv"
    active = pd.read_csv(active_path, parse_dates=["date"])["date"] if active_path.exists() else df["date"]
    binges = pd.read_csv(BUILD / "binges.csv", parse_dates=["date"])
    titles = df.drop_duplicates("show")
    meta_path = BUILD / "meta.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    life = life_eras(df, meta)

    top = df["show"].value_counts()
    featured = set(top.head(30).index)
    # Hooked from the first episode: shows where I watched 4+ episodes on day one.
    ser_all = df[df["kind"] == "series"]
    first_day = ser_all.groupby("show")["date"].transform("min") == ser_all["date"]
    day_one = ser_all[first_day].groupby("show").size()
    hooked = [{"show": k, "day_one": int(v), "views": int((ser_all["show"] == k).sum())}
              for k, v in day_one[day_one >= 4].sort_values(ascending=False).head(12).items()]
    featured |= {h["show"] for h in hooked}
    featured |= set(binges.head(20)["show"])
    for era in life:
        featured |= {t["show"] for t in era["top"]}
        featured |= {t["show"] for ex in era["examples"].values() for t in ex}
    yearly = []
    for year, s in df.groupby(df["date"].dt.year):
        counts = s["show"].value_counts()
        featured.add(counts.index[0])
        yearly.append({"year": int(year), "views": int(len(s)), "show": counts.index[0],
                       "episodes": int(counts.iloc[0])})
    eras = {}
    for era, s in df.groupby("era"):
        start, end = s["date"].min(), s["date"].max()
        months = max((end - start).days / 30.44, 1)
        counts = s["show"].value_counts().head(10)
        featured |= set(counts.index)
        eras[era] = {"views": int(len(s)), "from": day(start), "to": day(end),
                     "per_month": round(len(s) / months, 1),
                     "top": [{"show": k, "views": int(v)} for k, v in counts.items()]}

    # Stretches of time the site's story talks about.
    windows = {}
    first = df["date"].min()
    for name, start, end in [("first_days", day(first), day(first + pd.Timedelta(days=10))),
                             ("friends_run", "2019-11-12", "2019-12-31"),
                             ("after_crackdown", day(CRACKDOWN), "2023-12-31"),
                             ("last_summer_home", "2024-06-27", "2024-08-14"),
                             ("first_semester", day(MOVED_TO_AUSTIN), "2024-12-31"),
                             ("summer_2025", "2025-06-01", "2025-07-31"),
                             ("fall_2025", "2025-08-15", "2025-12-31"),
                             ("this_year", "2026-01-01", day(df["date"].max()))]:
        s = df[(df["date"] >= start) & (df["date"] <= end)]
        counts = s["show"].value_counts().head(5)
        featured |= set(counts.index)
        windows[name] = {"from": start, "to": end, "views": int(len(s)),
                         "top": [{"show": k, "views": int(v)} for k, v in counts.items()]}

    fam = family(meta)
    if fam:
        featured |= set(fam.get("mom_first_titles", []))
    words = title_words(df)
    pk = picky(df, meta)
    featured |= set(pk["dark_quits"] + pk["dating_quit"] + pk["korean_quit"])
    featured |= set(words["girl"] + words["boy"] + words["love"] + words["hindi_love"])
    monthly = df.groupby("month").size()
    all_months = pd.period_range(df["date"].min(), df["date"].max(), freq="M").astype(str)
    monthly = monthly.reindex(all_months, fill_value=0)

    site = {
        "totals": {
            "views": int(len(df)),
            "titles": int(len(titles)),
            "series": int((titles["kind"] == "series").sum()),
            "movies": int((titles["kind"] == "movie").sum()),
            "binge_days": int(len(binges)),
            "active_days": int(df["date"].nunique()),
            "from": day(df["date"].min()),
            "to": day(df["date"].max()),
        },
        "dates": {"crackdown": day(CRACKDOWN), "austin": day(MOVED_TO_AUSTIN)},
        "monthly": [{"month": m, "views": int(v)} for m, v in monthly.items()],
        "month_of_year": [int(v) for v in df.groupby(df["date"].dt.month).size().reindex(range(1, 13), fill_value=0)],
        "weekday": {k: int(v) for k, v in df["weekday"].value_counts().items()},
        "top": [{"show": k, "views": int(v)} for k, v in top.head(10).items()],
        "binges": [{"date": day(r.date), "show": r.show, "episodes": int(r.episodes)}
                   for r in binges.head(15).itertuples()],
        "yearly": yearly,
        "eras": eras,
        "hooked": hooked,
        "life": life,
        "profile": profile(df, meta),
        "words": words,
        "loyalty": loyalty(df),
        "picky": pk,
        "favorites": favorites(df),
        "show_run": longest_show_run(df),
        "friends_origin": friends_origin(df),
        "big_december": big_december(df),
        "genre_pie": genre_pie(df, meta),
        "dark_years": dark_years(df, meta),
        "front_row": front_row(df, meta),
        "family": fam,
        "windows": windows,
        "gaps": gaps(active),
        "streak": longest_streak(active),
        "shows": {show: show_summary(df, show) for show in sorted(featured)},
        # Posters only, for the family profile peeks (these aren't in my history).
        "extra_art": sorted(({t["show"] for p in (fam or {}).get("profiles", {}).values() for t in p["top"]}
                             | {t["show"] for t in (fam or {}).get("amaira", {}).get("top", []) + (fam or {}).get("amaira", {}).get("years", [])}
                             | {t["show"] for p in (fam or {}).get("parents", {}).values() for t in p["top"]}
                             | {y["show"] for p in (fam or {}).get("parents", {}).values() for y in p["years"] if y.get("show")}
                             | {t for y in (fam or {}).get("parents", {}).get("Mom", {}).get("years", []) for t in y.get("titles", [])[:4]}
                             | set((fam or {}).get("mom_parent_titles", []) + (fam or {}).get("dad_parent_titles", []))
                             | set((fam or {}).get("parents", {}).get("Mom", {}).get("srk", []))
                             | {t["show"] for t in (fam or {}).get("parents", {}).get("Dad", {}).get("timing", [])}
                             | {c["show"] for c in (fam or {}).get("copy_cat", [])}) - featured),
    }
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(site, indent=1, ensure_ascii=False))
    # Every episode of a featured series, for the title modal's episode list. Published by month only (no exact
    # dates): how many I watched that same day and my longest break are worked out here, and only the results ship.
    ep_path = OUT.parent / "episodes.json"
    old_eps = json.loads(ep_path.read_text()) if ep_path.exists() else {}
    stills = {}  # keep the TVmaze stills etl/fetch_stills.py already found
    for show, entry in old_eps.items():
        for rows in (entry.get("seasons", entry) if isinstance(entry, dict) else {}).values():
            for r in rows:
                if isinstance(r, list) and r and isinstance(r[-1], str) and r[-1].startswith("http"):
                    stills[(show, r[0])] = r[-1]
    eps = {}
    feat = df[df["show"].isin(featured) & (df["kind"] == "series")].sort_values("date", kind="stable")
    for show, g in feat.groupby("show", sort=False):
        same_day = g.groupby("date")["date"].transform("size")
        seasons = {}
        for r, n in zip(g.itertuples(), same_day):
            name = r.episode if isinstance(r.episode, str) else r.title
            row = [name, r.date.strftime("%Y-%m"), int(n)]
            if (show, name) in stills:
                row.append(stills[(show, name)])
            seasons.setdefault(r.season if isinstance(r.season, str) else "", []).append(row)
        days = pd.Series(sorted(g["date"].unique()))
        breaks = days.diff().dt.days
        gap = None
        if len(days) > 1 and breaks.max() >= 180:
            i = int(breaks.idxmax())
            gap = {"days": int(breaks[i]), "back": days[i].strftime("%Y-%m"), "episodes": int((g["date"] == days[i]).sum())}
        eps[show] = {"seasons": seasons, "gap": gap}
    ep_path.write_text(json.dumps(eps, separators=(",", ":"), ensure_ascii=False))
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB, {len(site['shows'])} shows)")


if __name__ == "__main__":
    main()
