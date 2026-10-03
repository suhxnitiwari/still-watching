// Still Watching: my Netflix history, browsed like Netflix.
// Everything on the page comes from data/site.json, built by etl/build_site.py.

const $ = (sel, root = document) => root.querySelector(sel);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SVG = "http://www.w3.org/2000/svg";

let DATA;
const BIRTH_YEAR = 2006;
let ART = {};

// ---------- helpers ----------
const n = (x) => x.toLocaleString("en-US");
const parse = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
const fmtDate = (iso) => { const d = parse(iso); return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };
const fmtShort = (iso) => { const d = parse(iso); return `${MONTHS[d.getMonth()]} ${d.getDate()}`; };
const fmtMonth = (ym) => { const [y, m] = ym.split("-"); return `${MONTHS[m - 1]} ${y}`; };
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5) + 1;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const listOf = (items) => items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

function hue(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 360;
}

// Key art: the real poster or background when we have one (data/art.json), otherwise
// a color made from the title with the name in display type.
function art(name, { label = name, mark = true, tall = false } = {}) {
  const a = ART[name];
  const src = a && (tall ? a.poster : a.backdrop || a.poster);
  if (src) {
    const posterInWide = !tall && !a.backdrop;
    return `<span class="art art--img${posterInWide ? " art--poster" : ""}" aria-hidden="true">
      <img src="${src}" alt="" loading="lazy" decoding="async">
      ${mark ? '<span class="art__mark">S</span>' : ""}
      ${tall ? "" : `<span class="art__name">${esc(label)}</span>`}</span>`;
  }
  const h = hue(name);
  return `<span class="art" style="--h:${h};--h2:${(h + 40) % 360}" aria-hidden="true">
    ${mark ? '<span class="art__mark">S</span>' : ""}
    <span class="art__name">${esc(label)}</span></span>`;
}

function tile(show, extra = "", opts = {}) {
  return `<button class="tile" type="button" data-show="${esc(show)}" aria-label="${esc(show)}">${art(show, opts)}${extra}</button>`;
}

// The poster wall: every show I have art for, dealt into columns that drift up and down.
function wallHTML(cols = 13) {
  const posters = Object.values(ART).map((a) => a.poster).filter(Boolean);
  if (!posters.length) return '<div class="wall"></div>';
  const columns = Array.from({ length: cols }, (_, c) => {
    const list = Array.from({ length: 8 }, (_, k) => posters[(c * 5 + k * 7) % posters.length]);
    const imgs = list.map((src) => `<img src="${src}" alt="" loading="lazy" decoding="async">`).join("");
    return `<div class="wall__col" style="--speed:${60 + (c % 4) * 12}s">${imgs}${imgs}</div>`;
  });
  return `<div class="wall"><div class="wall__grid">${columns.join("")}</div></div>`;
}

const FALLBACK_BG = () => Object.values(ART).find((a) => a.backdrop)?.backdrop || "";

// ---------- Who's watching? ----------
// The family account's profile screen. Only my profile opens: it's the only history here.
const PROFILES = [
  { name: "Dad", bg: ["#2f8cff", "#1559c9"], hair: "boy" },
  { name: "Mom", bg: ["#a53bff", "#6a17d6"], hair: "bun" },
  { name: "Suhani", bg: ["#ff3fa4", "#d81b7a"], hair: "bear", me: true },
  { name: "Sister", bg: ["#33a8ff", "#2ea44f"], hair: "frog", kids: true },
];

function avatar(p, id) {
  const [a, b] = p.bg;
  const skin = "#c98b5e";
  const hood = { bear: "#f4c430", frog: "#58b947" }[p.hair];
  let back = "", front = "";
  if (p.hair === "bear") back = `<circle cx="27" cy="33" r="10" fill="${hood}"/><circle cx="73" cy="33" r="10" fill="${hood}"/><circle cx="27" cy="33" r="5" fill="#e0a21b"/><circle cx="73" cy="33" r="5" fill="#e0a21b"/>`;
  if (p.hair === "frog") back = `<circle cx="33" cy="30" r="11" fill="${hood}"/><circle cx="67" cy="30" r="11" fill="${hood}"/><circle cx="33" cy="29" r="5" fill="#fff"/><circle cx="67" cy="29" r="5" fill="#fff"/><circle cx="33" cy="29" r="2.5" fill="#123"/><circle cx="67" cy="29" r="2.5" fill="#123"/>`;
  if (hood) back += `<circle cx="50" cy="62" r="35" fill="${hood}"/><rect x="15" y="62" width="70" height="40" fill="${hood}"/>`;
  else back += `<path d="M22 100c2-16 13-24 28-24s26 8 28 24Z" fill="${p.hair === "boy" ? "#f4f0e6" : "#fff"}"/>`;
  if (p.hair === "boy") front = `<path d="M25 56c-2-20 12-30 27-29 14 1 24 10 23 26-5-8-12-12-20-12-6 6-17 9-30 15Z" fill="#7a4a24"/><path d="M30 38c-6 2-12 0-16-4 6 0 10-2 14-6Z" fill="#7a4a24"/>`;
  if (p.hair === "bun") front = `<circle cx="50" cy="26" r="8" fill="#1d1414"/><circle cx="50" cy="19" r="3" fill="#ff6fb5"/><path d="M25 58c-1-18 10-28 25-28s26 10 25 28c-6-10-14-14-25-14s-19 4-25 14Z" fill="#1d1414"/>`;
  if (p.hair === "bear" || p.hair === "frog") front = `<path d="M30 52c3-10 10-15 20-15s17 5 20 15c-6-5-12-7-20-7s-14 2-20 7Z" fill="#2a1a12"/>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="av-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect width="100" height="100" fill="url(#av-${id})"/>${back}
    <circle cx="50" cy="62" r="25" fill="${skin}"/>${front}
    <ellipse cx="41" cy="62" rx="6" ry="7" fill="#fff"/><ellipse cx="59" cy="62" rx="6" ry="7" fill="#fff"/>
    <circle cx="42" cy="63" r="4" fill="#3a2214"/><circle cx="58" cy="63" r="4" fill="#3a2214"/>
    <circle cx="43.4" cy="61.4" r="1.4" fill="#fff"/><circle cx="59.4" cy="61.4" r="1.4" fill="#fff"/>
    <circle cx="34" cy="72" r="3.5" fill="#e8737a" opacity=".45"/><circle cx="66" cy="72" r="3.5" fill="#e8737a" opacity=".45"/>
    <path d="M44 75c4 3.5 8 3.5 12 0" stroke="#5a2a1a" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>`;
}

const LOCK_ICON = `<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>`;

function setupProfiles() {
  const me = PROFILES.find((p) => p.me);
  $("#nav-avatar").innerHTML = avatar(me, "nav");
  const gate = $("#profiles");
  let seen = false;
  try { seen = sessionStorage.getItem("entered") === "1"; } catch {}
  if (seen) { gate.remove(); return; }
  document.body.classList.add("locked");

  $("#profile-list").innerHTML = PROFILES.map((p, i) => `
    <button class="profile" type="button" data-profile="${i}">
      <span class="avatar">${avatar(p, i)}${p.me ? `<span class="avatar__lock">${LOCK_ICON}</span>` : ""}${p.kids ? '<span class="avatar__kids">kids</span>' : ""}</span>
      <span class="profile__name">${p.name}</span>
    </button>`).join("") + `
    <button class="profile profile--add" type="button" data-profile="add">
      <span class="avatar" aria-hidden="true">+</span><span class="profile__name">Add Profile</span>
    </button>`;

  const hint = $("#profile-hint");
  const say = (button, text) => {
    hint.textContent = text;
    button.classList.remove("is-shaking");
    void button.offsetWidth;
    button.classList.add("is-shaking");
  };
  const enter = () => {
    try { sessionStorage.setItem("entered", "1"); } catch {}
    gate.classList.add("is-unlocked");
    $("#lock-text").textContent = "Unlocked. Welcome back, Suhani.";
    setTimeout(() => {
      gate.classList.add("is-leaving");
      document.body.classList.remove("locked");
    }, 550);
    setTimeout(() => gate.remove(), 1200);
  };
  $("#profile-list").addEventListener("click", (e) => {
    const b = e.target.closest(".profile");
    if (!b) return;
    const key = b.dataset.profile;
    if (key === "add") return say(b, "One household, one account. Since May 2023, adding someone from outside it costs extra.");
    const p = PROFILES[key];
    if (p.me) return enter();
    say(b, `That's ${p.name === "Sister" ? "my sister" : p.name}'s profile. This site only has Suhani's history.`);
  });
  $("#manage").addEventListener("click", (e) => say(e.currentTarget, "Profiles on this account are managed from home, in Dallas."));
  $(`[data-profile="${PROFILES.indexOf(me)}"]`).focus();
}

// ---------- hero ----------
function setupHero() {
  const yearly = Object.fromEntries(DATA.yearly.map((y) => [y.year, y.views]));
  const full = DATA.yearly.filter((y) => y.year >= 2018 && y.year <= 2023);
  const usual = full.reduce((a, y) => a + y.views, 0) / full.length;
  const drop = Math.round((1 - yearly[2024] / usual) * 100);
  const silence = DATA.gaps[0];
  const after = DATA.windows.after_crackdown;
  const dot = '<span class="dot"></span>';

  $("#hero-meta").innerHTML = ["Documentary", "Coming of Age", "2024", "2 Seasons"].map((x) => `<span>${x}</span>`).join(dot);
  $("#hero-copy").textContent =
    `In May 2023, Netflix started checking whether you watch from the account's home Wi-Fi. ` +
    `At home in Dallas, nothing changed: ${n(after.views)} views by the end of the year. ` +
    `Then 2024 brought ${yearly[2024]}, my lowest year, and after I moved to Austin the screen mostly went dark, ` +
    `except the summers I came home.`;
  $("#hero-badges").innerHTML =
    `<span class="chip"><i></i>${drop}% Fewer Views</span><span class="chip"><i></i>${DATA.profile.senior_spring.views} Views, Senior Spring</span>`;

  // The poster wall drifts, unless the viewer asked for less motion.
  $("#hero-wall").innerHTML = wallHTML();
  const wall = $("#hero-wall .wall");
  const toggle = $("#video-toggle");
  const setPaused = (paused) => {
    wall.classList.toggle("is-paused", paused);
    toggle.classList.toggle("is-paused", paused);
    toggle.setAttribute("aria-label", paused ? "Play the background" : "Pause the background");
  };
  setPaused(matchMedia("(prefers-reduced-motion: reduce)").matches);
  toggle.addEventListener("click", () => setPaused(!wall.classList.contains("is-paused")));

  $("#more-info").addEventListener("click", () => { location.href = "case-study.html"; });
}

