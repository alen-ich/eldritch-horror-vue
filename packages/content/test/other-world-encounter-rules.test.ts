import { expect, it } from "vitest";
import { baseGameOtherWorldEncounterRules, validateOtherWorldEncounterContent } from "../src/other-world-encounter-rules.js";
import { baseGameScannedTokenEncounters } from "../src/token-encounters.js";

it("links the first two mechanical transcriptions to the existing base-only scans", () => {
  expect(baseGameOtherWorldEncounterRules.map(card => card.number)).toEqual([1, 2]);
  for (const card of baseGameOtherWorldEncounterRules) expect(baseGameScannedTokenEncounters.find(scan => scan.id === card.id)).toMatchObject({ sourceScan: card.sourceScan, sourceCellIndex: card.sourceCellIndex, deck: "other_world" });
  expect(baseGameScannedTokenEncounters.filter(card => card.deck === "other_world")).toHaveLength(24);
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
