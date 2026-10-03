"""Download key art for every show the site features.

TV shows come from TVmaze (a poster and a wide background); anything TVmaze doesn't have
comes from the Wikipedia article's lead image. Images are resized with macOS `sips` and
listed in data/art.json, which the site reads.

    .venv/bin/python etl/fetch_art.py
"""
import json
import re
import subprocess
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = json.loads((ROOT / "data" / "site.json").read_text())
OUT = ROOT / "data" / "art.json"
POSTERS, BACKDROPS = ROOT / "img" / "posters", ROOT / "img" / "backdrops"
UA = {"User-Agent": "still-watching/1.0 (personal data project)"}

# What to search for, and the year the right show premiered, where the name alone is ambiguous.
LOOKUP = {
    "13 Reasons Why": 2017, "AMERICA'S SWEETHEARTS": ("America's Sweethearts: Dallas Cowboys Cheerleaders", 2024),
    "Baby Daddy": 2012, "Brain Games": 2011, "Bridgerton": 2020, "Bunk'd": 2015, "Delhi Crime": 2019,
    "Dubai Bling": 2022, "Emily in Paris": 2020, "Fabulous Lives of Bollywood Wives": 2020, "Friends": 1994,
    "Fuller House": 2016, "Gilmore Girls": 2000, "Ginny & Georgia": 2021, "Girl Meets World": 2014,
    "Gossip Girl": 2007, "Grey's Anatomy": 2005, "Heeramandi": ("Heeramandi: The Diamond Bazaar", 2024),
    "Indian Matchmaking": 2020, "Jane The Virgin": 2014, "LEGO Ninjago": ("Ninjago: Masters of Spinjitzu", 2011),
    "Manifest": 2018, "Masha and the Bear": 2009, "Mismatched": 2020, "Never Have I Ever": 2020,
    "Once Upon a Time": 2011, "Partner Track": 2022, "Peaky Blinders": 2013, "Planet Earth": 2006, "Riverdale": 2017, "Single Papa": 2024,
    "Stranger Things": 2016, "Sugar Rush": 2018, "Switched at Birth": 2011, "The Boss Baby": ("The Boss Baby: Back in Business", 2018), "The Fosters": 2013,
    "The Great Indian Kapil Show": 2024, "The Night Agent": 2023, "The Originals": 2013,
    "The Vampire Diaries": 2009, "Workin' Moms": 2017, "XO, Kitty": 2023, "Young Sheldon": 2017,
    "Masaba Masaba": 2020, "Money Heist": ("La Casa de Papel", 2017), "Victorious": 2010, "Merry Happy Whatever": 2019,
    "Dabba Cartel": 2025, "Tribhuvan Mishra CA Topper": 2024, "Beyond Stranger Things": 2017,
}
WIKI = {"A Family Affair": "A Family Affair (2024 film)"}


def get_json(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
        return json.load(r)


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def save(url, dest, width):
    dest.parent.mkdir(parents=True, exist_ok=True)
    raw = dest.with_suffix(".src")
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        raw.write_bytes(r.read())
    subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "72", "--resampleWidth", str(width),
                    str(raw), "--out", str(dest)], check=True, capture_output=True)
    raw.unlink()
    return str(dest.relative_to(ROOT))


def tvmaze(name):
    query, year = LOOKUP[name] if isinstance(LOOKUP.get(name), tuple) else (name, LOOKUP.get(name))
    results = get_json("https://api.tvmaze.com/search/shows?q=" + urllib.parse.quote(query))
    def score(r):
        show = r["show"]
        premiered = int((show.get("premiered") or "0")[:4] or 0)
        exact = show["name"].lower() == query.lower()
        return (exact, -abs(premiered - year) if year else 0, r["score"])
    best = max(results, key=score)["show"] if results else None
    if not best:
        return None
    images = get_json(f"https://api.tvmaze.com/shows/{best['id']}/images")
    pick = lambda kind: next((i for i in sorted(images, key=lambda i: not i.get("main")) if i["type"] == kind), None)
    poster, background = pick("poster"), pick("background")
    return {
        "match": f"{best['name']} ({(best.get('premiered') or '?')[:4]})",
        "source": best["url"],
        "poster": poster and poster["resolutions"]["original"]["url"],
        "backdrop": background and background["resolutions"]["original"]["url"],
    }


def wikipedia(title):
    q = urllib.parse.urlencode({"action": "query", "prop": "pageimages", "piprop": "original",
                                "titles": title, "redirects": 1, "format": "json"})
    page = next(iter(get_json("https://en.wikipedia.org/w/api.php?" + q)["query"]["pages"].values()))
    url = page.get("original", {}).get("source")
    return url and {"match": page["title"], "source": "https://en.wikipedia.org/wiki/" + page["title"].replace(" ", "_"),
                    "poster": url, "backdrop": None}


def main():
    art = json.loads(OUT.read_text()) if OUT.exists() else {}
    for name in sorted(SITE["shows"]):
        if name in art:
            continue
        found = wikipedia(WIKI[name]) if name in WIKI else tvmaze(name)
        if not found or not found["poster"]:
            print(f"  ! nothing for {name}")
            continue
        entry = {"match": found["match"], "source": found["source"],
                 "poster": save(found["poster"], POSTERS / f"{slug(name)}.jpg", 400)}
        if found["backdrop"]:
            entry["backdrop"] = save(found["backdrop"], BACKDROPS / f"{slug(name)}.jpg", 800)
        art[name] = entry
        print(f"  {name:36} -> {found['match']}{'' if found['backdrop'] else '  (poster only)'}")
        time.sleep(0.6)  # TVmaze allows about 20 calls per 10 seconds
    OUT.write_text(json.dumps(art, indent=1, ensure_ascii=False))
    print(f"wrote {OUT.relative_to(ROOT)}: {len(art)} of {len(SITE['shows'])} shows")


if __name__ == "__main__":
    main()
