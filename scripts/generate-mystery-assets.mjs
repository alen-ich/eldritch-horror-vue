import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const root = process.cwd();
const sourceRoot = path.join(root, "source-assets", "mysteries");
const outputRoot = path.join(root, "apps", "web", "public", "cards", "mysteries");

const ancientOnes = [
  {
    id: "azathoth", front: "azathoth.jpg", back: "azathoth-back.jpg",
    cards: [
      ["azathoth_the_true_name", 1, 1], ["azathoth_voice_of_azathoth", 1, 2],
      ["azathoth_seed_of_the_daemon_sultan", 2, 1], ["azathoth_the_green_flame", 2, 2],
      ["azathoth_omen_of_devastation", 3, 1], ["azathoth_occult_research", 3, 2],
    ],
  },
  {
    id: "cthulhu", front: "cthulhu.jpg", back: "cthulhu-back.jpg",
    cards: [
      ["cthulhu_the_stars_are_right", 1, 1], ["cthulhu_queen_of_the_deep_ones", 1, 2],
      ["cthulhu_watching_the_stars", 2, 1], ["cthulhu_threatening_seas", 2, 2],
      ["cthulhu_the_deep_ones_attack", 3, 1], ["cthulhu_rlyeh_risen", 3, 2],
    ],
  },
  {
    id: "shub_niggurath", front: "shub-niggurath.jpg", back: "shub-niggurath-back.jpg",
    cards: [
      ["shub_rituals_in_the_wild", 1, 1], ["shub_blasphemy_of_the_black_goat", 1, 2],
      ["shub_nature_of_the_all_mother", 2, 1], ["shub_hour_of_the_moon_lens", 2, 2],
      ["shub_spawn_of_the_black_goat", 3, 1], ["shub_hunting_the_thousand", 3, 2],
    ],
  },
  {
    id: "yog_sothoth", front: "yog-sothoth.jpg", back: "yog-sogoth-back.jpg",
    cards: [
      ["yog_the_beyond_one", 1, 1], ["yog_void_between_worlds", 1, 2],
      ["yog_arcane_understanding", 2, 1], ["yog_the_stone_circles", 2, 2],
      ["yog_where_the_old_ones_broke_through", 3, 1], ["yog_spawn_of_yog_sothoth", 3, 2],
    ],
  },
];

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const ancientOne of ancientOnes) {
  const frontPath = path.join(sourceRoot, ancientOne.front);
  const metadata = await sharp(frontPath).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Missing dimensions for ${ancientOne.front}.`);
  const rotatedWidth = metadata.height;
  const rotatedHeight = metadata.width;

  for (const [id, row, column] of ancientOne.cards) {
    const left = Math.round(((column - 1) * rotatedWidth) / 2);
    const right = Math.round((column * rotatedWidth) / 2);
    const top = Math.round(((row - 1) * rotatedHeight) / 3);
    const bottom = Math.round((row * rotatedHeight) / 3);
    await sharp(frontPath)
      .rotate(270)
      .extract({ left, top, width: right - left, height: bottom - top })
      .webp({ quality: 90, effort: 5 })
      .toFile(path.join(outputRoot, `${id}.webp`));
  }

  await sharp(path.join(sourceRoot, ancientOne.back))
    .rotate(270)
    .webp({ quality: 90, effort: 5 })
    .toFile(path.join(outputRoot, `${ancientOne.id}-back.webp`));
}

console.log("Generated 24 English Mystery fronts and 4 Ancient One backs.");
