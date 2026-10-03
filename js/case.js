// One Household: the PM case study. Public numbers are from Netflix's shareholder letters and the
// sources listed on the page; "a user of one" comes from data/site.json, built from my own history.

const $ = (sel, root = document) => root.querySelector(sel);
const SVGNS = "http://www.w3.org/2000/svg";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const n = (x) => x.toLocaleString("en-US");

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
const ROLLOUT = [
  { when: "Mar 2022", what: "Extra Member tests in Chile, Costa Rica and Peru, at about $2.99." },
  { when: "Apr 2022", what: "Netflix reports its first subscriber loss in a decade and sizes sharing: 100M+ households." },
  { when: "Jul 2022", what: "\"Add a Home\" tested in Argentina and four more markets. Later dropped after feedback." },
  { when: "Feb 2023", what: "Paid sharing in Canada, New Zealand, Portugal and Spain. Spain loses 1M+ users that quarter." },
  { when: "May 23, 2023", what: "U.S. and 100+ countries. Extra Member: $7.99 a month." },
  { when: "2024", what: "Record year: 301.6M members, $39B revenue. Netflix stops reporting subscribers from 2025." },
];

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
  const cols = Array.from({ length: 13 }, (_, c) => {
    const imgs = Array.from({ length: 8 }, (_, k) => `<img src="${posters[(c * 5 + k * 7) % posters.length]}" alt="" loading="lazy">`).join("");
    return `<div class="wall__col" style="--speed:${60 + (c % 4) * 12}s">${imgs}${imgs}</div>`;
  });
  return `<div class="wall"><div class="wall__grid">${cols.join("")}</div></div>`;
}

function meSection(site) {
  const monthly = site.monthly.filter((m) => m.month >= "2022-01");
  const label = (d) => { const [y, m] = d[0].split("-"); return m === "01" ? y : ""; };
  barChart($("#me-chart"), monthly.map((m) => [m.month, m.views]), {
    label, height: 280,
    highlight: (d) => ["06", "07"].includes(d[0].slice(5)) && d[0] >= "2024-06",
    fmt: (v) => `${v} views`,
    marks: [{ q: "2023-05", label: "Paid sharing hits the U.S." }, { q: "2024-08", label: "I move to Austin" }, { q: "2025-07", label: "Home for summer" }],
  });
  // School-year watching (Sep–Apr), high school vs college, per day.
  const perDay = (from, to) => {
    const ms = site.monthly.filter((m) => m.month >= from && m.month <= to && !["05", "06", "07", "08"].includes(m.month.slice(5)));
    return ms.reduce((a, m) => a + m.views, 0) / (ms.length * 30.4);
  };
  const hs = perDay("2021-09", "2023-04"), college = perDay("2024-09", "2026-04");
  const drop = Math.round((1 - college / hs) * 100);
  const c = site.profile.college;
  $("#me-drop").textContent = `${drop}% drop`;
  $("#me-stats").innerHTML = `
    <div class="impact__card"><b>${hs.toFixed(2)}</b><span>views a day in high school school years (home, same account)</span></div>
    <div class="impact__card impact__card--bad"><b>${college.toFixed(2)}</b><span>views a day in college school years, ${drop}% lower</span></div>
    <div class="impact__card"><b>${c.summer_2025}</b><span>views a day in summer 2025, back on the home Wi-Fi</span></div>
    <div class="impact__card impact__card--bad"><b>$0</b><span>spent on an Extra Member or my own plan. I just stopped watching.</span></div>`;
}

Promise.all([fetch("data/site.json").then((r) => r.json()), fetch("data/art.json").then((r) => r.json()).catch(() => ({}))])
  .then(([site, art]) => {
    $("#cs-wall").innerHTML = wall(art);
    $("#rollout").innerHTML = ROLLOUT.map((r) => `<li><span class="rollout__when">${r.when}</span><span class="rollout__what">${r.what}</span></li>`).join("");
    barChart($("#net-adds"), NET_ADDS, {
      marks: NET_MARKS, fmt: (v) => `${v > 0 ? "+" : ""}${v}M net adds`,
      highlight: (d, i) => i >= 9, label: (d) => d[0],
    });
    meSection(site);
  });
