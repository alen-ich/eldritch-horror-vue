import { describe, expect, it } from "vitest";
import { createLobby, createDeterministicEngineContext, executeCommand, resolveResearchEncounter, type GameContent, type GameState, type EngineContext, type CommandResult } from "../src/index.js";
import { withResearchRandomTransaction } from "../src/research-random.js";

const empty = { kind: "effects", effects: [] };
const rules: GameContent = {
  researchEncounters: [{ id: "encounter_research_azathoth_01", deck: "research_azathoth", sections: { city: { kind: "test", skill: "will", modifier: 0, pass: empty, fail: empty } } }],
  clues: [{ id: "clue_a", locationId: "arkham" }, { id: "clue_b", locationId: "london" }, { id: "clue_c", locationId: "rome" }],
  map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city" } },
  investigators: { trish_scarborough: { startingLocationId: "arkham", health: 7, sanity: 5, skills: { lore: 1, influence: 1, observation: 1, strength: 1, will: 2 }, startingAssetIds: [], startingClues: 0 } },
  assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};
function fixture(clues = 0): GameState {
  const state = createLobby(["host", "guest"]);
  Object.assign(state, { phase: "encounter", ancientOneId: "azathoth", activePlayerId: "host", leadInvestigatorId: "host", actionsRemaining: 0, boardClues: [{ id: "marker", locationId: "arkham" }] });
  Object.assign(state.players[0]!, { investigatorId: "trish_scarborough", locationId: "arkham", health: 7, sanity: 5, maxHealth: 7, maxSanity: 5, clues });
  state.privateState.deckOrderById["encounter:research_azathoth"] = ["encounter_research_azathoth_01", "encounter_research_azathoth_02"];
  state.privateState.tokenPoolById = { "board_clue:marker": ["clue_c"], "held_clues:host": clues ? ["clue_a", "clue_b"] : [], "held_clues:guest": [], clues: clues ? [] : ["clue_a", "clue_b"], clue_discard: [] };
  return state;
}
function accepted(result: CommandResult): GameState {
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}
function draw(state: GameState, context: EngineContext, command: boolean): CommandResult {
  return command ? executeCommand(state, "host", { type: "RESOLVE_RESEARCH_ENCOUNTER", clueId: "marker" }, rules, context)
    : resolveResearchEncounter(state, "host", "marker", rules, context);
}
describe("Research atomic randomness", () => {
  it.each([false, true])("restores partial draw dice (command=%s)", command => {
    const state = fixture(), before = structuredClone(state), context = createDeterministicEngineContext({ dice: [6] });
    expect(draw(state, context, command)).toMatchObject({ ok: false, error: { code: "RANDOM_INPUT_REQUIRED" } });
    expect(state).toEqual(before); expect(context.rollDie()).toBe(6);
  });
  it("restores paid reroll input and state after a later ID exhaustion", () => {
    const state = accepted(draw(fixture(2), createDeterministicEngineContext({ dice: [1, 1], ids: ["test", "choice"] }), false));
    const before = structuredClone(state), context = createDeterministicEngineContext({ dice: [6] });
    expect(executeCommand(state, "host", { type: "RESOLVE_DECISION", decisionId: state.pendingDecision!.id, selectedOptionIds: ["die-0"] }, rules, context))
      .toMatchObject({ ok: false, error: { code: "RANDOM_INPUT_REQUIRED" } });
    expect(state).toEqual(before); expect(state.players[0]!.clues).toBe(2); expect(context.rollDie()).toBe(6);
  });
  it("commits successful draws and rerolls once", () => {
    const context = createDeterministicEngineContext({ dice: [1, 1, 6, 4], ids: ["test", "choice", "reroll"] });
    const state = accepted(draw(fixture(2), context, true));
    const next = accepted(executeCommand(state, "host", { type: "RESOLVE_DECISION", decisionId: state.pendingDecision!.id, selectedOptionIds: ["die-0"] }, rules, context));
    expect(next.activeTest!.dice).toEqual([6, 1]); expect(next.players[0]!.clues).toBe(1); expect(context.rollDie()).toBe(4);
  });
  it("rejects a non-owner without consuming input", () => {
    const state = accepted(draw(fixture(2), createDeterministicEngineContext({ dice: [1, 1], ids: ["test", "choice"] }), false));
    const before = structuredClone(state), context = createDeterministicEngineContext({ dice: [6] });
    expect(executeCommand(state, "guest", { type: "RESOLVE_DECISION", decisionId: state.pendingDecision!.id, selectedOptionIds: ["die-0"] }, rules, context).ok).toBe(false);
    expect(state).toEqual(before); expect(context.rollDie()).toBe(6);
  });
  it("keeps no-checkpoint contexts compatible", () => {
    const context = createDeterministicEngineContext({ dice: [6, 6], ids: ["test"] }); delete context.checkpoint;
    expect(draw(fixture(), context, false).ok).toBe(true);
  });
});

describe("Research random transaction boundary", () => {
  it.each(["failure", "exception"])("restores every retained sequence on %s", outcome => {
    const context = createDeterministicEngineContext({ dice: [6], ids: ["kept"], tokenIndexes: [1], shuffleIndexes: [0] });
    const result = withResearchRandomTransaction(context, () => {
      context.rollDie(); context.createId(); context.drawToken(["a", "b"]); context.shuffle([1, 2]);
      if (outcome === "exception") throw new Error("private random details");
      return { ok: false, error: { code: "ENCOUNTER_CONTENT_MISSING", message: "Missing content." } };
    });
    expect(result).toMatchObject({ ok: false, error: { code: outcome === "exception" ? "RANDOM_INPUT_REQUIRED" : "ENCOUNTER_CONTENT_MISSING" } });
    expect(JSON.stringify(result)).not.toContain("private random details");
    expect(context.rollDie()).toBe(6); expect(context.createId()).toBe("kept");
    expect(context.drawToken(["a", "b"]).token).toBe("b"); expect(context.shuffle([1, 2])).toEqual([2, 1]);
  });
  it("sanitizes exceptions without a checkpoint", () => {
    const context = createDeterministicEngineContext({}); delete context.checkpoint;
    expect(withResearchRandomTransaction(context, () => { throw new Error("secret"); }))
      .toMatchObject({ ok: false, error: { code: "RANDOM_INPUT_REQUIRED" } });
  });
});
