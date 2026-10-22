import { describe, expect, it } from "vitest";
import { createLobby, createDeterministicEngineContext, executeCommand, resolveLocationEncounter, type GameContent, type GameState } from "../src/index.js";
import { validateLocationContinuationState } from "../src/location-continuation-integrity.js";

const content: GameContent = { map: { adjacentLocationIds: {}, routes: [], locationTypes: {} }, investigators: {}, assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {}, locationEncounters: [{ id: "encounter_general_01", deck: "general" }] };
function pending(): GameState {
  const state = createLobby(["host", "guest"]);
  state.phase = "encounter"; state.activePlayerId = "host"; state.ancientOneId = "azathoth";
  state.currentLocationEncounterCardId = "encounter_general_01";
  state.privateState.deckOrderById["encounter:general"] = [state.currentLocationEncounterCardId, "encounter_general_02"];
  state.pendingLocationEncounter = { playerId: "host", cardId: state.currentLocationEncounterCardId, deck: "general", queue: [], dice: [], successes: 0 };
  return state;
}

describe("Location continuation binding", () => {
  it("accepts legacy partial inventory through JSON restoration", () => {
    expect(validateLocationContinuationState(JSON.parse(JSON.stringify(pending())) as GameState, content)).toBeUndefined();
  });
  it("permits a moved encounter owner and a colleague-owned prevention choice", () => {
    const state = pending(); state.players[0]!.locationId = "london";
    state.pendingDecision = { id: "choice", playerId: "guest", kind: "encounter_choice", visibility: "owner", prompt: "Prevent damage", optionIds: ["skip"], minSelections: 1, maxSelections: 1 };
    expect(validateLocationContinuationState(state, content)).toBeUndefined();
  });
  it.each(["top", "reveal", "phase", "owner", "missing owner", "gate", "removed"])("rejects %s before dispatch or RNG use", corruption => {
    const state = pending(), p = state.pendingLocationEncounter!;
    if (corruption === "top") state.privateState.deckOrderById["encounter:general"]!.reverse();
    if (corruption === "reveal") state.currentLocationEncounterCardId = "secret_other_card";
    if (corruption === "phase") state.phase = "action";
    if (corruption === "owner") p.playerId = "guest";
    if (corruption === "missing owner") { p.playerId = "unknown"; state.activePlayerId = "unknown"; }
    if (corruption === "gate") p.gateId = "secret_gate";
    if (corruption === "removed") p.cardRemovedFromDeck = true;
    const before = structuredClone(state), context = createDeterministicEngineContext({ dice: [6] });
    expect(validateLocationContinuationState(state, content)).toBeTypeOf("string");
    const result = executeCommand(state, "host", { type: "END_TURN" }, content, context);
    expect(result).toMatchObject({ ok: false, error: { code: "ENCOUNTER_CONTENT_MISSING" } });
    expect(JSON.stringify(result)).not.toMatch(/secret_|encounter_general_/);
    expect(state).toEqual(before); expect(context.rollDie()).toBe(6);
  });
  it("leaves unrelated reveals alone", () => {
    const state = pending(); state.pendingLocationEncounter = undefined;
    state.currentLocationEncounterCardId = "encounter_other_world_01";
    expect(validateLocationContinuationState(state, content)).toBeUndefined();
  });
  it.each(["general", "america", "europe", "asia_australia"] as const)("accepts bound %s and rejects its orphan", deck => {
    const state = pending(), cardId = `encounter_${deck}_01`;
    state.pendingLocationEncounter!.deck = deck;
    state.pendingLocationEncounter!.cardId = state.currentLocationEncounterCardId = cardId;
    state.privateState.deckOrderById[`encounter:${deck}`] = [cardId];
    const rules: GameContent = { ...content, locationEncounters: [{ id: cardId, deck }] };
    expect(validateLocationContinuationState(JSON.parse(JSON.stringify(state)), rules)).toBeUndefined();
    state.pendingLocationEncounter = undefined;
    expect(validateLocationContinuationState(state, rules)).toBeTypeOf("string");
    const before = structuredClone(state), context = createDeterministicEngineContext({ dice: [6] });
    expect(resolveLocationEncounter(state, "host", deck, rules, context)).toMatchObject({ ok: false, error: { code: "ENCOUNTER_CONTENT_MISSING" } });
    expect(state).toEqual(before); expect(context.rollDie()).toBe(6);
  });
  it("rejects catalog-named orphan and mismatched catalog deck", () => {
    const state = pending(); state.pendingLocationEncounter!.cardId = state.currentLocationEncounterCardId = "custom-card";
    state.privateState.deckOrderById["encounter:general"] = ["custom-card"];
    expect(validateLocationContinuationState(state, content)).toBeTypeOf("string");
    const rules: GameContent = { ...content, locationEncounters: [{ id: "custom-card", deck: "america" }] };
    expect(validateLocationContinuationState(state, rules)).toBeTypeOf("string");
    state.pendingLocationEncounter = undefined;
    expect(validateLocationContinuationState(state, rules)).toBeTypeOf("string");
  });

});
