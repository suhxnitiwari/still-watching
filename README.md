# Still Watching

*My Netflix history, browsed like Netflix.* Nine years of what I pressed play on, from December 2017 to now, told as a show with two seasons: Dallas and Austin.

2,566 views · 353 titles · 319 binge days · 909 days with something on

## The story

In May 2023 Netflix started checking whether you watch from the account's home Wi-Fi. At home in Dallas nothing changed. Then 2024 became my lowest year by far, and after I moved to Austin the screen mostly went dark, except the summers I came home.

## What it finds

- **Who's watching?** A detective file: age, gender, cultural background, home, school calendar, COVID, graduation, college, family, all guessed from dates and titles alone, each with its signal and evidence.
- **Growing up on Netflix.** Middle school (2017–2020), high school (2020–2024), after graduation: family TV gave way to serious drama, then Hindi shows went from 0% to 27% once I left home.
- **The household.** Netflix's 2023 sharing rules, drawn as a house that breaks apart when I move to Austin.

## How it works

| Step | What happens |
|---|---|
| `etl/pipeline.py` | Reads Netflix's `NetflixViewingHistory.csv`, splits each title into show, season and episode, separates series from movies, marks the Dallas and Austin eras, and finds binge days (3+ episodes of one show on one date) |
| `etl/fetch_art.py` | Finds each featured show on TVmaze and downloads its poster and background, resized with `sips`, into `img/` and `data/art.json` |
| `etl/fetch_meta.py` | Looks up all 176 series on TVmaze for genres, language, type and premiere year, so taste can be compared across eras |
| `etl/build_site.py` | Summarizes the cleaned views into `data/site.json`: per-show and per-month numbers only |
| `index.html`, `css/`, `js/` | A static site with no framework: the family profile screen, a billboard with the poster wall playing, Top 10 and collection rows, a household that breaks apart as you scroll, a monthly timeline, an episode list of findings, and a detail card for every title |

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python etl/pipeline.py && .venv/bin/python etl/build_site.py && .venv/bin/python etl/fetch_art.py
python3 -m http.server 8765
```

## Privacy

The raw export never goes in this repo (see `.gitignore`). The site ships summaries, never the full history.

## Limits of the data

Netflix's export keeps only the latest date for each title, so rewatches count once. It has dates but no times, and it only knows this profile.

## Images

Show posters and backgrounds come from [TVmaze](https://www.tvmaze.com) and belong to their studios and networks. The household illustration is my own drawing.

## Ownership

© 2026 Suhani Tiwari. All rights reserved. Not affiliated with Netflix.
