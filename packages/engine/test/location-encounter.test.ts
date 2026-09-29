import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, executeCommand, resolveLocationEncounter, type GameContent, type GameState } from "../src/index.js";

const content: GameContent = {
  locationEncounters: [
    { id: "encounter_general_08", deck: "general", sections: { sea: { kind: "test", skill: "influence", modifier: 0,
      pass: { kind: "effects", effects: [{ kind: "clues", amount: 1 }] }, fail: { kind: "effects", effects: [] } } } },
    { id: "encounter_general_01", deck: "general", sections: { sea: { kind: "choice", options: [] } } },
  ],
  clues: [{ id: "clue_arkham", locationId: "arkham" }],
  map: { adjacentLocationIds: {}, routes: [], locationTypes: { space_2: "sea", arkham: "city" } },
  investigators: { akachi_onyele: { startingLocationId: "space_2", health: 5, sanity: 7, skills: { lore: 3, influence: 2, observation: 2, strength: 2, will: 4 }, startingAssetIds: [], startingClues: 0 } },
  assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};

function state(): GameState {
  return {
    stateVersion: 2, phase: "encounter", activePlayerId: "host", leadInvestigatorId: "host", turnNumber: 1,
    players: [
      { id: "host", investigatorId: "akachi_onyele", locationId: "space_2", health: 5, sanity: 7, assetIds: [], clues: 0, skillImprovements: {} },
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

  it("refuses unsupported text, rerolls, possessions, wrong deck, and mandatory combat without consuming the card", () => {
    const before = state();
    before.privateState.deckOrderById["encounter:general"] = ["encounter_general_01"];
    expect(resolveLocationEncounter(before, "host", "general", content, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } });
    before.privateState.deckOrderById["encounter:general"] = ["encounter_general_08"];
    before.players[0]!.clues = 1;
    expect(resolveLocationEncounter(before, "host", "general", content, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } });
    before.players[0]!.clues = 0;
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
