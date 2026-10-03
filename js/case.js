// One Household: the strategy case. Public numbers come from Netflix's shareholder letters and the
// sources listed on the page. Everything about my family's viewing is computed from data/site.json.
// The sizing model's inputs are labeled assumptions, except the public $7.99 Extra Member price.

const $ = (sel, root = document) => root.querySelector(sel);
const SVGNS = "http://www.w3.org/2000/svg";
const n = (x) => x.toLocaleString("en-US");
const pct = (x, d = 0) => `${(x * 100).toFixed(d)}%`;
const signed = (x) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(Math.round(x * 100))}%`;
const money = (x) => {
  const a = Math.abs(x), s = x < 0 ? "−" : "";
  if (Math.round(a / 1e6) === 0) return "$0";
  return a >= 1e9 ? `${s}$${(a / 1e9).toFixed(2)}B` : `${s}$${Math.round(a / 1e6)}M`;
};

// Paid net additions per quarter, in millions (Netflix shareholder letters).
const NET_ADDS = [
  ["Q1 '21", 3.98], ["Q2 '21", 1.54], ["Q3 '21", 4.38], ["Q4 '21", 8.28],
  ["Q1 '22", -0.20], ["Q2 '22", -0.97], ["Q3 '22", 2.41], ["Q4 '22", 7.66],
  ["Q1 '23", 1.75], ["Q2 '23", 5.89], ["Q3 '23", 8.76], ["Q4 '23", 13.12],
  ["Q1 '24", 9.33], ["Q2 '24", 8.05], ["Q3 '24", 5.07], ["Q4 '24", 18.91],
];
const NET_MARKS = [
  { q: "Q1 '22", label: "Tests in Chile, Costa Rica, Peru" },
  { q: "Q4 '22", label: "Ad plan launches" },
  { q: "Q1 '23", label: "Canada, NZ, Portugal, Spain" },
  { q: "Q2 '23", label: "U.S. + 100 countries" },
];

// Sizing model. EXTRA_MEMBER is Netflix's public U.S. launch price; everything in ASSUMPTIONS is mine.
const EXTRA_MEMBER = 7.99, STUDENT_PRICE = 2.99, GRAD_SHARE = 0.25;
const ASSUMPTIONS = [
  { id: "seg", label: "Away students on a family plan", min: 1, max: 10, step: 0.5, value: 5, fmt: (v) => `${v}M` },
  { id: "em", label: "Would buy Extra Member at $7.99 today", min: 0, max: 30, step: 1, value: 8, fmt: (v) => `${v}%` },
  { id: "adopt", label: "Would adopt a $2.99 student status", min: 0, max: 80, step: 1, value: 35, fmt: (v) => `${v}%` },
  { id: "enroll", label: "Would enroll in a free pass", min: 40, max: 100, step: 5, value: 80, fmt: (v) => `${v}%` },
  { id: "uplift", label: "Lift in own-account sign-ups after graduation", min: 0, max: 20, step: 1, value: 5, fmt: (v) => `+${v} pts` },
  { id: "arpu", label: "Revenue per own account, per month", min: 7, max: 20, step: 1, value: 12, fmt: (v) => `$${v}` },
  { id: "tenure", label: "Extra years as a paying member", min: 1, max: 6, step: 1, value: 3, fmt: (v) => `${v} yrs` },
];

function model(a) {
  const seg = a.seg * 1e6, em = a.em / 100, adopt = Math.max(a.adopt / 100, em), enroll = a.enroll / 100, up = a.uplift / 100;
  const lifetime = a.arpu * 12 * a.tenure;                  // value of one extra own-account sign-up
  const future = (inProgram) => seg * GRAD_SHARE * inProgram * up * lifetime;
  const sq = seg * em * EXTRA_MEMBER * 12;                  // status quo: a few pay $7.99
  const free = { now: 0, later: future(enroll) };           // worst case: every Extra Member buyer switches to free
  const priced = { now: seg * adopt * STUDENT_PRICE * 12, later: future(adopt) }; // and to $2.99
  return {
    rows: [
      { name: "A. Hold the line", now: sq, later: 0 },
      { name: "B. Free student pass", ...free },
      { name: "C. $2.99 student status", ...priced, pick: true },
    ],
    sq,
    beFreeUplift: sq / (seg * GRAD_SHARE * enroll * lifetime),
    beAdopt: (em * EXTRA_MEMBER * 12) / (STUDENT_PRICE * 12 + GRAD_SHARE * up * lifetime),
  };
}

function tip(e, html) {
  const t = $("#tooltip");
  if (!html) { t.hidden = true; return; }
  t.innerHTML = html;
  t.hidden = false;
  const r = t.getBoundingClientRect();
  t.style.left = `${Math.min(e.clientX + 14, innerWidth - r.width - 8)}px`;
  t.style.top = `${e.clientY - r.height - 12}px`;
}

function barChart(el, data, { marks = [], highlight = () => false, fmt = (v) => v, label = (d) => d[0], every = 1, height = 300 } = {}) {
  const W = 1000, top = 70, bottom = 30, H = height;
  const vals = data.map((d) => d[1]);
  const max = Math.max(...vals), min = Math.min(0, ...vals);
  const slot = W / data.length;
  const y = (v) => top + (max - v) / (max - min) * (H - top - bottom);
  let out = `<line class="zero" x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}"/>`;
  data.forEach((d, i) => {
    const v = d[1], x = i * slot;
    const y0 = y(Math.max(v, 0)), h = Math.abs(y(v) - y(0));
    out += `<g class="col" data-i="${i}"><rect x="${x}" y="${top}" width="${slot}" height="${H - top - bottom}" fill="transparent"/>
      <rect class="bar${v < 0 ? " neg" : ""}${highlight(d, i) ? " hot" : ""}" x="${x + slot * .16}" y="${y0}" width="${slot * .68}" height="${Math.max(h, 1)}" rx="2"/></g>`;
    if (i % every === 0) out += `<text class="axis" x="${x + slot / 2}" y="${H - 8}" text-anchor="middle">${label(d)}</text>`;
  });
  const used = [];
  marks.forEach((m) => {
    const i = data.findIndex((d) => d[0] === m.q);
    if (i < 0) return;
    const x = i * slot + slot / 2;
    const w = m.label.length * 6.6 + 8;
    const end = x + w > W;
    const span = end ? [x - w, x] : [x, x + w];
    let lvl = 0;
    while ((used[lvl] || []).some(([a, b]) => span[0] < b && span[1] > a)) lvl++;
    (used[lvl] ||= []).push(span);
    const ty = 14 + lvl * 18;
    out += `<g class="mark"><line x1="${x}" x2="${x}" y1="${ty + 4}" y2="${y(Math.max(data[i][1], 0)) - 4}"/>
      <text x="${end ? x - 5 : x + 5}" y="${ty}" text-anchor="${end ? "end" : "start"}">${m.label}</text></g>`;
  });
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("role", "img");
  svg.innerHTML = out;
  svg.addEventListener("pointermove", (e) => {
    const c = e.target.closest(".col");
    tip(e, c && `<b>${data[c.dataset.i][0]}</b>${fmt(data[c.dataset.i][1])}`);
  });
  svg.addEventListener("pointerleave", (e) => tip(e, null));
  el.appendChild(svg);
}

