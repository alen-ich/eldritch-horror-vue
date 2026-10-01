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
  const badToWorseContent: GameContent = { ...content,
    investigators: { jim_culver: { startingLocationId: "arkham", health: 5, sanity: 4, skills: { lore: 3, influence: 3, observation: 2, strength: 2, will: 3 }, startingAssetIds: [], startingClues: 0 } },
    conditions: [
      { id: "condition_leg_injury_01", kind: "leg_injury", trait: "injury" },
      { id: "condition_paranoia_01", kind: "paranoia", trait: "madness" },
      { id: "condition_debt_01", kind: "debt", trait: "deal" },
    ],
    mythosCards: [{ id: "mythos_yellow_17", color: "yellow", icons: [{ type: "advance_omen" }, { type: "resolve_reckoning" }, { type: "spawn_gates" }], effect: { type: "each_investigator_from_bad_to_worse" } }],
  };
  function badToWorseReady(): GameState {
    const before = state();
    before.currentMythosCardId = "mythos_yellow_17";
    before.currentMythosIconIndex = 3;
    before.doom = 8;
    before.players[1] = { ...before.players[1]!, investigatorId: "jim_culver", locationId: "arkham", health: 5, sanity: 4, clues: 2, conditionIds: ["condition_leg_injury_01", "condition_paranoia_01", "condition_debt_01"] };
    before.players[0] = { ...before.players[0]!, investigatorId: "jim_culver", locationId: "arkham", health: 5, sanity: 4, clues: 0, conditionIds: [] };
    before.privateState.tokenPoolById.clues = ["clue_unused"];
    before.privateState.tokenPoolById["held_clues:guest"] = ["clue_one", "clue_two"];
    before.privateState.tokenPoolById["held_clues:host"] = [];
    return before;
  }

  it("applies From Bad to Worse by printed Condition traits and discards a physical Clue", () => {
    const before = badToWorseReady();
    const resolved = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, badToWorseContent, createDeterministicEngineContext({}));
    if (!resolved.ok) throw new Error(resolved.error.message);
    expect(resolved.state.players[1]).toMatchObject({ health: 4, sanity: 3, clues: 1 });
    expect(resolved.state.privateState.tokenPoolById["held_clues:guest"]).toEqual(["clue_two"]);
    expect(resolved.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_one"]);
    expect(resolved.events).toContainEqual({ type: "CLUES_DISCARDED", playerId: "guest", amount: 1 });
    expect(resolved.state.replacementWindow).toBe(true);
    expect(before.players[1]?.clues).toBe(2);
  });

  it("resumes From Bad to Worse after defeat and sets aside only remaining Clues", () => {
    const before = badToWorseReady();
    before.players[1]!.health = 1;
    before.players[0]!.conditionIds = ["condition_paranoia_01"];
    const first = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, badToWorseContent, createDeterministicEngineContext({}));
    if (!first.ok) throw new Error(first.error.message);
    expect(first.state.pendingDefeat?.playerId).toBe("guest");
    expect(first.state.players[1]?.clues).toBe(1);
    expect(first.state.pendingFromBadToWorse?.remainingPlayerIds).toEqual(["host"]);
    const continued = executeCommand(first.state, "guest", { type: "RESOLVE_DEFEAT", cityId: "arkham", cause: "health", leadPlayerId: "host" }, badToWorseContent);
    if (!continued.ok) throw new Error(continued.error.message);
    expect(continued.state.privateState.tokenPoolById["defeated_clues:jim_culver"]).toEqual(["clue_two"]);
    expect(continued.state.players[0]?.sanity).toBe(3);
    expect(continued.state.pendingFromBadToWorse).toBeUndefined();
    expect(continued.state.replacementWindow).toBe(true);
  });

  it("rejects missing trait or physical Clue metadata before applying any loss", () => {
    const before = badToWorseReady();
    const incomplete: GameContent = { ...badToWorseContent, conditions: badToWorseContent.conditions?.map(condition => condition.kind === "debt" ? { id: condition.id, kind: condition.kind } : condition) };
    expect(executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, incomplete, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "CONDITION_CONTENT_MISSING" } });
    const missingClue = badToWorseReady();
    missingClue.privateState.tokenPoolById["held_clues:guest"] = ["clue_one"];
    expect(executeCommand(missingClue, "guest", { type: "ADVANCE_MYTHOS" }, badToWorseContent, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "CLUE_CONTENT_MISSING" } });
    expect(before.players[1]?.health).toBe(5);
    expect(missingClue.players[1]?.clues).toBe(2);
  });

  it("resolves investigators with no Conditions and no physical Clue holding", () => {
    const before = badToWorseReady();
    before.players[1]!.conditionIds = [];
    before.players[1]!.clues = 0;
    delete before.privateState.tokenPoolById["held_clues:guest"];
    const resolved = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, badToWorseContent, createDeterministicEngineContext({}));
    expect(resolved).toMatchObject({ ok: true, state: { replacementWindow: true } });
  });

  it("guards From Bad to Worse against unsupported awakening atomically", () => {
    const before = badToWorseReady();
    before.players[1]!.health = 1;
    before.doom = 1;
    before.ancientOneId = "cthulhu";
    expect(executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, badToWorseContent, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "AWAKENING_UNSUPPORTED" } });
    expect(before.privateState.tokenPoolById["held_clues:guest"]).toEqual(["clue_one", "clue_two"]);
  });
  const betrayalContent: GameContent = { ...content,
    investigators: { jim_culver: { startingLocationId: "arkham", health: 5, sanity: 4, skills: { lore: 3, influence: 3, observation: 2, strength: 2, will: 3 }, startingAssetIds: [], startingClues: 0 } },
    assets: [
      { id: "ally_one", value: 1, traits: ["ally"], engineEffects: [] },
      { id: "ally_two", value: 2, traits: ["ally"], engineEffects: [] },
      { id: "ally_three", value: 1, traits: ["ally"], engineEffects: [] },
      { id: "item_one", value: 1, traits: ["item"], engineEffects: [] },
    ],
    mythosCards: [{ id: "mythos_green_11", color: "green", icons: [{ type: "advance_omen" }, { type: "monster_surge" }, { type: "spawn_clues" }], effect: { type: "each_investigator_with_ally_betrayed" } }],
  };
  function betrayalReady(): GameState {
    const before = state();
    before.currentMythosCardId = "mythos_green_11";
    before.currentMythosIconIndex = 3;
    before.doom = 8;
    before.players[1] = { ...before.players[1]!, investigatorId: "jim_culver", locationId: "arkham", health: 5, sanity: 4, assetIds: ["ally_one", "ally_two", "item_one"] };
    before.players[0] = { ...before.players[0]!, investigatorId: "jim_culver", locationId: "arkham", health: 5, sanity: 4, assetIds: ["ally_three"] };
    return before;
  }

  it("offers Unexpected Betrayal only to Ally holders and discards the chosen Ally after Health loss", () => {
    const before = betrayalReady();
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, betrayalContent, createDeterministicEngineContext({ ids: ["first-betrayal"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    expect(offered.state.pendingDecision).toMatchObject({ kind: "choose_unexpected_betrayal_ally", playerId: "guest", optionIds: ["ally_one", "ally_two"] });
    expect(executeCommand(offered.state, "host", { type: "RESOLVE_DECISION", decisionId: "first-betrayal", selectedOptionIds: ["ally_one"] }, betrayalContent))
      .toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const first = executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "first-betrayal", selectedOptionIds: ["ally_one"] }, betrayalContent, createDeterministicEngineContext({ ids: ["second-betrayal"] }));
    if (!first.ok) throw new Error(first.error.message);
    expect(first.state.players[1]).toMatchObject({ health: 2, assetIds: ["ally_two", "item_one"] });
    expect(first.state.assetDiscardIds).toEqual(["ally_one"]);
    expect(first.events.map(event => event.type).indexOf("INVESTIGATOR_DAMAGED")).toBeLessThan(first.events.map(event => event.type).indexOf("ASSET_DISCARDED"));
    expect(first.state.pendingDecision).toMatchObject({ playerId: "host", optionIds: ["ally_three"] });
    const second = executeCommand(first.state, "host", { type: "RESOLVE_DECISION", decisionId: "second-betrayal", selectedOptionIds: ["ally_three"] }, betrayalContent, createDeterministicEngineContext({}));
    if (!second.ok) throw new Error(second.error.message);
    expect(second.state.players[0]).toMatchObject({ health: 2, assetIds: [] });
    expect(second.state.replacementWindow).toBe(true);
    expect(before.players[1]?.assetIds).toEqual(["ally_one", "ally_two", "item_one"]);
  });

  it("skips investigators without Allies and finishes when nobody has one", () => {
    const before = betrayalReady();
    before.players[1]!.assetIds = ["item_one"];
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, betrayalContent, createDeterministicEngineContext({ ids: ["host-betrayal"] }));
    expect(offered).toMatchObject({ ok: true, state: { pendingDecision: { playerId: "host" } } });
    before.players[0]!.assetIds = [];
    const none = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, betrayalContent, createDeterministicEngineContext({}));
    expect(none).toMatchObject({ ok: true, state: { replacementWindow: true } });
  });

  it("retains Unexpected Betrayal through lethal damage and excludes the discarded Ally from the defeated sheet", () => {
    const before = betrayalReady();
    before.players[1]!.health = 3;
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, betrayalContent, createDeterministicEngineContext({ ids: ["first-betrayal"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    const lost = executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "first-betrayal", selectedOptionIds: ["ally_one"] }, betrayalContent, createDeterministicEngineContext({}));
    if (!lost.ok) throw new Error(lost.error.message);
    expect(lost.state.pendingDefeat?.playerId).toBe("guest");
    expect(lost.state.assetDiscardIds).toContain("ally_one");
    const resumed = executeCommand(lost.state, "guest", { type: "RESOLVE_DEFEAT", cityId: "arkham", cause: "health", leadPlayerId: "host" }, betrayalContent, createDeterministicEngineContext({ ids: ["second-betrayal"] }));
    if (!resumed.ok) throw new Error(resumed.error.message);
    expect(resumed.state.defeatedInvestigators?.[0]?.assetIds).toEqual(["ally_two", "item_one"]);
    expect(resumed.state.pendingDecision?.playerId).toBe("host");
  });

  it("guards Unexpected Betrayal against unsupported awakening without discarding an Ally", () => {
    const before = betrayalReady();
    before.players[1]!.health = 3;
    before.doom = 1;
    before.ancientOneId = "cthulhu";
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, betrayalContent, createDeterministicEngineContext({ ids: ["first-betrayal"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    expect(executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "first-betrayal", selectedOptionIds: ["ally_one"] }, betrayalContent, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "AWAKENING_UNSUPPORTED" } });
    expect(offered.state.assetDiscardIds).toEqual([]);
    expect(offered.state.players[1]?.assetIds).toContain("ally_one");
  });
  const tideContent: GameContent = { ...content,
    investigators: { jim_culver: { startingLocationId: "arkham", health: 5, sanity: 4, skills: { lore: 3, influence: 3, observation: 2, strength: 2, will: 3 }, startingAssetIds: [], startingClues: 0 } },
    mythosCards: [{ id: "mythos_yellow_16", color: "yellow", icons: [{ type: "advance_omen" }, { type: "resolve_reckoning" }, { type: "spawn_gates" }], effect: { type: "each_investigator_tide_of_despair" } }],
  };
  function tideReady(): GameState {
    const before = state();
    before.currentMythosCardId = "mythos_yellow_16";
    before.currentMythosIconIndex = 3;
    before.doom = 8;
    before.players[1] = { ...before.players[1]!, investigatorId: "jim_culver", locationId: "arkham", health: 4, sanity: 4, conditionIds: ["condition_blessed_01"] };
    before.players[0] = { ...before.players[0]!, investigatorId: "jim_culver", locationId: "arkham", health: 4, sanity: 4, conditionIds: [] };
    return before;
  }

  it("resolves Tide of Despair privately in Lead order and returns Blessed to supply", () => {
    const before = tideReady();
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, tideContent, createDeterministicEngineContext({ ids: ["first-tide"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    expect(offered.state.pendingDecision).toMatchObject({ kind: "choose_tide_of_despair", playerId: "guest", optionIds: ["discard_blessed", "lose_health_and_sanity"] });
    expect(executeCommand(offered.state, "host", { type: "RESOLVE_DECISION", decisionId: "first-tide", selectedOptionIds: ["discard_blessed"] }, tideContent))
      .toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const first = executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "first-tide", selectedOptionIds: ["discard_blessed"] }, tideContent, createDeterministicEngineContext({ ids: ["second-tide"] }));
    if (!first.ok) throw new Error(first.error.message);
    expect(first.state.players[1]?.conditionIds).toEqual([]);
    expect(first.state.privateState.tokenPoolById["condition:blessed"]).toContain("condition_blessed_01");
    expect(first.state.pendingDecision).toMatchObject({ playerId: "host", optionIds: ["lose_health_and_sanity"] });
    const second = executeCommand(first.state, "host", { type: "RESOLVE_DECISION", decisionId: "second-tide", selectedOptionIds: ["lose_health_and_sanity"] }, tideContent, createDeterministicEngineContext({}));
    if (!second.ok) throw new Error(second.error.message);
    expect(second.state.players[0]).toMatchObject({ health: 2, sanity: 2 });
    expect(second.state.pendingTideOfDespair).toBeUndefined();
    expect(second.state.replacementWindow).toBe(true);
    expect(before.players[1]?.conditionIds).toEqual(["condition_blessed_01"]);
  });

  it("pauses Tide of Despair on simultaneous lethal loss and resumes after the chosen defeat cause", () => {
    const before = tideReady();
    before.players[1]!.conditionIds = [];
    before.players[1]!.health = 2;
    before.players[1]!.sanity = 2;
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, tideContent, createDeterministicEngineContext({ ids: ["first-tide"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    const lost = executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "first-tide", selectedOptionIds: ["lose_health_and_sanity"] }, tideContent, createDeterministicEngineContext({}));
    if (!lost.ok) throw new Error(lost.error.message);
    expect(lost.state.pendingDefeat?.causes).toEqual(["health", "sanity"]);
    expect(lost.state.pendingTideOfDespair?.remainingPlayerIds).toEqual(["host"]);
    const resumed = executeCommand(lost.state, "guest", { type: "RESOLVE_DEFEAT", cityId: "arkham", cause: "sanity", leadPlayerId: "host" }, tideContent, createDeterministicEngineContext({ ids: ["second-tide"] }));
    if (!resumed.ok) throw new Error(resumed.error.message);
    expect(resumed.state.pendingDecision).toMatchObject({ playerId: "host", kind: "choose_tide_of_despair" });
    const completed = executeCommand(resumed.state, "host", { type: "RESOLVE_DECISION", decisionId: "second-tide", selectedOptionIds: ["lose_health_and_sanity"] }, tideContent, createDeterministicEngineContext({}));
    if (!completed.ok) throw new Error(completed.error.message);
    expect(completed.state.replacementWindow).toBe(true);
  });

  it("guards Tide of Despair against unsupported awakening without mutating state", () => {
    const before = tideReady();
    before.ancientOneId = "cthulhu";
    before.doom = 1;
    before.players[1]!.health = 2;
    before.players[1]!.conditionIds = [];
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, tideContent, createDeterministicEngineContext({ ids: ["first-tide"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    expect(executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "first-tide", selectedOptionIds: ["lose_health_and_sanity"] }, tideContent, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "AWAKENING_UNSUPPORTED" } });
    expect(offered.state.players[1]?.health).toBe(2);
    expect(offered.state.pendingDecision?.id).toBe("first-tide");
  });
  const bloodFlowsContent: GameContent = { ...content,
    investigators: { jim_culver: { startingLocationId: "arkham", health: 5, sanity: 4, skills: { lore: 3, influence: 3, observation: 2, strength: 2, will: 3 }, startingAssetIds: [], startingClues: 0 } },
    monsters: [
      { id: "monster_ghoul", type: "normal", horrorCheck: null, damageCheck: null, toughness: { base: 2, perInvestigator: 1 } },
      { id: "monster_epic", type: "epic", horrorCheck: null, damageCheck: null, toughness: { base: 5, perInvestigator: 0 } },
    ],
    mythosCards: [{ id: "mythos_green_16", color: "green", icons: [{ type: "advance_omen" }, { type: "monster_surge" }, { type: "spawn_clues" }], effect: { type: "lead_discard_monster_lose_toughness_health" } }],
  };
  function bloodFlowsReady(): GameState {
    const before = state();
    before.currentMythosCardId = "mythos_green_16";
    before.currentMythosIconIndex = 3;
    before.doom = 8;
    before.players[1] = { ...before.players[1]!, investigatorId: "jim_culver", locationId: "arkham", health: 5, sanity: 4 };
    before.monsters = [{ id: "ghoul-on-board", monsterId: "monster_ghoul", locationId: "arkham", damage: 1 }, { id: "epic-on-board", monsterId: "monster_epic", locationId: "arkham", damage: 0 }];
    before.monsterLocationIds = ["arkham"];
    return before;
  }

  it("offers Blood Flows only normal Monsters and applies full toughness before finishing", () => {
    const before = bloodFlowsReady();
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, bloodFlowsContent, createDeterministicEngineContext({ ids: ["blood-choice"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    expect(offered.state.pendingDecision).toMatchObject({ kind: "choose_blood_flows_monster", playerId: "guest", optionIds: ["ghoul-on-board"] });
    expect(executeCommand(offered.state, "host", { type: "RESOLVE_DECISION", decisionId: "blood-choice", selectedOptionIds: ["ghoul-on-board"] }, bloodFlowsContent))
      .toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    expect(executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "blood-choice", selectedOptionIds: ["epic-on-board"] }, bloodFlowsContent))
      .toMatchObject({ ok: false });
    const resolved = executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "blood-choice", selectedOptionIds: ["ghoul-on-board"] }, bloodFlowsContent, createDeterministicEngineContext({}));
    if (!resolved.ok) throw new Error(resolved.error.message);
    expect(resolved.state.players[1]?.health).toBe(1);
    expect(resolved.state.monsters?.map(monster => monster.id)).toEqual(["epic-on-board"]);
    expect(resolved.state.privateState.tokenPoolById.monsters).toContain("monster_ghoul");
    expect(resolved.state.replacementWindow).toBe(true);
    expect(before.players[1]?.health).toBe(5);
  });

  it("finishes Blood Flows when there is no discardable Monster", () => {
    const before = bloodFlowsReady();
    before.monsters = before.monsters?.filter(monster => monster.monsterId === "monster_epic");
    const resolved = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, bloodFlowsContent, createDeterministicEngineContext({}));
    expect(resolved).toMatchObject({ ok: true, state: { replacementWindow: true } });
  });

  it("pauses Blood Flows for lethal loss and finishes after defeat resolution", () => {
    const before = bloodFlowsReady();
    before.players[1]!.health = 3;
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, bloodFlowsContent, createDeterministicEngineContext({ ids: ["blood-choice"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    const lost = executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "blood-choice", selectedOptionIds: ["ghoul-on-board"] }, bloodFlowsContent, createDeterministicEngineContext({}));
    if (!lost.ok) throw new Error(lost.error.message);
    expect(lost.state.pendingDefeat?.playerId).toBe("guest");
    expect(lost.state.currentMythosCardId).toBe("mythos_green_16");
    const defeated = executeCommand(lost.state, "guest", { type: "RESOLVE_DEFEAT", cityId: "arkham", cause: "health", leadPlayerId: "host" }, bloodFlowsContent);
    if (!defeated.ok) throw new Error(defeated.error.message);
    expect(defeated.state.currentMythosCardId).toBeUndefined();
    expect(defeated.state.replacementWindow).toBe(true);
  });

  it("rejects Blood Flows loss before unsupported awakening without discarding the Monster", () => {
    const before = bloodFlowsReady();
    before.doom = 1;
    before.ancientOneId = "cthulhu";
    before.players[1]!.health = 3;
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, bloodFlowsContent, createDeterministicEngineContext({ ids: ["blood-choice"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    expect(executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "blood-choice", selectedOptionIds: ["ghoul-on-board"] }, bloodFlowsContent, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "AWAKENING_UNSUPPORTED" } });
    expect(offered.state.monsters?.map(monster => monster.id)).toContain("ghoul-on-board");
  });
  const heatWaveContent: GameContent = { ...content,
    investigators: { akachi_onyele: { startingLocationId: "arkham", health: 5, sanity: 7, skills: { lore: 3, influence: 2, observation: 2, strength: 2, will: 4 }, startingAssetIds: [], startingClues: 0 } },
    mythosCards: [{ id: "mythos_yellow_14", color: "yellow", icons: [{ type: "advance_omen" }, { type: "resolve_reckoning" }, { type: "spawn_gates" }], effect: { type: "each_investigator_choose_heat_wave" } }],
  };

  function heatWaveReady(): GameState {
    const before = state();
    before.currentMythosCardId = "mythos_yellow_14";
    before.currentMythosIconIndex = 3;
    before.doom = 8;
    before.players[1] = { ...before.players[1]!, investigatorId: "jim_culver", locationId: "arkham", health: 4, sanity: 4 };
    before.players[0] = { ...before.players[0]!, investigatorId: "trish_scarborough", locationId: "arkham", health: 4, sanity: 4 };
    return before;
  }

  it("offers Heat Wave choices in Lead order and applies Delay or Health loss", () => {
    const before = heatWaveReady();
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, heatWaveContent, createDeterministicEngineContext({ ids: ["first-choice"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    expect(offered.state.pendingDecision).toMatchObject({ playerId: "guest", kind: "choose_heat_wave", visibility: "owner", optionIds: ["become_delayed", "lose_health"] });
    expect(executeCommand(offered.state, "host", { type: "RESOLVE_DECISION", decisionId: "first-choice", selectedOptionIds: ["lose_health"] }, heatWaveContent))
      .toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const first = executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "first-choice", selectedOptionIds: ["become_delayed"] }, heatWaveContent, createDeterministicEngineContext({ ids: ["second-choice"] }));
    if (!first.ok) throw new Error(first.error.message);
    expect(first.state.players[1]?.delayed).toBe(true);
    expect(first.state.pendingDecision?.playerId).toBe("host");
    expect(first.state.stateVersion).toBe(offered.state.stateVersion + 1);
    const second = executeCommand(first.state, "host", { type: "RESOLVE_DECISION", decisionId: "second-choice", selectedOptionIds: ["lose_health"] }, heatWaveContent);
    if (!second.ok) throw new Error(second.error.message);
    expect(second.state.players[0]?.health).toBe(1);
    expect(second.state.pendingHeatWave).toBeUndefined();
    expect(second.state.replacementWindow).toBe(true);
    expect(second.state.stateVersion).toBe(first.state.stateVersion + 1);
  });

  it("does not offer an already Delayed investigator the Delay option", () => {
    const before = heatWaveReady();
    before.players[1]!.delayed = true;
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, heatWaveContent, createDeterministicEngineContext({ ids: ["first-choice"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    expect(offered.state.pendingDecision?.optionIds).toEqual(["lose_health"]);
    expect(executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "first-choice", selectedOptionIds: ["become_delayed"] }, heatWaveContent))
      .toMatchObject({ ok: false, error: { code: "INVALID_DECISION_SELECTION" } });
  });

  it("resumes the next Heat Wave choice after a lethal Health loss is resolved", () => {
    const before = heatWaveReady();
    before.players[1]!.health = 2;
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, heatWaveContent, createDeterministicEngineContext({ ids: ["first-choice"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    const first = executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "first-choice", selectedOptionIds: ["lose_health"] }, heatWaveContent);
    if (!first.ok) throw new Error(first.error.message);
    expect(first.state.pendingDefeat?.playerId).toBe("guest");
    expect(first.state.pendingHeatWave?.remainingPlayerIds).toEqual(["host"]);
    expect(first.state.players[0]?.health).toBe(4);
    const resumed = executeCommand(first.state, "guest", { type: "RESOLVE_DEFEAT", cityId: "arkham", cause: "health", leadPlayerId: "host" }, heatWaveContent, createDeterministicEngineContext({ ids: ["second-choice"] }));
    if (!resumed.ok) throw new Error(resumed.error.message);
    expect(resumed.state.pendingDecision?.playerId).toBe("host");
    expect(resumed.state.pendingHeatWave?.remainingPlayerIds).toEqual([]);
    const completed = executeCommand(resumed.state, "host", { type: "RESOLVE_DECISION", decisionId: "second-choice", selectedOptionIds: ["become_delayed"] }, heatWaveContent);
    if (!completed.ok) throw new Error(completed.error.message);
    expect(completed.state.players[0]?.delayed).toBe(true);
    expect(completed.state.replacementWindow).toBe(true);
  });

  it("guards unsupported awakening before a lethal Health choice changes state", () => {
    const before = heatWaveReady();
    before.ancientOneId = "cthulhu";
    before.doom = 1;
    before.players[1]!.health = 2;
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, heatWaveContent, createDeterministicEngineContext({ ids: ["first-choice"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    expect(executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "first-choice", selectedOptionIds: ["lose_health"] }, heatWaveContent))
      .toMatchObject({ ok: false, error: { code: "AWAKENING_UNSUPPORTED" } });
    expect(offered.state.players[1]?.health).toBe(2);
    expect(offered.state.pendingDecision?.id).toBe("first-choice");
  });

  const tornContent: GameContent = { ...content,
    map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city", london: "city", rome: "city" } },
    gates: [
      { id: "gate_arkham", locationId: "arkham", omenSymbol: "eclipse" },
      { id: "gate_rome", locationId: "rome", omenSymbol: "eclipse" },
      { id: "gate_london", locationId: "london", omenSymbol: "constellation" },
    ],
    investigators: { akachi_onyele: { startingLocationId: "arkham", health: 5, sanity: 7, skills: { lore: 3, influence: 2, observation: 2, strength: 2, will: 4 }, startingAssetIds: [], startingClues: 0 } },
    mythosCards: [{ id: "mythos_green_08", color: "green", icons: [{ type: "advance_omen" }, { type: "monster_surge" }, { type: "spawn_clues" }], effect: { type: "torn_asunder" } }],
  };

  function tornReady(): GameState {
    const before = state();
    before.currentMythosCardId = "mythos_green_08";
    before.currentMythosIconIndex = 3;
    before.omen = 2;
    before.doom = 8;
    before.activeGateIds = ["gate_arkham", "gate_rome"];
    before.players[1] = { ...before.players[1]!, investigatorId: "jim_culver", locationId: "arkham", health: 4, sanity: 4 };
    before.players[0] = { ...before.players[0]!, investigatorId: "trish_scarborough", locationId: "london", health: 4, sanity: 4 };
    return before;
  }

  it("loses Health equal to matching Gates and closes after nonlethal losses", () => {
    const before = tornReady();
    const resolved = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, tornContent, createDeterministicEngineContext({}));
    if (!resolved.ok) throw new Error(resolved.error.message);
    expect(resolved.state.players.map(player => player.health)).toEqual([2, 2]);
    expect(resolved.events.filter(event => event.type === "INVESTIGATOR_DAMAGED").map(event => event.playerId)).toEqual(["guest", "host"]);
    expect(resolved.state.pendingMythosDamage).toBeUndefined();
    expect(resolved.state.replacementWindow).toBe(true);
    expect(resolved.state.stateVersion).toBe(before.stateVersion + 1);
  });

  it("advances Omen rather than Doom when no Gate matches", () => {
    const before = tornReady();
    before.omen = 0;
    const resolved = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, tornContent, createDeterministicEngineContext({}));
    if (!resolved.ok) throw new Error(resolved.error.message);
    expect(resolved.state.omen).toBe(1);
    expect(resolved.state.doom).toBe(8);
    expect(resolved.state.players.map(player => player.health)).toEqual([4, 4]);
    expect(resolved.state.replacementWindow).toBe(true);
  });

  it("persists the remaining damage through one defeat choice before finishing the card", () => {
    const before = tornReady();
    before.players[1]!.health = 1;
    const first = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, tornContent, createDeterministicEngineContext({}));
    if (!first.ok) throw new Error(first.error.message);
    expect(first.state.pendingDefeat?.playerId).toBe("guest");
    expect(first.state.pendingMythosDamage?.remainingPlayerIds).toEqual(["host"]);
    expect(first.state.players[0]?.health).toBe(4);
    expect(first.state.currentMythosCardId).toBe("mythos_green_08");
    expect(executeCommand(first.state, "host", { type: "RESOLVE_DEFEAT", cityId: "arkham", cause: "health" }, tornContent))
      .toMatchObject({ ok: false, error: { code: "INVALID_DEFEAT" } });
    const second = executeCommand(first.state, "guest", { type: "RESOLVE_DEFEAT", cityId: "arkham", cause: "health", leadPlayerId: "host" }, tornContent);
    if (!second.ok) throw new Error(second.error.message);
    expect(second.state.players[0]?.health).toBe(2);
    expect(second.state.pendingDefeat).toBeUndefined();
    expect(second.state.pendingMythosDamage).toBeUndefined();
    expect(second.state.replacementWindow).toBe(true);
    expect(second.state.stateVersion).toBe(first.state.stateVersion + 1);
    expect(second.state.leadInvestigatorId).toBe("host");
  });

  it("queues two defeats and preserves a Lead seat for replacement", () => {
    const before = tornReady();
    before.players.forEach(player => { player.health = 1; });
    const first = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, tornContent, createDeterministicEngineContext({}));
    if (!first.ok) throw new Error(first.error.message);
    const second = executeCommand(first.state, "guest", { type: "RESOLVE_DEFEAT", cityId: "arkham", cause: "health", leadPlayerId: "host" }, tornContent);
    if (!second.ok) throw new Error(second.error.message);
    expect(second.state.pendingDefeat?.playerId).toBe("host");
    expect(second.state.pendingMythosDamage?.remainingPlayerIds).toEqual([]);
    const completed = executeCommand(second.state, "host", { type: "RESOLVE_DEFEAT", cityId: "london", cause: "health" }, tornContent);
    if (!completed.ok) throw new Error(completed.error.message);
    expect(completed.state.pendingDefeat).toBeUndefined();
    expect(completed.state.leadInvestigatorId).toBe("host");
    expect(completed.state.replacementWindow).toBe(true);
  });

  it("rejects unsupported awakening before applying any group damage", () => {
    const before = tornReady();
    before.ancientOneId = "cthulhu";
    before.doom = 1;
    before.players[1]!.health = 1;
    expect(executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, tornContent, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "AWAKENING_UNSUPPORTED" } });
    expect(before.players[1]?.health).toBe(1);
    expect(before.pendingMythosDamage).toBeUndefined();
  });

  const consumesContent: GameContent = { ...content,
    map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city", london: "city" } },
    gates: [{ id: "gate_arkham", locationId: "arkham", omenSymbol: "eclipse" }, { id: "gate_london", locationId: "london", omenSymbol: "constellation" }],
    mythosCards: [{ id: "mythos_green_03", color: "green", icons: [{ type: "advance_omen" }, { type: "monster_surge" }, { type: "spawn_clues" }], effect: { type: "group_discard_gate_then_advance_doom_if_nonmatching" } }],
  };

  function consumesReady(): GameState {
    const before = state();
    before.currentMythosCardId = "mythos_green_03";
    before.currentMythosIconIndex = 3;
    before.omen = 2;
    before.doom = 8;
    before.activeGateIds = ["gate_arkham", "gate_london"];
    before.privateState.deckOrderById.gates = ["gate_other"];
    return before;
  }

  it("lets the Lead choose an active matching Gate for discard without advancing Doom", () => {
    const before = consumesReady();
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, consumesContent, createDeterministicEngineContext({ ids: ["gate-choice"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    expect(offered.state.pendingDecision).toMatchObject({ kind: "choose_that_which_consumes_gate", playerId: "guest", visibility: "owner", optionIds: ["gate_arkham", "gate_london"] });
    expect(executeCommand(offered.state, "host", { type: "RESOLVE_DECISION", decisionId: "gate-choice", selectedOptionIds: ["gate_arkham"] }, consumesContent))
      .toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const resolved = executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "gate-choice", selectedOptionIds: ["gate_arkham"] }, consumesContent, createDeterministicEngineContext({}));
    if (!resolved.ok) throw new Error(resolved.error.message);
    expect(resolved.state.activeGateIds).toEqual(["gate_london"]);
    expect(resolved.state.discardedGateIds).toEqual(["gate_arkham"]);
    expect(resolved.state.doom).toBe(8);
    expect(resolved.events).toContainEqual({ type: "GATE_DISCARDED", gateId: "gate_arkham", locationId: "arkham" });
    expect(resolved.state.replacementWindow).toBe(true);
    expect(before.activeGateIds).toEqual(["gate_arkham", "gate_london"]);
  });

  it("advances Doom for a nonmatching Gate and recycles discard when the stack is empty", () => {
    const before = consumesReady();
    before.privateState.deckOrderById.gates = [];
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, consumesContent, createDeterministicEngineContext({ ids: ["gate-choice"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    const resolved = executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "gate-choice", selectedOptionIds: ["gate_london"] }, consumesContent, createDeterministicEngineContext({}));
    if (!resolved.ok) throw new Error(resolved.error.message);
    expect(resolved.state.doom).toBe(7);
    expect(resolved.state.privateState.deckOrderById.gates).toEqual(["gate_london"]);
    expect(resolved.state.discardedGateIds).toEqual([]);
    expect(resolved.events).toContainEqual({ type: "DOOM_ADVANCED", amount: 1, newDoom: 7 });
  });

  it("resolves without Gates and guards unsupported awakening", () => {
    const empty = consumesReady();
    empty.activeGateIds = [];
    const resolved = executeCommand(empty, "guest", { type: "ADVANCE_MYTHOS" }, consumesContent, createDeterministicEngineContext({}));
    if (!resolved.ok) throw new Error(resolved.error.message);
    expect(resolved.state.replacementWindow).toBe(true);
    const before = consumesReady();
    before.ancientOneId = "cthulhu";
    before.doom = 1;
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, consumesContent, createDeterministicEngineContext({ ids: ["gate-choice"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    expect(executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "gate-choice", selectedOptionIds: ["gate_london"] }, consumesContent, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "AWAKENING_UNSUPPORTED" } });
    expect(offered.state.activeGateIds).toEqual(["gate_arkham", "gate_london"]);
  });

  it("ends Azathoth at zero Doom after discarding a nonmatching Gate", () => {
    const before = consumesReady();
    before.doom = 1;
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, consumesContent, createDeterministicEngineContext({ ids: ["gate-choice"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    const resolved = executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "gate-choice", selectedOptionIds: ["gate_london"] }, consumesContent, createDeterministicEngineContext({}));
    if (!resolved.ok) throw new Error(resolved.error.message);
    expect(resolved.state.gameResult).toBe("investigators_lose");
    expect(resolved.state.stateVersion).toBe(offered.state.stateVersion + 1);
    expect(resolved.state.activeGateIds).toEqual(["gate_arkham"]);
  });

  const bermudaContent: GameContent = { ...content,
    map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city", space_8: "sea" } },
    mythosCards: [{ id: "mythos_yellow_20", color: "yellow", icons: [{ type: "advance_omen" }, { type: "resolve_reckoning" }, { type: "spawn_gates" }], effect: { type: "roll_each_investigator_for_bermuda_triangle" } }],
  };

  function bermudaReady(): GameState {
    const before = state();
    before.currentMythosCardId = "mythos_yellow_20";
    before.currentMythosIconIndex = 3;
    before.players.forEach(player => { player.locationId = "arkham"; player.delayed = false; });
    return before;
  }

  it("rolls in Lead order and moves only investigators who roll one or two", () => {
    const before = bermudaReady();
    const result = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, bermudaContent, createDeterministicEngineContext({ dice: [2, 5] }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.events.filter(event => event.type === "BERMUDA_TRIANGLE_ROLLED"))
      .toEqual([{ type: "BERMUDA_TRIANGLE_ROLLED", playerId: "guest", die: 2, moved: true }, { type: "BERMUDA_TRIANGLE_ROLLED", playerId: "host", die: 5, moved: false }]);
    expect(result.state.players[1]).toMatchObject({ locationId: "space_8", delayed: true });
    expect(result.state.players[0]).toMatchObject({ locationId: "arkham", delayed: false });
    expect(result.state.replacementWindow).toBe(true);
    expect(result.state.stateVersion).toBe(before.stateVersion + 1);
    expect(before.players.every(player => player.locationId === "arkham")).toBe(true);
  });

  it("skips defeated investigators and refuses a missing board destination", () => {
    const before = bermudaReady();
    before.players[0]!.defeated = true;
    const result = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, bermudaContent, createDeterministicEngineContext({ dice: [1] }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.events.filter(event => event.type === "BERMUDA_TRIANGLE_ROLLED")).toHaveLength(1);
    expect(result.state.players[0]?.locationId).toBe("arkham");
    const missing: GameContent = { ...bermudaContent, map: content.map };
    expect(executeCommand(bermudaReady(), "guest", { type: "ADVANCE_MYTHOS" }, missing, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "MYTHOS_CONTENT_MISSING" } });
  });

  const elderThingsContent: GameContent = { ...content,
    map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city", london: "city" } },
    monsters: [
      { id: "monster_cultist", type: "normal", horrorCheck: null, damageCheck: null, toughness: { base: 1, perInvestigator: 0 } },
      { id: "monster_ghoul", type: "normal", horrorCheck: null, damageCheck: null, toughness: { base: 1, perInvestigator: 0 } },
      { id: "monster_wraith", type: "normal", horrorCheck: null, damageCheck: null, toughness: { base: 1, perInvestigator: 0 }, spawnEffect: { type: "unsupported" } },
    ],
    mythosCards: [{ id: "mythos_green_18", color: "green", icons: [{ type: "advance_omen" }, { type: "monster_surge" }, { type: "spawn_clues" }], effect: { type: "spawn_monster_on_each_cultist_space" } }],
  };

  function elderThingsReady(): GameState {
    const before = state();
    before.currentMythosCardId = "mythos_green_18";
    before.currentMythosIconIndex = 3;
    before.monsters = [
      { id: "cultist-a", monsterId: "monster_cultist", locationId: "arkham", damage: 0 },
      { id: "cultist-b", monsterId: "monster_cultist", locationId: "arkham", damage: 0 },
      { id: "cultist-c", monsterId: "monster_cultist", locationId: "london", damage: 0 },
    ];
    before.monsterLocationIds = ["arkham", "london"];
    before.privateState.tokenPoolById.monsters = ["monster_ghoul", "monster_ghoul"];
    return before;
  }

  it("spawns one Monster on each distinct Cultist space from the private cup", () => {
    const before = elderThingsReady();
    const result = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, elderThingsContent, createDeterministicEngineContext({ tokenIndexes: [0, 0], ids: ["spawn-a", "spawn-b"] }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.events.filter(event => event.type === "MONSTER_SPAWNED").map(event => event.spawnLocationId)).toEqual(["arkham", "london"]);
    expect(result.state.monsters).toHaveLength(5);
    expect(result.state.privateState.tokenPoolById.monsters).toEqual([]);
    expect(result.state.replacementWindow).toBe(true);
    expect(result.state.stateVersion).toBe(before.stateVersion + 1);
    expect(before.monsters).toHaveLength(3);
  });

  it("resolves with no Cultists or an exhausted cup, without fabricating Monsters", () => {
    const noCultists = elderThingsReady();
    noCultists.monsters = [];
    const emptyCup = elderThingsReady();
    emptyCup.privateState.tokenPoolById.monsters = [];
    for (const before of [noCultists, emptyCup]) {
      const result = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, elderThingsContent, createDeterministicEngineContext({}));
      if (!result.ok) throw new Error(result.error.message);
      expect(result.events.some(event => event.type === "MONSTER_SPAWNED")).toBe(false);
      expect(result.state.replacementWindow).toBe(true);
    }
  });

  it("rejects an unsupported drawn spawn effect atomically", () => {
    const before = elderThingsReady();
    before.privateState.tokenPoolById.monsters = ["monster_ghoul", "monster_wraith"];
    const result = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, elderThingsContent, createDeterministicEngineContext({ tokenIndexes: [0, 0], ids: ["spawn-a", "spawn-b"] }));
    expect(result).toMatchObject({ ok: false, error: { code: "MONSTER_EFFECT_UNSUPPORTED" } });
    expect(before.monsters).toHaveLength(3);
    expect(before.privateState.tokenPoolById.monsters).toEqual(["monster_ghoul", "monster_wraith"]);
  });

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

