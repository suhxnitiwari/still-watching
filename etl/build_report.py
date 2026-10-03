"""Build the downloadable data report (report/still-watching-report.pdf) from data/site.json.

The site tells the story; the report holds the dense charts: every month, every year, the eras,
and the top shows.

    .venv/bin/python etl/build_report.py
"""
import json
from datetime import date
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages

ROOT = Path(__file__).resolve().parent.parent
SITE = json.loads((ROOT / "data" / "site.json").read_text())
OUT = ROOT / "report" / "still-watching-report.pdf"

BG, FG, MUTED, RED, GRAY = "#141414", "#ffffff", "#9a9a9a", "#e50914", "#5a5a5a"
plt.rcParams.update({
    "figure.facecolor": BG, "axes.facecolor": BG, "savefig.facecolor": BG, "text.color": FG,
    "axes.labelcolor": MUTED, "xtick.color": MUTED, "ytick.color": MUTED, "axes.edgecolor": "#333333",
    "font.family": "DejaVu Sans", "font.size": 10,
})
PAGE = (11, 8.5)


def fmt(iso):
    y, m, d = map(int, iso.split("-"))
    return date(y, m, d).strftime("%b %-d, %Y")


def title(fig, kicker, text, sub=None):
    fig.text(.06, .93, kicker.upper(), color=RED, fontsize=9, fontweight="bold")
    fig.text(.06, .885, text, fontsize=22, fontweight="bold")
    if sub:
        fig.text(.06, .85, sub, color=MUTED, fontsize=10)


def cover(pdf):
    t = SITE["totals"]
    fig = plt.figure(figsize=PAGE)
    fig.text(.06, .78, "STILL WATCHING", color=RED, fontsize=44, fontweight="bold")
    fig.text(.06, .71, "The data report", fontsize=22)
    fig.text(.06, .66, f"My Netflix history, {fmt(t['from'])} to {fmt(t['to'])}", color=MUTED, fontsize=12)
    stats = [(f"{t['views']:,}", "views"), (f"{t['titles']:,}", "titles"), (f"{t['binge_days']:,}", "binge days"),
             (f"{t['active_days']:,}", "days with something on")]
    for i, (n, label) in enumerate(stats):
        x = .06 + i * .225
        fig.text(x, .45, n, fontsize=36, fontweight="bold", color=RED if i == 0 else FG)
        fig.text(x, .40, label, color=MUTED, fontsize=11)
    fig.text(.06, .12, "Views count episodes and movies, once each (Netflix keeps only the latest date per title).\n"
             "Per-show and per-month summaries only; the raw history stays private.  ·  suhxnitiwari.github.io/still-watching",
             color=MUTED, fontsize=9)
    pdf.savefig(fig)
    plt.close(fig)


def timeline(pdf):
    months = SITE["monthly"]
    labels = [m["month"] for m in months]
    views = [m["views"] for m in months]
    fig = plt.figure(figsize=PAGE)
    title(fig, "Every month", f"{len(months)} months of watching", "Views per month, shaded by school era")
    ax = fig.add_axes([.06, .14, .9, .62])
    idx = {m: i for i, m in enumerate(labels)}
    for k, era in enumerate(SITE["life"]):
        a, b = idx.get(era["from"][:7], 0), idx.get(era["to"][:7], len(labels) - 1)
        ax.axvspan(a - .5, b + .5, color="#ffffff", alpha=.04 if k % 2 else .08, lw=0)
        ax.text((a + b) / 2, max(views) * 1.02, era["name"].upper(), ha="center", color=MUTED, fontsize=8, fontweight="bold")
    marks = {"2019-12": "Friends: 29 in a day", "2023-05": "Paid sharing hits the U.S.", "2024-03": "Senior spring",
             "2024-08": "Moved to Austin", "2025-07": "Home for the summer"}
    ax.bar(range(len(views)), views, color=[RED if m in marks else GRAY for m in labels], width=.75)
    for i, (m, text) in enumerate(marks.items()):
        if m in idx:
            x = idx[m]
            ax.annotate(text, (x, views[x]), xytext=(x, max(views) * (.92 - .09 * (i % 3))), ha="center", fontsize=8,
                        color=FG, arrowprops={"arrowstyle": "-", "color": MUTED, "lw": .6, "linestyle": ":"})
    ticks = [i for i, m in enumerate(labels) if m.endswith("-01")]
    ax.set_xticks(ticks, [labels[i][:4] for i in ticks])
    ax.set_ylim(0, max(views) * 1.1)
    ax.set_ylabel("views")
    ax.spines[["top", "right"]].set_visible(False)
    pdf.savefig(fig)
    plt.close(fig)


