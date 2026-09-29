import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, executeCommand, resolveLocationEncounter, type GameContent, type GameState } from "../src/index.js";

const content: GameContent = {
  locationEncounters: [
    { id: "encounter_general_08", deck: "general", sections: { sea: { kind: "test", skill: "influence", modifier: 0,
      pass: { kind: "effects", effects: [{ kind: "clues", amount: 1 }] }, fail: { kind: "effects", effects: [] } } } },
    { id: "encounter_general_01", deck: "general", sections: { sea: { kind: "choice", options: [] } } },
    { id: "encounter_general_resource", deck: "general", sections: { sea: { kind: "test", skill: "influence", modifier: 0,
      pass: { kind: "effects", effects: [{ kind: "recover_sanity", amount: 2 }] }, fail: { kind: "effects", effects: [{ kind: "sanity", amount: -1 }] } } } },
    { id: "encounter_general_04", deck: "general", sections: { city: { kind: "test", skill: "influence", modifier: 0,
      pass: { kind: "effects", effects: [] }, fail: { kind: "effects", effects: [{ kind: "condition", condition: "leg_injury" }] } } } },
  ],
  conditions: [{ id: "condition_leg_injury_01", kind: "leg_injury" }],
  clues: [{ id: "clue_arkham", locationId: "arkham" }, { id: "clue_london", locationId: "london" }],
  map: { adjacentLocationIds: {}, routes: [], locationTypes: { space_2: "sea", arkham: "city", london: "city" } },
  investigators: { akachi_onyele: { startingLocationId: "space_2", health: 5, sanity: 7, skills: { lore: 3, influence: 2, observation: 2, strength: 2, will: 4 }, startingAssetIds: [], startingClues: 0 } },
  assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};

function state(): GameState {
  return {
    stateVersion: 2, phase: "encounter", activePlayerId: "host", leadInvestigatorId: "host", turnNumber: 1,
    players: [
      { id: "host", investigatorId: "akachi_onyele", locationId: "space_2", health: 5, sanity: 7, maxHealth: 5, maxSanity: 7, assetIds: [], clues: 0, skillImprovements: {} },
      { id: "guest", investigatorId: "akachi_onyele", locationId: "space_2", health: 5, sanity: 7, assetIds: [], clues: 0, skillImprovements: {} },
    ],
    actionsRemaining: 0, performedActions: [], monsterLocationIds: [], reserveAssetIds: [], assetDiscardIds: [],
    mysteryProgress: 0, mysteryTarget: 0, completedMysteryIds: [],
    privateState: { deckOrderById: { "encounter:general": ["encounter_general_08", "encounter_general_01"] }, tokenPoolById: { clues: ["clue_arkham"], clue_discard: [], "held_clues:host": [], "held_clues:guest": [] } },
  };
}

