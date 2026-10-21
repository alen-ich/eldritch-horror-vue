import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { baseGameSpellBacks } from "../src/private-spell-backs.js";
import { assertNoPrivateSpellBackData, assertPublicSpellImportBoundary } from "../src/spell-back-privacy.js";
import { verifySpellBackBuild } from "../scripts/verify-spell-back-privacy.js";

describe("Spell reverse privacy checks", () => {
  it("excludes executable physical mappings and browser fixture from public/production entries", () => {
    assert.throws(()=>assertNoPrivateSpellBackData([{path:"leak.js",text:'const feedTheMindByPhysicalId = {spell_feed_the_mind_01:{type:"private"}}'}],baseGameSpellBacks),/Private Spell/);
    const root=fileURLToPath(new URL("../../../",import.meta.url));
    for(const file of ["apps/server/src/index.ts","apps/server/src/app.config.ts"]){
      assert.doesNotMatch(readFileSync(path.join(root,file),"utf8"),/test\/fixtures|spell-casting-server|SpellCastingFixtureRoom/);
    }
  });
  it("rejects private reverse bytes copied under ordinary public filenames", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "spell-build-"));
    try {
      mkdirSync(path.join(dir, "apps/web/.output/public/cards/spells"), { recursive: true });
      mkdirSync(path.join(dir, "apps/web/public/cards/spells"), { recursive: true });
      const root = new URL("../../../", import.meta.url);
      const publicPath = path.join(dir, "apps/web/public/cards/spells/spell_wither_01.webp");
      writeFileSync(publicPath, readFileSync(new URL("apps/web/public/cards/spells/spell_wither_01.webp", root)));
      assert.doesNotThrow(() => verifySpellBackBuild(dir));
      const reverse = readFileSync(new URL("apps/server/private-card-assets/spells/spell_wither_01.webp", root));
      writeFileSync(publicPath, reverse);
      assert.throws(() => verifySpellBackBuild(dir), /Private reverse asset/);
      rmSync(publicPath);
      writeFileSync(path.join(dir, "apps/web/.output/public/cards/spells/renamed-image.webp"), reverse);
      assert.throws(() => verifySpellBackBuild(dir), /Private reverse asset/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  const hidden = baseGameSpellBacks[0]!.branches[0]!.instructions[0]!.text;
  for (const text of [hidden, JSON.stringify(hidden), hidden.replace(/./g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`), "private-card-assets/spells/spell_wither_02.webp", 'const x={physicalId:"spell_wither_02",printedNumber:2}', 'import("./private-spell-backs.js")']) {
    it("rejects hidden content without printing the secret", () => {
      assert.throws(() => assertNoPrivateSpellBackData([{ path: "test.js", text }], baseGameSpellBacks), error => {
        assert.ok(error instanceof Error); assert.ok(error.message.includes("test.js")); assert.ok(!error.message.includes(hidden)); return true;
      });
    });
  }
  it("allows canonical public fronts and unrelated Spell metadata", () => {
    assert.doesNotThrow(() => assertNoPrivateSpellBackData([{ path: "front.js", text: JSON.stringify({ id: "spell_wither", frontImageUrl: "/cards/spells/spell_wither_01.webp", backTextStatus: "verified" }) }], baseGameSpellBacks));
  });
  it("detects a transitive public barrel reaching a private module", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "spell-imports-"));
    try {
      mkdirSync(path.join(dir, "private"));
      writeFileSync(path.join(dir, "entry.ts"), 'export * from "./barrel.js";');
      writeFileSync(path.join(dir, "barrel.ts"), 'export * from "./private/private-spell-backs.js";');
      writeFileSync(path.join(dir, "private/private-spell-backs.ts"), 'export const secret = 1;');
      assert.throws(() => assertPublicSpellImportBoundary([path.join(dir, "entry.ts")], dir), /Private Spell import/);
      writeFileSync(path.join(dir, "barrel.ts"), 'export const front = 1;');
      assert.doesNotThrow(() => assertPublicSpellImportBoundary([path.join(dir, "entry.ts")], dir));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it("keeps real web, shared content and protocol import graphs public", () => {
    const root = fileURLToPath(new URL("../../../", import.meta.url));
    assertPublicSpellImportBoundary([path.join(root, "apps/web/app"), path.join(root, "apps/web/nuxt.config.ts"), path.join(root, "packages/content/src/index.ts"), path.join(root, "packages/protocol/src/index.ts")], root);
  });
});
