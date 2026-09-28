import { describe, expect, it } from "vitest";
import { resolveStandardCombat, type StandardCombatInput } from "../src/combat.js";

const base: StandardCombatInput = {
  will: 3, strength: 3, currentHealth: 5, currentSanity: 5,
  monsterDamage: 0, monsterToughness: 2,
  horrorCheck: { modifier: 0, damage: 2 },
  damageCheck: { modifier: -1, damage: 2 },
};

function dice(...results: number[]): () => number {
  const queue = [...results];
  return () => {
    const result = queue.shift();
    if (result === undefined) throw new Error("Unexpected die roll.");
    return result;
  };
}

describe("standard Monster combat", () => {
  it("resolves Will before Strength and applies simultaneous Health loss", () => {
    const result = resolveStandardCombat({ ...base, currentHealth: 1 }, dice(5, 2, 1, 6, 5));
    expect(result).toMatchObject({
      horrorTest: { dice: [5, 2, 1], successes: 1 },
      strengthTest: { dice: [6, 5], successes: 2 },
      sanityLost: 1, healthLost: 0, monsterHealthLost: 2,
      investigatorDefeated: false, monsterDefeated: true,
    });
  });

  it("keeps Monster damage even when the investigator loses the last Health simultaneously", () => {
    const result = resolveStandardCombat({ ...base, currentHealth: 1, damageCheck: { modifier: -2, damage: 2 } }, dice(6, 6, 6, 5));
    expect(result).toMatchObject({ healthLost: 1, monsterHealthLost: 1, investigatorDefeated: true, monsterDefeated: false });
  });

  it("stops before Strength when horror defeats the investigator", () => {
    const result = resolveStandardCombat({ ...base, currentSanity: 1 }, dice(1, 1, 1));
    expect(result).toMatchObject({ sanityLost: 1, healthLost: 0, monsterHealthLost: 0, investigatorDefeated: true });
    expect(result.strengthTest).toBeUndefined();
  });

  it("skips absent tests and leaves a surviving Monster's partial damage in place", () => {
    const result = resolveStandardCombat({ ...base, horrorCheck: null, monsterDamage: 1, monsterToughness: 4 }, dice(5, 1));
    expect(result.horrorTest).toBeUndefined();
    expect(result).toMatchObject({ sanityLost: 0, monsterHealthLost: 1, monsterDefeated: false });
  });

  it("applies only the highest item bonus and a minimum one-die pool", () => {
    const result = resolveStandardCombat({ ...base, horrorCheck: null, damageCheck: { modifier: -9, damage: 1 }, strengthItemBonuses: [1, 3] }, dice(5));
    expect(result.strengthTest).toMatchObject({ dice: [5], successes: 1 });
  });

  it("rejects invalid or defeated inputs before rolling", () => {
    expect(() => resolveStandardCombat({ ...base, currentHealth: 0 }, dice())).toThrow(/defeated/);
    expect(() => resolveStandardCombat({ ...base, monsterToughness: 0 }, dice())).toThrow(/monsterToughness/);
    expect(() => resolveStandardCombat(base, dice(7))).toThrow(/combat die/);
  });
});