function wall(art) {
  const posters = Object.values(art).map((a) => a.poster).filter(Boolean);
  if (!posters.length) return "";
  const cols = Array.from({ length: 13 }, (_, c) => {
    const imgs = Array.from({ length: 8 }, (_, k) => `<img src="${posters[(c * 5 + k * 7) % posters.length]}" alt="" loading="lazy">`).join("");
    return `<div class="wall__col" style="--speed:${60 + (c % 4) * 12}s">${imgs}${imgs}</div>`;
  });
  return `<div class="wall"><div class="wall__grid">${cols.join("")}</div></div>`;
}

// ---- Analysis: every number about us comes from site.json ----
function analyze(site) {
  const monthly = Object.fromEntries(site.monthly.map((m) => [m.month, m.views]));
  const avg = (from, to, months) => {
    const ks = Object.keys(monthly).filter((k) => k >= from && k <= to && months.includes(k.slice(5)));
    return ks.reduce((s, k) => s + monthly[k], 0) / ks.length;
  };
  const SCHOOL = ["09", "10", "11", "12", "01", "02", "03", "04"], SUMMER = ["06", "07"];
  const hsSchool = avg("2021-09", "2023-04", SCHOOL), colSchool = avg("2024-09", "2026-04", SCHOOL);
  const hsSummer = avg("2022-06", "2023-07", SUMMER), colSummer = avg("2025-06", "2026-07", SUMMER);

  const yr = Object.fromEntries(site.yearly.map((y) => [y.year, y.views]));
  const homeSwings = [2018, 2019, 2020, 2021, 2022, 2023].map((y) => yr[y] / yr[y - 1] - 1);

  const f = site.family, hb = f.habits, pr = f.profiles;
  const who = ["Me", "My sister", "Dad", "Mom"];
  const total = who.reduce((s, w) => s + pr[w].views, 0);
  const share = Object.fromEntries(who.map((w) => [w, pr[w].views / total]));
  const moveGap = site.gaps.find((g) => g.from.startsWith("2024-08") || g.from.startsWith("2024-09"));
  const spring24 = ["2024-02", "2024-03", "2024-04", "2024-05"].reduce((s, k) => s + (monthly[k] || 0), 0);
  const p = site.profile, c = p.college;

  return { monthly, hsSchool, colSchool, hsSummer, colSummer, yr, homeSwings, f, hb, pr, who, total, share, moveGap, spring24, p, c,
    dallas: site.eras.Dallas.per_month, austin: site.eras.Austin.per_month, streak: site.streak };
}

