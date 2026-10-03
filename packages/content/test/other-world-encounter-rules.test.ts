import { expect, it } from "vitest";
import { baseGameOtherWorldEncounterRules, validateOtherWorldEncounterContent } from "../src/other-world-encounter-rules.js";
import { baseGameScannedTokenEncounters } from "../src/token-encounters.js";

it("links the first four mechanical transcriptions to the existing base-only scans", () => {
  expect(baseGameOtherWorldEncounterRules.map(card => card.number)).toEqual([1, 2, 3, 4]);
  for (const card of baseGameOtherWorldEncounterRules) expect(baseGameScannedTokenEncounters.find(scan => scan.id === card.id)).toMatchObject({ sourceScan: card.sourceScan, sourceCellIndex: card.sourceCellIndex, deck: "other_world" });
  expect(baseGameScannedTokenEncounters.filter(card => card.deck === "other_world")).toHaveLength(24);
});
it("preserves Lost Carcosa's closure-before-Delay reward and failed Influence Doom consequence", () => {
  expect(baseGameOtherWorldEncounterRules[3]!.sections.initial).toMatchObject({ skill: "lore", modifier: -1,
    pass: { steps: [{ effects: [{ kind: "close_encountered_gate" }] }, { kind: "optional", cost: [{ kind: "delay" }], reward: { effects: [{ kind: "clues", amount: 2 }] } }] },
    fail: { skill: "influence", modifier: 0, pass: { effects: [] }, fail: { effects: [{ kind: "doom_advance", amount: 1 }] } } });
});
it("preserves card 3's Lore modifier, immediate closure, Will reward, and refusal consequences", () => {
  expect(baseGameOtherWorldEncounterRules[2]!.sections.initial).toMatchObject({ skill: "lore", modifier: -1,
    pass: { steps: [{ effects: [{ kind: "close_encountered_gate" }] }, { skill: "will", modifier: 0, pass: { effects: [{ kind: "clues", amount: 1 }] }, fail: { effects: [] } }] },
    fail: { kind: "optional", cost: [{ kind: "clues", amount: -1 }], reward: { effects: [] }, decline: { effects: [{ kind: "sanity", amount: -2 }, { kind: "condition", condition: "paranoia" }] } } });
});
it("retains the unsupported Spell branch and ordered Gate closure before follow-up tests", () => {
  expect(JSON.stringify(baseGameOtherWorldEncounterRules[0])).toContain('"kind":"spell"');
  expect(baseGameOtherWorldEncounterRules[1]!.sections.initial).toMatchObject({ skill: "will", modifier: -1, pass: { steps: [{ effects: [{ kind: "close_encountered_gate" }] }, { skill: "observation", modifier: 0 }] }, fail: { skill: "lore", fail: { effects: [{ kind: "sanity", amount: -6 }] } } });
});
it("rejects duplicate IDs, changed source mappings, and invented mechanics", () => {
  const card = baseGameOtherWorldEncounterRules[0]!;
  expect(() => validateOtherWorldEncounterContent([card, card])).toThrow();
  expect(() => validateOtherWorldEncounterContent([{ ...card, sourceCellIndex: 99 }])).toThrow();
  expect(() => validateOtherWorldEncounterContent([{ ...card, sections: { initial: { kind: "effects", effects: [] } } }])).toThrow();
});
