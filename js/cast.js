// ---------- The Tiwaris, on TV ----------
// Illustrated characters drawn from our four profile portraits, and the sets they act in.
// A "set" scene is staged like a shot: things (people, the car, the TV) move on keyframes,
// people talk in subtitles, and a camera pans and cuts around the set. Everything is computed
// from the scene's clock, so pause, scrubbing and the muted previews all stay in sync.

const LOOKS = {
  // Long dark waves, side part, a dainty necklace, a dark top.
  suhani: { name: "Suhani", skin: "#e9b38f", shade: "#c98a66", hair: "#24150f", hairStyle: "long", top: "#3d1820", sleeve: .12, bottom: "#2e3a55", shoe: "#ece6dc", h: 1, lips: "#b04a4a", necklace: true },
  // Short black hair, black rectangular glasses, black tee.
  dad: { name: "Papa", skin: "#d39b70", shade: "#b47a52", hair: "#121010", hairStyle: "short", top: "#171717", sleeve: .5, bottom: "#5f5546", shoe: "#2a2420", h: 1.05, lips: "#8a4a3c", glasses: true },
  // Long black waves, red lipstick, pearl drop earrings, red and white floral top.
  mom: { name: "Mumma", skin: "#e5aa83", shade: "#c48862", hair: "#0f0b0a", hairStyle: "long", top: "url(#pat-floral)", sleeve: .55, bottom: "#1d1d26", shoe: "#3a1a1a", h: .96, lips: "#b3122a", lipFill: true, earrings: true },
  // Long brown hair, a big grin, a blue top with gold embroidery.
  amaira: { name: "Amaira", skin: "#e8b08a", shade: "#c98c66", hair: "#45271a", hairStyle: "long", top: "url(#pat-gold)", sleeve: .4, bottom: "#e7d9c0", shoe: "#d6b25a", h: .72, lips: "#b5525a", grin: true },
};
LOOKS.suhani.scoop = true;
// Younger me: nine and fresh off the plane, then thirteen and starting over in Texas.
LOOKS.suhani9 = { ...LOOKS.suhani, top: "#d99a3a", sleeve: .45, bottom: "#5b78ad", shoe: "#f2f2f2", h: .64, necklace: false, scoop: false };
LOOKS.suhani13 = { ...LOOKS.suhani, top: "#66789b", sleeve: 1, bottom: "#2b2b33", h: .9, necklace: false, scoop: false };
LOOKS.suhani11 = { ...LOOKS.suhani9, top: "#8a5bb0", h: .7 };
// Amaira at every age: a toddler, a kindergartner, and now.
LOOKS.amaira2 = { ...LOOKS.amaira, top: "#f2c6d4", h: .42, grin: true };
LOOKS.amaira3 = { ...LOOKS.amaira, top: "#f2c6d4", h: .46 };
LOOKS.amaira6 = { ...LOOKS.amaira, h: .58 };
// The playground kids.
LOOKS.kidA = { name: "Kid", skin: "#f2cba8", shade: "#d6a582", hair: "#c4974a", hairStyle: "short", top: "#b8432f", sleeve: .45, bottom: "#3d4f6e", shoe: "#ececec", h: .66, lips: "#a85a4a" };
LOOKS.kidB = { name: "Kid", skin: "#f4d2b4", shade: "#d9ad8a", hair: "#6e4127", hairStyle: "long", top: "#2b8584", sleeve: .45, bottom: "#e8d6bf", shoe: "#c94a6a", h: .64, lips: "#b5525a" };
LOOKS.kidC = { name: "Kid", skin: "#8d5c3e", shade: "#6e4430", hair: "#16100c", hairStyle: "short", top: "#3f7a3f", sleeve: .45, bottom: "#2f2f38", shoe: "#ececec", h: .68, lips: "#5a2a22" };

const ARM = { up: 64, fore: 70, sh: { l: [-50, -288], r: [50, -288] } };
// Where each pose puts the hands, in the character's own coordinates (feet at 0,0).
const POSES = {
  idle: { l: [-62, -166], r: [62, -166] },
  wave: { l: [-62, -166], r: [98, -412], wave: "r" },
  waveL: { l: [-98, -412], r: [62, -166], wave: "l" },
  carry: { l: [-50, -226], r: [50, -226], box: true },
  hugR: { l: [-62, -166], r: [128, -214] },   // arm around the waist of whoever stands to the right (draw them after)
  hugL: { l: [-92, -284], r: [62, -166] },    // hand on the shoulder of whoever stands to the left
  phone: { l: [-40, -170], r: [38, -334], phone: true },
  remote: { l: [-36, -176], r: [40, -214], remote: true },
  face: { l: [-20, -336], r: [20, -336] },
  lap: { l: [-30, -164], r: [30, -164] },
  cradle: { l: [-34, -214], r: [40, -236], baby: true },
  hips: { l: [-84, -178], r: [84, -178] },
};

const castDefs = () => `<defs>
  <pattern id="pat-floral" width="46" height="46" patternUnits="userSpaceOnUse">
    <rect width="46" height="46" fill="#c3122b"/>
    <path d="M8 10q8-9 14 0q-2 9-14 6z" fill="#f6efe6"/><path d="M28 30q9-6 13 3q-5 8-14 3z" fill="#f6efe6"/>
    <path d="M30 6q4 5 10 3" stroke="#1a1a1a" stroke-width="3" fill="none"/><path d="M6 34q5-5 10 0" stroke="#1a1a1a" stroke-width="3" fill="none"/>
    <circle cx="20" cy="38" r="3" fill="#f6efe6"/></pattern>
  <pattern id="pat-gold" width="34" height="34" patternUnits="userSpaceOnUse">
    <rect width="34" height="34" fill="#1f3f8f"/><path d="M17 6l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#d9b44a" opacity=".9"/></pattern>
  <linearGradient id="g-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141634"/><stop offset="1" stop-color="#2c2550"/></linearGradient>
</defs>`;

