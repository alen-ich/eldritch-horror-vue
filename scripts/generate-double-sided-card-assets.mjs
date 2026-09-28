import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const category = process.argv[2];
if (category !== "conditions" && category !== "spells") {
  throw new Error("Usage: node scripts/generate-double-sided-card-assets.mjs conditions|spells");
}

const root = process.cwd();
const layouts = {
  conditions: [
    { front: "front-1.jpg", back: "back-1.jpg", columns: 8, rows: 4, start: 0 },
    { front: "front-2.jpg", back: "back-2.jpg", columns: 4, rows: 1, start: 32 },
  ],
  spells: [{ front: "front.jpg", back: "back.jpg", columns: 4, rows: 5, start: 0 }],
};

const ids = {
  conditions: [
    ...Array(6).fill("debt"),
    ...["amnesia", "dark_pact", "leg_injury", "internal_injury", "paranoia", "cursed", "hallucinations", "detained", "blessed", "back_injury"]
      .flatMap(name => Array(3).fill(name)),
  ],
  spells: ["instill_bravery", "blessing_of_isis", "shriveling", "clairvoyance", "feed_the_mind", "flesh_ward", "plumb_the_void", "wither", "conjuration", "mists_of_rlyeh"]
    .flatMap(name => [name, name]),
};

const publicDirectory = path.join(root, "apps", "web", "public", "cards", category);
const privateDirectory = path.join(root, "apps", "server", "private-card-assets", category);
await mkdir(publicDirectory, { recursive: true });
await mkdir(privateDirectory, { recursive: true });

for (const sheet of layouts[category]) {
  const frontPath = path.join(root, "source-assets", category, sheet.front);
  const backPath = path.join(root, "source-assets", category, sheet.back);
  const front = await sharp(frontPath).metadata();
  const back = await sharp(backPath).metadata();
  if (!front.width || !front.height || !back.width || !back.height) throw new Error(`Unreadable ${category} sheet.`);
  if (Math.abs(front.width / front.height - back.width / back.height) > 0.02) {
    throw new Error(`Mismatched front/back sheet layouts: ${frontPath} and ${backPath}`);
  }
  for (let slot = 0; slot < sheet.columns * sheet.rows; slot++) {
    const ordinal = sheet.start + slot;
    const name = ids[category][ordinal];
    if (!name) throw new Error(`Unexpected ${category} card slot ${ordinal}.`);
    const copy = ids[category].slice(0, ordinal + 1).filter(value => value === name).length;
    const id = `${category === "conditions" ? "condition" : "spell"}_${name}_${String(copy).padStart(2, "0")}`;
    const row = Math.floor(slot / sheet.columns);
    const column = slot % sheet.columns;
    for (const side of [
      { path: frontPath, metadata: front, directory: publicDirectory },
      { path: backPath, metadata: back, directory: privateDirectory },
    ]) {
      const left = Math.round(column * side.metadata.width / sheet.columns);
      const right = Math.round((column + 1) * side.metadata.width / sheet.columns);
      const top = Math.round(row * side.metadata.height / sheet.rows);
      const bottom = Math.round((row + 1) * side.metadata.height / sheet.rows);
      await sharp(side.path)
        .extract({ left, top, width: right - left, height: bottom - top })
        .webp({ quality: 90, effort: 5 })
        .toFile(path.join(side.directory, `${id}.webp`));
    }
  }
}

console.log(`Generated ${ids[category].length} paired ${category} fronts and private backs.`);
