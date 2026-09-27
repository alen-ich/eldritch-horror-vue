import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const root = process.cwd();
const sourcePath = path.join(root, "source-assets", "reference-cards", "photo_2026-09-28_02-09-43.jpg");
const outputRoot = path.join(root, "apps", "web", "public", "cards", "reference");

const baseGameCards = [
  { playerCount: 1, row: 4, column: 1 },
  { playerCount: 2, row: 2, column: 3 },
  { playerCount: 3, row: 4, column: 2 },
  { playerCount: 4, row: 3, column: 1 },
  { playerCount: 5, row: 3, column: 2 },
  { playerCount: 6, row: 4, column: 3 },
  { playerCount: 7, row: 5, column: 1 },
  { playerCount: 8, row: 3, column: 3 },
];

const metadata = await sharp(sourcePath).metadata();
if (!metadata.width || !metadata.height) throw new Error("Missing Reference card sheet dimensions.");

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const card of baseGameCards) {
  const left = Math.round(((card.column - 1) * metadata.width) / 3);
  const right = Math.round((card.column * metadata.width) / 3);
  const top = Math.round(((card.row - 1) * metadata.height) / 5);
  const bottom = Math.round((card.row * metadata.height) / 5);
  await sharp(sourcePath)
    .extract({ left, top, width: right - left, height: bottom - top })
    .webp({ quality: 90, effort: 5 })
    .toFile(path.join(outputRoot, `players-${card.playerCount}.webp`));
}

console.log("Generated 8 base-game Icon Reference card faces; excluded 5 expansion variants.");