function openStory() {
  const yearly = DATA.yearly;
  const max = Math.max(...yearly.map((y) => y.views));
  const t = DATA.totals;
  openModal("The Password Stopped Working", `
    <p class="modal__meta"><span class="match">${n(t.views)} views</span>
      <span>${parse(t.from).getFullYear()}–${parse(t.to).getFullYear()}</span>
      <span class="pill">Documentary</span><span>2 seasons</span></p>
    <div class="modal__grid">
      <div>
        <p class="modal__copy">${esc($("#hero-copy").textContent)}</p>
        <p class="modal__copy">The export can't see why I stopped. It only shows that I did, and that I started again every time I was home.</p>
      </div>
      <div class="modal__side">
        <p><b>Starring:</b> ${DATA.top.slice(0, 4).map((s) => esc(s.show)).join(", ")}</p>
        <p><b>Filmed in:</b> Dallas, Austin</p>
        <p><b>Genres:</b> Coming of Age, Binge-Worthy, Based on a True Story</p>
      </div>
    </div>
    <h4>Views by year</h4>
    <div class="mini">${yearly.map((y) => miniRow(y.year, y.views, max, y.year === 2024)).join("")}</div>`);
}

// ---------- rows ----------
function row(title, sub, items) {
  const id = title.toLowerCase().replace(/\W+/g, "-");
  return `<section class="row" aria-labelledby="${id}">
    <h3 class="row__title" id="${id}">${esc(title)}${sub ? `<span class="row__sub">${esc(sub)}</span>` : ""}</h3>
    <div class="row__track">
      <button class="row__arrow row__arrow--prev" type="button" aria-label="Scroll left">‹</button>
      <div class="row__scroller">${items.join("")}</div>
      <button class="row__arrow row__arrow--next" type="button" aria-label="Scroll right">›</button>
    </div></section>`;
}

const yearsOf = (s) => Object.keys(s.by_year).length;

// The red label under a poster, like "Recently Added", but from my data.
function tagFor(name) {
  const s = DATA.shows[name];
  const owned = DATA.yearly.find((y) => y.show === name && y.year >= 2018);
  if (owned) return `#1 of ${owned.year}`;
  if (s.best_day.episodes >= 10) return `${s.best_day.episodes} in One Day`;
  if (yearsOf(s) >= 4) return "Comfort Show";
  return `${s.views} Episodes`;
}

function comfortShows() {
  return Object.values(DATA.shows)
    .filter((s) => s.kind === "series" && yearsOf(s) >= 3)
    .sort((a, b) => yearsOf(b) - yearsOf(a) || b.views - a.views);
}

// A strip of squares, one per year of my history, lit for every year I watched the show.
function yearStrip(s) {
  const first = parse(DATA.totals.from).getFullYear(), last = parse(DATA.totals.to).getFullYear();
  return `<span class="strip" aria-label="${yearsOf(s)} of ${last - first + 1} years">${Array.from({ length: last - first + 1 }, (_, i) => {
    const y = first + i, eps = s.by_year[y];
    return `<i class="${eps ? "on" : ""}" title="${y}${eps ? `: ${eps} episode${eps === 1 ? "" : "s"}` : ""}"></i>`;
  }).join("")}</span>`;
}

function collection() {
  const shows = comfortShows();
  const first = parse(DATA.totals.from).getFullYear(), last = parse(DATA.totals.to).getFullYear();
  return `<section class="collection" aria-labelledby="collection-title">
    <div class="collection__copy">
      <p class="collection__label">FEATURED COLLECTION</p>
      <h3 class="collection__title" id="collection-title">The Ones That<br>Never Left</h3>
      <p class="collection__text">Every square is a year, ${first} to ${last}. ${esc(shows[0].show)} lit up ${yearsOf(shows[0])} of them.</p>
      <button class="btn btn--light" type="button" id="explore">Explore All</button>
    </div>
    <div class="collection__tiles">${shows.slice(0, 3).map((s) => `
      <div class="never">${tile(s.show)}<div class="never__foot">${yearStrip(s)}<b>${yearsOf(s)} yrs</b></div></div>`).join("")}</div>
  </section>`;
}

function openComfort() {
  const shows = comfortShows().slice(0, 12);
  openModal("The Ones That Never Left", `
    <p class="modal__meta"><span class="match">Featured Collection</span><span>${shows.length} shows</span></p>
    <p class="modal__copy">The shows I keep coming back to. Each square is a year; lit means I watched it that year.</p>
    <div class="never-list">${shows.map((s) => `
      <button class="never-list__row" type="button" data-show="${esc(s.show)}"><span>${esc(s.show)}</span>${yearStrip(s)}<b>${yearsOf(s)}</b></button>`).join("")}</div>`);
}

function setupRows() {
  const { top, yearly, windows } = DATA;
  const html = [
    row("Top 10 Shows in Suhani's Life", "", top.map((s, i) =>
      `<div class="top10"><span class="top10__num" aria-hidden="true">${i + 1}</span>${tile(s.show, `<span class="tag">${esc(tagFor(s.show))}</span>`, { tall: true })}</div>`)),
    collection(),
    row("Watch Me Grow Up", "my #1 show at every age", yearly.map((y) =>
      tile(y.show, `<span class="tile__ribbon">AGE<b>${y.year - BIRTH_YEAR}</b></span><span class="tile__meta tile__meta--left">${y.year} · ${y.episodes} eps</span>`))),
    row("Home for Summer & Absolutely Starving", `a whole year of college, then ${n(windows.summer_2025.views)} views in two months`, windows.summer_2025.top.map((s) =>
      tile(s.show, `<span class="tile__meta">${s.views} eps</span>`))),
  ];
  const rows = $("#rows");
  rows.innerHTML = html.join("");
  $("#explore").addEventListener("click", openComfort);
  const comfortBg = comfortShows().map((x) => ART[x.show]?.backdrop).find(Boolean);
  if (comfortBg) $(".collection").style.setProperty("--collection-bg", `url('${new URL(comfortBg, location.href).href}')`);

  wireRows(rows);
}

function wireRows(root) {
  root.querySelectorAll(".row__track").forEach((track) => {
    const scroller = $(".row__scroller", track);
    const prev = $(".row__arrow--prev", track);
    const next = $(".row__arrow--next", track);
    const update = () => {
      prev.disabled = scroller.scrollLeft < 4;
      next.disabled = scroller.scrollLeft + scroller.clientWidth > scroller.scrollWidth - 4;
    };
    prev.addEventListener("click", () => scroller.scrollBy({ left: -scroller.clientWidth * .85, behavior: "smooth" }));
    next.addEventListener("click", () => scroller.scrollBy({ left: scroller.clientWidth * .85, behavior: "smooth" }));
    scroller.addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    update();
  });
}

