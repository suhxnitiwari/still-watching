"""Summarize the cleaned views into data/site.json for the website.

The site ships per-show and per-month summaries, never the raw history.

    .venv/bin/python etl/pipeline.py && .venv/bin/python etl/build_site.py
"""
import json
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
    return {
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
        # My birthday (Mar 6) against every other calendar day: can a stranger find it?
        "birthday": {"rank": int(df["date"].dt.strftime("%m-%d").value_counts().rank(ascending=False, method="min").get("03-06", 0)),
                     "days": int(df["date"].dt.strftime("%m-%d").nunique()),
                     "quiet_years": int(sum(1 for y in range(df["date"].dt.year.min() + 1, df["date"].dt.year.max() + 1)
                                            if not ((df["date"].dt.month == 3) & (df["date"].dt.day == 6) & (df["date"].dt.year == y)).any())),
                     "years": int(df["date"].dt.year.max() - df["date"].dt.year.min())},
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
    fam_word = r"\b(?:Mom|Mother|Mummy|Mumma|Dad|Daddy|Papa|Father)\b"
    titles_of = lambda w: sorted(set(h[(h["who"] == w) & h["show"].str.contains(fam_word, regex=True)]["show"]))
    return {
        "freeze": {"family": int(len(freeze)), "mine": sorted(set(freeze[freeze["who"] == "Suhani"]["show"]))},
        "dad_on_mothers_day": [{"show": r.show, "year": int(r.date.year)} for r in dad_md.drop_duplicates("show").itertuples()],
        "mom_parent_titles": titles_of("Mom"), "dad_parent_titles": titles_of("Dad"),
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
        "life": life,
        "profile": profile(df, meta),
        "family": family(meta),
        "windows": windows,
        "gaps": gaps(active),
        "streak": longest_streak(active),
        "shows": {show: show_summary(df, show) for show in sorted(featured)},
    }
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(site, indent=1, ensure_ascii=False))
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB, {len(site['shows'])} shows)")


if __name__ == "__main__":
    main()
