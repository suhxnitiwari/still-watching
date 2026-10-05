// Still Watching: my Netflix history, browsed like Netflix.
// Everything on the page comes from data/site.json, built by etl/build_site.py.

const $ = (sel, root = document) => root.querySelector(sel);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SVG = "http://www.w3.org/2000/svg";

let DATA;
const BIRTH_YEAR = 2006;
// Amaira was born in November 2016, so for most of any year she is (year - 2017) years old.
const sisterAge = (year) => year - 2017;
let ART = {};
let STILLS = {};  // episode stills by show and year (data/stills.json)

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

function toast(text) {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = text;
  t.classList.remove("is-on"); void t.offsetWidth; t.classList.add("is-on");
}

// ---------- the intro ----------
// Our own "ta-dum": two deep hits and a swell, synthesized with Web Audio. Not Netflix's sound.
// Our own ta-dum (no Netflix audio): two soft low thuds, then a deep chord that blooms open and fades.
function taDum() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx(), t0 = ctx.currentTime + .05;
  const out = ctx.createGain(), comp = ctx.createDynamicsCompressor();
  out.gain.value = .85;
  out.connect(comp).connect(ctx.destination);
  const noise = (secs) => {
    const buf = ctx.createBuffer(1, ctx.sampleRate * secs, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  };
  // "ta": a low thud with a pitch drop and a muffled click on the attack.
  const thud = (at, freq, len, level) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq * 1.8, t0 + at);
    o.frequency.exponentialRampToValueAtTime(freq, t0 + at + .06);
    g.gain.setValueAtTime(0, t0 + at);
    g.gain.linearRampToValueAtTime(level, t0 + at + .005);
    g.gain.exponentialRampToValueAtTime(.001, t0 + at + len);
    o.connect(g).connect(out);
    o.start(t0 + at); o.stop(t0 + at + len + .05);
    const n = noise(.08), f = ctx.createBiquadFilter(), ng = ctx.createGain();
    f.type = "lowpass"; f.frequency.value = 900;
    ng.gain.setValueAtTime(level * .35, t0 + at);
    ng.gain.exponentialRampToValueAtTime(.001, t0 + at + .07);
    n.connect(f).connect(ng).connect(out);
    n.start(t0 + at);
  };
  thud(0, 55, .3, .9);
  thud(.13, 65, .34, .8);
  // "dum": a sub hit under a detuned low chord, its lowpass sweeping open over 1.5 s.
  const at = .42;
  thud(at, 41, 1.8, 1);
  const lp = ctx.createBiquadFilter(), swell = ctx.createGain();
  lp.type = "lowpass"; lp.Q.value = .7;
  lp.frequency.setValueAtTime(160, t0 + at);
  lp.frequency.exponentialRampToValueAtTime(2600, t0 + at + 1.5);
  swell.gain.setValueAtTime(0, t0 + at);
  swell.gain.linearRampToValueAtTime(.5, t0 + at + .3);
  swell.gain.setValueAtTime(.5, t0 + at + 1.2);
  swell.gain.exponentialRampToValueAtTime(.001, t0 + at + 3.6);
  swell.connect(lp).connect(out);
  [[70, "sawtooth", .3], [105, "sawtooth", .2], [140, "triangle", .16], [210, "triangle", .07]].forEach(([freq, type, level]) => {
    [-7, 7].forEach((cents) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = freq; o.detune.value = cents;
      g.gain.value = level / 2;
      o.connect(g).connect(swell);
      o.start(t0 + at); o.stop(t0 + at + 3.7);
    });
  });
  // An airy rise under the bloom.
  const air = noise(3), bp = ctx.createBiquadFilter(), ag = ctx.createGain();
  bp.type = "bandpass"; bp.Q.value = .8;
  bp.frequency.setValueAtTime(400, t0 + at);
  bp.frequency.exponentialRampToValueAtTime(1800, t0 + at + 1.6);
  ag.gain.setValueAtTime(0, t0 + at);
  ag.gain.linearRampToValueAtTime(.1, t0 + at + 1.1);
  ag.gain.linearRampToValueAtTime(0, t0 + at + 2.6);
  air.connect(bp).connect(ag).connect(out);
  air.start(t0 + at);
}

function setupIntro(onDone) {
  const intro = $("#intro");
  let seen = false;
  try { seen = sessionStorage.getItem("entered") === "1"; } catch {}
  if (seen || !intro) { intro?.remove(); onDone(); return; }
  intro.hidden = false;
  document.body.classList.add("locked");
  const finish = () => { intro.remove(); onDone(); };
  // The light streaks the S breaks into: red and pink ribbons spreading out from the middle.
  const colors = ["#e50914", "#b20710", "#ff3d6e", "#ff1f2c", "#8a0610", "#ff7aa2", "#7b2ff7", "#ffb36b"];
  $(".intro__streaks").innerHTML = Array.from({ length: 46 }, (_, i) => {
    const x = (Math.random() - .5) * 2;
    return `<i style="--x:${x.toFixed(3)};--w:${(2 + Math.random() * 10).toFixed(1)}px;--c:${colors[i % colors.length]};--d:${(Math.random() * .35).toFixed(2)}s"></i>`;
  }).join("");
  $("#intro-start").focus();
  $("#intro-start").addEventListener("click", () => {
    if (intro.classList.contains("is-playing")) return;
    taDum();
    intro.classList.add("is-playing");
    setTimeout(finish, matchMedia("(prefers-reduced-motion: reduce)").matches ? 600 : 3000);
  });
  $("#intro-skip").addEventListener("click", finish);
}

// ---------- Who's watching? ----------
// The family account's profile screen. Only my profile opens: it's the only history here.
const PROFILES = [
  { name: "Dad", img: "dad" },
  { name: "Mom", img: "mom" },
  { name: "Suhani", img: "suhani", me: true },
  { name: "Sister", img: "amaira", kids: true },
];

function avatar(p) {
  return `<img src="img/profiles/${p.img}.jpg" alt="" aria-hidden="true">`;
}
// The profile screen's avatars start as raw data (bits, titles, dates) and resolve into a face:
// the data working out who's behind each profile.
const DATA_BITS = {
  Dad: ["Narcos", "2017-11-13", "Ozark", "Sons of Anarchy", "El Chapo", "729 titles", "66%"],
  Mom: ["Delhi Crime", "Jamtara", "Om Shanti Om", "2019-03-27", "303 films", "Hindi", "Sacred Games"],
  Suhani: ["Friends", "2019-12-15", "29 eps", "Gossip Girl", "Jessie", "Vampire Diaries", "Austin"],
  Sister: ["iCarly", "Masha", "Sofia", "2023-09-24", "Barbie", "PJ Masks", "Little Baby Bum"],
};
// The reveal: the computer rebuilds each face from data. It samples the real portrait's pixels and redraws
// them as glyphs (bits, digits and letters from that person's own titles), each tinted with the pixel's color.
// Noise first, then a scanline locks the glyphs into a face, then the glyphs dissolve into the photo.
function reconstruct(avatarEl, name) {
  const img = avatarEl.querySelector("img"), cv = avatarEl.querySelector(".avatar__recon"), status = avatarEl.querySelector(".avatar__status");
  if (!img || !cv) return () => {};
  // Coarse to fine, the way an image model denoises: the whole face sharpens at once.
  const LEVELS = [3, 5, 8, 13, 21, 34];
  let grids = null, raf = 0;
  const sample = () => {
    grids = LEVELS.map((n) => {
      const off = document.createElement("canvas"); off.width = off.height = n;
      const g = off.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(img, 0, 0, n, n);
      const d = g.getImageData(0, 0, n, n).data;
      return { n, px: Array.from({ length: n * n }, (_, k) => [d[k * 4], d[k * 4 + 1], d[k * 4 + 2]]), seed: Array.from({ length: n * n }, () => Math.random()) };
    });
  };
  const play = () => {
    if (!img.complete || !img.naturalWidth) { img.addEventListener("load", play, { once: true }); return; }
    if (!grids) sample();
    cancelAnimationFrame(raf);
    const size = cv.clientWidth || 140, dpr = Math.min(devicePixelRatio || 1, 2), W = size * dpr;
    cv.width = cv.height = W;
    const ctx = cv.getContext("2d");
    avatarEl.classList.remove("is-revealed"); avatarEl.classList.add("is-reconstructing");
    const start = performance.now(), STATIC = 450, GEN = 2300, END = STATIC + GEN + 250;
    const frame = (now) => {
      const t = now - start, p = Math.min(1, Math.max(0, (t - STATIC) / GEN));
      ctx.globalAlpha = 1;
      if (t < STATIC) {  // colored static
        const n = 24, c = W / n;
        for (let k = 0; k < n * n; k++) { const v = Math.random() * 255; ctx.fillStyle = Math.random() < .2 ? `rgb(${v},20,30)` : `rgb(${v * .25},${v * .25},${v * .3})`; ctx.fillRect((k % n) * c, Math.floor(k / n) * c, c + 1, c + 1); }
        status.textContent = "GENERATING…";
      } else {
        const eased = 1 - Math.pow(1 - p, 2.2), li = Math.min(LEVELS.length - 1, Math.floor(eased * LEVELS.length)), local = eased * LEVELS.length - li;
        const prev = grids[Math.max(0, li - 1)], cur = grids[li];
        // previous level underneath, current level settling in cell by cell
        [prev, cur].forEach((g, layer) => {
          const c = W / g.n;
          for (let k = 0; k < g.n * g.n; k++) {
            if (layer === 1 && g.seed[k] > local * 1.3) continue;
            const [r, gg, b] = g.px[k], jit = layer === 1 && g.seed[k] > local ? 40 : 0;
            ctx.fillStyle = `rgb(${r + (Math.random() - .5) * jit},${gg + (Math.random() - .5) * jit},${b + (Math.random() - .5) * jit})`;
            ctx.fillRect((k % g.n) * c, Math.floor(k / g.n) * c, c + .6, c + .6);
          }
        });
        // faint bits on the blocks, fading as it gets confident
        if (cur.n >= 8) {
          const c = W / cur.n;
          ctx.font = `700 ${c * .62}px "Courier New", monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = `rgba(255,255,255,${.28 * (1 - p)})`;
          for (let k = 0; k < cur.n * cur.n; k += 1) ctx.fillText(cur.seed[k] > .5 ? "1" : "0", (k % cur.n + .5) * c, (Math.floor(k / cur.n) + .5) * c);
        }
        // a glitch at the end: an RGB split slice
        if (p > .86) {
          const y = Math.random() * W, h = W * (.04 + Math.random() * .08);
          ctx.globalAlpha = .55; ctx.drawImage(img, -6 * dpr, y, W, h, 0, y, W, h); ctx.globalAlpha = 1;
        }
        status.textContent = p < 1 ? `GENERATING ${Math.round(p * 100)}%` : "MATCH FOUND";
      }
      if (t < END) raf = requestAnimationFrame(frame);
      else { avatarEl.classList.remove("is-reconstructing"); avatarEl.classList.add("is-revealed"); }
    };
    raf = requestAnimationFrame(frame);
  };
  return play;
}

function dataRain(name) {
  const words = DATA_BITS[name] || [];
  const line = (i) => Array.from({ length: 6 }, (_, k) => (k + i) % 3 === 0 && words.length ? words[(k * 3 + i) % words.length] : Math.random().toString(2).slice(2, 10)).join(" ");
  return `<span class="avatar__data" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<span>${line(i)}</span>`).join("")}</span>`;
}
const PROFILE_TEASE = {
  Dad: (f) => [`${n(f?.profiles?.Dad?.views || 0)} plays`, "What does he watch on the days that matter?"],
  Mom: (f) => [`${n(f?.profiles?.Mom?.views || 0)} plays`, "Can Netflix tell when Hindi took over?"],
  Suhani: (f) => [`🔒 Primary case file · ${n(f?.profiles?.Me?.views || 0)} plays`, "Eleven years. One person. No demographic data."],
  Sister: (f) => [`${n(f?.profiles?.["My sister"]?.views || 0)} plays`, "What does growing up look like when Netflix was there from day one?"],
};
const PROFILE_GLOW = { Dad: "#0033cc", Mom: "#c00010", Suhani: "#ff2079", Sister: "#7a00c2" };

const LOCK_ICON = `<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>`;

// A peek at a family profile: their top shows and a few funny titles, then the rest stays locked.
function peekLines(name) {
  const f = DATA?.family;
  if (!f) return [];
  if (name === "Dad") {
    const md = f.dad_on_mothers_day.find((x) => x.show === "The Mother");
    return [
      md && `Mother's Day ${md.year}: <b>The Mother</b>, the Jennifer Lopez assassin movie.`,
      f.dad_sister_birthday_picks.length && `On my sister's birthdays: <b>${listOf(f.dad_sister_birthday_picks.map(esc))}</b>.`,
      f.dad_holidays.christmas.length && `Christmas: ${listOf(f.dad_holidays.christmas.map(esc))}.`,
      f.dad_holidays.fathers_day.length && `Father's Day: ${f.dad_holidays.fathers_day[0].views} episodes of ${esc(f.dad_holidays.fathers_day[0].show)}.`,
      `Quits <b>${f.quit_rate.Dad}%</b> of shows after one episode.`,
    ].filter(Boolean);
  }
  if (name === "Mom") return [];  // her facts live in shelves and her persona now
  if (name === "Sister") return [
    `The biggest rewatcher in the family: <b>${f.profiles["My sister"].rewatch_pct}%</b> of what she watches is a repeat.`,
    `I was first on <b>${f.me_to_sister.first} of ${f.me_to_sister.shared}</b> shows we share. I'm her tastemaker.`,
  ];
  return [];
}

// Their watcher persona, the same types as the How We Watch slides.
function peekPersona(name) {
  const f = DATA?.family, hb = f?.habits;
  if (!hb) return "";
  const stat = (v, l) => `<div><b>${v}</b><span>${l}</span></div>`;
  const P = {
    Mom: hb.Mom && f.parents?.Mom && { type: "The movie person", tag: "One sitting, done.",
      about: `Hindi movies, start to finish in a night: ${n(f.parents.Mom.movies)} of them. When she does pick a series, she wants it over fast. Once she's seen it, she's seen it. Rewatches: basically never.`,
      stats: [stat(n(f.parents.Mom.movies), "Hindi movies"), stat(`${f.parents.Mom.movie_pct}%`, "of her watching is movies"), stat(`${f.parents.Mom.fast}%`, "of seasons done in 3 days"), stat(`${f.profiles.Mom.rewatched}`, "rewatches, ever")] },
    Dad: hb.Dad && { type: "The sampler", tag: "A serial killer… of pilots.",
      about: `He'll try anything once, and usually only once. The survivors are cartels, bikers and crime families, plus the only Spanish and Korean thrillers in the house. Lots of movies, almost no rewatches.`,
      stats: [stat(n(hb.Dad.titles), "different titles"), stat(`${f.quit_rate.Dad}%`, "quit after episode 1"), stat(hb.Dad.eps_per_show, "episodes a show"), stat(`${hb.Dad.movie_pct}%`, "movies")] },
  }[name];
  if (!P) return "";
  return `<div class="peek__persona"><p class="peek__label">Watcher type</p><h3>${P.type}</h3><p class="peek__tag">${P.tag}</p>
    <p class="peek__about">${P.about}</p><div class="peek__stats">${P.stats.join("")}</div></div>`;
}

// Who he is / who she is: what each parent's history gives away beyond favorites, with the evidence.
function whoFacts(name) {
  const f = DATA?.family, pp = f?.parents?.[name], w = pp?.who, d = f?.detective;
  if (!w || !d) return [];
  const a = f.arrival, yr = w.by_year;
  const since = Object.entries(yr).filter(([y]) => y > "2022").map(([, v]) => v);
  const fact = (label, guess, signal, ev, bg) => ({ label, guess, signal, ev, bg });
  return (name === "Dad" ? [
    fact("Family", "A dad of<br><em>two girls</em>", "Whose shows fill his profile",
      `Only ${d.dad_file_dad}% of the Dad profile is Dad. ${d.dad_file_daughters}% is his daughters: Disney Channel, teen dramas, then cartoons. He moved to Mom's profile, where he's ${d.mom_file_dad}% of the views.`, { montage: postersOf(["Liv and Maddie", "Jessie", "Good Luck Charlie", "Lab Rats", "Bunk'd", "Mighty Med"]) }),
    fact("November 2016", `${a.dad_before} a week<br>→ <em>${a.dad_after}</em>`, "His views per week, before and after",
      "The two months before her sister arrived in November 2016, against the weeks after. A new baby at home. Something small took over his evenings.", { black: true }),
    w.docs >= 50 && fact("Interests", "A history<br><em>buff</em>", "Documentaries, by topic",
      `${w.docs} documentary episodes: ${listOf(w.history_docs.slice(0, 3))}. Empires, wars and outlaws.`, { img: backdropOf(w.history_docs[0]) }),
    fact("Routine", `${w.top_day} is<br><em>TV night</em>`, "Which day of the week he presses play",
      `${w.top_day}: ${w.top_day_pct}% of his watching. ${w.low_day}: ${w.low_day_pct}%. The week belongs to work.`, { black: true }),
  ] : [
    fact("Her profile", "Shared with<br><em>her husband</em>", "Who's really watching on the Mom profile",
      `Only ${d.mom_file_mom}% of the Mom profile is Mom. ${d.mom_file_dad}% is Dad's cartels and war documentaries; the rest is us kids. I split it by language, genre and kids' tags.`, { wall: true }),
    w.fresh_pct != null && fact("Timing", `${w.fresh_pct}%<br><em>brand new</em>`, "How old a show is when she starts it",
      `${w.fresh_pct}% of her series episodes were watched within a year of the premiere. Dad: ${f.parents.Dad.who.fresh_pct}%. She watches what just came out.`, { black: true }),
    f.mom_hindi_lead && fact("Taste", `First on<br><em>${f.mom_hindi_lead.mom_first} of ${f.mom_hindi_lead.shared}</em>`, "Who got to a shared Hindi title first",
      "The Hindi titles she and I both watched. She found most of them first. The family's Hindi tastemaker.", { montage: postersOf(f.mom_first_titles || []) }),
    yr["2021"] && yr["2022"] && since.length && fact("2022", `${yr["2021"]} → <em>${yr["2022"]}</em>`, "Her views per year",
      `2021 to 2022, and ${Math.min(...since)} to ${Math.max(...since)} every year since. Netflix became hers.`, { black: true }),
    pp.srk_years && fact("Generation", "'90s<br><em>Shah Rukh</em>", "The oldest films she goes back to",
      Object.entries(pp.srk_years).sort((x, y) => x[1] - y[1]).slice(0, 3).map(([t, y]) => `${t} (${y})`).join(", ") + ". She came of age with these.", { montage: (pp.srk || []).map((t) => ({ img: posterOf(t), tag: pp.srk_years[t] })) }),
    f.kapil_same_day && fact("Watches with", "Her<br><em>daughter</em>", "Same show, same day",
      `The Great Indian Kapil Show: she and I watched it on the same day ${f.kapil_same_day} times.`, { img: backdropOf("The Great Indian Kapil Show") }),
  ]).filter(Boolean);
}
const whoScenes = (name) => whoFacts(name).map((x, i) => ({ dur: 5.5, ...x.bg, center: !x.bg.img, alt: i % 2 === 1,
  kicker: `${name === "Dad" ? "Who he is" : "Who she is"} · ${x.label}`, line: x.guess, sub: `${x.signal}. ${x.ev}` }));

// Netflix's Top 10 look (big outlined numbers), in one scrollable row.
const saysLine = (show, who) => { const x = saysFor(show, who); return x ? `<span class="says">${esc(x)}</span>` : ""; };
function peekTop10(list, who, title = "Top 10") {
  return row(title, "", list.map((t, i) => `<div class="top10"><span class="top10__num" aria-hidden="true">${i + 1}</span><div class="top10__col"><div class="tile tile--static" aria-label="${esc(t.show)}">${art(t.show, { tall: true })}<span class="tag">${t.views} eps</span></div>${saysLine(t.show, who)}</div></div>`));
}
// A Netflix wide tile with its two caption lines underneath (title, then a grey line), like "Hooked from the First Episode".
function capTile(show, { badge = "", top = esc(show), line = "", tag = "div", cls = "", attrs = "" } = {}) {
  return `<${tag} class="cap${cls ? ` ${cls}` : ""}" ${attrs}><span class="tile tile--static">${art(show)}${badge ? `<span class="tag">${esc(badge)}</span>` : ""}</span>
    <b class="cap__top">${top}</b>${line ? `<span class="cap__line">${esc(line)}</span>` : ""}</${tag}>`;
}

// Dad's and Mom's approved peek: top genre, top 10, each year (Mom: movies a year), then the lock.
function peekParent(name) {
  const pp = DATA?.family?.parents?.[name];
  if (!pp) return "";
  const his = name === "Dad" ? "His" : "Her", f = DATA.family;
  const genre = name === "Mom" ? "Bollywood movies, and Hindi crime for series" : pp.genres.slice(0, 2).map((g) => g.genre.toLowerCase()).join(" and ").replace(/^drama and crime$/, "crime drama");
  const rows = [peekTop10(pp.top, name, `${his} Top 10${name === "Mom" ? " Series" : ""}`)];
  if (name === "Dad") rows.push(row("His #1 Show Every Year", genre, pp.years.map((y) => capTile(y.show, { badge: `#1 of ${y.year}`, line: saysFor(y.show, "Dad") }))));
  else {
    rows.push(row("Hindi Movies Every Year", genre, pp.years.map((y) => { const pick = (y.titles || []).find((t) => ART[t]) || y.show;
      return capTile(pick, { badge: `${y.movies} movies`, top: `${y.year} · ${esc(pick)}`, line: saysFor(pick, "Mom") }); })));
    rows.push(row("Mumma Watched It First", `${f.mom_hindi_lead.mom_first} of our ${f.mom_hindi_lead.shared} shared Hindi titles`, f.mom_first_titles.map((t) => capTile(t, { badge: "Mumma First", line: saysFor(t, "Mom") }))));
    rows.push(row("Moms, Dads and Grandparents", `${f.mom_parent_titles.length} titles. Dad has ${f.dad_parent_titles.length}, both deadly`, f.mom_parent_titles.map((t) => capTile(t))));
  }
  if (pp.srk?.length) rows.push(row("The Shah Rukh Shelf", `${pp.srk.length} films`, pp.srk.map((t) => capTile(t, { badge: pp.srk_years?.[t] ? String(pp.srk_years[t]) : "" }))));
  return rows.join("");
}

// Dad's impeccable timing: poster cards for what he pressed play on, on the days that matter. Click one for the story.
function peekSpecial(pp) {
  const t = pp.timing || [];
  if (!t.length) return "";
  return row("Impeccable Timing", "tap a title for the story", t.map((r, i) => capTile(r.show, { tag: "button", cls: "peek__tcard", attrs: `type="button" data-t="${i}"`, badge: `${r.day} ${r.year}`, line: "Tap for the story" })))
    + `<div class="peek__story" id="peek-story" hidden></div>`;
}
function wireTiming(el) {
  const t = DATA?.family?.parents?.Dad?.timing || [];
  const story = el.querySelector("#peek-story");
  el.querySelectorAll(".peek__tcard").forEach((b) => b.addEventListener("click", () => {
    const r = t[b.dataset.t];
    const open = b.classList.contains("is-on");
    el.querySelectorAll(".peek__tcard").forEach((x) => x.classList.remove("is-on"));
    if (open) { story.hidden = true; return; }
    b.classList.add("is-on");
    story.innerHTML = `<p class="peek__kicker">${esc(r.day)} ${r.year}</p><h3>${esc(r.show)}</h3>
      <p><b>What it is:</b> ${esc(r.about)}</p><p><b>That day:</b> ${esc(r.when)}</p><p class="peek__irony">${esc(r.irony)}</p>`;
    story.hidden = false;
  }));
}

// Amaira is public (data only): her top 10 and her #1 show every year.
function peekAmaira() {
  const a = DATA?.family?.amaira, c = DATA?.family?.copy_cat || [];
  if (!a?.top?.length) return "";
  return peekTop10(a.top, "Sister", "Her Top 10")
    + row("Watch Me Grow Up", "her #1 show at every age", a.years.map((y) => capTile(y.show, { badge: `Age ${sisterAge(y.year)}`, top: `${esc(y.show)} · ${y.year}`, line: saysFor(y.show, "Sister") })))
    + (c.length >= 5 ? row("Copy Cat", `${c.length} titles she watched after me. She's never found one first.`, c.map((x) => capTile(x.show, { badge: `Me ${x.me} → her ${x.her}` }))) : "");
}

function peekProfile(p) {
  const f = DATA?.family;
  const who = p.name === "Sister" ? "My sister" : p.name;
  const pk = f?.profiles?.[who];
  let el = $("#peek");
  if (!el) {
    el = document.createElement("div");
    el.id = "peek"; el.className = "peek"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
    document.body.appendChild(el);
    el.addEventListener("click", (e) => { if (e.target === el || e.target.closest(".peek__close")) el.hidden = true; });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") el.hidden = true; });
  }
  const label = p.name === "Sister" ? "my sister" : p.name;
  const heroShow = (DATA?.family?.parents?.[p.name]?.top || DATA?.family?.amaira?.top || [])[0]?.show;
  const heroImg = p.name === "Sister" ? backdropOf(DATA?.family?.amaira?.top?.[0]?.show) : backdropOf(heroShow);
  el.innerHTML = `<div class="peek__card">
    <button class="peek__close" type="button" aria-label="Close">×</button>
    <div class="peek__hero" style="${heroImg ? `background-image:url('${heroImg}')` : ""}"><div class="peek__stage" aria-hidden="true"></div><div class="peek__herotext">
      ${SPECIAL[p.name] && FILMS[SPECIAL[p.name]] ? (() => { const sf = FILMS[SPECIAL[p.name]], [who, title] = sf.subtitle.split(": ");
        return `<p class="peek__because">Because you opened ${NICK[p.name]}'s profile</p>
        <p class="peek__mark"><span class="peek__s">S</span>SPECIAL · ${sf.ep}</p>
        <h2 class="peek__herotitle">${esc(who)}<small>${esc(title || "")}</small></h2>
        <p class="hero__meta peek__billmeta">${[["Special"], [BILL[p.name].genre], [BILL[p.name].years], [runtime(sf)]].map(([x]) => `<span>${x}</span>`).join('<span class="dot"></span>')}<span class="dot"></span><span class="rating">${BILL[p.name].rating}</span></p>
        <p class="peek__billcopy">${esc(sf.blurb)}</p>
        <div class="peek__billbtns"><button class="btn btn--light" type="button" data-film="${SPECIAL[p.name]}">▶ Play</button><button class="btn btn--dark" type="button" data-peek-more>More Info</button></div>
        <span class="peek__badge"><i></i>Household Special</span>`; })()
        : `<h2 class="peek__herotitle">${NICK[p.name] || p.name}</h2>`}</div></div>
    <div class="peek__head"><span class="avatar avatar--sm">${avatar(p, "peek")}</span><div><p class="peek__kicker">Peeking at</p><h2>${p.name}</h2></div></div>
    ${DATA?.family?.parents?.[p.name] ? peekParent(p.name) + (p.name === "Dad" ? peekSpecial(DATA.family.parents.Dad) : "")
      : p.name === "Sister" && DATA?.family?.amaira ? peekAmaira() : pk ? `<p class="peek__label">${p.name === "Sister" ? "Her" : p.name === "Mom" ? "Her" : "His"} top shows</p>
      <div class="peek__top">${pk.top.map((t, i) => `<div class="peek__show">${art(t.show, { tall: true })}<b>${i + 1}. ${esc(t.show)}</b><span>${t.views} episodes</span></div>`).join("")}</div>
      <ul class="peek__lines">${peekLines(p.name).map((l) => `<li>${l}</li>`).join("")}</ul>` : ""}
    <div class="peek__wall" aria-hidden="true">${Array.from({ length: 3 }, () => `<div class="peek__ghostrow">${Array.from({ length: 7 }, () => "<i></i>").join("")}</div>`).join("")}</div>
    <div class="peek__locked"><span class="peek__lock">${LOCK_ICON}</span><b>The rest of ${label}'s profile is locked.</b><span>${p.name === "Dad" ? "He's a private guy." : p.name === "Mom" ? "She's busy finishing a movie." : "She's busy rewatching iCarly."}</span></div>
  </div>`;
  el.hidden = false;
  playBehind(el.querySelector(".peek__stage"), SPECIAL[p.name], () => el.hidden);
  el.querySelector("[data-peek-more]")?.addEventListener("click", () => el.querySelector(".row")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  el.querySelectorAll("[data-film]").forEach((b) => b.addEventListener("click", () => { el.hidden = true; }));
  wireTiming(el);
  wireRows(el);
  el.querySelector(".peek__close").focus();
}

// Manage Profiles: Netflix's account page, pointed at this project.
function openAccount() {
  let el = $("#acct");
  if (!el) {
    el = document.createElement("div");
    el.id = "acct"; el.className = "acct"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Profiles");
    document.body.appendChild(el);
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-acct-close]")) { el.hidden = true; document.body.classList.remove("locked"); }
      const r = e.target.closest("[data-acct-profile]");
      if (!r) return;
      const p = PROFILES.find((x) => x.name === r.dataset.acctProfile);
      el.hidden = true; document.body.classList.remove("locked");
      if (!p.me && DATA?.family) peekProfile(p);
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !el.hidden) { el.hidden = true; document.body.classList.remove("locked"); } });
  }
  const hb = DATA?.family?.habits || {};
  const type = { Dad: "The sampler", Mom: "The movie person", Suhani: "The binger", Sister: "The superfan" };
  const views = { Dad: hb.Dad, Mom: hb.Mom, Suhani: hb.Me, Sister: hb["My sister"] };
  const nav = [["Overview", "#top", '<path d="M4 11 12 4l8 7v9H4Z" />'], ["Membership", "case-study.html", '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>'],
    ["Devices", "#house", '<rect x="3" y="5" width="13" height="10" rx="1.5"/><rect x="16" y="9" width="5" height="10" rx="1"/><path d="M7 19h6"/>'], ["Profiles", null, '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 10h.01M15 10h.01M9 15c2 1.5 4 1.5 6 0"/>']];
  el.innerHTML = `<div class="acct__top"><span class="acct__logo">STILL WATCHING</span><span class="avatar avatar--sm">${avatar(PROFILES.find((p) => p.me))}</span></div>
    <div class="acct__body">
      <aside class="acct__nav"><button type="button" class="acct__back" data-acct-close>← Back to Still Watching</button>
        ${nav.map(([t, href, icon]) => `<${href ? `a href="${href}" data-acct-close` : 'span aria-current="page"'} class="acct__link${href ? "" : " is-on"}"><svg viewBox="0 0 24 24">${icon}</svg>${t}</${href ? "a" : "span"}>`).join("")}</aside>
      <main class="acct__main"><h1>Profiles</h1><p class="acct__sub">Privacy controls and permissions</p>
        <details class="acct__card"><summary><svg viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6Z M12 8v5M12 16h.01"/></svg><span><b>Adjust privacy controls</b><small>What I blocked, and what never leaves my laptop</small></span><i>›</i></summary>
          <p>The raw exports (mine and my family's) are gitignored. The site ships only per-show and per-month summaries. Titles that shouldn't be public are filtered by a private blocklist, and the list itself stays private, since publishing it would reveal exactly what it hides. Silences and streaks are computed from every active day, blocked titles included, so hiding a title can't fake a gap.</p></details>
        <h2>Profile Settings</h2>
        <div class="acct__list">${PROFILES.map((p) => `<button type="button" class="acct__row" data-acct-profile="${p.name}">
          <span class="avatar avatar--sm">${avatar(p)}${p.kids ? '<span class="avatar__kids">kids</span>' : ""}</span>
          <span class="acct__who"><b>${p.name === "Sister" ? "Amaira" : p.name}</b><small>${type[p.name]}${views[p.name] ? ` · ${n(views[p.name].titles)} titles` : ""}</small></span>
          ${p.me ? '<span class="acct__now">Now Watching</span>' : ""}<i>›</i></button>`).join("")}
          <button type="button" class="acct__add" id="acct-add">Add Profile</button>
          <p class="acct__note">Add up to 5 profiles for anyone who lives with you.</p></div>
      </main></div>`;
  el.querySelector("#acct-add").addEventListener("click", () => toast("This family of 4 is full. Unless you're mine or Amaira's future husband, back off, mister."));
  el.hidden = false;
  document.body.classList.add("locked");
  el.querySelector(".acct__back").focus();
}

function setupProfiles() {
  const me = PROFILES.find((p) => p.me);
  $("#nav-avatar").innerHTML = avatar(me, "nav");
  // The avatar opens a Netflix-style profile menu.
  const menu = $("#pmenu"), btn = $("#switch-profile");
  const others = PROFILES.filter((p) => !p.me);
  $("#pmenu-profiles").innerHTML = others.map((p, i) =>
    `<button class="pmenu__profile" role="menuitem" type="button" data-other="${i}"><span class="avatar avatar--sm">${avatar(p, `m${i}`)}${p.kids ? '<span class="avatar__kids">kids</span>' : ""}</span>${p.name}</button>`).join("");
  const setOpen = (open) => { menu.hidden = !open; btn.setAttribute("aria-expanded", String(open)); };
  btn.addEventListener("click", (e) => { e.stopPropagation(); setOpen(menu.hidden); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".nav__menuwrap")) setOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  const backToProfiles = () => { try { sessionStorage.removeItem("entered"); } catch {} scrollTo({ top: 0 }); location.reload(); };
  $("#pmenu-manage").addEventListener("click", () => { setOpen(false); openAccount(); });
  $("#pmenu-signout").addEventListener("click", backToProfiles);
  $("#pmenu-profiles").addEventListener("click", (e) => {
    const b = e.target.closest("[data-other]");
    if (!b) return;
    setOpen(false);
    const p = others[b.dataset.other];
    if (DATA?.family) return peekProfile(p);
    toast(`That's ${p.name === "Sister" ? "my sister" : p.name}'s profile. This site only has Suhani's history.`);
  });
  const gate = $("#profiles");
  let seen = false;
  try { seen = sessionStorage.getItem("entered") === "1"; } catch {}
  if (seen) { gate.remove(); return; }
  document.body.classList.add("locked");

  $("#profile-list").innerHTML = PROFILES.map((p, i) => `
    <button class="profile" type="button" data-profile="${i}">
      <span class="avatar">${avatar(p, i)}<canvas class="avatar__recon" aria-hidden="true"></canvas><span class="avatar__status" aria-hidden="true"></span>${p.me ? `<span class="avatar__lock">${LOCK_ICON}</span>` : ""}${p.kids ? '<span class="avatar__kids">kids</span>' : ""}</span>
      <span class="profile__name">${p.name}</span>
    </button>`).join("") + `
    <button class="profile profile--add" type="button" data-profile="add">
      <span class="avatar" aria-hidden="true">+</span><span class="profile__name">Add Profile</span>
    </button>`;

  // Rebuild each face from data, one after another; hovering replays it.
  [...document.querySelectorAll("#profile-list .profile")].forEach((b, i) => {
    const p = PROFILES[b.dataset.profile];
    if (!p) return;
    const av = b.querySelector(".avatar"), play = reconstruct(av, p.name);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { av.classList.add("is-revealed"); return; }
    setTimeout(play, 300 + i * 450);
    let last = 0;
    b.addEventListener("mouseenter", () => { if (av.classList.contains("is-revealed") && performance.now() - last > 3500) { last = performance.now(); play(); } });
  });
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
    if (key === "add") return say(b, "Woahhhhhhhhh. This family of 4 is full. Unless you're mine or Amaira's future husband, back off, mister.");
    const p = PROFILES[key];
    if (p.me) return lockScreen();
    if (DATA?.family) return peekProfile(p);
    say(b, `That's ${p.name === "Sister" ? "my sister" : p.name}'s profile. This site only has Suhani's history.`);
  });
  // Suhani's profile: a PIN screen that turns into what the dataset actually contains.
  const lockScreen = () => {
    const pin = $("#pin");
    ["#profile-list", ".profiles__title", "#profile-peek", "#profile-hint", "#manage"].forEach((sel) => { const el = $(sel); if (el) el.style.display = "none"; });
    pin.hidden = false;
    requestAnimationFrame(() => pin.classList.add("is-on"));
    $("#pin-go").focus();
  };
  $("#pin-go").addEventListener("click", () => {
    const pin = $("#pin");
    pin.classList.remove("is-on");
    pin.innerHTML = `<p class="pin__narration"><span>Eleven years ago, a nine-year-old pressed play.</span><span>Netflix remembered.</span></p>`;
    requestAnimationFrame(() => pin.classList.add("is-on"));
    setTimeout(enter, 3400);
  });
  // Hovering a profile: the page glows in their color and teases what the data knows.
  const peekText = $("#profile-peek");
  $("#profile-list").addEventListener("pointerover", (e) => {
    const b = e.target.closest(".profile");
    const p = b && PROFILES[b.dataset.profile];
    if (!p) { peekText.innerHTML = ""; gate.style.removeProperty("--glow"); return; }
    gate.style.setProperty("--glow", PROFILE_GLOW[p.name]);
    const [a, q] = PROFILE_TEASE[p.name](DATA?.family);
    peekText.innerHTML = `<b>${a}</b><span>${q}</span>`;
  });
  $("#profile-list").addEventListener("focusin", (e) => e.target.dispatchEvent(new Event("pointerover", { bubbles: true })));
  $("#manage").addEventListener("click", (e) => say(e.currentTarget, "Manage profiles? Suhani and Dad agree on almost nothing. They agree on this: nobody manages them."));
  $(`[data-profile="${PROFILES.indexOf(me)}"]`).focus();
}