describe("guarded location encounter", () => {
  it("resolves the verified no-choice test, awards a physical Clue, cycles the card and advances the investigator", () => {
    const before = state();
    const result = executeCommand(before, "host", { type: "RESOLVE_LOCATION_ENCOUNTER", deck: "general" }, content,
      createDeterministicEngineContext({ dice: [1, 5], tokenIndexes: [0] }));
    expect(result).toMatchObject({ ok: true, state: { stateVersion: 3, phase: "encounter", activePlayerId: "guest", lastLocationEncounterCardId: "encounter_general_08" } });
    if (!result.ok) return;
    expect(result.state.players[0]?.clues).toBe(1);
    expect(result.state.privateState.tokenPoolById["held_clues:host"]).toEqual(["clue_arkham"]);
    expect(result.state.privateState.deckOrderById["encounter:general"]).toEqual(["encounter_general_01", "encounter_general_08"]);
    expect(result.events[0]).toMatchObject({ type: "LOCATION_ENCOUNTER_RESOLVED", cardId: "encounter_general_08", dice: [1, 5], successes: 1 });
    expect(before.privateState.deckOrderById["encounter:general"]).toEqual(["encounter_general_08", "encounter_general_01"]);
  });

  it("resolves the failed test without awarding a Clue and enters Mythos after the last investigator", () => {
    const before = state();
    before.activePlayerId = "guest";
    const result = resolveLocationEncounter(before, "guest", "general", content, createDeterministicEngineContext({ dice: [1, 2] }));
    expect(result).toMatchObject({ ok: true, state: { phase: "mythos", activePlayerId: "host" } });
    if (result.ok) expect(result.state.players[1]?.clues).toBe(0);
  });

  it("offers a reconnectable Clue reroll, enforces ownership, then completes the encounter", () => {
    const before = state();
    before.players[0]!.clues = 1;
    before.privateState.tokenPoolById["held_clues:host"] = ["clue_arkham"];
    before.privateState.tokenPoolById.clues = ["clue_london"];
    const started = executeCommand(before, "host", { type: "RESOLVE_LOCATION_ENCOUNTER", deck: "general" }, content,
      createDeterministicEngineContext({ dice: [1, 1], ids: ["test-1", "choice-1"] }));
    expect(started).toMatchObject({ ok: true, state: { currentLocationEncounterCardId: "encounter_general_08", activeTest: { continuation: "location_encounter" }, pendingDecision: { playerId: "host" } } });
    if (!started.ok) return;
    expect(started.state.privateState.deckOrderById["encounter:general"]?.[0]).toBe("encounter_general_08");
    const wrongOwner = executeCommand(started.state, "guest", { type: "RESOLVE_DECISION", decisionId: "choice-1", selectedOptionIds: ["die-0"] }, content, createDeterministicEngineContext({ dice: [5] }));
    expect(wrongOwner).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const finished = executeCommand(started.state, "host", { type: "RESOLVE_DECISION", decisionId: "choice-1", selectedOptionIds: ["die-0"] }, content,
      createDeterministicEngineContext({ dice: [5], tokenIndexes: [0] }));
    expect(finished).toMatchObject({ ok: true, state: { stateVersion: 4, activePlayerId: "guest", currentLocationEncounterCardId: undefined, lastLocationEncounterCardId: "encounter_general_08" } });
    if (!finished.ok) return;
    expect(finished.state.players[0]?.clues).toBe(1);
    expect(finished.state.privateState.tokenPoolById["held_clues:host"]).toEqual(["clue_london"]);
    expect(finished.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_arkham"]);
    expect(finished.state.activeTest).toBeUndefined();
  });

  it("allows keeping the first result without spending a Clue", () => {
    const before = state();
    before.players[0]!.clues = 1;
    before.privateState.tokenPoolById["held_clues:host"] = ["clue_arkham"];
    const started = resolveLocationEncounter(before, "host", "general", content, createDeterministicEngineContext({ dice: [1, 1], ids: ["test-1", "choice-1"] }));
    if (!started.ok) throw new Error("Expected an encounter decision");
    const finished = executeCommand(started.state, "host", { type: "RESOLVE_DECISION", decisionId: "choice-1", selectedOptionIds: [] }, content, createDeterministicEngineContext({}));
    expect(finished).toMatchObject({ ok: true, state: { activePlayerId: "guest", lastLocationEncounterCardId: "encounter_general_08" } });
    if (finished.ok) expect(finished.state.players[0]?.clues).toBe(1);
  });

  it("applies capped recovery and nonlethal loss, but does not silently advance through defeat", () => {
    const before = state();
    before.privateState.deckOrderById["encounter:general"] = ["encounter_general_resource"];
    before.players[0]!.sanity = 6;
    const passed = resolveLocationEncounter(before, "host", "general", content, createDeterministicEngineContext({ dice: [5, 1] }));
    expect(passed).toMatchObject({ ok: true, state: { activePlayerId: "guest" } });
    if (passed.ok) {
      expect(passed.state.players[0]?.sanity).toBe(7);
      expect(passed.events).toContainEqual({ type: "INVESTIGATOR_RECOVERED", playerId: "host", healthRecovered: 0, sanityRecovered: 1 });
    }
    const failed = resolveLocationEncounter(before, "host", "general", content, createDeterministicEngineContext({ dice: [1, 1] }));
    expect(failed).toMatchObject({ ok: true, state: { activePlayerId: "guest" } });
    if (failed.ok) expect(failed.state.players[0]?.sanity).toBe(5);
    before.players[0]!.sanity = 1;
    expect(resolveLocationEncounter(before, "host", "general", content, createDeterministicEngineContext({ dice: [1, 1] })))
      .toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } });
    expect(before.privateState.deckOrderById["encounter:general"]).toEqual(["encounter_general_resource"]);
  });

  it("resolves General 4 city failure through the physical Condition supply", () => {
    const before = state();
    before.players[0]!.locationId = "arkham";
    before.privateState.deckOrderById["encounter:general"] = ["encounter_general_04"];
    before.privateState.tokenPoolById["condition:leg_injury"] = ["condition_leg_injury_01"];
    const result = resolveLocationEncounter(before, "host", "general", content, createDeterministicEngineContext({ dice: [1, 1], tokenIndexes: [0] }));
    expect(result).toMatchObject({ ok: true, state: { activePlayerId: "guest" } });
    if (!result.ok) return;
    expect(result.state.players[0]?.conditionIds).toEqual(["condition_leg_injury_01"]);
    expect(result.events).toContainEqual({ type: "CONDITION_GAINED", playerId: "host", conditionId: "condition_leg_injury" });
    expect(before.privateState.tokenPoolById["condition:leg_injury"]).toEqual(["condition_leg_injury_01"]);
  });

  it("refuses unsupported text, possessions, wrong deck, and mandatory combat without consuming the card", () => {
    const before = state();
    before.privateState.deckOrderById["encounter:general"] = ["encounter_general_01"];
    expect(resolveLocationEncounter(before, "host", "general", content, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } });
    before.privateState.deckOrderById["encounter:general"] = ["encounter_general_08"];
    before.players[0]!.assetIds = ["untyped_asset"];
    expect(resolveLocationEncounter(before, "host", "general", content, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } });
    before.players[0]!.assetIds = [];
    expect(resolveLocationEncounter(before, "host", "europe", content, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "ENCOUNTER_DECK_ILLEGAL" } });
    before.monsters = [{ id: "m1", monsterId: "ghoul", locationId: "space_2", damage: 0 }];
    expect(resolveLocationEncounter(before, "host", "general", content, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "ENCOUNTER_DECK_ILLEGAL" } });
    expect(before.privateState.deckOrderById["encounter:general"]).toEqual(["encounter_general_08"]);
  });
});
