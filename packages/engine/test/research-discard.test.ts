import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, executeCommand, resolveResearchEncounter, projectPublicState, type GameContent, type GameState, type CommandResult } from "../src/index.js";
import { removeResearchEncounterCard, finishResearchEncounterCard, validateResearchState } from "../src/research-state.js";

const first = "encounter_research_azathoth_01", second = "encounter_research_azathoth_02";
const empty = { kind: "effects", effects: [] };
const rules: GameContent = {
  map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city", london: "city" } },
  investigators: { trish_scarborough: { startingLocationId: "arkham", health: 7, sanity: 5, skills: { lore: 1, influence: 1, observation: 1, strength: 1, will: 2 }, startingAssetIds: [], startingClues: 0 } },
  assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
  clues: [{ id: "clue_a", locationId: "arkham" }],
  researchEncounters: [{ id: first, deck: "research_azathoth", sections: { city: { kind: "test", skill: "will", modifier: 0, pass: empty, fail: empty } } }, { id: second, deck: "research_azathoth", sections: { city: empty } }],
};
function fixture(): GameState {
  return { stateVersion: 2, phase: "encounter", activePlayerId: "host", leadInvestigatorId: "host", ancientOneId: "azathoth", doom: 15, turnNumber: 1,
    players: [{ id: "host", investigatorId: "trish_scarborough", locationId: "arkham", health: 7, sanity: 5, maxHealth: 7, maxSanity: 5, assetIds: [], clues: 1, skillImprovements: {} }, { id: "guest", locationId: "london", assetIds: [], clues: 0, skillImprovements: {} }],
    actionsRemaining: 0, performedActions: [], monsterLocationIds: [], reserveAssetIds: [], assetDiscardIds: [], mysteryProgress: 0, mysteryTarget: 0, completedMysteryIds: [],
    boardClues: [{ id: "chosen", locationId: "arkham" }],
    privateState: { deckOrderById: { "encounter:research_azathoth": [first, second] }, tokenPoolById: { clues: [], clue_discard: [], "board_clue:chosen": ["clue_a"], "held_clues:host": ["clue_a"], "held_clues:guest": [] } },
  };
}
function accepted(result: CommandResult): GameState { if (!result.ok) throw new Error(result.error.code); return result.state; }
function draw(state = fixture(), content = rules) { return accepted(resolveResearchEncounter(state, "host", "chosen", content, createDeterministicEngineContext({ dice: [1, 1], ids: ["test", "choice"] }))); }
function finish(state: GameState, content = rules) { return executeCommand(state, "host", { type: "RESOLVE_DECISION", decisionId: state.pendingDecision!.id, selectedOptionIds: [] }, content, createDeterministicEngineContext({})); }

