import { describe, expect, it } from "vitest";
import { baseGameScannedLocationEncounters } from "../src/location-encounters.js";
import { baseGameLocationEncounterRules, locationEncounterRule, type EncounterInstruction } from "../src/location-encounter-rules.js";

function inspect(node: EncounterInstruction): void {
  switch (node.kind) {
    case "effects":
      for (const effect of node.effects) {
        if ("amount" in effect) expect(Number.isInteger(effect.amount)).toBe(true);
      }
      break;
    case "sequence":
      expect(node.steps.length).toBeGreaterThan(0);
      node.steps.forEach(inspect);
      break;
    case "choice":
      expect(node.options.length).toBeGreaterThan(1);
      node.options.forEach(inspect);
      break;
    case "optional":
      node.cost.forEach(effect => { if ("amount" in effect) expect(Number.isInteger(effect.amount)).toBe(true); });
      inspect(node.reward);
      break;
    case "test":
      expect(Number.isInteger(node.modifier)).toBe(true);
      inspect(node.pass);
      inspect(node.fail);
      break;
  }
}

describe("base-game location encounter mechanical transcriptions", () => {
  it("covers every scanned card and exactly its three printed sections", () => {
    expect(baseGameLocationEncounterRules).toHaveLength(36);
    expect(new Set(baseGameLocationEncounterRules.map(card => card.id)).size).toBe(36);
    for (const scan of baseGameScannedLocationEncounters) {
      const rule = baseGameLocationEncounterRules.find(card => card.id === scan.id);
      expect(rule).toBeDefined();
      expect(rule?.deck).toBe(scan.deck);
      expect(rule?.number).toBe(scan.number);
      expect(Object.keys(rule?.sections ?? {})).toEqual(scan.sections);
      for (const section of scan.sections) inspect(rule!.sections[section]!);
    }
  });

  it("preserves ordered costs, tests, and outcomes for representative cards", () => {
    expect(locationEncounterRule("encounter_america_01", "arkham")).toMatchObject({
      kind: "sequence",
      steps: [
        { kind: "effects", effects: [{ kind: "spell", trait: "incantation", amount: 1 }] },
        { kind: "test", skill: "lore", modifier: 0, fail: { effects: [{ kind: "condition", condition: "hallucinations" }] } },
      ],
    });
    expect(locationEncounterRule("encounter_europe_07", "rome")).toMatchObject({
      kind: "optional",
      reward: { kind: "sequence", steps: [
        { effects: [{ kind: "improve", skill: "chosen" }] },
        { kind: "test", skill: "will", fail: { effects: [{ kind: "condition", condition: "cursed" }] } },
      ] },
    });
    expect(locationEncounterRule("encounter_asia_australia_03", "tokyo")).toEqual({
      kind: "effects",
      effects: [
        { kind: "monster_move", target: "chosen_monster", destination: "investigator_space", nonEpic: true },
        { kind: "monster_encounter", target: "moved_monster" },
      ],
    });
  });

  it("does not expose a section from another deck", () => {
    expect(locationEncounterRule("encounter_america_01", "tokyo")).toBeUndefined();
    expect(locationEncounterRule("encounter_missing_01", "city")).toBeUndefined();
  });
});
