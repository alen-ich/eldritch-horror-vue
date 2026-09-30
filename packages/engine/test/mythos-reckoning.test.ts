import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, executeCommand, resolveMythosReckoning, resolveMythosSpawnGates, type GameContent, type GameState } from "../src/index.js";

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
  it("authorizes the Lead to advance one icon and stops at unimplemented card text", () => {
    const before = state();
    expect(executeCommand(before, "host", { type: "ADVANCE_MYTHOS" }, content, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "WRONG_PHASE" } });
    const reckoning = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, content, createDeterministicEngineContext({ dice: [4, 1] }));
    expect(reckoning.ok).toBe(true);
    if (!reckoning.ok) return;
    const gates = executeCommand(reckoning.state, "guest", { type: "ADVANCE_MYTHOS" }, content, createDeterministicEngineContext({}));
    expect(gates.ok).toBe(true);
    if (!gates.ok) return;
    expect(gates.state.currentMythosIconIndex).toBe(3);
    expect(executeCommand(gates.state, "guest", { type: "ADVANCE_MYTHOS" }, content, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "MYTHOS_EFFECT_UNSUPPORTED" } });
    expect(before.currentMythosIconIndex).toBe(1);
  });
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

describe("typed Mythos card text", () => {
  it("grants the Lead a physical Blessed Condition, closes the card, and opens replacement timing", () => {
    const before = state();
    before.currentMythosCardId = "mythos_green_04";
    before.currentMythosIconIndex = 3;
    before.players.forEach(player => { player.conditionIds = []; });
    before.privateState.tokenPoolById["condition:blessed"] = ["condition_blessed_01"];
    const cardContent: GameContent = { ...content, mythosCards: [{ id: "mythos_green_04", color: "green", icons: [{ type: "advance_omen" }, { type: "monster_surge" }, { type: "spawn_clues" }], effect: { type: "lead_gain_condition", kind: "blessed" } }] };
    const result = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, cardContent, createDeterministicEngineContext({ tokenIndexes: [0] }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.stateVersion).toBe(before.stateVersion + 1);
    expect(result.state.players[1]?.conditionIds).toEqual(["condition_blessed_01"]);
    expect(result.state.privateState.tokenPoolById["condition:blessed"]).toEqual([]);
    expect(result.state.currentMythosCardId).toBeUndefined();
    expect(result.state.replacementWindow).toBe(true);
    expect(before.currentMythosCardId).toBe("mythos_green_04");
  });

  it("leaves the card untouched when the Blessed supply cannot satisfy its effect", () => {
    const before = state();
    before.currentMythosCardId = "mythos_green_04";
    before.currentMythosIconIndex = 3;
    before.players.forEach(player => { player.conditionIds = []; });
    const cardContent: GameContent = { ...content, mythosCards: [{ id: "mythos_green_04", color: "green", icons: [{ type: "advance_omen" }, { type: "monster_surge" }, { type: "spawn_clues" }], effect: { type: "lead_gain_condition", kind: "blessed" } }] };
    expect(executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, cardContent, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "CONDITION_UNAVAILABLE" } });
    expect(before.currentMythosCardId).toBe("mythos_green_04");
    expect(before.replacementWindow).toBeUndefined();
  });

  it("moves Omen counterclockwise and counts Gates at the new symbol exactly once", () => {
    const before = state();
    before.currentMythosCardId = "mythos_yellow_13";
    before.currentMythosIconIndex = 3;
    before.omen = 0;
    before.doom = 8;
    before.activeGateIds = ["gate_london", "gate_tokyo", "gate_arkham"];
    const cardContent: GameContent = { ...content,
      gates: [...content.gates!, { id: "gate_london", locationId: "london", omenSymbol: "constellation" }, { id: "gate_tokyo", locationId: "tokyo", omenSymbol: "constellation" }],
      mythosCards: [{ id: "mythos_yellow_13", color: "yellow", icons: [{ type: "advance_omen" }, { type: "resolve_reckoning" }, { type: "spawn_gates" }], effect: { type: "move_omen_counterclockwise_then_advance_doom_for_gates" } }],
    };
    const result = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, cardContent, createDeterministicEngineContext({}));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state).toMatchObject({ omen: 3, doom: 6, replacementWindow: true, stateVersion: 5 });
    expect(result.state.currentMythosCardId).toBeUndefined();
    expect(result.events).toContainEqual({ type: "OMEN_MOVED", position: 3, symbol: "constellation", direction: "counterclockwise", doomAdvance: 2 });
    expect(before).toMatchObject({ omen: 0, doom: 8, currentMythosCardId: "mythos_yellow_13" });
  });

  it("rejects unsupported awakening without moving Omen or consuming the card", () => {
    const before = state();
    before.ancientOneId = "cthulhu";
    before.currentMythosCardId = "mythos_yellow_13";
    before.currentMythosIconIndex = 3;
    before.omen = 0;
    before.doom = 1;
    before.activeGateIds = ["gate_london"];
    const cardContent: GameContent = { ...content,
      gates: [{ id: "gate_london", locationId: "london", omenSymbol: "constellation" }],
      mythosCards: [{ id: "mythos_yellow_13", color: "yellow", icons: [{ type: "advance_omen" }, { type: "resolve_reckoning" }, { type: "spawn_gates" }], effect: { type: "move_omen_counterclockwise_then_advance_doom_for_gates" } }],
    };
    expect(executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, cardContent, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "AWAKENING_UNSUPPORTED" } });
    expect(before).toMatchObject({ omen: 0, doom: 1, currentMythosCardId: "mythos_yellow_13", stateVersion: 4 });
  });

  it("ends the game at Azathoth's zero Doom only when matching Gates cause Doom loss", () => {
    const cardContent: GameContent = { ...content,
      gates: [{ id: "gate_london", locationId: "london", omenSymbol: "constellation" }],
      mythosCards: [{ id: "mythos_yellow_13", color: "yellow", icons: [{ type: "advance_omen" }, { type: "resolve_reckoning" }, { type: "spawn_gates" }], effect: { type: "move_omen_counterclockwise_then_advance_doom_for_gates" } }],
    };
    const noMatch = state();
    noMatch.currentMythosCardId = "mythos_yellow_13";
    noMatch.currentMythosIconIndex = 3;
    noMatch.omen = 0;
    noMatch.doom = 1;
    const unchanged = executeCommand(noMatch, "guest", { type: "ADVANCE_MYTHOS" }, cardContent, createDeterministicEngineContext({}));
    if (!unchanged.ok) throw new Error(unchanged.error.message);
    expect(unchanged.state).toMatchObject({ omen: 3, doom: 1, replacementWindow: true });
    const matching = structuredClone(noMatch);
    matching.activeGateIds = ["gate_london"];
    const lost = executeCommand(matching, "guest", { type: "ADVANCE_MYTHOS" }, cardContent, createDeterministicEngineContext({}));
    if (!lost.ok) throw new Error(lost.error.message);
    expect(lost.state).toMatchObject({ omen: 3, doom: 0, gameResult: "investigators_lose" });
    expect(lost.events).toContainEqual({ type: "GAME_ENDED", result: "investigators_lose", reason: "azathoth_awakened" });
  });
});

