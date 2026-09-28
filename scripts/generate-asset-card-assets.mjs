import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const root = process.cwd();
const archivePath = path.join(root, "source-assets", "assets", "eldritch_horror_base_game_40_asset_cards.zip");
const outputRoot = path.join(root, "apps", "web", "public", "cards", "assets");
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "eldritch-assets-"));

try {
  execFileSync("unzip", ["-q", archivePath, "-d", temporaryRoot]);
  const files = (await readdir(temporaryRoot)).filter((file) => file.endsWith(".jpg")).sort();
  if (files.length !== 40) throw new Error(`Expected 40 Asset fronts, found ${files.length}.`);

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });

  for (const file of files) {
    const match = file.match(/^\d{2}_([a-z0-9_]+)\.jpg$/);
    if (!match) throw new Error(`Unexpected Asset filename: ${file}.`);
    await sharp(path.join(temporaryRoot, file))
      .webp({ quality: 90, effort: 5 })
      .toFile(path.join(outputRoot, `${match[1]}.webp`));
  }
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

console.log("Generated 40 base-game Asset fronts. The shared back is still pending.");
