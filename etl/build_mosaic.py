"""Pack posters from the family's history into sprite sheets: one small image instead of hundreds of posters.
- img/mosaic.jpg: every poster in the family's history, for the intro's poster-mosaic S.
- img/mosaic-<person>.jpg: each person's own most-watched titles, for their face on the profile screen. Each
  poster carries that person's view count, so the shows they watched most make up more of their face.
    .venv/bin/python etl/build_mosaic.py
Writes data/mosaic.json with each sheet's grid and the per-person titles and weights.
"""
import csv
import json
from collections import Counter
from pathlib import Path

from PIL import Image, ImageStat

ROOT = Path(__file__).resolve().parent.parent
CELL = (32, 48)  # 2x the on-screen tile, so it stays sharp on retina screens
COLS = 16
FACE_CELL = (40, 40)  # face tiles are square: the upper middle of each poster, where the faces usually are
FACE_MAX = 64
PEOPLE = {"Dad": "dad", "Mom": "mom", "Suhani": "suhani", "Sister": "amaira"}


def crop(im, cell, top=.5):
    """Crop to the cell's aspect ratio (centered across, `top` of the way down) and shrink to one cell."""
    w, h = im.size
    ratio = cell[1] / cell[0]
    tw, th = (w, round(w * ratio)) if h >= w * ratio else (round(h / ratio), h)
    x, y = (w - tw) // 2, round((h - th) * top)
    return im.crop((x, y, x + tw, y + th)).resize(cell, Image.LANCZOS)


def faces(art):
    """Each person's top titles by views (from the household split), packed into their own sheet."""
    path = ROOT / "build" / "household.csv"
    if not path.exists():
        return {}
    views = {who: Counter() for who in PEOPLE}
    with path.open() as f:
        for r in csv.DictReader(f):
            if r["who"] in views and r["show"]:
                views[r["who"]][r["show"]] += 1
    out = {}
    for who, slug in PEOPLE.items():
        picks = [(show, n) for show, n in views[who].most_common() if (art.get(show) or {}).get("poster")
                 and (ROOT / art[show]["poster"]).exists()][:FACE_MAX]
        rows = -(-len(picks) // 8)
        sheet = Image.new("RGB", (8 * FACE_CELL[0], rows * FACE_CELL[1]))
        for i, (show, _) in enumerate(picks):
            sheet.paste(crop(Image.open(ROOT / art[show]["poster"]).convert("RGB"), FACE_CELL, .3), ((i % 8) * FACE_CELL[0], (i // 8) * FACE_CELL[1]))
        sheet.save(ROOT / "img" / f"mosaic-{slug}.jpg", quality=80, optimize=True, progressive=True)
        out[who] = {"sheet": f"img/mosaic-{slug}.jpg", "cols": 8, "cell": FACE_CELL,
                    "titles": [s for s, _ in picks], "views": [n for _, n in picks]}
        print(f"  {who:7} {len(picks)} posters, {sum(n for _, n in picks):,} views")
    return out


def main():
    art = json.loads((ROOT / "data" / "art.json").read_text())
    paths = sorted({v["poster"] for v in art.values() if v and v.get("poster") and (ROOT / v["poster"]).exists()})
    rows = -(-len(paths) // COLS)
    sheet = Image.new("RGB", (COLS * CELL[0], rows * CELL[1]))
    lum = []
    for i, p in enumerate(paths):
        im = Image.open(ROOT / p).convert("RGB")
        # Crop to 2:3 from the center, then shrink to one cell.
        w, h = im.size
        tw, th = (w, w * 3 // 2) if h >= w * 3 // 2 else (h * 2 // 3, h)
        im = im.crop(((w - tw) // 2, (h - th) // 2, (w + tw) // 2, (h + th) // 2)).resize(CELL, Image.LANCZOS)
        sheet.paste(im, ((i % COLS) * CELL[0], (i // COLS) * CELL[1]))
        lum.append(round(ImageStat.Stat(im.convert("L")).mean[0] / 255, 3))
    sheet.save(ROOT / "img" / "mosaic.jpg", quality=78, optimize=True, progressive=True)
    (ROOT / "data" / "mosaic.json").write_text(json.dumps({"cols": COLS, "cell": CELL, "n": len(paths), "lum": lum, "faces": faces(art)}, ensure_ascii=False))
    print(f"wrote img/mosaic.jpg: {len(paths)} posters, {sheet.size[0]}x{sheet.size[1]}")


if __name__ == "__main__":
    main()
