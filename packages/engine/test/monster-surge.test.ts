import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, resolveMythosMonsterSurge, spawnMythosClues, type GameContent, type GameState } from "../src/index.js";

const content: GameContent = {
  mythosCards: [{ id: "mythos_green_01", color: "green", icons: [{ type: "advance_omen" }, { type: "monster_surge" }, { type: "spawn_clues" }] }],
  referenceCards: [{ playerCount: 3, spawnClues: 2, monsterSurge: 2 }],
  gates: [
    { id: "gate_arkham", locationId: "arkham", omenSymbol: "constellation" },
    { id: "gate_london", locationId: "london", omenSymbol: "constellation" },
    { id: "gate_tokyo", locationId: "tokyo", omenSymbol: "eclipse" },
  ],
  clues: [{ id: "clue_arkham", locationId: "arkham" }, { id: "clue_london", locationId: "london" }],
  monsters: [
    { id: "monster_ghoul", type: "normal", horrorCheck: null, damageCheck: null, toughness: { base: 1, perInvestigator: 0 } },
    { id: "monster_untyped", type: "normal", horrorCheck: null, damageCheck: null, toughness: { base: 1, perInvestigator: 0 }, spawnEffect: { type: "unsupported" } },
  ],
  map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city", london: "city", tokyo: "city" } },
  investigators: {}, assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};

function state(cup = ["monster_ghoul", "monster_ghoul", "monster_ghoul", "monster_ghoul"]): GameState {
  return {
    stateVersion: 8, phase: "mythos", currentMythosCardId: "mythos_green_01", currentMythosIconIndex: 1,
    omen: 1, players: ["a", "b", "c"].map(id => ({ id, clues: 0, assetIds: [], skillImprovements: {} })),
    turnNumber: 1, actionsRemaining: 0, performedActions: [], monsterLocationIds: [],
    reserveAssetIds: [], assetDiscardIds: [], mysteryProgress: 0, mysteryTarget: 0, completedMysteryIds: [],
    activeGateIds: ["gate_arkham", "gate_london", "gate_tokyo"], boardClues: [],
    privateState: { deckOrderById: { gates: ["gate_tokyo"] }, tokenPoolById: { monsters: cup, clues: ["clue_arkham", "clue_london"], clue_discard: [] } },
  };
}

describe("green Mythos Monster Surge", () => {
  it("spawns the reference-card count at each matching Gate and unlocks Clues", () => {
    const before = state();
    const surged = resolveMythosMonsterSurge(before, content,
      createDeterministicEngineContext({ tokenIndexes: [0, 0, 0, 0], ids: ["m1", "m2", "m3", "m4"] }));
    expect(surged.ok).toBe(true);
    if (!surged.ok) return;
    expect(surged.state.monsters?.map(monster => monster.locationId)).toEqual(["arkham", "arkham", "london", "london"]);
    expect(surged.state.currentMythosIconIndex).toBe(2);
    expect(surged.state.stateVersion).toBe(9);
    expect(before.monsters).toBeUndefined();
    const clues = spawnMythosClues(surged.state, content, createDeterministicEngineContext({ tokenIndexes: [0, 0], ids: ["c1", "c2"] }));
    expect(clues.ok).toBe(true);
    if (clues.ok) expect(clues.state.currentMythosIconIndex).toBe(3);
  });

  it("opens one Gate instead when none match the current Omen", () => {
    const before = state(["monster_ghoul"]);
    before.activeGateIds = ["gate_tokyo"];
    before.privateState.deckOrderById.gates = ["gate_arkham"];
    const result = resolveMythosMonsterSurge(before, content, createDeterministicEngineContext({ tokenIndexes: [0], ids: ["m1"] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events.map(event => event.type)).toEqual(["GATE_OPENED", "MONSTER_SPAWNED"]);
    expect(result.state.activeGateIds).toEqual(["gate_tokyo", "gate_arkham"]);
  });

  it("stops at the finite Monster cup and rejects out-of-order or unsupported effects", () => {
    const limited = state(["monster_ghoul"]);
    const result = resolveMythosMonsterSurge(limited, content, createDeterministicEngineContext({ tokenIndexes: [0], ids: ["m1"] }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.monsters).toHaveLength(1);
    expect(result.state.currentMythosIconIndex).toBe(2);
    expect(resolveMythosMonsterSurge(result.state, content, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "MYTHOS_CARD_ACTIVE" } });
    const unsupported = state(["monster_ghoul", "monster_untyped"]);
    expect(resolveMythosMonsterSurge(unsupported, content,
      createDeterministicEngineContext({ tokenIndexes: [0, 0], ids: ["m1"] })))
      .toMatchObject({ ok: false, error: { code: "MONSTER_EFFECT_UNSUPPORTED" } });
    expect(unsupported.monsters).toBeUndefined();
    expect(unsupported.privateState.tokenPoolById.monsters).toHaveLength(2);
  });
});
