import { describe, expect, it } from "vitest";
import { createLobby, createDeterministicEngineContext, executeCommand, type GameContent, type GameState } from "../src/index.js";
import { validateResearchContinuationState } from "../src/research-continuation-integrity.js";

const content: GameContent = { map: { adjacentLocationIds: {}, routes: [], locationTypes: {} }, investigators: {}, assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {} };
function pending(): GameState {
  const state = createLobby(["host", "guest"]);
  state.phase = "encounter"; state.activePlayerId = "host"; state.ancientOneId = "azathoth";
  state.currentLocationEncounterCardId = "encounter_research_azathoth_01";
  state.privateState.deckOrderById["encounter:research_azathoth"] = [state.currentLocationEncounterCardId, "encounter_research_azathoth_02"];
  state.pendingLocationEncounter = { playerId: "host", cardId: state.currentLocationEncounterCardId, deck: "research_azathoth", queue: [], dice: [], successes: 0 };
  return state;
}

describe("Research continuation binding", () => {
  it("accepts legacy partial inventory through JSON restoration", () => {
    expect(validateResearchContinuationState(JSON.parse(JSON.stringify(pending())) as GameState, content)).toBeUndefined();
  });
  it("permits a moved encounter owner and a colleague-owned prevention choice", () => {
    const state = pending(); state.players[0]!.locationId = "london";
    state.pendingDecision = { id: "choice", playerId: "guest", kind: "encounter_choice", visibility: "owner", prompt: "Prevent damage", optionIds: ["skip"], minSelections: 1, maxSelections: 1 };
    expect(validateResearchContinuationState(state, content)).toBeUndefined();
  });
  it.each(["top", "reveal", "phase", "owner", "missing owner", "ancient", "gate", "removed"])("rejects %s before dispatch or RNG use", corruption => {
    const state = pending(), p = state.pendingLocationEncounter!;
    if (corruption === "top") state.privateState.deckOrderById["encounter:research_azathoth"]!.reverse();
    if (corruption === "reveal") state.currentLocationEncounterCardId = "secret_other_card";
    if (corruption === "phase") state.phase = "action";
    if (corruption === "owner") p.playerId = "guest";
    if (corruption === "missing owner") { p.playerId = "unknown"; state.activePlayerId = "unknown"; }
    if (corruption === "ancient") state.ancientOneId = "cthulhu";
    if (corruption === "gate") p.gateId = "secret_gate";
    if (corruption === "removed") p.cardRemovedFromDeck = true;
    const before = structuredClone(state), context = createDeterministicEngineContext({ dice: [6] });
    expect(validateResearchContinuationState(state, content)).toBeTypeOf("string");
    const result = executeCommand(state, "host", { type: "END_TURN" }, content, context);
    expect(result).toMatchObject({ ok: false, error: { code: "ENCOUNTER_CONTENT_MISSING" } });
    expect(JSON.stringify(result)).not.toMatch(/secret_|encounter_research_/);
    expect(state).toEqual(before); expect(context.rollDie()).toBe(6);
  });
  it("checks the complete configured physical tail", () => {
    const catalog = (["azathoth", "cthulhu", "shub_niggurath", "yog_sothoth"] as const).flatMap(ancient => Array.from({ length: 8 }, (_, n) => ({ id: `encounter_research_${ancient}_0${n + 1}`, deck: `research_${ancient}` as const })));
    const configured: GameContent = { ...content, researchEncounterSetup: catalog }, state = pending();
    expect(validateResearchContinuationState(state, configured)).toBeTypeOf("string");
    state.privateState.deckOrderById["encounter:research_azathoth"] = catalog.slice(0, 8).map(card => card.id);
    expect(validateResearchContinuationState(state, configured)).toBeUndefined();
  });
  it("leaves unrelated encounter types unchanged", () => {
    const state = pending(); state.pendingLocationEncounter!.deck = "other_world";
    state.currentLocationEncounterCardId = state.pendingLocationEncounter!.cardId = "encounter_other_world_01";
    expect(validateResearchContinuationState(state, content)).toBeUndefined();
    state.pendingLocationEncounter = undefined;
    state.currentLocationEncounterCardId = undefined;
    expect(validateResearchContinuationState(state, content)).toBeUndefined();
  });

  it.each(["absent", "generic"])("rejects an orphan Research reveal with %s continuation before command dispatch", kind => {
    const state = pending();
    if (kind === "absent") state.pendingLocationEncounter = undefined;
    else state.pendingLocationEncounter!.deck = "general";
    const before = structuredClone(state), context = createDeterministicEngineContext({ dice: [6] });
    expect(validateResearchContinuationState(state, content)).toBeTypeOf("string");
    const result = executeCommand(state, "host", { type: "END_TURN" }, content, context);
    expect(result).toMatchObject({ ok: false, error: { code: "ENCOUNTER_CONTENT_MISSING" } });
    expect(JSON.stringify(result)).not.toMatch(/encounter_research_/);
    expect(state).toEqual(before);
    expect(context.rollDie()).toBe(6);
  });

  it("accepts a completed last Research card without a current reveal", () => {
    const state = pending();
    state.lastLocationEncounterCardId = state.currentLocationEncounterCardId;
    state.currentLocationEncounterCardId = undefined;
    state.pendingLocationEncounter = undefined;
    expect(validateResearchContinuationState(state, content)).toBeUndefined();
  });
});
