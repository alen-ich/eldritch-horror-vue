import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, executeCommand, projectPublicState, resolveResearchEncounter, type GameContent, type GameState } from "../src/index.js";
import { validateResearchContinuationState } from "../src/research-continuation-integrity.js";

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


function pending(): GameState {
  const state = fixture(); state.currentLocationEncounterCardId = first;
  state.pendingLocationEncounter = { playerId: "host", cardId: first, deck: "research_azathoth", queue: [{ kind: "effects", effects: [{ kind: "collect_encountered_clue", markerId: "chosen" }] }], dice: [], successes: 0, researchMarkerBinding: { markerId: "chosen", clueId: "clue_a" } };
  return state;
}
describe("Research original marker binding", () => {
  it("captures selection privately on actual draw and JSON resume", () => {
    const result = resolveResearchEncounter(fixture(), "host", "chosen", rules, createDeterministicEngineContext({ dice: [1, 1], ids: ["test", "choice"] }));
    if (!result.ok) throw new Error(result.error.code);
    expect(result.state.pendingLocationEncounter?.researchMarkerBinding).toEqual({ markerId: "chosen", clueId: "clue_a" });
    expect(validateResearchContinuationState(JSON.parse(JSON.stringify(result.state)), rules)).toBeUndefined();
    expect(JSON.stringify(projectPublicState(result.state))).not.toMatch(/researchMarkerBinding|clue_a/);
  });
  it.each(["redirect", "nested", "token", "missing marker", "unknown token", "empty", "null", "foreign family"])("rejects %s before effects and RNG", kind => {
    const state = pending(), p = state.pendingLocationEncounter!;
    if (kind === "redirect") p.queue = [{ kind: "effects", effects: [{ kind: "collect_encountered_clue", markerId: "secret_redirect" }] }];
    if (kind === "nested") p.queue = [{ kind: "test", skill: "will", modifier: 0, pass: empty, fail: { kind: "optional", cost: [], reward: { kind: "effects", effects: [{ kind: "relocate_encountered_clue", markerId: "secret_redirect", destination: "nearest_sea" }] } } }];
    if (kind === "token") state.privateState.tokenPoolById["board_clue:chosen"] = ["clue_b"];
    if (kind === "missing marker") state.boardClues = [];
    if (kind === "unknown token") p.researchMarkerBinding!.clueId = "secret_token";
    if (kind === "empty") p.researchMarkerBinding!.markerId = "";
    if (kind === "null") Reflect.set(p, "researchMarkerBinding", null);
    if (kind === "foreign family") { p.deck = "general"; p.cardId = state.currentLocationEncounterCardId = "encounter_general_01"; }
    const before = structuredClone(state), context = createDeterministicEngineContext({ dice: [6] });
    const result = executeCommand(state, "host", { type: "END_TURN" }, rules, context);
    expect(result).toMatchObject({ ok: false, error: { code: "ENCOUNTER_CONTENT_MISSING" } });
    expect(JSON.stringify(result)).not.toMatch(/secret_|clue_a|chosen/); expect(state).toEqual(before); expect(context.rollDie()).toBe(6);
  });
  it("allows relocation, collected marker with no remaining references, and old unbound snapshots", () => {
    const state = pending(); state.boardClues![0]!.locationId = "london";
    expect(validateResearchContinuationState(state, rules)).toBeUndefined();
    state.boardClues = []; state.pendingLocationEncounter!.queue = [];
    expect(validateResearchContinuationState(state, rules)).toBeUndefined();
    delete state.pendingLocationEncounter!.researchMarkerBinding;
    expect(validateResearchContinuationState(state, rules)).toBeUndefined();
  });
});