describe("Dimensional Instability", () => {
  const cardContent: GameContent = { ...content,
    gates: [
      { id: "gate_arkham", locationId: "arkham", omenSymbol: "eclipse" },
      { id: "gate_london", locationId: "london", omenSymbol: "constellation" },
      { id: "gate_tokyo", locationId: "tokyo", omenSymbol: "constellation" },
      { id: "gate_san_francisco", locationId: "san_francisco", omenSymbol: "comet" },
    ],
    map: { ...content.map, locationTypes: { ...content.map.locationTypes, london: "city", tokyo: "city", san_francisco: "city" } },
    mythosCards: [{ id: "mythos_green_14", color: "green", icons: [{ type: "advance_omen" }, { type: "monster_surge" }, { type: "spawn_clues" }], effect: { type: "discard_matching_gates_and_advance_doom" } }],
  };

  function readyCard(): GameState {
    const before = state();
    before.currentMythosCardId = "mythos_green_14";
    before.currentMythosIconIndex = 3;
    before.omen = 1;
    before.doom = 8;
    before.activeGateIds = ["gate_arkham", "gate_london", "gate_tokyo"];
    before.privateState.deckOrderById.gates = ["gate_san_francisco"];
    before.discardedGateIds = [];
    return before;
  }

  it("discards all matching Gates, advances Doom per Gate, and preserves nonmatching Gates", () => {
    const before = readyCard();
    const result = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, cardContent, createDeterministicEngineContext({}));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(result.state.discardedGateIds).toEqual(["gate_london", "gate_tokyo"]);
    expect(result.state.doom).toBe(6);
    expect(result.state.replacementWindow).toBe(true);
    expect(result.events.filter(event => event.type === "GATE_DISCARDED")).toEqual([
      { type: "GATE_DISCARDED", gateId: "gate_london", locationId: "london" },
      { type: "GATE_DISCARDED", gateId: "gate_tokyo", locationId: "tokyo" },
    ]);
    expect(before.activeGateIds).toHaveLength(3);
  });

  it("recycles the faceup discard pile when the Gate stack is empty", () => {
    const before = readyCard();
    before.privateState.deckOrderById.gates = [];
    const result = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, cardContent, createDeterministicEngineContext({ shuffleIndexes: [0] }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.discardedGateIds).toEqual([]);
    expect(result.state.privateState.deckOrderById.gates).toEqual(["gate_tokyo", "gate_london"]);
  });

  it("consumes the Event without changing Doom when no Gate matches", () => {
    const before = readyCard();
    before.omen = 0;
    const result = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, cardContent, createDeterministicEngineContext({}));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.activeGateIds).toEqual(before.activeGateIds);
    expect(result.state.discardedGateIds).toEqual([]);
    expect(result.state.doom).toBe(8);
    expect(result.state.currentMythosCardId).toBeUndefined();
  });

  it("stops before unsupported awakening without discarding Gates", () => {
    const before = readyCard();
    before.ancientOneId = "cthulhu";
    before.doom = 2;
    expect(executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, cardContent, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "AWAKENING_UNSUPPORTED" } });
    expect(before.activeGateIds).toHaveLength(3);
    expect(before.doom).toBe(2);
  });

  it("ends the game when Azathoth reaches zero Doom", () => {
    const before = readyCard();
    before.doom = 2;
    const result = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, cardContent, createDeterministicEngineContext({}));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.gameResult).toBe("investigators_lose");
    expect(result.events).toContainEqual({ type: "GAME_ENDED", result: "investigators_lose", reason: "azathoth_awakened" });
  });
});

