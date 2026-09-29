import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, spawnMonsterFromCup, type GameContent, type GameState } from "../src/index.js";

const content: GameContent = {
  map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city", tunguska: "wilderness" } },
  investigators: {}, assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
  conditions: [{ id: "condition_cursed_01", kind: "cursed" }, { id: "condition_blessed_01", kind: "blessed" }],
  monsters: [
    { id: "monster_ghoul", type: "normal", count: 2, horrorCheck: null, damageCheck: null, toughness: { base: 1, perInvestigator: 0 } },
    { id: "monster_colour_out_of_space", type: "normal", count: 1, horrorCheck: null, damageCheck: null, toughness: { base: 2, perInvestigator: 0 }, spawnEffect: { type: "move_to", locationId: "tunguska" } },
    { id: "monster_wraith", type: "normal", count: 1, horrorCheck: null, damageCheck: null, toughness: { base: 1, perInvestigator: 0 }, spawnEffect: { type: "curse_lead" } },
    { id: "monster_untyped", type: "normal", count: 1, horrorCheck: null, damageCheck: null, toughness: { base: 1, perInvestigator: 0 }, spawnEffect: { type: "unsupported" } },
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

  it("resolves Wraith's printed Curse through the existing Condition lifecycle", () => {
    const before = state(["monster_wraith"]);
    before.leadInvestigatorId = "lead";
    before.players = [{ id: "lead", assetIds: [], clues: 0, skillImprovements: {} }];
    before.privateState.tokenPoolById["condition:cursed"] = ["condition_cursed_01"];
    const result = spawnMonsterFromCup(before, "arkham", content, createDeterministicEngineContext({ tokenIndexes: [0, 0], ids: ["instance-1"] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0]?.conditionIds).toEqual(["condition_cursed_01"]);
    expect(result.state.privateState.tokenPoolById["condition:cursed"]).toEqual([]);
    expect(result.state.monsters?.[0]?.monsterId).toBe("monster_wraith");
    expect(result.state.stateVersion).toBe(4);
    expect(result.events.map(event => event.type)).toEqual(["MONSTER_SPAWNED", "CONDITION_GAINED"]);
    expect(before.players[0]?.conditionIds).toBeUndefined();
  });

  it("cancels Blessed instead of adding Cursed, and still spawns when Cursed copies are exhausted", () => {
    const blessed = state(["monster_wraith"]);
    blessed.leadInvestigatorId = "lead";
    blessed.players = [{ id: "lead", assetIds: [], conditionIds: ["condition_blessed_01"], clues: 0, skillImprovements: {} }];
    const canceled = spawnMonsterFromCup(blessed, "arkham", content, createDeterministicEngineContext({ tokenIndexes: [0], ids: ["instance-1"] }));
    expect(canceled.ok).toBe(true);
    if (canceled.ok) {
      expect(canceled.state.players[0]?.conditionIds).toEqual([]);
      expect(canceled.state.privateState.tokenPoolById["condition:blessed"]).toEqual(["condition_blessed_01"]);
      expect(canceled.state.stateVersion).toBe(4);
    }
    const empty = state(["monster_wraith"]);
    empty.leadInvestigatorId = "lead";
    empty.players = [{ id: "lead", assetIds: [], clues: 0, skillImprovements: {} }];
    const spawned = spawnMonsterFromCup(empty, "arkham", content, createDeterministicEngineContext({ tokenIndexes: [0], ids: ["instance-2"] }));
    expect(spawned.ok).toBe(true);
    if (spawned.ok) expect(spawned.state.monsters).toHaveLength(1);
  });

  it("rejects an unsupported printed effect without consuming the token", () => {
    const before = state(["monster_untyped"]);
    const result = spawnMonsterFromCup(before, "arkham", content, createDeterministicEngineContext({ tokenIndexes: [0] }));
    expect(result).toMatchObject({ ok: false, error: { code: "MONSTER_EFFECT_UNSUPPORTED" } });
    expect(before.privateState.tokenPoolById.monsters).toEqual(["monster_untyped"]);
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
