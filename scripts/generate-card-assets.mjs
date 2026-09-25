import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const root = process.cwd();
const sourcePath = path.join(root, "packages/content/src/data/cards.json");
const publicRoot = path.join(root, "apps/web/public/cards");
const dataRoot = path.join(publicRoot, "data");
const detailRoot = path.join(dataRoot, "details");
const thumbnailRoot = path.join(publicRoot, "thumbnails");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
if (source.schema_version !== "1.0" || source.card_count !== source.cards.length) {
  throw new Error("Invalid card source header or count.");
}

const expectedIds = source.cards.map((_, index) => `card_${String(index + 1).padStart(3, "0")}`);
const ids = source.cards.map((card) => card.id);
if (new Set(ids).size !== ids.length || ids.some((id, index) => id !== expectedIds[index])) {
  throw new Error("Card IDs must be unique and sequential.");
}

for (const card of source.cards) {
  for (const side of ["front", "back"]) {
    const expected = `images/${side}/${card.id}.jpg`;
    if (card.images[side] !== expected) throw new Error(`Unexpected ${side} path for ${card.id}.`);
    await stat(path.join(publicRoot, side, `${card.id}.jpg`));
  }
}

for (const [directory, label] of [[path.join(publicRoot, "front"), "front"], [path.join(publicRoot, "back"), "back"]]) {
  const files = (await readdir(directory)).filter((file) => file.endsWith(".jpg")).sort();
  const expected = expectedIds.map((id) => `${id}.jpg`);
  if (files.length !== expected.length || files.some((file, index) => file !== expected[index])) {
    throw new Error(`The ${label} image directory does not exactly match the catalog.`);
  }
}

await rm(dataRoot, { recursive: true, force: true });
await rm(thumbnailRoot, { recursive: true, force: true });
await mkdir(detailRoot, { recursive: true });
await mkdir(thumbnailRoot, { recursive: true });

const index = {
  schemaVersion: "1.0",
  cardCount: source.cards.length,
  cards: source.cards.map((card) => ({
    id: card.id,
    title: card.title,
    cardType: card.card_type,
    reviewRequired: card.extraction.review_required,
    thumbnailUrl: `/cards/thumbnails/${card.id}.webp`,
  })),
};

await writeFile(path.join(dataRoot, "index.json"), `${JSON.stringify(index)}\n`);

await Promise.all(source.cards.map(async (card) => {
  const detail = {
    ...card,
    frontUrl: `/cards/front/${card.id}.jpg`,
    backUrl: `/cards/back/${card.id}.jpg`,
  };
  await writeFile(path.join(detailRoot, `${card.id}.json`), `${JSON.stringify(detail)}\n`);
  await sharp(path.join(publicRoot, "front", `${card.id}.jpg`))
    .resize({ width: 320, withoutEnlargement: true })
    .webp({ quality: 84, effort: 5 })
    .toFile(path.join(thumbnailRoot, `${card.id}.webp`));
}));

console.log(`Generated ${index.cardCount} card details and thumbnails.`);
