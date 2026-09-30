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
  const rallyContent: GameContent = { ...content,
    assets: [
      { id: "item", value: 1, traits: ["item"], engineEffects: [] },
      { id: "ally_first", value: 1, traits: ["ally"], engineEffects: [] },
      { id: "ally_second", value: 2, traits: ["ally"], engineEffects: [] },
    ],
    mythosCards: [{ id: "mythos_yellow_05", color: "yellow", icons: [{ type: "advance_omen" }, { type: "resolve_reckoning" }, { type: "spawn_gates" }], effect: { type: "lead_gain_ally_asset" } }],
  };

  function rallyReady(): GameState {
    const before = state();
    before.currentMythosCardId = "mythos_yellow_05";
    before.currentMythosIconIndex = 3;
    before.privateState.deckOrderById.assets = ["item", "ally_first", "ally_second"];
    return before;
  }

  it("grants the first shuffled Ally in the private deck, removes its physical copy, and reshuffles", () => {
    const before = rallyReady();
    const result = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, rallyContent, createDeterministicEngineContext({ shuffleIndexes: [0] }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[1]?.assetIds).toEqual(["ally_first"]);
    expect(result.state.players[0]?.assetIds).toEqual([]);
    expect(result.state.privateState.deckOrderById.assets).toEqual(["ally_second", "item"]);
    expect(result.events).toContainEqual({ type: "ASSET_GAINED", playerId: "guest", assetId: "ally_first", source: "mythos" });
    expect(result.state.currentMythosCardId).toBeUndefined();
    expect(result.state.replacementWindow).toBe(true);
    expect(before.privateState.deckOrderById.assets).toEqual(["item", "ally_first", "ally_second"]);
  });

  it("searches the discard pile only after the deck and resolves if all Allies are unavailable", () => {
    const fromDiscard = rallyReady();
    fromDiscard.privateState.deckOrderById.assets = ["item"];
    fromDiscard.assetDiscardIds = ["ally_second", "ally_first"];
    const gained = executeCommand(fromDiscard, "guest", { type: "ADVANCE_MYTHOS" }, rallyContent, createDeterministicEngineContext({}));
    if (!gained.ok) throw new Error(gained.error.message);
    expect(gained.state.players[1]?.assetIds).toEqual(["ally_second"]);
    expect(gained.state.assetDiscardIds).toEqual(["ally_first"]);
    const unavailable = rallyReady();
    unavailable.privateState.deckOrderById.assets = ["item"];
    unavailable.players[0]!.assetIds = ["ally_first", "ally_second"];
    const empty = executeCommand(unavailable, "guest", { type: "ADVANCE_MYTHOS" }, rallyContent, createDeterministicEngineContext({}));
    if (!empty.ok) throw new Error(empty.error.message);
    expect(empty.events.some(event => event.type === "ASSET_GAINED")).toBe(false);
    expect(empty.state.replacementWindow).toBe(true);
  });

  it("fails without initialized Asset deck or trait metadata, keeping the card in play", () => {
    const before = rallyReady();
    delete before.privateState.deckOrderById.assets;
    expect(executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, rallyContent, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "ASSET_CONTENT_MISSING" } });
    const incomplete: GameContent = { ...rallyContent, assets: rallyContent.assets.map(asset => ({ ...asset, traits: undefined })) };
    const ready = rallyReady();
    expect(executeCommand(ready, "guest", { type: "ADVANCE_MYTHOS" }, incomplete, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "ASSET_CONTENT_MISSING" } });
    expect(ready.currentMythosCardId).toBe("mythos_yellow_05");
  });
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

