import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { baseGameSpellBacks } from "../src/private-spell-backs.js";
import { assertNoPrivateSpellBackData } from "../src/spell-back-privacy.js";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const reverseHashes = new Set(baseGameSpellBacks.map(card => sha256(readFileSync(path.join(repositoryRoot, card.privateAssetPath)))));

/** Checks both textual records and byte-identical private artwork, regardless of filename. */
export function verifySpellBackBuild(root: string = repositoryRoot): number {
  const output = path.join(root, "apps/web/.output");
  if (!existsSync(output)) throw new Error("Build the web application before checking private Spell data.");
  let checked = 0;
  function scan(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { scan(file); continue; }
      const bytes = readFileSync(file);
      if (reverseHashes.has(sha256(bytes)) || /private-card-assets[\\/]spells|spell_[a-z_]+_0[12]-back\./.test(file)) {
        throw new Error(`Private reverse asset in ${path.relative(root, file)}`);
      }
      if (/\.(?:[cm]?js|json|map|html|css|txt|vue|ts)$/.test(entry.name)) {
        assertNoPrivateSpellBackData([{ path: path.relative(root, file), text: bytes.toString("utf8") }], baseGameSpellBacks);
        checked++;
      }
    }
  }
  scan(output);
  const dist = path.join(root, "apps/web/.nuxt/dist");
  if (existsSync(dist)) scan(dist);
  scan(path.join(root, "apps/web/public"));
  return checked;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Private Spell build boundary passed (${verifySpellBackBuild()} text artifacts checked; reverse image hashes excluded).`);
}
