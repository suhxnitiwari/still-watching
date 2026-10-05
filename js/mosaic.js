// ---------- The S, made of us ----------
// The intro's S rebuilt as a photomosaic of every poster in the family's history (img/mosaic.jpg, packed by
// etl/build_mosaic.py). Posters fly in full color from the dark, land along the stroke in the order the S is
// drawn, and turn Netflix red as they settle. It lives inside the logo's own SVG, so it breathes and flies
// through the camera with it.
const SVGNS = "http://www.w3.org/2000/svg";

function posterS(intro) {
  const svg = intro?.querySelector(".intro__logo");
  const stroke = svg?.querySelector(".intro__ribbon:not(.intro__ribbon--shade)");
  if (!svg || !stroke) return { finish() {} };
  intro.classList.add("has-mosaic");
  let done = false, finishNow = () => { done = true; };
  Promise.all([
    fetch("data/mosaic.json").then((r) => r.json()),
    new Promise((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = fail; im.src = "img/mosaic.jpg"; }),
  ]).then(([m]) => { if (svg.isConnected) finishNow = build(svg, stroke, m, done); }).catch(() => {});
  return { finish() { finishNow(); } };
}

function build(svg, stroke, m, skip) {
  const d = stroke.getAttribute("d"), W = 140, H = 220, TW = 6, TH = 9, WIDTH = 30;
  const [cw, ch] = m.cell, sheetW = m.cols * cw, sheetH = Math.ceil(m.n / m.cols) * ch;
  // Which cells the stroke touches: rasterize the S at 4x and sample each cell.
  const k = 4, cv = document.createElement("canvas");
  cv.width = W * k; cv.height = H * k;
  const ctx = cv.getContext("2d");
  ctx.scale(k, k); ctx.lineWidth = WIDTH; ctx.lineCap = "butt"; ctx.stroke(new Path2D(d));
  const px = ctx.getImageData(0, 0, cv.width, cv.height).data;
  const inside = (x, y) => px[((Math.floor(y * k) * cv.width) + Math.floor(x * k)) * 4 + 3] > 0;
  // Where along the stroke each cell sits (0 at the top end, 1 at the tail), so tiles land as the S is drawn.
  const len = stroke.getTotalLength(), samples = Array.from({ length: 240 }, (_, i) => {
    const p = stroke.getPointAtLength(len * i / 239); return [p.x, p.y, i / 239];
  });
  const along = (x, y) => samples.reduce((b, s) => { const dd = (s[0] - x) ** 2 + (s[1] - y) ** 2; return dd < b[0] ? [dd, s[2]] : b; }, [1e9, 0])[1];
  // Shuffle the posters so neighbours differ, then deal them out.
  const deck = Array.from({ length: m.n }, (_, i) => i).sort(() => Math.random() - .5);
  const tiles = [];
  for (let y = -TH; y < H + TH; y += TH) for (let x = -TW; x < W + TW; x += TW) {
    const hit = [[.5, .5], [.15, .15], [.85, .15], [.15, .85], [.85, .85]].some(([a, b]) => {
      const sx = x + a * TW, sy = y + b * TH; return sx >= 0 && sy >= 0 && sx < W && sy < H && inside(sx, sy);
    });
    if (!hit) continue;
    const ang = Math.random() * Math.PI * 2, far = 160 + Math.random() * 260;
    tiles.push({ x, y, t: along(x + TW / 2, y + TH / 2), poster: deck[tiles.length % m.n],
      fx: x + Math.cos(ang) * far, fy: y + Math.sin(ang) * far * .7, spin: (Math.random() - .5) * 160, jitter: Math.random() * .25 });
  }
  const el = (tag, attrs, parent) => { const e = document.createElementNS(SVGNS, tag); Object.entries(attrs).forEach(([a, v]) => e.setAttribute(a, v)); parent?.appendChild(e); return e; };
  const defs = svg.querySelector("defs") || el("defs", {}, svg);
  el("image", { id: "mosaic-sheet", href: "img/mosaic.jpg", width: sheetW, height: sheetH, preserveAspectRatio: "none" }, defs);
  // Until every tile has landed, the mask lets flying tiles show anywhere; then it trims the S to a clean edge.
  const mask = el("mask", { id: "mosaic-mask", maskUnits: "userSpaceOnUse", x: -400, y: -400, width: W + 800, height: H + 800 }, defs);
  const open = el("rect", { x: -400, y: -400, width: W + 800, height: H + 800, fill: "#fff" }, mask);
  el("path", { d, fill: "none", stroke: "#fff", "stroke-width": WIDTH }, mask);
  const glint = el("linearGradient", { id: "mosaic-glint", x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
  [[0, 0], [.45, 0], [.5, .55], [.55, 0], [1, 0]].forEach(([o, a]) => el("stop", { offset: o, "stop-color": "#fff", "stop-opacity": a }, glint));

  const layer = el("g", { class: "mosaic", mask: "url(#mosaic-mask)" }, svg);
  tiles.forEach((q) => {
    q.g = el("g", {}, layer);
    const sx = (q.poster % m.cols) * cw, sy = Math.floor(q.poster / m.cols) * ch;
    const cell = el("svg", { x: 0, y: 0, width: TW, height: TH, viewBox: `${sx} ${sy} ${cw} ${ch}`, preserveAspectRatio: "none" }, q.g);
    el("use", { href: "#mosaic-sheet" }, cell);
    el("rect", { width: TW, height: TH, fill: "none", stroke: "#000", "stroke-opacity": .35, "stroke-width": .35 }, q.g);
  });
  // Netflix red over the landed posters: hue from the logo's gradient, detail from the posters underneath.
  const tint = el("path", { d, fill: "none", stroke: "url(#intro-s)", "stroke-width": WIDTH, style: "mix-blend-mode:color", opacity: .55 }, svg);
  const fold = el("path", { d, fill: "none", stroke: "url(#intro-s)", "stroke-width": WIDTH, style: "mix-blend-mode:multiply", opacity: .3 }, svg);
  const shine = el("rect", { x: -60, y: -40, width: 120, height: 300, fill: "url(#mosaic-glint)", mask: "url(#mosaic-mask)", style: "mix-blend-mode:screen", opacity: 0 }, svg);
  svg.classList.add("is-mosaic");

  const START = .25, SPREAD = 2.3, FLY = .7, end = START + SPREAD + FLY + .25;
  const ease = (x) => 1 - (1 - x) ** 3;
  const draw = (t) => {
    tiles.forEach((q) => {
      const f = Math.min(1, Math.max(0, (t - START - (q.t + q.jitter * .4) * SPREAD) / FLY)), e = ease(f);
      const x = q.fx + (q.x - q.fx) * e, y = q.fy + (q.y - q.fy) * e, s = 2.6 - 1.6 * e;
      q.g.setAttribute("transform", `translate(${x + TW / 2} ${y + TH / 2}) rotate(${q.spin * (1 - e)}) scale(${s}) translate(${-TW / 2} ${-TH / 2})`);
      q.g.setAttribute("opacity", Math.min(1, f * 3));
    });
    const landed = Math.min(1, Math.max(0, (t - START - SPREAD) / (FLY + .2)));
    open.setAttribute("fill-opacity", 1 - landed);
    tint.setAttribute("opacity", .55 * Math.min(1, t / (START + SPREAD)));
    fold.setAttribute("opacity", .3 * landed);
    const g = Math.min(1, Math.max(0, (t - end) / 1.1));
    shine.setAttribute("opacity", g > 0 && g < 1 ? 1 : 0);
    shine.setAttribute("x", -80 + g * 240);
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let t0 = performance.now(), raf = 0, last = end + 1.2;
  const frame = (now) => {
    const t = (now - t0) / 1000;
    draw(t);
    if (t < last && svg.isConnected) raf = requestAnimationFrame(frame);
  };
  if (reduced || skip) draw(last); else raf = requestAnimationFrame(frame);
  // Play pressed early: snap every poster into place so the S is whole when it flies through the camera.
  return () => { cancelAnimationFrame(raf); draw(last); };
}

// ---------- Faces, made of what each of us watched ----------
// Each profile picture is rebuilt as a photomosaic of that person's own posters (img/mosaic-<person>.jpg), picked
// by how often they watched each show. About five seconds a face: their titles stream in as raw data, posters fly
// in and settle into a coarse face, a finer mosaic sharpens it, then the portrait locks on.
const FACE_SHEETS = fetch("data/mosaic.json").then((r) => r.json()).then((m) => {
  const out = {};
  Object.entries(m.faces || {}).forEach(([who, f]) => {
    const im = new Image(); im.decoding = "async"; im.src = f.sheet;
    // Weighted by views, softened so one binge doesn't take over the whole face.
    const w = f.views.map((v) => v ** .6), sum = w.reduce((a, b) => a + b, 0);
    let acc = 0;
    out[who] = { ...f, im, cum: w.map((v) => (acc += v / sum)) };
  });
  return out;
}).catch(() => ({}));

function reconstruct(avatarEl, name, onDone, onCount) {
  const img = avatarEl.querySelector("img"), cv = avatarEl.querySelector(".avatar__recon"), status = avatarEl.querySelector(".avatar__status");
  if (!img || !cv) return () => {};
  const COARSE = 11, FINE = 22, plays = FACE_PLAYS[name] || 0;
  const INTAKE = 1100, FLY = 2200, SHARP = 1300, LOCK = 700, END = 5000;
  let face = null, grids = null, raf = 0;
  FACE_SHEETS.then((f) => { face = f[name] || null; });
  const rand = (k, s) => { const x = Math.sin(k * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
  const grid = (n) => {
    const off = document.createElement("canvas"); off.width = off.height = n;
    const g = off.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(img, 0, 0, n, n);
    const d = g.getImageData(0, 0, n, n).data;
    return Array.from({ length: n * n }, (_, k) => {
      const pick = face ? face.cum.findIndex((c) => c >= rand(k, n)) : -1;
      return { k, col: `rgb(${d[k * 4]},${d[k * 4 + 1]},${d[k * 4 + 2]})`, poster: Math.max(0, pick), at: rand(k, n + 7),
        row: Math.floor(k / n), dir: Math.floor(k / n) % 2 ? 1 : -1 };
    });
  };
  // One tile: a poster, recolored toward the face's pixel so the poster stays readable and the face appears.
  const tile = (ctx, q, x, y, c, a) => {
    ctx.globalAlpha = a;
    const sheet = face?.im;
    if (sheet?.complete && sheet.naturalWidth) {
      const [cw, ch] = face.cell, sx = (q.poster % face.cols) * cw, sy = Math.floor(q.poster / face.cols) * ch;
      ctx.globalCompositeOperation = "source-over"; ctx.drawImage(sheet, sx, sy, cw, ch, x, y, c, c);
      ctx.globalCompositeOperation = "color"; ctx.fillStyle = q.col; ctx.fillRect(x, y, c, c);
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = a * .42; ctx.fillRect(x, y, c, c);
    } else { ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = q.col; ctx.fillRect(x, y, c, c); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  };
  const ease = (x) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;
  const play = () => {
    if (!img.complete || !img.naturalWidth) { img.addEventListener("load", play, { once: true }); return; }
    FACE_SHEETS.then(() => {
      if (!grids) grids = { [COARSE]: grid(COARSE), [FINE]: grid(FINE) };
      cancelAnimationFrame(raf);
      const size = cv.clientWidth || 140, dpr = Math.min(devicePixelRatio || 1, 2), W = size * dpr;
      cv.width = cv.height = W;
      const ctx = cv.getContext("2d");
      avatarEl.classList.remove("is-revealed"); avatarEl.classList.add("is-reconstructing");
      const titles = (face?.titles || DATA_BITS[name] || ["DATA"]).map((s) => s.toUpperCase());
      const start = performance.now();
      const frame = (now) => {
        const t = now - start;
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "#050505"; ctx.fillRect(0, 0, W, W);
        // 1. Their history arriving: rows of their own titles and bits, streaming in opposite directions.
        const dataA = 1 - ease((t - INTAKE * .55) / (FLY * .55));
        if (dataA > 0) {
          const rows = COARSE, fs = W / rows;
          ctx.font = `700 ${fs * .62}px "Courier New", monospace`; ctx.textBaseline = "middle";
          for (let r = 0; r < rows; r++) {
            const dir = r % 2 ? 1 : -1, speed = (.05 + rand(r, 3) * .06) * dpr, line = Array.from({ length: 4 }, (_, j) =>
              `${titles[(r * 3 + j) % titles.length]} ${(r * 7919 + j * 104729).toString(2).slice(-8)}`).join("  ");
            const wLine = ctx.measureText(line).width, off = ((t * speed * dir) % wLine + wLine) % wLine;
            ctx.globalAlpha = dataA * (.45 + rand(r, 9) * .4);
            ctx.fillStyle = r % 3 === 0 ? "#fff" : "#e50914";
            ctx.fillText(line, -off, (r + .5) * fs); ctx.fillText(line, wLine - off, (r + .5) * fs);
          }
          ctx.globalAlpha = 1;
        }
        // 2. Posters fly in along their rows and settle into a coarse face.
        const c1 = W / COARSE, fine = ease((t - INTAKE - FLY + SHARP * .6) / SHARP);
        grids[COARSE].forEach((q) => {
          const f = ease((t - INTAKE * .6 - q.at * FLY) / 600);
          if (f <= 0) return;
          const tx = (q.k % COARSE) * c1, ty = q.row * c1, x = tx + (1 - f) * q.dir * W * .9, s = 1 + (1 - f) * .8;
          tile(ctx, q, x - (s - 1) * c1 / 2, ty - (s - 1) * c1 / 2, c1 * s - .6 * dpr, Math.min(1, f * 2) * (1 - fine));
        });
        // 3. A finer mosaic pops in over it, tile by tile, and the face sharpens.
        if (fine > 0) {
          const c2 = W / FINE;
          grids[FINE].forEach((q) => {
            const f = ease((fine - q.at * .7) / .3);
            if (f <= 0) return;
            const s = .3 + .7 * f, x = (q.k % FINE) * c2 + (1 - s) * c2 / 2, y = q.row * c2 + (1 - s) * c2 / 2;
            tile(ctx, q, x, y, c2 * s - .4 * dpr, f);
          });
        }
        // 4. Lock on: a scan line sweeps down, the portrait comes up behind it, one flash.
        const pl = ease((t - (END - LOCK)) / LOCK);
        if (pl > 0) {
          const sy = pl * W;
          ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, sy); ctx.clip(); ctx.drawImage(img, 0, 0, W, W); ctx.restore();
          ctx.fillStyle = "#ff2d3a"; ctx.shadowColor = "#e50914"; ctx.shadowBlur = 16 * dpr; ctx.fillRect(0, sy - 2 * dpr, W, 3 * dpr); ctx.shadowBlur = 0;
          if (pl > .85) { ctx.globalAlpha = (1 - pl) / .15 * .7; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, W); ctx.globalAlpha = 1; }
        }
        const got = Math.round(plays * Math.min(1, t / (END - LOCK)));
        if (status) status.textContent = t < INTAKE ? "RECEIVING DATA" : t < END - LOCK ? `${got.toLocaleString()} PLAYS · ${titles.length} SHOWS` : "MATCH FOUND";
        onCount && onCount(got);
        if (t < END) raf = requestAnimationFrame(frame);
        else { avatarEl.classList.remove("is-reconstructing"); avatarEl.classList.add("is-revealed"); onDone && onDone(); }
      };
      raf = requestAnimationFrame(frame);
    });
  };
  return play;
}
