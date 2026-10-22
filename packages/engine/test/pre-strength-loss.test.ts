import { describe, expect, it, vi } from "vitest";
import { resolveStandardCombat, type StandardCombatInput } from "../src/combat.js";

// Primitive values from the verified Cthulhu front/back; no content dependency.
const base = {
  will: 3, strength: 2, currentHealth: 3, currentSanity: 4,
  monsterDamage: 0, monsterToughness: 1,
  horrorCheck: null, damageCheck: { modifier: 0, damage: 1 },
};

describe("pre-Strength Sanity loss", () => {
  it.each([-1, 0.5, NaN, Infinity, "1", null])("rejects invalid loss %s before Horror RNG", (loss) => {
    const roll = vi.fn(() => 6);
    const input = { ...base, horrorCheck: { modifier: 0, damage: 1 },
      beforeStrengthSanityLoss: loss } as unknown as StandardCombatInput;
    expect(() => resolveStandardCombat(input, roll)).toThrow(/beforeStrengthSanityLoss/);
    expect(roll).not.toHaveBeenCalled();
  });

  it.each([1, 2])("loses %i Sanity with no Horror test before Strength", (loss) => {
    const roll = vi.fn(() => 5);
    const result = resolveStandardCombat({ ...base, beforeStrengthSanityLoss: loss }, roll);
    expect(result).toMatchObject({ sanityLost: loss, healthLost: 0, monsterHealthLost: 2,
      investigatorDefeated: false, monsterDefeated: true, strengthTest: { dice: [5, 5] } });
    expect(result.horrorTest).toBeUndefined();
    expect(roll).toHaveBeenCalledTimes(2);
  });

  it.each([1, 2, 9])("caps lethal loss %i and stops before any Strength roll", (loss) => {
    const roll = vi.fn(() => 6);
    const result = resolveStandardCombat({ ...base, currentSanity: 1, beforeStrengthSanityLoss: loss }, roll);
    expect(result).toMatchObject({ sanityLost: 1, healthLost: 0, monsterHealthLost: 0,
      investigatorDefeated: true, monsterDefeated: false });
    expect(result.strengthTest).toBeUndefined();
    expect(roll).not.toHaveBeenCalled();
  });

  it("adds Horror loss before the pre-Strength loss and stops at remaining Sanity", () => {
    const roll = vi.fn(() => 1);
    const result = resolveStandardCombat({ ...base, currentSanity: 3,
      horrorCheck: { modifier: 0, damage: 2 }, beforeStrengthSanityLoss: 2 }, roll);
    expect(result).toMatchObject({ sanityLost: 3, investigatorDefeated: true, horrorTest: { dice: [1, 1, 1] } });
    expect(result.strengthTest).toBeUndefined();
    expect(roll).toHaveBeenCalledTimes(3);
  });

  it("preserves Horror and Strength results when both losses are survived", () => {
    const rolls = [5, 1, 1, 6, 1];
    const result = resolveStandardCombat({ ...base,
      horrorCheck: { modifier: 0, damage: 2 }, beforeStrengthSanityLoss: 1 }, () => rolls.shift()!);
    expect(result).toMatchObject({ sanityLost: 2, horrorTest: { successes: 1 }, strengthTest: { dice: [6, 1], successes: 1 } });
    expect(rolls).toEqual([]);
  });

  it("does not trigger when there is no Strength check", () => {
    const roll = vi.fn(() => 1);
    expect(resolveStandardCombat({ ...base, damageCheck: null, beforeStrengthSanityLoss: 9 }, roll))
      .toMatchObject({ sanityLost: 0, investigatorDefeated: false });
    expect(roll).not.toHaveBeenCalled();
  });

  it("preserves simultaneous Health and Monster damage after surviving Sanity loss", () => {
    const rolls = [5, 1];
    const result = resolveStandardCombat({ ...base, currentHealth: 1,
      damageCheck: { modifier: 0, damage: 2 }, beforeStrengthSanityLoss: 1 }, () => rolls.shift()!);
    expect(result).toMatchObject({ sanityLost: 1, healthLost: 1, monsterHealthLost: 1,
      investigatorDefeated: true, monsterDefeated: true });
  });

  it("keeps default/zero results identical and does not mutate frozen input", () => {
    const input = Object.freeze({ ...base, damageCheck: Object.freeze({ ...base.damageCheck }) });
    const before = structuredClone(input);
    const implicit = resolveStandardCombat(input, () => 5);
    expect(resolveStandardCombat({ ...input, beforeStrengthSanityLoss: 0 }, () => 5)).toEqual(implicit);
    expect(input).toEqual(before);
  });
});
