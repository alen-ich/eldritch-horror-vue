import { describe, expect, it } from "vitest";
import { calculateDicePool, countTestSuccesses } from "../src/skill-tests.js";

describe("calculateDicePool", () => {
  it.each(["lore", "influence", "observation", "strength", "will"] as const)("calculates a %s test", (skill) => {
    expect(calculateDicePool({ skill, baseSkill: 3 })).toMatchObject({ skill, dicePool: 3 });
  });

  it("combines improvements, modifiers, the highest Item bonus, and stacking non-Item bonuses", () => {
    expect(calculateDicePool({
      skill: "strength",
      baseSkill: 2,
      improvement: 1,
      modifier: -2,
      itemBonuses: [1, 3, 2],
      otherBonuses: [1, 2],
    })).toEqual({
      skill: "strength",
      baseSkill: 2,
      improvement: 1,
      modifier: -2,
      itemBonus: 3,
      otherBonus: 3,
      dicePool: 7,
    });
  });

  it("rolls at least one die even when the modified pool is zero or negative", () => {
    expect(calculateDicePool({ skill: "lore", baseSkill: 1, modifier: -5 }).dicePool).toBe(1);
  });
});

describe("countTestSuccesses", () => {
  it("counts 5 and 6 as successes at the normal threshold", () => {
    expect(countTestSuccesses([1, 4, 5, 6])).toBe(2);
  });
});
