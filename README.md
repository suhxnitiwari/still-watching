# Still Watching

*My Netflix history, browsed like Netflix.*

**Live:** https://suhxnitiwari.github.io/still-watching/ · **Case study:** [One Household](https://suhxnitiwari.github.io/still-watching/case-study.html)

## What it is

Eleven years of what I pressed play on, from June 2015 to September 2026, rebuilt as a Netflix home screen. You pick a profile, land on a billboard with my own poster wall drifting behind it, and browse Top 10 and collection rows of my history. Press Play and the story runs as a short film, *The Password Stopped Working*, about what happened to my viewing when Netflix started enforcing one household per account in May 2023 and I moved away to college the next year.

**3,400+ views · 460+ titles · 420+ binge days · 1,260 days with something on**

## How it's built

A small Python ETL pipeline turns Netflix's raw export into one summarized JSON file, and a framework-free static site renders everything from it.

| Step | What happens |
|---|---|
| `etl/pipeline.py` | Reads `NetflixViewingHistory.csv` with pandas and parses each title string (`"Gilmore Girls: Season 2: The Bracebridge Dinner"`) into show, season and episode with a regex for season-like labels. Classifies series vs. movies (a show that never appears with an episode is a movie), tags eras, and finds binge days (3+ episodes of one show on one date). Merges in my own viewing from my parents' profiles before I had one. |
| `etl/fetch_meta.py` | Looks up every series on the TVmaze API for genre, language, type, network and premiere year, scoring search results by premiere year to pick the right show when names are ambiguous. Cached, so reruns skip shows already looked up. |
| `etl/fetch_art.py` | Downloads a poster and a wide background for each featured show from TVmaze (falling back to the Wikipedia lead image) and resizes them with macOS `sips`. |
| `etl/build_site.py` | Builds `data/site.json` (~58 KB): totals, a zero-filled monthly series, the five longest silences and longest daily streak, per-show summaries, and four school-era profiles comparing language mix, genre share, median premiere year and how many titles were new releases. |
| `index.html`, `js/app.js` | Vanilla JS and SVG, no framework. Every number on the page is read from `site.json` at runtime, so rerunning the pipeline updates the whole site. |

Some of the findings the pipeline computes: the 2019 winter break spent racing through *Friends* before it left US Netflix, how many views landed in the two weeks after schools closed in March 2020, and how the share of Hindi-language series changes when I'm away at school versus home for the summer.

**Privacy by design.** The raw exports (mine and my family's) are gitignored and never leave my laptop; the site only ships per-show and per-month summaries. Titles that shouldn't be public are filtered by a private blocklist, and that list is also kept out of the repo, since publishing it would reveal exactly what it hides. Streaks and silences are computed from every active day, blocked titles included, so hiding a title can't fake a gap.

## Design choices

- **It's Netflix, but it's me.** A "Who's watching?" profile screen, hover previews, Top 10 numbers and an episode list, all pointed at one person's history. Shows without key art get a generated tile whose color is hashed from the title.
- **A house that breaks.** The household section is my own SVG illustration of a house of screens. As you scroll, a `requestAnimationFrame`-throttled scroll handler moves it from whole to cracking to broken while my screen drifts off to Austin.
- **The data as a film.** The Play button opens a custom player with Netflix-style controls and keyboard support. Two episodes, a dorm-room cold open and a growing-up story from Singapore to the Forty Acres, are assembled at runtime from my numbers and the shows' art.
- **Who's watching? (the detective file).** Age, background, school calendar, COVID and graduation, each guessed from dates and titles alone, with the evidence shown.
- **A product case study.** [One Household](case-study.html) walks through Netflix's paid-sharing rollout and proposes "Away at School": a verified status for students on a family plan, with a north-star metric, guardrails and a holdout test plan.
- Respects `prefers-reduced-motion`, and hover previews only turn on for devices that can hover.

## Tech stack

Python (pandas) · TVmaze API · vanilla JavaScript · SVG · CSS · GitHub Pages

## Run it locally

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python etl/pipeline.py path/to/NetflixViewingHistory.csv
.venv/bin/python etl/fetch_meta.py && .venv/bin/python etl/build_site.py && .venv/bin/python etl/fetch_art.py
python3 -m http.server 8765
```

The repo already includes the built `data/` and `img/`, so the server step alone is enough to browse the site.

## Limits of the data

Netflix's export keeps only the latest date for each title, so rewatches count once. It has dates but no times, and each profile only knows itself.

## Images

Show posters and backgrounds come from [TVmaze](https://www.tvmaze.com) and belong to their studios and networks. The household illustration is my own drawing.

## Ownership

© 2026 Suhani Tiwari. All rights reserved. Not affiliated with Netflix.

Built by [Suhani Tiwari](https://suhanitiwari.com).
