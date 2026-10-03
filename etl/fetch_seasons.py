"""Release dates per season (TVmaze) for the Netflix-era shows I follow, so the site can compare release day with my first play.

    .venv/bin/python etl/fetch_seasons.py
"""
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "build" / "season_dates.json"
SHOWS = ["Bridgerton", "Emily in Paris", "Never Have I Ever", "Ginny & Georgia", "XO, Kitty", "Fuller House", "The Night Agent",
         "Manifest", "The Great Indian Kapil Show", "Heeramandi", "Indian Matchmaking", "Stranger Things", "Outer Banks", "Nobody Wants This"]


def get(url):
    with urllib.request.urlopen(url, timeout=20) as r:
        return json.load(r)


def main():
    out = {}
    for show in SHOWS:
        sid = get("https://api.tvmaze.com/singlesearch/shows?q=" + urllib.parse.quote(show))["id"]
        seasons = {}
        for e in get(f"https://api.tvmaze.com/shows/{sid}/episodes"):
            if e.get("airdate"):
                seasons.setdefault(str(e["season"]), e["airdate"])
        out[show] = seasons
        time.sleep(0.3)
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(ROOT)}: {len(out)} shows")


if __name__ == "__main__":
    main()