function keyNumbers(A) {
  const base = model(Object.fromEntries(ASSUMPTIONS.map((a) => [a.id, a.value])));
  return {
    householdViews: n(A.total),
    schoolDrop: pct(1 - A.colSchool / A.hsSchool),
    summerLift: pct(A.colSummer / A.hsSummer - 1),
    seasonX: `${(A.colSummer / A.colSchool).toFixed(1)}×`,
    seasonXhs: `${(A.hsSummer / A.hsSchool).toFixed(1)}×`,
    kidsShare: pct(A.share.Me + A.share["My sister"]),
    beFreeUplift: `${(base.beFreeUplift * 100).toFixed(1)} pts`,
    beAdopt: pct(base.beAdopt),
    dallasPM: A.dallas.toFixed(1),
    austinPM: A.austin.toFixed(1),
    schoolPM: A.colSchool.toFixed(1),
    hindiAway: `${A.p.hindi_away}%`,
    hindiHome: `${A.p.hindi_home}%`,
    kapilMom: A.f.kapil.Mom,
    kapilMe: A.f.kapil.Me,
    kapilSame: A.f.kapil_same_day,
    quitDad: `${A.f.quit_rate.Dad}%`,
    titlesDad: n(A.hb.Dad.titles),
    top5Sis: `${A.hb["My sister"].top5_pct}%`,
    spring24: `${A.spring24} view${A.spring24 === 1 ? "" : "s"}`,
  };
}

function fill(K) {
  document.querySelectorAll("[data-k]").forEach((el) => {
    const v = K[el.dataset.k];
    if (v == null || Number.isNaN(v)) { console.warn("missing number:", el.dataset.k); el.textContent = "n/a"; return; }
    el.textContent = v;
  });
}

function meChart(site) {
  const monthly = site.monthly.filter((m) => m.month >= "2022-01");
  const label = (d) => { const [y, m] = d[0].split("-"); return m === "01" ? y : ""; };
  barChart($("#me-chart"), monthly.map((m) => [m.month, m.views]), {
    label, height: 280,
    highlight: (d) => ["06", "07"].includes(d[0].slice(5)) && d[0] >= "2025-06",
    fmt: (v) => `${v} views`,
    marks: [{ q: "2023-05", label: "Paid sharing hits the U.S." }, { q: "2024-08", label: "I move to Austin" }, { q: "2025-07", label: "Home for summer" }],
  });
}

