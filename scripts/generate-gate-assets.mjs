import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const root = process.cwd();
const sourceRoot = path.join(root, "source-assets", "gates");
const archivePath = path.join(sourceRoot, "Images.rar");
const outputRoot = path.join(root, "apps", "web", "public", "tokens", "gates");

const baseGameFaces = [
  ["london", "httpssteamusercontentaakamaihdnetugc17839669488901090818049D5BF78A0FB9E21E46BCC2E635373986A596A.jpg"],
  ["tokyo", "httpssteamusercontentaakamaihdnetugc1783966948890109337D4479624FA61672ED52A74244748D6C430A0CDF4.jpg"],
  ["buenos_aires", "httpssteamusercontentaakamaihdnetugc178396694889010946109B2C2EFBED60242D47022D17B2195BCD9D1202E.jpg"],
  ["san_francisco", "httpssteamusercontentaakamaihdnetugc1783966948890109607B7D780391C6348B103F1AECE132C40FD619C3A8A.jpg"],
  ["arkham", "httpssteamusercontentaakamaihdnetugc17839669488901103839DC0301CC0AEA7808D5F1680470FD7B91BBEB8B7.jpg"],
  ["shanghai", "httpssteamusercontentaakamaihdnetugc1783966948890110789B199F395361A485736398B7D10FE3799B9C2EFDA.jpg"],
  ["sydney", "httpssteamusercontentaakamaihdnetugc17839669488901109515825186CBBA7DD3B7556D71E9273B1EFAE219D26.jpg"],
  ["istanbul", "httpssteamusercontentaakamaihdnetugc1783966948890113197D843D1E5A92B28418A18E26B5850888B3A9F942E.jpg"],
  ["rome", "httpssteamusercontentaakamaihdnetugc1783966948890113951FF246246A8417B0A546AF15A1FA5500A4ADA63CC.jpg"],
];

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "eldritch-gates-"));

try {
  execFileSync("bsdtar", ["-xf", archivePath, "-C", temporaryRoot]);
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });

  for (const [id, source] of baseGameFaces) {
    await sharp(path.join(temporaryRoot, source))
      .webp({ quality: 90, effort: 5 })
      .toFile(path.join(outputRoot, `${id}.webp`));
  }

  await sharp(path.join(sourceRoot, "photo_2026-09-28_02-17-49.jpg"))
    .webp({ quality: 90, effort: 5 })
    .toFile(path.join(outputRoot, "back.webp"));
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

console.log("Generated 9 base-game Gate faces and 1 back; excluded 6 expansion Gates.");
