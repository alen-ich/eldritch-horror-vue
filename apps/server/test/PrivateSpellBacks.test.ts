import assert from "node:assert/strict";
import { baseGameSpells } from "@eldritch/content";
import { validatePrivateSpellBacks } from "../src/private-spell-back-types.js";
import { baseGameSpellBacks } from "../src/private-spell-backs.js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spellBackSources, spellBackSourceHashes } from "./fixtures/spell-back-sources.js";

function records() {
  return baseGameSpells.map(card => ({
    physicalId: card.id, kind: card.kind, copy: card.copy, printedNumber: 1,
    sheetSlot: card.sheetSlot, sourceBackSheet: card.sourceBackSheet,
    privateAssetPath: `apps/server/private-card-assets/spells/${card.id}.webp`,
    verifiedOn: "2026-10-20", text: "Synthetic source text",
    branches: [{ when: { min: 0, max: null as number | null }, instructions: [{ text: "No additional effect.", tags: ["no_additional_effect"] }] }],
    afterBranches: [{ text: "Then flip this card.", tags: ["flip"] }],
  }));
}

describe("private Spell reverse validation", () => {
  it("accepts complete descriptive records without mutation", () => {
    const value = records(); const before = structuredClone(value);
    assert.doesNotThrow(() => validatePrivateSpellBacks(value)); assert.deepEqual(value, before);
  });
  const malformed: Record<string, (value: ReturnType<typeof records>) => unknown> = {
    missing: value => value.slice(1), extra: value => [...value, value[0]],
    duplicate: value => { value[1] = value[0]!; return value; },
    unknown: value => { value[0]!.physicalId = "spell_unknown_01"; return value; },
    kind: value => { value[0]!.kind = "wither"; return value; },
    copy: value => { value[0]!.copy = 2; return value; },
    slot: value => { value[0]!.sheetSlot = 19; return value; },
    asset: value => { value[0]!.privateAssetPath = "public/back.webp"; return value; },
    emptyText: value => { value[0]!.text = " "; return value; },
    date: value => { value[0]!.verifiedOn = "2026-02-30"; return value; },
    negative: value => { value[0]!.branches[0]!.when.min = -1; return value; },
    fraction: value => { value[0]!.branches[0]!.when.min = 0.5; return value; },
    finiteEnd: value => { Object.assign(value[0]!.branches[0]!.when, { max: 3 }); return value; },
    gap: value => { value[0]!.branches[0]!.when.min = 1; return value; },
    overlap: value => { value[0]!.branches.push(structuredClone(value[0]!.branches[0]!)); return value; },
    reversed: value => { Object.assign(value[0]!.branches[0]!.when, { min: 2, max: 1 }); return value; },
    emptyInstructions: value => { value[0]!.branches[0]!.instructions = []; return value; },
    emptyTags: value => { value[0]!.branches[0]!.instructions[0]!.tags = []; return value; },
    unknownTag: value => { value[0]!.branches[0]!.instructions[0]!.tags = ["execute_magic"]; return value; },
    callback: value => { Object.assign(value[0]!.branches[0]!.instructions[0]!, { execute: () => {} }); return value; },
    unknownField: value => { Object.assign(value[0]!, { hidden: true }); return value; },
    nullBranch: value => { Object.assign(value[0]!, { branches: [null] }); return value; },
  };
  for (const [name, corrupt] of Object.entries(malformed)) it(`rejects ${name}`, () => {
    assert.throws(() => validatePrivateSpellBacks(corrupt(records())));
  });
  for (const value of [null, {}, [null], "invalid"]) it(`rejects malformed root ${JSON.stringify(value)}`, () => {
    assert.throws(() => validatePrivateSpellBacks(value));
  });
});

describe("scan-verified Spell reverse catalog", () => {
  it("pins the visually inspected source sheets and 20 private crops", () => {
    assert.equal(Object.keys(spellBackSourceHashes).length, 22);
    for (const [path, hash] of Object.entries(spellBackSourceHashes)) {
      assert.equal(createHash("sha256").update(readFileSync(new URL(`../../../${path}`, import.meta.url))).digest("hex"), hash, path);
    }
  });
  it("validates all 20 exact physical copies", () => {
    validatePrivateSpellBacks(baseGameSpellBacks);
  });
  for (const [slot, [printedNumber, title, body]] of spellBackSources.entries()) {
    const front = baseGameSpells[slot]!;
    it(`matches visually verified source for ${front.id}`, () => {
      const card = baseGameSpellBacks.find(card => card.physicalId === front.id);
      assert.ok(card);
      assert.equal(card.printedNumber, printedNumber);
      assert.equal(card.sheetSlot, slot);
      assert.equal(card.text, `${title}\nResolve the effect based on your test result:\n${body}\nThen flip this card.\n${printedNumber}`);
      assert.deepEqual(card.afterBranches, [{ text: "Then flip this card.", tags: ["flip"] }]);
      // Source labels and branch order are checked independently of the validator.
      const expected = body.split("\n").map(line => {
        const [label, text] = line.split(": ", 2);
        const [min, max] = label!.replace("+", "").split("–").map(Number);
        return { when: { min, max: label!.includes("+") ? null : max ?? min }, text };
      });
      assert.deepEqual(card.branches.map(branch => ({ when: branch.when, text: branch.instructions.map(i => i.text).join(" ") })), expected);
    });
  }
  it("keeps both distinct reverse outcomes of every kind", () => {
    for (const kind of new Set(baseGameSpells.map(card => card.kind))) {
      const pair = baseGameSpellBacks.filter(card => card.kind === kind);
      assert.equal(pair.length, 2); assert.notEqual(pair[0]!.text, pair[1]!.text);
    }
  });
});

