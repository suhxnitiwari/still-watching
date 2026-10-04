"""Look up every series in my history on TVmaze: genres, language, type, premiere year.

Writes build/meta.json (cached: shows already looked up are skipped).

    .venv/bin/python etl/fetch_meta.py
"""
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

import pandas as pd

from fetch_art import LOOKUP, UA

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "build" / "meta.json"


def search(name):
    query, year = LOOKUP[name] if isinstance(LOOKUP.get(name), tuple) else (name, LOOKUP.get(name))
    url = "https://api.tvmaze.com/search/shows?q=" + urllib.parse.quote(query)
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
        results = json.load(r)
    if not results:
        return None
    def score(r):
        show = r["show"]
        premiered = int((show.get("premiered") or "0")[:4] or 0)
        return (show["name"].lower() == query.lower(), -abs(premiered - year) if year else 0, r["score"])
    best = max(results, key=score)
    show = best["show"]
    if best["score"] < 0.5 and show["name"].lower() != query.lower():
        return None
    network = (show.get("webChannel") or show.get("network") or {}).get("name")
    return {"match": show["name"], "premiered": (show.get("premiered") or "")[:4], "language": show.get("language"),
            "genres": show.get("genres", []), "type": show.get("type"), "network": network}


# Titles TVmaze only matches to the wrong show (they're films or too generic): no metadata beats wrong metadata.
NO_MATCH = {"LEGO", "One Day", "Spy Kids", "Trolls"}


def main():
    views = pd.read_csv(ROOT / "build" / "views.csv")
    series = sorted(views.loc[views["kind"] == "series", "show"].dropna().unique())
    meta = json.loads(OUT.read_text()) if OUT.exists() else {}
    for name in series:
        if name in NO_MATCH:
            meta[name] = None
            continue
        if name in meta:
            continue
        try:
            meta[name] = search(name)
        except Exception as e:  # keep going; a rerun retries
            print(f"  ! {name}: {e}")
            continue
        time.sleep(0.55)
    OUT.write_text(json.dumps(meta, indent=1, ensure_ascii=False))
    found = sum(1 for v in meta.values() if v)
    print(f"wrote {OUT.relative_to(ROOT)}: {found} of {len(series)} series matched")


if __name__ == "__main__":
    main()
