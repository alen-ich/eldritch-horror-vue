import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, spawnMonsterFromCup, type GameContent, type GameState } from "../src/index.js";

const content: GameContent = {
  map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city", tunguska: "wilderness" } },
  investigators: {}, assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
  monsters: [
    { id: "monster_ghoul", type: "normal", count: 2, horrorCheck: null, damageCheck: null, toughness: { base: 1, perInvestigator: 0 } },
    { id: "monster_colour_out_of_space", type: "normal", count: 1, horrorCheck: null, damageCheck: null, toughness: { base: 2, perInvestigator: 0 }, spawnEffect: { type: "move_to", locationId: "tunguska" } },
    { id: "monster_wraith", type: "normal", count: 1, horrorCheck: null, damageCheck: null, toughness: { base: 1, perInvestigator: 0 }, spawnEffect: { type: "unsupported" } },
  ],
};

function state(cup = ["monster_ghoul", "monster_colour_out_of_space"]): GameState {
  return {
    stateVersion: 3, phase: "mythos", players: [], turnNumber: 1, actionsRemaining: 0,
    performedActions: [], monsterLocationIds: [], reserveAssetIds: [], assetDiscardIds: [],
    mysteryProgress: 0, mysteryTarget: 0, completedMysteryIds: [],
    privateState: { deckOrderById: {}, tokenPoolById: { monsters: cup } },
  };
}

describe("internal Monster draw and spawn", () => {
  it("draws one physical token, records its instance, and applies typed movement", () => {
    const before = state();
    const result = spawnMonsterFromCup(before, "arkham", content, createDeterministicEngineContext({ tokenIndexes: [1], ids: ["instance-1"] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.monsters).toEqual([{ id: "instance-1", monsterId: "monster_colour_out_of_space", locationId: "tunguska", damage: 0 }]);
    expect(result.state.monsterLocationIds).toEqual(["tunguska"]);
    expect(result.state.privateState.tokenPoolById.monsters).toEqual(["monster_ghoul"]);
    expect(result.events).toEqual([{ type: "MONSTER_SPAWNED", monsterInstanceId: "instance-1", monsterId: "monster_colour_out_of_space", locationId: "tunguska", spawnLocationId: "arkham" }]);
    expect(result.state.stateVersion).toBe(4);
    expect(before.monsters).toBeUndefined();
    expect(before.privateState.tokenPoolById.monsters).toHaveLength(2);
  });

  it("rejects an unsupported printed effect without consuming the token", () => {
    const before = state(["monster_wraith"]);
    const result = spawnMonsterFromCup(before, "arkham", content, createDeterministicEngineContext({ tokenIndexes: [0] }));
    expect(result).toMatchObject({ ok: false, error: { code: "MONSTER_EFFECT_UNSUPPORTED" } });
    expect(before.privateState.tokenPoolById.monsters).toEqual(["monster_wraith"]);
    expect(before.stateVersion).toBe(3);
  });

  it("rejects an empty cup, missing content, duplicate ID, and post-game draw", () => {
    expect(spawnMonsterFromCup(state([]), "arkham", content, createDeterministicEngineContext({}))).toMatchObject({ ok: false, error: { code: "MONSTER_UNAVAILABLE" } });
    expect(spawnMonsterFromCup(state(["missing"]), "arkham", content, createDeterministicEngineContext({ tokenIndexes: [0] }))).toMatchObject({ ok: false, error: { code: "MONSTER_CONTENT_MISSING" } });
    const occupied = state(["monster_ghoul"]);
    occupied.monsters = [{ id: "taken", monsterId: "monster_ghoul", locationId: "arkham", damage: 0 }];
    expect(spawnMonsterFromCup(occupied, "arkham", content, createDeterministicEngineContext({ tokenIndexes: [0], ids: ["taken"] }))).toMatchObject({ ok: false, error: { code: "MONSTER_CONTENT_MISSING" } });
    const ended = state(); ended.gameResult = "investigators_lose";
    expect(spawnMonsterFromCup(ended, "arkham", content, createDeterministicEngineContext({}))).toMatchObject({ ok: false, error: { code: "GAME_ENDED" } });
  });
});
