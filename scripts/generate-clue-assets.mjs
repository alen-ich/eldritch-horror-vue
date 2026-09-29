import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const archive = path.join(root, "source-assets", "clues", "Images (2).rar");
const output = path.join(root, "apps", "web", "public", "tokens", "clues");
const expectedSha256 = "e8c4a62aac0fbab33aa2f3393ab4b32ab033bcad7e780a7177b49407b9a895fc";

// Visually verified against the 36 individual location faces in the supplied archive.
// This order is the archive's lexicographically sorted JPEG filename order.
const locationsBySourceOrder = [
  "space_16", "tokyo", "space_13", "space_15", "space_3", "space_14",
  "sydney", "space_18", "space_21", "tunguska", "space_10", "the_heart_of_africa",
  "arkham", "space_12", "space_5", "antarctica", "space_2", "space_7",
  "rome", "space_17", "space_9", "buenos_aires", "istanbul", "space_19",
  "space_1", "space_4", "space_6", "san_francisco", "london", "the_himalayas",
  "shanghai", "space_8", "the_pyramids", "space_11", "the_amazon", "space_20",
];

const hash = createHash("sha256").update(await readFile(archive)).digest("hex");
if (hash !== expectedSha256) throw new Error("Clue archive changed; reverify the scan-to-location mapping.");
if (new Set(locationsBySourceOrder).size !== 36) throw new Error("Clue scan mapping must cover 36 distinct board spaces.");

const temporary = await mkdtemp(path.join(os.tmpdir(), "eldritch-clues-"));
try {
  execFileSync("bsdtar", ["-xf", archive, "-C", temporary]);
  const files = (await readdir(temporary)).filter(file => file.endsWith(".jpg")).sort();
  if (files.length !== 36) throw new Error(`Expected 36 Clue scans, found ${files.length}.`);
  await mkdir(output, { recursive: true });
  for (const [index, locationId] of locationsBySourceOrder.entries()) {
    await sharp(path.join(temporary, files[index]))
      .extract({ left: 0, top: 0, width: 256, height: 256 })
      .webp({ quality: 90, effort: 5 })
      .toFile(path.join(output, `${locationId}.webp`));
  }
  await sharp(path.join(temporary, files[0]))
    .extract({ left: 0, top: 256, width: 288, height: 256 })
    .resize(256, 256)
    .webp({ quality: 90, effort: 5 })
    .toFile(path.join(output, "back.webp"));
} finally {
  await rm(temporary, { recursive: true, force: true });
}

console.log("Generated 36 base-game Clue location faces and one shared back.");
