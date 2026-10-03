import { expect, it } from "vitest";
import { baseGameOtherWorldEncounterRules, validateOtherWorldEncounterContent } from "../src/other-world-encounter-rules.js";
import { baseGameScannedTokenEncounters } from "../src/token-encounters.js";

it("links thirteen mechanical transcriptions to the existing base-only scans", () => {
  expect(baseGameOtherWorldEncounterRules.map(card => card.number)).toEqual([1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14]);
  for (const card of baseGameOtherWorldEncounterRules) expect(baseGameScannedTokenEncounters.find(scan => scan.id === card.id)).toMatchObject({ sourceScan: card.sourceScan, sourceCellIndex: card.sourceCellIndex, deck: "other_world" });
  expect(baseGameScannedTokenEncounters.filter(card => card.deck === "other_world")).toHaveLength(24);
});
it("preserves card 14's no-test Clue choice, Will/Strength closure and simultaneous failure damage", () => {
  expect(baseGameOtherWorldEncounterRules[12]!.sections.initial).toEqual({ kind: "optional", cost: [{ kind: "clues", amount: -1 }],
    reward: { kind: "test", skill: "will", modifier: 0, pass: { kind: "effects", effects: [{ kind: "close_encountered_gate" }] }, fail: { kind: "effects", effects: [{ kind: "sanity", amount: -1 }] } },
    decline: { kind: "test", skill: "strength", modifier: 0, pass: { kind: "effects", effects: [{ kind: "close_encountered_gate" }] }, fail: { kind: "effects", effects: [{ kind: "health", amount: -1 }, { kind: "sanity", amount: -1 }] } } });
});
it("preserves card 13's Will and distinct Lore closure, Delay and Sanity branches", () => {
  expect(baseGameOtherWorldEncounterRules[11]!.sections.initial).toEqual({ kind: "test", skill: "will", modifier: 0,
    pass: { kind: "test", skill: "lore", modifier: 0, pass: { kind: "effects", effects: [{ kind: "close_encountered_gate" }] }, fail: { kind: "effects", effects: [{ kind: "delay" }] } },
    fail: { kind: "test", skill: "lore", modifier: -1, pass: { kind: "effects", effects: [{ kind: "close_encountered_gate" }] }, fail: { kind: "effects", effects: [{ kind: "sanity", amount: -3 }] } } });
});
it("preserves card 12's Observation/Lore closure or Paranoia and Delay-for-Sanity avoidance", () => {
  expect(baseGameOtherWorldEncounterRules[10]!.sections.initial).toEqual({ kind: "test", skill: "observation", modifier: 0,
    pass: { kind: "test", skill: "lore", modifier: 0, pass: { kind: "effects", effects: [{ kind: "close_encountered_gate" }] }, fail: { kind: "effects", effects: [{ kind: "condition", condition: "paranoia" }] } },
    fail: { kind: "optional", cost: [{ kind: "delay" }], reward: { kind: "effects", effects: [] }, decline: { kind: "effects", effects: [{ kind: "sanity", amount: -2 }] } } });
});
it("preserves card 11's Lore/Will closure or Delay and Clue-for-Amnesia avoidance", () => {
  expect(baseGameOtherWorldEncounterRules[9]!.sections.initial).toEqual({ kind: "test", skill: "lore", modifier: 0,
    pass: { kind: "test", skill: "will", modifier: 0, pass: { kind: "effects", effects: [{ kind: "close_encountered_gate" }] }, fail: { kind: "effects", effects: [{ kind: "delay" }] } },
    fail: { kind: "optional", cost: [{ kind: "clues", amount: -1 }], reward: { kind: "effects", effects: [] }, decline: { kind: "effects", effects: [{ kind: "condition", condition: "amnesia" }] } } });
});
it("preserves Yuggoth's Influence/Lore tests and distinct one- and two-Sanity losses", () => {
  expect(baseGameOtherWorldEncounterRules[8]!.sections.initial).toEqual({ kind: "test", skill: "influence", modifier: 0,
    pass: { kind: "test", skill: "lore", modifier: 0, pass: { kind: "effects", effects: [{ kind: "close_encountered_gate" }] }, fail: { kind: "effects", effects: [{ kind: "sanity", amount: -1 }] } },
    fail: { kind: "optional", cost: [{ kind: "clues", amount: -1 }], reward: { kind: "effects", effects: [] }, decline: { kind: "effects", effects: [{ kind: "sanity", amount: -2 }] } } });
});
it("preserves card 9's conditional Lore closure and spend-a-Clue Hallucinations avoidance", () => {
  expect(baseGameOtherWorldEncounterRules[7]!.sections.initial).toEqual({ kind: "test", skill: "will", modifier: 0,
    pass: { kind: "test", skill: "lore", modifier: 0, pass: { kind: "effects", effects: [{ kind: "close_encountered_gate" }] }, fail: { kind: "effects", effects: [{ kind: "health", amount: -2 }] } },
    fail: { kind: "optional", cost: [{ kind: "clues", amount: -1 }], reward: { kind: "effects", effects: [] }, decline: { kind: "effects", effects: [{ kind: "condition", condition: "hallucinations" }] } } });
});
it("preserves card 8's Will, conditional Lore closure/Health loss and Strength/Amnesia branch", () => {
  expect(baseGameOtherWorldEncounterRules[6]!.sections.initial).toEqual({ kind: "test", skill: "will", modifier: 0,
    pass: { kind: "test", skill: "lore", modifier: 0, pass: { kind: "effects", effects: [{ kind: "close_encountered_gate" }] }, fail: { kind: "effects", effects: [{ kind: "health", amount: -2 }] } },
    fail: { kind: "test", skill: "strength", modifier: 0, pass: { kind: "effects", effects: [] }, fail: { kind: "effects", effects: [{ kind: "condition", condition: "amnesia" }] } } });
});
it("preserves Dreamlands' Initial-only Clue bonus and ordered failure effects", () => {
  expect(baseGameOtherWorldEncounterRules[5]!.sections.initial).toMatchObject({ skill: "will", modifier: -1, diceBonus: "held_clues",
    pass: { skill: "strength", modifier: 0, pass: { effects: [{ kind: "close_encountered_gate" }] }, fail: { effects: [{ kind: "health", amount: -2 }, { kind: "delay" }] } },
    fail: { effects: [{ kind: "delay" }, { kind: "condition", condition: "hallucinations" }] } });
});
it("preserves The Past's offer-before-closure and failed Strength Health consequence", () => {
  expect(baseGameOtherWorldEncounterRules[4]!.sections.initial).toMatchObject({ skill: "influence", modifier: -1,
    pass: { steps: [{ kind: "optional", cost: [{ kind: "delay" }], reward: { effects: [{ kind: "clues", amount: 2 }] } }, { effects: [{ kind: "close_encountered_gate" }] }] },
    fail: { skill: "strength", modifier: 0, pass: { effects: [] }, fail: { effects: [{ kind: "health", amount: -6 }] } } });
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
