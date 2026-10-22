import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { baseGameAncientOnes, validateAncientOneContent, type AncientOneData } from "../src/ancient-ones.js";
import { baseGameMonsters } from "../src/monsters.js";

const front = { horrorCheck: null, damageCheck: { skill: "strength", modifier: 0, damage: 1 }, beforeStrengthSanityLoss: 1 } as const;
const back = { ...front, beforeStrengthSanityLoss: 2 } as const;
function fixture(): AncientOneData[] {
  const rows = structuredClone(baseGameAncientOnes) as AncientOneData[];
  Object.assign(rows.find(row => row.id === "cthulhu")!.cultist, {
    normalCombat: structuredClone(front), awakenedCombat: structuredClone(back),
    normalEffectIds: ["cthulhu_cultist_pre_strength_sanity_loss_1"], awakenedEffectIds: ["cthulhu_cultist_pre_strength_sanity_loss_2"],
  });
  return rows;
}

describe("verified Cthulhu Cultist combat metadata", () => {
  it("records both printed sides with no Horror and loss before Strength", () => {
    expect(baseGameAncientOnes.find(row => row.id === "cthulhu")!.cultist).toEqual({
      normalToughness: 1, awakenedToughness: 2, normalCombat: front, awakenedCombat: back,
      normalEffectIds: ["cthulhu_cultist_pre_strength_sanity_loss_1"], awakenedEffectIds: ["cthulhu_cultist_pre_strength_sanity_loss_2"],
    });
  });
  it("accepts canonical typed profiles at the actual catalog validation boundary", () => {
    expect(() => validateAncientOneContent(fixture())).not.toThrow();
  });
  it("ties verification to the inspected local sheet", () => {
    const expected = "e408dceaf95bc679579b1e40d30bb688191ad06be80925d6efab24daadb8e77a";
    const cthulhu = baseGameAncientOnes.find(row => row.id === "cthulhu")!;
    expect(cthulhu.sourceSha256).toBe(expected);
    expect(createHash("sha256").update(readFileSync(new URL("../../../apps/web/public/ancient-ones/cthulhu.jpg", import.meta.url))).digest("hex")).toBe(expected);
  });
  for (const side of ["normal", "awakened"] as const) {
    it.each(["missing", "extra profile key", "extra check key", "Horror", "skill", "modifier", "damage", "missing Damage", "null Damage", "swapped loss", "zero loss", "negative loss", "fraction loss", "NaN loss", "toughness", "old timing"])(`rejects ${side} %s`, corruption => {
      const rows = fixture(), cultist = rows.find(row => row.id === "cthulhu")!.cultist;
      const profileKey = side === "normal" ? "normalCombat" : "awakenedCombat";
      const profile = cultist[profileKey]!;
      if (corruption === "missing") Reflect.deleteProperty(cultist, profileKey);
      if (corruption === "extra profile key") Object.assign(profile, { unsupported: true });
      if (corruption === "extra check key") Object.assign(profile.damageCheck!, { unsupported: true });
      if (corruption === "Horror") Object.assign(profile, { horrorCheck: { skill: "will", modifier: 0, damage: 1 } });
      if (corruption === "skill") Object.assign(profile.damageCheck!, { skill: "will" });
      if (corruption === "modifier") profile.damageCheck!.modifier = -1;
      if (corruption === "damage") profile.damageCheck!.damage = 2;
      if (corruption === "missing Damage") Reflect.deleteProperty(profile, "damageCheck");
      if (corruption === "null Damage") profile.damageCheck = null;
      if (corruption === "swapped loss") profile.beforeStrengthSanityLoss = side === "normal" ? 2 : 1;
      if (corruption === "zero loss") profile.beforeStrengthSanityLoss = 0;
      if (corruption === "negative loss") profile.beforeStrengthSanityLoss = -1;
      if (corruption === "fraction loss") profile.beforeStrengthSanityLoss = 0.5;
      if (corruption === "NaN loss") profile.beforeStrengthSanityLoss = Number.NaN;
      if (corruption === "toughness") { if (side === "normal") cultist.normalToughness = 2; else cultist.awakenedToughness = 1; }
      if (corruption === "old timing") { const key = side === "normal" ? "normalEffectIds" : "awakenedEffectIds"; cultist[key] = [`cthulhu_cultist_pre_will_sanity_loss_${side === "normal" ? 1 : 2}`]; }
      expect(() => validateAncientOneContent(rows)).toThrow();
    });
  }
  it.each(["shub_niggurath", "yog_sothoth", "azathoth"] as const)("refuses to treat %s combat profiles as verified", id => {
    const rows = fixture(); Object.assign(rows.find(row => row.id === id)!.cultist, { normalCombat: structuredClone(front) });
    expect(() => validateAncientOneContent(rows)).toThrow();
  });
  it("keeps live Monster attributes unresolved rather than silently enabling combat", () => {
    expect(baseGameMonsters.find(row => row.id === "monster_cultist")).toMatchObject({
      horrorCheck: "ancient_one", damageCheck: "ancient_one", toughness: "ancient_one",
    });
  });
});