// One character. The JS rig (rigFrame) bends the arms, swings the legs, blinks and lip-syncs.
function personSVG(who, opt = {}) {
  const k = LOOKS[who];
  const arm = (side) => {
    const [sx, sy] = ARM.sh[side];
    return `<g class="arm arm--${side}"><g class="arm__up">
        <line x1="${sx}" y1="${sy}" x2="${sx}" y2="${sy + ARM.up}" stroke="${k.skin}" stroke-width="17" stroke-linecap="round"/>
        <line x1="${sx}" y1="${sy}" x2="${sx}" y2="${sy + ARM.up * k.sleeve + 4}" stroke="${k.top}" stroke-width="25" stroke-linecap="round"/>
        <g class="arm__fore">
          <line x1="${sx}" y1="${sy + ARM.up}" x2="${sx}" y2="${sy + ARM.up + ARM.fore}" stroke="${k.skin}" stroke-width="15" stroke-linecap="round"/>
          <circle cx="${sx}" cy="${sy + ARM.up + ARM.fore + 3}" r="10.5" fill="${k.skin}"/>
          ${side === "r" ? `<rect class="item item--phone" x="${sx - 8}" y="${sy + ARM.up + ARM.fore - 22}" width="16" height="30" rx="4" fill="#202024" stroke="#555" stroke-width="1.5"/>
          <rect class="item item--remote" x="${sx - 6}" y="${sy + ARM.up + ARM.fore - 4}" width="12" height="34" rx="4" fill="#1b1b1b"/>` : ""}
        </g></g></g>`;
  };
  const leg = (side) => {
    const x = side === "l" ? -20 : 20;
    return `<g class="leg leg--${side}"><line x1="${x}" y1="-152" x2="${x * 1.1}" y2="-14" stroke="${k.bottom}" stroke-width="28" stroke-linecap="round"/>
      <ellipse cx="${x * 1.25}" cy="-6" rx="19" ry="8" fill="${k.shoe}"/></g>`;
  };
  const long = k.hairStyle === "long";
  const hairBack = long
    ? `<path d="M-46 -366C-62 -424 62 -424 46 -366C64 -318 58 -248 72 -198C52 -186 32 -194 24 -208L-24 -208C-32 -194 -52 -186 -72 -198C-58 -248 -64 -318 -46 -366Z" fill="${k.hair}"/>`
    : "";
  const hairFront = long
    ? `<path d="M-44 -354C-48 -404 -8 -414 12 -408C42 -402 50 -376 44 -346C34 -372 18 -386 -4 -388C-22 -382 -36 -372 -44 -354Z" fill="${k.hair}"/>
       <path d="M-41 -362C-56 -320 -50 -266 -60 -226C-48 -220 -40 -230 -36 -246C-32 -282 -30 -322 -30 -350Z" fill="${k.hair}"/>
       <path d="M41 -362C56 -320 50 -266 60 -226C48 -220 40 -230 36 -246C32 -282 30 -322 30 -350Z" fill="${k.hair}"/>`
    : `<path d="M-42 -350C-48 -404 -6 -418 20 -410C46 -402 48 -374 42 -350C38 -372 28 -382 8 -380C-12 -386 -32 -376 -42 -350Z" fill="${k.hair}"/>
       <path d="M-38 -392Q-30 -412 -8 -410Q-24 -404 -38 -392Z" fill="${k.hair}"/>`;
  const smile = k.lipFill
    ? `<path d="M-11 -330Q0 -318 11 -330Q0 -325 -11 -330Z" fill="${k.lips}" stroke="${k.lips}" stroke-width="2.5" stroke-linejoin="round"/>`
    : k.grin
      ? `<path d="M-12 -331Q0 -316 12 -331Z" fill="#fff" stroke="${k.lips}" stroke-width="2.5" stroke-linejoin="round"/>`
      : `<path d="M-11 -330Q0 -321 11 -330" stroke="${k.lips}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  return `<g class="p p--${who}" data-who="${who}">
    <g class="p__hairback">${hairBack}</g>
    ${leg("l")}${leg("r")}
    <path class="p__lap" d="M-54 -152Q0 -128 54 -152L60 -112Q0 -92 -60 -112Z" fill="${k.bottom}"/>
    <path d="M-56 -282Q-58 -300 -32 -302L32 -302Q58 -300 56 -282L50 -150Q0 -140 -50 -150Z" fill="${k.top}"/>
    <rect x="-11" y="-322" width="22" height="26" fill="${k.skin}"/>
    ${k.scoop ? `<path d="M-30 -300Q0 -268 30 -300" fill="${k.skin}"/>` : `<path d="M-16 -301Q0 -290 16 -301" fill="${k.skin}"/>`}
    ${k.necklace ? `<path d="M-15 -301Q0 -284 15 -301" stroke="#e6c46a" stroke-width="1.6" fill="none"/><circle cx="0" cy="-287" r="2.6" fill="#e6c46a"/>` : ""}
    <g class="item item--box"><rect x="-50" y="-262" width="100" height="76" rx="4" fill="#c79a5c"/><path d="M-50 -246H50M0 -262V-246" stroke="#a87c42" stroke-width="5"/>
      <text x="0" y="-212" text-anchor="middle" font-family="Inter, sans-serif" font-size="13" font-weight="800" fill="#6e4b20">${who === "dad" ? "DORM" : "BOOKS"}</text></g>
    <g class="item item--baby"><ellipse cx="4" cy="-238" rx="46" ry="26" fill="#d9c9ef"/><circle cx="-26" cy="-246" r="17" fill="${k.skin}"/>
      <path d="M-32 -248Q-28 -244 -24 -248M-24 -240Q-26 -238 -28 -240" stroke="#5a3a2a" stroke-width="2" fill="none"/><path d="M-44 -258Q-26 -276 -8 -258" fill="#d9c9ef"/></g>
    ${arm("l")}${arm("r")}
    <g class="p__head">
      <circle cx="-38" cy="-354" r="9" fill="${k.skin}"/><circle cx="38" cy="-354" r="9" fill="${k.skin}"/>
      <ellipse cx="0" cy="-358" rx="38" ry="44" fill="${k.skin}"/>
      <circle cx="-22" cy="-341" r="7" fill="#e7837a" opacity=".3"/><circle cx="22" cy="-341" r="7" fill="#e7837a" opacity=".3"/>
      <g class="p__eyes"><ellipse cx="-14" cy="-360" rx="4.6" ry="6" fill="#1c110c"/><ellipse cx="14" cy="-360" rx="4.6" ry="6" fill="#1c110c"/>
        <circle cx="-12.5" cy="-362" r="1.5" fill="#fff"/><circle cx="15.5" cy="-362" r="1.5" fill="#fff"/></g>
      <g class="p__brows" stroke="${k.hair}" stroke-width="3.6" fill="none" stroke-linecap="round">
        <path class="brow brow--calm" d="M-23 -375Q-14 -380 -6 -376M23 -375Q14 -380 6 -376"/>
        <path class="brow brow--sad" d="M-23 -372Q-14 -375 -7 -381M23 -372Q14 -375 7 -381"/>
        <path class="brow brow--shock" d="M-23 -382Q-14 -388 -6 -383M23 -382Q14 -388 6 -383"/></g>
      <path d="M-2 -352Q3 -342 -3 -338" stroke="${k.shade}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <g class="p__mouth">
        <g class="mouth mouth--smile">${smile}</g>
        <path class="mouth mouth--sad" d="M-10 -323Q0 -331 10 -323" stroke="${k.lips}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path class="mouth mouth--flat" d="M-8 -326H8" stroke="${k.lips}" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse class="mouth mouth--shock" cx="0" cy="-326" rx="6.5" ry="9" fill="#4d1717"/>
        <ellipse class="mouth mouth--talk" cx="0" cy="-327" rx="8" ry="6" fill="#4d1717"/>
      </g>
      ${hairFront}
      ${k.glasses ? `<g fill="rgba(255,255,255,.08)" stroke="#0d0d0d" stroke-width="3.6"><rect x="-29" y="-370" width="24" height="17" rx="4"/><rect x="5" y="-370" width="24" height="17" rx="4"/><path d="M-5 -363H5M-29 -364L-38 -366M29 -364L38 -366" fill="none"/></g>` : ""}
      ${opt.hat ? `<g transform="rotate(-12 0 -400)"><path d="M-26 -396L4 -470L30 -396Z" fill="#d9b44a"/><path d="M-26 -396Q2 -386 30 -396" stroke="#b8902e" stroke-width="5" fill="none"/><circle cx="4" cy="-472" r="9" fill="#fff6dc"/></g>` : ""}
      ${k.earrings ? `<g fill="#f3efe6"><path d="M-39 -346V-330M39 -346V-330" stroke="#d8c48a" stroke-width="1.5"/><circle cx="-39" cy="-345" r="2.6"/><circle cx="39" cy="-345" r="2.6"/><circle cx="-39" cy="-334" r="2.8"/><circle cx="39" cy="-334" r="2.8"/><ellipse cx="-39" cy="-324" rx="3.6" ry="4.6"/><ellipse cx="39" cy="-324" rx="3.6" ry="4.6"/></g>` : ""}
    </g>
  </g>`;
}

// The family SUV, facing left, with whoever is riding in it showing through the windows.
function carSVG(riders = []) {
  const seats = [[-80, "mom"], [-140, "dad"], [40, "amaira"]];
  const inside = seats.filter(([, w]) => riders.includes(w)).map(([x, w]) => {
    const s = w === "amaira" ? .7 : .56, back = w === "dad", sc = s * LOOKS[w].h;
    return `<g class="thing" data-rider="${w}" transform="translate(${x} ${-170 + 358 * sc}) scale(${sc})" ${back ? 'opacity=".75"' : ""}>${personSVG(w)}</g>`;
  }).join("");
  return `<g class="car">
    <clipPath id="car-glass"><path d="M-158 -142L-114 -198H112V-142ZM118 -198H164L204 -142H118Z"/></clipPath>
    <path d="M-252 -52V-108Q-248 -130 -222 -136L-170 -142L-122 -206Q-112 -216 -92 -216H170Q198 -216 210 -196L252 -132L256 -52Q256 -34 240 -34H-236Q-252 -34 -252 -52Z" fill="#55657d"/>
    <path d="M-158 -142L-114 -198H112V-142ZM118 -198H164L204 -142H118Z" fill="#2b3a52"/>
    <g clip-path="url(#car-glass)">${inside}</g>
    <path d="M-158 -142L-114 -198H112V-142ZM118 -198H164L204 -142H118Z" fill="#9cc0dc" opacity=".22"/>
    <path d="M-30 -198V-142M112 -198V-142" stroke="#55657d" stroke-width="10"/>
    <path d="M-240 -96H250" stroke="#2f3848" stroke-width="3"/><rect x="-60" y="-118" width="26" height="6" rx="3" fill="#cfd6df"/><rect x="70" y="-118" width="26" height="6" rx="3" fill="#cfd6df"/>
    <path d="M-252 -100Q-246 -118 -230 -118V-96Z" fill="#fff6c8"/><rect x="246" y="-128" width="10" height="34" rx="3" fill="#d4202c"/>
    ${[-160, 166].map((x) => `<g transform="translate(${x} -40)"><circle r="42" fill="#141414"/><g class="wheel"><circle r="20" fill="#b9c0c8"/><path d="M0 -20V20M-20 0H20M-14 -14L14 14M-14 14L14 -14" stroke="#7d8590" stroke-width="3"/></g></g>`).join("")}
  </g>`;
}

const pseudoRandom = (i) => { const x = Math.sin(i * 91.7) * 4375.85; return x - Math.floor(x); };

const SETS = {
  // West Campus at dusk: high-rises, live oaks, the Tower lit burnt orange.
  westcampus: () => {
    const towers = [[0, 150, 260], [250, 250, 200], [560, 210, 180], [1360, 190, 250]].map(([x, top, w], b) => {
      const wins = [];
      for (let yy = top + 24; yy < 590; yy += 34) for (let xx = x + 18; xx < x + w - 20; xx += 30)
        wins.push(`<rect x="${xx}" y="${yy}" width="16" height="20" fill="${pseudoRandom(xx * 3 + yy + b) > .55 ? "#ffcf7d" : "#2c2440"}"/>`);
      return `<rect x="${x}" y="${top}" width="${w}" height="${600 - top}" fill="#241d36"/>${wins.join("")}`;
    }).join("");
    const oak = (x, y, sc) => `<g transform="translate(${x} ${y}) scale(${sc})"><path d="M-10 0V-120Q-30 -150 -60 -160M5 -110Q30 -150 60 -150" stroke="#2a1e18" stroke-width="16" fill="none"/>
      <g fill="#24402b"><circle cx="-70" cy="-180" r="62"/><circle cx="0" cy="-220" r="74"/><circle cx="72" cy="-176" r="60"/><circle cx="-20" cy="-160" r="58"/></g></g>`;
    return `<rect width="1600" height="900" fill="url(#wc-sky)"/>
      <defs><linearGradient id="wc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f1b3d"/><stop offset=".5" stop-color="#6b3a5a"/><stop offset=".72" stop-color="#d9784a"/><stop offset="1" stop-color="#f2a65e"/></linearGradient>
        <radialGradient id="wc-lamp"><stop offset="0" stop-color="#ffe2a0" stop-opacity=".75"/><stop offset="1" stop-color="#ffe2a0" stop-opacity="0"/></radialGradient></defs>
      <circle cx="1240" cy="330" r="60" fill="#f7c27a" opacity=".5"/>
      <g transform="translate(1090 0)"><rect x="-26" y="210" width="52" height="390" fill="#2c2238"/><rect x="-34" y="180" width="68" height="40" fill="#e8782a"/><path d="M-20 180L0 132L20 180Z" fill="#e8782a"/><rect x="-6" y="110" width="12" height="26" fill="#e8782a"/>
        <g fill="#f5a35a">${[230, 270, 310, 350, 390, 430, 470, 510, 550].map((y) => `<rect x="-14" y="${y}" width="8" height="16"/><rect x="6" y="${y}" width="8" height="16"/>`).join("")}</g></g>
      ${towers}
      <rect y="596" width="1600" height="96" fill="#a69e94"/><path d="M0 640H1600" stroke="#958c82" stroke-width="2"/>
      ${Array.from({ length: 16 }, (_, i) => `<path d="M${i * 110} 596L${i * 110 - 20} 692" stroke="#958c82" stroke-width="2"/>`).join("")}
      <rect y="690" width="1600" height="14" fill="#cfc8bd"/><rect y="704" width="1600" height="196" fill="#33323a"/>
      ${Array.from({ length: 9 }, (_, i) => `<rect x="${i * 190 + 30}" y="808" width="100" height="10" fill="#d9c35a"/>`).join("")}
      ${oak(120, 610, 1)}${oak(1500, 612, 1.1)}
      <g transform="translate(300 0)"><rect x="-6" y="300" width="12" height="300" fill="#1c1c22"/><path d="M0 300Q0 280 36 280" stroke="#1c1c22" stroke-width="10" fill="none"/>
        <rect x="26" y="276" width="34" height="14" rx="4" fill="#ffe8b0"/><circle cx="43" cy="310" r="110" fill="url(#wc-lamp)"/></g>
      <g transform="translate(1380 0)"><rect x="-4" y="390" width="8" height="210" fill="#4a4a50"/>
        <rect x="-70" y="400" width="140" height="30" rx="3" fill="#1d6b3a"/><text x="0" y="421" text-anchor="middle" font-family="Inter, sans-serif" font-weight="800" font-size="17" fill="#fff">W 24TH ST</text>
        <rect x="-62" y="436" width="124" height="28" rx="3" fill="#1d6b3a"/><text x="0" y="456" text-anchor="middle" font-family="Inter, sans-serif" font-weight="800" font-size="15" fill="#fff">RIO GRANDE</text></g>
      <g transform="translate(470 640)"><rect x="-60" y="-56" width="80" height="58" rx="3" fill="#c79a5c"/><rect x="-20" y="-104" width="70" height="50" rx="3" fill="#b88a4e"/>
        <rect x="40" y="-60" width="56" height="62" rx="3" fill="#c79a5c"/><text x="-20" y="-20" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" font-weight="800" fill="#6e4b20">CLOTHES</text>
        <rect x="-118" y="-92" width="48" height="94" rx="10" fill="#7a2233"/><rect x="-102" y="-112" width="16" height="22" rx="4" fill="none" stroke="#3b3b3b" stroke-width="4"/></g>`;
  },
  // Her West Campus dorm at night: string lights, an Austin pennant, the bed and the TV.
  dorm: () => {
    const lights = Array.from({ length: 20 }, (_, i) => `<circle class="dorm__light" style="--i:${i}" cx="${50 + i * 80}" cy="${72 + Math.sin(i / 1.6) * 16}" r="7" fill="#ffd27a"/>`).join("");
    return `<defs><linearGradient id="dm-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2340"/><stop offset="1" stop-color="#17132a"/></linearGradient>
        <linearGradient id="dm-blanket" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a4fb0"/><stop offset="1" stop-color="#43246e"/></linearGradient>
        <radialGradient id="dm-glow" cx=".8" cy=".38" r=".55"><stop offset="0" stop-color="#e50914" stop-opacity=".35"/><stop offset="1" stop-color="#e50914" stop-opacity="0"/></radialGradient></defs>
      <rect width="1600" height="900" fill="url(#dm-wall)"/>
      <rect class="dm-glow" width="1600" height="900" fill="url(#dm-glow)"/>
      <path d="M0 60Q400 104 800 66T1600 76" fill="none" stroke="#3a3350" stroke-width="3"/>${lights}
      <rect x="110" y="170" width="240" height="190" rx="8" fill="url(#g-night)" stroke="#3d3654" stroke-width="12"/><path d="M230 170V360M110 265H350" stroke="#3d3654" stroke-width="6"/>
      <circle cx="300" cy="215" r="20" fill="#f4e9c8" opacity=".9"/>
      <g transform="translate(470 160)"><path d="M0 0L200 44L0 88Z" fill="#bf5700"/><text x="24" y="52" font-size="27" font-weight="800" fill="#fff" font-family="Inter, sans-serif">AUSTIN</text></g>
      <g transform="translate(720 190)" fill="#f2ede4"><rect width="84" height="104" rx="3"/><rect x="100" y="20" width="70" height="86" rx="3"/></g>
      <g transform="translate(726 196)"><rect width="72" height="74" fill="#c86a52"/><rect x="100" y="20" width="58" height="56" fill="#3c5a8a"/></g>
      <rect y="640" width="1600" height="260" fill="#3a2f2a"/><path d="M0 640H1600" stroke="#4a3e37" stroke-width="4"/>
      <rect x="170" y="430" width="40" height="290" rx="8" fill="#55453c"/>
      <rect x="190" y="600" width="820" height="120" rx="14" fill="#efeaf6"/>
      <rect x="220" y="560" width="210" height="80" rx="34" fill="#f8f5fb"/><rect x="250" y="540" width="160" height="60" rx="28" fill="#d9c9ef"/>
      <path d="M430 610Q720 580 1010 606V720H430Z" fill="url(#dm-blanket)"/>
      <rect x="180" y="716" width="840" height="40" rx="10" fill="#2c2342"/>
      <rect x="1100" y="500" width="390" height="250" rx="8" fill="#4a3b33"/><path d="M1100 584H1490M1100 668H1490" stroke="#3a2e28" stroke-width="4"/>
      <circle cx="1295" cy="545" r="6" fill="#c9a86a"/><circle cx="1295" cy="628" r="6" fill="#c9a86a"/><circle cx="1295" cy="710" r="6" fill="#c9a86a"/>`;
  },
  // A playground: Cupertino hills in 2015, a Dallas water tower in 2020.
  playground: (p) => `<defs><linearGradient id="pg-sky${p.tx ? "-tx" : ""}" x1="0" y1="0" x2="0" y2="1">${p.tx
        ? '<stop offset="0" stop-color="#6fb3e0"/><stop offset="1" stop-color="#f3e3b0"/>'
        : '<stop offset="0" stop-color="#7ec3ef"/><stop offset="1" stop-color="#d9f0f7"/>'}</linearGradient></defs>
    <rect width="1600" height="900" fill="url(#pg-sky${p.tx ? "-tx" : ""})"/>
    ${p.tx
      ? `<g transform="translate(1260 0)"><path d="M-8 520L-30 300M8 520L30 300M-20 420H20" stroke="#8b96a3" stroke-width="10"/><ellipse cx="0" cy="250" rx="90" ry="70" fill="#c9d3dc"/><text x="0" y="262" text-anchor="middle" font-family="Inter, sans-serif" font-weight="900" font-size="30" fill="#2d4f7a">DALLAS</text></g>
         <circle cx="300" cy="150" r="70" fill="#ffe08a" opacity=".85"/><path d="M0 560Q400 520 800 550T1600 540V600H0Z" fill="#b9a76a"/>`
      : `<circle cx="1320" cy="140" r="56" fill="#fff3b0"/><path d="M0 520Q260 380 560 470T1100 430T1600 480V600H0Z" fill="#8fb880"/><path d="M0 560Q360 470 760 530T1600 520V600H0Z" fill="#76a56a"/>`}
    <rect y="580" width="1600" height="320" fill="${p.tx ? "#c8a76a" : "#7fb069"}"/><ellipse cx="800" cy="760" rx="760" ry="120" fill="${p.tx ? "#b8935a" : "#c79d6a"}" opacity=".7"/>
    <g transform="translate(260 0)" stroke-linecap="round"><path d="M0 600L120 330L240 600" stroke="#c0392b" stroke-width="14" fill="none"/><path d="M60 330H180" stroke="#c0392b" stroke-width="14"/>
      <path d="M90 340V500M150 340V500" stroke="#555" stroke-width="3"/><rect x="74" y="498" width="34" height="10" rx="3" fill="#333"/><rect x="134" y="498" width="34" height="10" rx="3" fill="#333"/></g>
    <g transform="translate(1250 0)"><rect x="0" y="380" width="120" height="16" fill="#e2b13c"/><path d="M10 396V600M110 396V600" stroke="#e2b13c" stroke-width="14"/>
      <path d="M120 390L300 600" stroke="#2f7fc0" stroke-width="40" stroke-linecap="round"/><path d="M-30 390V600M-10 390V600" stroke="#888" stroke-width="5"/>
      ${Array.from({ length: 6 }, (_, i) => `<path d="M-30 ${410 + i * 32}H-10" stroke="#888" stroke-width="5"/>`).join("")}</g>`,
  browse: () => `<rect width="1600" height="900" fill="#141414"/>`,
  chart: () => `<rect width="1600" height="900" fill="#101010"/><rect width="1600" height="900" fill="url(#ch-glow)"/>
    <defs><radialGradient id="ch-glow" cx=".3" cy=".2" r=".9"><stop offset="0" stop-color="#e50914" stop-opacity=".12"/><stop offset="1" stop-color="#e50914" stop-opacity="0"/></radialGradient></defs>`,
  // Home in Dallas: lamp light, family photos, Papa on the couch.
  living: () => `<defs><radialGradient id="lv-lamp" cx=".2" cy=".35" r=".6"><stop offset="0" stop-color="#ffcf87" stop-opacity=".45"/><stop offset="1" stop-color="#ffcf87" stop-opacity="0"/></radialGradient>
      <radialGradient id="lv-tv" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#5aa7ff" stop-opacity=".28"/><stop offset="1" stop-color="#5aa7ff" stop-opacity="0"/></radialGradient></defs>
    <rect width="1600" height="900" fill="#3a2a25"/><rect width="1600" height="900" fill="url(#lv-lamp)"/>
    <rect class="lv-tv" width="1600" height="900" fill="url(#lv-tv)"/>
    <g fill="#d8c3a0">${[[560, 200, 120, 90], [700, 180, 90, 120], [810, 210, 130, 90], [960, 190, 90, 110]].map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>`).join("")}</g>
    <g>${[[568, 208, 104, 74, "#b55a4a"], [708, 188, 74, 104, "#4a6a9a"], [818, 218, 114, 74, "#7a4a8a"], [968, 198, 74, 94, "#c08a3a"]].map(([x, y, w, h, c]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`).join("")}</g>
    <g transform="translate(250 0)"><rect x="-8" y="320" width="16" height="320" fill="#2a1f1a"/><path d="M-60 330L-40 230H40L60 330Z" fill="#f0d9a8"/></g>
    <rect y="700" width="1600" height="200" fill="#5a4334"/><rect x="420" y="740" width="760" height="120" rx="10" fill="#7a3b2e" opacity=".6"/>
    <rect x="380" y="440" width="840" height="200" rx="40" fill="#5b6b5a"/>
    <rect x="340" y="520" width="100" height="200" rx="30" fill="#4e5d4d"/><rect x="1160" y="520" width="100" height="200" rx="30" fill="#4e5d4d"/>
    <rect x="420" y="600" width="760" height="70" rx="20" fill="#667766"/>
    <rect x="380" y="660" width="840" height="60" rx="14" fill="#4e5d4d"/>
    <rect x="600" y="520" width="90" height="80" rx="18" fill="#c08a3a" transform="rotate(-8 645 560)"/>`,
};

// The dorm TV, with three screens: off, Netflix home with her comfort show, and the household wall.
function tvSVG() {
  const show = "Gossip Girl";
  const img = typeof backdropOf === "function" ? backdropOf(show) : "";
  const posters = ["Gilmore Girls", "Friends", "Jane The Virgin", "The Vampire Diaries"].map((s, i) => {
    const p = typeof posterOf === "function" ? posterOf(s) : "";
    return p ? `<image href="${p}" x="${24 + i * 92}" y="252" width="84" height="56" preserveAspectRatio="xMidYMid slice"/>` : `<rect x="${24 + i * 92}" y="252" width="84" height="56" fill="#333"/>`;
  }).join("");
  return `<g class="tv"><rect x="-10" y="-10" width="420" height="250" rx="12" fill="#0b0b0b"/>
    <g class="tv__screen tv__screen--off"><rect width="400" height="230" fill="#111318"/><rect width="400" height="230" fill="#fff" opacity=".03"/></g>
    <g class="tv__screen tv__screen--home"><rect width="400" height="230" fill="#141414"/>
      ${img ? `<image href="${img}" width="400" height="170" preserveAspectRatio="xMidYMid slice"/>` : ""}
      <rect width="400" height="230" fill="url(#tv-fade)"/>
      <defs><linearGradient id="tv-fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".3" stop-color="#141414" stop-opacity="0"/><stop offset=".78" stop-color="#141414"/></linearGradient></defs>
      <text x="16" y="28" font-family="Bebas Neue, sans-serif" font-size="26" fill="#e50914">S</text>
      <text x="22" y="150" font-family="Bebas Neue, sans-serif" font-size="34" fill="#fff">${show.toUpperCase()}</text>
      <rect class="tv__resume" x="22" y="162" width="96" height="26" rx="4" fill="#fff"/><text x="70" y="180" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" font-weight="800" fill="#111">▶ Resume</text>
      <text x="132" y="180" font-family="Inter, sans-serif" font-size="11" fill="#bbb">S2:E1 · comfort rewatch</text>
      <g transform="translate(0 -52)">${posters}</g></g>
    <g class="tv__screen tv__screen--blocked"><rect width="400" height="230" fill="#141414"/>
      <g font-family="Inter, sans-serif" text-anchor="middle"><text x="200" y="72" font-size="19" font-weight="800" fill="#fff">Your TV isn't part of the</text>
        <text x="200" y="98" font-size="19" font-weight="800" fill="#fff">Netflix Household for this account</text>
        <text x="200" y="124" font-size="11" fill="#bbb">Create an account to keep watching.</text>
        <rect x="140" y="140" width="120" height="28" rx="4" fill="#fff"/><text x="200" y="159" font-size="11" font-weight="800" fill="#111">Create an Account</text>
        <rect x="80" y="180" width="118" height="26" rx="4" fill="#555"/><text x="139" y="197" font-size="10" font-weight="700" fill="#fff">Update Household</text>
        <rect x="208" y="180" width="110" height="26" rx="4" fill="#555"/><text x="263" y="197" font-size="10" font-weight="700" fill="#fff">I'm Traveling</text></g></g>
    <rect x="180" y="240" width="40" height="30" fill="#1a1a1a"/></g>`;
}

// Netflix's browse screen, full frame: a hero for whatever is highlighted and one row that scrolls.
const TILE = 300;
function browseSVG(th) {
  const tiles = th.shows.map((show, i) => {
    const img = backdropOf(show);
    return `<g transform="translate(${i * TILE} 0)"><rect width="${TILE - 16}" height="160" rx="6" fill="#2a2a2a"/>
      <image href="${img}" width="${TILE - 16}" height="160" preserveAspectRatio="xMidYMid slice" clip-path="inset(0 round 6px)"/>
      <text x="12" y="146" font-family="Bebas Neue, sans-serif" font-size="26" fill="#fff" style="paint-order:stroke" stroke="rgba(0,0,0,.6)" stroke-width="4">${esc(show.toUpperCase())}</text></g>`;
  }).join("");
  return `<g class="browse">
    <image class="browse__hero" href="${backdropOf(th.shows[0])}" width="1600" height="560" preserveAspectRatio="xMidYMid slice"/>
    <rect width="1600" height="900" fill="url(#br-fade)"/><rect width="900" height="560" fill="url(#br-side)"/>
    <defs><linearGradient id="br-fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".35" stop-color="#141414" stop-opacity="0"/><stop offset=".64" stop-color="#141414"/></linearGradient>
      <linearGradient id="br-side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#141414" stop-opacity=".85"/><stop offset="1" stop-color="#141414" stop-opacity="0"/></linearGradient></defs>
    <text x="60" y="80" font-family="Bebas Neue, sans-serif" font-size="56" fill="#e50914">S</text>
    <g font-family="Inter, sans-serif" font-size="20" fill="#ddd"><text x="130" y="72">Home</text><text x="215" y="72">TV Shows</text><text x="335" y="72">Kids</text></g>
    <text class="browse__title" x="60" y="400" font-family="Bebas Neue, sans-serif" font-size="96" fill="#fff">${esc(th.shows[0].toUpperCase())}</text>
    <rect x="60" y="430" width="150" height="50" rx="6" fill="#fff"/><text x="135" y="463" text-anchor="middle" font-family="Inter, sans-serif" font-weight="800" font-size="20" fill="#111">▶ Play</text>
    <text x="60" y="586" font-family="Inter, sans-serif" font-weight="800" font-size="24" fill="#e5e5e5">${esc(th.row || "Popular on Netflix")}</text>
    <g class="browse__row" transform="translate(120 610)">${tiles}</g>
    <rect class="browse__focus" x="112" y="602" width="${TILE}" height="176" rx="10" fill="none" stroke="#fff" stroke-width="6"/></g>`;
}
function browseFrame(g, th, st) {
  const x = st.x ?? 0;
  g.querySelector(".browse__row").setAttribute("transform", `translate(${120 - x} 610)`);
  const i = Math.min(Math.max(Math.round(x / TILE), 0), th.shows.length - 1);
  if (g.dataset.i !== String(i)) {
    g.dataset.i = i;
    g.querySelector(".browse__hero").setAttribute("href", backdropOf(th.shows[i]));
    g.querySelector(".browse__title").textContent = th.shows[i].toUpperCase();
  }
}

// A chart that draws itself as the scene plays: bars rise left to right, markers drop in as the bars pass them.
function barsSVG(th) {
  const { data, marks = [], meter } = th, W = th.w || 1300, H = 420, x0 = 150, y0 = 700;
  const max = Math.max(...data.map((d) => d.v)), bw = W / data.length;
  const bars = data.map((d, i) => `<g class="bar" data-i="${i}"><rect x="${x0 + i * bw + 6}" y="${y0}" width="${bw - 12}" height="0" rx="4" fill="${d.hi ? "#e50914" : "#5a5a5a"}" data-h="${(d.v / max) * H}"/>
      <text x="${x0 + i * bw + bw / 2}" y="${y0 + 34}" text-anchor="middle" font-family="Inter, sans-serif" font-size="17" fill="#aaa">${esc(d.label)}</text>
      <text class="bar__v" x="${x0 + i * bw + bw / 2}" y="${y0 - (d.v / max) * H - 12}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="800" font-size="19" fill="#fff" opacity="0">${d.v}</text></g>`).join("");
  const mk = marks.map((m) => `<g class="mark" data-i="${m.i}" opacity="0"><path d="M${x0 + m.i * bw + bw / 2} ${y0 - H - 40}V${y0}" stroke="#fff" stroke-width="2" stroke-dasharray="6 6" opacity=".6"/>
      <text x="${x0 + m.i * bw + bw / 2 + 10}" y="${y0 - H - 40 + (m.row || 0) * 52}" font-family="Inter, sans-serif" font-weight="800" font-size="22" fill="#fff">${esc(m.text)}</text>
      <text x="${x0 + m.i * bw + bw / 2 + 10}" y="${y0 - H - 14 + (m.row || 0) * 52}" font-family="Inter, sans-serif" font-size="18" fill="#bbb">${esc(m.sub || "")}</text></g>`).join("");
  const mt = meter ? `<g class="meter" transform="translate(${x0} 800)"><text y="0" font-family="Inter, sans-serif" font-weight="800" font-size="20" fill="#fff">${esc(meter.label)}</text>
      <rect y="16" width="${W}" height="18" rx="9" fill="#2a2a2a"/><rect class="meter__fill" y="16" width="0" height="18" rx="9" fill="#e50914"/>
      <text class="meter__v" x="${W}" y="0" text-anchor="end" font-family="Inter, sans-serif" font-weight="800" font-size="20" fill="#e50914"></text></g>` : "";
  return `<g class="bars"><text x="${x0}" y="160" font-family="Inter, sans-serif" font-weight="800" font-size="26" fill="#e50914" letter-spacing="4">${esc(th.title || "")}</text>${bars}${mk}${mt}</g>`;
}
function barsFrame(g, th, st) {
  const p = st.p ?? 0, n = th.data.length;
  g.querySelectorAll(".bar").forEach((b) => {
    const i = +b.dataset.i, f = smooth(Math.min(Math.max(p * n - i, 0), 1));
    const r = b.querySelector("rect"), h = +r.dataset.h * f;
    r.setAttribute("height", h); r.setAttribute("y", 700 - h);
    b.querySelector(".bar__v").setAttribute("opacity", f > .95 ? 1 : 0);
  });
  g.querySelectorAll(".mark").forEach((m) => m.setAttribute("opacity", p * n > +m.dataset.i + .5 ? 1 : 0));
  if (th.meter) {
    const pos = p * n, k = th.meter.keys, j = k.findLastIndex(([i]) => i <= pos);
    let v = j < 0 ? 0 : k[j][1];
    if (j >= 0 && k[j + 1]) v += (k[j + 1][1] - v) * Math.min((pos - k[j][0]) / (k[j + 1][0] - k[j][0]), 1);
    g.querySelector(".meter__fill").setAttribute("width", (th.w || 1300) * v / 100);
    const label = j >= 0 && k[j + 1] === undefined && th.meter.end ? th.meter.end : `${Math.round(v)}%`;
    g.querySelector(".meter__v").textContent = label;
  }
}

// Props.
function cakeSVG(candles = 3) {
  return `<g class="cake"><ellipse cx="0" cy="0" rx="110" ry="16" fill="#e9e4dc"/><rect x="-80" y="-80" width="160" height="78" rx="10" fill="#f3d9c4"/>
    <path d="M-80 -60Q-60 -40 -40 -60T0 -60T40 -60T80 -60V-80H-80Z" fill="#fff6ee"/>
    ${Array.from({ length: candles }, (_, i) => { const x = (i - (candles - 1) / 2) * 34; return `<rect x="${x - 4}" y="-118" width="8" height="38" rx="3" fill="#c3122b"/><path class="flame" d="M${x} -136Q${x + 8} -124 ${x} -118Q${x - 8} -124 ${x} -136Z" fill="#ffc94a"/>`; }).join("")}</g>`;
}

// A pane is one camera on one set. Split-screen phone calls use two.
function thingSVG(th) {
  const inner = th.who ? personSVG(th.who, th) : th.kind === "cake" ? cakeSVG(th.candles) : th.kind === "car" ? carSVG(th.riders) : th.kind === "tv" ? tvSVG() : th.kind === "browse" ? browseSVG(th) : th.kind === "bars" ? barsSVG(th) : "";
  return `<g class="thing" data-id="${th.id || th.who || th.kind}">${inner}</g>`;
}
function paneSVG(p) {
  const c = p.cam?.[0] || [0, 800, 450, 1600];
  const h = c[3] * 9 / 16;
  return `<svg class="set" viewBox="${c[1] - c[3] / 2} ${c[2] - h / 2} ${c[3]} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    ${castDefs()}${SETS[p.set](p)}${(p.things || []).map(thingSVG).join("")}${p.front || ""}</svg>`;
}
function setSceneHTML(s) {
  const panes = s.panes || [{ set: s.set, things: s.things, cam: s.cam, front: s.front, tx: s.tx, glow: s.glow }];
  return `<div class="scene__bg scene__bg--set${panes.length > 1 ? " is-split" : ""}">${panes.map((p) => `<div class="pane">${paneSVG(p)}</div>`).join("")}</div>
    <p class="subs" aria-live="off"></p><div class="credit"></div>`;
}

// ---------- the rig: runs every frame from the scene clock ----------
const smooth = (x) => x * x * (3 - 2 * x);
const ease = { in: (x) => x * x * x, out: (x) => 1 - (1 - x) ** 3, linear: (x) => x, smooth };
const NUMERIC = ["x", "y", "s", "rot", "p"];

// Value of each property at time t. Numbers glide between keys (with the ease of the key they head to);
// everything else (pose, mood, walk, screen...) switches at its key and remembers when it switched.
function sample(keys, t) {
  const out = { since: {}, prev: {} };
  for (const prop of new Set(keys.flatMap(([, v]) => Object.keys(v)))) {
    const track = keys.filter(([, v]) => prop in v);
    if (NUMERIC.includes(prop)) {
      let i = track.findLastIndex(([kt]) => kt <= t);
      if (i < 0) { out[prop] = track[0][1][prop]; continue; }
      const [t0, v0] = track[i], next = track[i + 1];
      if (!next || next[0] === t0) { out[prop] = v0[prop]; continue; }
      const f = (ease[next[1].e] || smooth)(Math.min(Math.max((t - t0) / (next[0] - t0), 0), 1));
      out[prop] = v0[prop] + (next[1][prop] - v0[prop]) * f;
    } else {
      const i = track.findLastIndex(([kt]) => kt <= t);
      out[prop] = i < 0 ? undefined : track[i][1][prop];
      out.since[prop] = i < 0 ? -1 : track[i][0];
      out.prev[prop] = i > 0 ? track[i - 1][1][prop] : undefined;
    }
  }
  return out;
}

// Two-bone arm: shoulder to a hand target, elbow bent outward.
function reach(side, [tx, ty]) {
  const [sx, sy] = ARM.sh[side], L1 = ARM.up, L2 = ARM.fore;
  const dx = tx - sx, dy = ty - sy;
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(L1 - L2) + .1), L1 + L2 - .1);
  const phi = Math.atan2(dy, dx), a = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
  const pick = [phi + a, phi - a].map((th) => [th, sx + L1 * Math.cos(th)]).sort((p, q) => side === "r" ? q[1] - p[1] : p[1] - q[1])[0][0];
  const ex = sx + L1 * Math.cos(pick), ey = sy + L1 * Math.sin(pick);
  const th2 = Math.atan2(ty - ey, tx - ex);
  const deg = (r) => r * 180 / Math.PI;
  return { up: deg(pick) - 90, fore: deg(th2) - deg(pick), sx, sy };
}

