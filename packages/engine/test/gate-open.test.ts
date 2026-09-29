import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, openGateFromStack, type GameContent, type GameState } from "../src/index.js";

const content: GameContent = {
  gates: [{ id: "gate_arkham", locationId: "arkham", omenSymbol: "eclipse" }, { id: "gate_london", locationId: "london", omenSymbol: "constellation" }],
  monsters: [{ id: "monster_ghoul", type: "normal", count: 1, horrorCheck: null, damageCheck: null, toughness: { base: 1, perInvestigator: 0 } }],
  map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city", london: "city" } },
  investigators: {}, assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};

function state(): GameState {
  return {
    stateVersion: 2, phase: "mythos", players: [], turnNumber: 1, actionsRemaining: 0,
    performedActions: [], monsterLocationIds: [], reserveAssetIds: [], assetDiscardIds: [],
    mysteryProgress: 0, mysteryTarget: 0, completedMysteryIds: [], activeGateIds: [],
    privateState: { deckOrderById: { gates: ["gate_arkham", "gate_london"] }, tokenPoolById: { monsters: ["monster_ghoul"] } },
  };
}

describe("internal Gate opening", () => {
  it("reveals the top Gate and spawns one Monster at its printed space in one transition", () => {
    const before = state();
    const result = openGateFromStack(before, content, createDeterministicEngineContext({ tokenIndexes: [0], ids: ["monster-1"] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(result.state.privateState.deckOrderById.gates).toEqual(["gate_london"]);
    expect(result.state.privateState.tokenPoolById.monsters).toEqual([]);
    expect(result.state.monsters).toEqual([{ id: "monster-1", monsterId: "monster_ghoul", locationId: "arkham", damage: 0 }]);
    expect(result.events.map(event => event.type)).toEqual(["GATE_OPENED", "MONSTER_SPAWNED"]);
    expect(result.state.stateVersion).toBe(3);
    expect(before.activeGateIds).toEqual([]);
    expect(before.privateState.deckOrderById.gates).toHaveLength(2);
  });

  it("opens the Gate without a Monster when the finite cup is empty", () => {
    const before = state();
    before.privateState.tokenPoolById.monsters = [];
    const result = openGateFromStack(before, content, createDeterministicEngineContext({}));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
      expect(result.state.monsters).toBeUndefined();
      expect(result.events.map(event => event.type)).toEqual(["GATE_OPENED"]);
    }
  });

  it("rejects an exhausted stack and missing Gate content without mutation", () => {
    const empty = state(); empty.privateState.deckOrderById.gates = [];
    expect(openGateFromStack(empty, content, createDeterministicEngineContext({}))).toMatchObject({ ok: false, error: { code: "GATE_UNAVAILABLE" } });
    const missing = state(); missing.privateState.deckOrderById.gates = ["gate_missing"];
    expect(openGateFromStack(missing, content, createDeterministicEngineContext({}))).toMatchObject({ ok: false, error: { code: "GATE_CONTENT_MISSING" } });
    expect(missing.privateState.deckOrderById.gates).toEqual(["gate_missing"]);
  });

  it("does not reveal the Gate when its mandatory Monster effect cannot resolve", () => {
    const before = state();
    const unsupported: GameContent = { ...content, monsters: [{ ...content.monsters![0]!, spawnEffect: { type: "unsupported" } }] };
    const result = openGateFromStack(before, unsupported, createDeterministicEngineContext({ tokenIndexes: [0] }));
    expect(result).toMatchObject({ ok: false, error: { code: "MONSTER_EFFECT_UNSUPPORTED" } });
    expect(before.activeGateIds).toEqual([]);
    expect(before.privateState.deckOrderById.gates).toEqual(["gate_arkham", "gate_london"]);
  });
});
