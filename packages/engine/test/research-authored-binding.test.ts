import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, resolveResearchEncounter, type GameContent, type GameState } from "../src/index.js";
import { bindResearchInstruction } from "../src/research-instructions.js";

const first = "encounter_research_azathoth_01", second = "encounter_research_azathoth_02";
const empty = { kind: "effects", effects: [] };
const rules: GameContent = {
  map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city", london: "city" } },
  investigators: { trish_scarborough: { startingLocationId: "arkham", health: 7, sanity: 5, skills: { lore: 1, influence: 1, observation: 1, strength: 1, will: 2 }, startingAssetIds: [], startingClues: 0 } },
  assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
  clues: [{ id: "clue_a", locationId: "arkham" }, { id: "clue_b", locationId: "london" }],
  researchEncounters: [{ id: first, deck: "research_azathoth", sections: { city: { kind: "test", skill: "will", modifier: 0, pass: empty, fail: empty } } }, { id: second, deck: "research_azathoth", sections: { city: empty } }],
};
function fixture(): GameState {
  return { stateVersion: 2, phase: "encounter", activePlayerId: "host", leadInvestigatorId: "host", ancientOneId: "azathoth", doom: 15, turnNumber: 1,
    players: [{ id: "host", investigatorId: "trish_scarborough", locationId: "arkham", health: 7, sanity: 5, maxHealth: 7, maxSanity: 5, assetIds: [], clues: 1, skillImprovements: {} }, { id: "guest", locationId: "london", assetIds: [], clues: 0, skillImprovements: {} }],
    actionsRemaining: 0, performedActions: [], monsterLocationIds: [], reserveAssetIds: [], assetDiscardIds: [], mysteryProgress: 0, mysteryTarget: 0, completedMysteryIds: [],
    boardClues: [{ id: "chosen", locationId: "arkham" }],
    privateState: { deckOrderById: { "encounter:research_azathoth": [first, second] }, tokenPoolById: { clues: [], clue_discard: [], "board_clue:chosen": ["clue_a"], "held_clues:host": ["clue_b"], "held_clues:guest": [] } },
  };
}

const wrappers: Record<string, (node: unknown) => unknown> = {
  root: node => node,
  sequence: node => ({ kind: "sequence", steps: [empty, node] }),
  test: node => ({ kind: "test", skill: "will", modifier: 0, pass: empty, fail: node }),
  optional: node => ({ kind: "optional", cost: [{ kind: "delay" }], reward: node }),
  ambush: node => ({ kind: "ambush", monsterId: "monster_deep_one", defeated: empty, notDefeated: node }),
};
describe("Research authored binding boundary", () => {
  for (const kind of ["collect_encountered_clue", "relocate_encountered_clue"]) {
    for (const [name, wrap] of Object.entries(wrappers)) {
      it(`rejects runtime ${kind} in ${name}`, () => {
        const source = wrap({ kind: "effects", effects: [{ kind, markerId: "another", destination: "nearest_sea" }] });
        const before = structuredClone(source);
        expect(bindResearchInstruction(source, "chosen")).toBeUndefined(); expect(source).toEqual(before);
      });
    }
    it(`rejects runtime ${kind} hidden in optional cost`, () => {
      expect(bindResearchInstruction({ kind: "optional", cost: [{ kind, markerId: "another", destination: "nearest_sea" }], reward: empty }, "chosen")).toBeUndefined();
    });
  }
  it.each(["gain", "relocate"])("binds valid %s to server marker without mutation", operation => {
    const source = { kind: "effects", effects: [{ kind: "encountered_clue", operation, destination: "nearest_sea", markerId: "another" }] };
    const before = structuredClone(source), bound = bindResearchInstruction(source, "chosen");
    expect(bound).toMatchObject({ kind: "effects", effects: [{ kind: operation === "gain" ? "collect_encountered_clue" : "relocate_encountered_clue", markerId: "chosen" }] });
    expect(JSON.stringify(bound)).not.toContain("another"); expect(source).toEqual(before);
  });
  it("rejects nested sparse sequence and its JSON null representation", () => {
    const steps = Array(2); steps[1] = empty;
    const source = wrappers.test!({ kind: "sequence", steps });
    expect(bindResearchInstruction(source, "chosen")).toBeUndefined();
    expect(bindResearchInstruction(JSON.parse(JSON.stringify(source)), "chosen")).toBeUndefined();
  });
  it("rejects authored target override before physical draw or random input", () => {
    const state = fixture(), before = structuredClone(state), context = createDeterministicEngineContext({ dice: [6], ids: ["retained"] });
    const content: GameContent = { ...rules, researchEncounters: [{ id: first, deck: "research_azathoth", sections: { city: { kind: "effects", effects: [{ kind: "collect_encountered_clue", markerId: "chosen" }] } } }] };
    const result = resolveResearchEncounter(state, "host", "chosen", content, context);
    expect(result).toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } });
    expect(JSON.stringify(result)).not.toContain("encounter_research_");
    expect(state).toEqual(before); expect(context.rollDie()).toBe(6); expect(context.createId()).toBe("retained");
  });
});
