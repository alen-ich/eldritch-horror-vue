import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const root = process.cwd();
const sourceRoot = path.join(root, "source-assets", "mythos");
const outputRoot = path.join(root, "apps", "web", "public", "cards", "mythos");

const sheets = [
  { file: "photo_2026-09-28_01-13-39.jpg", color: "blue", rows: 2, columns: 6, start: 1 },
  { file: "photo_2026-09-28_01-14-01.jpg", color: "yellow", rows: 1, columns: 3, start: 1 },
  { file: "photo_2026-09-28_01-14-07.jpg", color: "yellow", rows: 3, columns: 6, start: 4 },
  { file: "photo_2026-09-28_01-14-10.jpg", color: "green", rows: 3, columns: 6, start: 1 },
];

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const sheet of sheets) {
  const sourcePath = path.join(sourceRoot, sheet.file);
  const image = sharp(sourcePath);
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Missing dimensions for ${sheet.file}.`);

  let index = sheet.start;
  for (let row = 0; row < sheet.rows; row += 1) {
    const top = Math.round((row * metadata.height) / sheet.rows);
    const bottom = Math.round(((row + 1) * metadata.height) / sheet.rows);
    for (let column = 0; column < sheet.columns; column += 1) {
      const left = Math.round((column * metadata.width) / sheet.columns);
      const right = Math.round(((column + 1) * metadata.width) / sheet.columns);
      const id = `mythos_${sheet.color}_${String(index).padStart(2, "0")}`;
      await sharp(sourcePath)
        .extract({ left, top, width: right - left, height: bottom - top })
        .webp({ quality: 90, effort: 5 })
        .toFile(path.join(outputRoot, `${id}.webp`));
      index += 1;
    }
  }
}

console.log("Generated 51 English Mythos card fronts.");
