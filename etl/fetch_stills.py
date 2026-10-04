"""Episode stills for the shows I came back to year after year, matched to the episodes I watched each year.

Netflix's export has no video, so the year squares in "The Ones That Never Left" open the episodes I watched
that year, with TVmaze's still for each one. Writes data/stills.json (episode names and image links only).

    .venv/bin/python etl/fetch_stills.py
"""
import json
import re
import time
import urllib.parse
from pathlib import Path

import pandas as pd

from fetch_art import LOOKUP, get_json

ROOT = Path(__file__).resolve().parent.parent
SITE = json.loads((ROOT / "data" / "site.json").read_text())
OUT = ROOT / "data" / "stills.json"
norm = lambda t: re.sub(r"[^a-z0-9]", "", str(t).lower())


def tvmaze_id(name):
    query, year = LOOKUP[name] if isinstance(LOOKUP.get(name), tuple) else (name, LOOKUP.get(name))
    results = get_json("https://api.tvmaze.com/search/shows?q=" + urllib.parse.quote(query))
    score = lambda r: (r["show"]["name"].lower() == query.lower(),
                       -abs(int((r["show"].get("premiered") or "0")[:4] or 0) - year) if year else 0, r["score"])
    return max(results, key=score)["show"]["id"] if results else None


def main():
    views = pd.read_csv(ROOT / "build" / "views.csv", parse_dates=["date"])
    shows = [s for s in SITE["shows"].values() if s["kind"] == "series" and len(s["by_year"]) >= 3]
    out = json.loads(OUT.read_text()) if OUT.exists() else {}
    for s in shows:
        name = s["show"]
        if name in out:
            continue
        sid = tvmaze_id(name)
        if not sid:
            continue
        eps = {norm(e["name"]): (e.get("image") or {}).get("medium") for e in get_json(f"https://api.tvmaze.com/shows/{sid}/episodes")}
        mine = views[views["show"] == name].sort_values("date")
        years = {}
        for y, g in mine.groupby(mine["date"].dt.year):
            picks = [{"ep": e, "img": eps.get(norm(e))} for e in g["episode"].dropna().drop_duplicates()]
            picks = [p for p in picks if p["img"]][:6]
            if picks:
                years[str(y)] = picks
        out[name] = years
        print(f"  {name}: {sum(len(v) for v in years.values())} stills")
        time.sleep(0.6)
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False))
    print(f"wrote {OUT.relative_to(ROOT)}: {len(out)} shows")


def episode_stills():
    """Add TVmaze's still to every episode in data/episodes.json ([name, month, same-day count, still])."""
    path = ROOT / "data" / "episodes.json"
    data = json.loads(path.read_text())
    for name, entry in data.items():
        rows = [e for eps in entry["seasons"].values() for e in eps]
        if all(len(e) == 4 for e in rows):
            continue
        sid = tvmaze_id(name)
        imgs = {norm(e["name"]): (e.get("image") or {}).get("medium") for e in get_json(f"https://api.tvmaze.com/shows/{sid}/episodes")} if sid else {}
        for e in rows:
            if imgs.get(norm(e[0])):
                e[3:] = [imgs[norm(e[0])]]
        print(f"  {name}: {sum(len(e) == 4 for e in rows)} stills")
        time.sleep(0.6)
    path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False))

if __name__ == "__main__":
    main()
    episode_stills()