describe("physical Research discard", () => {
  it("conserves all eight configured cards through an entire deterministic recycle", () => {
    const catalog = (["azathoth", "cthulhu", "shub_niggurath", "yog_sothoth"] as const).flatMap(ancient =>
      Array.from({ length: 8 }, (_, n) => ({ id: `encounter_research_${ancient}_0${n + 1}`, deck: `research_${ancient}` as const })));
    const content: GameContent = { ...rules, researchEncounterSetup: catalog }, state = fixture();
    const expected = catalog.slice(0, 8).map(card => card.id);
    state.privateState.deckOrderById["encounter:research_azathoth"] = [...expected];
    const context = { ...createDeterministicEngineContext({}), shuffle: <T>(items: readonly T[]) => [...items].reverse() };
    for (let n = 0; n < 8; n++) {
      const cardId = expected[n]!;
      state.currentLocationEncounterCardId = cardId;
      state.pendingLocationEncounter = { playerId: "host", cardId, deck: "research_azathoth", queue: [], dice: [], successes: 0 };
      expect(removeResearchEncounterCard(state, content, context)).toBeUndefined();
      expect(state.privateState.deckOrderById["encounter:research_azathoth"]).not.toContain(cardId);
      if (n === 7) {
        expect(state.privateState.deckOrderById["encounter:research_azathoth"]).toEqual(expected.slice(0, 7).reverse());
        expect(state.researchDiscardIds).toEqual([]);
      }
      expect(finishResearchEncounterCard(state, content, context)).toBeUndefined();
      state.pendingLocationEncounter = undefined; state.currentLocationEncounterCardId = undefined;
      expect(validateResearchState(JSON.parse(JSON.stringify(state)) as GameState, content)).toBeUndefined();
      expect([...(state.privateState.deckOrderById["encounter:research_azathoth"] ?? []), ...state.researchDiscardIds!].sort()).toEqual([...expected].sort());
    }
    expect(state.researchDiscardIds).toEqual(["encounter_research_azathoth_08"]);
  });
  it("removes the top before a private decision and discards exactly once after JSON resume", () => {
    const source = fixture(), before = structuredClone(source), next = draw(source);
    expect(next.privateState.deckOrderById["encounter:research_azathoth"]).toEqual([second]);
    expect(next.pendingLocationEncounter).toMatchObject({ cardId: first, cardRemovedFromDeck: true });
    const done = accepted(finish(JSON.parse(JSON.stringify(next)) as GameState));
    expect(done.researchDiscardIds).toEqual([first]);
    expect(done.privateState.deckOrderById["encounter:research_azathoth"]).toEqual([second]);
    expect(done.pendingLocationEncounter).toBeUndefined();
    expect(done.currentLocationEncounterCardId).toBeUndefined();
    expect(source).toEqual(before);
  });
  it("recycles only previous discards as soon as the last card is drawn", () => {
    const source = fixture(); source.privateState.deckOrderById["encounter:research_azathoth"] = [first]; source.researchDiscardIds = [second];
    const next = draw(source);
    expect(next.privateState.deckOrderById["encounter:research_azathoth"]).toEqual([second]);
    expect(next.researchDiscardIds).toEqual([]);
    expect(accepted(finish(next)).researchDiscardIds).toEqual([first]);
  });
  it("migrates a legacy top-bound continuation once", () => {
    const next = draw();
    next.privateState.deckOrderById["encounter:research_azathoth"] = [first, second];
    delete next.pendingLocationEncounter!.cardRemovedFromDeck; delete next.researchDiscardIds;
    const done = accepted(finish(next));
    expect(done.researchDiscardIds).toEqual([first]);
    expect(done.privateState.deckOrderById["encounter:research_azathoth"]).toEqual([second]);
  });
  it("finishes a singleton without losing its physical identity", () => {
    const source = fixture(); source.privateState.deckOrderById["encounter:research_azathoth"] = [first];
    const done = accepted(finish(draw(source)));
    expect(done.privateState.deckOrderById["encounter:research_azathoth"]).toEqual([first]);
    expect(done.researchDiscardIds).toEqual([]);
  });
  it.each([null, "bad", [first], ["foreign"], Array(1)])("rejects malformed discard %j before random input", discard => {
    const source = fixture(); Object.assign(source, { researchDiscardIds: discard });
    const before = structuredClone(source), context = createDeterministicEngineContext({ dice: [6, 6], ids: ["test", "choice"] });
    expect(resolveResearchEncounter(source, "host", "chosen", rules, context)).toMatchObject({ ok: false, error: { code: "ENCOUNTER_CONTENT_MISSING" } });
    expect(source).toEqual(before); expect(context.rollDie()).toBe(6);
  });
  it("rolls back partially consumed recycle input and rejects foreign shuffle output", () => {
    const source = fixture(); source.privateState.deckOrderById["encounter:research_azathoth"] = [first];
    source.researchDiscardIds = [second, "encounter_research_azathoth_03", "encounter_research_azathoth_04"];
    const before = structuredClone(source), context = createDeterministicEngineContext({ shuffleIndexes: [0], dice: [6, 6], ids: ["test", "choice"] });
    expect(resolveResearchEncounter(source, "host", "chosen", rules, context)).toMatchObject({ ok: false, error: { code: "RANDOM_INPUT_REQUIRED" } });
    expect(source).toEqual(before); expect(context.shuffle([1, 2])).toEqual([2, 1]); expect(context.rollDie()).toBe(6);
    expect(resolveResearchEncounter(source, "host", "chosen", rules, { ...context, shuffle: () => ["foreign"] }).ok).toBe(false);
    expect(source).toEqual(before);
  });
  it("copies faceup discards in both projection directions", () => {
    const source = fixture(); source.researchDiscardIds = [second];
    const projected = projectPublicState(source);
    projected.researchDiscardIds!.push("foreign");
    expect(source.researchDiscardIds).toEqual([second]);
    source.researchDiscardIds.push(first);
    expect(projected.researchDiscardIds).toEqual([second, "foreign"]);
  });
});
