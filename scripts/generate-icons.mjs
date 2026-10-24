/**
 * Generates PWA, browser and Apple icons from the approved EsiFit artwork.
 * The standalone gradient mark is public/icons/logo-mark.svg (navigation).
 * The gradient app tile is public/icons/icon.svg (favicon + PWA).
 * Called by dev/build scripts to keep generated assets in sync.
 */
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const OUT = path.join(ROOT, "icons");
const appSvg = readFileSync(path.join(OUT, "icon.svg"));
const maskSvg = readFileSync(path.join(OUT, "icon-maskable.svg"));

mkdirSync(OUT, { recursive: true });

async function png(source, size, filename) {
  const output = await sharp(source, { density: 192 })
    .resize(size, size)
    .png()
    .toBuffer();
  writeFileSync(path.join(OUT, filename), output);
  return output;
}

await png(appSvg, 192, "icon-192.png");
await png(appSvg, 512, "icon-512.png");
await png(appSvg, 180, "apple-touch-icon.png");
await png(maskSvg, 512, "icon-maskable.png");

const faviconPngs = [];
for (const size of [16, 32, 48]) {
  faviconPngs.push({ size, bytes: await png(appSvg, size, `icon-${size}.png`) });
}

// A standard ICO container supports PNG payloads for crisp small favicons.
const header = Buffer.alloc(6 + faviconPngs.length * 16);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(faviconPngs.length, 4);
let offset = header.length;
faviconPngs.forEach(({ size, bytes }, index) => {
  const entry = 6 + index * 16;
  header.writeUInt8(size, entry);
  header.writeUInt8(size, entry + 1);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(bytes.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += bytes.length;
});
writeFileSync(path.join(ROOT, "favicon.ico"), Buffer.concat([
  header,
  ...faviconPngs.map((icon) => icon.bytes),
]));
console.log("✓ EsiFit browser, Apple and PWA icons generated");
