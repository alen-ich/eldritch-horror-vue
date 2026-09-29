import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, resolveMythosReckoning, resolveMythosSpawnGates, type GameContent, type GameState } from "../src/index.js";

const content: GameContent = {
  ancientOnes: { azathoth: { startingDoom: 15, mythosDeck: [], greenOmenTokens: 1, reckoningEffectIds: [] },
    cthulhu: { startingDoom: 12, mythosDeck: [], greenOmenTokens: 0, reckoningEffectIds: ["cthulhu_sea_reckoning"] } },
  mythosCards: [{ id: "mythos_yellow_01", color: "yellow", icons: [{ type: "advance_omen" }, { type: "resolve_reckoning" }, { type: "spawn_gates" }] }],
  referenceCards: [{ playerCount: 2, spawnClues: 1, spawnGates: 1 }],
  conditions: [{ id: "condition_blessed_01", kind: "blessed" }, { id: "condition_cursed_01", kind: "cursed" }],
  monsters: [{ id: "monster_ghoul", type: "normal", horrorCheck: null, damageCheck: null, toughness: { base: 1, perInvestigator: 0 } }],
  gates: [{ id: "gate_arkham", locationId: "arkham", omenSymbol: "eclipse" }],
  map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city" } },
  investigators: {}, assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};

function state(): GameState {
  return {
    stateVersion: 4, phase: "mythos", ancientOneId: "azathoth", currentMythosCardId: "mythos_yellow_01", currentMythosIconIndex: 1,
    leadInvestigatorId: "guest", players: [
      { id: "host", assetIds: [], clues: 0, conditionIds: ["condition_blessed_01"], skillImprovements: {} },
      { id: "guest", assetIds: [], clues: 0, conditionIds: ["condition_cursed_01"], skillImprovements: {} },
    ],
    turnNumber: 1, actionsRemaining: 0, performedActions: [], monsterLocationIds: [], reserveAssetIds: [], assetDiscardIds: [],
    mysteryProgress: 0, mysteryTarget: 0, completedMysteryIds: [], activeGateIds: [],
    privateState: { deckOrderById: { gates: ["gate_arkham"] }, tokenPoolById: { monsters: [], "condition:blessed": [], "condition:cursed": [] } },
  };
}

describe("guarded yellow Reckoning", () => {
  it("resolves supported Condition rolls clockwise from Lead, then unlocks Gate spawning", () => {
    const before = state();
    const resolved = resolveMythosReckoning(before, content, createDeterministicEngineContext({ dice: [4, 1] }));
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.events.filter(event => event.type === "CONDITION_RECKONING_ROLLED").map(event => event.playerId)).toEqual(["guest", "host"]);
    expect(resolved.state.players.every(player => player.conditionIds?.length === 0)).toBe(true);
    expect(resolved.state.currentMythosIconIndex).toBe(2);
    expect(resolved.state.stateVersion).toBe(5);
    expect(before.players[0]?.conditionIds).toEqual(["condition_blessed_01"]);
    const gates = resolveMythosSpawnGates(resolved.state, content, createDeterministicEngineContext({}));
    expect(gates.ok).toBe(true);
    if (gates.ok) expect(gates.state.activeGateIds).toEqual(["gate_arkham"]);
  });

  it("refuses Ancient One and Monster effects before rolling or advancing", () => {
    const ancient = state();
    ancient.ancientOneId = "cthulhu";
    expect(resolveMythosReckoning(ancient, content, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "RECKONING_UNSUPPORTED" } });
    const monster = state();
    monster.monsters = [{ id: "m1", monsterId: "monster_ghoul", locationId: "arkham", damage: 0 }];
    const monsterContent: GameContent = { ...content, monsters: [{ ...content.monsters![0]!, reckoningEffect: "unsupported" }] };
    expect(resolveMythosReckoning(monster, monsterContent, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "RECKONING_UNSUPPORTED" } });
    expect(monster.currentMythosIconIndex).toBe(1);
    expect(monster.players[0]?.conditionIds).toEqual(["condition_blessed_01"]);
  });

  it("refuses unsupported Condition order and duplicate resolution", () => {
    const multiple = state();
    multiple.players[0]!.conditionIds = ["condition_blessed_01", "condition_cursed_01"];
    expect(resolveMythosReckoning(multiple, content, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "RECKONING_UNSUPPORTED" } });
    const outOfOrder = state();
    outOfOrder.currentMythosIconIndex = 2;
    expect(resolveMythosReckoning(outOfOrder, content, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "MYTHOS_CARD_ACTIVE" } });
  });

  it("advances an effect-free Reckoning without consuming randomness", () => {
    const before = state();
    before.players.forEach(player => { player.conditionIds = []; });
    const result = resolveMythosReckoning(before, content, createDeterministicEngineContext({}));
    expect(result).toMatchObject({ ok: true, events: [], state: { currentMythosIconIndex: 2, stateVersion: 5 } });
    const possession = state();
    possession.players[0]!.assetIds = ["asset_unknown"];
    expect(resolveMythosReckoning(possession, content, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "RECKONING_UNSUPPORTED" } });
  });
});