function hypotheses(A) {
  const lo = Math.min(...A.homeSwings), hi = Math.max(...A.homeSwings);
  const H = [
    { id: "H1", claim: "The crackdown itself cut my watching.", verdict: ["no", "Not supported"],
      test: "Full-year views at home, before and after the U.S. launch (2022 vs. 2023).",
      result: `${A.yr[2022]} → ${A.yr[2023]} views (${signed(A.yr[2023] / A.yr[2022] - 1)}). Smaller than my normal swings at home, which ran from ${signed(lo)} to ${signed(hi)} a year (2018–2023). Inside the household, the rule never touched me.` },
    { id: "H2", claim: "Leaving home suppressed my school-year watching.", verdict: ["part", "Supported, confounded"],
      test: "Average views per month, September to April: high school (2021–23) vs. college (2024–26).",
      result: `${A.hsSchool.toFixed(1)} → ${A.colSchool.toFixed(1)} a month (${signed(A.colSchool / A.hsSchool - 1)}). I averaged ${A.c.fall_2024} views a day in fall 2024 and ${A.c.fall_2025} in fall 2025.${A.moveGap ? ` Weeks after the move I went ${A.moveGap.days} days without watching, one of my five longest gaps in 11 years.` : ""}` },
    { id: "H3", claim: "Being home brings it back.", verdict: ["yes", "Supported"],
      test: "Average views per month in June and July, before and after leaving home.",
      result: `${A.hsSummer.toFixed(1)} → ${A.colSummer.toFixed(1)} a month (${signed(A.colSummer / A.hsSummer - 1)}). Summer 2025 ran at ${A.c.summer_2025} views a day, about ${Math.round(A.c.summer_2025 / A.c.fall_2024)}× fall 2024, with the longest streak of my life: ${A.streak.days} days in a row. Summer 2026 was quiet (${(A.monthly["2026-06"] || 0) + (A.monthly["2026-07"] || 0)} views), so this rests mostly on one summer.` },
    { id: "H4", claim: "Friction turns me into a payer.", verdict: ["no", "Not supported"],
      test: "Did I buy an Extra Member or open my own account after moving?",
      result: `No. $0 spent. My monthly average fell only ${pct(1 - A.austin / A.dallas)} (${A.dallas.toFixed(1)} in Dallas, ${A.austin.toFixed(1)} since Austin) because summers make up for the school year. I'm retained, unmonetized and less engaged.` },
    { id: "H5", claim: "Away, I still watch as part of the household.", verdict: ["yes", "Supported"],
      test: "What I watch when I'm away vs. home, in college.",
      result: `Hindi is ${A.p.hindi_away}% of my series away and ${A.p.hindi_home}% at home. The Great Indian Kapil Show, which Mom watches too: ${A.p.kapil_away} episodes away, ${A.p.kapil_home} at home. Away, I reach for the family's shows.` },
  ];
  $("#hyps").innerHTML = H.map((h) => `<article class="hyp">
      <div class="hyp__head"><span class="hyp__id">${h.id}</span><b>${h.claim}</b><em class="pill pill--${h.verdict[0]}">${h.verdict[1]}</em></div>
      <p><span>Test</span>${h.test}</p><p><span>Result</span>${h.result}</p></article>`).join("");
}

function seasonTable(A) {
  const row = (label, a, b, fmt = (v) => v.toFixed(1), chg = signed(b / a - 1)) =>
    `<tr><td>${label}</td><td>${fmt(a)}</td><td>${fmt(b)}</td><td class="${b < a ? "neg" : "pos"}">${chg}</td></tr>`;
  $("#season-table").innerHTML = `<thead><tr><th></th><th>High school, at home</th><th>College, away for school</th><th>Change</th></tr></thead><tbody>
    ${row("School year (Sep–Apr), views a month", A.hsSchool, A.colSchool)}
    ${row("Summer (Jun–Jul), views a month", A.hsSummer, A.colSummer)}
    ${row("Summer ÷ school year", A.hsSummer / A.hsSchool, A.colSummer / A.colSchool, (v) => `${v.toFixed(1)}×`, `${(A.colSummer / A.colSchool / (A.hsSummer / A.hsSchool)).toFixed(1)}× wider`)}
    ${row("Whole era, views a month (Dallas vs. Austin)", A.dallas, A.austin)}
  </tbody>`;
}