describe("Desperate Times", () => {
  const cardContent: GameContent = { ...content,
    conditions: [...content.conditions!, { id: "condition_dark_pact_01", kind: "dark_pact" }],
    mythosCards: [{ id: "mythos_yellow_10", color: "yellow", icons: [{ type: "advance_omen" }, { type: "resolve_reckoning" }, { type: "spawn_gates" }], effect: { type: "doom_two_unless_lead_gains_dark_pact" } }],
  };

  function readyCard(): GameState {
    const before = state();
    before.currentMythosCardId = "mythos_yellow_10";
    before.currentMythosIconIndex = 3;
    before.doom = 8;
    before.privateState.tokenPoolById["condition:dark_pact"] = ["condition_dark_pact_01"];
    return before;
  }

  it("offers the Lead a private choice and grants a physical Dark Pact without advancing Doom", () => {
    const before = readyCard();
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, cardContent, createDeterministicEngineContext({ ids: ["choice"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    expect(offered.state.pendingDecision).toMatchObject({ id: "choice", kind: "choose_desperate_times", playerId: "guest", visibility: "owner", optionIds: ["gain_dark_pact", "advance_doom"] });
    expect(executeCommand(offered.state, "host", { type: "RESOLVE_DECISION", decisionId: "choice", selectedOptionIds: ["gain_dark_pact"] }, cardContent))
      .toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const chosen = executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "choice", selectedOptionIds: ["gain_dark_pact"] }, cardContent, createDeterministicEngineContext({ tokenIndexes: [0] }));
    if (!chosen.ok) throw new Error(chosen.error.message);
    expect(chosen.state.players[1]?.conditionIds).toContain("condition_dark_pact_01");
    expect(chosen.state.privateState.tokenPoolById["condition:dark_pact"]).toEqual([]);
    expect(chosen.state.doom).toBe(8);
    expect(chosen.state.replacementWindow).toBe(true);
    expect(chosen.state.stateVersion).toBe(before.stateVersion + 2);
    expect(chosen.events).toContainEqual({ type: "CONDITION_GAINED", playerId: "guest", conditionId: "condition_dark_pact" });
  });

  it("advances Doom by two when chosen or when a Dark Pact cannot be gained", () => {
    const before = readyCard();
    const offered = executeCommand(before, "guest", { type: "ADVANCE_MYTHOS" }, cardContent, createDeterministicEngineContext({ ids: ["choice"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    const declined = executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: "choice", selectedOptionIds: ["advance_doom"] }, cardContent, createDeterministicEngineContext({}));
    if (!declined.ok) throw new Error(declined.error.message);
    expect(declined.state.doom).toBe(6);
    expect(declined.events).toContainEqual({ type: "DOOM_ADVANCED", amount: 2, newDoom: 6 });
    const alreadyHeld = readyCard();
    alreadyHeld.players[1]!.conditionIds = ["condition_dark_pact_01"];
    const automatic = executeCommand(alreadyHeld, "guest", { type: "ADVANCE_MYTHOS" }, cardContent, createDeterministicEngineContext({}));
    if (!automatic.ok) throw new Error(automatic.error.message);
    expect(automatic.state.pendingDecision).toBeUndefined();
    expect(automatic.state.doom).toBe(6);
    const emptySupply = readyCard();
    emptySupply.privateState.tokenPoolById["condition:dark_pact"] = [];
    const exhausted = executeCommand(emptySupply, "guest", { type: "ADVANCE_MYTHOS" }, cardContent, createDeterministicEngineContext({}));
    if (!exhausted.ok) throw new Error(exhausted.error.message);
    expect(exhausted.state.doom).toBe(6);
  });

  it("ends at Azathoth zero Doom and guards unsupported awakening", () => {
    const azathoth = readyCard();
    azathoth.doom = 1;
    azathoth.privateState.tokenPoolById["condition:dark_pact"] = [];
    const lost = executeCommand(azathoth, "guest", { type: "ADVANCE_MYTHOS" }, cardContent, createDeterministicEngineContext({}));
    if (!lost.ok) throw new Error(lost.error.message);
    expect(lost.state.gameResult).toBe("investigators_lose");
    expect(lost.events).toContainEqual({ type: "GAME_ENDED", result: "investigators_lose", reason: "azathoth_awakened" });
    const cthulhu = readyCard();
    cthulhu.ancientOneId = "cthulhu";
    cthulhu.doom = 2;
    cthulhu.privateState.tokenPoolById["condition:dark_pact"] = [];
    expect(executeCommand(cthulhu, "guest", { type: "ADVANCE_MYTHOS" }, cardContent, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "AWAKENING_UNSUPPORTED" } });
    expect(cthulhu.currentMythosCardId).toBe("mythos_yellow_10");
    expect(cthulhu.doom).toBe(2);
  });
});
