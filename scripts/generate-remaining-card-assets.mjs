import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const { decks } = JSON.parse(await readFile(path.join(root, "packages/content/src/remaining-card-scans.json"), "utf8"));
let fronts = 0;
const outputs = new Set();
for (const deck of decks) {
  const directory = path.join(root, "apps/web/public/cards", deck.family === "artifact" ? "artifacts" : `encounters/${deck.id}`);
  await mkdir(directory, { recursive: true });
  for (const sheet of deck.sheets) {
    if (sheet.numbers.length !== sheet.rows * sheet.columns || (sheet.ids && sheet.ids.length !== sheet.numbers.length)) throw new Error(`Invalid layout: ${sheet.file}`);
    const input = path.join(root, "source-assets", sheet.file);
    const { width, height } = await sharp(input).metadata();
    if (!width || !height) throw new Error(`Unreadable scan: ${sheet.file}`);
    for (const [index, number] of sheet.numbers.entries()) {
      const row = Math.floor(index / sheet.columns);
      const column = index % sheet.columns;
      const left = Math.round(column * width / sheet.columns);
      const right = Math.round((column + 1) * width / sheet.columns);
      const top = Math.round(row * height / sheet.rows);
      const bottom = Math.round((row + 1) * height / sheet.rows);
      const output = path.join(directory, `${sheet.ids?.[index] ?? String(number).padStart(2, "0")}.webp`);
      if (outputs.has(output)) throw new Error(`Duplicate output: ${output}`);
      outputs.add(output);
      await sharp(input).extract({ left, top, width: right - left, height: bottom - top }).webp({ quality: 90, effort: 5 }).toFile(output);
      fronts++;
    }
  }
  await sharp(path.join(root, "source-assets", deck.backScan)).webp({ quality: 90, effort: 5 }).toFile(path.join(directory, "back.webp"));
}
if (fronts !== 100 || decks.length !== 14) throw new Error("Expected 100 fronts and 14 distinct backs.");
console.log(`Generated ${fronts} base-game card fronts and ${decks.length} shared backs.`);
