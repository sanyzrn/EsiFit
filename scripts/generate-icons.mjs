/**
 * Generates EsiFit PWA icons (maskable + regular) from a vector drawing
 * rendered via sharp. Mint→blue brand gradient, dumbbell glyph.
 */
import sharp from "sharp";
import { mkdirSync } from "fs";

const W = 512;

const svg = (pad = 0, radius = W) => `
<svg width="${W}" height="${W}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0A0D12"/>
      <stop offset="100%" stop-color="#161D27"/>
    </linearGradient>
    <linearGradient id="brand" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5BE7C4"/>
      <stop offset="100%" stop-color="#4F8CFF"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${radius}" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="190" fill="url(#brand)" opacity="0.14"/>
  <g transform="translate(96,96)">
    <rect x="0" y="0" width="320" height="320" rx="72" fill="url(#brand)"/>
    <g stroke="#07120F" stroke-width="24" stroke-linecap="round">
      <path d="M64 116 v88"/>
      <path d="M112 88 v144"/>
      <path d="M208 88 v144"/>
      <path d="M256 116 v88"/>
      <path d="M112 160 h96"/>
    </g>
  </g>
</svg>`;

async function make(size, name, radius) {
  const img = sharp(Buffer.from(svg(0, radius))).resize(size, size);
  await img.png().toFile(`/home/z/my-project/public/icons/${name}`);
  console.log(`✓ ${name}`);
}

mkdirSync("/home/z/my-project/public/icons", { recursive: true });

await make(192, "icon-192.png", 46);
await make(512, "icon-512.png", 92);
await make(180, "apple-touch-icon.png", 41);
await make(512, "icon-maskable.png", 0); // full-bleed maskable

// Favicon-quality 32
await sharp(Buffer.from(svg(0, 10))).resize(32, 32).png().toFile("/home/z/my-project/public/icons/icon-32.png");

// Vector source kept for crispness
await sharp(Buffer.from(svg(0, 92))).resize(512, 512).png().toFile("/home/z/my-project/public/icons/icon-512.png");
console.log("done");