// ---------- hover preview ----------
function setupPreview() {
  if (!matchMedia("(hover: hover)").matches) return;
  const card = document.createElement("div");
  card.className = "preview";
  card.hidden = true;
  document.body.appendChild(card);
  let timer, current;

  const hide = () => { clearTimeout(timer); card.hidden = true; current = null; };
  const show = (t) => {
    const name = t.dataset.show;
    const s = DATA.shows[name];
    if (!s) return;
    const y1 = parse(s.first).getFullYear(), y2 = parse(s.last).getFullYear();
    const tags = [
      s.eras.Dallas && s.eras.Austin ? "Dallas & Austin" : s.eras.Austin ? "Austin" : "Dallas",
      s.binge_days ? "Binge-Worthy" : null,
      yearsOf(s) >= 4 ? "Comfort Show" : null,
      s.kind === "movie" ? "One Sitting" : null,
    ].filter(Boolean);
    const icon = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="currentColor"/></svg>`;
    card.innerHTML = `
      <div class="preview__art">${art(name)}</div>
      <div class="preview__body">
        <div class="preview__buttons">
          <button class="round round--play" type="button" data-show="${esc(name)}" aria-label="Open ${esc(name)}">${icon("M8 5v14l11-7z")}</button>
          <button class="round round--more" type="button" data-show="${esc(name)}" aria-label="More about ${esc(name)}">${icon("M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z")}</button>
        </div>
        <p class="preview__meta"><span>${s.kind === "movie" ? "Movie" : "Series"}</span>
          <span class="pill">${n(s.views)} ${s.kind === "movie" ? "view" : "eps"}</span>
          <span>${y1 === y2 ? y1 : `${y1}–${y2}`}</span><span class="pill">HD</span></p>
        <p class="preview__tags">${tags.map((x) => `<span>${x}</span>`).join('<span class="dot"></span>')}</p>
      </div>`;
    const r = t.getBoundingClientRect();
    const w = Math.max(r.width * 1.45, 320);
    card.style.width = `${w}px`;
    card.hidden = false;
    const left = Math.min(Math.max(r.left + r.width / 2 - w / 2, 12), innerWidth - w - 12);
    const top = Math.min(Math.max(r.top + r.height / 2 - card.offsetHeight / 2, 12), innerHeight - card.offsetHeight - 12);
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    current = t;
  };

  document.addEventListener("pointerover", (e) => {
    const t = e.target.closest(".tile");
    if (t && t !== current && !t.closest(".preview")) {
      clearTimeout(timer);
      timer = setTimeout(() => show(t), 500);
    }
  });
  document.addEventListener("pointerout", (e) => {
    const from = e.target.closest(".tile, .preview");
    const to = e.relatedTarget?.closest?.(".tile, .preview");
    if (from && !to) { clearTimeout(timer); timer = setTimeout(hide, 150); }
    else if (to) clearTimeout(timer);
  });
  addEventListener("scroll", hide, { passive: true });
  card.addEventListener("click", hide);
}

// ---------- the case file ----------
// A small monthly bar chart of my views over a window, with the months that make the point in red.
function spark({ from, to, hot = [] }) {
  const months = DATA.monthly.filter((m) => m.month >= from && m.month <= to);
  const max = Math.max(...months.map((m) => m.views), 1);
  return `<div class="spark" role="img" aria-label="Views per month, ${fmtMonth(from)} to ${fmtMonth(to)}">${months.map((m) =>
    `<span class="spark__col${hot.includes(m.month) ? " is-hot" : ""}" title="${fmtMonth(m.month)}: ${m.views} views"><i style="height:${Math.max(m.views / max * 100, 2)}%"></i></span>`).join("")}
    <span class="spark__axis"><b>${fmtMonth(from)}</b><b>${fmtMonth(to)}</b></span></div>`;
}

// Guesses a stranger could make from nothing but my history, each with its signal and evidence.
function setupCase() {
  const p = DATA.profile;
  $("#case-count").textContent = n(DATA.totals.views);
  const { elementary: el, middle: ms, high: hs, after } = Object.fromEntries(DATA.life.map((e) => [e.key, e]));
  const bg = (show) => ART[show]?.backdrop || ART[show]?.poster || FALLBACK_BG();
  const pct = (x) => `${Math.round(x)}%`;
  const hf = p.hindi_films;
  const share = (e) => pct((e.hindi / e.movies) * 100);
  const decRate = (p.december.after_20 / 12) / (p.december.before_20 / 19);
  const silence = DATA.gaps[0];
  const dallasGap = DATA.gaps.find((g) => g.from.startsWith("2020"));
  const groups = [
    ["Who I am", [
      { label: "AGE", img: bg(p.kids_early_top[0]), guess: "A kid in 2015. A college student now.", signal: "Who the shows are made for",
        ev: `Kids' shows were <b>${pct(p.kids_by_year["2016"])}</b> of 2016 (${listOf(p.kids_early_top)}), ${pct(p.kids_by_year["2018"])} of 2018 and almost nothing after 2019. Then teen rom-coms: ${listOf(p.teen_romcoms.slice(0, 3))}. A fourth-grader in 2015 graduates in 2024.` },
      { label: "GENDER", img: bg("Bridgerton"), guess: "A woman", signal: "What I choose",
        ev: `<b>${pct(p.romance_share)}</b> of my series episodes are tagged Romance, and most of my movies are rom-coms. This is how ad platforms guess gender: crudely.` },
      { label: "CULTURAL BACKGROUND", img: bg("Heeramandi"), guess: "Indian, Hindi-speaking", signal: "The language of what I watch",
        ev: `<b>${hf.total} of my ${hf.movies} movies</b> are Hindi films, starting with ${esc(hf.first)} in ${parse(hf.first_date).getFullYear()}. Hindi series went from ${pct(ms.language.Hindi || 0)} in middle school to <b>${pct(after.language.Hindi || 0)}</b> after graduating.` },
      { label: "HOME", img: bg("AMERICA'S SWEETHEARTS"), guess: "The U.S., probably Texas", signal: "Format, timing and one docuseries",
        ev: `US-style dates and a slump that lines up with Netflix's US password crackdown. America's Sweethearts: Dallas Cowboys Cheerleaders is a hint, not proof.` },
    ]],
    ["How I live", [
      { label: "ROUTINE", img: bg("Gilmore Girls"), guess: "A student", signal: "When I watch",
        ev: `Weekdays are <b>${pct(p.weekday_share.school)}</b> of my school-year watching and ${pct(p.weekday_share.summer)} in summer. The last 12 days of December average <b>${decRate.toFixed(1)}×</b> the first 19: finals, then winter break.` },
      { label: "MARCH 2020", img: bg(p.covid.top), guess: "Sent home when COVID hit", signal: "A sudden spike",
        ev: `February 2020: ${p.covid.feb_2020} views. March: <b>${p.covid.march_2020}</b>, ${p.covid.after_closure} of them after schools closed on March 13, mostly ${esc(p.covid.top)}.` },
      { label: "GRADUATION", img: bg(DATA.windows.last_summer_home.top[0].show), guess: "Graduated in spring 2024", signal: "The quietest six months",
        ev: `January to June 2024: <b>${p.senior_spring.views} views on ${p.senior_spring.days} days</b>, against about ${Math.round(hs.per_month)} a month the rest of high school. Senior spring. Then a summer back on the couch.` },
      { label: "COLLEGE", img: bg(DATA.windows.summer_2025.top[0].show), guess: "Left home for college in 2024", signal: "Semesters against summers",
        ev: `Fall 2024: <b>${p.college.fall_2024}</b> views a day. Summer 2025, back home: <b>${p.college.summer_2025}</b>, ten times more. Fall 2025: ${p.college.fall_2025} again.` },
    ]],
    ["Who I live with", [
      { label: "MOVED", img: bg(el.top[0].show), guess: "New to America in 2015", signal: "When the history starts",
        ev: `The account's very first play: <b>${esc(p.first_title)}</b>, ${fmtDate(DATA.totals.from)}. Then a summer of Disney Channel. (We had just moved from Singapore to Cupertino.)` },
      ...(dallasGap ? [{ label: "MOVED AGAIN", img: bg(hs.top[0].show), guess: "A second move, summer 2020", signal: "A silence right before high school",
        ev: `<b>${dallasGap.days} days</b> with nothing, ${fmtShort(dallasGap.from)} to ${fmtDate(dallasGap.to)}, one of the longest gaps in my history. That was the move from Cupertino to Dallas. High school started in Texas.` }] : []),
      { label: "FAMILY", img: bg("Masha and the Bear"), guess: "A younger sibling", signal: "Shows made for someone smaller",
        ev: p.masha ? `Masha and the Bear, a preschool cartoon, <b>${p.masha.views} episodes</b> in ${parse(p.masha.first).getFullYear()}, when my little sister was about two. Someone small was borrowing my profile.` : "" },
      { label: "HOUSEHOLD", img: bg("Fuller House"), guess: "A shared family account", signal: "What happened when I left",
        ev: `When I moved out, my watching collapsed, and it came back every time I was home. That's what happens when the account belongs to a house, not to you.` },
      { label: "RELATIONSHIP STATUS", img: bg("The Vampire Diaries"), guess: "Single, at least in 2019", signal: "Valentine's Day",
        ev: p.valentines.length ? `The only Valentine's Day in ${parse(DATA.totals.to).getFullYear() - parse(DATA.totals.from).getFullYear()} years with anything on: ${fmtDate(p.valentines[0].date)}, <b>${esc(p.valentines[0].show)}</b>, ${p.valentines.length === 2 ? "twice" : `${p.valentines.length} times`}.` : "" },
      { label: "HOMESICK", img: bg("The Great Indian Kapil Show"), guess: "Homesick, in Hindi", signal: "Hindi when I'm away vs home",
        ev2: `In college, Hindi is <b>${pct(p.hindi_away)} of my series when I'm away</b> and ${pct(p.hindi_home)} when I'm home for summer. The Great Indian Kapil Show: ${p.kapil_away} episodes away, ${p.kapil_home} at home.`,
        ev: `Hindi films were ${share(hf.by_era[1])} of my movies in middle school, ${share(hf.by_era[2])} in high school and ${share(hf.by_era[3])} after. Winter break, January 2026: <b>${p.jan_2026.movies} movies, ${p.jan_2026.hindi} of them Hindi</b>.` },
    ]],
  ];
  const fr = p.friends_race;
  const finished = p.finished.slice(0, 6).map((f) => f.show);
  groups.push(["More", [
    { label: "A FINISHER", img: bg("The Vampire Diaries"), guess: `${p.finished.length} shows, start to finish`, signal: "Episodes watched against episodes made",
      ev: `Every episode, or nearly: ${listOf(finished)}. Friends: <b>${fr.watched} of ${fr.total}</b>.` },
    { label: "A TV PERSON", img: bg("Grey's Anatomy"), guess: "Episodes, not movies", signal: "What I press play on",
      ev: `<b>${pct(p.series_share)}</b> of everything I've watched is an episode. <b>${p.big_days} days</b> with 10 or more.` },
    { label: "U.S. CATALOG", img: bg("Friends"), guess: "Watching U.S. Netflix", signal: "A deadline only U.S. viewers had",
      chart: { from: "2019-09", to: "2020-03", hot: ["2019-11", "2019-12"] },
      ev: `Friends left U.S. Netflix on Jan 1, 2020. I watched <b>${fr.december} episodes that December</b>, ${fr.last_week} of them in the last week. Then nothing.` },
    ...(fr.jan1 ? [{ label: "DENIAL", img: bg("Friends"), guess: "I didn't want Friends to leave", signal: "Its last night on U.S. Netflix",
      ev: `On Dec 31, 2019, Friends' last night on U.S. Netflix, one of my last episodes was <b>"${esc(fr.nye_last || "")}"</b>. The export still shows <b>${fr.jan1} more on Jan 1, 2020</b>: Netflix logs dates in UTC, so that's me past midnight, refusing to let go.` }] : []),
    { label: "SCARE THRESHOLD", img: bg("Stranger Things"), guess: "Spooky, never scary", signal: "What horror I actually watch",
      ev: `Goosebumps literally gave me goosebumps. That's the line. Everything tagged horror in my history is spooky-for-teens: ${listOf(p.spooky.slice(0, 4).map((x) => `${esc(x.show)} (${x.views})`))}. ${p.horror_films.length === 1 ? `Real horror, ever: <b>${esc(p.horror_films[0].show)}</b>. It scared me and I quit it.` : `Real horror films, ever: <b>${p.horror_films.length}</b>.`}` },
    { label: "BIRTHDAY", img: bg("Bridgerton"), guess: "Born in early March", signal: "What I watch on one date every year",
      ev: `March 6, 2026, my 20th birthday: Bridgerton and Queen Charlotte, back to back.` },
    { label: "HOLIDAYS", img: bg("Gilmore Girls"), guess: "Home for Christmas", signal: "December 24–26",
      ev: `Something on over Christmas in <b>${p.christmas_years} of ${parse(DATA.totals.to).getFullYear() - parse(DATA.totals.from).getFullYear()} years</b>, mostly a winter-break binge.` },
  ]]);
  // My family agreed to share these: aggregates only, no names or dates.
  const fam = DATA.family;
  if (fam) {
    const q = Object.entries(fam.pilot_quitters);
    const k = fam.kapil;
    groups.push(["Family", [
      { label: "PILOT QUITTERS", img: bg(DATA.top[0].show), guess: `${q.at(-1)[0]} finishes what she starts`, signal: "Shows quit after one episode",
        ev: q.map(([w, n], i) => i === 0 ? `<b>${w}: ${n}</b>` : `${w}: ${n}`).join(" · ") + `. ${q[0][0]} samples everything; ${q.at(-1)[0]} commits.` },
      { label: "THE FAMILY SHOW", img: bg("The Great Indian Kapil Show"), guess: "The Great Indian Kapil Show", signal: "The one show Mom and I share most",
        ev: `Mom: <b>${k.Mom || 0}</b> episodes. Me: <b>${k.Me || 0}</b>. We watched it on the same day ${fam.kapil_same_day} times.${k.Dad ? ` Dad: ${k.Dad}.` : ""}` },
      ...(fam.dad_sister_birthday_picks.length ? [{ label: "DAD'S PARTY PICKS", img: bg(DATA.top[2].show), guess: "Birthday-party energy", signal: "What Dad watched on my sister's birthdays",
        ev: `On my little sister's birthdays, Dad's picks: <b>${listOf(fam.dad_sister_birthday_picks.map(esc))}</b>. Happy birthday!` }] : []),
    ]]);
  }
  // Charts for the place clues
  const charts = {
    MOVED: { from: "2015-05", to: "2016-02", hot: ["2015-06", "2015-07"] },
    "MOVED AGAIN": { from: "2020-04", to: "2021-01", hot: ["2020-08", "2020-09"] },
    COLLEGE: { from: "2024-06", to: "2026-09", hot: ["2025-06", "2025-07", "2026-06", "2026-07"] },
  };
  groups.forEach(([, clues]) => clues.forEach((c) => { if (charts[c.label]) c.chart = charts[c.label]; }));
  // Regroup the clues by theme.
  const byLabel = Object.fromEntries(groups.flatMap(([, clues]) => clues).map((c) => [c.label, c]));
  const themed = [
    ["Who I am", ["AGE", "GENDER", "CULTURAL BACKGROUND", "A FINISHER", "A TV PERSON", "BIRTHDAY"]],
    ["Where I've lived", ["MOVED", "MOVED AGAIN", "U.S. CATALOG", "COLLEGE"]],
    ["How I live", ["ROUTINE", "MARCH 2020", "GRADUATION", "HOLIDAYS"]],
    ["Who I live with", ["HOUSEHOLD", "PILOT QUITTERS", "THE FAMILY SHOW", "DAD'S PARTY PICKS", "FAMILY"]],
    ["How I feel", ["HOMESICK", "DENIAL", "SCARE THRESHOLD", "RELATIONSHIP STATUS"]],
  ].map(([title, labels]) => [title, labels.map((l) => byLabel[l]).filter(Boolean)]);
  $("#case-groups").innerHTML = themed.map(([title, clues]) => `
    <h4 class="case__group">${title}</h4>
    <div class="clues">${clues.filter((c) => c.ev).map((c) => `
      <article class="clue">
        <div class="clue__img" style="background-image:url('${c.img}')"><span class="clue__label">${c.label}</span></div>
        <div class="clue__body">
          <p class="clue__guess">${esc(c.guess)}</p>
          <p class="clue__signal">Signal: ${esc(c.signal)}</p>
          ${c.chart ? spark(c.chart) : ""}
          <p class="clue__evidence">${c.ev2 || c.ev}</p>
        </div>
      </article>`).join("")}</div>`).join("");
}

