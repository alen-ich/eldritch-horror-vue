import { describe, expect, it } from "vitest";
import { createLobby, createDeterministicEngineContext, executeCommand, resolveLocationEncounter, projectPublicState, type GameContent, type GameState } from "../src/index.js";
import { validateLocationState, removeLocationEncounterCard, finishLocationEncounterCard } from "../src/location-state.js";
const decks = ["general", "america", "europe", "asia_australia"] as const;
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
function accepted(result: ReturnType<typeof executeCommand>): GameState { if (!result.ok) throw new Error(result.error.code); return result.state; }
function draw(source = fixture(), content = rules) { return accepted(resolveLocationEncounter(source, "host", "general", content, createDeterministicEngineContext({ ids: ["choice"] }))); }
function finish(state: GameState) { return executeCommand(state, "host", { type: "RESOLVE_DECISION", decisionId: state.pendingDecision!.id, selectedOptionIds: ["skip"] }, rules, createDeterministicEngineContext({})); }
describe("physical Location discard", () => {
  it("removes before a decision and discards exactly once after JSON resume", () => {
    const source = fixture(), before = structuredClone(source), started = draw(source);
    expect(started.privateState.deckOrderById["encounter:general"]).toEqual([second]);
    expect(started.pendingLocationEncounter).toMatchObject({ cardId: first, cardRemovedFromDeck: true });
    const done = accepted(finish(JSON.parse(JSON.stringify(started))));
    expect(done.locationDiscardIdsByDeck).toEqual({ general: [first] });
    expect(done.privateState.deckOrderById["encounter:general"]).toEqual([second]);
    expect(done.pendingLocationEncounter).toBeUndefined(); expect(done.currentLocationEncounterCardId).toBeUndefined();
    expect(executeCommand(done, "host", { type: "RESOLVE_DECISION", decisionId: "choice", selectedOptionIds: ["skip"] }, rules).ok).toBe(false); expect(source).toEqual(before);
  });
  it.each(decks)("conserves a configured entire %s deck through recycling", deck => {
    const catalog = decks.flatMap(d => [1, 2, 3].map(n => ({ id: `encounter_${d}_0${n}`, deck: d })));
    const content: GameContent = { ...rules, locationEncounterSetup: catalog };
    const state = fixture(); state.privateState.deckOrderById = Object.fromEntries(decks.map(d => [`encounter:${d}`, catalog.filter(c => c.deck === d).map(c => c.id)]));
    const expected = catalog.filter(c => c.deck === deck).map(c => c.id);
    const context = { ...createDeterministicEngineContext({}), shuffle: <T>(ids: readonly T[]) => [...ids].reverse() };
    for (let n = 0; n < 3; n++) {
      const cardId = expected[n]!; state.currentLocationEncounterCardId = cardId;
      state.pendingLocationEncounter = { playerId: "host", cardId, deck, queue: [], dice: [], successes: 0 };
      expect(removeLocationEncounterCard(state, content, context)).toBeUndefined();
      expect(state.privateState.deckOrderById[`encounter:${deck}`]).not.toContain(cardId);
      if (n === 2) { expect(state.privateState.deckOrderById[`encounter:${deck}`]).toEqual(expected.slice(0, 2).reverse()); expect(state.locationDiscardIdsByDeck?.[deck]).toEqual([]); }
      expect(finishLocationEncounterCard(state, content, context)).toBeUndefined();
      state.pendingLocationEncounter = undefined; state.currentLocationEncounterCardId = undefined;
      expect(validateLocationState(JSON.parse(JSON.stringify(state)), content)).toBeUndefined();
      expect([...state.privateState.deckOrderById[`encounter:${deck}`]!, ...state.locationDiscardIdsByDeck![deck]!].sort()).toEqual([...expected].sort());
    }
    expect(state.locationDiscardIdsByDeck![deck]).toEqual([expected[2]]);
  });
  it("migrates a legacy top binding and handles singleton completion", () => {
    const started = draw(); delete started.pendingLocationEncounter!.cardRemovedFromDeck; delete started.locationDiscardIdsByDeck;
    started.privateState.deckOrderById["encounter:general"] = [first, second];
    expect(accepted(finish(started)).locationDiscardIdsByDeck).toEqual({ general: [first] });
    const single = fixture(); single.privateState.deckOrderById["encounter:general"] = [first];
    const done = accepted(finish(draw(single))); expect(done.privateState.deckOrderById["encounter:general"]).toEqual([first]); expect(done.locationDiscardIdsByDeck?.general).toEqual([]);
  });
  it.each([null, "bad", { general: [first] }, { general: ["foreign"] }, { general: Array(1) }, { europe: [first] }, { other_world: [] }])("rejects malformed discard %j without state or RNG consumption", discard => {
    const source = fixture(); Object.assign(source, { locationDiscardIdsByDeck: discard });
    const before = structuredClone(source), context = createDeterministicEngineContext({ dice: [6], ids: ["choice"] });
    expect(resolveLocationEncounter(source, "host", "general", rules, context)).toMatchObject({ ok: false, error: { code: "ENCOUNTER_CONTENT_MISSING" } });
    expect(source).toEqual(before); expect(context.rollDie()).toBe(6);
  });
  it("rolls back partial recycle input and rejects foreign shuffle output", () => {
    const source = fixture(); source.privateState.deckOrderById["encounter:general"] = [first];
    source.locationDiscardIdsByDeck = { general: [second, "encounter_general_03", "encounter_general_04"] };
    const before = structuredClone(source), context = createDeterministicEngineContext({ shuffleIndexes: [0], ids: ["choice"] });
    expect(resolveLocationEncounter(source, "host", "general", rules, context)).toMatchObject({ ok: false, error: { code: "RANDOM_INPUT_REQUIRED" } });
    expect(source).toEqual(before); expect(context.shuffle([1, 2])).toEqual([2, 1]);
    expect(resolveLocationEncounter(source, "host", "general", rules, { ...context, shuffle: () => ["private_foreign"] })).toMatchObject({ ok: false, error: { code: "RANDOM_INPUT_REQUIRED" } });
    expect(source).toEqual(before);
  });
  it("copies nested faceup arrays in both projection directions", () => {
    const source = fixture(); source.locationDiscardIdsByDeck = { general: [second] };
    const projected = projectPublicState(source); projected.locationDiscardIdsByDeck!.general!.push("foreign");
    expect(source.locationDiscardIdsByDeck.general).toEqual([second]); source.locationDiscardIdsByDeck.general!.push(first);
    expect(projected.locationDiscardIdsByDeck!.general).toEqual([second, "foreign"]);
  });
});
