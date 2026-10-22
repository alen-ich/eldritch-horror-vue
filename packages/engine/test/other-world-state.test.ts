import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, resolveOtherWorldEncounter, executeCommand, type GameState, type GameContent } from "../src/index.js";
import * as engine from "../src/index.js";

const card = "encounter_other_world_02", nextCard = "encounter_other_world_03";
const content: GameContent = {
  otherWorldEncounterIds: [card, nextCard],
  otherWorldEncounters: [{ id: card, sections: { initial: { kind: "effects", effects: [] } } }],
  gates: [{ id: "gate_arkham", locationId: "arkham", omenSymbol: "eclipse" }, { id: "gate_london", locationId: "london", omenSymbol: "constellation" }],
  map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city", london: "city" } },
  investigators: {}, assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};
function state(): GameState {
  return {
    stateVersion: 2, phase: "encounter", activePlayerId: "host", leadInvestigatorId: "host", ancientOneId: "azathoth", doom: 15, turnNumber: 1,
    players: [{ id: "host", locationId: "arkham", health: 7, sanity: 5, maxHealth: 7, maxSanity: 5, assetIds: [], clues: 0, skillImprovements: {} }, { id: "guest", locationId: "london", assetIds: [], clues: 0, skillImprovements: {} }],
    actionsRemaining: 0, performedActions: [], monsterLocationIds: [], reserveAssetIds: [], assetDiscardIds: [], mysteryProgress: 0, mysteryTarget: 0, completedMysteryIds: [],
    activeGateIds: ["gate_arkham"], discardedGateIds: [],
    privateState: { deckOrderById: { "encounter:other_world": [card, nextCard], gates: ["gate_london"] }, tokenPoolById: {} },
  };
}
function pending(): GameState {
  const before = state();
  before.currentLocationEncounterCardId = card;
  before.pendingLocationEncounter = { playerId: "host", cardId: card, deck: "other_world", gateId: "gate_arkham", gateLocationId: "arkham", gateClosed: false, queue: [], dice: [], successes: 0 };
  return before;
}
// Dynamic lookup lets RED assert the missing contract rather than fail import collection.
function validate(before: GameState, rules = content): string | undefined {
  expect(engine).toHaveProperty("validateOtherWorldState");
  return (engine as typeof engine & { validateOtherWorldState(state: GameState, content: GameContent): string | undefined }).validateOtherWorldState(before, rules);
}

describe("Other World state integrity", () => {
  it("accepts exact inventory and JSON-restored continuations without changing state", () => {
    for (const before of [state(), pending(), JSON.parse(JSON.stringify(pending())) as GameState]) {
      const saved = structuredClone(before);
      expect(validate(before)).toBeUndefined(); expect(before).toEqual(saved);
    }
  });
  it("preserves absent legacy inventories and unrelated encounter reveals", () => {
    const before = state(); delete before.privateState.deckOrderById["encounter:other_world"];
    before.currentLocationEncounterCardId = "encounter_general_01";
    expect(validate(before)).toBeUndefined();
    before.lastLocationEncounterCardId = card;
    expect(validate(before, { ...content, otherWorldEncounterIds: undefined })).toBeUndefined();
  });
  it.each([[], [card], [card, card], [card, "unknown"], null, "invalid"])("rejects corrupt deck %j", deck => {
    const before = state();
    Object.assign(before.privateState.deckOrderById, { "encounter:other_world": deck });
    expect(validate(before)).toBeTypeOf("string");
  });
  it.each([undefined, [], [card, card], [card, 3], "invalid"])("rejects corrupt catalog %j", catalog => {
    const rules = { ...content }; Object.assign(rules, { otherWorldEncounterIds: catalog });
    expect(validate(state(), rules)).toBeTypeOf("string");
  });
  it("rejects orphan reveal even without inventory", () => {
    const before = state(); before.currentLocationEncounterCardId = card;
    expect(validate(before)).toBeTypeOf("string");
    delete before.privateState.deckOrderById["encounter:other_world"];
    expect(validate(before)).toBeTypeOf("string");
  });
  it.each(["deck", "catalog"])("rejects sparse %s identities", zone => {
    const before = state(), rules = { ...content, otherWorldEncounterIds: [card, nextCard] };
    if (zone === "deck") delete before.privateState.deckOrderById["encounter:other_world"]![1];
    else delete rules.otherWorldEncounterIds[1];
    const saved = structuredClone(before);
    expect(validate(before, rules)).toBeTypeOf("string");
    expect(resolveOtherWorldEncounter(before, "host", "gate_arkham", rules, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "ENCOUNTER_CONTENT_MISSING" } });
    expect(before).toEqual(saved);
  });
  const mutations: Record<string, (before: GameState) => void> = {
    top: before => before.privateState.deckOrderById["encounter:other_world"]!.reverse(),
    reveal: before => { before.currentLocationEncounterCardId = nextCard; },
    owner: before => { before.pendingLocationEncounter!.playerId = "missing"; },
    active: before => { before.activePlayerId = "guest"; },
    phase: before => { before.phase = "action"; },
    location: before => { before.players[0]!.locationId = "london"; },
    gate: before => { before.pendingLocationEncounter!.gateId = "gate_london"; },
    closure: before => { Object.assign(before.pendingLocationEncounter!, { gateClosed: "false" }); },
    closedStillActive: before => { before.pendingLocationEncounter!.gateClosed = true; },
    duplicateGate: before => { before.discardedGateIds = ["gate_arkham"]; },
    missingGate: before => { delete before.privateState.deckOrderById.gates; },
    missingDeck: before => { delete before.privateState.deckOrderById["encounter:other_world"]; },
  };
  it.each(Object.entries(mutations))("rejects invalid %s binding read-only", (_name, mutate) => {
    const before = pending(); mutate(before); const saved = structuredClone(before);
    expect(validate(before)).toBeTypeOf("string"); expect(before).toEqual(saved);
  });
  it("accepts a closed bound Gate in the physical discard and legacy omitted false flag", () => {
    const before = pending(); delete before.pendingLocationEncounter!.gateClosed;
    expect(validate(before)).toBeUndefined();
    before.pendingLocationEncounter!.gateClosed = true; before.activeGateIds = []; before.discardedGateIds = ["gate_arkham"];
    expect(validate(before)).toBeUndefined();
    before.discardedGateIds = []; before.privateState.deckOrderById.gates = ["gate_london", "gate_arkham"];
    expect(validate(before)).toBeUndefined();
  });
  it("rejects malformed draw inventory before effects or deterministic input", () => {
    const before = state(); before.privateState.deckOrderById["encounter:other_world"] = [card, card];
    const saved = structuredClone(before), context = createDeterministicEngineContext({ dice: [6] });
    expect(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, context)).toMatchObject({ ok: false, error: { code: "ENCOUNTER_CONTENT_MISSING" } });
    expect(before).toEqual(saved);
    expect(resolveOtherWorldEncounter(state(), "host", "gate_arkham", content, context).ok).toBe(true);
    expect(context.rollDie()).toBe(6);
  });
  it("rejects malformed restored closure before continuing a decision", () => {
    const before = pending(); Object.assign(before.pendingLocationEncounter!, { gateClosed: "true" });
    const saved = structuredClone(before);
    expect(executeCommand(before, "host", { type: "RESOLVE_DECISION", decisionId: "missing", selectedOptionIds: [] }, content, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "ENCOUNTER_CONTENT_MISSING" } });
    expect(before).toEqual(saved);
  });
});