// ---------- growing up ----------
// Three eras of the same profile, and the shifts between them. Every number comes from
// data/site.json (genres and languages are TVmaze's, counted over series episodes).
function setupGrowth() {
  const { elementary: el, middle: ms, high: hs, after } = Object.fromEntries(DATA.life.map((e) => [e.key, e]));
  const pct = (x) => `${Math.round(x || 0)}%`;
  const g = (era, k) => era.genres[k] || 0;
  const l = (era, k) => era.language[k] || 0;
  const t = (era, k) => era.type[k] || 0;
  const span = (e) => `${fmtMonth(e.from.slice(0, 7))} – ${e.key === "after" ? "now" : fmtMonth(e.to.slice(0, 7))}`;
  const who = {
    elementary: `<b>New in America.</b> We moved from Singapore to Cupertino in 2015, right before fourth grade. I learned America through Disney Channel: ${listOf(el.top.slice(0, 3).map((s) => s.show))}. On Dad's profile, because I didn't have one yet.`,
    middle: `<b>The family-drama kid.</b> Still in Cupertino. Freeform and Disney after school, ${pct(g(ms, "Family"))} family shows, ${pct(l(ms, "English"))} in English, and nearly all of Friends over one winter break.`,
    high: `<b>The serious-drama era.</b> Drama went from ${pct(g(ms, "Drama"))} to ${pct(g(hs, "Drama"))} of what I watched: hospitals, crime, Stars Hollow. I tried ${hs.titles} different titles, ${(hs.titles / ms.titles).toFixed(1)}× middle school.`,
    after: `<b>Missing home, in Hindi.</b> After graduating, Hindi shows went from ${pct(l(hs, "Hindi"))} to ${pct(l(after, "Hindi"))}. Talk shows, new releases and movies over long commitments.`,
  };
  const stats = {
    elementary: [[pct(g(el, "Family")), "family shows"], [el.views, "views on Dad's profile"], [el.titles_per_month, "new titles / month"]],
    middle: [[pct(g(ms, "Family")), "family shows"], [ms.titles_per_month, "new titles / month"], [pct(ms.classic_share), "older than me"]],
    high: [[pct(g(hs, "Drama")), "drama"], [pct(g(hs, "Medical") + g(hs, "Crime")), "medical + crime"], [hs.titles_per_month, "new titles / month"]],
    after: [[pct(l(after, "Hindi")), "in Hindi"], [after.median_premiere, "typical premiere"], [pct(after.movie_share), "movies"]],
  };
  const bg = (era) => { const s = era.top.find((x) => ART[x.show]?.backdrop); return s ? ART[s.show].backdrop : FALLBACK_BG(); };
  $("#eras3").innerHTML = DATA.life.map((e, i) => `
    <article class="era">
      <div class="era__bg" style="background-image:url('${bg(e)}')"></div>
      <div class="era__body">
        <p class="era__season">Season ${i + 1}</p>
        <h4 class="era__name">${e.name}</h4>
        <p class="era__years">${span(e)} · ${n(e.views)} views</p>
        <p class="era__who">${who[e.key]}</p>
        <p class="era__stats">${stats[e.key].map(([v, k]) => `<span><b>${v}</b> ${k}</span>`).join("")}</p>
        <div class="era__posters">${e.top.slice(0, 5).map((s) => tile(s.show, "", { tall: true, mark: false })).join("")}</div>
      </div>
    </article>`).join("");

  setupWhatChanged({ g, l, t, pct });
}

// What changed, shown with the shows themselves: one Netflix row per change. Each era opens with a card
// carrying its number, followed by that era's shows behind it.
function setupWhatChanged({ g, l, t, pct }) {
  const eras = DATA.life;
  const ex = (key) => (e) => e.examples[key] || [];
  const stories = [
    { title: "Missing Home, in Hindi", unit: "of my series in Hindi", value: (e) => l(e, "Hindi"), shows: ex("hindi") },
    { title: "Growing Out of Family TV", unit: "family shows", value: (e) => g(e, "Family"), shows: ex("family") },
    { title: "High School Got Serious", unit: "drama", value: (e) => g(e, "Drama"), shows: ex("drama") },
    { title: "Hospitals and Crime", unit: "medical + crime", value: (e) => g(e, "Medical") + g(e, "Crime"), shows: ex("medical_crime") },
    { title: "Laughing With Talk Shows", unit: "talk shows", value: (e) => t(e, "Talk Show"), shows: ex("talk") },
    { title: "Watching What's New", unit: "typical premiere year", value: (e) => e.median_premiere, year: true,
      shows: (e) => e.by_premiere.slice(-4).reverse().map((x) => ({ show: x.show, tag: x.year })) },
  ];
  const fmt = (st, v) => (st.year ? String(v) : pct(v));
  const label = (e) => (e.key === "after" ? "College" : e.name);
  $("#wc").innerHTML = stories.map((st) => {
    const vals = eras.map(st.value);
    const peak = st.year ? vals.length - 1 : vals.indexOf(Math.max(...vals));
    const items = eras.flatMap((e, i) => {
      const v = vals[i];
      const shows = (st.year || v >= 1 ? st.shows(e) : []).slice(0, 4);
      const card = `<div class="eracard${i === peak ? " is-peak" : ""}">
        <span class="eracard__era">${label(e)}</span>
        <span class="eracard__num">${fmt(st, v)}</span>
        <span class="eracard__unit">${esc(st.unit)}</span></div>`;
      const tiles = shows.length ? shows.map((x) => tile(x.show, x.tag ? `<span class="tile__meta">${x.tag}</span>` : "")) :
        [`<div class="eracard eracard--none"><span>None yet</span></div>`];
      return [card, ...tiles];
    });
    return row(st.title, vals.map((v, i) => (i === vals.length - 1 ? fmt(st, v) : fmt(st, v))).join(" → "), items);
  }).join("");
  wireRows($("#wc"));
}

// ---------- the broken home ----------
// One household, drawn as a house of rooms with a screen in each. Scrolling pulls it apart,
// and my phone drifts off to Austin.
function houseFace(cx, cy, s, cls = "") {
  return `<g class="${cls}"><circle cx="${cx - s * .2}" cy="${cy - s * .12}" r="${s * .075}" fill="#fff"/><circle cx="${cx + s * .2}" cy="${cy - s * .12}" r="${s * .075}" fill="#fff"/>
    <path d="${cls === "face-sad" ? `M${cx - s * .2} ${cy + s * .26}Q${cx} ${cy + s * .04} ${cx + s * .2} ${cy + s * .26}` : `M${cx - s * .2} ${cy + s * .1}Q${cx} ${cy + s * .32} ${cx + s * .2} ${cy + s * .1}`}"
      stroke="#fff" stroke-width="${s * .07}" fill="none" stroke-linecap="round"/></g>`;
}

