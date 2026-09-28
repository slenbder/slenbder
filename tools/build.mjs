// Builds the profile's sign SVGs. Every letter is converted to a path, so the
// images render identically on github.com without loading any font.
// Run: node tools/build.mjs
import opentype from "opentype.js";
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "assets");
const font = (f) => opentype.loadSync(join(here, "fonts", f));
const F = {
  display: font("Anton-Regular.ttf"),
  bold: font("BarlowCondensed-Bold.ttf"),
  semi: font("BarlowCondensed-SemiBold.ttf"),
};

// Enamel sign paint.
const C = {
  red: "#d3241c",
  redDeep: "#8e140e",
  yellow: "#f7cf1d",
  cobalt: "#1b4ea3",
  white: "#fbfaf6",
  ink: "#151515",
  screw: "#c9c6bd",
};

// ---------- type ----------
function measure(f, text, size, track = 0) {
  const glyphs = f.stringToGlyphs(text);
  const scale = size / f.unitsPerEm;
  let w = 0;
  glyphs.forEach((g, i) => {
    w += g.advanceWidth * scale;
    if (i < glyphs.length - 1) w += f.getKerningValue(g, glyphs[i + 1]) * scale + track * size;
  });
  return w;
}

function capHeight(f, size) {
  const cap = f.tables.os2.sCapHeight || f.charToGlyph("H").getBoundingBox().y2;
  return (cap / f.unitsPerEm) * size;
}

// Text as a single path. align: start | middle | end. y is the baseline.
function text(f, str, { x, y, size, fill, track = 0, align = "start", maxWidth, cap }) {
  if (cap) size = (cap / capHeight(f, 1));
  let w = measure(f, str, size, track);
  if (maxWidth && w > maxWidth) {
    size *= maxWidth / w;
    w = maxWidth;
  }
  let cx = align === "middle" ? x - w / 2 : align === "end" ? x - w : x;
  const glyphs = f.stringToGlyphs(str);
  const scale = size / f.unitsPerEm;
  let d = "";
  glyphs.forEach((g, i) => {
    d += g.getPath(cx, y, size).toPathData(1);
    cx += g.advanceWidth * scale;
    if (i < glyphs.length - 1) cx += f.getKerningValue(g, glyphs[i + 1]) * scale + track * size;
  });
  return { svg: `<path fill="${fill}" d="${d}"/>`, width: w, size };
}

// ---------- sign parts ----------
const PAD = 14; // room for the drop shadow

function screws(x, y, w, h, inset = 16) {
  const pts = [
    [x + inset, y + inset],
    [x + w - inset, y + inset],
    [x + inset, y + h - inset],
    [x + w - inset, y + h - inset],
  ];
  return pts
    .map(
      ([cx, cy], i) =>
        `<g transform="translate(${cx} ${cy}) rotate(${[28, -52, 71, -14][i]})"><circle r="5.5" fill="${C.screw}" stroke="rgba(0,0,0,.35)" stroke-width="1"/><path d="M-3.4 0H3.4" stroke="rgba(0,0,0,.5)" stroke-width="1.4" stroke-linecap="round"/></g>`
    )
    .join("");
}

