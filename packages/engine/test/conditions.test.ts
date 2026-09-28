import { describe, expect, it } from "vitest";
import { conditionSuccessThreshold, resolveBoonBaneGain } from "../src/conditions.js";
import { countTestSuccesses } from "../src/skill-tests.js";

describe("Blessed and Cursed front-side rules", () => {
  it("uses the normal, Blessed, and Cursed success thresholds", () => {
    const dice = [1, 4, 5, 6];
    expect(countTestSuccesses(dice, conditionSuccessThreshold([]))).toBe(2);
    expect(countTestSuccesses(dice, conditionSuccessThreshold(["condition_blessed_01"]))).toBe(3);
    expect(countTestSuccesses(dice, conditionSuccessThreshold(["condition_cursed_02"]))).toBe(1);
  });

  it("ignores unrelated cards and favors Cursed in an inconsistent state", () => {
    expect(conditionSuccessThreshold(["condition_debt_01"])).toBe(5);
    expect(conditionSuccessThreshold(["condition_blessed_01", "condition_cursed_01"])).toBe(6);
  });

  it("discards the opposite condition rather than drawing a new one", () => {
    expect(resolveBoonBaneGain(["condition_cursed_03"], "blessed"))
      .toEqual({ type: "discard_opposite", cardId: "condition_cursed_03" });
    expect(resolveBoonBaneGain(["condition_blessed_02"], "cursed"))
      .toEqual({ type: "discard_opposite", cardId: "condition_blessed_02" });
  });

  it("requires the existing same-kind card to flip, without drawing", () => {
    expect(resolveBoonBaneGain(["condition_blessed_01"], "blessed"))
      .toEqual({ type: "flip_existing", cardId: "condition_blessed_01" });
    expect(resolveBoonBaneGain([], "cursed")).toEqual({ type: "draw_new", kind: "cursed" });
  });
});
