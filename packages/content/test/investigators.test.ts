import { describe, expect, it } from "vitest";
import { baseGameInvestigators, skillNames, validateInvestigatorContent } from "../src/index.js";

describe("base game investigator content", () => {
  it("contains the 12 investigators from the source PDF", () => {
    expect(baseGameInvestigators).toHaveLength(12);
    expect(baseGameInvestigators.map(({ name }) => name)).toContain("Akachi Onyele");
    expect(baseGameInvestigators.map(({ name }) => name)).toContain("Trish Scarborough");
  });

  it("preserves the source health, sanity, and balanced skill totals", () => {
    for (const investigator of baseGameInvestigators) {
      expect(investigator.health + investigator.sanity).toBe(12);
      expect(skillNames.reduce((total, skill) => total + investigator.skills[skill], 0)).toBe(13);
    }
  });

  it("structures printed starting Clues", () => {
    expect(baseGameInvestigators.filter(({ startingClues }) => startingClues === 1).map(({ id }) => id)).toEqual([
      "akachi_onyele",
      "jacqueline_fine",
      "jim_culver",
    ]);
    expect(baseGameInvestigators.every(({ startingClues }) => startingClues === 0 || startingClues === 1)).toBe(true);
  });

  it("rejects duplicate investigator IDs", () => {
    expect(() => validateInvestigatorContent([...baseGameInvestigators, baseGameInvestigators[0]!])).toThrow(/duplicate IDs/);
  });

  it("declares only Norman's executable starting front", () => {
    expect(baseGameInvestigators.find(card => card.id === "norman_withers")).toHaveProperty("startingSpellIds", ["spell_feed_the_mind"]);
    expect(baseGameInvestigators.filter(card => card.id !== "norman_withers").every(card => !(card as { startingSpellIds?: string[] }).startingSpellIds?.length)).toBe(true);
  });

  for (const [id, startingSpellIds] of [
    ["norman_withers", ["spell_unknown"]],
    ["norman_withers", ["spell_feed_the_mind", "spell_feed_the_mind"]],
    ["norman_withers", ["spell_wither"]],
    ["lily_chen", ["spell_feed_the_mind"]],
  ] as const) {
    it(`rejects unsupported starting Spell configuration ${id}: ${startingSpellIds.join()}`, () => {
      const changed = baseGameInvestigators.map(card => card.id === id ? { ...card, startingSpellIds } : card);
      expect(() => validateInvestigatorContent(changed)).toThrow();
    });
  }
});