function houseScreen(x, y, w, h, me = false) {
  const s = Math.min(w, h) * .42, cx = x + w / 2, cy = y + h / 2;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="#262626" stroke="#7a7a7a" stroke-width="3"/>
    <rect x="${x + 6}" y="${y + 6}" width="${w - 12}" height="${h - 12}" rx="3" fill="url(#scr)"/>
    <rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" rx="${s * .12}" fill="#e50914" filter="url(#glow)"/>
    ${me ? houseFace(cx, cy, s, "face-happy") + houseFace(cx, cy, s, "face-sad") : houseFace(cx, cy, s)}`;
}

function houseSVG() {
  const room = (id, pts, grad, device, extra = "") => `
    <g class="piece ${extra}" data-piece="${id}"><g class="bob">
      <polygon points="${pts}" fill="url(#${grad})"/>
      <polygon points="${pts}" fill="#000" filter="url(#grain)"/>
      ${device}
      <polygon points="${pts}" fill="none" stroke="#e50914" stroke-width="7" stroke-linejoin="round"/>
    </g></g>`;
  // Cracks run along the seams the house will split on.
  const zigzag = ([x1, y1], [x2, y2], step = 26, amp = 7) => {
    const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(2, Math.round(len / step));
    const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
    const pts = Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n, o = i === 0 || i === n ? 0 : (i % 2 ? amp : -amp) * (0.6 + ((i * 37) % 5) / 10);
      return `${(x1 + (x2 - x1) * t + nx * o).toFixed(1)},${(y1 + (y2 - y1) * t + ny * o).toFixed(1)}`;
    });
    return `<polyline points="${pts.join(" ")}" pathLength="1"/>`;
  };
  const hubEdge = (x, y) => { const a = Math.atan2(y - 560, x - 450); return [450 + 138 * Math.cos(a), 560 + 138 * Math.sin(a)]; };
  const cracks = [[140, 400], [300, 162], [600, 162], [760, 400]].map((p) => zigzag(hubEdge(...p), p))
    .concat([zigzag([140, 255], [450, 75], 30, 6), zigzag([450, 75], [760, 255], 30, 6)]).join("");
  const wifi = [22, 40, 58].map((r) =>
    `<path d="M${450 - r * .707} ${528 - r * .707}A${r} ${r} 0 0 1 ${450 + r * .707} ${528 - r * .707}" stroke="#e50914" stroke-width="9" fill="none" stroke-linecap="round"/>`).join("");
  return `<svg viewBox="-80 -60 1080 790" role="img" aria-label="A house of screens, one in each room, breaking apart as my phone moves away">
    <defs>
      <linearGradient id="hg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6a2fa0"/><stop offset="1" stop-color="#1c0f33"/></linearGradient>
      <linearGradient id="hg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f4f8f"/><stop offset=".6" stop-color="#26305e"/><stop offset="1" stop-color="#3a1640"/></linearGradient>
      <linearGradient id="hg3" x1=".5" y1="0" x2=".5" y2="1"><stop offset="0" stop-color="#7d0f1a"/><stop offset=".55" stop-color="#c3121d"/><stop offset="1" stop-color="#3b070c"/></linearGradient>
      <linearGradient id="hg4" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a3245e"/><stop offset="1" stop-color="#3a0d26"/></linearGradient>
      <linearGradient id="hg5" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d7d6b"/><stop offset="1" stop-color="#10302b"/></linearGradient>
      <linearGradient id="scr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3a3a"/><stop offset="1" stop-color="#101010"/></linearGradient>
      <filter id="grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0" result="a"/>
        <feComposite in="a" in2="SourceGraphic" operator="in"/>
      </filter>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>

    <g class="whole">
    <g class="piece" data-piece="chimney"><g class="bob"><rect x="636" y="104" width="38" height="80" fill="#e50914"/></g></g>
    ${room("r2", "450,560 140,400 140,255 300,162", "hg2",
      houseScreen(178, 292, 132, 86) + `<rect x="236" y="378" width="16" height="22" fill="#555"/><rect x="214" y="398" width="60" height="7" rx="3" fill="#555"/>`)}
    ${room("r3", "450,560 300,162 450,75 600,162", "hg3",
      houseScreen(368, 168, 164, 104) + `<path d="M392 272l-8 14M508 272l8 14" stroke="#777" stroke-width="5"/>`)}
    ${room("r4", "450,560 600,162 760,255 760,400", "hg4", houseScreen(598, 306, 112, 76))}
    ${room("r1", "450,560 140,560 140,400", "hg1",
      houseScreen(178, 462, 104, 64) + `<path d="M168 528h124l10 12H158Z" fill="#555"/>`)}
    ${room("r5", "450,560 760,400 760,560", "hg5",
      houseScreen(676, 446, 50, 90, true) + `<path d="M712 520c10-4 22 4 24 18l4 22h-34Z" fill="#1d4b63"/>`, "me")}
    <g class="piece" data-piece="hub">
      <path d="M318 560A132 132 0 0 1 582 560Z" fill="#171717" stroke="#e50914" stroke-width="7"/>
      <path d="M318 560A132 132 0 0 1 582 560Z" fill="#000" filter="url(#grain)"/>
      <g class="wifi">${wifi}<circle cx="450" cy="528" r="8" fill="#e50914"/></g>
    </g>
    <g class="piece" data-piece="roof"><g class="bob"><path d="M92 266 450 50 808 266" fill="none" stroke="#e50914" stroke-width="28" stroke-linejoin="miter"/></g></g>
    <g class="cracks">${cracks}</g>
    </g>

    <text class="place" x="450" y="626" text-anchor="middle">DALLAS</text>
    <g class="warning"><text x="880" y="455" text-anchor="middle" fill="#fff" font-size="17" font-weight="700">Not part of</text>
      <text x="880" y="477" text-anchor="middle" fill="#fff" font-size="17" font-weight="700">the household</text></g>
    <text class="place place--austin" x="880" y="712" text-anchor="middle">AUSTIN</text>
  </svg>`;
}

const PIECE_MOVES = {
  chimney: [80, -210, 30], roof: [0, -140, -6], r1: [-150, 70, -12], r2: [-190, -60, -9],
  r3: [0, -95, 5], r4: [165, -60, 10], r5: [215, 105, 14], hub: [0, 0, 0],
};

function setupHouse() {
  const section = $("#house");
  $("#house-art").innerHTML = houseSVG();
  const { dates, windows: w, monthly } = DATA;
  const july = monthly.find((m) => m.month === "2025-07");
  const steps = [
    `<q>A Netflix account is for use by one household.</q> Starting ${fmtDate(dates.crackdown)}, Netflix emailed members sharing outside of theirs.`,
    `Ours was in Dallas: four profiles, every screen under one roof. For me nothing changed: <b>${n(w.after_crackdown.views)} views</b> from that day to the end of 2023.`,
    `On <b>${fmtDate(dates.austin)}</b> I moved to Austin, and my screen left the house. My first semester: <b>${w.first_semester.views} views</b>. It only came back together when I went home: <b>${july.views} in July 2025</b>.`,
  ];
  $("#house-steps").innerHTML = steps.map((s) => `<p class="house__step">${s}</p>`).join("");
  $(".house__copy").insertAdjacentHTML("beforeend", '<button class="house__replay" type="button" id="house-replay">↻ Watch it break again</button>');
  const stepEls = [...section.querySelectorAll(".house__step")];
  section.querySelectorAll(".piece").forEach((el, i) => {
    const [dx, dy, rot] = PIECE_MOVES[el.dataset.piece];
    el.style.setProperty("--dx", `${dx}px`);
    el.style.setProperty("--dy", `${dy}px`);
    el.style.setProperty("--r", `${rot}deg`);
    el.style.setProperty("--i", i);
  });

  // Stages: whole → cracking (seams draw in, a rumble) → broken (a hard shake, then the rooms fly apart).
  let stage = -1;
  const setStage = (next) => {
    if (next === stage) return;
    stage = next;
    section.classList.toggle("is-cracking", stage >= 1);
    section.classList.toggle("is-broken", stage >= 2);
  };
  let queued = false;
  const update = () => {
    queued = false;
    const r = section.getBoundingClientRect();
    const p = Math.min(Math.max(-r.top / (r.height - innerHeight), 0), 1);
    const step = p < .28 ? 0 : p < .55 ? 1 : 2;
    stepEls.forEach((el, i) => el.classList.toggle("is-on", i === step));
    setStage(step);
  };
  $("#house-replay").addEventListener("click", () => {
    section.classList.remove("is-broken", "is-cracking");
    void section.offsetWidth;
    section.classList.add("is-cracking");
    setTimeout(() => section.classList.add("is-broken"), 1100);
  });
  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  update();
}

// ---------- the player ----------
// Play runs the story as short films built from my data: my own poster wall, the shows' art,
// and my numbers, with Netflix-style controls. Episode 1 is the household; episode 2 is me growing up.
const posterOf = (show) => ART[show]?.poster;
const backdropOf = (show) => ART[show]?.backdrop || ART[show]?.poster || FALLBACK_BG();

// The cold open: me on my dorm bed in Austin, and the screen every college student dreaded.
function dormSVG() {
  const lights = Array.from({ length: 22 }, (_, i) => {
    const x = 40 + i * 72, y = 70 + Math.sin(i / 1.6) * 18;
    return `<circle class="dorm__light" style="--i:${i}" cx="${x}" cy="${y}" r="7" fill="#ffd27a"/>`;
  }).join("");
  return `<svg class="dorm" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="dwall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d1833"/><stop offset="1" stop-color="#0c0a15"/></linearGradient>
      <radialGradient id="dglow" cx=".72" cy=".33" r=".55"><stop offset="0" stop-color="#e50914" stop-opacity=".45"/><stop offset="1" stop-color="#e50914" stop-opacity="0"/></radialGradient>
      <linearGradient id="dscreen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5a0f1c"/><stop offset=".6" stop-color="#2a0710"/><stop offset="1" stop-color="#141026"/></linearGradient>
      <linearGradient id="dblanket" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6d3fa8"/><stop offset="1" stop-color="#3b1f66"/></linearGradient>
    </defs>
    <rect width="1600" height="900" fill="url(#dwall)"/>
    <rect width="1600" height="900" fill="url(#dglow)" class="dorm__glow"/>
    <path d="M0 60 Q400 110 800 70 T1600 80" fill="none" stroke="#3a3350" stroke-width="3"/>${lights}
    <g transform="translate(150 170)"><path d="M0 0 L180 40 L0 80 Z" fill="#bf5700"/><text x="22" y="48" font-size="26" font-weight="800" fill="#fff" font-family="Inter, sans-serif">AUSTIN</text></g>
    <rect x="110" y="300" width="250" height="190" rx="8" fill="#0a1426" stroke="#3a3350" stroke-width="10"/>
    <circle cx="300" cy="350" r="26" fill="#f4e9c8" opacity=".85"/><circle cx="170" cy="340" r="2.5" fill="#fff"/><circle cx="220" cy="400" r="2" fill="#fff"/><circle cx="330" cy="440" r="2" fill="#fff"/>
    <g class="dorm__tv">
      <rect x="840" y="150" width="660" height="390" rx="14" fill="#0b0b0b"/>
      <rect x="860" y="168" width="620" height="354" rx="6" fill="url(#dscreen)" class="dorm__screen"/>
      <g class="dorm__msg" font-family="Inter, sans-serif" text-anchor="middle">
        <text x="1170" y="290" font-size="34" font-weight="800" fill="#fff">Your TV isn't part of the</text>
        <text x="1170" y="334" font-size="34" font-weight="800" fill="#fff">household for this account</text>
        <text x="1170" y="372" font-size="17" fill="#ddd">Create an account to keep watching.</text>
        <rect x="1080" y="392" width="180" height="40" rx="5" fill="#fff"/><text x="1170" y="418" font-size="16" font-weight="700" fill="#111">Create an Account</text>
        <rect x="985" y="456" width="170" height="34" rx="4" fill="#5b5b5b"/><text x="1070" y="478" font-size="14" font-weight="700" fill="#fff">Update Household</text>
        <rect x="1170" y="456" width="140" height="34" rx="4" fill="#5b5b5b"/><text x="1240" y="478" font-size="14" font-weight="700" fill="#fff">I'm Traveling</text>
      </g>
      <rect x="1150" y="540" width="40" height="40" fill="#141414"/>
    </g>
    <rect x="80" y="610" width="1000" height="70" rx="10" fill="#d9d4e8"/>
    <rect x="60" y="670" width="1040" height="160" rx="16" fill="#2a2440"/>
    <rect x="110" y="560" width="230" height="90" rx="40" fill="#f2eef8"/>
    <path d="M330 640 Q620 560 1080 620 L1080 700 L330 700 Z" fill="url(#dblanket)"/>
    <g class="dorm__girl">
      <path d="M470 700 Q470 540 600 520 Q730 540 730 700 Z" fill="#c2185b"/>
      <path d="M690 600 Q800 560 880 520" stroke="#c98b5e" stroke-width="28" stroke-linecap="round" fill="none" class="dorm__arm"/>
      <rect x="868" y="498" width="44" height="22" rx="6" fill="#222" transform="rotate(-25 890 509)" class="dorm__remote"/>
      <path d="M520 430 Q520 330 600 330 Q690 330 690 440 L700 560 Q600 520 500 560 Z" fill="#1f130d"/>
      <circle cx="600" cy="440" r="78" fill="#c98b5e"/>
      <path d="M525 420 Q540 350 610 352 Q675 356 680 420 Q640 385 600 392 Q560 388 525 420 Z" fill="#1f130d"/>
      <g class="dorm__face">
        <ellipse cx="572" cy="440" rx="14" ry="18" fill="#fff"/><ellipse cx="630" cy="440" rx="14" ry="18" fill="#fff"/>
        <circle cx="575" cy="444" r="7" fill="#2a1a12"/><circle cx="633" cy="444" r="7" fill="#2a1a12"/>
        <path d="M556 414 L586 420 M646 414 L616 420" stroke="#1f130d" stroke-width="5" stroke-linecap="round"/>
        <ellipse cx="602" cy="490" rx="16" ry="20" fill="#5a2a1a"/>
      </g>
      <path class="dorm__sweat" d="M690 400 q10 18 0 26 q-10 -8 0 -26 Z" fill="#7fd3ff"/>
      <path class="dorm__sweat dorm__sweat--2" d="M515 410 q9 16 0 23 q-9 -7 0 -23 Z" fill="#7fd3ff"/>
    </g>
    <g class="dorm__bubble dorm__bubble--1"><rect x="330" y="230" width="230" height="86" rx="20" fill="#fff"/><path d="M470 312 L520 352 L500 312 Z" fill="#fff"/>
      <text x="445" y="285" text-anchor="middle" font-family="Inter, sans-serif" font-size="34" font-weight="800" fill="#111">WAIT.</text></g>
    <g class="dorm__bubble dorm__bubble--2"><rect x="280" y="210" width="330" height="96" rx="22" fill="#e50914"/><path d="M480 302 L530 350 L510 302 Z" fill="#e50914"/>
      <text x="445" y="272" text-anchor="middle" font-family="Inter, sans-serif" font-size="40" font-weight="900" fill="#fff">NO NO NO</text></g>
  </svg>`;
}

function passwordFilm() {
  const { windows: w, binges, yearly, gaps, dates, totals, monthly, streak } = DATA;
  const friends = binges.find((b) => b.show === "Friends");
  const silence = gaps[0];
  const gg = w.summer_2025.top[0];
  const july = monthly.find((m) => m.month === "2025-07");
  const owned = yearly.filter((y) => y.year >= 2018);
  return [
    { dur: 7, dorm: true, kicker: `Austin · ${fmtMonth(dates.austin.slice(0, 7))} · 11:47 PM`, line: "Wait,<br><em>what?</em>",
      sub: "First weeks of college. One more episode before bed. Netflix had other plans." },
    { dur: 6, wall: true, center: true, kicker: "A Suhani Tiwari true story", line: "The Password<br>Stopped Working",
      sub: `${n(totals.views)} things I pressed play on. One household. Then two cities.` },
    { dur: 5, img: backdropOf(w.first_days.top[1].show), kicker: fmtDate(totals.from), line: "It starts<br>in <em>Cupertino</em>",
      sub: `Fresh from Singapore, about to start fourth grade. ${listOf(w.first_days.top.slice(0, 2).map((s) => s.show))}. ${w.first_days.views} views in the first ${daysBetween(w.first_days.from, w.first_days.to)} days.` },
    { dur: 5.5, img: backdropOf("Friends"), alt: true, kicker: "Winter break, 2019", line: `${w.friends_run.top[0].views} episodes<br>in <em>${daysBetween(w.friends_run.from, w.friends_run.to)} days</em>`,
      sub: `All of Friends, nearly. ${friends.episodes} of them on ${fmtDate(friends.date)} alone.` },
    { dur: 6.5, montage: owned.map((y) => ({ img: posterOf(y.show), tag: y.year })), center: true,
      kicker: "Every year had a show", line: "One obsession<br>at a time", sub: listOf(owned.slice(0, 6).map((y) => y.show)) + "." },
    { dur: 6, wall: true, center: true, kicker: `Update on Sharing · ${fmtDate(dates.crackdown)}`,
      line: "“One<br><em>household.</em>”", sub: "Netflix starts checking which Wi-Fi you watch from. At home in Dallas, nothing changes. Yet." },
    { dur: 5.5, black: true, center: true, kicker: "January – June 2024",
      line: `<span class="scene__counter" data-to="${DATA.profile.senior_spring.views}">0</span> views<br>in <em>six months</em>`, sub: "Senior spring. The quietest stretch of my life on Netflix." },
    { dur: 5.5, img: backdropOf(w.first_semester.top[1].show), alt: true, kicker: fmtDate(dates.austin), line: "Moved to<br><em>Austin</em>",
      sub: `The household stayed in Dallas. My first semester: ${w.first_semester.views} views, about one month's worth back home.` },
    { dur: 6, img: backdropOf(gg.show), kicker: "Summer 2025 · home in Dallas", line: `${gg.views} episodes<br>of <em>${esc(gg.show)}</em>`,
      sub: `Back on the home Wi-Fi: a ${streak.days}-day streak, and ${july.views} views in July, my biggest month in years.` },
    { dur: 6, img: backdropOf(w.this_year.top[0].show), center: true, kicker: "Still watching", line: "Are you<br>still <em>watching?</em>",
      sub: `${n(totals.views)} views, ${n(totals.titles)} titles, ${n(totals.active_days)} days with something on. Yes.` },
  ];
}

