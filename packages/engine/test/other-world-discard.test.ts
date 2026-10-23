import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, executeCommand, resolveOtherWorldEncounter, type CommandResult, type EngineContext, type GameContent, type GameState, validateOtherWorldState, projectPublicState } from "../src/index.js";

const card = "encounter_other_world_02";
const empty = { kind: "effects", effects: [] };
const rules: GameContent = {
  otherWorldEncounterIds: [card, "encounter_other_world_03"],
  otherWorldEncounters: [{ id: card, deck: "other_world", sections: { initial: { kind: "test", skill: "will", modifier: 0, pass: empty, fail: empty } } }],
  gates: [{ id: "gate_arkham", locationId: "arkham", omenSymbol: "eclipse" }, { id: "gate_london", locationId: "london", omenSymbol: "constellation" }],
  clues: [{ id: "clue_a", locationId: "arkham" }, { id: "clue_b", locationId: "london" }],
  map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city", london: "city" } },
  investigators: { trish_scarborough: { startingLocationId: "arkham", health: 7, sanity: 5, skills: { lore: 1, influence: 1, observation: 1, strength: 1, will: 2 }, startingAssetIds: [], startingClues: 0 } },
  assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};
function fixture(clues = 0): GameState {
  return {
    stateVersion: 2, phase: "encounter", activePlayerId: "host", leadInvestigatorId: "host", ancientOneId: "azathoth", doom: 15, turnNumber: 1,
    players: [{ id: "host", investigatorId: "trish_scarborough", locationId: "arkham", health: 7, sanity: 5, maxHealth: 7, maxSanity: 5, assetIds: [], clues, skillImprovements: {} }, { id: "guest", locationId: "london", assetIds: [], clues: 0, skillImprovements: {} }],
    actionsRemaining: 0, performedActions: [], monsterLocationIds: [], reserveAssetIds: [], assetDiscardIds: [], mysteryProgress: 0, mysteryTarget: 0, completedMysteryIds: [],
    activeGateIds: ["gate_arkham"], discardedGateIds: [],
    privateState: { deckOrderById: { "encounter:other_world": [...rules.otherWorldEncounterIds!], gates: ["gate_london"] }, tokenPoolById: { clues: clues ? [] : ["clue_a", "clue_b"], clue_discard: [], "held_clues:host": clues ? ["clue_a", "clue_b"] : [], "held_clues:guest": [] } },
  };
}
function accepted(result: CommandResult): GameState {
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}
function draw(state: GameState, context: EngineContext, viaCommand: boolean): CommandResult {
  return viaCommand ? executeCommand(state, "host", { type: "RESOLVE_OTHER_WORLD_ENCOUNTER", gateId: "gate_arkham" }, rules, context)
    : resolveOtherWorldEncounter(state, "host", "gate_arkham", rules, context);
}