// ---------- hero ----------
function setupHero() {
  const dot = '<span class="dot"></span>';
  const from = parse(DATA.totals.from).getFullYear(), to = parse(DATA.totals.to).getFullYear();
  const eps = Object.keys(FILMS).length;

  // The billboard sells the series: seasons of short films, not one finding.
  $("#hero-meta").innerHTML = ["Coming of Age", "Docuseries", `${from}–${to}`, `${SEASONS.length} Seasons`, `${eps} Episodes`].map((x) => `<span>${x}</span>`).join(dot);
  $("#hero-copy").textContent =
    `${to - from} years of one Netflix account, cut into ${SEASONS.length} seasons of short episodes and made with love. ` +
    `Every scene is built from my viewing history: a nine-year-old fresh from Singapore, a pandemic binge, ` +
    `a dorm where the password stopped working. Start with Season 1, or pick an episode.`;
  $("#hero-badges").innerHTML = `<span class="chip"><i></i>New: Season ${SEASONS.length}, ${esc(SEASONS.at(-1).title)}</span>`;

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
// A Netflix-style badge and episode chip for a wide tile, from my data.
function badgeFor(name) {
  const p = DATA.profile;
  if (p.finished.some((f) => f.show === name)) return "Finished";
  if (p.comebacks.some((c) => c.show === name)) return "Comeback";
  return tagFor(name);
}
function wideTile(name, extra = "") {
  const s = DATA.shows[name];
  return tile(name, `<span class="tag">${esc(badgeFor(name))}</span>${s ? `<span class="tile__eps">${s.views} ${s.kind === "movie" ? "view" : "eps"}</span>` : ""}${extra}`);
}

function tagFor(name) {
  const s = DATA.shows[name];
  if (!s) return "Watched";
  const owned = DATA.yearly.find((y) => y.show === name && y.year >= 2018);
  if (owned) return `#1 of ${owned.year}`;
  if (s.best_day.episodes >= 10) return `${s.best_day.episodes} in One Day`;
  if (yearsOf(s) >= 4) return "Comfort Show";
  if (s.kind === "movie") return "Movie";
  return s.views === 1 ? "Pilot Only" : `${s.views} Episodes`;
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
    return eps ? `<button type="button" class="on" data-year-show="${esc(s.show)}" data-year="${y}" title="${y}: ${eps} episode${eps === 1 ? "" : "s"}. Click to see them." aria-label="${esc(s.show)} in ${y}: ${eps} episodes"></button>`
      : `<i title="${y}"></i>`;
  }).join("")}</span>`;
}

// A lit year square: the episodes I watched that year, with stills (Netflix's export has no video).
function openYear(show, year) {
  const s = DATA.shows[show], eps = s?.by_year[year] || 0, stills = STILLS[show]?.[year] || [];
  const q = encodeURIComponent(`${show} official trailer`);
  openModal(`${show} · ${year}`, `
    <p class="modal__meta"><span class="match">${eps} episode${eps === 1 ? "" : "s"} that year</span><span>age ${year - BIRTH_YEAR}</span></p>
    ${stills.length ? `<div class="stills">${stills.map((x) => `<figure><img src="${esc(x.img)}" alt="" loading="lazy"><figcaption>${esc(x.ep)}</figcaption></figure>`).join("")}</div>`
      : `<p class="modal__copy">No stills for this year, but here's what the square means: I came back to ${esc(show)} ${eps} time${eps === 1 ? "" : "s"} in ${year}.</p>`}
    <a class="btn btn--light" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">▶ Watch the trailer</a>`);
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-year-show]");
  if (!b) return;
  e.preventDefault(); e.stopPropagation();
  openYear(b.dataset.yearShow, b.dataset.year);
}, true);

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
      `<div class="top10"><span class="top10__num" aria-hidden="true">${i + 1}</span><div class="top10__col">${tile(s.show, `<span class="tag">${esc(tagFor(s.show))}</span>`, { tall: true })}${saysLine(s.show, "Me")}</div></div>`)),
    collection(),
    row("Episodes", "five seasons of short films made from my history", Object.entries(FILMS).map(([key, f]) => `<button class="tile film-tile" type="button" data-film="${key}" aria-label="Play ${f.ep}: ${esc(f.subtitle)}">
      ${art(f.art, { label: f.tile || f.subtitle })}<span class="tile__ribbon">S${f.season}<b>E${f.num}</b></span><span class="film-tile__play">▶</span></button>`)),
    row("Watch Me Grow Up", "my #1 show at every age", yearly.map((y) =>
      `<div class="grow">${tile(y.show, `<span class="tile__ribbon">AGE<b>${y.year - BIRTH_YEAR}</b></span><span class="tile__meta tile__meta--left">${y.year} · ${y.episodes} eps</span>`)}${saysLine(y.show, "Me")}</div>`)),
    ...(DATA.family?.mom_first_titles?.length ? [row("Because Mumma Kept Recommending It", "she watched them first, I eventually gave in", DATA.family.mom_first_titles.filter((t) => t !== "Tribhuvan Mishra CA Topper").map((t) => wideTile(t)))] : []),
    row("Hooked From the First Episode", "4+ episodes on day one", DATA.hooked.map((h) =>
      tile(h.show, `<span class="tag">${h.day_one} on Day One</span><span class="tile__eps">${h.views} eps</span>`))),
    row("Home for Summer & Absolutely Starving", `a whole year of college, then ${n(windows.summer_2025.views)} views in two months`, windows.summer_2025.top.map((s) => wideTile(s.show))),
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
// A donut of slices [{genre, pct}], with a legend.
const PIE_COLORS = ["#e50914", "#ff6b9a", "#a53bff", "#ffb020", "#2f8cff", "#2ec27e", "#ff7a3d", "#8a8a8a", "#555"];
function pie(slices) {
  let at = 0;
  const stops = slices.map((x, i) => { const a = at; at += x.pct; return `${PIE_COLORS[i % PIE_COLORS.length]} ${a}% ${at}%`; }).join(", ");
  return `<div class="pie"><div class="pie__donut" style="background:conic-gradient(${stops})"><span><b>${Math.round(slices[0].pct)}%</b>${esc(slices[0].genre)}</span></div>
    <ul class="pie__legend">${slices.filter((x) => x.pct >= 1).map((x, i) => `<li><i style="background:${PIE_COLORS[i % PIE_COLORS.length]}"></i>${esc(x.genre)} <b>${Math.round(x.pct)}%</b></li>`).join("")}</ul></div>`;
}

// Charts and tables live inside the films, never on the poster pages.
const viz = (html) => `<div class="scene__viz">${html}</div>`;