function growingFilm() {
  const { elementary: el, middle: ms, high: hs, after } = Object.fromEntries(DATA.life.map((e) => [e.key, e]));
  const p = DATA.profile;
  const { windows: w, gaps, dates, totals } = DATA;
  const pct = (x) => `${Math.round(x || 0)}%`;
  const posters = (list) => list.map((s) => ({ img: posterOf(s.show), tag: "" }));
  const hindi = [...hs.examples.hindi, ...after.examples.hindi].filter((s, i, a) => a.findIndex((x) => x.show === s.show) === i);
  return [
    { dur: 5, wall: true, center: true, kicker: "Episode 2", line: "Singapore<br>to the <em>Forty Acres</em>",
      sub: `${parse(totals.to).getFullYear() - parse(totals.from).getFullYear()} years of Netflix, growing up.` },
    { dur: 4.5, img: backdropOf(p.first_title), kicker: `${fmtDate(totals.from)} · just moved from Singapore`, line: "First play:<br><em>${esc(p.first_title)}</em>",
      sub: "The very first thing our new account ever played." },
    { dur: 5, montage: posters(el.top.slice(0, 6)), center: true, kicker: "Season 1 · Elementary", line: "Learning America<br>on <em>Disney</em>",
      sub: `${listOf(el.top.slice(0, 3).map((s) => s.show))}. On Dad's profile: I didn't have my own yet.` },
    { dur: 5, montage: posters(ms.top.slice(0, 6)), center: true, kicker: "Season 2 · Middle School", line: "The family-<br><em>drama</em> years",
      sub: `${pct(ms.genres.Family)} family shows. ${pct(ms.language.English)} in English.` },
    { dur: 4.5, img: backdropOf("Friends"), alt: true, kicker: "Eighth grade, winter break", line: `${w.friends_run.top[0].views} episodes<br>of <em>Friends</em>`,
      sub: `In ${daysBetween(w.friends_run.from, w.friends_run.to)} days.` },
    { dur: 4.5, img: backdropOf(p.covid.top), kicker: "March 13, 2020", line: "Sent<br><em>home</em>",
      sub: `Schools close. ${p.covid.after_closure} views before March is over, mostly ${p.covid.top}.` },
    ...(DATA.gaps.some((g) => g.from.startsWith("2020")) ? [{ dur: 4.5, black: true, center: true, kicker: "Summer 2020", line: "Cupertino<br>to <em>Dallas</em>",
      sub: `${DATA.gaps.find((g) => g.from.startsWith("2020")).days} days without pressing play. Then high school, in Texas.` }] : []),
    { dur: 5, montage: posters(hs.top.slice(0, 6)), center: true, kicker: "Season 3 · High School", line: "It gets<br><em>serious</em>",
      sub: `Drama goes from ${pct(ms.genres.Drama)} to ${pct(hs.genres.Drama)}. Hospitals, crime, Stars Hollow.` },
    { dur: 5, montage: posters(hindi.slice(0, 6)), center: true, kicker: "Finding home on screen", line: "Hindi,<br><em>more and more</em>",
      sub: `Hindi series: ${pct(ms.language.Hindi)} → ${pct(hs.language.Hindi)} → ${pct(after.language.Hindi)}. Hindi films: ${p.hindi_films.total} of ${p.hindi_films.movies}.` },
    { dur: 4.5, black: true, center: true, kicker: "Senior spring, 2024", line: `<span class="scene__counter" data-to="${p.senior_spring.views}">0</span> views<br>in <em>six months</em>`,
      sub: "Graduation is busy." },
    { dur: 5.5, black: true, center: true, accent: "ut", kicker: fmtDate(dates.austin), line: "Hook 'em.<br><em>UT Austin.</em>",
      sub: `Freshman fall: ${p.college.fall_2024} views a day. Summer back home: ${p.college.summer_2025}.` },
    { dur: 5, montage: posters(after.top.slice(0, 6)), center: true, kicker: "Season 4 · After Graduation", line: "Missing home,<br><em>in Hindi</em>",
      sub: `${pct(after.language.Hindi)} of my series. Talk shows, new releases, movie nights.` },
    { dur: 5, wall: true, center: true, accent: "ut", kicker: "Still watching", line: "From Singapore<br>to the <em>Forty Acres</em>",
      sub: `${n(totals.views)} views. Same profile. A different person.` },
  ];
}

const FILMS = {
  password: { ep: "E1", name: "The Password Stopped Working", subtitle: "One Household", scenes: passwordFilm, next: "growing" },
  growing: { ep: "E2", name: "The Password Stopped Working", subtitle: "Singapore to the Forty Acres", scenes: growingFilm, next: null },
};

