import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const root = process.cwd();
const sourceRoot = path.join(root, "source-assets", "mysteries");
const outputRoot = path.join(root, "apps", "web", "public", "cards", "mysteries");

const ancientOnes = [
  {
    id: "azathoth",
    strip: "azathoth-1.jpg",
    back: "azathoth-back.jpg",
    stripCards: [
      "azathoth_the_true_name",
      "azathoth_seed_of_the_daemon_sultan",
      "azathoth_omen_of_devastation",
    ],
    singleCards: [],
  },
  {
    id: "cthulhu",
    strip: "cthulhu-2.jpg",
    back: "cthulhu-back.jpg",
    stripCards: [
      "cthulhu_the_stars_are_right",
      "cthulhu_watching_the_stars",
      "cthulhu_the_deep_ones_attack",
    ],
    singleCards: [["cthulhu_rlyeh_risen", "cthulhu-1.jpg"]],
  },
  {
    id: "shub_niggurath",
    strip: "shub-niggurath-2.jpg",
    back: "shub-niggurath-back.jpg",
    stripCards: [
      "shub_rituals_in_the_wild",
      "shub_nature_of_the_all_mother",
      "shub_spawn_of_the_black_goat",
    ],
    singleCards: [["shub_hunting_the_thousand", "shub-niggurath-1.jpg"]],
  },
  {
    id: "yog_sothoth",
    strip: "yog-sogoth-2.jpg",
    back: "yog-sogoth-back.jpg",
    stripCards: [
      "yog_the_beyond_one",
      "yog_arcane_understanding",
      "yog_where_the_old_ones_broke_through",
    ],
    singleCards: [["yog_spawn_of_yog_sothoth", "yog-sogoth-1.jpg"]],
  },
];

const preservedAssetIds = ["azathoth_occult_research"];
const expectedFiles = new Set([
  ...ancientOnes.flatMap(({ id, stripCards, singleCards }) => [
    `${id}-back.webp`,
    ...stripCards.map((cardId) => `${cardId}.webp`),
    ...singleCards.map(([cardId]) => `${cardId}.webp`),
  ]),
  ...preservedAssetIds.map((cardId) => `${cardId}.webp`),
]);

await mkdir(outputRoot, { recursive: true });

for (const file of await readdir(outputRoot)) {
  if (!expectedFiles.has(file)) await rm(path.join(outputRoot, file));
}

for (const cardId of preservedAssetIds) {
  try {
    await sharp(path.join(outputRoot, `${cardId}.webp`)).metadata();
  } catch {
    throw new Error(`${cardId}.webp must be preserved until its replacement source scan is supplied.`);
  }
}

for (const ancientOne of ancientOnes) {
  const stripPath = path.join(sourceRoot, ancientOne.strip);
  const metadata = await sharp(stripPath).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Missing dimensions for ${ancientOne.strip}.`);

  for (const [index, cardId] of ancientOne.stripCards.entries()) {
    const top = Math.round((index * metadata.height) / ancientOne.stripCards.length);
    const bottom = Math.round(((index + 1) * metadata.height) / ancientOne.stripCards.length);
    await sharp(stripPath)
      .extract({ left: 0, top, width: metadata.width, height: bottom - top })
      .webp({ quality: 90, effort: 5 })
      .toFile(path.join(outputRoot, `${cardId}.webp`));
  }

  for (const [cardId, source] of ancientOne.singleCards) {
    await sharp(path.join(sourceRoot, source))
      .webp({ quality: 90, effort: 5 })
      .toFile(path.join(outputRoot, `${cardId}.webp`));
  }

  await sharp(path.join(sourceRoot, ancientOne.back))
    .rotate(270)
    .webp({ quality: 90, effort: 5 })
    .toFile(path.join(outputRoot, `${ancientOne.id}-back.webp`));
}

console.log("Generated 15 supplied English Mystery fronts and 4 Ancient One backs; preserved the existing Occult Research crop.");