describe("The World Fights Back", () => {
  const cardContent: GameContent = { ...content, mythosCards: [{
    id: "mythos_yellow_07", color: "yellow", icons: [{ type: "advance_omen" }, { type: "resolve_reckoning" }, { type: "spawn_gates" }],
    effect: { type: "each_investigator_choose_world_fights_back" },
  }], monsters: [...content.monsters!, { ...content.monsters![0]!, id: "monster_epic", type: "epic" }] };

  function readyCard(): GameState {
    const before = state();
    before.currentMythosCardId = "mythos_yellow_07";
    before.currentMythosIconIndex = 3;
    before.players[0]!.locationId = "arkham";
    before.players[0]!.health = 1;
    before.players[0]!.maxHealth = 4;
    before.players[1]!.locationId = "arkham";
    before.players[1]!.sanity = 2;
    before.players[1]!.maxSanity = 5;
    before.monsters = [
      { id: "normal-1", monsterId: "monster_ghoul", locationId: "arkham", damage: 0 },
      { id: "epic-1", monsterId: "monster_epic", locationId: "arkham", damage: 0 },
    ];
    before.monsterLocationIds = ["arkham"];
    return before;
  }

  it("offers private choices in Lead order and excludes Epic Monsters", () => {
    const before = readyCard();
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, cardContent, createDeterministicEngineContext({ ids: ["choice-1"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    expect(offered.state.pendingDecision).toMatchObject({ id: "choice-1", kind: "choose_world_fights_back", playerId: "guest", visibility: "owner", optionIds: ["recover_health", "recover_sanity", "monster:normal-1", "skip"] });
    expect(executeCommand(offered.state, "host", { type: "RESOLVE_DECISION", decisionId: "choice-1", selectedOptionIds: ["skip"] }, cardContent))
      .toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const recovered = executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "choice-1", selectedOptionIds: ["recover_sanity"] }, cardContent, createDeterministicEngineContext({ ids: ["choice-2"] }));
    if (!recovered.ok) throw new Error(recovered.error.message);
    expect(recovered.state.players[1]?.sanity).toBe(4);
    expect(recovered.state.pendingDecision).toMatchObject({ id: "choice-2", playerId: "host" });
    expect(recovered.state.currentMythosCardId).toBe("mythos_yellow_07");
    expect(executeCommand(recovered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "choice-1", selectedOptionIds: ["skip"] }, cardContent))
      .toMatchObject({ ok: false, error: { code: "DECISION_ID_MISMATCH" } });
    const discarded = executeCommand(recovered.state, "host", { type: "RESOLVE_DECISION", decisionId: "choice-2", selectedOptionIds: ["monster:normal-1"] }, cardContent, createDeterministicEngineContext({}));
    if (!discarded.ok) throw new Error(discarded.error.message);
    expect(discarded.state.monsters?.map(monster => monster.id)).toEqual(["epic-1"]);
    expect(discarded.state.privateState.tokenPoolById.monsters).toEqual(["monster_ghoul"]);
    expect(discarded.state.replacementWindow).toBe(true);
    expect(discarded.state.currentMythosCardId).toBeUndefined();
    expect(discarded.events).toContainEqual({ type: "MONSTER_DISCARDED", monsterInstanceId: "normal-1", monsterId: "monster_ghoul" });
    expect(before.monsters).toHaveLength(2);
  });

  it("supports skipping and caps recovery at maximum", () => {
    const before = readyCard();
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, cardContent, createDeterministicEngineContext({ ids: ["one"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    const skipped = executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "one", selectedOptionIds: ["skip"] }, cardContent, createDeterministicEngineContext({ ids: ["two"] }));
    if (!skipped.ok) throw new Error(skipped.error.message);
    const healed = executeCommand(skipped.state, "host", { type: "RESOLVE_DECISION", decisionId: "two", selectedOptionIds: ["recover_health"] }, cardContent, createDeterministicEngineContext({}));
    if (!healed.ok) throw new Error(healed.error.message);
    expect(healed.state.players[0]?.health).toBe(3);
    expect(healed.state.monsters).toHaveLength(2);
  });
});

describe("Everyone Has a Price", () => {
  const cardContent: GameContent = { ...content,
    conditions: [...content.conditions!, { id: "condition_debt_01", kind: "debt" }, { id: "condition_debt_02", kind: "debt" }],
    mythosCards: [{ id: "mythos_yellow_06", color: "yellow", icons: [{ type: "advance_omen" }, { type: "resolve_reckoning" }, { type: "spawn_gates" }], effect: { type: "each_investigator_trade_debt_for_condition" } }],
  };

  function readyCard(): GameState {
    const before = state();
    before.currentMythosCardId = "mythos_yellow_06";
    before.currentMythosIconIndex = 3;
    before.privateState.tokenPoolById["condition:debt"] = ["condition_debt_01", "condition_debt_02"];
    return before;
  }

  it("offers each owner a private exchange in Lead order and returns discarded cards to supply", () => {
    const before = readyCard();
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, cardContent, createDeterministicEngineContext({ ids: ["debt-1"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    expect(offered.state.pendingDecision).toMatchObject({ id: "debt-1", kind: "trade_debt_for_condition", playerId: "guest", visibility: "owner", optionIds: ["condition_cursed", "skip"] });
    expect(executeCommand(offered.state, "host", { type: "RESOLVE_DECISION", decisionId: "debt-1", selectedOptionIds: ["condition_cursed"] }, cardContent))
      .toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const traded = executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "debt-1", selectedOptionIds: ["condition_cursed"] }, cardContent, createDeterministicEngineContext({ tokenIndexes: [0], ids: ["debt-2"] }));
    if (!traded.ok) throw new Error(traded.error.message);
    expect(traded.state.players[1]?.conditionIds).toEqual(["condition_debt_01"]);
    expect(traded.state.privateState.tokenPoolById["condition:cursed"]).toContain("condition_cursed_01");
    expect(traded.state.privateState.tokenPoolById["condition:debt"]).toEqual(["condition_debt_02"]);
    expect(traded.state.pendingDecision).toMatchObject({ id: "debt-2", playerId: "host", optionIds: ["condition_blessed", "skip"] });
    expect(traded.events).toContainEqual({ type: "CONDITION_GAINED", playerId: "guest", conditionId: "condition_debt" });
    expect(traded.events).toContainEqual({ type: "CONDITION_DISCARDED", playerId: "guest", conditionId: "condition_cursed" });
    const skipped = executeCommand(traded.state, "host", { type: "RESOLVE_DECISION", decisionId: "debt-2", selectedOptionIds: ["skip"] }, cardContent, createDeterministicEngineContext({}));
    if (!skipped.ok) throw new Error(skipped.error.message);
    expect(skipped.state.currentMythosCardId).toBeUndefined();
    expect(skipped.state.replacementWindow).toBe(true);
    expect(before.players[1]?.conditionIds).toEqual(["condition_cursed_01"]);
  });

  it("offers only skip when Debt cannot be gained or no existing Condition can be exchanged", () => {
    const alreadyInDebt = readyCard();
    alreadyInDebt.players[1]!.conditionIds = ["condition_debt_01", "condition_cursed_01"];
    const offered = executeCommand(alreadyInDebt, "guest", { type: "ADVANCE_MYTHOS" }, cardContent, createDeterministicEngineContext({ ids: ["choice"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    expect(offered.state.pendingDecision?.optionIds).toEqual(["skip"]);
    const emptyPool = readyCard();
    emptyPool.privateState.tokenPoolById["condition:debt"] = [];
    const noDebt = executeCommand(emptyPool, "guest", { type: "ADVANCE_MYTHOS" }, cardContent, createDeterministicEngineContext({ ids: ["choice"] }));
    if (!noDebt.ok) throw new Error(noDebt.error.message);
    expect(noDebt.state.pendingDecision?.optionIds).toEqual(["skip"]);
    const noCondition = readyCard();
    noCondition.players[1]!.conditionIds = [];
    const noTrade = executeCommand(noCondition, "guest", { type: "ADVANCE_MYTHOS" }, cardContent, createDeterministicEngineContext({ ids: ["choice"] }));
    if (!noTrade.ok) throw new Error(noTrade.error.message);
    expect(noTrade.state.pendingDecision?.optionIds).toEqual(["skip"]);
  });
});