function setupPlayer() {
  const player = $("#player");
  const stage = $("#player-stage");
  let list = [], starts = [], total = 0, sceneEls = [], film = null;
  const fmt = (x) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, "0")}`;

  const load = (key) => {
    film = FILMS[key];
    list = film.scenes().map((s) => s.montage ? { ...s, montage: s.montage.filter((m) => m.img) } : s);
    starts = list.reduce((acc, s, i) => (acc.push(i ? acc[i - 1] + list[i - 1].dur : 0), acc), []);
    total = starts.at(-1) + list.at(-1).dur;
    stage.innerHTML = list.map((s) => {
      let bg = "";
      if (s.dorm) bg = `<div class="scene__bg scene__bg--dorm">${dormSVG()}</div>`;
      else if (s.wall) bg = `<div class="scene__bg">${wallHTML()}</div>`;
      else if (s.montage?.length) bg = `<div class="montage" style="--cols:${Math.max(3, Math.ceil(s.montage.length / 2))}">${s.montage.map((m, k) =>
        `<figure style="--k:${k}"><img src="${m.img}" alt="" loading="lazy">${m.tag ? `<figcaption>${m.tag}</figcaption>` : ""}</figure>`).join("")}</div>`;
      else if (s.img) bg = `<div class="scene__bg" style="background-image:url('${s.img}')"></div>`;
      return `<section class="scene${s.center ? " scene--center" : ""}${s.alt ? " scene--alt" : ""}${s.accent ? ` scene--${s.accent}` : ""}" style="--dur:${s.dur + 1}s">
        ${bg}<div class="scene__text"><p class="scene__kicker">${esc(s.kicker)}</p><h2 class="scene__line">${s.line}</h2><p class="scene__sub">${esc(s.sub)}</p></div></section>`;
    }).join("");
    sceneEls = [...stage.children];
    $(".player__title").innerHTML = `<b>${esc(film.name)}</b> <span>${film.ep}</span> ${esc(film.subtitle)}`;
    $("#player-next").textContent = film.next ? "Next Episode ›" : "Back to Browse ›";
    player.setAttribute("aria-label", `${film.name}, ${film.subtitle}`);
  };

  let t = 0, playing = false, last = 0, current = -1, raf, idleTimer;
  const show = (i) => {
    if (i === current) return;
    sceneEls.forEach((el, k) => {
      const on = k === i;
      if (on) { el.classList.remove("is-on"); void el.offsetWidth; }
      el.classList.toggle("is-on", on);
    });
    current = i;
  };
  const render = () => {
    const i = Math.max(0, starts.findLastIndex((s) => s <= t));
    show(i);
    const counter = sceneEls[i].querySelector(".scene__counter");
    if (counter) counter.textContent = Math.round(Math.min((t - starts[i]) / 2.2, 1) * counter.dataset.to);
    const pct = (t / total) * 100;
    $("#player-fill").style.width = `${pct}%`;
    $("#player-knob").style.left = `${pct}%`;
    $("#player-time").textContent = `-${fmt(total - t)}`;
  };
  const tick = (now) => {
    if (playing) {
      t = Math.min(t + (now - last) / 1000, total);
      if (t >= total) {
        if (film.next) { start(film.next); return; }
        setPlaying(false);
      }
    }
    last = now;
    render();
    raf = requestAnimationFrame(tick);
  };
  const setPlaying = (on) => {
    playing = on;
    player.classList.toggle("is-paused", !on);
    $("#player-toggle").setAttribute("aria-label", on ? "Pause" : "Play");
    sceneEls[current]?.querySelectorAll(".scene__bg, .montage figure, .scene__kicker, .scene__line, .scene__sub, .wall__col")
      .forEach((el) => { el.style.animationPlayState = on ? "running" : "paused"; });
  };
  const seek = (x) => { t = Math.min(Math.max(x, 0), total - .01); current = -1; render(); setPlaying(true); };
  const wake = () => {
    player.classList.remove("is-idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => playing && player.classList.add("is-idle"), 2600);
  };
  const start = (key) => {
    cancelAnimationFrame(raf);
    load(key);
    t = 0; current = -1; last = performance.now();
    setPlaying(true);
    raf = requestAnimationFrame(tick);
  };
  const open = (key) => {
    player.hidden = false;
    document.body.classList.add("locked");
    player.requestFullscreen?.().catch(() => {});
    start(key);
    wake();
    $("#player-toggle").focus();
  };
  let opener;
  const close = () => {
    setPlaying(false);
    cancelAnimationFrame(raf);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    player.hidden = true;
    document.body.classList.remove("locked");
    opener?.focus();
  };

  $("#play").addEventListener("click", (e) => { opener = e.currentTarget; open("password"); });
  $("#play-growing")?.addEventListener("click", (e) => { opener = e.currentTarget; open("growing"); });
  $("#player-back").addEventListener("click", close);
  $("#player-toggle").addEventListener("click", () => (t >= total ? seek(0) : setPlaying(!playing)));
  $("#player-rew").addEventListener("click", () => seek(t - 10));
  $("#player-fwd").addEventListener("click", () => seek(t + 10));
  $("#player-next").addEventListener("click", () => {
    if (film.next) { start(film.next); return; }
    close();
    $("#growth").scrollIntoView({ behavior: "smooth" });
  });
  const bar = $("#player-bar");
  bar.addEventListener("click", (e) => { const r = bar.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * total); });
  bar.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") seek(t - 5);
    if (e.key === "ArrowRight") seek(t + 5);
  });
  stage.addEventListener("click", () => setPlaying(!playing));
  player.addEventListener("pointermove", wake);
  document.addEventListener("keydown", (e) => {
    if (player.hidden) return;
    if (e.key === "Escape") close();
    else if ((e.key === " " && e.target === document.body) || e.key === "k") { e.preventDefault(); setPlaying(!playing); }
    else if (e.key === "ArrowLeft" && e.target !== bar) seek(t - 10);
    else if (e.key === "ArrowRight" && e.target !== bar) seek(t + 10);
    wake();
  });
}

// ---------- timeline ----------
function storyMarks() {
  const { dates, binges, gaps, windows } = DATA;
  const silence = gaps[0];
  const friends = binges[0];
  const gg = windows.summer_2025.top[0];
  return [
    { month: friends.date.slice(0, 7), title: `${friends.show}: ${friends.episodes} in a day`, sub: fmtDate(friends.date) },
    { month: dates.crackdown.slice(0, 7), title: "Netflix checks the Wi-Fi", sub: fmtDate(dates.crackdown) },
    { month: "2024-03", title: `Senior spring: ${DATA.profile.senior_spring.views} views`, sub: "Jan – Jun 2024" },
    { month: dates.austin.slice(0, 7), title: "Moved to Austin", sub: fmtDate(dates.austin) },
    { month: "2025-07", title: "Home for the summer", sub: `${gg.views} eps of ${gg.show}` },
  ];
}

function setupChart() {
  const months = DATA.monthly;
  const W = 1200, top = 82, H = 300, bottom = 24;
  const slot = W / months.length;
  const max = Math.max(...months.map((m) => m.views));
  const y = (v) => H - bottom - (v / max) * (H - bottom - top);
  const marks = storyMarks();
  const markMonths = new Set(marks.map((m) => m.month));
  const index = Object.fromEntries(months.map((m, i) => [m.month, i]));

  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Netflix views per month, December 2017 to September 2026");

  let out = "";
  // School eras as shaded bands behind the bars.
  DATA.life.forEach((e) => {
    const a = index[e.from.slice(0, 7)] ?? 0;
    const b = (index[e.to.slice(0, 7)] ?? months.length - 1) + 1;
    out += `<g class="band"><rect x="${a * slot}" y="${top - 6}" width="${(b - a) * slot}" height="${H - bottom - top + 6}"/>
      <text x="${a * slot + 8}" y="${top + 8}">${e.name}</text></g>`;
  });
  months.forEach((m, i) => {
    const x = i * slot;
    const h = H - bottom - y(m.views);
    out += `<g class="col" data-i="${i}">
      <rect x="${x}" y="${top}" width="${slot}" height="${H - bottom - top}" fill="transparent"/>
      <rect class="bar grow${markMonths.has(m.month) ? " hot" : ""}" style="animation-delay:${i * 9}ms"
        x="${x + slot * .14}" y="${y(m.views)}" width="${slot * .72}" height="${Math.max(h, 0)}" rx="1"/>
    </g>`;
    if (m.month.endsWith("-01")) out += `<text class="axis" x="${x}" y="${H - 6}">${m.month.slice(0, 4)}</text>`;
  });

  // Labels go on the first line (from the top) where they don't collide.
  const levels = [];
  marks.forEach((mk) => {
    const i = index[mk.month];
    if (i === undefined) return;
    const x = i * slot + slot / 2;
    const width = Math.max(mk.title.length * 6.9, mk.sub.length * 6.2) + 10;
    const anchorEnd = x + width > W;
    const span = anchorEnd ? [x - width, x] : [x, x + width];
    let level = 0;
    while ((levels[level] || []).some(([a, b]) => span[0] < b && span[1] > a)) level++;
    (levels[level] ||= []).push(span);
    const ty = 14 + level * 34;
    const tx = anchorEnd ? x - 5 : x + 5;
    const anchor = anchorEnd ? "end" : "start";
    out += `<g class="mark"><line x1="${x}" x2="${x}" y1="${ty - 10}" y2="${y(months[i].views) - 3}"/>
      <text x="${tx}" y="${ty}" text-anchor="${anchor}">${esc(mk.title)}</text>
      <text class="sub" x="${tx}" y="${ty + 15}" text-anchor="${anchor}">${esc(mk.sub)}</text></g>`;
  });
  svg.innerHTML = out;
  // Leave room above the bars for however many label lines were needed.
  const need = 14 + levels.length * 34;
  if (need > top) svg.setAttribute("viewBox", `0 ${top - need} ${W} ${H - top + need}`);
  $("#chart").appendChild(svg);

  const tip = $("#tooltip");
  const show = (e) => {
    const col = e.target.closest(".col");
    if (!col) { tip.hidden = true; return; }
    const m = months[col.dataset.i];
    tip.innerHTML = `<b>${fmtMonth(m.month)}</b>${n(m.views)} view${m.views === 1 ? "" : "s"}`;
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    tip.style.left = `${Math.min(e.clientX + 14, innerWidth - r.width - 8)}px`;
    tip.style.top = `${e.clientY - r.height - 12}px`;
  };
  svg.addEventListener("pointermove", show);
  svg.addEventListener("pointerdown", show);
  svg.addEventListener("pointerleave", () => { tip.hidden = true; });
}

function playChart() {
  const chart = $("#chart");
  chart.classList.remove("playing");
  void chart.offsetWidth;
  chart.classList.add("playing");
}

// ---------- episodes ----------
function seasons() {
  const { windows: w, yearly, month_of_year: moy, weekday, shows, gaps, streak, monthly, totals, binges } = DATA;
  const silence = gaps[0];
  const friendsDay = binges.find((b) => b.show === "Friends");
  const firsts = w.first_days.top.map((s) => s.show);
  const peakYears = yearly.filter((y) => y.year >= 2018 && y.year <= 2023);
  const weekend = weekday.Saturday + weekday.Sunday;
  const july = monthly.find((m) => m.month === "2025-07");
  const before = monthly.filter((m) => m.month < "2025-07");
  const rival = [...before].reverse().find((m) => m.views >= july.views);
  const kapil = "The Great Indian Kapil Show";
  const since = ["last_summer_home", "first_semester", "summer_2025", "fall_2025", "this_year"];
  const kapilTop3 = since.filter((k) => w[k].top.slice(0, 3).some((s) => s.show === kapil)).length;
  const gg = w.summer_2025.top[0];
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const { elementary: el, middle: ms, high: hs, after } = Object.fromEntries(DATA.life.map((e) => [e.key, e]));
  const sub = (e) => `${fmtDate(e.from)} to ${fmtDate(e.to)} · ${n(e.views)} views · ${e.per_month} a month`;
  const ep = {
        pilot: { title: "Pilot", art: firsts[0], stat: `${w.first_days.views} views`,
          copy: `My history starts on ${fmtDate(w.first_days.from)} with ${listOf(firsts)}. ${w.first_days.views} views in the first ${daysBetween(w.first_days.from, w.first_days.to)} days.` },
        friends: { title: "The One With 223 Episodes", art: "Friends", stat: `${w.friends_run.top[0].views} episodes`,
          copy: `${w.friends_run.top[0].views} episodes of Friends in ${daysBetween(w.friends_run.from, w.friends_run.to)} days, ${fmtShort(w.friends_run.from)} to ${fmtDate(w.friends_run.to)}. On ${fmtShort(friendsDay.date)} I watched ${friendsDay.episodes}, my biggest day ever.` },
        yearly: { title: "Every Year Had a Show", art: peakYears[3].show, stat: `${peakYears.length} years`,
          copy: `Every year had a show that owned it: ${listOf(peakYears.map((y) => `${y.show} in ${y.year} (${y.episodes})`))}.` },
        winter: { title: "Winter Break", art: "December", label: "December", stat: `${n(moy[11])} in December`,
          copy: `December is my biggest month: ${n(moy[11])} views across every December. August through October, when school starts, is the quietest: ${moy[7]}, ${moy[8]} and ${moy[9]}.` },
        sunday: { title: "Sunday Night", art: "Sunday", label: "Sundays", stat: `${weekday.Sunday} on Sundays`,
          copy: `Sunday is my biggest day and Thursday my smallest, ${weekday.Sunday} views against ${weekday.Thursday}. Weekends are ${Math.round(weekend / sum(weekday) * 100)}% of everything I've watched, more than their 29% share of the week.` },
        password: { title: "The Password Check", art: w.after_crackdown.top[0].show, stat: `${w.after_crackdown.views} views`,
          copy: `On ${fmtDate(DATA.dates.crackdown)}, Netflix started enforcing paid sharing in the US: watch away from the account's home Wi-Fi and it asks someone to pay. I was still home, and it didn't slow me down: ${w.after_crackdown.views} views by the end of 2023, led by ${w.after_crackdown.top[0].show} (${w.after_crackdown.top[0].views}).` },
        silence: { title: "Senior Spring", art: "Silence", label: "…", stat: `${DATA.profile.senior_spring.views} views`,
          copy: `January to June 2024: ${DATA.profile.senior_spring.views} views on ${DATA.profile.senior_spring.days} days, the quietest six months in ${parse(totals.to).getFullYear() - parse(totals.from).getFullYear()} years. Graduation season.` },
        lastSummer: { title: "Last Summer at Home", art: w.last_summer_home.top[1].show, stat: `${w.last_summer_home.views} views`,
          copy: `The summer before college, it came back: ${w.last_summer_home.views} views between ${fmtShort(w.last_summer_home.from)} and ${fmtDate(w.last_summer_home.to)}, mostly ${listOf(w.last_summer_home.top.slice(0, 3).map((s) => s.show))}.` },
        moveIn: { title: "Move-In Day", art: "Austin", label: "Austin", stat: `${w.first_semester.views} views`,
          copy: `I moved to Austin on ${fmtDate(DATA.dates.austin)}. My whole first semester: ${w.first_semester.views} views, about what a single month looked like in high school, when I averaged ${hs.per_month}.` },
        summer: { title: "Summer in Dallas", art: gg.show, stat: `${gg.views} episodes`,
          copy: `Home for summer 2025, I watched ${gg.views} episodes of ${gg.show} in June and July, inside a ${streak.days}-day streak (${fmtShort(streak.from)} to ${fmtShort(streak.to)}), the longest in my history. July 2025 had ${july.views} views, my biggest month since ${rival ? fmtMonth(rival.month) : "the history began"}.` },
        back: { title: "Back to Austin", art: w.fall_2025.top[0].show, stat: `${w.fall_2025.views} views`,
          copy: `Then the semester started: ${w.fall_2025.views} views from ${fmtShort(w.fall_2025.from)} to the end of 2025. The most I watched of anything was ${w.fall_2025.top[0].views} episodes of ${w.fall_2025.top[0].show}.` },
        comfort: { title: "The Comfort Show", art: kapil, stat: `${shows[kapil].eras.Austin} episodes`,
          copy: `${kapil} is the one constant since I left: ${shows[kapil].eras.Austin} episodes since the move, and in my top 3 in ${kapilTop3} of the ${since.length} stretches since summer 2024. It was also my #1 show of 2024.` },
        still: { title: "Still Watching", art: w.this_year.top[0].show, stat: `${w.this_year.views} views`,
          copy: `2026 so far: ${w.this_year.views} views, ${w.this_year.views > yearly.find((y) => y.year === 2024).views ? "already more than all of 2024" : "still catching up to 2024"}. ${w.this_year.top[0].show} leads with ${w.this_year.top[0].views}, then ${listOf(w.this_year.top.slice(1, 3).map((s) => s.show))}.` },
  };
  return [
    { name: "Season 1: Elementary", sub: `${sub(el)} · on Dad's profile`, episodes: [ep.pilot] },
    { name: "Season 2: Middle School", sub: sub(ms), episodes: [ep.friends, ep.winter] },
    { name: "Season 3: High School", sub: sub(hs), episodes: [ep.yearly, ep.sunday, ep.password, ep.silence] },
    { name: "Season 4: After Graduation", sub: `${sub(after)}, summers home included`,
      episodes: [ep.lastSummer, ep.moveIn, ep.summer, ep.back, ep.comfort, ep.still] },
  ];
}

