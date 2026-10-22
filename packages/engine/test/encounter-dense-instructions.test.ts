import { describe, expect, it } from "vitest";
import { createLobby, createDeterministicEngineContext, resolveLocationEncounter, type GameContent, type GameState } from "../src/index.js";
import { parseLocationEncounterInstruction } from "../src/encounter-instructions.js";
const first = "encounter_general_01", second = "encounter_general_02";
const rules: GameContent = {
  locationEncounters: [{ id: first, deck: "general", sections: { city: { kind: "optional", cost: [{ kind: "delay" }], reward: { kind: "effects", effects: [] } } } }],
  map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city" } },
  investigators: { trish_scarborough: { startingLocationId: "arkham", health: 7, sanity: 5, skills: { lore: 1, influence: 1, observation: 1, strength: 1, will: 2 }, startingAssetIds: [], startingClues: 0 } },
  assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};
function fixture(): GameState {
  const state = createLobby(["host", "guest"]); state.phase = "encounter"; state.activePlayerId = "host"; state.leadInvestigatorId = "host";
  Object.assign(state.players[0]!, { investigatorId: "trish_scarborough", locationId: "arkham", health: 7, sanity: 5, maxHealth: 7, maxSanity: 5 });
  state.privateState.deckOrderById["encounter:general"] = [first, second]; return state;
}

const empty = { kind: "effects", effects: [] };
describe("dense generic encounter instructions", () => {
  for (const kind of ["sequence", "choice"] as const) {
    for (const nested of [false, true]) {
      it(`rejects holes in ${nested ? "nested" : "root"} ${kind}`, () => {
        const nodes = Array(2); nodes[1] = empty;
        const instruction = { kind, [kind === "sequence" ? "steps" : "options"]: nodes };
        const source = nested ? { kind: "test", skill: "will", modifier: 0, pass: empty, fail: instruction } : instruction;
        expect(parseLocationEncounterInstruction(source)).toBeUndefined();
        expect(parseLocationEncounterInstruction(JSON.parse(JSON.stringify(source)))).toBeUndefined();
        expect(0 in nodes).toBe(false); expect(nodes[1]).toBe(empty);
      });
    }
    it.each([undefined, null])(`rejects explicit missing node in ${kind}`, missing => {
      expect(parseLocationEncounterInstruction({ kind, [kind === "sequence" ? "steps" : "options"]: [missing] })).toBeUndefined();
    });
    it(`preserves dense ${kind} order without source mutation`, () => {
      const source = { kind, [kind === "sequence" ? "steps" : "options"]: [empty, { kind: "effects", effects: [{ kind: "delay" }] }] };
      const before = structuredClone(source); expect(parseLocationEncounterInstruction(source)).toEqual(source); expect(source).toEqual(before);
    });
  }
  it("rejects entirely sparse choices and preserves empty-sequence semantics", () => {
    expect(parseLocationEncounterInstruction({ kind: "choice", options: Array(2) })).toBeUndefined();
    expect(parseLocationEncounterInstruction({ kind: "choice", options: [] })).toBeUndefined();
    expect(parseLocationEncounterInstruction({ kind: "sequence", steps: [] })).toEqual({ kind: "sequence", steps: [] });
  });
  it("refuses invalid Location content before effects or random input", () => {
    const state = fixture(), before = structuredClone(state), context = createDeterministicEngineContext({ dice: [6], ids: ["retained"] });
    const content: GameContent = { ...rules, locationEncounters: [{ id: first, deck: "general", sections: { city: { kind: "sequence", steps: Array(1) } } }] };
    expect(resolveLocationEncounter(state, "host", "general", content, context)).toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } });
    expect(state).toEqual(before); expect(context.rollDie()).toBe(6); expect(context.createId()).toBe("retained");
  });
});