// Every profile side by side, for the How We Watch episode.
function habitsTable() {
  const hb = DATA.family?.habits;
  if (!hb) return "";
  const who = ["Me", "My sister", "Dad", "Mom"].filter((w) => hb[w]);
  const mo = (m) => new Date(2000, m - 1).toLocaleString("en-US", { month: "short" });
  const rows = [["Days with 6+ episodes", "binge_days"], ["Episodes per show", "eps_per_show"], ["Different titles", "titles"], ["Movies", "movie_pct", "%"], ["Top 5 shows' share", "top5_pct", "%"]];
  const best = (k) => Math.max(...who.map((w) => hb[w][k]));
  return `<table class="habits"><thead><tr><th></th>${who.map((w) => `<th>${w === "My sister" ? "Sister" : w}</th>`).join("")}</tr></thead><tbody>
            <tr class="habits__type"><td>Type</td>${who.map((w) => `<td>${{ Me: "The binger", "My sister": "The superfan", Dad: "The sampler", Mom: "The steady one" }[w]}</td>`).join("")}</tr>
            ${rows.map(([l, k, u = ""]) => `<tr><td>${l}</td>${who.map((w) => `<td${hb[w][k] === best(k) ? ' class="hot"' : ""}>${n(hb[w][k])}${u}</td>`).join("")}</tr>`).join("")}
            <tr><td>Favorite month</td>${who.map((w) => `<td>${mo(hb[w].month)}</td>`).join("")}</tr></tbody></table>`;
}

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
      { label: "AGE", img: bg(p.kids_early_top[0]), guess: "About 20, born around 2006", signal: "Who the shows are made for",
        ev: `Kids' shows were <b>${pct(p.kids_by_year["2016"])}</b> of 2016 (${listOf(p.kids_early_top)}), ${pct(p.kids_by_year["2018"])} of 2018 and almost nothing after 2019. Then teen rom-coms: ${listOf(p.teen_romcoms.slice(0, 3))}. A fourth-grader in 2015 graduates in 2024 and turns 20 in 2026.` },
      { label: "GENDER", img: bg("Bridgerton"), guess: "A young woman", signal: "What I choose",
        ev: `<b>${pct(p.romance_share)}</b> of my series episodes are tagged Romance, and most of my movies are rom-coms. My biggest shows are about girls growing up, Gossip Girl and Gilmore Girls, and "Girl" beats "Boy" in my titles <b>${DATA.words?.girl.length} to ${DATA.words?.boy.length}</b>.` },
      ...(DATA.genre_pie ? [{ label: "GENRES", img: bg("Gilmore Girls"), guess: "Romance first, always", signal: "Every series episode, one genre per show",
        ev: `${DATA.genre_pie.slice(0, 3).map((g) => `<b>${esc(g.genre)} ${Math.round(g.pct)}%</b>`).join(", ")}. ${listOf(DATA.genre_pie[0].shows.map(esc))} make Romance the biggest. Kids & Disney is everything before 2019. And Medical is one Grey's summer I never finished.` }] : []),
      { label: "CULTURAL BACKGROUND", img: bg("Heeramandi"), guess: "Indian, Hindi-speaking", signal: "The language of what I watch",
        ev: `<b>${hf.total} of my ${hf.movies} movies</b> are Hindi films, starting with ${esc(hf.first)} in ${parse(hf.first_date).getFullYear()}. Hindi series went from ${pct(ms.language.Hindi || 0)} in middle school to <b>${pct(after.language.Hindi || 0)}</b> after graduating.` },
      { label: "HOME", img: bg("AMERICA'S SWEETHEARTS"), guess: "Texas", signal: "Deadlines, outages and one docuseries",
        ev: `US-style dates, a race to finish Friends before it left <b>U.S.</b> Netflix, and a busy week in February 2021, when the <b>Texas</b> power grid failed. America's Sweethearts: Dallas Cowboys Cheerleaders is the tiebreaker.` },
    ]],
    ["How I live", [
      { label: "ROUTINE", img: bg("Gilmore Girls"), guess: "A student", signal: "When I watch",
        ev: `Weekdays are <b>${pct(p.weekday_share.school)}</b> of my school-year watching and ${pct(p.weekday_share.summer)} in summer. The last 12 days of December average <b>${decRate.toFixed(1)}×</b> the first 19: finals, then winter break.` },
      { label: "MARCH 2020", img: bg(p.covid.top), guess: "Sent home when COVID hit", signal: "A sudden spike",
        ev: `February 2020: ${p.covid.feb_2020} views. March: <b>${p.covid.march_2020}</b>, ${p.covid.after_closure} of them after schools closed on March 13, mostly ${esc(p.covid.top)}.` },
      { label: "GRADUATION", img: bg(DATA.windows.last_summer_home.top[0].show), guess: "Graduated in spring 2024", signal: "The same six months, every high school year",
        ev: `January to June: ${Object.entries(p.senior_spring.by_year).map(([y, v]) => y === "2024" ? `<b>${y}: ${v}</b>` : `${y}: ${v}`).join(" · ")} views. Senior spring was <b>${p.senior_spring.views} views on ${p.senior_spring.days} days</b>. Then graduation, and <b>${p.senior_spring.summer_after}</b> views in the next seven weeks.` },
      { label: "EDUCATION", img: bg(DATA.windows.summer_2025.top[0].show), guess: "In college since fall 2024", signal: "Semesters against summers",
        ev: `Fall 2024: <b>${p.college.fall_2024}</b> views a day. Summer 2025, back home: <b>${p.college.summer_2025}</b>, ten times more. Fall 2025: ${p.college.fall_2025} again.` },
    ]],
    ["Who I live with", [
      { label: "MOVED", img: bg(el.top[0].show), guess: "New to America in 2015", signal: "When the history starts",
        ev: `The account's very first play: <b>${esc(p.first_title)}</b>, ${fmtDate(DATA.totals.from)}. Then a summer of Disney Channel. (We had just moved from Singapore to Cupertino.)` },
      ...(dallasGap ? [{ label: "MOVED AGAIN", img: bg(hs.top[0].show), guess: "A new state, a quiet start", signal: "Summer 2020, then a long silence",
        ev: `Summer 2020 was patchy, then <b>${dallasGap.days} days</b> with nothing, ${fmtShort(dallasGap.from)} to ${fmtDate(dallasGap.to)}: the first weeks of high school in a new state. The data never sees the moving truck, just the quiet after.` }] : []),
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
  const wh = p.what, momFresh = DATA.family?.parents?.Mom?.who?.fresh_pct;
  const pctOf = (x) => `${Math.round(x)}%`, yrs = (x) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x)} years`;
  if (wh) groups.push(["Watch", [
    { label: "WATCHING AHEAD", img: bg(wh.ahead.example.show), guess: "Always a few years ahead", signal: "The lead's age in season 1 vs. mine that day (hand-tagged, my top shows)",
      ev: `In <b>${wh.ahead.older_pct}%</b> of those episodes the lead is older than me. At ${wh.ahead.example.me} I started ${esc(wh.ahead.example.show)}, about a ${wh.ahead.example.lead}-year-old. Middle school: <b>${yrs(wh.ahead.by_era.middle)}</b> ahead on average. High school: ${yrs(wh.ahead.by_era.high)}. College flipped it to <b>${yrs(wh.ahead.by_era.college)}</b>: I went back to high school with ${esc(wh.ahead.college[0])}.` },
    { label: "MOTHERS & DAUGHTERS", img: bg(wh.mothers.top[0]), guess: "High school was mother-daughter TV", signal: "Shows about a mom and her daughter, by school",
      ev: `Elementary ${pctOf(wh.mothers.by_era.elementary)}, middle school ${pctOf(wh.mothers.by_era.middle)}, high school <b>${pctOf(wh.mothers.by_era.high)}</b>: ${listOf(wh.mothers.top.map(esc))}. Then I moved out: <b>${wh.mothers.by_era.college}%</b> in college. ${wh.mothers.away}% in Austin, ${wh.mothers.home}% home for the summer.` },
    { label: "CITY GIRL", img: bg(wh.places.nyc[1] || wh.places.nyc[0]), guess: "Big city, small circle", signal: "Where each show is set (hand-tagged, my top shows)",
      ev: `New York: <b>${wh.places.top[0].views}</b> episodes (${listOf(wh.places.nyc.map(esc))}). Small towns: <b>${wh.places.top[1].views}</b> (${listOf(wh.places.town.map(esc))}). Practically a tie, and that's me: I want a lively city with endless things to explore, and a small circle inside it. The Gilmore Girls feeling: the same coffee shop every morning, the same faces every day.` },
    { label: "SHOW AGE", img: bg(wh.show_age.favorites[0].show), guess: `My shows are ${parse(DATA.totals.to).getFullYear() - wh.show_age.fav_year}. I'm ${Math.floor((parse(DATA.totals.to) - parse("2006-03-06")) / 3.156e10)}.`, signal: "When my most-watched shows premiered",
      ev: `My top four: ${listOf(wh.show_age.favorites.map((x) => `${esc(x.show)} (${x.year})`))}. On average they premiered in <b>${wh.show_age.fav_year}</b>, older than me. Across every episode, the median show premiered in ${wh.show_age.median_year}, and <b>${wh.older_pct}%</b> of my episodes are from shows that started before I was born.${momFresh != null ? ` Only ${wh.fresh_pct}% were watched within a year of the premiere. Mumma's: ${momFresh}%.` : ""}` },
    ...(wh.release.length ? [{ label: "RELEASE DAY", img: bg(wh.release[0].show), guess: `${wh.release.length} seasons I couldn't wait for`, signal: "Release date vs. my last episode",
      ev: wh.release.map((r) => `${esc(r.show)} season ${r.season} (${fmtMonth(r.month)}): <b>all ${r.episodes} within ${r.days === 1 ? "a day" : `${r.days} days`}</b>`).join(". ") + ". Everything else waits years." }] : []),
  ]]);
  groups.push(["More", [
    { label: "A FINISHER", img: bg("The Vampire Diaries"), guess: `${p.finished.length} shows, start to finish`, signal: "Episodes watched against episodes made",
      ev: `Every episode, or nearly: ${listOf(finished)}. Friends: <b>${fr.watched} of ${fr.total}</b>.` },
    { label: "A TV PERSON", img: bg("Grey's Anatomy"), guess: "Episodes, not movies", signal: "What I press play on",
      ev: `<b>${pct(p.series_share)}</b> of everything I've watched is an episode. <b>${p.big_days} days</b> with 10 or more.` },
    { label: "U.S. CATALOG", img: bg("Friends"), guess: "Watching U.S. Netflix", signal: "A deadline only U.S. viewers had",
      ev: `Friends left U.S. Netflix on Jan 1, 2020. I watched <b>${fr.december} episodes that December</b>, ${fr.last_week} of them in the last week, racing the deadline.` },
    { label: "ATTACHMENT ISSUES", img: bg("Friends"), guess: "I hate goodbyes", signal: "How I end things (I don't)",
      ev: `I watched <b>${p.finished.length} shows to the very last episode</b>. I come back to old ones years later: ${listOf(p.comebacks.slice(0, 3).map((c) => `${esc(c.show)} after ${Math.round(c.years)} years`))}. And on Friends' last night on U.S. Netflix, I kept going past midnight: <b>${fr.jan1} more episodes</b> logged Jan 1, 2020. I get emotional.` },
    { label: "MOOD", img: bg(p.mood.darkest.show), guess: `Darkest: ${fmtMonth(p.mood.darkest.month)}`, signal: "The mood of the genres I reached for, month by month",
      ev: (() => {
        const ctx = { "2020-07": "the COVID summer right before moving to Dallas", "2021-01": "a COVID winter in a new state",
          "2019-12": "winter break, racing Friends off Netflix", "2022-12": "a vacation with no school" };
        const line = (m) => (ctx[m.month] ? `, ${ctx[m.month]}` : "");
        return `My darkest month: <b>${fmtMonth(p.mood.darkest.month)}</b>, mostly ${esc(p.mood.darkest.show)}${line(p.mood.darkest)}. My lightest: <b>${fmtMonth(p.mood.lightest.month)}</b>, ${p.mood.lightest.episodes} episodes of ${esc(p.mood.lightest.show)}${line(p.mood.lightest)}. It measures what I reached for, not how I felt.`;
      })() },
    { label: "SUMMERS", img: bg(DATA.windows.summer_2025.top[0].show), guess: "Summer is for bingeing", signal: "Watching per day: summer vs school year",
      ev: p.lifestyle.summers.map((x) => `${x.era} school: <b>${x.ratio}×</b>`).join(" · ") + `. In middle school summers were my quietest time; by college I watched almost three times as much in summer.` },
    { label: "MOVIE NIGHTS", img: bg("Bridgerton"), guess: "Movies are for breaks", signal: "When the movies happen",
      ev: `<b>${p.lifestyle.movies_on_breaks}%</b> of my movies land in December, January, June or July, a third of the year. Winter break 2026 alone: ${p.jan_2026.movies} movies.` },
    ...(DATA.show_run?.days ? [{ label: "STREAK", img: bg(DATA.show_run.show), guess: "Home for summer, never off", signal: "Days in a row with something on",
      ev: `My longest streak: <b>${DATA.streak.days} days in a row</b>, ${fmtShort(DATA.streak.from)} to ${fmtDate(DATA.streak.to)}, my first summer home from college. ${DATA.show_run.days} of those days were <b>${esc(DATA.show_run.show)}</b>: ${DATA.show_run.episodes} episodes, almost the whole series, in under a month.` }] : []),
    ...(DATA.friends_origin ? [(() => { const f = DATA.friends_origin; return { label: "FRIENDS", img: bg("Friends"), guess: "Hooked at 13, on a deadline", signal: "How Friends and I started, and why it was so rushed",
      ev: `My first Friends: ${fmtDate(f.sample)}, age ${f.sample_age}, ${f.sample_eps} episodes, then nothing for two and a half years. The real start was <b>${fmtDate(f.start)}, age ${f.age}</b>, with ${esc(f.start_ep)}. ${f.before_thanksgiving} episodes in the first two weeks, then Thanksgiving break hooked me: <b>${f.thanksgiving} on Thanksgiving Day</b>, ${f.thanksgiving_weekend} over the long weekend. But Friends was leaving U.S. Netflix on Jan 1, 2020, so I had <b>${f.days} days</b> for ten seasons: ${f.episodes} episodes, about ${Math.round(f.episodes / f.days)} a day. Our time together on Netflix was short, so I rushed it.` }; })()] : []),
    ...(DATA.big_december ? [(() => { const d = DATA.big_december; const mo = (m) => new Date(2000, m - 1).toLocaleString("en-US", { month: "long" }); return { label: "BIG ON DECEMBER", img: bg(d.years[0].show), guess: "December is my month", signal: "Views by month",
      ev: `December is <b>${d.share}%</b> of everything I've ever watched (${n(d.views)} views), when an average month would be 8.3%. ${mo(d.quietest.month)} is my quietest, just ${d.quietest.views}, so I go from quietest to loudest in two months. ${d.top_days} of my 20 biggest days are in December. The big ones: ${d.years.map((y) => `<b>${y.year}</b>: ${y.views} (${esc(y.show)})`).join(" · ")}.` }; })()] : []),
    { label: "RHYTHM", img: bg("Gilmore Girls"), guess: "Every third day", signal: "How often anything is on",
      ev: `Something's on <b>${pct(DATA.totals.active_days / (daysBetween(DATA.totals.from, DATA.totals.to)) * 100)}</b> of the days in my history. My record: <b>${DATA.streak.days} days in a row</b>, ${fmtShort(DATA.streak.from)} to ${fmtDate(DATA.streak.to)}, home for summer.` },
    ...(DATA.dark_years ? [(() => { const d = DATA.dark_years; const y = d.by_year; const peak = Object.entries(y).reduce((a, b) => (b[1] > a[1] ? b : a)); return { label: "DARK GENRES", img: bg("Stranger Things"), guess: "I can't handle dark content", signal: "Crime, thriller, horror and mystery, share of each year",
      ev: `Dark genres were ${Math.min(y["2017"], y["2018"], y["2019"])}–${Math.max(y["2017"], y["2018"], y["2019"])}% of 2017 to 2019 and peaked at <b>${peak[1]}% in ${peak[0]}</b>. And look at what "dark" meant: ${listOf(d.shows.map((x) => esc(x.show)))}. Teen mysteries and a missing plane. That's my ceiling, because I can't handle anything darker. The crime I do watch is Hindi, mostly with Mom: ${listOf(d.hindi.map((x) => esc(x.show)))}. Not too scary, a little funny, and it feels like home.` }; })()] : []),
    { label: "SCARE THRESHOLD", img: bg("Stranger Things"), guess: "Spooky, never scary", signal: "What horror I actually watch",
      ev: `Goosebumps literally gave me goosebumps. That's the line. Everything tagged horror in my history is spooky-for-teens: ${listOf(p.spooky.slice(0, 4).map((x) => `${esc(x.show)} (${x.views})`))}. ${p.horror_films.length === 1 ? `Real horror, ever: <b>${esc(p.horror_films[0].show)}</b>. It scared me and I quit it.` : `Real horror films, ever: <b>${p.horror_films.length}</b>.`}` },
    ...(DATA.family && DATA.family.freeze.mine.length ? [{ label: "BLACKOUT", img: bg("Never Have I Ever"), guess: "Rom-coms through the Texas freeze", signal: "Feb 14–20, 2021: the power outages",
      ev: `The week Texas froze and the power kept going out, our whole family watched <b>${DATA.family.freeze.family} things</b>. Mine: <b>${listOf(DATA.family.freeze.mine.map(esc))}</b>. Rom-coms by candlelight.` }] : []),
    { label: "HOLIDAYS", img: bg("Gilmore Girls"), guess: "Home for Christmas", signal: "December 24–26",
      ev: `Something on over Christmas in <b>${p.christmas_years} of ${parse(DATA.totals.to).getFullYear() - parse(DATA.totals.from).getFullYear()} years</b>, mostly a winter-break binge.` },
  ]]);
  // My family agreed to share these: aggregates only, no names or dates.
  const fam = DATA.family;
  if (fam) {
    const q = Object.entries(fam.pilot_quitters);
    const k = fam.kapil;
    groups.push(["Family", [
      ...(fam.habits ? (() => { const hb = fam.habits, pr = fam.profiles, q = fam.quit_rate; const mo = (m) => new Date(2000, m - 1).toLocaleString("en-US", { month: "long" });
        const top = (w) => pr[w].top[0];
        return [
          { label: "ME: THE BINGER", img: bg(top("Me").show), guess: "All in, every time", signal: "Depth over breadth",
            ev: `<b>${hb.Me.binge_days} days</b> with 6+ episodes, about one a month for eleven years. ${hb.Me.eps_per_show} episodes per show, the most in the family. I quit ${q.Me}% of pilots, but whatever survives gets finished, then rewatched. Peak season: ${mo(hb.Me.month)}.` },
          { label: "SISTER: THE SUPERFAN", img: bg(top("My sister").show), guess: "Same five shows, forever", signal: "How concentrated her watching is",
            ev: `<b>${hb["My sister"].top5_pct}%</b> of everything she watches is five shows, led by ${esc(top("My sister").show)} (${top("My sister").views} episodes). The most per day (${hb["My sister"].per_day}), the biggest rewatcher (${pr["My sister"].rewatch_pct}% repeats), the lowest quit rate (${q["My sister"]}%) and almost no movies (${hb["My sister"].movie_pct}%). Her month: ${mo(hb["My sister"].month)}, summer break.` },
          { label: "DAD: THE SAMPLER", img: bg(top("Dad").show), guess: "A serial killer… of pilots", signal: "Breadth over depth",
            ev: `<b>${n(hb.Dad.titles)} different titles</b>, more than the rest of us, at ${hb.Dad.eps_per_show} episodes each. He quits ${q.Dad}% after one episode. What survives is scary: ${listOf(pr.Dad.top.map((t) => esc(t.show)))}. A third of his watching is movies, and he's the only one watching Spanish and Korean crime. Rewatches: almost never.` },
          { label: "MOM: THE STEADY ONE", img: bg(top("Mom").show), guess: "A little, in Hindi, every so often", signal: "Pace and language",
            ev: `Only <b>${hb.Mom.binge_days} binge days</b> in eleven years, ${hb.Mom.per_day} things a day when she watches. Mostly Hindi, and the biggest movie person (${hb.Mom.movie_pct}%). Her show is ${esc(top("Mom").show)} (${top("Mom").views} episodes). She never rewatches, and she finds the Hindi shows before I do.` },
        ]; })() : []),
      { label: "PILOT QUITTERS", img: bg(DATA.top[0].show), guess: `${Object.keys(fam.quit_rate).at(-1)} finishes what she starts`,
        signal: "Chance of quitting a show after episode 1",
        ev: Object.entries(fam.quit_rate).map(([w, r], i) => `${i === 0 ? "<b>" : ""}${w}: ${r}%${i === 0 ? "</b>" : ""} <span class="dim">(${fam.pilot_quitters[w]} of ${fam.shows_started[w]} shows)</span>`).join("<br>") },
      { label: "TASTEMAKERS", img: bg("Fuller House"), guess: "How taste moves through my family", signal: "Who watched shared titles first",
        ev: `<b>Mom → me (Hindi):</b> of ${fam.mom_hindi_lead.shared} Hindi titles we share, she watched ${fam.mom_hindi_lead.mom_first} first, and I started ${fam.mom_hindi_lead.next_week} of them within a week of her.<br>
          <b>Me → my sister:</b> ${fam.me_to_sister.first} of ${fam.me_to_sister.shared}. I'm her tastemaker.<br>
          <b>Dad and me:</b> ${fam.dad_and_me.first} of ${fam.dad_and_me.shared} he saw first, but we never talk about shows. It's just Netflix's new releases finding us both.` },
      ...(fam.dad_on_mothers_day.some((x) => x.show === "The Mother") ? [{ label: "HAPPY MOTHER'S DAY", img: bg(DATA.top[1].show), guess: "Dad watched The Mother",
        signal: "What Dad watches on Mother's Day",
        ev: `Mother's Day ${fam.dad_on_mothers_day.find((x) => x.show === "The Mother").year}: Dad pressed play on <b>The Mother</b>, the Jennifer Lopez assassin movie. Other Mother's Days: ${listOf(fam.dad_on_mothers_day.filter((x) => x.show !== "The Mother").map((x) => esc(x.show)))}.` }] : []),
      { label: "TITLE ENERGY", img: bg(DATA.top[3].show), guess: "Comedy moms vs deadly moms", signal: "Titles about parents, by who watched",
        ev: `Mom's parents are comedies: <b>${listOf(fam.mom_parent_titles.slice(0, 4).map(esc))}</b>. Dad's moms are lethal: <b>${listOf(fam.dad_parent_titles.filter((t) => /Mother/.test(t)).map(esc))}</b>.` },
      { label: "THE FAMILY SHOW", img: bg("The Great Indian Kapil Show"), guess: "The Great Indian Kapil Show", signal: "The one show Mom and I share most",
        ev: `Mom: <b>${k.Mom || 0}</b> episodes. Me: <b>${k.Me || 0}</b>. We watched it on the same day ${fam.kapil_same_day} times.${k.Dad ? ` Dad: ${k.Dad}.` : ""}` },
      ...(fam.dad_sister_birthday_picks.length ? [{ label: "DAD'S PARTY PICKS", img: bg(DATA.top[2].show), guess: "Birthday-party energy", signal: "What Dad watched on my sister's birthdays",
        ev: `On my little sister's birthdays, Dad's picks: <b>${listOf(fam.dad_sister_birthday_picks.map(esc))}</b>. Happy birthday!` }] : []),
    ]]);
  }
  // What the words in the titles give away (show naming formulas like "The One With" left out).
  const w = DATA.words, ly = DATA.loyalty;
  if (w) {
    const me = Object.entries(ly.me_titles);
    groups.push(["Titles", [
      { label: "BEGINNINGS", img: bg("Gilmore Girls"), guess: "I like beginnings more than endings", signal: `Words for starting vs ending, in ${n(w.episodes)} episode titles`,
        ev: `<b>${w.beginnings}</b> titles about starting (Pilot, First, New, Welcome) and only <b>${w.endings}</b> about ending (Last, Goodbye, Finale). "Pilot" alone: ${w.pilots} different shows.` },
      { label: "GIRLY", img: bg("Gossip Girl"), guess: "Very girly", signal: "Girl vs Boy",
        ev: `<b>${w.girl.length}</b> titles with "Girl" in the name: ${listOf(w.girl.filter((t) => !/^An? /.test(t)).slice(0, 5).map(esc))}. Only ${w.boy.length} with "Boy", and half of those are To All the Boys, a rom-com about a girl. In episode titles, "girl" shows up in <b>${w.girl_shows}</b> shows, "boy" in ${w.boy_shows}.` },
      { label: "ROMANCE", img: bg("Love Hard"), guess: "Rom-coms, in Hindi and English", signal: "Love, in two languages",
        ev: `"Love" is the most repeated word in my episode titles: <b>${w.love_eps} titles across ${w.love_shows} shows</b>. "Hate": ${w.hate_eps}. English: ${listOf(w.love.slice(0, 5).map(esc))}. Hindi: <b>${w.hindi_love.length}</b> films with Pyaar, Dil or Dulhania, from ${esc(w.hindi_love.find((t) => /Dilwale/.test(t)) || w.hindi_love[0])} to ${esc(w.hindi_love.find((t) => /Badrinath/.test(t)) || w.hindi_love.at(-1))}.` },
      { label: "LOYAL", img: bg("Fuller House"), guess: "I crave consistency", signal: "How I start shows vs how I leave them",
        ev: `I quit <b>${DATA.family?.quit_rate?.Me ?? 47}%</b> of shows after one episode. But once I'm in, I don't leave. I rewatch: <b>${ly.rewatched}</b> episodes twice (mostly ${listOf(Object.keys(ly.rewatch_top).map(esc))}) and the same rom-coms again and again (${listOf(ly.movies_twice.slice(0, 4).map(esc))}). And when a show ends, I keep going. Episodes after the finale: ${listOf(ly.after_finale.slice(0, 4).map((x) => `${esc(x.show)} <b>${x.after}</b>`))}. Same characters, same places, no goodbyes.` },
      ...(DATA.front_row ? [(() => { const f = DATA.front_row; return { label: "FRONT ROW", img: bg("Never Have I Ever"), guess: "Late to the party, then front row", signal: "Release day vs my first play, and how far a show gets",
        ev: `I find Season 1 late: a median of <b>${f.s1_median} days</b> after release (${listOf(f.late.map((x) => `${esc(x.show)} ${Math.round(x.lag / 30)} months`))}). Once I'm hooked, I'm there: <b>${f.within_3} seasons</b> started within 3 days of release, ${listOf(f.same_day.map((x) => `${esc(x.show)} Season ${x.season}`))} on release day. Getting me hooked is the hard part. One episode: <b>${f.stay["1"]}%</b> chance I watch 10+. Two: ${f.stay["2"]}%. Three: <b>${f.stay["3"]}%</b>. Make it to episode 3 and I'm probably staying.` }; })()] : []),
      ...(DATA.picky ? [(() => { const k = DATA.picky; return { label: "PICKY", img: bg("Outer Banks"), guess: "Hype doesn't get me in. Drama does.", signal: `${k.quit} shows I quit after one episode vs ${k.kept} I stayed with`,
        ev: `<b>${k.netflix_quit}%</b> of my one-and-done shows are Netflix originals, vs ${k.netflix_kept}% of my keepers. I stay with network TV: ${listOf(k.network_kept.slice(0, 4).map(esc))}, 20+ episodes a season for years. ${k.dark_quits.length ? `Dark thrillers lose me after the pilot: ${listOf(k.dark_quits.map(esc))}. ` : ""}Dating shows too: ${listOf(k.dating_quit.map(esc))}, one episode each${k.matchmaking ? ` (Indian Matchmaking is the exception)` : ""}. K-dramas: ${k.korean_tried} tried, ${k.korean_kept} kept. Not enough drama, and drama is my thing: <b>${Math.round(k.drama_views / k.views * 100)}%</b> of everything I've watched is tagged Drama.` }; })()] : []),
      ...(DATA.favorites ? [(() => { const f = DATA.favorites; return { label: "FAVORITES", img: bg("Gossip Girl"), guess: "Blair Waldorf. And Rachel.", signal: "Which episodes I go back to",
        ev: `Before I ever binged Gossip Girl, I played exactly ${f.gg_early.length} episodes: ${listOf(f.gg_early.map((e) => `<b>${esc(e)}</b>`))}, the start of Chuck and Blair. Five years later I watched ${listOf(f.gg_twice.map(esc))} again. Friends fooled the data: it guessed Monica, then Chandler. The answer was Rachel, named in <b>${f.rachel_titles}</b> of my Friends titles, more than anyone.` }; })()] : []),
      { label: "THE ME ERA", img: bg("Never Have I Ever"), guess: "High school was about me", signal: "Episode titles with I, me or my",
        ev: me.map(([e, v]) => (v === Math.max(...me.map((x) => x[1])) ? `<b>${esc(e)}: ${v}%</b>` : `${esc(e)}: ${v}%`)).join(" · ") + `. The shows I picked got more first-person through middle and high school, then let go in college.` },
    ]]);
  }
  // Regroup the clues by theme.
  const byLabel = Object.fromEntries(groups.flatMap(([, clues]) => clues).map((c) => [c.label, c]));
  const themed = [
    ["Who I am", ["AGE", "GENDER", "CULTURAL BACKGROUND", "EDUCATION", "FAMILY", "RELATIONSHIP STATUS"]],
    ["Where I've lived", ["HOME", "MOVED", "MOVED AGAIN", "BLACKOUT", "U.S. CATALOG"]],
    ["What I watch", ["WATCHING AHEAD", "MOTHERS & DAUGHTERS", "CITY GIRL", "SHOW AGE", "RELEASE DAY", "GENRES", "A TV PERSON", "A FINISHER"]],
    ["How I live", ["ROUTINE", "SUMMERS", "MOVIE NIGHTS", "RHYTHM", "STREAK", "BIG ON DECEMBER", "MARCH 2020", "GRADUATION", "HOLIDAYS"]],
    ["How we watch", ["ME: THE BINGER", "SISTER: THE SUPERFAN", "DAD: THE SAMPLER", "MOM: THE STEADY ONE"]],
    ["Who I live with", ["HOUSEHOLD", "TASTEMAKERS", "PILOT QUITTERS", "HAPPY MOTHER'S DAY", "TITLE ENERGY", "THE FAMILY SHOW", "DAD'S PARTY PICKS"]],
    ["What the titles say", ["BEGINNINGS", "GIRLY", "ROMANCE", "LOYAL", "PICKY", "FRONT ROW", "FAVORITES", "THE ME ERA"]],
    ["How I feel", ["FRIENDS", "ATTACHMENT ISSUES", "MOOD", "DARK GENRES", "HOMESICK", "SCARE THRESHOLD"]],
  ].map(([title, labels]) => [title, labels.map((l) => byLabel[l]).filter(Boolean)]);
  // The episode that tells each group's story plays first in its row.
  const TEASE = { "Where I've lived": "password", "How I live": "summer", "How we watch": "watch", "Who I live with": "dad", "How I feel": "friends" };
  $("#case-groups").innerHTML = themed.map(([title, clues]) => `
    <h4 class="case__group">${title}</h4>
    <div class="row__track"><button class="row__arrow row__arrow--prev" type="button" aria-label="Scroll left">‹</button>
    <div class="clues row__scroller">${TEASE[title] ? teaserHTML(TEASE[title]) : ""}${clues.filter((c) => c.ev).map((c) => `
      <article class="clue">
        <div class="clue__img" style="background-image:url('${c.img}')"><span class="clue__label">${c.label}</span></div>
        <div class="clue__body">
          <p class="clue__guess">${esc(c.guess)}</p>
          <p class="clue__signal">Signal: ${esc(c.signal)}</p>
          ${c.table || ""}
          <p class="clue__evidence">${c.ev2 || c.ev}</p>
        </div>
      </article>`).join("")}</div>
    <button class="row__arrow row__arrow--next" type="button" aria-label="Scroll right">›</button></div>`).join("");
  wireRows($("#case-groups"));
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
    high: `<b>The serious-drama era.</b> Drama went from ${pct(g(ms, "Drama"))} to ${pct(g(hs, "Drama"))} of what I watched: one Grey's Anatomy summer I never finished (I don't even like medical shows), 13 Reasons Why, crime and Stars Hollow. I tried ${hs.titles} different titles, ${(hs.titles / ms.titles).toFixed(1)}× middle school.`,
    after: `<b>Missing home, in Hindi.</b> After graduating, Hindi shows went from ${pct(l(hs, "Hindi"))} to ${pct(l(after, "Hindi"))}. Talk shows, new releases and movies over long commitments.`,
  };
  const stats = {
    elementary: [[pct(g(el, "Family")), "family shows"], [el.views, "views on Dad's profile"], [el.titles_per_month, "new titles / month"]],
    middle: [[pct(g(ms, "Family")), "family shows"], [ms.titles_per_month, "new titles / month"], [pct(ms.classic_share), "older than me"]],
    high: [[pct(g(hs, "Drama")), "drama"], [pct(g(hs, "Medical") + g(hs, "Crime")), "medical + crime"], [hs.titles_per_month, "new titles / month"]],
    after: [[pct(l(after, "Hindi")), "in Hindi"], [after.median_premiere, "typical premiere"], [pct(after.movie_share), "movies"]],
  };
  const bg = (era) => { const s = era.top.find((x) => ART[x.show]?.backdrop); return s ? ART[s.show].backdrop : FALLBACK_BG(); };
  $("#growth-teasers").innerHTML = teaserHTML("growing") + teaserHTML("changed");
  if (!$("#eras3")) return;
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

}