const lerp2 = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];

function rigPerson(g, who, st, t, talking) {
  const pose = POSES[st.pose || "idle"] || POSES.idle;
  const was = POSES[st.prev.pose || "idle"] || POSES.idle;
  const blend = smooth(Math.min(Math.max((t - (st.since.pose ?? -1)) / .45, 0), 1));
  ["l", "r"].forEach((side) => {
    let target = lerp2(was[side], pose[side], blend);
    if (pose.wave === side && blend > .9) target = [target[0] + Math.sin(t * 10) * 16, target[1] + Math.cos(t * 10) * 4];
    const r = reach(side, target);
    const arm = g.querySelector(`.arm--${side}`);
    arm.querySelector(".arm__up").setAttribute("transform", `rotate(${r.up} ${r.sx} ${r.sy})`);
    arm.querySelector(".arm__fore").setAttribute("transform", `rotate(${r.fore} ${r.sx} ${r.sy + ARM.up})`);
  });
  const items = { box: pose.box, phone: pose.phone, remote: pose.remote, baby: pose.baby };
  Object.entries(items).forEach(([k, on]) => g.querySelectorAll(`.item--${k}`).forEach((el) => el.style.display = on && blend > .3 ? "" : "none"));
  // Legs swing while walking; the body bobs with each step.
  const phase = t * 9.5, walking = !!st.walk;
  const swing = walking ? Math.sin(phase) * 20 : 0;
  g.querySelector(".leg--l").setAttribute("transform", `rotate(${swing} -20 -150)`);
  g.querySelector(".leg--r").setAttribute("transform", `rotate(${-swing} 20 -150)`);
  g.classList.toggle("is-sit", !!st.sit);
  // Head: a slow sway, a droop when sad, a nod while talking.
  const mood = st.mood || "smile";
  const tilt = Math.sin(t * .9 + who.length) * 2.2 + (mood === "sad" ? 7 : 0) + (talking ? Math.sin(t * 7) * 1.6 : 0);
  const head = `rotate(${tilt} 0 -312)`;
  g.querySelector(".p__head").setAttribute("transform", head);
  g.querySelector(".p__hairback").setAttribute("transform", head);
  // Blink every few seconds, each person on their own rhythm.
  const cyc = (t + who.length * .7) % 3.6;
  const lid = mood === "shock" ? 1.25 : cyc < .13 ? .1 : 1;
  g.querySelector(".p__eyes").setAttribute("transform", `translate(0 -360) scale(1 ${lid}) translate(0 360)`);
  const face = talking ? "talk" : mood;
  g.querySelectorAll(".mouth").forEach((m) => m.style.display = m.classList.contains(`mouth--${face}`) ? "" : "none");
  if (talking) g.querySelector(".mouth--talk").setAttribute("ry", 2 + Math.abs(Math.sin(t * 15)) * 6);
  const brow = mood === "sad" ? "sad" : mood === "shock" ? "shock" : "calm";
  g.querySelectorAll(".brow").forEach((b) => b.style.display = b.classList.contains(`brow--${brow}`) ? "" : "none");
  return walking ? -Math.abs(Math.sin(phase)) * 5 : 0;
}

