"""Export Papa's, Mumma's and Amaira's full histories for the password-protected family view.

Writes build/family_full.json (gitignored). etl/lock_family.mjs encrypts it into data/vault.json,
the only file that reaches the site. Same blocklist as the public site: those titles never leave the laptop.

    .venv/bin/python etl/lock_family.py
"""
import json
import sys
from pathlib import Path

sys.argv = sys.argv[:1]  # pipeline.py reads an optional CSV path from argv; we don't pass one
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pipeline import BLOCKED, OUT, ROOT, extract, split_title  # noqa: E402

FILES = {
    "Dad": "PapaNetflixViewingHistory.csv",
    "Mom": "MummaNetflixViewingHistory.csv",
    "Sister": "AmairaNetflixViewingHistory (1).csv",
}


def history(path):
    df = extract(path).drop_duplicates()
    rows = []
    for title, date in zip(df["title"], df["date"]):
        show, season, episode = split_title(title)
        if show in BLOCKED:
            continue
        rows.append([date.strftime("%Y-%m-%d"), show, season or "", episode or ""])
    rows.sort(key=lambda r: r[0], reverse=True)  # newest first, like Netflix's viewing activity page
    return rows


def main():
    out = {}
    for who, name in FILES.items():
        path = ROOT / name
        if not path.exists():
            sys.exit(f"Missing {name}: put the export in the project folder first.")
        out[who] = history(path)
        print(f"{who}: {len(out[who]):,} plays")
    OUT.mkdir(exist_ok=True)
    (OUT / "family_full.json").write_text(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