// What changed, as poster bar charts: one panel per change, four bars (one per era). A bar's height is the
// number; the bar itself is built from the posters of the shows behind it. Played as an episode.
function changePanels() {
  const eras = DATA.life;
  const pct = (x) => `${Math.round(x || 0)}%`;
  const g = (era, k) => era.genres[k] || 0;
  const l = (era, k) => era.language[k] || 0;
  const t = (era, k) => era.type[k] || 0;
  const ex = (key) => (e) => e.examples[key] || [];
  const stories = [
    { title: "Missing home,<br><em>in Hindi</em>", unit: "of my series in Hindi", value: (e) => l(e, "Hindi"), shows: ex("hindi") },
    { title: "Growing out of<br><em>family TV</em>", unit: "family shows", value: (e) => g(e, "Family"), shows: ex("family") },
    { title: "High school<br><em>got serious</em>", unit: "drama", value: (e) => g(e, "Drama"), shows: ex("drama") },
    { title: "The dark<br><em>turn</em>", unit: "medical + crime", value: (e) => g(e, "Medical") + g(e, "Crime"), shows: ex("medical_crime") },
    { title: "Laughing with<br><em>talk shows</em>", unit: "talk shows", value: (e) => t(e, "Talk Show"), shows: ex("talk") },
    { title: "Watching<br><em>what's new</em>", unit: "typical premiere year", value: (e) => e.median_premiere, year: true,
      shows: (e) => e.by_premiere.slice(-4).reverse() },
  ];
  const label = (e) => ({ elementary: "Elem.", middle: "Middle", high: "High", after: "College" }[e.key] || e.name);
  return stories.map((st) => {
    const vals = eras.map(st.value);
    const lo = st.year ? Math.min(...vals) - 3 : 0, hi = Math.max(...vals);
    const peak = vals.indexOf(hi);
    const plot = `<div class="pbar pbar--scene"><div class="pbar__plot">${eras.map((e, i) => {
      const v = vals[i], h = Math.max(((v - lo) / (hi - lo || 1)) * 100, 0);
      const posters = (st.year || v >= 1 ? st.shows(e) : []).map((x) => posterOf(x.show)).filter(Boolean);
      const fill = posters.length ? Array.from({ length: 12 }, (_, k) => posters[k % posters.length]) : [];
      return `<div class="pbar__col${i === peak ? " is-peak" : ""}">
        <span class="pbar__num">${st.year ? v : pct(v)}</span>
        <div class="pbar__bar" style="--h:${h.toFixed(1)}">${fill.map((src) => `<img src="${src}" alt="" loading="lazy">`).join("")}</div>
        <span class="pbar__era">${label(e)}</span>
      </div>`;
    }).join("")}</div></div>`;
    return { title: st.title, sub: `${st.year ? `${vals[0]} → ${vals.at(-1)}` : `${pct(vals[0])} → ${pct(vals.at(-1))}`} ${st.unit}`, plot };
  });
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

const roomName = (x, y, name) => `<text class="room-name" x="${x}" y="${y}" text-anchor="middle">${name}</text>`;
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
  const cracks = [[600, 162], [760, 400]].map((p) => zigzag(hubEdge(...p), p)).join("");  // only my room breaks off
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
    ${room("r2", "450,560 140,560 140,255 300,162", "hg2",
      houseScreen(178, 292, 132, 86) + `<rect x="236" y="378" width="16" height="22" fill="#555"/><rect x="214" y="398" width="60" height="7" rx="3" fill="#555"/>` +
      houseScreen(178, 462, 104, 64) + `<path d="M168 528h124l10 12H158Z" fill="#555"/>` + roomName(330, 445, "DAD"))}
    ${room("r3", "450,560 300,162 450,75 600,162", "hg3",
      houseScreen(368, 168, 164, 104) + `<path d="M392 272l-8 14M508 272l8 14" stroke="#777" stroke-width="5"/>` + roomName(450, 330, "MOM"))}
    ${room("r4", "450,560 600,162 760,255 760,400", "hg4", houseScreen(598, 306, 112, 76, true) + roomName(660, 420, "SUHANI"), "me")}
    ${room("r5", "450,560 760,400 760,560", "hg5",
      houseScreen(676, 446, 50, 90) + `<path d="M712 520c10-4 22 4 24 18l4 22h-34Z" fill="#1d4b63"/>` + roomName(640, 552, "AMAIRA"))}
    <g class="piece" data-piece="hub">
      <path d="M318 560A132 132 0 0 1 582 560Z" fill="#171717" stroke="#e50914" stroke-width="7"/>
      <path d="M318 560A132 132 0 0 1 582 560Z" fill="#000" filter="url(#grain)"/>
      <g class="wifi">${wifi}<circle cx="450" cy="528" r="8" fill="#e50914"/></g>
    </g>
    <g class="piece" data-piece="roof"><g class="bob"><path d="M92 266 450 50 808 266" fill="none" stroke="#e50914" stroke-width="28" stroke-linejoin="miter"/></g></g>
    <g class="cracks">${cracks}</g>
    </g>

    <text class="place" x="450" y="626" text-anchor="middle">DALLAS</text>
    <g class="warning"><text x="880" y="455" text-anchor="middle" fill="#fff" font-size="17" font-weight="700">Not part of the</text>
      <text x="880" y="477" text-anchor="middle" fill="#fff" font-size="17" font-weight="700">(Netflix) household</text></g>
    <text class="place place--austin" x="880" y="712" text-anchor="middle">AUSTIN</text>
  </svg>`;
}

// Only my room leaves: Dad, Mom and Amaira stay home on the Dallas Wi-Fi.
const PIECE_MOVES = {
  chimney: [0, 0, 0], roof: [0, 0, 0], r2: [0, 0, 0], r3: [0, 0, 0], r4: [240, -30, 10], r5: [0, 0, 0], hub: [0, 0, 0],
};

// The household, hands-on: break the house, then drag each room back where it belongs.
function setupHouse() {
  const section = $("#house");
  $("#house-art").innerHTML = houseSVG();
  const { windows: w, dates, monthly } = DATA;
  const july = monthly.find((m) => m.month === "2025-07");
  const steps = {
    whole: `Four of us, one account: Dad, Mom, Amaira and me, every screen on one Wi-Fi in Dallas. Then Netflix's new rule: <q>A Netflix account is for use by one household.</q> For us nothing changed: <b>${n(w.after_crackdown.views)} views</b> from that day to the end of 2023.`,
    broken: `On <b>${fmtDate(dates.austin)}</b> I left for college in Austin. My phone left the Wi-Fi, and Netflix stopped counting me as part of the family: a sharer to block, or an extra member to pay for. My first semester: <b>${w.first_semester.views} views</b>, about one month's worth back home.`,
    rebuilt: `Summer 2025, back on the Dallas Wi-Fi, Netflix let me back in the family: <b>${july.views} views in July</b>, my biggest month in years.`,
  };
  $("#house-steps").innerHTML = Object.entries(steps).map(([k, t]) => `<p class="house__step" data-step="${k}">${t}</p>`).join("");
  $(".house__copy").insertAdjacentHTML("beforeend", `<div class="house__controls">
    <button class="btn btn--play house__btn" type="button" id="house-break"><span class="btn__icon">🎓</span> Send me to college</button>
    <button class="btn btn--light house__btn" type="button" id="house-fix" hidden>Bring me home for summer</button>
    <p class="house__hint" id="house-hint" hidden>Or drag my room back home yourself.</p></div>`);
  const svg = section.querySelector("svg");
  const pieces = [...section.querySelectorAll(".piece")];
  pieces.forEach((el, i) => {
    const [dx, dy, rot] = PIECE_MOVES[el.dataset.piece];
    Object.assign(el.dataset, { dx, dy, rot });
    el.style.setProperty("--dx", `${dx}px`);
    el.style.setProperty("--dy", `${dy}px`);
    el.style.setProperty("--r", `${rot}deg`);
    el.style.setProperty("--i", i);
  });

  let state = "whole", timer;
  const show = (k) => section.querySelectorAll(".house__step").forEach((el) => el.classList.toggle("is-on", el.dataset.step === k));
  const reset = () => pieces.forEach((el) => { el.removeAttribute("data-x"); el.removeAttribute("data-y"); el.classList.remove("is-home"); el.style.transform = ""; });
  const setState = (next) => {
    state = next;
    clearTimeout(timer);
    $("#house-break").hidden = next === "broken" || next === "cracking";
    $("#house-break").innerHTML = `<span class="btn__icon">🎓</span> ${next === "rebuilt" ? "Back to college" : "Send me to college"}`;
    $("#house-fix").hidden = $("#house-hint").hidden = next !== "broken";
    section.classList.toggle("is-rebuilt", next === "rebuilt");
    show(next === "cracking" ? "whole" : next);
  };
  const breakHouse = () => {
    if (state === "broken" || state === "cracking") return;
    reset();
    section.classList.remove("is-broken", "is-cracking");
    void section.offsetWidth;
    section.classList.add("is-cracking");
    setState("cracking");
    timer = setTimeout(() => {
      section.classList.add("is-broken");
      pieces.filter((el) => !+el.dataset.dx && !+el.dataset.dy).forEach((el) => el.classList.add("is-home"));  // the hub stays put
      setState("broken");
    }, 1100);
  };
  const rebuild = () => {
    reset();
    section.classList.remove("is-broken", "is-cracking");
    setState("rebuilt");
  };
  $("#house-break").addEventListener("click", breakHouse);
  $("#house-fix").addEventListener("click", rebuild);
  section.querySelector(".house__art").addEventListener("click", (e) => { if (state !== "broken" && !e.target.closest("button")) breakHouse(); });

  // Dragging a room: it follows the pointer and snaps home when dropped close enough.
  let drag = null;
  const place = (el, x, y) => {
    const d = Math.hypot(x, y), far = Math.hypot(+el.dataset.dx, +el.dataset.dy) || 1;
    el.style.transform = `translate(${x}px, ${y}px) rotate(${(+el.dataset.rot * Math.min(d / far, 1)).toFixed(1)}deg)`;
  };
  svg.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(".piece");
    if (state !== "broken" || !el || el.classList.contains("is-home")) return;
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch {}
    const x = +(el.dataset.x ?? el.dataset.dx), y = +(el.dataset.y ?? el.dataset.dy);
    drag = { el, x, y, sx: e.clientX, sy: e.clientY, k: svg.getScreenCTM().a };
    el.classList.add("is-dragging");
    place(el, x, y);
  });
  addEventListener("pointermove", (e) => {
    if (!drag) return;
    const x = drag.x + (e.clientX - drag.sx) / drag.k, y = drag.y + (e.clientY - drag.sy) / drag.k;
    drag.el.dataset.x = x; drag.el.dataset.y = y;
    place(drag.el, x, y);
  });
  const drop = () => {
    if (!drag) return;
    const { el } = drag;
    drag = null;
    el.classList.remove("is-dragging");
    if (Math.hypot(+(el.dataset.x ?? el.dataset.dx), +(el.dataset.y ?? el.dataset.dy)) < 45) {
      el.classList.add("is-home");
      el.style.transform = "translate(0px, 0px) rotate(0deg)";
      if (pieces.every((p) => p.classList.contains("is-home"))) setTimeout(rebuild, 450);
    }
  };
  addEventListener("pointerup", drop);
  addEventListener("pointercancel", drop);
  setState("whole");
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
      sub: "The very first thing our new account ever played.", viz: viz(spark({ from: "2015-05", to: "2016-02", hot: ["2015-06", "2015-07"] })) },
    { dur: 5, montage: posters(el.top.slice(0, 6)), center: true, kicker: "Season 1 · Elementary", line: "Learning America<br>on <em>Disney</em>",
      sub: `${listOf(el.top.slice(0, 3).map((s) => s.show))}. On Dad's profile: I didn't have my own yet.` },
    { dur: 5, montage: posters(ms.top.slice(0, 6)), center: true, kicker: "Season 2 · Middle School", line: "The family-<br><em>drama</em> years",
      sub: `${pct(ms.genres.Family)} family shows. ${pct(ms.language.English)} in English.` },
    { dur: 4.5, img: backdropOf("Friends"), alt: true, kicker: "Eighth grade, winter break", line: `${w.friends_run.top[0].views} episodes<br>of <em>Friends</em>`,
      sub: `In ${daysBetween(w.friends_run.from, w.friends_run.to)} days.` },
    { dur: 4.5, img: backdropOf(p.covid.top), kicker: "March 13, 2020", line: "Sent<br><em>home</em>",
      sub: `Schools close. ${p.covid.after_closure} views before March is over, mostly ${p.covid.top}.` },
    ...(DATA.gaps.some((g) => g.from.startsWith("2020")) ? [{ dur: 4.5, black: true, center: true, kicker: "Summer 2020", line: "Cupertino<br>to <em>Dallas</em>",
      sub: `${DATA.gaps.find((g) => g.from.startsWith("2020")).days} days without pressing play. Then high school, in Texas.`, viz: viz(spark({ from: "2020-04", to: "2021-01", hot: ["2020-08", "2020-09"] })) }] : []),
    ...(DATA.family?.freeze?.mine.length ? [{ dur: 5, black: true, center: true, kicker: "February 14–20, 2021", line: "Texas<br><em>freezes</em>",
      sub: `The power kept going out. Mine: ${listOf(DATA.family.freeze.mine.map(esc))}. Rom-coms by candlelight.`, viz: viz(spark({ from: "2020-11", to: "2021-05", hot: ["2021-02"] })) }] : []),
    { dur: 5, montage: posters(hs.top.slice(0, 6)), center: true, kicker: "Season 3 · High School", line: "It gets<br><em>serious</em>",
      sub: `Drama goes from ${pct(ms.genres.Drama)} to ${pct(hs.genres.Drama)}. Hospitals, crime, Stars Hollow.` },
    { dur: 5, montage: posters(hindi.slice(0, 6)), center: true, kicker: "Finding home on screen", line: "Hindi,<br><em>more and more</em>",
      sub: `Hindi series: ${pct(ms.language.Hindi)} → ${pct(hs.language.Hindi)} → ${pct(after.language.Hindi)}. Hindi films: ${p.hindi_films.total} of ${p.hindi_films.movies}.` },
    { dur: 4.5, black: true, center: true, kicker: "Senior spring, 2024", line: `<span class="scene__counter" data-to="${p.senior_spring.views}">0</span> views<br>in <em>six months</em>`,
      sub: "Graduation is busy.", viz: viz(spark({ from: "2023-09", to: "2024-08", hot: ["2024-01", "2024-02", "2024-03", "2024-04", "2024-05", "2024-06"] })) },
    { dur: 5.5, black: true, center: true, accent: "ut", kicker: fmtDate(dates.austin), line: "Hook 'em.<br><em>UT Austin.</em>",
      sub: `Freshman fall: ${p.college.fall_2024} views a day. Summer back home: ${p.college.summer_2025}.`, viz: viz(spark({ from: "2024-06", to: "2026-09", hot: ["2025-06", "2025-07", "2026-06", "2026-07"] })) },
    { dur: 5, montage: posters(after.top.slice(0, 6)), center: true, kicker: "Season 4 · After Graduation", line: "Missing home,<br><em>in Hindi</em>",
      sub: `${pct(after.language.Hindi)} of my series. Talk shows, new releases, movie nights.` },
    ...(DATA.genre_pie ? [{ dur: 6, black: true, center: true, kicker: "Every series episode, one genre per show", line: "Romance<br><em>first, always</em>",
      sub: `${listOf(DATA.genre_pie[0].shows.map(esc))}.`, viz: viz(pie(DATA.genre_pie)) }] : []),
    { dur: 5, wall: true, center: true, accent: "ut", kicker: "Still watching", line: "From Singapore<br>to the <em>Forty Acres</em>",
      sub: `${n(totals.views)} views. Same profile. A different person.` },
  ];
}