describe("Omen of Good Fortune owner choice", () => {
  const fortuneContent: GameContent = { ...content, mythosCards: [{
    id: "mythos_yellow_08", color: "yellow", icons: [{ type: "advance_omen" }, { type: "resolve_reckoning" }, { type: "spawn_gates" }],
    effect: { type: "lead_choose_omen_without_doom" },
  }] };

  function readyCard(): GameState {
    const before = state();
    before.currentMythosCardId = "mythos_yellow_08";
    before.currentMythosIconIndex = 3;
    before.omen = 0;
    before.doom = 8;
    before.activeGateIds = ["gate_arkham"];
    return before;
  }

  it("pauses for the Lead, accepts a chosen track space, and advances no Doom", () => {
    const before = readyCard();
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, fortuneContent, createDeterministicEngineContext({ ids: ["fortune-choice"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    expect(offered.state.pendingDecision).toMatchObject({ id: "fortune-choice", kind: "choose_omen_space", playerId: "guest", visibility: "owner", optionIds: ["stay", "omen_0", "omen_1", "omen_2", "omen_3"] });
    expect(offered.state.currentMythosCardId).toBe("mythos_yellow_08");
    expect(offered.state.doom).toBe(8);
    const denied = executeCommand(offered.state, "host", { type: "RESOLVE_DECISION", decisionId: "fortune-choice", selectedOptionIds: ["omen_2"] }, fortuneContent);
    expect(denied).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const invalid = executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "fortune-choice", selectedOptionIds: ["omen_4"] }, fortuneContent);
    expect(invalid).toMatchObject({ ok: false, error: { code: "INVALID_DECISION_SELECTION" } });
    const chosen = executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "fortune-choice", selectedOptionIds: ["omen_2"] }, fortuneContent);
    if (!chosen.ok) throw new Error(chosen.error.message);
    expect(chosen.state).toMatchObject({ omen: 2, doom: 8, replacementWindow: true, stateVersion: before.stateVersion + 2 });
    expect(chosen.state.pendingDecision).toBeUndefined();
    expect(chosen.state.currentMythosCardId).toBeUndefined();
    expect(chosen.events).toContainEqual({ type: "OMEN_MOVED", position: 2, symbol: "eclipse", direction: "chosen", doomAdvance: 0 });
    expect(before).toMatchObject({ omen: 0, doom: 8, currentMythosCardId: "mythos_yellow_08" });
  });

  it("allows the optional effect to be declined without moving Omen", () => {
    const before = readyCard();
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, fortuneContent, createDeterministicEngineContext({ ids: ["fortune-choice"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    expect(executeCommand(offered.state, "guest", { type: "ADVANCE_MYTHOS" }, fortuneContent, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "MYTHOS_EFFECT_UNSUPPORTED" } });
    const declined = executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "fortune-choice", selectedOptionIds: ["stay"] }, fortuneContent);
    if (!declined.ok) throw new Error(declined.error.message);
    expect(declined.state).toMatchObject({ omen: 0, doom: 8, replacementWindow: true });
    expect(declined.events.some(event => event.type === "OMEN_MOVED")).toBe(false);
  });
});