function board({ w, h, ground, keyline, label, body, strip, extraDefs = "", extraCss = "" }) {
  const W = w + PAD * 2;
  const H = h + PAD * 2 + 6;
  const x = PAD;
  const y = PAD;
  const k = 22; // keyline inset
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">
<title>${label}</title>
<defs>
<filter id="drop" x="-5%" y="-10%" width="110%" height="130%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity=".28"/></filter>
${extraDefs}
</defs>
${extraCss ? `<style>${extraCss}</style>` : ""}
<g filter="url(#drop)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${ground}"/></g>
<rect x="${x + k}" y="${y + k}" width="${w - 2 * k}" height="${h - 2 * k}" rx="3" fill="none" stroke="${keyline}" stroke-width="3"/>
${strip || ""}
${body}
${screws(x, y, w, h, 11)}
</svg>
`;
}

// Painted strip across the bottom of the board, inside the keyline.
function stripBand({ w, h, fill, bandH }) {
  const k = 22;
  return `<rect x="${PAD + k}" y="${PAD + h - k - bandH}" width="${w - 2 * k}" height="${bandH}" fill="${fill}"/>`;
}

function statusDisc({ cx, cy, r, fill, ring, color, lines }) {
  const f = F.bold;
  const size = lines.length > 1 ? 30 : 34;
  const lh = size * 0.95;
  const top = cy - ((lines.length - 1) * lh) / 2 + capHeight(f, size) / 2;
  const t = lines
    .map((l, i) => text(f, l, { x: cx, y: top + i * lh, size, fill: color, align: "middle", track: 0.03, maxWidth: r * 1.55 }).svg)
    .join("");
  return `<g transform="rotate(-8 ${cx} ${cy})"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/><circle cx="${cx}" cy="${cy}" r="${r - 7}" fill="none" stroke="${ring}" stroke-width="2.5"/>${t}</g>`;
}

// ---------- header sign ----------
function header() {
  const w = 1000,
    h = 392;
  const x = PAD,
    y = PAD;
  const k = 22;
  const bandH = 64;
  const mid = x + w / 2;

  const kicker = text(F.bold, "PHẦN MỀM  ·  SOFTWARE", { x: mid, y: y + 80, size: 30, fill: C.white, align: "middle", track: 0.16 });
  const name = text(F.display, "KIRILL", { x: mid, y: y + 240, cap: 134, fill: C.yellow, align: "middle", track: 0.035 });
  const trade = text(F.semi, "MAC & IOS APPS  ·  TELEGRAM BOTS", { x: mid, y: y + 286, size: 34, fill: C.white, align: "middle", track: 0.08 });
  const bandY = y + h - k - bandH;
  const place = text(F.bold, "NHA TRANG  ·  KHÁNH HÒA  ·  VIỆT NAM", { x: x + k + 26, y: bandY + 43, size: 31, fill: C.red, track: 0.06 });
  const handle = text(F.bold, "@SLENBDER", { x: x + w - k - 26, y: bandY + 43, size: 31, fill: C.cobalt, align: "end", track: 0.06 });

  // Chasing LED border: a dim bulb every 18 units, a lit bulb every third.
  const lx = x + 9,
    ly = y + 9,
    lw = w - 18,
    lh = h - 18;
  const per = 2 * (lw + lh);
  const step = per / Math.round(per / 18);
  const leds = `
<rect class="bulbs" x="${lx}" y="${ly}" width="${lw}" height="${lh}" rx="4" fill="none" stroke="${C.redDeep}" stroke-width="5.5" stroke-linecap="round" stroke-dasharray="0 ${step}"/>
<rect class="lit" x="${lx}" y="${ly}" width="${lw}" height="${lh}" rx="4" fill="none" stroke="#ffe27a" stroke-width="5.5" stroke-linecap="round" stroke-dasharray="0 ${step * 3}"/>`;
  const css = `
.lit{animation:chase 1.2s steps(3) infinite}
@keyframes chase{to{stroke-dashoffset:${(-step * 3).toFixed(3)}}}
@media (prefers-reduced-motion:reduce){.lit{animation:none}}`;

  const body = [leds, kicker.svg, name.svg, trade.svg, place.svg, handle.svg].join("\n");
  return board({
    w,
    h,
    ground: C.red,
    keyline: C.yellow,
    label: "Kirill — software: Mac and iOS apps, Telegram bots. Nha Trang, Khánh Hòa, Việt Nam. @slenbder",
    body,
    strip: stripBand({ w, h, fill: C.white, bandH }),
    extraCss: css,
  });
}

// ---------- project signs ----------
function project({ file, w = 1000, h = 270, mirror = false, ground, keyline, nameFill, name, trade, tradeFill, band, bandFill, bandText, disc, label }) {
  const x = PAD,
    y = PAD,
    k = 22;
  const bandH = 50;
  const discR = disc ? Math.min(78, (h - 2 * k - bandH) / 2 + 6) : 0;
  const discSpace = disc ? discR * 2 + 60 : 0;
  // Mirrored signs put the disc on the left and set the lettering flush right.
  const left = x + k + 30 + (mirror ? discSpace : 0);
  const right = x + w - k - 30 - (mirror ? 0 : discSpace);
  const textRight = right;
  const anchor = mirror ? right : left;
  const align = mirror ? "end" : "start";
  // Name and trade line share the painted field above the strip, centred as a block.
  const fieldTop = y + k, fieldBottom = y + h - k - bandH;
  const nameCap = Math.min(92, (fieldBottom - fieldTop) * 0.54);
  const gap = nameCap * 0.3, tradeCap = capHeight(F.semi, 28);
  const blockTop = fieldTop + (fieldBottom - fieldTop - (nameCap + gap + tradeCap)) / 2;
  const nameT = text(F.display, name, { x: anchor, align, y: blockTop + nameCap, cap: nameCap, fill: nameFill, track: 0.03, maxWidth: textRight - left });
  const tradeT = text(F.semi, trade, { x: anchor, align, y: blockTop + nameCap + gap + tradeCap, size: 28, fill: tradeFill, track: 0.05, maxWidth: textRight - left });
  const bandY = y + h - k - bandH;
  const bandT = text(F.bold, bandText, { x: mirror ? x + w - k - 30 : x + k + 30, align, y: bandY + 35, size: 26, fill: bandFill, track: 0.1, maxWidth: w - 2 * k - 60 });
  const d = disc
    ? statusDisc({ cx: mirror ? x + k + discR + 34 : x + w - k - discR - 34, cy: y + k + (h - 2 * k - bandH) / 2 + 2, r: discR, ...disc })
    : "";
  const svg = board({
    w,
    h,
    ground,
    keyline,
    label,
    body: [nameT.svg, tradeT.svg, bandT.svg, d].join("\n"),
    strip: stripBand({ w, h, fill: band, bandH }),
  });
  writeFileSync(join(out, file), svg);
}

// ---------- contact plates ----------
function plate({ file, w, ground, keyline, fill, str, label }) {
  const h = 72;
  const x = PAD,
    y = PAD;
  const t = text(F.bold, str, { x: x + w / 2, y: y + h / 2 + capHeight(F.bold, 30) / 2, size: 30, fill, align: "middle", track: 0.08 });
  const W = w + PAD * 2,
    H = h + PAD * 2 + 6;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">
<title>${label}</title>
<defs><filter id="drop" x="-5%" y="-10%" width="110%" height="140%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#000" flood-opacity=".26"/></filter></defs>
<g filter="url(#drop)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${ground}"/></g>
<rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="${h - 16}" rx="3" fill="none" stroke="${keyline}" stroke-width="2"/>
${t.svg}
</svg>
`;
  writeFileSync(join(out, file), svg);
}