function segments(A) {
  const { who, hb, pr, f, share } = A;
  const name = { Me: "Me", "My sister": "Sister", Dad: "Dad", Mom: "Mom" };
  const type = { Me: "The binger", "My sister": "The superfan", Dad: "The sampler", Mom: "The steady one" };
  const colors = { Me: "var(--red)", "My sister": "#f5a3a8", Dad: "#8a8a8a", Mom: "#4d4d4d" };
  $("#sharebar").innerHTML = `<div class="sharebar__bar">${who.map((w) => `<i style="width:${share[w] * 100}%;background:${colors[w]}" title="${name[w]}: ${pct(share[w])}"></i>`).join("")}</div>
    <ul class="sharebar__legend">${who.map((w) => `<li><i style="background:${colors[w]}"></i>${name[w]}, ${type[w].toLowerCase()} <b>${pct(share[w])}</b> <span>${n(pr[w].views)} views</span></li>`).join("")}</ul>`;

  const max = (key, src = hb) => Math.max(...who.map((w) => src[w][key]));
  const cell = (w, v, key, src = hb) => `<td${src[w][key] === max(key, src) ? ' class="hot"' : ""}>${v}</td>`;
  const measured = [
    ["Share of household views", (w) => `<td${w === "Me" ? ' class="hot"' : ""}>${pct(share[w])}</td>`],
    ["Views a day, on days they watch", (w) => cell(w, hb[w].per_day, "per_day")],
    ["Days with 6+ episodes", (w) => cell(w, hb[w].binge_days, "binge_days")],
    ["Episodes per show", (w) => cell(w, hb[w].eps_per_show, "eps_per_show")],
    ["Different titles", (w) => cell(w, n(hb[w].titles), "titles")],
    ["Quit after episode 1", (w) => `<td${f.quit_rate[w] === Math.max(...who.map((x) => f.quit_rate[x])) ? ' class="hot"' : ""}>${f.quit_rate[w]}%</td>`],
    ["Top 5 shows' share", (w) => cell(w, `${hb[w].top5_pct}%`, "top5_pct")],
    ["Rewatches", (w) => cell(w, `${pr[w].rewatch_pct}%`, "rewatch_pct", pr)],
    ["Movies", (w) => cell(w, `${hb[w].movie_pct}%`, "movie_pct")],
    ["Hindi", (w) => cell(w, `${hb[w].hindi_pct}%`, "hindi_pct")],
  ];
  const r = (lvl, txt) => `<td><em class="pill pill--${{ Low: "no", Medium: "part", High: "yes" }[lvl] || "na"}">${lvl}</em><small>${txt}</small></td>`;
  const judged = {
    "What keeps them": { Me: "<td>Finishing long series</td>", "My sister": "<td>A few anchor shows</td>", Dad: "<td>Breadth and new titles</td>", Mom: "<td>Hindi films and shows</td>" },
    "Churn trigger": { Me: "<td>Losing access away: leaks hours, not membership</td>", "My sister": "<td>Anchor shows leave the catalog</td>", Dad: "<td>A thin release slate</td>", Mom: "<td>A shallow regional catalog</td>" },
    "Churn risk": { Me: r("Low", "the household keeps paying"), "My sister": r("Medium", "loyal to titles, not the service"), Dad: r("Low", "always something new to try"), Mom: r("Medium", "light use, one language") },
    "Extra Member / own account": { Me: r("Low", `paid $0 away; high as a future owner`), "My sister": r("Medium", "her history is hard to leave behind"), Dad: r("Low", "lives at home"), Mom: r("Low", "lives at home") },
    "Ad-tier fit": { Me: r("Low", "binges absorb the most ad breaks"), "My sister": r("Medium", "rewatches tolerate ads"), Dad: r("High", "short samples, a third movies"), Mom: r("High", "light, occasional viewing") },
    "Netflix's lever": { Me: "<td><b>Away at School</b> + graduation handoff</td>", "My sister": "<td>Keep anchor titles; keep her profile portable</td>", Dad: `<td>Better recommendations: cut the ${f.quit_rate.Dad}% pilot quit rate</td>`, Mom: "<td>Regional catalog depth</td>" },
  };
  $("#seg-table").innerHTML = `<thead><tr><th></th>${who.map((w) => `<th>${name[w]}<span>${type[w]}</span></th>`).join("")}</tr></thead><tbody>
    ${measured.map(([label, fn]) => `<tr><td>${label}</td>${who.map(fn).join("")}</tr>`).join("")}
    <tr class="cs-table__divider"><td colspan="5">My read for Netflix</td></tr>
    ${Object.entries(judged).map(([label, m]) => `<tr class="is-judged"><td>${label}</td>${who.map((w) => m[w]).join("")}</tr>`).join("")}
  </tbody>`;
}

