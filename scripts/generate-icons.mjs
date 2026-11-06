import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "public", "icons");

fs.mkdirSync(outDir, { recursive: true });

const bg = "#5c3d21";
const ring = "#c9a227";
const hole = "#1a120a";

async function makePng(size, filename) {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="100%" height="100%" fill="${bg}" rx="${Math.floor(size * 0.12)}"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.32}" fill="${hole}"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.38}" fill="none" stroke="${ring}" stroke-width="${Math.max(2, size / 48)}"/>
</svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  const out = path.join(outDir, filename);
  await fs.promises.writeFile(out, buf);
  console.log("wrote", path.relative(root, out));
}

await makePng(192, "icon-192.png");
await makePng(512, "icon-512.png");