// ---------- maker's plate (footer) ----------
function makersPlate() {
  const w = 420,
    h = 96,
    x = PAD,
    y = PAD;
  const src = readFileSync(join(here, "slenbder-mark.svg"), "utf8");
  const paths = [...src.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  const s = 72 / 1024;
  const mark = `<g transform="translate(${x + 16} ${y + 12}) scale(${s})">${paths
    .map((d) => `<path fill="${C.yellow}" fill-rule="evenodd" d="${d}"/>`)
    .join("")}</g>`;
  const t1 = text(F.bold, "SLENBDER", { x: x + 104, y: y + 46, size: 32, fill: C.white, track: 0.14 });
  const t2 = text(F.semi, "MADE IN NHA TRANG", { x: x + 104, y: y + 76, size: 22, fill: C.yellow, track: 0.14 });
  const W = w + PAD * 2,
    H = h + PAD * 2 + 6;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="slenbder — made in Nha Trang">
<title>slenbder — made in Nha Trang</title>
<defs><filter id="drop" x="-5%" y="-10%" width="110%" height="140%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#000" flood-opacity=".26"/></filter></defs>
<g filter="url(#drop)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${C.ink}"/></g>
<rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="${h - 16}" rx="3" fill="none" stroke="${C.yellow}" stroke-width="2"/>
${mark}${t1.svg}${t2.svg}
</svg>
`;
  writeFileSync(join(out, "makers-plate.svg"), svg);
}

// ---------- build ----------
writeFileSync(join(out, "header.svg"), header());

project({
  file: "vanto.svg",
  ground: C.cobalt,
  keyline: C.yellow,
  nameFill: C.white,
  name: "VANTO",
  trade: "MACOS MENU-BAR APP  ·  COPY EVERYTHING, PASTE IN ORDER",
  tradeFill: C.yellow,
  band: C.yellow,
  bandFill: C.cobalt,
  bandText: "SWIFT  ·  APPKIT  ·  SWIFTUI  ·  SPARKLE",
  disc: { fill: C.red, ring: C.yellow, color: C.white, lines: ["COMING", "SOON"] },
  label: "Vanto — macOS menu-bar app: copy everything, paste in order. Coming soon.",
});

project({
  file: "horecatime.svg",
  mirror: true,
  ground: C.yellow,
  keyline: C.red,
  nameFill: C.red,
  name: "HORECATIME",
  trade: "SHIFTS, HOURS & PAYROLL FOR RESTAURANTS  ·  TELEGRAM",
  tradeFill: C.ink,
  band: C.red,
  bandFill: C.white,
  bandText: "PYTHON  ·  AIOGRAM  ·  GOOGLE SHEETS  ·  DOCKER",
  disc: { fill: C.cobalt, ring: C.white, color: C.white, lines: ["BETA"] },
  label: "HorecaTime — Telegram bot for restaurant shifts, hours and payroll. In beta.",
});

project({
  file: "recallybot.svg",
  ground: C.white,
  keyline: C.cobalt,
  nameFill: C.cobalt,
  name: "RECALLYBOT",
  trade: "NEW MAP REVIEWS IN YOUR TEAM CHAT WITHIN MINUTES",
  tradeFill: C.ink,
  band: C.cobalt,
  bandFill: C.white,
  bandText: "PYTHON  ·  YANDEX MAPS  ·  2GIS  ·  TELEGRAM  ·  DOCKER",
  disc: { fill: C.yellow, ring: C.red, color: C.red, lines: ["IN", "SERVICE"] },
  label: "RecallyBot — delivers new Yandex Maps and 2GIS reviews to a Telegram chat within minutes. In service.",
});

project({
  file: "wireader.svg",
  mirror: true,
  h: 240,
  ground: C.red,
  keyline: C.white,
  nameFill: C.white,
  name: "WIREADER",
  trade: "IOS READER  ·  SPOILER-FREE “WHO IS?” FOR CHARACTERS",
  tradeFill: C.yellow,
  band: C.white,
  bandFill: C.red,
  bandText: "SWIFT  ·  SWIFTUI  ·  EPUB  ·  FB2  ·  TXT",
  disc: { fill: C.ink, ring: C.yellow, color: C.yellow, lines: ["IN", "PROGRESS"] },
  label: "WIReader — iOS reading app with spoiler-free character summaries. In development.",
});

project({
  file: "flarmo.svg",
  h: 240,
  ground: C.ink,
  keyline: C.yellow,
  nameFill: C.yellow,
  name: "FLARMO",
  trade: "IOS ALARMS THAT FOLLOW YOUR SHIFT PATTERN",
  tradeFill: C.white,
  band: C.yellow,
  bandFill: C.ink,
  bandText: "SWIFT  ·  SWIFTUI",
  disc: { fill: C.white, ring: C.ink, color: C.ink, lines: ["IN", "PROGRESS"] },
  label: "Flarmo — iOS alarms that follow your shift pattern. In development.",
});

plate({ file: "plate-site.svg", w: 300, ground: C.white, keyline: C.red, fill: C.red, str: "SLENBDER.COM", label: "slenbder.com" });
plate({ file: "plate-telegram.svg", w: 340, ground: C.cobalt, keyline: C.yellow, fill: C.white, str: "TELEGRAM @SLENBDER", label: "Telegram @slenbder" });
plate({ file: "plate-vanto.svg", w: 360, ground: C.yellow, keyline: C.red, fill: C.red, str: "VANTO.SLENBDER.COM", label: "vanto.slenbder.com" });

makersPlate();
console.log("built", out);