function sizing() {
  const state = Object.fromEntries(ASSUMPTIONS.map((a) => [a.id, a.value]));
  $("#sizing-inputs").innerHTML = `<p class="sizing__fixed"><b>Public:</b> Extra Member $${EXTRA_MEMBER}/mo (U.S., 2023). <b>Proposed:</b> student status $${STUDENT_PRICE}/mo.</p>` +
    ASSUMPTIONS.map((a) => `<label class="sizing__in"><span>${a.label} <em>Assumption</em></span>
      <input type="range" min="${a.min}" max="${a.max}" step="${a.step}" value="${a.value}" data-id="${a.id}"><b data-out="${a.id}">${a.fmt(a.value)}</b></label>`).join("");
  const render = () => {
    const m = model(state);
    const best = Math.max(...m.rows.map((r) => r.now + r.later));
    $("#sizing-table").innerHTML = `<thead><tr><th>Option</th><th>Revenue a year</th><th>Future value</th><th>Total</th><th>vs. A</th></tr></thead><tbody>
      ${m.rows.map((r) => { const t = r.now + r.later; return `<tr class="${t === best ? "is-pick" : ""}"><td><b>${r.name}</b></td><td>${money(r.now)}</td><td>${money(r.later)}</td><td><b>${money(t)}</b></td><td class="${t - m.sq < 0 ? "neg" : "pos"}">${r.name.startsWith("A") ? "–" : (t > m.sq ? "+" : "") + money(t - m.sq)}</td></tr>`; }).join("")}
    </tbody>`;
    $("#sizing-be").innerHTML = `<div><b>${(m.beFreeUplift * 100).toFixed(1)} pts</b><span>lift in post-graduation sign-ups a free pass needs to match A</span></div>
      <div><b>${pct(m.beAdopt)}</b><span>adoption the $2.99 status needs to match A</span></div>`;
  };
  $("#sizing-inputs").addEventListener("input", (e) => {
    const id = e.target.dataset.id;
    if (!id) return;
    state[id] = Number(e.target.value);
    $(`[data-out="${id}"]`).textContent = ASSUMPTIONS.find((a) => a.id === id).fmt(state[id]);
    render();
  });
  render();
}

Promise.all([fetch("data/site.json").then((r) => r.json()), fetch("data/art.json").then((r) => r.json()).catch(() => ({}))])
  .then(([site, art]) => {
    $("#cs-wall").innerHTML = wall(art);
    barChart($("#net-adds"), NET_ADDS, {
      marks: NET_MARKS, fmt: (v) => `${v > 0 ? "+" : ""}${v}M net adds`,
      highlight: (d, i) => i >= 9, label: (d) => d[0],
    });
    const A = analyze(site);
    fill(keyNumbers(A));
    meChart(site);
    hypotheses(A);
    seasonTable(A);
    segments(A);
    sizing();
  })
  .catch((err) => console.error("case study failed to load", err));
