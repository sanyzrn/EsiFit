/**
 * Generates EsiFit PWA icons (maskable + regular) and the vector icon from one
 * drawing: a saffron khatam (eight-point star) on lapis, dumbbell at its heart.
 * Run from the repo root:  node scripts/generate-icons.mjs
 */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
const W = 512;

/** {8/2} octagram (two overlaid squares): inner/outer radius ratio. */
const INNER = Math.SQRT1_2 / Math.cos(Math.PI / 8);
function star(cx, cy, outer, rotation = -90) {
  const pts = [];
  for (let k = 0; k < 16; k++) {
    const r = k % 2 === 0 ? outer : outer * INNER;
    const a = ((rotation + k * 22.5) * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(" L")}Z`;
}

const svg = (radius = W) => `
<svg width="${W}" height="${W}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="70%" cy="10%" r="110%">
      <stop offset="0%" stop-color="#1a2566"/>
      <stop offset="55%" stop-color="#0b1231"/>
      <stop offset="100%" stop-color="#070b1f"/>
    </radialGradient>
    <linearGradient id="brand" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffd45e"/>
      <stop offset="100%" stop-color="#ff8a3d"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${radius}" fill="url(#bg)"/>
  <path d="${star(256, 256, 214)}" fill="none" stroke="#ffc83d" stroke-opacity=".22" stroke-width="3"/>
  <path d="${star(256, 256, 176)}" fill="url(#brand)"/>
  <g stroke="#101a4a" stroke-width="22" stroke-linecap="round">
    <path d="M196 218v76"/>
    <path d="M226 190v132"/>
    <path d="M286 190v132"/>
    <path d="M316 218v76"/>
    <path d="M226 256h60"/>
  </g>
</svg>`;

async function make(size, name, radius) {
  await sharp(Buffer.from(svg(radius))).resize(size, size).png().toFile(path.join(OUT, name));
  console.log(`✓ ${name}`);
}

mkdirSync(OUT, { recursive: true });
await make(192, "icon-192.png", 46);
await make(512, "icon-512.png", 92);
await make(180, "apple-touch-icon.png", 41);
await make(512, "icon-maskable.png", 0); // full-bleed maskable
await make(32, "icon-32.png", 8);
writeFileSync(path.join(OUT, "icon.svg"), svg(92).trim() + "\n");
console.log("✓ icon.svg\ndone");
