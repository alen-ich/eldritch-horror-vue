import { describe, expect, it } from "vitest";
import {
  assertCompleteBaseGameContent,
  baseGameContentReadiness,
  contentFamilyIds,
  incompleteContentFamilies,
  validateContentReadiness,
} from "../src/readiness.js";

describe("base-game content readiness", () => {
  it("inventories every required setup and rules family exactly once", () => {
    expect(baseGameContentReadiness).toHaveLength(contentFamilyIds.length);
    expect(new Set(baseGameContentReadiness.map((entry) => entry.id))).toEqual(new Set(contentFamilyIds));
    expect(() => validateContentReadiness(baseGameContentReadiness)).not.toThrow();
  });

  it("reports all unverified and absent content", () => {
    const spells = baseGameContentReadiness.find(entry => entry.id === "spells")!;
    expect(spells.status).toBe("needs_review");
    expect(spells.notes).toContain("server-private mechanical transcriptions");
    const incomplete = incompleteContentFamilies(baseGameContentReadiness);
    expect(incomplete.map((entry) => entry.id)).not.toContain("ancient_ones");
    expect(incomplete.map((entry) => entry.id)).not.toContain("mysteries");
    expect(incomplete.map((entry) => entry.id)).not.toContain("reference_card_setup");
    expect(incomplete.find((entry) => entry.id === "mythos_cards")?.status).toBe("needs_review");
  });

  it("prevents complete setup while required content is unavailable", () => {
    expect(() => assertCompleteBaseGameContent()).toThrow(/assets \(needs_review\)/);
  });

  it("rejects duplicate or missing inventory families", () => {
    expect(() => validateContentReadiness([
      ...baseGameContentReadiness,
      baseGameContentReadiness[0]!,
    ])).toThrow(/duplicate family IDs/);
    expect(() => validateContentReadiness(baseGameContentReadiness.slice(1))).toThrow(/missing required families: map/);
  });
});
