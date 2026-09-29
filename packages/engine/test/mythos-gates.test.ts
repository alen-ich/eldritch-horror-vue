import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, resolveMythosSpawnGates, type GameContent, type GameState } from "../src/index.js";

const content: GameContent = {
  mythosCards: [{ id: "mythos_yellow_01", color: "yellow", icons: [{ type: "advance_omen" }, { type: "resolve_reckoning" }, { type: "spawn_gates" }] }],
  referenceCards: [{ playerCount: 5, spawnGates: 2, spawnClues: 3 }],
  gates: [
    { id: "gate_arkham", locationId: "arkham", omenSymbol: "eclipse" },
    { id: "gate_london", locationId: "london", omenSymbol: "constellation" },
  ],
  monsters: [{ id: "monster_ghoul", type: "normal", horrorCheck: null, damageCheck: null, toughness: { base: 1, perInvestigator: 0 } }],
  map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city", london: "city" } },
  investigators: {}, assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};

function state(): GameState {
  return {
    stateVersion: 6, phase: "mythos", currentMythosCardId: "mythos_yellow_01", currentMythosIconIndex: 2,
    players: ["a", "b", "c", "d", "e"].map(id => ({ id, clues: 0, assetIds: [], skillImprovements: {} })),
    turnNumber: 1, actionsRemaining: 0, performedActions: [], monsterLocationIds: [],
    reserveAssetIds: [], assetDiscardIds: [], mysteryProgress: 0, mysteryTarget: 0, completedMysteryIds: [], activeGateIds: [],
    privateState: { deckOrderById: { gates: ["gate_arkham", "gate_london"] }, tokenPoolById: { monsters: ["monster_ghoul", "monster_ghoul"] } },
  };
}

describe("yellow Mythos Spawn Gates", () => {
  it("opens the reference-card number of Gates and spawns their Monsters atomically", () => {
    const before = state();
    const result = resolveMythosSpawnGates(before, content,
      createDeterministicEngineContext({ tokenIndexes: [0, 0], ids: ["m1", "m2"] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events.map(event => event.type)).toEqual(["GATE_OPENED", "MONSTER_SPAWNED", "GATE_OPENED", "MONSTER_SPAWNED"]);
    expect(result.state.activeGateIds).toEqual(["gate_arkham", "gate_london"]);
    expect(result.state.monsters?.map(monster => monster.locationId)).toEqual(["arkham", "london"]);
    expect(result.state.currentMythosIconIndex).toBe(3);
    expect(result.state.stateVersion).toBe(7);
    expect(before.privateState.deckOrderById.gates).toEqual(["gate_arkham", "gate_london"]);
    expect(resolveMythosSpawnGates(result.state, content, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "MYTHOS_CARD_ACTIVE" } });
  });

  it("stops at finite Gate and Monster supplies", () => {
    const before = state();
    before.privateState.deckOrderById.gates = ["gate_arkham"];
    before.privateState.tokenPoolById.monsters = [];
    const result = resolveMythosSpawnGates(before, content, createDeterministicEngineContext({}));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.events.map(event => event.type)).toEqual(["GATE_OPENED"]);
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(result.state.currentMythosIconIndex).toBe(3);
  });

  it("rejects early invocation and rolls back when a later Gate cannot resolve", () => {
    const early = state();
    early.currentMythosIconIndex = 1;
    expect(resolveMythosSpawnGates(early, content, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "MYTHOS_CARD_ACTIVE" } });
    const before = state();
    const missing: GameContent = { ...content, gates: [content.gates![0]!] };
    expect(resolveMythosSpawnGates(before, missing,
      createDeterministicEngineContext({ tokenIndexes: [0], ids: ["m1"] })))
      .toMatchObject({ ok: false, error: { code: "GATE_CONTENT_MISSING" } });
    expect(before.activeGateIds).toEqual([]);
    expect(before.privateState.deckOrderById.gates).toEqual(["gate_arkham", "gate_london"]);
    expect(before.stateVersion).toBe(6);
  });
});