function friendsFilm() {
  const fr = DATA.profile.friends_race, { binges } = DATA;
  const big = binges.find((b) => b.show === "Friends");
  return [
    { dur: 5, black: true, center: true, kicker: "December 1, 2019", line: "Friends is leaving<br><em>Netflix</em>", sub: "January 1, 2020. Thirty-one days left. Eighth grade, winter break coming." },
    { dur: 5, img: backdropOf("Friends"), kicker: "December 2019", line: `${fr.december} episodes<br>in <em>one month</em>`, sub: "About six a day, every day.", viz: viz(spark({ from: "2019-09", to: "2020-03", hot: ["2019-11", "2019-12"] })) },
    { dur: 5, black: true, center: true, kicker: fmtDate(big.date), line: `<span class="scene__counter" data-to="${big.episodes}">0</span> episodes<br>in <em>one day</em>`, sub: "Roughly eleven hours of Central Perk." },
    { dur: 4.5, img: backdropOf("Friends"), alt: true, kicker: "December 25–31", line: `${fr.last_week} more,<br><em>racing the clock</em>`, sub: "Christmas Day alone: 8 episodes." },
    { dur: 5, black: true, center: true, kicker: "December 31, 11:59 PM", line: "Just<br><em>one more</em>", sub: `Netflix logged ${fr.jan1} episodes on January 1, 2020. Past midnight. In denial.` },
    { dur: 5.5, wall: true, center: true, kicker: "Then it was gone", line: `${fr.watched} of <em>${fr.total}</em>`, sub: "And on the very last night, I went back to where it started: the pilot." },
  ];
}

function summerFilm() {
  const p = DATA.profile, { windows: w, streak, monthly } = DATA;
  const gg = w.summer_2025.top[0];
  const july = monthly.find((m) => m.month === "2025-07");
  return [
    { dur: 5, dorm: true, kicker: "Austin · spring 2025", line: "One more<br><em>final</em>", sub: `Freshman year on a family account: ${p.college.fall_2024} views a day in the fall.` },
    { dur: 4.5, black: true, center: true, kicker: "May 2025", line: "Back on the<br><em>home Wi-Fi</em>", sub: "Dallas. The TV recognizes me again." },
    { dur: 5.5, img: backdropOf(gg.show), kicker: "June – July 2025", line: `${gg.views} episodes<br>of <em>${esc(gg.show)}</em>`, sub: "Starving. Absolutely starving." },
    { dur: 5, black: true, center: true, kicker: `${fmtShort(streak.from)} – ${fmtShort(streak.to)}`, line: `<span class="scene__counter" data-to="${streak.days}">0</span> days<br>in a <em>row</em>`, sub: "The longest streak of my life.", viz: viz(spark({ from: "2025-04", to: "2025-10", hot: ["2025-06", "2025-07"] })) },
    { dur: 5, montage: w.summer_2025.top.slice(0, 5).map((s) => ({ img: posterOf(s.show), tag: `${s.views}` })), center: true, kicker: "July 2025", line: `${july.views} views<br>in <em>one month</em>`, sub: "My biggest month since Friends left." },
    { dur: 5, img: backdropOf(w.fall_2025.top[0].show), alt: true, kicker: "August 2025", line: "Back to<br><em>Austin</em>", sub: `Sophomore fall: ${p.college.fall_2025} views a day. See you next summer.` },
  ];
}

function changedFilm() {
  const panels = changePanels();
  return [
    { dur: 5, wall: true, center: true, kicker: "Season 1 · Episode 3", line: "What<br><em>changed</em>", sub: "Elementary, middle school, high school, college. Every bar is built from the posters behind it." },
    ...panels.map((x) => ({ dur: 6, black: true, center: true, kicker: "What changed", line: x.title, sub: x.sub, viz: viz(x.plot) })),
    { dur: 5, wall: true, center: true, kicker: "Four schools", line: "Four of<br><em>me</em>", sub: "Same profile. A different person every few years." },
  ];
}

function watchFilm() {
  const f = DATA.family;
  if (!f?.habits) return [];
  const hb = f.habits, pr = f.profiles, q = f.quit_rate;
  const top = (w) => pr[w].top[0];
  return [
    { dur: 5, wall: true, center: true, kicker: "Season 5 · How We Watch", line: "How we<br><em>watch</em>", sub: "Four profiles. One account. Eleven years." },
    { dur: 8, black: true, center: true, kicker: "Every profile, side by side", line: "Four ways<br>to <em>watch</em>", sub: "", viz: viz(habitsTable()) },
    { dur: 6, cast: "suhani", kicker: "Me", line: "The<br><em>binger</em>",
      sub: `${hb.Me.binge_days} days with 6+ episodes. ${hb.Me.eps_per_show} episodes a show, the most in the family. Whatever survives the pilot gets finished.` },
    { dur: 6, cast: "amaira", kicker: "My sister", line: "The<br><em>superfan</em>",
      sub: `${hb["My sister"].top5_pct}% of everything she watches is five shows, led by ${top("My sister").show}. The biggest rewatcher in the house.` },
    { dur: 6, cast: "dad", kicker: "Dad", line: "The<br><em>sampler</em>",
      sub: `${n(hb.Dad.titles)} different titles, and he quits ${q.Dad}% after one episode. A serial killer… of pilots.` },
    { dur: 6, cast: "mom", kicker: "Mom", line: "The movie<br><em>person</em>",
      sub: `${n(f.parents?.Mom?.movies || 0)} Hindi movies, one sitting each. ${hb.Mom.binge_days} binge days in eleven years, and she never rewatches.` },
    { dur: 5, wall: true, center: true, kicker: "One account", line: "Same Wi-Fi.<br><em>Four people.</em>", sub: "Until one of us moved out." },
  ];
}

// What a #1 or top-10 show says about the person who picked it.
const SAYS = {
  // Papa
  "Apocalypse": "History first, always", "Breaking Bad": "A family man with a plan", "Sons of Anarchy": "Loyalty to the crew",
  "Queen of the South": "Respects a self-made boss", "Undercover": "Wants to know who's lying", "Narcos": "The real story behind the headlines",
  "Ozark": "Survives by thinking ahead", "Rise of Empires": "Strategy and the long game", "Fool Me Once": "Can't resist a twist",
  "Blood Coast": "Subtitles don't scare him", "Criminal Code": "Cops and crooks, anywhere", "El Chapo": "How power really works",
  "Peaky Blinders": "Family business, sharp suits", "The Borgias": "Dynasties and politics", "Money Heist": "Loves a perfect plan", "Suburra": "Power, politics, Rome",
  // Mumma
  "Delhi Crime": "Women who get justice done", "Jamtara - Sabka Number Ayega": "Small-town hustlers, real India", "Sacred Games": "Big Bombay stories",
  "Khakee": "Honest cops vs the system", "Yeh Kaali Kaali Ankhein": "Loves a little drama", "Maamla Legal Hai": "Laughs at everyday chaos",
  "Class": "Keeps up with what's new", "Choona": "A good con and a laugh", "The Fame Game": "Bollywood behind the scenes",
  "Raja, Rasoi aur Anya Kahaniyan": "Food, history and home", "Aranyak": "A mystery in the hills", "Black Warrant": "True stories of justice",
  // Amaira
  "Little Baby Bum": "Sing it again", "Masha and the Bear": "A fearless troublemaker", "Sofia the First": "Princess phase",
  "PJ Masks": "Wants to be a hero", "Ben & Holly's Little Kingdom": "Fairies and magic", "Barbie Dreamhouse Adventures": "Big dreams",
  "The Thundermans": "Superpowers and sibling fights", "iCarly": "Wants her own show", "Victorious": "A performer", "Pocoyo": "Curious about everything",
  "The Boss Baby": "Thinks she runs the house",
  // Me
  "LEGO Ninjago": "A brand-new kid in America", "Good Luck Charlie": "Becoming a big sister", "Liv and Maddie": "Two sides of one girl",
  "Baby Daddy": "Loves a found family", "Friends": "Wants her people", "The Fosters": "The family you choose", "Grey's Anatomy": "Drama under pressure",
  "Gilmore Girls": "Fast talk, books, her mom", "Jane The Virgin": "A hopeless romantic", "The Great Indian Kapil Show": "Homesick, laughing in Hindi",
  "Gossip Girl": "Ambitious city girl", "Bridgerton": "Romance, done properly", "The Vampire Diaries": "Love triangles, forever",
  "Fuller House": "A big, loud family", "Jessie": "Disney Channel kid", "Switched at Birth": "Two families, one girl",
};
// Fuller House is mine and Amaira's; on her page it means something else.
const saysFor = (show, who) => (who === "Sister" && show === "Fuller House" ? "Big sister's show, now hers" : SAYS[show] || "");
const READING = {
  Dad: "Every #1 is about power: who has it, how a family keeps it, and the plan behind it. He roots for the man protecting his people.",
  Mom: "Her #1s are Indian stories about ordinary people up against a system: cops, scammers, courts and classrooms. Justice, with a sense of humor.",
  Sister: "Songs, then princesses, then superheroes, then girls with their own show. She wants to be the main character.",
  Me: "Family first, then friends who become family, then love. Sentimental, every single year.",
};
const readingScene = (who, list) => ({ dur: 7, montage: list.map((x) => ({ img: posterOf(x.show), tag: x.year || "" })), center: true,
  kicker: "What the #1s say", line: who === "Dad" ? "Who he<br><em>roots for</em>" : who === "Mom" ? "What she<br><em>believes in</em>" : who === "Sister" ? "Who she<br><em>wants to be</em>" : "Who I<br><em>am</em>",
  sub: READING[who] });

// Specials: everything on Dad's, Mom's and Amaira's profile pages, as one episode each.
const SPECIAL = { Dad: "dad", Mom: "mom", Sister: "copycat" };
const NICK = { Dad: "Papa", Mom: "Mumma", Sister: "Amaira" };
const BILL = { Dad: { genre: "Crime", years: "2015–2026", rating: "TV-MA" }, Mom: { genre: "Hindi Drama", years: "2015–2026", rating: "TV-14" },
  Sister: { genre: "Kids & Family", years: "2017–2026", rating: "TV-Y7" } };
