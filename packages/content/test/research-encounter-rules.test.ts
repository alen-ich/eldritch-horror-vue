import { describe, expect, it } from "vitest";
import { baseGameResearchEncounterRules, validateResearchEncounterRules } from "../src/research-encounter-rules.js";
const rules = baseGameResearchEncounterRules.filter(card => card.deck === "research_azathoth");

describe("scan-verified Azathoth Research rules", () => {
  it("covers all eight printed cards and 24 sections without enabling live execution", () => {
    expect(rules.map(rule => rule.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const card of rules) {
      expect(Object.keys(card.sections)).toEqual(["city", "wilderness", "sea"]);
      expect(card.effectStatus).toBe("transcribed_pending_execution");
    }
    expect(() => validateResearchEncounterRules(rules)).not.toThrow();
  });
  it("distinguishes this Clue from additional supply draws and preserves modifiers", () => {
    expect(rules[0]?.sections.city).toMatchObject({ kind: "test", skill: "observation", modifier: -1, pass: { effects: [{ kind: "encountered_clue", operation: "gain" }, { kind: "clues", amount: 1 }] }, fail: { effects: [] } });
    expect(rules[3]?.sections.wilderness).toMatchObject({ pass: { effects: [{ kind: "encountered_clue", operation: "gain" }, { kind: "spawn_clues", amount: 1 }] } });
  });
  it("keeps unconditional collection and damage before later tests", () => {
    expect(rules[1]?.sections.sea).toMatchObject({ kind: "sequence", steps: [{ effects: [{ kind: "encountered_clue", operation: "gain" }] }, { kind: "test", skill: "strength", fail: { effects: [{ kind: "health", amount: -2 }] } }] });
    expect(rules[2]?.sections.wilderness).toMatchObject({ steps: [{ effects: [{ kind: "encountered_clue" }] }, { skill: "will", fail: { effects: [{ kind: "sanity", amount: -6 }] } }] });
    expect(rules[7]?.sections.wilderness).toMatchObject({ steps: [{ effects: [{ kind: "health", amount: -1 }] }, { kind: "test" }] });
    expect(rules[7]?.sections.sea).toMatchObject({ steps: [{ effects: [{ kind: "encountered_clue" }] }, { fail: { effects: [] } }] });
  });
  it("preserves exceptional Omen, Mystery, and optional named Artifact effects", () => {
    expect(rules[0]?.sections.wilderness).toMatchObject({ pass: { effects: [{ kind: "encountered_clue" }, { kind: "omen_move", advanceDoom: false }] } });
    expect(rules[4]?.sections.city).toMatchObject({ fail: { effects: [{ kind: "return_solved_mystery", selection: "random", shuffle: true }] } });
    expect(rules[4]?.sections.sea).toMatchObject({ kind: "optional", cost: [{ kind: "condition", condition: "dark_pact" }], reward: { effects: [{ kind: "encountered_clue" }, { kind: "artifact", id: "artifact_ttka_halot" }] } });
  });
  it("rejects duplicates, expansion numbers, altered outcomes, unknown effects and false executable claims", () => {
    expect(() => validateResearchEncounterRules([rules[0], rules[0]])).toThrow();
    for (const patch of [{ number: 9 }, { effectStatus: "executable" }, { sections: { city: { kind: "effects", effects: [{ kind: "invented" }] }, wilderness: rules[0]?.sections.wilderness, sea: rules[0]?.sections.sea } }, { number: 2 }]) {
      expect(() => validateResearchEncounterRules([{ ...rules[0], ...patch }])).toThrow();
    }
    const changed = structuredClone(rules[0]!);
    changed.sections.city = { kind: "effects", effects: [] };
    expect(() => validateResearchEncounterRules([changed])).toThrow();
  });
});

describe("scan-verified Cthulhu Research rules", () => {
  const cards = baseGameResearchEncounterRules.filter(card => card.deck === "research_cthulhu");
  it("covers all eight cards and preserves every unsupported ambush and named reward", () => {
    expect(cards.map(card => card.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(() => validateResearchEncounterRules(cards)).not.toThrow();
    expect(cards[0]?.sections.sea).toMatchObject({ kind: "optional", decline: { kind: "sequence" } });
    expect(cards[2]?.sections.sea).toMatchObject({ modifier: -1, pass: { effects: [{ kind: "artifact", id: "artifact_grotesque_statue" }] } });
    expect(cards[4]?.sections.sea).toMatchObject({ fail: { kind: "ambush", monsterId: "monster_star_spawn", defeated: { effects: [{ kind: "doom_retreat" }] } } });
    expect(cards[7]?.sections.sea).toMatchObject({ kind: "sequence", steps: [{ effects: [{ kind: "encountered_clue" }, { kind: "sanity", amount: -1 }] }, { kind: "ambush", defeated: { effects: [{ kind: "artifact", id: "artifact_ruby_of_rlyeh" }] } }] });
  });
  it("retains nearest-Sea movement, ordered item loss, and different skill modifiers", () => {
    expect(cards[0]?.sections.city).toMatchObject({ fail: { effects: [{ operation: "relocate", destination: "nearest_sea" }] } });
    expect(cards[5]?.sections.wilderness).toMatchObject({ fail: { effects: [{ kind: "discard_item_assets", amount: 2 }, { operation: "relocate" }] } });
    expect(cards[5]?.sections.sea).toMatchObject({ skill: "influence", modifier: -1 });
    expect(cards[7]?.sections.city).toMatchObject({ skill: "strength", fail: { effects: [{ kind: "health", amount: -1 }, { condition: "detained" }] } });
  });
});