describe("physical Other World discard", () => {
  it("isolates the public discard array from canonical inventory", () => {
    const state = fixture();
    state.privateState.deckOrderById["encounter:other_world"]!.shift();
    state.otherWorldDiscardIds = [card];
    const before = structuredClone(state), projected = projectPublicState(state);
    projected.otherWorldDiscardIds!.push("unknown");
    expect(state).toEqual(before);
  });
  it("removes the actual top before an owner decision, then discards it once", () => {
    const state = fixture(2), before = structuredClone(state);
    const next = accepted(draw(state, createDeterministicEngineContext({ dice: [1, 1], ids: ["test", "choice"] }), true));
    expect(next.privateState.deckOrderById["encounter:other_world"]).not.toContain(card);
    expect(next.pendingLocationEncounter).toMatchObject({ cardId: card, cardRemovedFromDeck: true });
    expect(next.otherWorldDiscardIds ?? []).toEqual([]);
    expect(validateOtherWorldState(JSON.parse(JSON.stringify(next)), rules)).toBeUndefined();
    const finished = accepted(executeCommand(next, "host", { type: "RESOLVE_DECISION", decisionId: next.pendingDecision!.id, selectedOptionIds: [] }, rules, createDeterministicEngineContext({})));
    expect(finished.otherWorldDiscardIds).toEqual([card]);
    expect(finished.privateState.deckOrderById["encounter:other_world"]).toEqual(["encounter_other_world_03"]);
    expect(projectPublicState(finished).otherWorldDiscardIds).toEqual([card]);
    expect(state).toEqual(before);
  });
  it("migrates a legacy saved top-bound decision once", () => {
    const next = accepted(draw(fixture(2), createDeterministicEngineContext({ dice: [1, 1], ids: ["test", "choice"] }), false));
    if (next.pendingLocationEncounter!.cardRemovedFromDeck) next.privateState.deckOrderById["encounter:other_world"]!.unshift(card);
    delete next.pendingLocationEncounter!.cardRemovedFromDeck;
    delete next.otherWorldDiscardIds;
    expect(validateOtherWorldState(next, rules)).toBeUndefined();
    const finished = accepted(executeCommand(next, "host", { type: "RESOLVE_DECISION", decisionId: next.pendingDecision!.id, selectedOptionIds: [] }, rules, createDeterministicEngineContext({})));
    expect(finished.otherWorldDiscardIds).toEqual([card]);
    expect(finished.privateState.deckOrderById["encounter:other_world"]).toEqual(["encounter_other_world_03"]);
  });
  it("recycles prior discards immediately, excluding the active card", () => {
    const state = fixture(2); state.privateState.deckOrderById["encounter:other_world"] = [card];
    state.otherWorldDiscardIds = ["encounter_other_world_03"];
    const next = accepted(draw(state, createDeterministicEngineContext({ dice: [1, 1], ids: ["test", "choice"] }), false));
    expect(next.privateState.deckOrderById["encounter:other_world"]).toEqual(["encounter_other_world_03"]);
    expect(next.otherWorldDiscardIds).toEqual([]);
    expect(validateOtherWorldState(next, rules)).toBeUndefined();
  });
  it.each([null, "bad", [card], ["unknown"], Array(1)])("rejects corrupt discard %j before randomness", discard => {
    const state = fixture(); Object.assign(state, { otherWorldDiscardIds: discard });
    const before = structuredClone(state), context = createDeterministicEngineContext({ dice: [6, 6] });
    expect(draw(state, context, false).ok).toBe(false);
    expect(state).toEqual(before); expect(context.rollDie()).toBe(6);
  });
  it("rejects a false removed flag and an active card duplicated in the remaining deck", () => {
    const next = accepted(draw(fixture(2), createDeterministicEngineContext({ dice: [1, 1], ids: ["test", "choice"] }), false));
    Object.assign(next.pendingLocationEncounter!, { cardRemovedFromDeck: false });
    expect(validateOtherWorldState(next, rules)).toBeTypeOf("string");
    Object.assign(next.pendingLocationEncounter!, { cardRemovedFromDeck: true });
    next.privateState.deckOrderById["encounter:other_world"]!.push(card);
    expect(validateOtherWorldState(next, rules)).toBeTypeOf("string");
  });
  it("validates shuffle output and restores partial shuffle input", () => {
    const content: GameContent = { ...rules, otherWorldEncounterIds: [...rules.otherWorldEncounterIds!, "encounter_other_world_04", "encounter_other_world_05"] };
    const state = fixture(); state.privateState.deckOrderById["encounter:other_world"] = [card]; state.otherWorldDiscardIds = content.otherWorldEncounterIds!.slice(1);
    const before = structuredClone(state), context = createDeterministicEngineContext({ shuffleIndexes: [0], dice: [6, 6] });
    expect(resolveOtherWorldEncounter(state, "host", "gate_arkham", content, context)).toMatchObject({ ok: false, error: { code: "RANDOM_INPUT_REQUIRED" } });
    expect(state).toEqual(before); expect(context.shuffle([1, 2])).toEqual([2, 1]);
    expect(resolveOtherWorldEncounter(state, "host", "gate_arkham", content, { ...context, shuffle: () => [card] }).ok).toBe(false);
    expect(state).toEqual(before);
  });
  it("replenishes a singleton only after finishing, without losing its active identity", () => {
    const content = { ...rules, otherWorldEncounterIds: [card] }, state = fixture();
    state.privateState.deckOrderById["encounter:other_world"] = [card];
    const next = accepted(resolveOtherWorldEncounter(state, "host", "gate_arkham", content, createDeterministicEngineContext({ dice: [6, 6] })));
    expect(next.privateState.deckOrderById["encounter:other_world"]).toEqual([card]); expect(next.otherWorldDiscardIds).toEqual([]);
    expect(validateOtherWorldState(next, content)).toBeUndefined();
  });
});