const runtime = (f) => { const t = Math.round(f.scenes().reduce((a, x) => a + x.dur, 0)); return t >= 60 ? `${Math.floor(t / 60)}m ${t % 60}s` : `${t}s`; };
// A billboard's background video: the special's scenes, picture only, looping until the page closes.
function playBehind(stage, key, closed) {
  if (!stage || !FILMS[key] || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const list = FILMS[key].scenes().map((x) => x.montage ? { ...x, montage: x.montage.filter((m) => m.img) } : x)
    .filter((x) => x.img || x.montage?.length || x.wall).map(({ cast, say, viz, ...x }) => x);  // picture only
  if (!list.length) return;
  stage.innerHTML = list.map(sceneHTML).join("");
  const scenes = [...stage.children];
  let i = 0;
  const step = () => {
    if (closed() || !stage.isConnected) return;
    scenes.forEach((sc, k) => sc.classList.toggle("is-on", k === i));
    setTimeout(step, list[i].dur * 1000);
    i = (i + 1) % scenes.length;
  };
  step();
}
// The cast: illustrated portraits of the four of us.
const CAST = { suhani: { name: "Suhani", color: "#ff2079" }, dad: { name: "Dad", color: "#0033cc" }, mom: { name: "Mom", color: "#c00010" }, amaira: { name: "Amaira", color: "#7a00c2" } };
const castImg = (who) => `img/profiles/${who}.jpg`;

// One scene of a film, shared by the full player and the inline previews.
// Scene types: img, montage, wall, dorm, plus the cast scenes: cast (talking head with a speech bubble),
// photo (a polaroid of home), phone (a call with chat bubbles), freeze (record scratch), rewind (VHS rewind).
function sceneHTML(s) {
  let bg = "", extra = "", cls = "";
  if (s.set || s.panes) { bg = setSceneHTML(s); cls += " scene--set"; }
  else if (s.dorm) bg = `<div class="scene__bg scene__bg--dorm">${dormSVG()}</div>`;
  else if (s.wall) bg = `<div class="scene__bg">${wallHTML()}</div>`;
  else if (s.montage?.length) bg = `<div class="montage${s.rewind ? " montage--rewind" : ""}" style="--cols:${Math.max(3, Math.ceil(s.montage.length / 2))}">${s.montage.map((m, k) =>
    `<figure style="--k:${k}"><img src="${m.img}" alt="" loading="lazy">${m.tag ? `<figcaption>${m.tag}</figcaption>` : ""}</figure>`).join("")}</div>`;
  else if (s.img) bg = `<div class="scene__bg" style="background-image:url('${s.img}')"></div>`;
  if (s.cast) {
    const c = CAST[s.cast];
    cls += " scene--cast";
    bg = bg || `<div class="scene__bg scene__bg--flat" style="background:${c.color}"></div>`;
    extra = `<figure class="cast${s.freeze ? " cast--freeze" : ""}${s.castLeft ? " cast--left" : ""}"><img src="${castImg(s.cast)}" alt="${c.name}"><figcaption>${c.name}${s.age ? `, ${s.age}` : ""}</figcaption></figure>
      ${s.say ? `<p class="cast__say">${esc(s.say)}</p>` : ""}`;
  }
  if (s.photo) {
    cls += " scene--photo";
    extra = `<figure class="polaroid">${s.photo.map((w) => `<img src="${castImg(w)}" alt="${CAST[w].name}">`).join("")}<figcaption>${esc(s.photoCaption || "Home")}</figcaption></figure>`;
  }
  if (s.phone) {
    cls += " scene--phone";
    bg = bg || `<div class="scene__bg scene__bg--flat" style="background:#0b0b0b"></div>`;
    extra = `<div class="phone"><div class="phone__top"><img src="${castImg(s.phone.who)}" alt=""><b>${esc(s.phone.name)}</b><span>calling…</span></div>
      ${s.phone.lines.map((l, i) => `<p class="phone__msg phone__msg--${l.me ? "me" : "them"}" style="--i:${i}">${esc(l.text)}</p>`).join("")}</div>`;
  }
  if (s.freeze) { cls += " scene--freeze"; extra += `<span class="scratch">*record scratch* *freeze frame*</span>`; }
  if (s.rewind) { cls += " scene--rewind"; extra += `<span class="rewind">◀◀ REWIND</span>`; }
  return `<section class="scene${s.viz ? " scene--viz" : ""}${s.center ? " scene--center" : ""}${s.alt ? " scene--alt" : ""}${s.accent ? ` scene--${s.accent}` : ""}${cls}" style="--dur:${s.dur + 1}s">
    ${bg}${extra}<div class="scene__text"><p class="scene__kicker">${esc(s.kicker || "")}</p>${s.line ? `<h2 class="scene__line">${s.line}</h2>` : ""}${s.sub ? `<p class="scene__sub">${esc(s.sub)}</p>` : ""}${s.viz || ""}</div></section>`;
}

// ---------- The five seasons: my life on one Netflix account ----------
const era = (k) => DATA.life.find((e) => e.key === k);
const postersOf = (list) => list.map((s) => ({ img: posterOf(s.show || s), tag: "" })).filter((m) => m.img);
const showViews = (name) => DATA.shows[name]?.views || 0;
const amairaYear = (y) => DATA.family?.amaira?.years.find((x) => x.year === y);
const amairaCut = (y) => { const a = amairaYear(y); return a ? [{ dur: 4.5, cast: "amaira", kicker: `Meanwhile · ${y}`, line: `Amaira's<br><em>${esc(a.show)}</em> era`, sub: `My little sister's #1 that year. Side character, main-character energy.`, say: y < 2020 ? "I'm the side character." : "Still the side character." }] : []; };

// S1 · Elementary
// S1:E1, the cold open. Move-in day in West Campus, the household wall, and Papa.
// Sets: people stand on the West Campus sidewalk at y 668; the dorm bed's mattress top is y 640.
const WC = { y: 668, s: .62 };
const DORM_BED = { x: 520, y: 742, s: .68 };
function pilotFilm() {
  const { windows: w, dates } = DATA;
  const day = fmtDate(dates.austin);
  const car = { kind: "car", x: 1060, y: 760, riders: ["mom", "dad", "amaira"], waver: "amaira", waveAt: 1.8 };
  return [
    { dur: 7, set: "westcampus", kicker: `${day} · West Campus, Austin`,
      cam: [[0, 800, 450, 1600], [7, 740, 480, 1320]],
      things: [
        { who: "suhani", x: 650, ...WC }, { who: "mom", x: 730, ...WC }, { who: "amaira", x: 810, ...WC },
        { who: "dad", x: 1000, ...WC, keys: [[0, { pose: "carry", walk: 1 }], [.3, { x: 1000 }], [3.3, { x: 560, walk: 0, e: "linear" }], [3.5, { pose: "idle" }]] },
        { ...car, riders: [] },
      ],
      credits: [[.6, 2.6, "A Suhani Tiwari Original"], [3.8, 3, "<small>A Netflix-history docuseries</small>Still Watching", true]] },
    { dur: 9, set: "westcampus", kicker: "The goodbye",
      cam: [[0, 700, 500, 900], [.55, 700, 500, 900], [.55, 700, 468, 470], [3.75, 700, 468, 470], [3.75, 560, 462, 470], [6.15, 560, 462, 470], [6.15, 840, 520, 400], [8.5, 840, 520, 400], [8.5, 700, 500, 900]],
      things: [
        { who: "dad", x: 560, ...WC },
        { who: "mom", x: 660, ...WC, keys: [[0, { pose: "hugR" }]] },
        { who: "suhani", x: 740, ...WC, keys: [[0, { pose: "hugL" }], [7.6, { mood: "flat" }]] },
        { who: "amaira", x: 840, ...WC, keys: [[0, { pose: "hips" }]] },
        { ...car, riders: [] },
      ],
      talk: [[.6, "mom", "Call me when you eat dinner. Not after."], [3.8, "dad", "And go to class, beta."], [6.2, "amaira", "Can I have your room now?"]],
      credits: [[.8, 2.4, "Starring<b>Suhani Tiwari</b>"], [4.6, 2.6, "With<b>Papa · Mumma · Amaira</b>"]] },
    { dur: 8, set: "westcampus", kicker: "8:12 PM",
      cam: [[0, 800, 450, 1600], [4.8, 800, 450, 1600], [8, 720, 480, 600]],
      things: [
        { who: "suhani", x: 720, ...WC, keys: [[1.7, { pose: "wave" }], [5.2, { pose: "idle" }], [5.5, { mood: "sad" }]] },
        { ...car, keys: [[1.6, { x: 1060 }], [5.6, { x: -420, e: "in" }]] },
      ],
      talk: [[2.1, "amaira", "Byeee, Didi!"]],
      credits: [[.5, 2.6, "Created by<b>Suhani Tiwari</b>"], [5.6, 2.3, "From<b>four Netflix exports</b>"]] },
    { dur: 9.5, set: "dorm", kicker: "11:47 PM · her dorm",
      cam: [[0, 800, 450, 1600], [9.5, 760, 470, 1350]],
      things: [
        { kind: "tv", x: 1095, y: 230, keys: [[7.6, { screen: "home" }]] },
        { who: "suhani", x: 1480, y: 900, s: .8, start: { mood: "sad", walk: 1 },
          keys: [[.3, { x: 1480 }], [3, { x: DORM_BED.x, y: 900, s: .8, walk: 0, e: "linear" }], [3.45, { y: DORM_BED.y, s: DORM_BED.s, rot: -78, e: "in" }],
            [6.4, { rot: -78 }], [7, { rot: 0, sit: 1 }], [7.1, { pose: "remote" }], [7.7, { mood: "smile" }]] },
      ],
      talk: [[3.9, "suhani", "Okay. One episode. Just to feel normal."]] },
    { dur: 7.5, set: "dorm", kicker: "Netflix · one episode",
      cam: [[0, 1295, 345, 660], [2.4, 1295, 345, 560], [4.2, 1295, 345, 540], [4.2, 520, 500, 520], [7.5, 520, 495, 470]],
      things: [
        { kind: "tv", x: 1095, y: 230, keys: [[0, { screen: "home" }], [2.4, { screen: "blocked" }]] },
        { who: "suhani", ...DORM_BED, start: { sit: 1, pose: "remote" }, keys: [[4.2, { mood: "shock" }], [4.5, { pose: "face" }]] },
      ],
      talk: [[4.6, "suhani", "Wait… WHAT?"]] },
    { dur: 10.5, kicker: "Calling Papa",
      panes: [
        { set: "dorm", cam: [[0, 520, 500, 600]], things: [{ who: "suhani", ...DORM_BED, start: { sit: 1, pose: "phone" }, keys: [[8, { mood: "shock" }], [9.3, { mood: "sad" }]] }] },
        { set: "living", cam: [[0, 800, 500, 760], [10.5, 800, 480, 680]], glow: [[".lv-tv", 0]],
          things: [{ who: "dad", x: 800, y: 742, s: .9, start: { sit: 1, pose: "phone", mood: "flat" }, keys: [[7.9, { mood: "smile" }]] }] },
      ],
      talk: [[.5, "suhani", "Papa, Netflix says I'm not part of the household."], [4.2, "suhani", "Can you let me in?"], [6.3, "dad", "Sorry, kiddo.", 1.4], [7.9, "dad", "You're on your own."]] },
    { dur: 8.5, set: "dorm", kicker: "Still 11:58 PM",
      cam: [[0, 800, 450, 1600], [8.5, 420, 560, 760]],
      things: [
        { kind: "tv", x: 1095, y: 230, keys: [[0, { screen: "blocked" }]] },
        { who: "suhani", ...DORM_BED, start: { rot: -78, mood: "sad", pose: "face" } },
      ],
      talk: [[.8, "suhani", "Ugh. Every time I moved, Netflix made it better."], [4.6, "suhani", "Every. Single. Time."]],
      credits: [[6.2, 2.3, "<small>Episode 1</small>You're On Your Own, Kid", true]] },
    { dur: 5.5, rewind: true, montage: postersOf(DATA.yearly.slice().reverse().map((y) => y.show)), center: true, kicker: `${new Date(dates.austin).getFullYear()} → 2015`, line: "Let's<br><em>rewind</em>", sub: `${w.first_semester.views} views my first semester. Every move before this one, Netflix was there. It starts in 2015.` },
  ];
}

// S1:E2. Cupertino, 2015: laughed at for an accent, rescued by a Disney nanny from Texas.
const PG = { y: 700, s: .62 };
const COUCH = (who) => ({ y: 600 + 150 * .9 * LOOKS[who].h, s: .9 });
function helloFilm() {
  const p = DATA.profile, jessie = DATA.shows.Jessie, glc = DATA.shows["Good Luck Charlie"], lm = DATA.shows["Liv and Maddie"];
  const first = p.first_title;
  const months = DATA.monthly.filter((m) => m.month >= "2015-06" && m.month <= "2016-08");
  const label = (m) => new Date(`${m}-15`).toLocaleString("en-US", { month: "short" });
  const at = (date) => months.findIndex((m) => m.month === date.slice(0, 7));
  const scroll = [first, "Phineas and Ferb", "LEGO Ninjago", "How to Train Your Dragon 2", "The Pirate Fairy", "Jessie"].filter((s) => ART[s]);
  return [
    { dur: 10, set: "playground", kicker: "June 2015 · Cupertino · Suhani, 9",
      cam: [[0, 700, 560, 1100], [2.4, 800, 560, 900], [4.85, 800, 560, 900], [4.85, 1000, 575, 560], [7.1, 1000, 575, 560], [7.1, 760, 575, 420], [8.6, 760, 575, 440], [10, 600, 560, 800]],
      things: [
        { who: "kidA", x: 920, ...PG, keys: [[4.8, { pose: "hips" }]] }, { who: "kidB", x: 1030, ...PG, keys: [[7.2, { pose: "face" }]] }, { who: "kidC", x: 1130, ...PG },
        { who: "suhani9", x: 260, ...PG, start: { walk: 1 },
          keys: [[.2, { x: 260 }], [2.4, { x: 760, walk: 0, e: "linear" }], [2.5, { pose: "wave" }], [4.7, { pose: "idle" }], [5, { mood: "shock" }], [7.3, { mood: "sad" }],
            [8.6, { x: 760, walk: 1 }], [10, { x: 420, e: "linear" }]] },
      ],
      talk: [[2.6, "suhani9", "Hi! My name is Suhani."], [4.9, "kidA", "Why do you talk like that?"], [7.3, "kidB", "Say it again! Say it again!"]] },
    { dur: 10.5, set: "living", kicker: "That night · home", glow: [[".lv-tv", 0]], 
      cam: [[0, 800, 500, 1050], [.5, 800, 500, 1050], [.5, 650, 470, 580], [6.3, 650, 470, 580], [6.3, 800, 540, 560], [8.8, 800, 540, 560], [8.8, 950, 490, 580]],
      things: [
        { who: "dad", x: 640, ...COUCH("dad"), start: { sit: 1, pose: "remote" } },
        { who: "suhani9", x: 800, ...COUCH("suhani9"), start: { sit: 1, pose: "lap", mood: "flat" }, keys: [[6.4, { mood: "sad" }]] },
        { who: "mom", x: 960, ...COUCH("mom"), start: { sit: 1, pose: "lap" } },
      ],
      talk: [[.6, "dad", "My colleague says everyone has this Netflix now."], [4.2, "dad", `Here. ${first}.`], [6.4, "suhani9", "I want my Indian channels."], [8.9, "mom", "Keep scrolling, beta."]] },
    { dur: 8, set: "browse", kicker: `Two months of scrolling · ${fmtDate(jessie.first)}`,
      cam: [[0, 800, 450, 1600], [5.6, 800, 450, 1600], [8, 700, 560, 1100]],
      things: [{ kind: "browse", x: 0, shows: scroll, row: "Popular on Netflix", keys: [[.6, { x: 0 }], [5.2, { x: (scroll.length - 1) * TILE }]] }],
      talk: [[5.4, "suhani9", "Wait. That one."]] },
    { dur: 8.5, set: "living", kicker: "Practicing every line", glow: [[".lv-tv", 0]],
      cam: [[0, 800, 560, 760], [8.5, 800, 545, 560]],
      things: [{ who: "suhani9", x: 800, y: 840, s: .95, keys: [[.4, { pose: "hips" }], [2.4, { pose: "wave" }], [4.3, { pose: "hips" }]] }],
      talk: [[.6, "suhani9", "Oh. My. Gosh."], [2.4, "suhani9", "Oh my gosh!"], [4.4, "suhani9", "Oh my gosh, y'all."]],
      credits: [[6.4, 2, `Jessie: a nanny from <b>Texas</b>`]] },
    { dur: 9.5, set: "chart", kicker: "June 2015 → August 2016 · my views per month",
      things: [{ kind: "bars", title: "WHAT TAUGHT ME AMERICAN", keys: [[.4, { p: 0 }], [7.6, { p: 1, e: "linear" }]],
        data: months.map((m) => ({ v: m.views, label: label(m.month) + (m.month.endsWith("-01") ? ` ’${m.month.slice(2, 4)}` : ""), hi: m.month >= jessie.first.slice(0, 7) })),
        marks: [{ i: at(jessie.first), text: "Jessie", sub: fmtDate(jessie.first) }, { i: at(lm.first), text: "Liv and Maddie", sub: fmtDate(lm.first), row: 1 }, { i: at(glc.first), text: "Good Luck Charlie", sub: fmtDate(glc.first) }],
        meter: { label: "Confidence (self-reported)", keys: [[0, 0], [at(jessie.first) + 1, 10], [months.length, 100]], end: "100%: AMERICAN" } }] },
    { dur: 9, set: "playground", kicker: "Summer 2016 · same playground · Suhani, 10",
      cam: [[0, 860, 560, 900], [9, 820, 570, 700]],
      things: [
        { who: "kidA", x: 640, ...PG, keys: [[4.4, { pose: "hips" }]] },
        { who: "suhani9", x: 800, ...PG, keys: [[.6, { pose: "hips" }], [3.9, { pose: "wave" }], [5.4, { pose: "idle" }]] },
        { who: "kidB", x: 950, ...PG, keys: [[4.4, { pose: "wave" }]] }, { who: "kidC", x: 1080, ...PG },
      ],
      talk: [[.6, "suhani9", "Wait, you guys watch Good Luck Charlie too?!"], [4.3, "kidB", "Oh my gosh, YES."], [6, "suhani9", "Okay, so, like…"]],
      credits: [[6.6, 2.3, "<small>One year later</small>Officially American", true]] },
  ];
}
function amairaFilm() {
  const a = DATA.family?.arrival;
  if (!a) return [];
  return [
    { dur: 5, black: true, center: true, kicker: "November 13, 2016", line: "Plus<br><em>one</em>", sub: "My little sister, Amaira, comes home." },
    { dur: 5, cast: "amaira", kicker: "Introducing", line: "The side<br><em>character</em>", sub: "Day one, she already had a fan base.", say: "Hi. I'll be taking over the TV in about two years." },
    { dur: 5.5, black: true, center: true, kicker: "Big sister on the couch", line: `<span class="scene__counter" data-to="${Math.round(a.me_after)}">0</span> episodes<br>a <em>week</em>`, sub: `Up from about ${Math.round(a.me_before)} before she arrived. New baby, busy parents.` },
    { dur: 6, img: backdropOf("Good Luck Charlie"), kicker: "What I picked", line: "Good Luck<br><em>Charlie</em>", sub: `A Disney sitcom about a family with a brand-new baby girl. ${a.glc_6mo} episodes in six months. Uncomfortably familiar.` },
    { dur: 5.5, cast: "dad", kicker: "Meanwhile, Dad", line: `${Math.round(a.dad_before)} a week<br>→ <em>${a.dad_after}</em>`, sub: "Newborn life. The one show he did watch that week: Roman Empire, episode \"Born in the Purple.\"" },
    { dur: 5, wall: true, center: true, kicker: "Big sister mode", line: "Good luck,<br><em>Amaira</em>", sub: `Years later she'd copy my shows: ${DATA.family.me_to_sister.first} of ${DATA.family.me_to_sister.shared}, every one after me.` },
  ];
}
function kidsProfileFilm() {
  const d = DATA.family?.detective, el = era("elementary");
  return [
    { dur: 5, cast: "suhani", age: 11, kicker: "2017", line: "Dad's<br><em>profile</em>", sub: "Technically his. Practically mine.", say: "He wasn't using it." },
    ...(d ? [{ dur: 5, black: true, center: true, kicker: "Dad's profile, 2017", line: `<span class="scene__counter" data-to="${d.kids_file["2017"]}">0</span><br><em>views</em>`, sub: "Jessie, Liv and Maddie, Lab Rats. Very few of them were Dad." }] : []),
    { dur: 5, montage: postersOf(["Liv and Maddie", "Lab Rats", "Jessie", "Mighty Med", "Bunk'd", "Good Luck Charlie"]), center: true, kicker: "Peak Disney", line: "The Disney<br><em>years</em>", sub: "" },
    { dur: 5, img: backdropOf("Mighty Med"), alt: true, kicker: "Mother's Day 2017", line: "13 episodes of<br><em>Mighty Med</em>", sub: "Sorry, Mumma." },
    { dur: 5.5, black: true, center: true, kicker: d ? fmtDate(d.my_profile_from) : "December 2017", line: "My own<br><em>profile</em>", sub: d ? `And Dad's profile went quiet: ${d.kids_file["2018"]} views the next year.` : "" },
  ];
}

// S2 · Middle School
function ownProfileFilm() {
  const ms = era("middle");
  return [
    { dur: 5.5, cast: "suhani", age: 12, kicker: "Season 2 · Middle School", line: "The family-<br><em>drama</em> era", sub: "Freeform, the CW and a lot of secrets.", say: "Everyone on TV was adopted or switched at birth." },
    { dur: 5.5, montage: postersOf(ms.top.slice(0, 6)), center: true, kicker: "2017 – 2020", line: "Switched at Birth,<br><em>The Fosters</em>", sub: `${listOf(ms.top.slice(0, 4).map((s) => s.show))}.` },
    { dur: 5, img: backdropOf("Baby Daddy"), kicker: "Attachment issues, chapter 1", line: "Finale, then<br><em>back to Season 5</em>", sub: "30 more episodes after the ending." },
    { dur: 5, montage: DATA.loyalty.after_finale.map((x) => ({ img: posterOf(x.show), tag: `+${x.after}` })).filter((m) => m.img), center: true, kicker: "Episodes after the finale", line: "I don't do<br><em>goodbyes</em>", sub: "" },
    { dur: 5, img: backdropOf("The Fosters"), alt: true, kicker: "The Fosters", line: "104 of<br><em>104</em>", sub: "Every single episode." },
    { dur: 4.5, cast: "suhani", age: 13, kicker: "Pattern detected", line: "Commitment<br><em>issues?</em>", sub: "", say: "Other way around." },
  ];
}
function vampireFilm() {
  return [
    { dur: 5, black: true, center: true, kicker: "December 22, 2018", line: "Day one of<br><em>winter break</em>", sub: "Twelve years old. A show about vampires in Virginia." },
    { dur: 5.5, img: backdropOf("The Vampire Diaries"), kicker: "The Vampire Diaries", line: `<span class="scene__counter" data-to="${showViews("The Vampire Diaries")}">0</span><br><em>episodes</em>`, sub: "22 in the last ten days of December. 48 in March. All of it." },
    { dur: 5, montage: postersOf(["The Vampire Diaries", "The Originals", "Riverdale", "Jane The Virgin", "Gossip Girl"]), center: true, kicker: "The CW era begins", line: "Vampires,<br><em>then everything</em>", sub: "Binged, every one." },
    { dur: 5, img: backdropOf("The Originals"), alt: true, kicker: "Then the spin-off", line: "The<br><em>Originals</em>", sub: `${showViews("The Originals")} more episodes. I don't leave a universe once I'm in.` },
    { dur: 4.5, cast: "suhani", age: 12, kicker: "Team?", line: "Damon<br><em>or Stefan</em>", sub: "The data can't say. I can.", say: "Not answering that." },
  ];
}
function sentHomeFilm() {
  const p = DATA.profile, g = DATA.gaps.find((x) => x.from.startsWith("2020"));
  return [
    { dur: 5, black: true, center: true, kicker: "March 13, 2020", line: "Sent<br><em>home</em>", sub: `Schools closed. February: ${p.covid.feb_2020} views. March: ${p.covid.march_2020}.` },
    { dur: 5, img: backdropOf("The Vampire Diaries"), alt: true, kicker: "May 25, 2020 · lockdown", line: "11 episodes<br>in <em>one day</em>", sub: "Back to Mystic Falls." },
    { dur: 5, img: backdropOf("13 Reasons Why"), kicker: "July 2020", line: "13 Reasons<br><em>Why</em>", sub: "The darkest I get. The COVID summer before the move." },
    ...(g ? [{ dur: 5.5, black: true, center: true, kicker: "Summer 2020", line: "Cupertino<br>to <em>Dallas</em>", sub: `Then ${g.days} days with nothing on. A new state, a new school, and no time for TV.` }] : []),
    { dur: 8, set: "playground", tx: true, kicker: "Fall 2020 · Dallas · Suhani, 14",
      cam: [[0, 860, 540, 1200], [4, 860, 540, 1200], [4, 520, 555, 520]],
      things: [
        { who: "kidA", x: 1050, ...PG, s: .8, start: { pose: "hips" } }, { who: "kidB", x: 1160, ...PG, s: .8, keys: [[1, { pose: "wave" }], [2.4, { pose: "idle" }]] }, { who: "kidC", x: 1270, ...PG, s: .8 },
        { who: "suhani13", x: 520, ...PG, start: { mood: "flat" }, keys: [[3.8, { mood: "sad" }]] },
      ],
      talk: [[4.2, "suhani13", "New state. New playground. New kid. Again."]] },
    { dur: 7.5, set: "living", glow: tvGlow, kicker: "The shows that already felt like home",
      cam: [[0, 800, 520, 1000], [7.5, 800, 500, 620]],
      things: [{ who: "suhani13", x: 800, ...COUCH("suhani13"), start: { sit: 1, pose: "remote", mood: "flat" }, keys: [[3.2, { mood: "smile" }]] }],
      talk: [[.8, "suhani13", "Okay. Something I already know."], [3.4, "suhani13", "Hi, Mystic Falls. Missed you."]],
      credits: [[5.4, 2, "Season 3<b>starts in Texas</b>"]] },
  ];
}

// S3 · High School (with Amaira growing up in the background)
function darkFilm() {
  const d = DATA.dark_years;
  return [
    { dur: 5, cast: "suhani", age: 15, kicker: "Season 3 · High School", line: "My \"dark\"<br><em>era</em>", sub: "Spoiler: it wasn't that dark.", say: "I can't handle actual horror." },
    { dur: 5.5, montage: postersOf(d.shows.map((x) => x.show)), center: true, kicker: "2020 – 2021", line: `${d.by_year["2021"]}%<br><em>dark genres</em>`, sub: `${listOf(d.shows.map((x) => x.show))}. Teen mysteries and a missing plane.` },
    { dur: 5, img: backdropOf("Stranger Things"), alt: true, kicker: "January 2021", line: "My darkest<br><em>month</em>", sub: "Stranger Things, in a COVID winter." },
    { dur: 5, img: backdropOf("Manifest"), kicker: "July 24, 2021", line: "16 episodes<br>in <em>one day</em>", sub: "Manifest. A plane disappears for five years. I disappeared for one Saturday." },
    ...amairaCut(2021),
  ];
}
function greysFilm() {
  return [
    { dur: 5, img: backdropOf("Grey's Anatomy"), kicker: "May – June 2021", line: "The Grey's<br><em>summer</em>", sub: `${showViews("Grey's Anatomy")} episodes of a medical show.` },
    { dur: 5, black: true, center: true, kicker: "May 25, 2021", line: `<span class="scene__counter" data-to="13">0</span> episodes<br>in <em>one day</em>`, sub: "On a Tuesday." },
    { dur: 5, montage: postersOf(era("high").top.slice(0, 6)), center: true, kicker: "The high school lineup", line: "Summer<br><em>binge mode</em>", sub: "" },
    { dur: 5, cast: "suhani", age: 15, kicker: "Plot twist", line: "I don't even like<br><em>medical shows</em>", sub: "Never finished. 400+ episodes. I have limits.", say: "It was a summer thing." },
    ...amairaCut(2022),
  ];
}
function meEraFilm() {
  const me = Object.entries(DATA.loyalty.me_titles), f = DATA.family;
  return [
    { dur: 5.5, black: true, center: true, kicker: "Episode titles with I, me or my", line: "The<br><em>me era</em>", sub: me.map(([e, v]) => `${e}: ${v}%`).join(" · ") },
    { dur: 5, img: backdropOf("Jane The Virgin"), alt: true, kicker: "September 2023", line: "Finished Jane,<br><em>then 55 more</em>", sub: "Watched the finale. Kept going." },
    { dur: 5, img: backdropOf("Gilmore Girls"), kicker: "Stars Hollow", line: "Gilmore<br><em>Girls</em>", sub: `${showViews("Gilmore Girls")} episodes. A mom and daughter who talk too fast. Relatable.` },
    ...(f ? [{ dur: 5.5, cast: "mom", kicker: "Enter Mumma", line: "My Hindi<br><em>recommender</em>", sub: `She watched ${f.mom_hindi_lead.mom_first} of our ${f.mom_hindi_lead.shared} shared Hindi titles first. I started ${f.mom_hindi_lead.next_week} of them within a week.` }] : []),
    ...amairaCut(2023),
  ];
}
function seniorFilm() {
  const p = DATA.profile, d = DATA.family?.detective;
  return [
    { dur: 5.5, black: true, center: true, kicker: "January – June 2024", line: `<span class="scene__counter" data-to="${p.senior_spring.views}">0</span> views<br>in <em>six months</em>`, sub: "Senior spring. College apps, AP exams, prom. No time for TV." },
    { dur: 5, montage: postersOf(DATA.windows.last_summer_home.top.map((x) => x.show)), center: true, kicker: "Graduation summer", line: "Making up<br><em>for lost time</em>", sub: "" },
    { dur: 5, cast: "suhani", age: 18, kicker: "May 2024", line: "Class of<br><em>2024</em>", sub: `Then ${p.senior_spring.summer_after} views in the seven weeks after graduation.`, say: "Okay NOW I can watch TV." },
    ...(d ? [{ dur: 5, cast: "amaira", kicker: fmtDate(d.sister_profile_from), line: "Amaira gets<br><em>her own profile</em>", sub: "Seven years old. iCarly, The Thundermans, Barbie. The side character got a spin-off." }] : []),
  ];
}

// S4 · College: back to the pilot
function householdFilm() {
  const { windows: w, dates } = DATA;
  return [
    { dur: 5.5, cast: "suhani", kicker: "Season 4 · College", line: "Back to<br><em>the dorm</em>", sub: "Remember the cold open? Here's what happened.", say: "Okay, so." },
    { dur: 6, wall: true, center: true, kicker: `Netflix · ${fmtDate(dates.crackdown)}`, line: "“One<br><em>household.</em>”", sub: "One home. One Wi-Fi. Ours: four of us in Dallas." },
    { dur: 5, black: true, center: true, kicker: "May – December 2023", line: `<span class="scene__counter" data-to="${w.after_crackdown.views}">0</span><br><em>views</em>`, sub: "At home, nothing changed. Yet." },
    { dur: 6.5, phone: { who: "dad", name: "Papa", lines: [{ me: true, text: "Papa what's the Netflix code??" }, { text: "You're on your own, kid." }, { me: true, text: "😭" }] }, kicker: fmtDate(dates.austin), line: "Not part of<br><em>the household</em>", sub: "200 miles from the Dallas Wi-Fi." },
    { dur: 5, img: backdropOf(w.first_semester.top[0]?.show || "Gossip Girl"), kicker: "Fall 2024", line: `${w.first_semester.views}<br><em>views</em>`, sub: "My whole first semester. About one month's worth back home." },
  ];
}
function homesickFilm() {
  const p = DATA.profile, f = DATA.family;
  return [
    { dur: 5, cast: "suhani", age: 19, kicker: "Missing home", line: "Homesick,<br><em>in Hindi</em>", sub: `In college, Hindi is ${Math.round(p.hindi_away)}% of my series when I'm away and ${Math.round(p.hindi_home)}% when I'm home.`, say: "Mumma's shows hit different in a dorm." },
    { dur: 5.5, img: backdropOf("The Great Indian Kapil Show"), kicker: "The family show", line: "Kapil,<br><em>on the same day</em>", sub: f ? `Mom and I watched it on the same day ${f.kapil_same_day} times, 200 miles apart.` : "" },
    { dur: 5, montage: postersOf(era("after").examples.hindi), center: true, kicker: "On repeat in the dorm", line: "Hindi,<br><em>more and more</em>", sub: "" },
    { dur: 5, cast: "mom", kicker: "200 miles apart", line: "Same show,<br><em>same night</em>", sub: "", say: "Did you watch the new Kapil?" },
    { dur: 5, black: true, center: true, kicker: "Winter break, January 2026", line: `${p.jan_2026.movies} movies,<br><em>${p.jan_2026.hindi} in Hindi</em>`, sub: "Movie nights with Mumma." },
  ];
}
function stillFilm() {
  const t = DATA.totals;
  return [
    { dur: 5, rewind: true, montage: postersOf(DATA.yearly.map((y) => y.show)), center: true, kicker: "2015 → 2026", line: "Eleven<br><em>years</em>", sub: `${n(t.views)} views. ${n(t.titles)} titles. ${n(t.active_days)} days with something on.` },
    { dur: 5, montage: DATA.yearly.map((y) => ({ img: posterOf(y.show), tag: y.year })).filter((m) => m.img), center: true, kicker: "One show a year", line: "Every<br><em>era</em>", sub: "" },
    ...(DATA.genre_pie ? [{ dur: 5.5, black: true, center: true, kicker: "Eleven years, by genre", line: "Romance<br><em>first, always</em>", sub: "", viz: viz(pie(DATA.genre_pie)) }] : []),
    { dur: 5, img: backdropOf("Gossip Girl"), kicker: `${DATA.streak.days} days in a row`, line: "Home<br><em>for summer</em>", sub: "My longest streak ever." },
    { dur: 5.5, cast: "suhani", age: 20, kicker: "Still here", line: "Same profile.<br><em>Different person.</em>", sub: "Disney Channel in Cupertino to Hindi rom-coms in a dorm.", say: "Netflix raised me. A little." },
    { dur: 6, black: true, center: true, kicker: "", line: "Are you<br>still <em>watching?</em>", sub: "Yes." },
  ];
}

// S5 · The Household
function detectiveFilm() {
  const d = DATA.family?.detective;
  if (!d) return [];
  return [
    { dur: 5.5, black: true, center: true, kicker: "Season 5 · The Household", line: "Four files.<br><em>No names.</em>", sub: "Just titles and dates. Can the data figure out who lives here?" },
    { dur: 6, black: true, center: true, kicker: "File 1", line: "A kids' profile that<br><em>changed hands</em>", sub: `Disney tween shows peak in 2017 (${d.kids_file["2017"]} views), drop to ${d.kids_file["2018"]}, then come back as preschool shows in 2019. Two kids, about ten years apart.` },
    { dur: 5.5, cast: "suhani", kicker: "File 3 opens · December 2017", line: "The big<br><em>sister</em>", sub: "The moment File 1 went quiet, a new profile started: Switched at Birth, Girl Meets World. The older girl got her own." },
    { dur: 5.5, cast: "amaira", kicker: "File 4 opens · September 2023", line: "The little<br><em>sister</em>", sub: "File 1 goes quiet again. A new profile: Barbie, iCarly, The Thundermans." },
    { dur: 6, cast: "mom", kicker: "File 2", line: "Two people,<br><em>one profile</em>", sub: `Hindi movies on some days, cartel shows on others, and almost never both. ${d.mom_file_dad}% of this profile is one person, ${d.mom_file_mom}% the other.` },
    { dur: 5, cast: "dad", kicker: "The verdict", line: "A dad, a mom,<br><em>two daughters</em>", sub: "Indian-American, about ten years between the girls. Nobody told the data. It figured it out." },
  ];
}
function momFilm() {
  const f = DATA.family, m = f?.parents?.Mom;
  if (!m) return [];
  return [
    { dur: 5, cast: "mom", kicker: "A Tiwari household special", line: "Hi,<br><em>Mumma</em>", sub: "Who she is, read from her history alone." },
    { dur: 5.5, black: true, center: true, kicker: "Watcher type", line: "The movie<br><em>person</em>", sub: `${n(m.movies)} Hindi movies, ${m.movie_pct}% of everything she watches. ${m.fast}% of the series she picks are done in 3 days. Rewatches: ${f.profiles.Mom.rewatched}, ever.` },
    ...whoScenes("Mom"),
    { dur: 5, montage: postersOf(m.top), center: true, kicker: "Her top 10 series", line: "Hindi<br><em>crime</em>", sub: "Not too scary. A little funny." },
    readingScene("Mom", m.years.filter((y) => y.show)),
    { dur: 5.5, black: true, center: true, kicker: "Hindi movies a year", line: `${m.years.at(-1).movies} in<br><em>${m.years.at(-1).year}</em>`, sub: "Her biggest year yet.", viz: viz(`<div class="mbars">${m.years.map((y) => `<span style="--h:${y.movies}"><i></i>${String(y.year).slice(2)}</span>`).join("")}</div>`) },
    ...(f.mom_parent_titles?.length ? [{ dur: 5, montage: postersOf(f.mom_parent_titles), center: true, kicker: "Moms, dads and grandparents", line: `${f.mom_parent_titles.length}<br><em>titles</em>`, sub: `Family in the title. Dad has ${f.dad_parent_titles.length}, and his are deadly.` }] : []),
    { dur: 4.5, cast: "mom", kicker: "Mumma", line: "One sitting,<br><em>done</em>", sub: "", say: "One more movie." },
  ];
}
// In the living room, a standing grown-up is closer to the camera than the couch, so a little bigger.
const STAND = { y: 870, s: 1.2 };
const tvGlow = [[".lv-tv", 0]];
const browse = (shows, row, keys) => ({ kind: "browse", x: 0, shows: shows.filter((s) => ART[s]), row, keys });
// Papa's episode: a sitcom, every punchline straight out of his viewing history.
function dadFilm() {
  const f = DATA.family, pp = f?.parents?.Dad, d = f?.detective;
  if (!pp) return [];
  const md = f.dad_on_mothers_day || [], bday = f.dad_sister_birthday_picks || [], k = f.kapil || {};
  const quit = f.pilot_quitters || {}, started = f.shows_started || {};
  const cast = (who) => ({ Dad: "Papa", Me: "Suhani", "My sister": "Amaira", Mom: "Mumma" })[who] || who;
  return [
    { dur: 6.5, set: "living", glow: tvGlow, kicker: "Mother's Day, 2023 · the Tiwari living room",
      cam: [[0, 900, 520, 1200], [4, 900, 520, 1200], [4, 700, 470, 560]],
      things: [
        { who: "dad", x: 700, ...COUCH("dad"), start: { sit: 1, pose: "remote" } },
        { who: "mom", x: 1700, ...STAND, start: { walk: 1 }, keys: [[.2, { x: 1700 }], [1.6, { x: 1180, walk: 0, e: "linear" }], [1.7, { pose: "hips" }]] },
      ],
      talk: [[1.8, "mom", "It's Mother's Day. You pick the movie."], [4.3, "dad", "Already on it."]] },
    { dur: 5, set: "browse", kicker: "His pick",
      cam: [[0, 800, 450, 1600], [5, 760, 400, 1300]],
      things: [browse(["The Mother"], "Continue Watching for Papa")],
      talk: [[1.4, "dad", "It has \"Mother\" in the title."]] },
    { dur: 8, set: "living", glow: tvGlow, kicker: "The Mother: an assassin movie",
      cam: [[0, 1180, 470, 600], [2.5, 1180, 470, 600], [2.5, 700, 470, 560], [5, 700, 470, 560], [5, 900, 520, 1200]],
      things: [
        { who: "dad", x: 700, ...COUCH("dad"), start: { sit: 1, pose: "remote" } },
        { who: "mom", x: 1180, ...STAND, start: { pose: "hips", mood: "flat" } },
      ],
      talk: [[.4, "mom", "It's about an assassin."], [2.6, "dad", "A mother assassin. Happy Mother's Day."]],
      credits: [[5.2, 2.6, `His other Mother's Day picks<b>${md.filter((x) => x.year < 2023).slice(0, 2).map((x) => `${esc(x.show)} (${x.year})`).join(" · ")}</b>`]] },
    { dur: 7, set: "browse", kicker: "One episode each",
      things: [browse(pp.top.map((t) => t.show), "Papa's Pilots", [[.4, { x: 0 }], [6.2, { x: (pp.top.filter((t) => ART[t.show]).length - 1) * TILE, e: "linear" }]])],
      talk: [[.6, "dad", "Slow.", .9], [1.7, "dad", "Too slow.", .9], [2.8, "dad", "Too many subtitles.", 1.1], [4.1, "dad", "Slow.", .9], [5.3, "dad", "…Okay, Narcos again."]] },
    { dur: 7, set: "chart", kicker: `Shows started: ${cast("Dad")} ${started.Dad}`,
      things: [
        { kind: "bars", w: 1000, title: "SHOWS DROPPED AFTER EPISODE 1", keys: [[.3, { p: 0 }], [3.4, { p: 1, e: "linear" }]],
          data: Object.entries(quit).map(([who, v]) => ({ v, label: cast(who), hi: who === "Dad" })) },
        { who: "dad", x: 1340, y: 760, s: .95, keys: [[3.6, { pose: "hips" }]] },
      ],
      talk: [[4, "dad", "I know what I like within one episode."]] },
    { dur: 6.5, set: "browse", kicker: "2017 · Papa opens his own profile",
      things: [browse(["Liv and Maddie", "Jessie", "Sofia the First", "PJ Masks", "Masha and the Bear"], "Continue Watching for Papa")],
      talk: [[1, "dad", "Who is watching Liv and Maddie on MY profile?"]],
      credits: d ? [[3.8, 2.6, `Papa's profile<b>${d.dad_file_daughters}% his daughters · ${d.dad_file_dad}% Papa</b>`]] : [] },
    { dur: 6, set: "living", glow: tvGlow, kicker: "The suspects",
      cam: [[0, 900, 500, 1100], [2.7, 900, 500, 1100], [2.7, 1050, 470, 600]],
      things: [
        { who: "suhani11", x: 760, ...COUCH("suhani11"), start: { sit: 1, pose: "lap", mood: "smile" } },
        { who: "mom", x: 1050, ...COUCH("mom"), start: { sit: 1, pose: "cradle", mood: "flat" } },
      ],
      talk: [[.5, "suhani11", "It was Amaira."], [2.8, "mom", "She is six months old."]] },
    { dur: 6.5, set: "browse", kicker: "So Papa moved to Mumma's profile",
      things: [browse(["Narcos", "Sons of Anarchy", "Ozark", "El Chapo", "Peaky Blinders"], "Continue Watching for Mumma")],
      talk: [[1, "mom", "Why does my profile think I run a cartel?"]],
      credits: d ? [[3.6, 2.7, `Mumma's profile<b>${d.mom_file_dad}% Papa · ${d.mom_file_mom}% Mumma</b>`]] : [] },
    { dur: 9.5, set: "living", glow: tvGlow, kicker: "April 26, 2018 · Papa's birthday",
      cam: [[0, 860, 540, 1150], [2.6, 860, 540, 1150], [2.6, 700, 470, 560], [4.6, 700, 470, 560], [4.6, 1180, 480, 600], [6.6, 1180, 480, 600], [6.6, 700, 470, 560]],
      things: [
        { who: "dad", x: 700, ...COUCH("dad"), hat: true, start: { sit: 1, pose: "remote" } },
        { kind: "cake", x: 900, y: 800, candles: 4 },
        { who: "mom", x: 1180, ...STAND, start: { pose: "hips" }, keys: [[4.6, { mood: "shock" }], [6.6, { mood: "flat" }]] },
      ],
      talk: [[.5, "mom", "Happy birthday! What are we watching?"], [2.7, "dad", "24 Hours to Live."], [4.7, "mom", "…On your birthday?"], [6.7, "dad", "It's motivational."]] },
    { dur: 8.5, set: "living", glow: tvGlow, kicker: "Every year on Amaira's birthday",
      cam: [[0, 860, 540, 1150], [2.7, 860, 540, 1150], [2.7, 700, 470, 560]],
      things: [
        { who: "dad", x: 700, ...COUCH("dad"), start: { sit: 1, pose: "remote" } },
        { who: "amaira6", x: 1050, y: 860, s: 1.25, hat: true, start: { pose: "hips", mood: "flat" } },
      ],
      talk: [[.5, "amaira6", "Papa. It's MY birthday."], [2.8, "dad", "Narcos is a family show. It's about a family business."]],
      credits: [[6, 2.4, `His picks on her birthdays<b>${bday.map(esc).join(" · ")}</b>`]] },
    { dur: 8, set: "chart", kicker: "The Great Indian Kapil Show · views",
      things: [
        { kind: "bars", w: 1000, title: "THE FAMILY'S FAVORITE COMEDY", keys: [[.3, { p: 0 }], [3, { p: 1, e: "linear" }]],
          data: Object.entries(k).map(([who, v]) => ({ v, label: cast(who), hi: who === "Dad" })) },
        { who: "dad", x: 1340, y: 760, s: .95, keys: [[3.2, { pose: "hips", mood: "flat" }]] },
      ],
      talk: [[3.4, "dad", "I watched one. It was enough."]],
      credits: [[5.6, 2.4, "<small>A household special</small>Papa: The Sampler", true]] },
  ];
}

// Amaira copies everything I watch, years later. The data has the receipts.
function copyCatFilm() {
  const f = DATA.family, c = f?.copy_cat || [], ms = f?.me_to_sister;
  if (!c.length) return [];
  const short = (s) => ({ "The Secret Life of Pets": "Secret Life of Pets", "Walt Disney Animation Studios Short Films Collection": "Disney Shorts" })[s] || s;
  const dil = c.find((x) => x.show === "Dilwale");
  return [
    { dur: 9.5, set: "living", glow: tvGlow, kicker: "Summer 2025 · home from college",
      cam: [[0, 830, 500, 900], [3.9, 830, 500, 900], [3.9, 700, 470, 520], [5.5, 700, 470, 520], [5.5, 960, 520, 480], [6.9, 960, 520, 480], [6.9, 830, 500, 900]],
      things: [
        { who: "suhani", x: 700, ...COUCH("suhani"), start: { sit: 1, pose: "lap" }, keys: [[1, { pose: "hips" }], [2.5, { pose: "face" }], [3.8, { pose: "lap", mood: "flat" }]] },
        { who: "amaira", x: 960, ...COUCH("amaira"), start: { sit: 1, pose: "lap" }, keys: [[1.5, { pose: "hips" }], [3, { pose: "face" }], [4.2, { pose: "lap", mood: "flat" }]] },
      ],
      talk: [[4, "suhani", "Stop copying me."], [5.6, "amaira", "Stop copying me."], [7, "suhani", "Amaira!", 1], [8.1, "amaira", "Amaira!", 1]] },
    { dur: 7, set: "browse", kicker: "Her profile, 2025",
      things: [browse(c.slice(0, 6).map((x) => x.show), "Continue Watching for Amaira", [[.5, { x: 0 }], [4.6, { x: 3 * TILE }]])],
      talk: [[1, "suhani", "Wait. I watched every single one of these."], [4.6, "amaira", "So?"]] },
    { dur: 8, set: "chart", kicker: "Same titles, my profile vs. hers",
      things: [{ kind: "bars", title: "YEARS AFTER I WATCHED IT", keys: [[.3, { p: 0 }], [5, { p: 1, e: "linear" }]],
        data: c.slice(0, 6).map((x) => ({ v: Math.round(x.years * 10) / 10, label: short(x.show), hi: true })) }],
      credits: ms ? [[5.4, 2.5, `Shows we both watched<b>${ms.shared} · I was first on ${ms.first}</b>`]] : [] },
    { dur: 6.5, kicker: "LEGO Ninjago · 2015 | 2020",
      panes: [
        { set: "living", glow: tvGlow, cam: [[0, 800, 560, 620]], things: [{ who: "suhani9", x: 800, ...COUCH("suhani9"), start: { sit: 1, pose: "lap" }, keys: [[.8, { pose: "wave" }], [2.2, { pose: "lap" }]] }] },
        { set: "living", glow: tvGlow, cam: [[0, 800, 580, 600]], things: [{ who: "amaira3", x: 800, ...COUCH("amaira3"), start: { sit: 1, pose: "lap" }, keys: [[2.2, { pose: "wave" }], [3.6, { pose: "lap" }]] }] },
      ],
      talk: [[.8, "suhani9", "NINJAGO!", 1.2], [2.3, "amaira3", "NINJAGO!", 1.2]] },
    ...(dil ? [{ dur: 9.5, set: "living", glow: tvGlow, kicker: `${dil.her} · Dilwale`,
      cam: [[0, 980, 520, 1100], [2.9, 980, 520, 1100], [2.9, 900, 520, 480], [4.4, 900, 520, 480], [4.4, 1200, 480, 600]],
      things: [
        { who: "amaira", x: 900, ...COUCH("amaira"), start: { sit: 1, pose: "remote" } },
        { who: "mom", x: 1700, ...STAND, start: { walk: 1 }, keys: [[.1, { x: 1700 }], [1.1, { x: 1200, walk: 0, e: "linear" }], [1.2, { pose: "hips", mood: "shock" }], [5, { mood: "flat" }]] },
      ],
      talk: [[1.2, "mom", "Dilwale? Since when do you watch Hindi movies?"], [3, "amaira", "Didi watched it."], [4.5, "mom", `In ${dil.me}.`]],
      credits: [[6.6, 2.7, "<small>A household special</small>Amaira: The Copycat", true]] }] : []),
  ];
}

// Amaira never knew a house without Netflix. Growing up with it, from day one.
function bornStreamingFilm() {
  const f = DATA.family, a = f?.amaira, d = f?.detective;
  if (!a?.years?.length) return [];
  const ys = a.years, age = sisterAge;
  const peak = ys.filter((y) => age(y.year) <= 4).reduce((m, y) => (y.views > m.views ? y : m));
  return [
    { dur: 8.5, set: "living", glow: tvGlow, kicker: "November 20, 2016 · Amaira is one week old",
      cam: [[0, 860, 520, 1150], [.4, 860, 520, 1150], [.4, 640, 470, 560], [4.4, 640, 470, 560], [4.4, 820, 540, 560], [6.6, 820, 540, 560], [6.6, 860, 520, 1150]],
      things: [
        { who: "dad", x: 640, ...COUCH("dad"), start: { sit: 1, pose: "remote" } },
        { who: "suhani11", x: 820, ...COUCH("suhani11"), start: { sit: 1, pose: "lap" }, keys: [[4.4, { mood: "flat" }]] },
        { who: "mom", x: 1020, ...COUCH("mom"), start: { sit: 1, pose: "cradle" } },
      ],
      talk: [[.5, "dad", "Roman Empire. This episode is called \"Born in the Purple.\""], [4.5, "suhani11", "Papa. She is ONE WEEK old."]],
      credits: [[6.8, 1.7, "<small>A household special</small>Born Streaming", true]] },
    { dur: 7, set: "living", glow: tvGlow, kicker: "Age 2 · Little Baby Bum, on repeat",
      cam: [[0, 800, 600, 900], [7, 800, 640, 600]],
      things: [{ who: "amaira2", x: 800, y: 880, s: 1.3, start: { pose: "idle" }, keys: [[.8, { pose: "wave" }], [1.6, { pose: "idle" }], [2.2, { pose: "wave" }], [3, { pose: "idle" }], [3.6, { pose: "wave" }], [4.4, { pose: "idle" }]] }],
      talk: [[.8, "amaira2", "AGAIN!", .8], [2.2, "amaira2", "AGAIN!", .8], [3.6, "amaira2", "AGAIN!!", .9]],
      credits: [[4.8, 2.1, "Netflix keeps one date per episode<b>Every rewatch erased the last one</b>"]] },
    { dur: 6.5, set: "browse", kicker: "Raised on Papa's profile",
      things: [browse(["Sofia the First", "Masha and the Bear", "PJ Masks", "Little Baby Bum", "Octonauts"], "Continue Watching for Papa")],
      talk: [[1, "dad", "This is still my profile, right?"]],
      credits: [[3.4, 2.8, `Amaira's whole life on Netflix<b>${a.on_dad}% on Papa's profile</b>`]] },
    { dur: 8, set: "chart", kicker: "Amaira's views at every age",
      things: [{ kind: "bars", title: "GROWING UP ON NETFLIX", keys: [[.3, { p: 0 }], [5.5, { p: 1, e: "linear" }]],
        data: ys.map((y) => ({ v: y.views, label: `Age ${age(y.year)}`, hi: y === peak })),
        marks: [{ i: ys.indexOf(peak), text: "Preschool peak", sub: `${peak.views} views` }] }] },
    ...(d ? [{ dur: 6, set: "living", glow: tvGlow, kicker: `${fmtMonth(d.sister_profile_from.slice(0, 7))} · age ${age(+d.sister_profile_from.slice(0, 4))}`,
      cam: [[0, 800, 600, 900], [6, 800, 610, 640]],
      things: [{ who: "amaira6", x: 800, y: 870, s: 1.3, start: { pose: "remote" }, keys: [[2.6, { pose: "wave" }]] }],
      talk: [[.6, "amaira6", "Wait. That one says AMAIRA."], [2.7, "amaira6", "Finally. My own profile."]] }] : []),
    { dur: 7.5, set: "living", glow: tvGlow, kicker: `${ys.at(-1).year} · age ${age(ys.at(-1).year)} · ${ys.at(-1).views} views and counting`,
      cam: [[0, 830, 500, 900], [3, 830, 500, 900], [3, 700, 470, 520]],
      things: [
        { who: "suhani", x: 700, ...COUCH("suhani"), start: { sit: 1, pose: "lap" } },
        { who: "amaira", x: 960, ...COUCH("amaira"), start: { sit: 1, pose: "remote" } },
      ],
      talk: [[.6, "amaira", "Didi. Are you still watching?"], [3.1, "suhani", "Obviously."]],
      credits: [[4.8, 2.6, "She's never known a TV<b>that didn't ask</b>"]] },
  ];
}
function accountFilm() {
  const d = DATA.family?.detective;
  if (!d) return [];
  return [
    { dur: 5.5, cast: "dad", kicker: "Dad's profile", line: `${d.dad_file_daughters}%<br><em>his daughters</em>`, sub: `Only ${d.dad_file_dad}% of the views on his own profile are him.` },
    { dur: 5.5, cast: "mom", kicker: "Mom's profile", line: `${d.mom_file_dad}%<br><em>Dad</em>`, sub: `He lives on her profile. Only ${d.mom_file_mom}% of it is her.` },
    { dur: 5, montage: postersOf(["Jessie", "Good Luck Charlie", "Liv and Maddie", "Sofia the First", "PJ Masks", "Masha and the Bear"]), center: true, kicker: "What was really on Dad's profile", line: "Not exactly<br><em>Narcos</em>", sub: "" },
    { dur: 5, montage: postersOf(DATA.family.parents?.Dad?.top || []), center: true, kicker: "What Dad watched on Mom's", line: "Definitely<br><em>Narcos</em>", sub: "" },
    { dur: 5, cast: "suhani", kicker: "My profile", line: "Almost all<br><em>me</em>", sub: "Which is why Netflix noticed when it left.", say: "You're on your own, kid. Got it." },
  ];
}

const SEASONS = [
  { n: 1, title: "Elementary", sub: "Cupertino, 2015 – 2017. A cold open in a dorm, then rewind." },
  { n: 2, title: "Middle School", sub: "My own profile, vampires, Friends and a pandemic." },
  { n: 3, title: "High School", sub: "Dallas, 2020 – 2024. Plus my little sister, growing up in the background." },
  { n: 4, title: "College", sub: "Back to the dorm, and what actually happened." },
  { n: 5, title: "The Household", sub: "Four profiles, one account, no names." },
];
const FILMS = {
  pilot: { season: 1, subtitle: "You're On Your Own, Kid", scenes: pilotFilm, art: "Friends", blurb: "Move-in day in West Campus. Mumma, Papa and Amaira drive away, Netflix locks her out, and Papa says she's on her own." },
  growing: { season: 1, subtitle: "Hi, I'm Suhani", scenes: helloFilm, art: "Jessie", blurb: "Cupertino, 2015. The playground laughs at her accent. Then Papa discovers Netflix, and a nanny from Texas teaches her American." },
  amaira: { season: 1, subtitle: "Good Luck, Amaira", scenes: amairaFilm, art: "Good Luck Charlie", blurb: "A baby sister comes home. A big sister finds a sitcom about exactly that." },
  kids: { season: 1, subtitle: "The Kids' Profile", scenes: kidsProfileFilm, art: "Liv and Maddie", blurb: "Dad's profile, technically. Then one of her own." },
  own: { season: 2, subtitle: "The Family-Drama Era", scenes: ownProfileFilm, art: "Switched at Birth", blurb: "Freeform, secrets, and finishing a show only to start it again." },
  vampire: { season: 2, subtitle: "Winter Break Vampire", scenes: vampireFilm, art: "The Vampire Diaries", blurb: "Day one of winter break, 2018. Then 172 episodes." },
  friends: { season: 2, subtitle: "The One With the Deadline", scenes: friendsFilm, art: "Friends", blurb: "Friends is leaving Netflix in 31 days. An eighth-grader takes that personally." },
  sent: { season: 2, subtitle: "Sent Home", scenes: sentHomeFilm, art: "13 Reasons Why", blurb: "COVID, a cross-country move, and 56 days of silence." },
  dark: { season: 3, subtitle: "My \"Dark\" Era", scenes: darkFilm, art: "Manifest", blurb: "Teen mysteries and a missing plane. As dark as it gets." },
  greys: { season: 3, subtitle: "The Grey's Summer", scenes: greysFilm, art: "Grey's Anatomy", blurb: "A medical show she doesn't even like, binged anyway." },
  me: { season: 3, subtitle: "The Me Era", scenes: meEraFilm, art: "Gilmore Girls", blurb: "Gilmore Girls, Hindi from Mumma, and titles all about me." },
  changed: { season: 3, subtitle: "What Changed", scenes: changedFilm, art: "Gilmore Girls", blurb: "Four schools, four of me, in bars built from posters." },
  senior: { season: 3, subtitle: "Senior Spring", scenes: seniorFilm, art: "Gossip Girl", blurb: "Fourteen views in six months. Then graduation, and a spin-off for Amaira." },
  password: { season: 4, subtitle: "One Household", scenes: householdFilm, art: "Friends", blurb: "Back to the dorm: what Netflix changed, and why Dad said what he said." },
  homesick: { season: 4, subtitle: "Homesick, in Hindi", scenes: homesickFilm, art: "The Great Indian Kapil Show", blurb: "Kapil on the same day as Mumma, 200 miles apart." },
  summer: { season: 4, subtitle: "Home for the Summer", scenes: summerFilm, art: "Gossip Girl", blurb: "Back on the Dallas Wi-Fi. 26 days in a row." },
  still: { season: 4, subtitle: "Still Watching", scenes: stillFilm, art: "Bridgerton", blurb: "Eleven years later. Are you still watching?" },
  detective: { season: 5, subtitle: "Four Files, No Names", scenes: detectiveFilm, art: "Fuller House", blurb: "Four zip files, no labels. The data figures out the family anyway." },
  watch: { season: 5, subtitle: "How We Watch", scenes: watchFilm, art: "Fuller House", blurb: "A binger, a superfan, a sampler and a movie person." },
  dad: { season: 5, subtitle: "Papa: The Sampler", scenes: dadFilm, art: "The Mother", blurb: "A sitcom. The Mother on Mother's Day, 24 Hours to Live on his birthday, Narcos on Amaira's, and 205 pilots he never finished." },
  mom: { season: 5, subtitle: "Mumma: The Movie Person", scenes: momFilm, art: "Delhi Crime", blurb: "A household special. Who Mumma is, from her history alone: a shared profile, brand-new releases and '90s Shah Rukh." },
  born: { season: 5, subtitle: "Born Streaming", scenes: bornStreamingFilm, art: "Octonauts", blurb: "Amaira, one week old, while Papa watches \"Born in the Purple.\" Then Little Baby Bum on repeat, Papa\'s profile, and finally her own." },
  copycat: { season: 5, subtitle: "Amaira: The Copycat", scenes: copyCatFilm, art: "The Secret Life of Pets", blurb: "She watches everything I watched, years later. Same couch, same poses, same shows. The data has receipts." },
  account: { season: 5, subtitle: "The Account", scenes: accountFilm, art: "Narcos", blurb: "Whose profile is it, really?" },
};
Object.values(FILMS).forEach((f) => { f.name = "Still Watching"; });
// Episode numbers and autoplay order follow the list above.
Object.entries(FILMS).forEach(([k, f], i, all) => {
  f.num = all.filter(([, x]) => x.season === f.season).findIndex(([kk]) => kk === k) + 1;
  f.ep = `S${f.season}:E${f.num}`;
  f.next = all[i + 1]?.[0] || null;
});
const filmLength = (f) => { const t = Math.round(f.scenes().reduce((a, s) => a + s.dur, 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };

// Inline previews: scroll to a section and its episode starts playing right there, muted, the way
// Netflix previews do. Only the most visible one plays. Click to watch it full screen.
function teaserHTML(key) {
  const f = FILMS[key];
  return `<div class="teaser" data-film="${key}" role="button" tabindex="0" aria-label="Play ${f.ep}: ${esc(f.subtitle)}" style="background-image:url('${backdropOf(f.art)}')">
    <div class="teaser__stage"></div>
    <span class="teaser__badge">Preview · muted</span>
    <div class="teaser__info"><span class="teaser__ep">${f.ep}</span><b>${esc(f.subtitle)}</b><span class="teaser__watch">▶ Watch full screen · ${filmLength(f)}</span></div>
    <div class="teaser__bar"><i></i></div>
  </div>`;
}

function setupTeasers() {
  const els = [...document.querySelectorAll(".teaser")];
  if (!els.length) return;
  const films = new Map();
  const build = (el) => {
    if (films.has(el)) return films.get(el);
    const list = FILMS[el.dataset.film].scenes().map((s) => s.montage ? { ...s, montage: s.montage.filter((m) => m.img) } : s);
    const stage = el.querySelector(".teaser__stage");
    stage.innerHTML = list.map(sceneHTML).join("");
    stage.querySelectorAll(".scene__counter").forEach((c) => { c.textContent = c.dataset.to; });
    const f = { el, list, scenes: [...stage.children], i: -1, t: 0, total: list.reduce((a, s) => a + s.dur, 0) };
    films.set(el, f);
    return f;
  };
  const show = (f, i) => {
    f.scenes.forEach((sc, k) => {
      if (k === i) { sc.classList.remove("is-on"); void sc.offsetWidth; }
      sc.classList.toggle("is-on", k === i);
    });
    f.i = i;
  };
  els.forEach((el) => el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.click(); } }));
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { els.forEach((el) => { const f = build(el); show(f, 0); animateSet(f.scenes[0], f.list[0], f.list[0].dur / 2); }); return; }

  let active = null, raf = 0, last = 0;
  const frame = (now) => {
    const f = active;
    if (!f) return;
    f.t = (f.t + (now - last) / 1000) % f.total;
    last = now;
    let acc = 0, i = 0;
    while (i < f.list.length - 1 && acc + f.list[i].dur <= f.t) acc += f.list[i++].dur;
    if (i !== f.i) show(f, i);
    animateSet(f.scenes[i], f.list[i], f.t - acc);
    f.el.querySelector(".teaser__bar i").style.width = `${(f.t / f.total) * 100}%`;
    raf = requestAnimationFrame(frame);
  };
  const play = (f) => {
    if (active === f) return;
    active = f;
    els.forEach((el) => el.classList.toggle("is-playing", el === f.el));
    if (f.i < 0) show(f, 0);
    cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const stop = () => { active = null; cancelAnimationFrame(raf); els.forEach((el) => el.classList.remove("is-playing")); };
  const ratios = new Map();
  const pick = () => {
    if (!$("#player").hidden || document.hidden || document.body.classList.contains("locked")) return stop();
    let best = null, top = .55;
    ratios.forEach((r, el) => { if (r > top) { top = r; best = el; } });
    best ? play(build(best)) : stop();
  };
  const io = new IntersectionObserver((entries) => { entries.forEach((e) => ratios.set(e.target, e.intersectionRatio)); pick(); },
    { threshold: [0, .3, .55, .7, .85, 1] });
  els.forEach((el) => io.observe(el));
  document.addEventListener("visibilitychange", pick);
  new MutationObserver(pick).observe($("#player"), { attributes: true, attributeFilter: ["hidden"] });
  new MutationObserver(pick).observe(document.body, { attributes: true, attributeFilter: ["class"] });  // intro, profile gate
}

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
    stage.innerHTML = list.map(sceneHTML).join("");
    sceneEls = [...stage.children];
    $(".player__title").innerHTML = `<b>${esc(film.name)}</b> <span>${film.ep}</span> ${esc(film.subtitle)}`;
    $("#player-next").setAttribute("aria-label", film.next ? "Next episode" : "Back to browse");
    player.setAttribute("aria-label", `${film.name}, ${film.subtitle}`);
  };

  let t = 0, playing = false, last = 0, current = -1, raf, idleTimer, speed = 1, sound = false, key = null;
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
    animateSet(sceneEls[i], list[i], t - starts[i]);
    const counter = sceneEls[i].querySelector(".scene__counter");
    if (counter) counter.textContent = Math.round(Math.min((t - starts[i]) / 2.2, 1) * counter.dataset.to);
    const pct = (t / total) * 100;
    $("#player-fill").style.width = `${pct}%`;
    $("#player-knob").style.left = `${pct}%`;
    $("#player-time").textContent = `-${fmt(total - t)}`;
  };
  const tick = (now) => {
    if (playing) {
      t = Math.min(t + (now - last) / 1000 * speed, total);
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
    sceneEls[current]?.querySelectorAll(".scene__bg, .montage figure, .scene__kicker, .scene__line, .scene__sub, .scene__viz, .wall__col")
      .forEach((el) => { el.style.animationPlayState = on ? "running" : "paused"; });
  };
  const seek = (x) => { t = Math.min(Math.max(x, 0), total - .01); current = -1; render(); setPlaying(true); };
  const wake = () => {
    player.classList.remove("is-idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => playing && player.classList.add("is-idle"), 2600);
  };
  const start = (k) => {
    key = k;
    cancelAnimationFrame(raf);
    load(k);
    if (sound) taDum();
    closePanels();
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

  $("#play").addEventListener("click", (e) => { opener = e.currentTarget; open(Object.keys(FILMS)[0]); });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-film]");
    if (b && FILMS[b.dataset.film]) { opener = b; open(b.dataset.film); }
  });
  $("#player-back").addEventListener("click", close);
  // Panels: next episode (hover), episodes, audio & subtitles, speed.
  const panels = ["#pp-next", "#pp-episodes", "#pp-lang", "#pp-speed"].map((q) => $(q));
  function closePanels() { panels.forEach((p) => { p.hidden = true; }); }
  const toggle = (q) => { const p = $(q), was = p.hidden; closePanels(); p.hidden = !was; wake(); };
  const epCard = (k, now) => { const f = FILMS[k]; return `<button class="pp-ep${now ? " is-now" : ""}" type="button" data-film-go="${k}">
      <span class="pp-ep__head"><b>${f.num}</b> ${esc(f.subtitle)}</span>
      <span class="pp-ep__body"><span class="pp-ep__art">${art(f.art, { label: "", mark: false })}<i>${now ? "▮▮▮ Now Playing" : "▶"}</i></span><span>${esc(f.blurb)}</span></span></button>`; };
  const fillNext = () => {
    const nx = film.next;
    $("#pp-next").innerHTML = nx ? `<h3>Next Episode</h3>${epCard(nx, false)}` : `<h3>That's the last episode</h3><p class="pp-note">Back to browse to see more.</p>`;
  };
  $("#player-next").addEventListener("mouseenter", () => { fillNext(); closePanels(); $("#pp-next").hidden = false; });
  $("#pp-next").addEventListener("mouseleave", () => { $("#pp-next").hidden = true; });
  $("#player-eps").addEventListener("click", () => {
    $("#pp-episodes").innerHTML = SEASONS.map((s) => `<h3>Season ${s.n}: ${esc(s.title)}</h3>${Object.keys(FILMS).filter((k) => FILMS[k].season === s.n).map((k) => epCard(k, k === key)).join("")}`).join("");
    toggle("#pp-episodes");
  });
  $("#player-lang").addEventListener("click", () => toggle("#pp-lang"));
  $("#player-speed").addEventListener("click", () => toggle("#pp-speed"));
  player.addEventListener("click", (e) => {
    const go = e.target.closest("[data-film-go]");
    if (go) { start(go.dataset.filmGo); return; }
    const sp = e.target.closest("[data-speed]");
    if (sp) {
      speed = +sp.dataset.speed;
      $("#pp-speed").querySelectorAll("[data-speed]").forEach((b) => b.classList.toggle("is-on", b === sp));
      if (speed === 3) toast("3x: now it sounds like Suhani telling you about her day.");
    }
    const au = e.target.closest("[data-audio]");
    if (au) {
      $("#pp-lang").querySelectorAll("[data-audio]").forEach((b) => b.classList.toggle("is-on", b === au));
      if (au.dataset.audio === "hi") toast("हिंदी ऑडियो: these films are silent, but I'm fluent.");
    }
    const sb = e.target.closest("[data-subs]");
    if (sb) {
      $("#pp-lang").querySelectorAll("[data-subs]").forEach((b) => b.classList.toggle("is-on", b === sb));
      player.classList.toggle("no-subs", sb.dataset.subs === "off");
      if (sb.dataset.subs === "hi") toast("हिंदी उपशीर्षक जल्द आ रहे हैं (Hindi subtitles coming soon).");
    }
  });
  $("#player-vol").addEventListener("click", (e) => {
    sound = !sound;
    e.currentTarget.setAttribute("aria-pressed", String(sound));
    e.currentTarget.setAttribute("aria-label", sound ? "Sound on" : "Sound off");
    player.classList.toggle("has-sound", sound);
    if (sound) taDum();
  });
  $("#player-full").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else player.requestFullscreen?.().catch(() => {});
  });
  $("#player-flag").addEventListener("click", () => toast("Reported. (To Suhani. She'll fix it at 3x speed.)"));
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
  stage.addEventListener("click", () => { if (panels.some((p) => !p.hidden)) { closePanels(); return; } setPlaying(!playing); });
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

