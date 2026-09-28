import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const root = process.cwd();
const sourceRoot = path.join(root, "source-assets");
const outputRoot = path.join(root, "apps", "web", "public", "cards", "encounters");

const sheets = [
  { deck: "america", file: "photo_2026-09-28_21-17-55.jpg", columns: 5, rows: 1, numbers: [1, 2, 3, 4, 5] },
  { deck: "america", file: "photo_2026-09-28_21-18-03.jpg", columns: 3, rows: 1, numbers: [6, 7, 8] },
  { deck: "general", file: "photo_2026-09-28_21-07-03.jpg", columns: 5, rows: 2, numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { deck: "general", file: "photo_2026-09-28_21-07-15.jpg", columns: 2, rows: 1, numbers: [11, 12] },
  { deck: "europe", file: "photo_2026-09-28_21-08-11.jpg", columns: 5, rows: 1, numbers: [1, 2, 3, 4, 5] },
  { deck: "europe", file: "photo_2026-09-28_21-08-38.jpg", columns: 3, rows: 1, numbers: [6, 7, 8] },
  { deck: "asia_australia", sourceDirectory: "asia", file: "photo_2026-09-28_21-07-33.jpg", columns: 3, rows: 2, numbers: [1, 2, 3, 6, 7, 8] },
  { deck: "asia_australia", sourceDirectory: "asia", file: "photo_2026-09-28_21-07-59.jpg", columns: 2, rows: 1, numbers: [4, 5] },
];
const backs = [
  { deck: "america", file: "photo_2026-09-28_21-18-08.jpg" },
  { deck: "general", file: "photo_2026-09-28_21-07-20.jpg" },
  { deck: "europe", file: "photo_2026-09-28_21-08-42.jpg" },
  { deck: "asia_australia", sourceDirectory: "asia", file: "photo_2026-09-28_21-08-03.jpg" },
];

for (const sheet of sheets) {
  const sourceDirectory = sheet.sourceDirectory ?? sheet.deck;
  const sourcePath = path.join(sourceRoot, sourceDirectory, sheet.file);
  const metadata = await sharp(sourcePath).metadata();
  if (!metadata.width || !metadata.height || sheet.numbers.length !== sheet.columns * sheet.rows) {
    throw new Error(`Invalid encounter sheet layout: ${sourcePath}`);
  }
  const outputDirectory = path.join(outputRoot, sheet.deck);
  await mkdir(outputDirectory, { recursive: true });
  for (const [index, number] of sheet.numbers.entries()) {
    const row = Math.floor(index / sheet.columns);
    const column = index % sheet.columns;
    const left = Math.round(column * metadata.width / sheet.columns);
    const right = Math.round((column + 1) * metadata.width / sheet.columns);
    const top = Math.round(row * metadata.height / sheet.rows);
    const bottom = Math.round((row + 1) * metadata.height / sheet.rows);
    await sharp(sourcePath)
      .extract({ left, top, width: right - left, height: bottom - top })
      .webp({ quality: 90, effort: 5 })
      .toFile(path.join(outputDirectory, `${String(number).padStart(2, "0")}.webp`));
  }
}

for (const back of backs) {
  const sourcePath = path.join(sourceRoot, back.sourceDirectory ?? back.deck, back.file);
  await sharp(sourcePath)
    .webp({ quality: 90, effort: 5 })
    .toFile(path.join(outputRoot, back.deck, "back.webp"));
}

console.log("Generated 36 base-game location encounter fronts and 4 shared backs.");