def years_and_eras(pdf):
    fig = plt.figure(figsize=PAGE)
    title(fig, "Every year and era", "How much, and when")
    ax = fig.add_axes([.06, .14, .52, .62])
    years = SITE["yearly"]
    xs = [y["year"] for y in years]
    ax.bar(xs, [y["views"] for y in years], color=GRAY)
    for y in years:
        ax.text(y["year"], y["views"] + 6, f"{y['views']}", ha="center", fontsize=8, color=FG)
        ax.text(y["year"], 4, y["show"][:14], rotation=90, ha="center", va="bottom", fontsize=7, color="#dddddd")
    ax.set_title("Views per year, with that year's #1 show", color=MUTED, fontsize=10, loc="left")
    ax.spines[["top", "right"]].set_visible(False)
    rows = [(e["name"], f"{e['views']:,}", f"{e['per_month']}", f"{e['titles']}", f"{e['language'].get('Hindi', 0):.0f}%",
             f"{e['genres'].get('Drama', 0):.0f}%", f"{e['median_premiere']}") for e in SITE["life"]]
    ax2 = fig.add_axes([.62, .3, .34, .4])
    ax2.axis("off")
    table = ax2.table(cellText=rows, colLabels=["Era", "Views", "/mo", "Titles", "Hindi", "Drama", "Premiere"],
                      loc="center", cellLoc="center", colWidths=[.3, .13, .1, .12, .11, .12, .14])
    table.auto_set_font_size(False)
    table.set_fontsize(8)
    table.scale(1, 1.6)
    for (r, c), cell in table.get_celld().items():
        cell.set_edgecolor("#333333")
        cell.set_facecolor("#1e1e1e" if r else "#2a2a2a")
        cell.get_text().set_color(FG if r else MUTED)
    ax2.set_title("The four eras", color=MUTED, fontsize=10, loc="left")
    pdf.savefig(fig)
    plt.close(fig)


def top_shows(pdf):
    shows = sorted(SITE["shows"].values(), key=lambda s: -s["views"])[:20]
    fig = plt.figure(figsize=PAGE)
    title(fig, "The shows", "Top 20 by episodes watched")
    ax = fig.add_axes([.28, .08, .66, .72])
    names = [s["show"] for s in shows][::-1]
    vals = [s["views"] for s in shows][::-1]
    ax.barh(names, vals, color=[RED if i >= len(vals) - 3 else GRAY for i in range(len(vals))])
    for i, (v, s) in enumerate(zip(vals, shows[::-1])):
        ax.text(v + 2, i, f"{v}  ·  {s['first'][:4]}–{s['last'][:4]}", va="center", fontsize=8, color=MUTED)
    ax.set_xlim(0, max(vals) * 1.25)
    ax.spines[["top", "right"]].set_visible(False)
    pdf.savefig(fig)
    plt.close(fig)


def main():
    OUT.parent.mkdir(exist_ok=True)
    with PdfPages(OUT) as pdf:
        cover(pdf)
        timeline(pdf)
        years_and_eras(pdf)
        top_shows(pdf)
        info = pdf.infodict()
        info["Title"] = "Still Watching: the data report"
        info["Author"] = "Suhani Tiwari"
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