// Pose one set scene at local time t (seconds into the scene).
function animateSet(el, s, t) {
  if (!s.set && !s.panes) return;
  const panes = s.panes || [{ cam: s.cam, things: s.things, glow: s.glow }];
  const svgs = el.querySelectorAll("svg.set");
  const talk = (s.talk || []).map(([at, who, text, dur]) => ({ at, who, text, end: at + (dur || .9 + text.length * .055) }));
  const line = talk.find((l) => t >= l.at && t < l.end);
  panes.forEach((p, pi) => {
    const svg = svgs[pi];
    if (!svg) return;
    if (p.cam?.length) {
      const k = p.cam, i = k.findLastIndex(([kt]) => kt <= t);
      let c = k[Math.max(i, 0)].slice(1);
      const n = k[i + 1];
      if (i >= 0 && n && n[0] > k[i][0]) {
        const f = smooth(Math.min((t - k[i][0]) / (n[0] - k[i][0]), 1));
        c = c.map((v, j) => v + (n[j + 1] - v) * f);
      }
      const [cx, cy, w] = c, h = w * 9 / 16;
      svg.setAttribute("viewBox", `${cx - w / 2} ${cy - h / 2} ${w} ${h}`);
    }
    (p.things || []).forEach((th) => {
      const g = svg.querySelector(`.thing[data-id="${th.id || th.who || th.kind}"]`);
      if (!g) return;
      const st = sample([[-1, { x: th.x ?? 0, y: th.y ?? 0, s: th.s ?? 1, rot: 0, ...th.start }], ...(th.keys || [])], t);
      g.style.display = st.hide ? "none" : "";
      let bob = 0;
      if (th.who) bob = rigPerson(g, th.who, st, t, line?.who === th.who);
      if (th.kind === "car") {
        g.querySelectorAll(".wheel").forEach((w) => w.setAttribute("transform", `rotate(${st.x * .9})`));
        g.querySelectorAll(".thing[data-rider]").forEach((r) => {
          const who = r.dataset.rider;
          rigPerson(r, who, { since: {}, prev: {}, pose: who === th.waver && t >= (th.waveAt || 0) ? "wave" : "idle", mood: "smile" }, t, line?.who === who);
        });
      }
      if (th.kind === "browse") browseFrame(g, th, st);
      if (th.kind === "bars") barsFrame(g, th, st);
      if (th.kind === "tv") g.querySelectorAll(".tv__screen").forEach((sc) => sc.style.display = sc.classList.contains(`tv__screen--${st.screen || "off"}`) ? "" : "none");
      const scale = (st.s ?? 1) * (th.who ? LOOKS[th.who].h : 1);
      const pivot = th.who ? -150 : 0;
      g.setAttribute("transform", `translate(${st.x} ${st.y + bob}) scale(${scale}) rotate(${st.rot || 0} 0 ${pivot})`);
    });
    (p.glow || []).forEach(([sel, from]) => svg.querySelectorAll(sel).forEach((x) => x.style.opacity = t >= from ? .6 + Math.sin(t * 6) * .25 : 0));
  });
  const subs = el.querySelector(".subs");
  const html = line ? `<span class="subs__who">${esc(LOOKS[line.who]?.name || line.who)}</span>${esc(line.text)}` : "";
  if (subs && subs.dataset.html !== html) { subs.innerHTML = html; subs.dataset.html = html; }
  const credit = el.querySelector(".credit");
  const cr = (s.credits || []).find(([at, dur]) => t >= at && t < at + dur);
  const chtml = cr ? cr[2] : "";
  if (credit && credit.dataset.html !== chtml) { credit.innerHTML = chtml; credit.dataset.html = chtml; credit.classList.toggle("is-title", !!cr?.[3]); }
  if (credit) {
    const fade = cr ? Math.min(t - cr[0], cr[0] + cr[1] - t, .5) / .5 : 0;
    credit.style.opacity = Math.max(0, fade);
  }
}