function setupEpisodes() {
  const all = seasons();
  const tabs = $("#season-tabs");
  tabs.innerHTML = all.map((s, i) =>
    `<button class="season-tab" role="tab" type="button" aria-selected="${i === 0}" data-i="${i}">${esc(s.name)}</button>`).join("");
  const render = (i) => {
    const s = all[i];
    tabs.querySelectorAll(".season-tab").forEach((b) => b.setAttribute("aria-selected", String(+b.dataset.i === i)));
    $("#season-sub").textContent = s.sub;
    $("#episode-list").innerHTML = s.episodes.map((e, k) => `
      <li class="episode">
        <span class="episode__num">${k + 1}</span>
        <span class="episode__thumb">${art(e.art, { label: e.label || e.art, mark: false })}</span>
        <div>
          <div class="episode__top"><p class="episode__title">${esc(e.title)}</p><span class="episode__stat">${esc(e.stat)}</span></div>
          <p class="episode__copy">${esc(e.copy)}</p>
        </div>
      </li>`).join("");
  };
  tabs.addEventListener("click", (e) => { const b = e.target.closest(".season-tab"); if (b) render(+b.dataset.i); });
  render(0);
}

// ---------- title modal ----------
function miniRow(label, value, max, hot = true) {
  return `<div class="mini__row"><span>${esc(label)}</span>
    <span class="mini__bar"><span style="width:${Math.max(value / max * 100, 2)}%;${hot ? "" : "background:#777"}"></span></span>
    <span class="mini__n">${n(value)}</span></div>`;
}

function openShow(name) {
  const s = DATA.shows[name];
  if (!s) return;
  const t = DATA.totals;
  const share = s.views / t.views * 100;
  const rank = DATA.top.findIndex((x) => x.show === name);
  const y1 = parse(s.first).getFullYear(), y2 = parse(s.last).getFullYear();
  const seasons = Object.entries(s.seasons);
  const years = Object.entries(s.by_year);
  let copy;
  if (s.kind === "movie") {
    copy = `<p class="modal__copy">Watched on ${fmtDate(s.last)}${s.eras.Austin ? ", after I moved to Austin" : ", in Dallas"}.</p>`;
  } else {
    copy = `<p class="modal__copy">${n(s.views)} episode${s.views === 1 ? "" : "s"} over ${s.days} day${s.days === 1 ? "" : "s"}, from ${fmtDate(s.first)} to ${fmtDate(s.last)}.</p>`;
    if (s.best_day.episodes > 1) copy += `<p class="modal__copy">My biggest day: ${s.best_day.episodes} episodes on ${fmtDate(s.best_day.date)}.${s.binge_days ? ` ${s.binge_days} binge day${s.binge_days === 1 ? "" : "s"} of 3 or more.` : ""}</p>`;
  }
  const eraLine = [s.eras.Dallas && `${n(s.eras.Dallas)} in Dallas`, s.eras.Austin && `${n(s.eras.Austin)} since Austin`].filter(Boolean).join(", ");
  const maxS = Math.max(...seasons.map(([, v]) => v), 1);
  const maxY = Math.max(...years.map(([, v]) => v), 1);
  openModal(name, `
    <p class="modal__meta"><span class="match">${share >= 1 ? share.toFixed(1) : share.toFixed(2)}% of my watching</span>
      <span>${y1 === y2 ? y1 : `${y1}–${y2}`}</span>
      <span class="pill">${s.kind === "movie" ? "Movie" : "Series"}</span>
      ${seasons.length ? `<span>${seasons.length} season${seasons.length === 1 ? "" : "s"}</span>` : ""}
      ${rank >= 0 ? `<span class="top-badge">TOP<b>10</b></span><span>#${rank + 1} in Suhani's Life</span>` : ""}</p>
    <div class="modal__grid">
      <div>${copy}</div>
      <div class="modal__side">
        <p><b>Watched:</b> ${eraLine}</p>
        <p><b>First:</b> ${fmtDate(s.first)}</p>
        <p><b>Last:</b> ${fmtDate(s.last)}</p>
      </div>
    </div>
    ${seasons.length > 1 ? `<h4>Episodes by season</h4><div class="mini">${seasons.map(([k, v]) => miniRow(k, v, maxS)).join("")}</div>` : ""}
    ${years.length > 1 ? `<h4>By year</h4><div class="mini">${years.map(([k, v]) => miniRow(k, v, maxY)).join("")}</div>` : ""}`);
}

let lastFocus;
function openModal(title, body) {
  lastFocus = document.activeElement;
  $("#modal-art").innerHTML = art(title);
  $("#modal-art .art__name").id = "modal-title";
  $("#modal-body").innerHTML = body;
  $("#modal").hidden = false;
  document.body.classList.add("locked");
  $(".modal__close").focus();
}
function closeModal() {
  $("#modal").hidden = true;
  document.body.classList.remove("locked");
  lastFocus?.focus();
}

// ---------- wiring ----------
function setupGlobal() {
  const nav = $("#nav");
  const onScroll = () => nav.classList.toggle("is-solid", scrollY > 40);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-show]");
    if (t) openShow(t.dataset.show);
    if (e.target.closest("[data-close]")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#modal").hidden) closeModal();
  });

  const t = DATA.totals;
  const note = $("#profiles-note");
  if (note) note.textContent = `${parse(t.to).getFullYear() - parse(t.from).getFullYear()} years. ${n(t.views)} things I pressed play on.`;
  $("#about-from").textContent = fmtDate(t.from);
  $("#about-to").textContent = fmtDate(t.to);
  $("#still-sub").textContent =
    `${n(t.views)} views, ${n(t.titles)} titles and ${n(t.active_days)} days with something on. The most recent: ${fmtDate(t.to)}. Yes, I'm still watching.`;
}

setupProfiles();
Promise.all([
  fetch("data/site.json").then((r) => r.json()),
  fetch("data/art.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
])
  .then(([data, art]) => {
    DATA = data;
    ART = art;
    setupHero();
    setupRows();
    setupCase();
    setupGrowth();
    setupHouse();
    setupChart();
    setupPreview();
    setupPlayer();
    setupEpisodes();
    setupGlobal();
  });
