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
    "Stranger Things": 2016, "Sugar Rush": 2018, "Switched at Birth": 2011, "The Boss Baby": ("The Boss Baby: Back in Business", 2018), "Lilo & Stitch": ("Lilo & Stitch: The Series", 2003), "The Fosters": 2013,
    "The Great Indian Kapil Show": 2024, "The Night Agent": 2023, "The Originals": 2013,
    "The Vampire Diaries": 2009, "Workin' Moms": 2017, "XO, Kitty": 2023, "Young Sheldon": 2017,
    "Masaba Masaba": 2020, "Money Heist": ("La Casa de Papel", 2017), "Victorious": 2010, "Merry Happy Whatever": 2019,
    "Dabba Cartel": 2025, "Tribhuvan Mishra CA Topper": 2024, "Beyond Stranger Things": 2017,
    "Jessie": 2011, "Richie Rich": 2015, "Goosebumps": 1995, "Inspector Gadget": 2015, "One Day at a Time": 2017, "Pretty Little Liars": 2010, "Good Luck Charlie": 2010, "Lab Rats": 2012, "Liv and Maddie": 2013, "A.N.T. Farm": 2011,
    "Phineas and Ferb": 2007, "Dragon Tales": 1999, "Mickey Mouse Clubhouse": 2006, "Mighty Med": 2013,
}
WIKI = {"A Family Affair": "A Family Affair (2024 film)",
        # Mom's Shah Rukh Khan shelf: films, so Wikipedia, not TVmaze (which matches TV shows with the same name).
        "Om Shanti Om": "Om Shanti Om", "Chennai Express": "Chennai Express", "Dilwale": "Dilwale (2015 film)",
        "Dunki": "Dunki (film)", "Raees": "Raees (film)", "Kabhi Khushi Kabhie Gham": "Kabhi Khushi Kabhie Gham...",
        "Dil To Pagal Hai": "Dil To Pagal Hai", "Phir Bhi Dil Hai Hindustani": "Phir Bhi Dil Hai Hindustani",
        "Deewana": "Deewana (1992 film)", "Anjaam": "Anjaam", "Chak De! India": "Chak De! India",
        "Dear Zindagi": "Dear Zindagi", "Jawan": "Jawan (film)", "Zero": "Zero (2018 film)",
        # Films that TVmaze matched to TV shows with the same name.
        "The Secret Life of Pets": "The Secret Life of Pets", "The Emoji Movie": "The Emoji Movie", "Despicable Me 3": "Despicable Me 3", "Minions": "Minions (film)", "Home": "Home (2015 film)", "The Jungle Book": "The Jungle Book (2016 film)", "Leap!": "Ballerina (2016 film)", "Kung Fu Panda": "Kung Fu Panda (film)", "YES DAY": "Yes Day", "Mickey's Once Upon a Christmas": "Mickey's Once Upon a Christmas", "Trolls": "Trolls (film)", "Peter Rabbit": "Peter Rabbit (film)", "Coco": "Coco (2017 film)", "Sing": "Sing (2016 American film)", "Goosebumps": "Goosebumps (1995 TV series)", "LEGO": "Lego",
        # Dad's impeccable-timing picks.
        "24 Hours to Live": "24 Hours to Live", "Roman Empire": "Roman Empire (TV series)", "City of God": "City of God (2002 film)", "The Mother": "The Mother (2023 film)", "Hit Man": "Hit Man (2023 film)", "72 Dangerous Animals": "72 Dangerous Animals: Latin America", "Watership Down": "Watership Down (TV series)", "Escape at Dannemora": "Escape at Dannemora", "Apocalypse": "Apocalypse: The Second World War", "MADOFF": "Madoff: The Monster of Wall Street", "Mob War": "Mob War: Philadelphia vs. the Mafia", "Inglourious Basterds": "Inglourious Basterds",
        # Mom's Hindi films.
        "Maa": "Maa (2025 film)", "Neerja": "Neerja", "Talvar": "Talvar (film)", "Phantom": "Phantom (2015 film)", "Jai Mummy Di": "Jai Mummy Di", "Daadi Ki Shaadi": "Daadi Ki Shaadi", "Bbuddah Hoga Terra Baap": "Bbuddah Hoga Terra Baap", "Mister Mummy": "Mister Mummy", "Super Nani": "Super Nani", "Sardar Ka Grandson": "Sardar Ka Grandson", "Saiyaara": "Saiyaara", "Queen": "Queen (2013 film)", "Aiyaary": "Aiyaary", "Rajma Chawal": "Rajma Chawal", "Zindagi Na Milegi Dobara": "Zindagi Na Milegi Dobara", "Sooryavanshi": "Sooryavanshi", "Kyaa Kool Hain Hum 3": "Kyaa Kool Hain Hum 3", "Tere Ishk Mein": "Tere Ishk Mein", "De De Pyaar De 2": "De De Pyaar De 2", "Chandigarh Kare Aashiqui": "Chandigarh Kare Aashiqui", "Pitaah": "Pitaah", "My Little Pony": "My Little Pony: Friendship Is Magic"}


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
    for name in sorted(set(SITE["shows"]) | set(SITE.get("extra_art", []))):
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