// ---------- episodes ----------
function setupEpisodes() {
  const tabs = $("#season-tabs");
  tabs.innerHTML = SEASONS.map((s, i) =>
    `<button class="season-tab" role="tab" type="button" aria-selected="${i === 0}" data-i="${i}">Season ${s.n}: ${esc(s.title)}</button>`).join("");
  const render = (i) => {
    const s = SEASONS[i];
    tabs.querySelectorAll(".season-tab").forEach((b) => b.setAttribute("aria-selected", String(+b.dataset.i === i)));
    $("#season-sub").textContent = s.sub;
    $("#episode-list").innerHTML = Object.entries(FILMS).filter(([, f]) => f.season === s.n).map(([k, f]) => `
      <li><button class="episode" type="button" data-film="${k}" aria-label="Play ${f.ep}: ${esc(f.subtitle)}">
        <span class="episode__num">${f.num}</span>
        <span class="episode__thumb">${art(f.art, { label: f.tile || f.subtitle, mark: false })}<span class="episode__play">▶</span></span>
        <span class="episode__text">
          <span class="episode__top"><span class="episode__title">${esc(f.subtitle)}</span><span class="episode__stat">${filmLength(f)}</span></span>
          <span class="episode__copy">${esc(f.blurb)}</span>
        </span>
      </button></li>`).join("");
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

// Where I was and what grade I was in on a given day. Class of 2024; college starts that August.
const GRADES = ["", "1st grade", "2nd grade", "3rd grade", "4th grade", "5th grade", "6th grade", "7th grade", "8th grade",
  "freshman year", "sophomore year", "junior year", "senior year", "freshman year of college", "sophomore year of college",
  "junior year of college", "senior year of college"];
function lifeAt(iso) {
  const d = parse(iso), m = d.getMonth();
  const grade = 12 - (2024 - (m >= 7 ? d.getFullYear() + 1 : d.getFullYear()));
  const summer = m === 5 || m === 6;
  const stage = summer ? (grade === 12 ? "the summer before college" : `the summer before ${GRADES[grade + 1]}`) : GRADES[grade];
  const move = DATA.gaps.find((g) => g.from.startsWith("2020"));
  const place = move && iso <= move.from ? "Cupertino" : iso < DATA.dates.austin || summer ? "Dallas" : "Austin";
  return { stage, place };
}
const lifeLine = (iso) => { const l = lifeAt(iso); return `${l.stage}, ${l.place}`; };

let EPISODES;
const loadEpisodes = () => (EPISODES ||= fetch("data/episodes.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})));

function yearsMonths(days) {
  const y = Math.floor(days / 365.25), m = Math.round((days - y * 365.25) / 30.44);
  return y ? `${y} year${y === 1 ? "" : "s"}${m ? `, ${m} month${m === 1 ? "" : "s"}` : ""}` : `${m} month${m === 1 ? "" : "s"}`;
}

function openShow(name) {
  const s = DATA.shows[name];
  if (!s) return;
  const share = s.views / DATA.totals.views * 100;
  const rank = DATA.top.findIndex((x) => x.show === name);
  const y1 = parse(s.first).getFullYear(), y2 = parse(s.last).getFullYear();
  const seasons = Object.keys(s.seasons);
  const meta = `<p class="modal__meta"><span class="match">${share >= 1 ? share.toFixed(1) : share.toFixed(2)}% of my watching</span>
      <span>${y1 === y2 ? y1 : `${y1}–${y2}`}</span>
      <span class="pill">${s.kind === "movie" ? "Movie" : "Series"}</span>
      ${seasons.length ? `<span>${seasons.length} season${seasons.length === 1 ? "" : "s"}</span>` : ""}
      ${rank >= 0 ? `<span class="top-badge">TOP<b>10</b></span><span>#${rank + 1} in Suhani's Life</span>` : ""}</p>`;
  if (s.kind === "movie") {
    openModal(name, `${meta}<p class="modal__lead">Watched in ${fmtMonth(s.last.slice(0, 7))}, ${lifeLine(s.last)}.</p>`);
    return;
  }
  const first = lifeAt(s.first), last = lifeAt(s.last);
  const lead = s.first === s.last ? `All ${s.views} in one day, in ${fmtMonth(s.first.slice(0, 7))}: ${lifeLine(s.first)}.`
    : `I started it in ${first.stage} in ${first.place}. The last episode was in ${last.stage}${last.place === first.place ? "" : ` in ${last.place}`}.`;
  openModal(name, `${meta}
    <p class="modal__lead">${lead}</p>
    <div class="modal__facts" id="show-facts"></div>
    <div class="eplist__head"><h4>Episodes</h4><span class="eplist__note">in the order I watched them</span>
      ${seasons.length > 1 ? `<select class="eplist__season" id="show-season" aria-label="Season">${seasons.map((k) => `<option>${esc(k)}</option>`).join("")}</select>` : ""}</div>
    <ol class="eplist" id="show-eps"></ol>`);

  loadEpisodes().then((all) => {
    const entry = all[name];
    if (!entry || $("#modal").hidden) return;
    // Published by month only; same-day counts and the longest break come precomputed from the pipeline.
    const bySeason = entry.seasons, gap = entry.gap, mid = (m) => `${m}-15`;
    const flat = Object.values(bySeason).flat().map(([, m]) => m).sort();
    const places = [...new Set(flat.map((m) => lifeAt(mid(m)).place))];
    const facts = [
      s.best_day.episodes >= 3 && `<div><b>${s.best_day.episodes} episodes</b><span>in one day, ${fmtMonth(s.best_day.date.slice(0, 7))}, ${lifeAt(s.best_day.date).stage}.</span></div>`,
      gap && `<div><b>Gone ${yearsMonths(gap.days)}</b><span>then came back in ${fmtMonth(gap.back)} for ${gap.episodes} episode${gap.episodes === 1 ? "" : "s"}.</span></div>`,
      places.length > 1 && `<div><b>${places.join(" → ")}</b><span>it moved with me.</span></div>`,
    ].filter(Boolean);
    $("#show-facts").innerHTML = facts.join("");

    const stills = {};
    Object.values(STILLS[name] || {}).flat().forEach((x) => { stills[x.ep] = x.img; });
    const best = s.best_day.date.slice(0, 7);
    const render = (season) => {
      const list = bySeason[season] || Object.values(bySeason)[0];
      $("#show-eps").innerHTML = list.map(([ep, m, same, img], i) => `<li class="ep${m === best && same === s.best_day.episodes ? " ep--best" : ""}">
          <span class="ep__num">${i + 1}</span>
          <span class="ep__thumb">${img || stills[ep] ? `<img src="${esc(img || stills[ep])}" alt="" loading="lazy">` : art(name, { label: "", mark: false })}</span>
          <span class="ep__text"><span class="ep__top"><b>${esc(ep)}</b><span>${fmtMonth(m)}</span></span>
            <span class="ep__copy">${esc(lifeLine(mid(m)))}${same >= 3 ? ` · <em>${same} that day</em>` : ""}</span></span></li>`).join("");
    };
    const pick = $("#show-season");
    pick?.addEventListener("change", () => render(pick.value));
    render(pick ? pick.value : "");
  });
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
  $("#foot-since").textContent = `${fmtDate(t.from)}: ${n(t.views)} views and counting`;
  $("#foot-switch")?.addEventListener("click", (e) => { e.preventDefault(); $("#switch-profile").click(); });
  $("#about-to").textContent = fmtDate(t.to);
  $("#still-sub").textContent =
    `${n(t.views)} views, ${n(t.titles)} titles and ${n(t.active_days)} days with something on. The most recent: ${fmtDate(t.to)}. Yes, I'm still watching.`;
}

setupIntro(setupProfiles);
fetch("data/stills.json").then((r) => (r.ok ? r.json() : {})).then((x) => { STILLS = x; }).catch(() => {});
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
    setupPreview();
    setupPlayer();
    setupEpisodes();
    setupTeasers();
    setupGlobal();
  });
