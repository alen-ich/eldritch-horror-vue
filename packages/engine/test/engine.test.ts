import { describe, expect, it } from "vitest";
import {
  applyMysteryProgress,
  delayInvestigator,
  drawMythosCard,
  damageInvestigator,
  resolveCombatEncounter,
  openReplacementWindow,
  createDeterministicEngineContext,
  createLobby,
  executeCommand,
  advanceEncounterInvestigator,
  legalLocationEncounterDecks,
  projectPublicState,
  projectStateForPlayer,
  type GameContent,
  type GameState,
} from "../src/index.js";

const testContent: GameContent = {
  monsters: [
    { id: "monster_test", type: "normal", horrorCheck: null, damageCheck: { modifier: 0, damage: 2 }, toughness: { base: 2, perInvestigator: 0 } },
    { id: "monster_special", type: "normal", horrorCheck: null, damageCheck: { modifier: 0, damage: 2 }, toughness: { base: 2, perInvestigator: 0 }, specialEffect: "unimplemented" },
  ],
  map: {
    adjacentLocationIds: {
      san_francisco: ["space_1"],
      space_1: ["san_francisco", "space_4"],
      space_4: ["space_1"],
      space_15: ["space_10"],
      space_16: ["space_14"],
    },
    routes: [
      { source: "san_francisco", target: "space_1", type: "ship" },
      { source: "space_1", target: "space_4", type: "uncharted" },
      { source: "space_15", target: "space_10", type: "uncharted" },
      { source: "space_16", target: "space_14", type: "train" },
    ],
    locationTypes: { san_francisco: "city", space_1: "city", space_4: "wilderness", space_15: "city", space_16: "wilderness" },
  },
  investigators: {
    akachi_onyele: { startingLocationId: "space_15", health: 5, sanity: 7, skills: { lore: 3, influence: 2, observation: 2, strength: 2, will: 4 }, startingAssetIds: [], startingClues: 1 },
    trish_scarborough: { startingLocationId: "space_16", health: 7, sanity: 5, skills: { lore: 1, influence: 3, observation: 4, strength: 3, will: 2 }, startingAssetIds: ["asset_45_automatic"], startingClues: 0 },
  },
  assets: [
    { id: "asset_45_automatic", value: 3, engineEffects: [] },
    { id: "asset_bandages", value: 1, engineEffects: [] },
    { id: "asset_whiskey", value: 1, engineEffects: [] },
    { id: "asset_axe", value: 2, engineEffects: [] },
    { id: "asset_holy_water", value: 2, engineEffects: [] },
    { id: "asset_arcane_tome", value: 3, engineEffects: [] },
    { id: "asset_personal_assistant", value: 2, engineEffects: [{ type: "skill_bonus", skill: "influence", amount: 1 }] },
    { id: "asset_fine_clothes", value: 2, engineEffects: [{ type: "acquire_six_counts_as_two" }] },
    { id: "asset_king_james_bible", value: 2, engineEffects: [{ type: "rest_recover_additional_sanity", amount: 1 }] },
    { id: "asset_private_care", value: 2, engineEffects: [{ type: "on_gain_recover_all_and_discard" }] },
  ],
  mysteryIdsByAncientOne: {
    cthulhu: ["cthulhu_one", "cthulhu_two", "cthulhu_three", "cthulhu_four"],
    yog_sothoth: ["yog_one", "yog_two", "yog_three", "yog_four"],
  },
  mysteryTargetsById: {
    cthulhu_one: "investigator_count", cthulhu_two: "half_investigator_count", cthulhu_three: "one", cthulhu_four: "twice_investigator_count",
    yog_one: "one", yog_two: "one", yog_three: "one", yog_four: "one",
  },
};

function startedGame(): GameState {
  return {
    stateVersion: 3,
    phase: "action",
    activePlayerId: "host",
    leadInvestigatorId: "host",
    ancientOneId: "cthulhu",
    turnNumber: 1,
    actionsRemaining: 2,
    performedActions: [],
    monsterLocationIds: [],
    reserveAssetIds: [],
    assetDiscardIds: [],
    activeMysteryId: "cthulhu_one",
    mysteryProgress: 0,
    mysteryTarget: 2,
    completedMysteryIds: [],
    privateState: { deckOrderById: {}, tokenPoolById: {} },
    players: [
      { id: "host", investigatorId: "akachi_onyele", locationId: "san_francisco", health: 4, sanity: 6, maxHealth: 5, maxSanity: 7, travelTickets: [], assetIds: [], clues: 1, skillImprovements: {} },
      { id: "guest", investigatorId: "trish_scarborough", locationId: "san_francisco", health: 7, sanity: 5, maxHealth: 7, maxSanity: 5, travelTickets: [], assetIds: ["asset_45_automatic"], clues: 0, skillImprovements: {} },
    ],
  };
}

describe("encounter phase ordering and legal location decks", () => {
  it("offers general and regional decks at a named city, but only general elsewhere", () => {
    const game = startedGame();
    game.phase = "encounter";
    expect(legalLocationEncounterDecks(game, "host", testContent)).toEqual(["general", "america"]);
    game.players[0]!.locationId = "space_4";
    expect(legalLocationEncounterDecks(game, "host", testContent)).toEqual(["general"]);
    game.monsters = [{ id: "m1", monsterId: "monster_test", locationId: "space_4", damage: 0 }];
    expect(legalLocationEncounterDecks(game, "host", testContent)).toEqual([]);
    game.monsters = [];
    expect(legalLocationEncounterDecks(game, "guest", testContent)).toEqual([]);
  });

  it("advances from Lead through surviving investigators and then enters Mythos", () => {
    const game = startedGame();
    game.phase = "encounter";
    game.leadInvestigatorId = "guest";
    game.activePlayerId = "guest";
    const first = advanceEncounterInvestigator(game, "guest");
    expect(first).toMatchObject({ ok: true, state: { phase: "encounter", activePlayerId: "host" } });
    if (!first.ok) return;
    expect(advanceEncounterInvestigator(first.state, "guest")).toMatchObject({ ok: false, error: { code: "WRONG_PHASE" } });
    const last = advanceEncounterInvestigator(first.state, "host");
    expect(last).toMatchObject({ ok: true, state: { phase: "mythos", activePlayerId: "guest" } });
    expect(game.phase).toBe("encounter");
  });

  it("skips defeated investigators and refuses advancement during a pending decision", () => {
    const game = startedGame();
    game.phase = "encounter";
    game.players[1]!.defeated = true;
    expect(advanceEncounterInvestigator(game, "host")).toMatchObject({ ok: true, state: { phase: "mythos" } });
    game.pendingDecision = { id: "d", kind: "choose_encounter", playerId: "host", visibility: "owner", prompt: "Choose", optionIds: ["general"], minSelections: 1, maxSelections: 1 };
    expect(advanceEncounterInvestigator(game, "host")).toMatchObject({ ok: false, error: { code: "WRONG_PHASE" } });
  });
});

describe("Mythos to next round handoff", () => {
  it("lets only the Lead begin a fresh Action round after replacement timing", () => {
    const game = startedGame();
    game.phase = "mythos";
    game.leadInvestigatorId = "guest";
    game.activePlayerId = "guest";
    game.turnNumber = 2;
    game.replacementWindow = true;
    game.usedConditionActionIds = ["condition_action:guest:c1"];
    expect(executeCommand(game, "host", { type: "BEGIN_NEXT_ROUND" }, testContent)).toMatchObject({ ok: false, error: { code: "WRONG_PHASE" } });
    const started = executeCommand(game, "guest", { type: "BEGIN_NEXT_ROUND" }, testContent);
    if (!started.ok) throw new Error(started.error.message);
    expect(started.state).toMatchObject({ phase: "action", activePlayerId: "guest", turnNumber: 3, actionsRemaining: 2, replacementWindow: false });
    expect(started.state.usedConditionActionIds).toEqual([]);
    expect(executeCommand(started.state, "guest", { type: "BEGIN_NEXT_ROUND" }, testContent)).toMatchObject({ ok: false, error: { code: "WRONG_PHASE" } });
    const next = executeCommand(started.state, "guest", { type: "END_ACTIONS" }, testContent);
    if (!next.ok) throw new Error(next.error.message);
    expect(next.state.activePlayerId).toBe("host");
  });

  it("does not skip an unresolved card or permit a next round without replacement timing", () => {
    const game = startedGame();
    game.phase = "mythos";
    game.replacementWindow = true;
    game.currentMythosCardId = "mythos_green_04";
    expect(executeCommand(game, "host", { type: "BEGIN_NEXT_ROUND" }, testContent)).toMatchObject({ ok: false, error: { code: "WRONG_PHASE" } });
    game.currentMythosCardId = undefined;
    game.replacementWindow = false;
    expect(executeCommand(game, "host", { type: "BEGIN_NEXT_ROUND" }, testContent)).toMatchObject({ ok: false, error: { code: "WRONG_PHASE" } });
    expect(game.turnNumber).toBe(1);
  });
});

describe("Condition recovery during Rest", () => {
  const conditionContent: GameContent = { ...testContent, conditions: [
    { id: "condition_leg_injury_01", kind: "leg_injury" },
    { id: "condition_paranoia_01", kind: "paranoia" },
    { id: "condition_debt_01", kind: "debt" },
  ] };

  it("offers optional rolls and returns successful copies to their supplies", () => {
    const before = startedGame();
    before.players[0]!.conditionIds = ["condition_leg_injury_01", "condition_paranoia_01", "condition_debt_01"];
    before.privateState.tokenPoolById["condition:leg_injury"] = [];
    before.privateState.tokenPoolById["condition:paranoia"] = [];
    const rested = executeCommand(before, "host", { type: "REST" }, conditionContent,
      createDeterministicEngineContext({ ids: ["recover"] }));
    expect(rested.ok).toBe(true);
    if (!rested.ok) return;
    expect(rested.state.pendingDecision?.optionIds).toEqual(["condition_leg_injury", "condition_paranoia"]);
    expect(rested.state.actionsRemaining).toBe(2);
    const recovered = executeCommand(rested.state, "host", { type: "RESOLVE_DECISION", decisionId: "recover", selectedOptionIds: ["condition_leg_injury", "condition_paranoia"] }, conditionContent,
      createDeterministicEngineContext({ dice: [5, 4] }));
    expect(recovered.ok).toBe(true);
    if (!recovered.ok) return;
    expect(recovered.state.players[0]!.conditionIds).toEqual(["condition_paranoia_01", "condition_debt_01"]);
    expect(recovered.state.privateState.tokenPoolById["condition:leg_injury"]).toEqual(["condition_leg_injury_01"]);
    expect(recovered.state.actionsRemaining).toBe(1);
  });

  it("allows skipping recovery and rejects an unoffered card", () => {
    const before = startedGame();
    before.players[0]!.conditionIds = ["condition_leg_injury_01", "condition_debt_01"];
    const rested = executeCommand(before, "host", { type: "REST" }, conditionContent,
      createDeterministicEngineContext({ ids: ["recover"] }));
    if (!rested.ok) throw new Error("Rest setup failed");
    const snapshot = structuredClone(rested.state);
    expect(executeCommand(rested.state, "host", { type: "RESOLVE_DECISION", decisionId: "recover", selectedOptionIds: ["condition_debt"] }, conditionContent))
      .toMatchObject({ ok: false, error: { code: "INVALID_DECISION_SELECTION" } });
    expect(rested.state).toEqual(snapshot);
    const skipped = executeCommand(rested.state, "host", { type: "RESOLVE_DECISION", decisionId: "recover", selectedOptionIds: [] }, conditionContent);
    expect(skipped).toMatchObject({ ok: true, state: { actionsRemaining: 1 } });
  });
});

describe("Condition local actions", () => {
  const conditionContent: GameContent = { ...testContent, conditions: [
    { id: "condition_debt_01", kind: "debt" },
    { id: "condition_detained_01", kind: "detained" },
  ] };

  it("lets an investigator on the same space clear Debt with a passing Influence test", () => {
    const before = startedGame();
    before.players[0]!.clues = 0;
    before.players[1]!.conditionIds = ["condition_debt_01"];
    const result = executeCommand(before, "host", { type: "USE_CONDITION_ACTION", targetPlayerId: "guest", conditionKind: "debt" }, conditionContent,
      createDeterministicEngineContext({ dice: [5, 1], ids: ["test"] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[1]!.conditionIds).toEqual([]);
    expect(result.state.privateState.tokenPoolById["condition:debt"]).toEqual(["condition_debt_01"]);
    expect(result.state.usedConditionActionIds).toEqual(["condition_action:guest:condition_debt"]);
    expect(result.state.actionsRemaining).toBe(1);
    expect(executeCommand(result.state, "host", { type: "USE_CONDITION_ACTION", targetPlayerId: "guest", conditionKind: "debt" }, conditionContent))
      .toMatchObject({ ok: false, error: { code: "CONDITION_ACTION_INVALID" } });
  });

  it("keeps a failed Condition and supports a Clue reroll before completion", () => {
    const before = startedGame();
    before.players[0]!.conditionIds = ["condition_debt_01"];
    const initiated = executeCommand(before, "host", { type: "USE_CONDITION_ACTION", targetPlayerId: "host", conditionKind: "debt" }, conditionContent,
      createDeterministicEngineContext({ dice: [1, 2], ids: ["test", "reroll"] }));
    expect(initiated.ok).toBe(true);
    if (!initiated.ok) return;
    expect(initiated.state.pendingDecision?.kind).toBe("select_rerolls");
    const resolved = executeCommand(initiated.state, "host", { type: "RESOLVE_DECISION", decisionId: "reroll", selectedOptionIds: ["die-0"] }, conditionContent,
      createDeterministicEngineContext({ dice: [5] }));
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.players[0]!.conditionIds).toEqual([]);
    expect(resolved.state.actionsRemaining).toBe(1);
  });

  it("restricts a Detained investigator to the action on their own card", () => {
    const before = startedGame();
    before.players[0]!.conditionIds = ["condition_detained_01"];
    before.players[1]!.conditionIds = ["condition_debt_01"];
    expect(executeCommand(before, "host", { type: "REST" }, conditionContent))
      .toMatchObject({ ok: false, error: { code: "CONDITION_RESTRICTED" } });
    expect(executeCommand(before, "host", { type: "TRAVEL", destinationIds: ["space_1"] }, conditionContent))
      .toMatchObject({ ok: false, error: { code: "CONDITION_RESTRICTED" } });
    expect(executeCommand(before, "host", { type: "USE_CONDITION_ACTION", targetPlayerId: "guest", conditionKind: "debt" }, conditionContent))
      .toMatchObject({ ok: false, error: { code: "CONDITION_RESTRICTED" } });
    before.players[0]!.clues = 0;
    const resolved = executeCommand(before, "host", { type: "USE_CONDITION_ACTION", targetPlayerId: "host", conditionKind: "detained" }, conditionContent,
      createDeterministicEngineContext({ dice: [5, 1], ids: ["test"] }));
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.players[0]!.conditionIds).toEqual([]);
    expect(before.players[0]!.conditionIds).toEqual(["condition_detained_01"]);
  });
});

describe("combat encounter integration", () => {
  function combatState(): GameState {
    const state = startedGame();
    state.phase = "encounter";
    state.doom = 12;
    state.monsters = [{ id: "token-1", monsterId: "monster_test", locationId: "san_francisco", damage: 0 }];
    state.monsterLocationIds = ["san_francisco"];
    return state;
  }

  it("preserves partial Monster damage and investigator Health loss", () => {
    const state = combatState();
    const result = resolveCombatEncounter(state, "host", "token-1", testContent, createDeterministicEngineContext({ dice: [5, 1] }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.monsters?.[0]).toMatchObject({ damage: 1 });
    expect(result.state.players[0]?.health).toBe(3);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "COMBAT_RESOLVED", monsterHealthLost: 1, healthLost: 1 }));
    expect(state.monsters?.[0]?.damage).toBe(0);
  });

  it("returns a defeated normal Monster to the cup even on simultaneous investigator defeat", () => {
    const state = combatState();
    state.players[0]!.health = 1;
    const content = { ...testContent, monsters: [{ ...testContent.monsters![0]!, toughness: { base: 1, perInvestigator: 0 } }] };
    const result = resolveCombatEncounter(state, "host", "token-1", content, createDeterministicEngineContext({ dice: [5, 1] }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.monsters).toEqual([]);
    expect(result.state.privateState.tokenPoolById.monsters).toEqual(["monster_test"]);
    expect(result.state.players[0]?.defeated).toBe(true);
    expect(result.state.pendingDefeat).toMatchObject({ playerId: "host" });
    expect(result.events.map(event => event.type)).toContain("MONSTER_DEFEATED");
    expect(state.monsters).toHaveLength(1);
  });

  it("rejects illegal and unsupported combat without mutating state or rolling", () => {
    const state = combatState();
    const context = createDeterministicEngineContext({ dice: [] });
    expect(resolveCombatEncounter(state, "guest", "token-1", testContent, context)).toMatchObject({ ok: false, error: { code: "WRONG_PHASE" } });
    expect(resolveCombatEncounter(state, "host", "missing", testContent, context)).toMatchObject({ ok: false, error: { code: "INVALID_COMBAT" } });
    state.monsters![0]!.monsterId = "monster_special";
    expect(resolveCombatEncounter(state, "host", "token-1", testContent, context)).toMatchObject({ ok: false, error: { code: "MONSTER_EFFECT_UNSUPPORTED" } });
    expect(state.players[0]?.health).toBe(4);
  });

  it("requires each Monster once before a location encounter and advances after an undefeated Monster survives", () => {
    const state = combatState();
    state.monsters!.push({ id: "token-2", monsterId: "monster_test", locationId: "san_francisco", damage: 0 });
    const first = executeCommand(state, "host", { type: "FIGHT_MONSTER", monsterInstanceId: "token-1" }, testContent, createDeterministicEngineContext({ dice: [5, 5] }));
    if (!first.ok) throw new Error(first.error.message);
    expect(first.state.stateVersion).toBe(state.stateVersion + 1);
    expect(first.state.activePlayerId).toBe("host");
    expect(first.state.monsters?.map(monster => monster.id)).toEqual(["token-2"]);
    expect(legalLocationEncounterDecks(first.state, "host", testContent)).toEqual([]);
    expect(executeCommand(first.state, "host", { type: "FIGHT_MONSTER", monsterInstanceId: "token-1" }, testContent, createDeterministicEngineContext({ dice: [] }))).toMatchObject({ ok: false, error: { code: "INVALID_COMBAT" } });
    const second = executeCommand(first.state, "host", { type: "FIGHT_MONSTER", monsterInstanceId: "token-2" }, testContent, createDeterministicEngineContext({ dice: [1, 1] }));
    if (!second.ok) throw new Error(second.error.message);
    expect(second.state.stateVersion).toBe(first.state.stateVersion + 1);
    expect(second.state.monsters).toHaveLength(1);
    expect(second.state.activePlayerId).toBe("guest");
    expect(second.state.encounteredMonsterInstanceIds).toEqual([]);
  });

  it("allows a location encounter after defeating the last Monster", () => {
    const state = combatState();
    const result = executeCommand(state, "host", { type: "FIGHT_MONSTER", monsterInstanceId: "token-1" }, testContent, createDeterministicEngineContext({ dice: [5, 5] }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.activePlayerId).toBe("host");
    expect(legalLocationEncounterDecks(result.state, "host", testContent)).toEqual(["general", "america"]);
    expect(result.state.privateState.tokenPoolById.monsters).toEqual(["monster_test"]);
  });

  it("moves past the active investigator after combat defeat is resolved", () => {
    const state = combatState();
    state.players[0]!.health = 1;
    const fought = executeCommand(state, "host", { type: "FIGHT_MONSTER", monsterInstanceId: "token-1" }, testContent, createDeterministicEngineContext({ dice: [1, 1] }));
    if (!fought.ok) throw new Error(fought.error.message);
    expect(fought.state.pendingDefeat?.playerId).toBe("host");
    const defeated = executeCommand(fought.state, "host", { type: "RESOLVE_DEFEAT", cityId: "san_francisco", cause: "health", leadPlayerId: "guest" }, testContent);
    if (!defeated.ok) throw new Error(defeated.error.message);
    expect(defeated.state.phase).toBe("encounter");
    expect(defeated.state.activePlayerId).toBe("guest");
    expect(defeated.state.leadInvestigatorId).toBe("guest");
    expect(defeated.state.encounteredMonsterInstanceIds).toEqual([]);
  });
});

describe("executeCommand", () => {
  it("interrupts a defeated investigator and preserves their possessions on their sheet", () => {
    const state = startedGame();
    state.privateState.tokenPoolById.clues = [];
    state.privateState.tokenPoolById["held_clues:host"] = ["clue_arkham"];
    state.doom = 12;
    const damaged = damageInvestigator(state, "host", 99, 0, testContent);
    if (!damaged.ok) throw new Error(damaged.error.message);
    expect(damaged.state.doom).toBe(11);
    expect(damaged.state.players[0]?.defeated).toBe(true);
    expect(executeCommand(damaged.state, "host", { type: "REST" }, testContent).ok).toBe(false);
    const resolved = executeCommand(damaged.state, "host", { type: "RESOLVE_DEFEAT", cityId: "san_francisco", cause: "health", leadPlayerId: "guest" }, testContent);
    if (!resolved.ok) throw new Error(resolved.error.message);
    expect(resolved.state.activePlayerId).toBe("guest");
    expect(resolved.state.leadInvestigatorId).toBe("guest");
    expect(resolved.state.defeatedInvestigators?.[0]).toMatchObject({ investigatorId: "akachi_onyele", clues: 1, cause: "health" });
    expect(resolved.state.privateState.tokenPoolById["defeated_clues:akachi_onyele"]).toEqual(["clue_arkham"]);
    expect(resolved.state.privateState.tokenPoolById["held_clues:host"]).toEqual([]);
    expect(projectPublicState(resolved.state)).not.toHaveProperty("privateState");
    expect(resolved.state.players[0]?.clues).toBe(0);
    expect(state.players[0]?.health).toBe(4);
  });

  it("offers both causes for simultaneous depletion and blocks premature replacement", () => {
    const damaged = damageInvestigator(startedGame(), "guest", 99, 99, testContent);
    if (!damaged.ok) throw new Error(damaged.error.message);
    expect(damaged.state.pendingDefeat?.causes).toEqual(["health", "sanity"]);
    expect(openReplacementWindow(damaged.state).ok).toBe(false);
    expect(executeCommand(damaged.state, "guest", { type: "REPLACE_INVESTIGATOR", investigatorId: "leo_anderson" }, testContent).ok).toBe(false);
  });

  it("replaces an investigator only in the end-of-Mythos window", () => {
    const state = startedGame();
    state.phase = "mythos";
    state.players[0]!.defeated = true;
    state.defeatedInvestigators = [{ investigatorId: "akachi_onyele", locationId: "san_francisco", cause: "health", assetIds: [], clues: 1, travelTickets: [] }];
    const content = { ...testContent, investigators: { ...testContent.investigators, leo_anderson: testContent.investigators.akachi_onyele! } };
    const window = openReplacementWindow(state);
    if (!window.ok) throw new Error(window.error.message);
    const replaced = executeCommand(window.state, "host", { type: "REPLACE_INVESTIGATOR", investigatorId: "leo_anderson" }, content);
    if (!replaced.ok) throw new Error(replaced.error.message);
    expect(replaced.state.players[0]).toMatchObject({ investigatorId: "leo_anderson", defeated: false, health: 5, sanity: 7 });
    expect(replaced.state.defeatedInvestigators).toHaveLength(1);
  });

  it("draws a replacement's starting physical Clues without duplicating defeated holdings", () => {
    const before = startedGame();
    before.phase = "mythos";
    before.players[0]!.defeated = true;
    before.players[0]!.clues = 0;
    before.privateState.tokenPoolById.clues = ["clue_london"];
    before.privateState.tokenPoolById.clue_discard = [];
    before.privateState.tokenPoolById["held_clues:host"] = [];
    before.privateState.tokenPoolById["defeated_clues:akachi_onyele"] = ["clue_arkham"];
    before.defeatedInvestigators = [{ investigatorId: "akachi_onyele", locationId: "san_francisco", cause: "health", assetIds: [], clues: 1, travelTickets: [] }];
    const replacementContent: GameContent = { ...testContent,
      clues: [{ id: "clue_arkham", locationId: "san_francisco" }, { id: "clue_london", locationId: "space_15" }],
      investigators: { ...testContent.investigators, leo_anderson: testContent.investigators.akachi_onyele! },
    };
    const window = openReplacementWindow(before);
    if (!window.ok) throw new Error(window.error.message);
    const result = executeCommand(window.state, "host", { type: "REPLACE_INVESTIGATOR", investigatorId: "leo_anderson" }, replacementContent);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0]?.clues).toBe(1);
    expect(result.state.privateState.tokenPoolById["held_clues:host"]).toEqual(["clue_london"]);
    expect(result.state.privateState.tokenPoolById["defeated_clues:akachi_onyele"]).toEqual(["clue_arkham"]);
    expect(result.state.privateState.tokenPoolById.clues).toEqual([]);
  });
  it("requires the recipient's consent and exchanges possessions atomically", () => {
    const state = startedGame();
    state.privateState.tokenPoolById.clues = [];
    state.privateState.tokenPoolById.clue_discard = [];
    state.privateState.tokenPoolById["held_clues:host"] = ["clue_arkham"];
    state.privateState.tokenPoolById["held_clues:guest"] = [];
    const give = { assetIds: [], clues: 1, tickets: [] };
    const receive = { assetIds: ["asset_45_automatic"], clues: 0, tickets: [] };
    const result = executeCommand(state, "host", { type: "OFFER_TRADE", targetPlayerId: "guest", give, receive }, testContent, createDeterministicEngineContext({ ids: ["trade-1"] }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players).toEqual(state.players);
    expect(executeCommand(result.state, "host", { type: "ANSWER_TRADE", offerId: "trade-1", accept: true }, testContent).ok).toBe(false);
    const accepted = executeCommand(result.state, "guest", { type: "ANSWER_TRADE", offerId: "trade-1", accept: true }, testContent);
    if (!accepted.ok) throw new Error(accepted.error.message);
    expect(accepted.state.players[0]).toMatchObject({ clues: 0, assetIds: ["asset_45_automatic"] });
    expect(accepted.state.players[1]).toMatchObject({ clues: 1, assetIds: [] });
    expect(accepted.state.privateState.tokenPoolById["held_clues:host"]).toEqual([]);
    expect(accepted.state.privateState.tokenPoolById["held_clues:guest"]).toEqual(["clue_arkham"]);
    expect(accepted.state.actionsRemaining).toBe(1);
    expect(accepted.state.tradeOffer).toBeUndefined();
  });

  it("rejects remote trades and ticket overflow without mutations", () => {
    const state = startedGame();
    state.players[0]!.travelTickets = ["ship"];
    state.players[1]!.travelTickets = ["train", "train"];
    const snapshot = structuredClone(state);
    const command = { type: "OFFER_TRADE" as const, targetPlayerId: "guest", give: { assetIds: [], clues: 0, tickets: ["ship" as const] }, receive: { assetIds: [], clues: 0, tickets: [] } };
    expect(executeCommand(state, "host", command, testContent).ok).toBe(false);
    expect(state).toEqual(snapshot);
    state.players[1]!.locationId = "space_1";
    expect(executeCommand(state, "host", command, testContent).ok).toBe(false);
  });
  it("ends the active investigator's actions immediately when delayed", () => {
    const state = startedGame();
    const result = delayInvestigator(state, "host");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.activePlayerId).toBe("guest");
    expect(result.state.players[0]?.delayed).not.toBe(true);
    expect(state.activePlayerId).toBe("host");
  });

  it("stands up and skips a delayed investigator when their action turn starts", () => {
    const delayed = delayInvestigator(startedGame(), "guest");
    if (!delayed.ok) throw new Error("Delay failed");
    expect(delayed.state.players[1]?.delayed).toBe(true);
    const result = executeCommand(delayed.state, "host", { type: "END_ACTIONS" }, testContent);
    if (!result.ok) throw new Error("End actions failed");
    expect(result.state.phase).toBe("encounter");
    expect(result.state.players[1]?.delayed).toBe(false);
    expect(result.events).toContainEqual({ type: "INVESTIGATOR_STOOD_UP", playerId: "guest" });
  });
  it("increments the state version exactly once for an accepted command", () => {
    const result = executeCommand(startedGame(), "host", { type: "REST" }, testContent);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.stateVersion).toBe(4);
  });

  it("does not mutate or advance state for a rejected command", () => {
    const state = startedGame();
    const snapshot = structuredClone(state);
    const result = executeCommand(state, "guest", { type: "REST" }, testContent);
    expect(result).toMatchObject({ ok: false, error: { code: "NOT_ACTIVE_PLAYER" } });
    expect(state).toEqual(snapshot);
  });

  it("starts a two-player lobby when every investigator is selected", () => {
    let state = createLobby(["host", "guest"]);
    const selectedHost = executeCommand(state, "host", { type: "SELECT_INVESTIGATOR", investigatorId: "akachi_onyele" }, testContent);
    expect(selectedHost.ok).toBe(true);
    if (!selectedHost.ok) return;
    state = selectedHost.state;
    const selectedGuest = executeCommand(state, "guest", { type: "SELECT_INVESTIGATOR", investigatorId: "trish_scarborough" }, testContent);
    expect(selectedGuest.ok).toBe(true);
    if (!selectedGuest.ok) return;
    const selectedAncientOne = executeCommand(selectedGuest.state, "host", { type: "SELECT_ANCIENT_ONE", ancientOneId: "cthulhu" }, testContent);
    expect(selectedAncientOne.ok).toBe(true);
    if (!selectedAncientOne.ok) return;
    const clueContent: GameContent = { ...testContent, clues: [
      { id: "clue_space_15", locationId: "space_15" },
      { id: "clue_space_16", locationId: "space_16" },
      { id: "clue_san_francisco", locationId: "san_francisco" },
    ] };
    const context = createDeterministicEngineContext({ shuffleIndexes: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0] });
    const started = executeCommand(selectedAncientOne.state, "host", { type: "START_GAME" }, clueContent, context);
    const badClueContent: GameContent = { ...clueContent, clues: [clueContent.clues![0]!, clueContent.clues![0]!] };
    const beforeBadStart = structuredClone(selectedAncientOne.state);
    expect(executeCommand(selectedAncientOne.state, "host", { type: "START_GAME" }, badClueContent,
      createDeterministicEngineContext({ shuffleIndexes: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0] })))
      .toMatchObject({ ok: false, error: { code: "CLUE_CONTENT_MISSING" } });
    expect(selectedAncientOne.state).toEqual(beforeBadStart);
    expect(started.ok).toBe(true);
    if (started.ok) expect(started.state).toMatchObject({
      phase: "action", activePlayerId: "host", leadInvestigatorId: "host", turnNumber: 1, actionsRemaining: 2,
      players: [
        { locationId: "space_15", health: 5, sanity: 7, assetIds: [] },
        { locationId: "space_16", health: 7, sanity: 5, assetIds: ["asset_45_automatic"] },
      ],
      activeMysteryId: "cthulhu_three",
      mysteryProgress: 0,
      mysteryTarget: 1,
      completedMysteryIds: [],
      reserveAssetIds: ["asset_whiskey", "asset_axe", "asset_holy_water", "asset_arcane_tome"],
    });
    if (started.ok) {
      expect(started.state.privateState.deckOrderById.mysteries).toEqual(["cthulhu_four", "cthulhu_two", "cthulhu_one"]);
      expect(started.state.privateState.tokenPoolById.clues).toHaveLength(2);
      expect(started.state.privateState.tokenPoolById["held_clues:host"]).toHaveLength(1);
      expect(started.state.privateState.tokenPoolById["held_clues:guest"]).toHaveLength(0);
      expect(started.state.privateState.tokenPoolById.clue_discard).toEqual([]);
      expect(JSON.stringify(projectPublicState(started.state))).not.toContain("clue_space_");
      expect(started.state.privateState.deckOrderById.assets).toEqual([
        "asset_personal_assistant",
        "asset_fine_clothes",
        "asset_king_james_bible",
        "asset_private_care",
        "asset_bandages",
      ]);
      expect(started.events).toContainEqual({ type: "ASSET_GAINED", playerId: "guest", assetId: "asset_45_automatic", source: "setup" });
      expect(started.events.at(-1)).toEqual({ type: "RESERVE_REFILLED", assetIds: started.state.reserveAssetIds });
    }
  });

  it("requires complete Mystery content and explicit random input before starting", () => {
    const state = createLobby(["host", "guest"]);
    state.ancientOneId = "cthulhu";
    state.players[0]!.investigatorId = "akachi_onyele";
    state.players[1]!.investigatorId = "trish_scarborough";
    expect(executeCommand(state, "host", { type: "START_GAME" }, { ...testContent, mysteryIdsByAncientOne: {} })).toMatchObject({
      ok: false, error: { code: "MYSTERY_CONTENT_MISSING" },
    });
    expect(executeCommand(state, "host", { type: "START_GAME" }, testContent)).toMatchObject({
      ok: false, error: { code: "RANDOM_INPUT_REQUIRED" },
    });
  });

  it("spends one of two actions to travel to an adjacent location", () => {
    const result = executeCommand(startedGame(), "host", { type: "TRAVEL", destinationIds: ["space_1"] }, testContent);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state).toMatchObject({ actionsRemaining: 1, performedActions: ["travel"] });
      expect(result.state.players[0]?.locationId).toBe("space_1");
    }
  });

  it("rejects non-adjacent and out-of-turn moves without mutating state", () => {
    const state = startedGame();
    expect(executeCommand(state, "host", { type: "TRAVEL", destinationIds: ["space_4"] }, testContent)).toMatchObject({
      ok: false,
      error: { code: "DESTINATION_NOT_ADJACENT" },
    });
    expect(executeCommand(state, "guest", { type: "TRAVEL", destinationIds: ["space_1"] }, testContent)).toMatchObject({
      ok: false,
      error: { code: "NOT_ACTIVE_PLAYER" },
    });
    expect(state.players[0]?.locationId).toBe("san_francisco");
  });

  it("uses matching tickets for extra travel and rejects uncharted ticket movement", () => {
    const state = startedGame();
    state.players[0]!.travelTickets = ["ship"];
    const traveled = executeCommand(state, "host", { type: "TRAVEL", destinationIds: ["space_1"] }, testContent);
    expect(traveled.ok).toBe(true);
    if (!traveled.ok) return;
    expect(executeCommand(traveled.state, "host", { type: "TRAVEL", destinationIds: ["space_4"] }, testContent)).toMatchObject({ ok: false, error: { code: "ACTION_ALREADY_PERFORMED" } });
    expect(executeCommand(state, "host", { type: "TRAVEL", destinationIds: ["space_1", "space_4"] }, testContent)).toMatchObject({ ok: false, error: { code: "TRAVEL_TICKET_REQUIRED" } });
  });

  it("spends two tickets for three steps while consuming only one action", () => {
    const state = startedGame();
    state.players[0]!.travelTickets = ["ship", "ship"];
    const snapshot = structuredClone(state);
    const result = executeCommand(state, "host", {
      type: "TRAVEL", destinationIds: ["space_1", "san_francisco", "space_1"],
    }, testContent);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0]).toMatchObject({ locationId: "space_1", travelTickets: [] });
    expect(result.state).toMatchObject({ actionsRemaining: 1, performedActions: ["travel"] });
    expect(result.events[0]).toMatchObject({ spentTickets: ["ship", "ship"] });
    expect(state).toEqual(snapshot);
  });

  it("rejects an unaffordable final step atomically", () => {
    const state = startedGame();
    state.players[0]!.travelTickets = ["ship", "train"];
    const snapshot = structuredClone(state);
    expect(executeCommand(state, "host", {
      type: "TRAVEL", destinationIds: ["space_1", "san_francisco", "space_1"],
    }, testContent)).toMatchObject({ ok: false, error: { code: "TRAVEL_TICKET_REQUIRED" } });
    expect(state).toEqual(snapshot);
  });

  it("rests once, respects maximums, and cannot rest with a Monster", () => {
    const rested = executeCommand(startedGame(), "host", { type: "REST" }, testContent);
    expect(rested.ok).toBe(true);
    if (!rested.ok) return;
    expect(rested.state.players[0]).toMatchObject({ health: 5, sanity: 7 });
    expect(executeCommand(rested.state, "host", { type: "REST" }, testContent)).toMatchObject({ ok: false, error: { code: "ACTION_ALREADY_PERFORMED" } });
    const blocked = startedGame();
    blocked.monsterLocationIds = ["san_francisco"];
    expect(executeCommand(blocked, "host", { type: "REST" }, testContent)).toMatchObject({ ok: false, error: { code: "REST_BLOCKED_BY_MONSTER" } });
  });

  it("gains valid travel tickets and advances to the Encounter phase after all investigators act", () => {
    let result = executeCommand(startedGame(), "host", { type: "PREPARE_TRAVEL", ticketType: "ship" }, testContent);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0]?.travelTickets).toEqual(["ship"]);
    result = executeCommand(result.state, "host", { type: "END_ACTIONS" }, testContent);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.activePlayerId).toBe("guest");
    result = executeCommand(result.state, "guest", { type: "END_ACTIONS" }, testContent);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state).toMatchObject({ phase: "encounter", activePlayerId: "host", actionsRemaining: 0 });
  });

  it("prevents duplicate investigator selection", () => {
    const state: GameState = {
      ...createLobby(["host", "guest"]),
      players: [
        { id: "host", investigatorId: "akachi_onyele", assetIds: [], clues: 0, skillImprovements: {} },
        { id: "guest", assetIds: [], clues: 0, skillImprovements: {} },
      ],
    };
    expect(executeCommand(state, "guest", { type: "SELECT_INVESTIGATOR", investigatorId: "akachi_onyele" }, testContent)).toMatchObject({
      ok: false,
      error: { code: "INVESTIGATOR_TAKEN" },
    });
  });

  it("allows only the host to select an Ancient One in the lobby", () => {
    const state = createLobby(["host", "guest"]);
    expect(executeCommand(state, "guest", { type: "SELECT_ANCIENT_ONE", ancientOneId: "cthulhu" }, testContent)).toMatchObject({
      ok: false,
      error: { code: "NOT_HOST" },
    });
    const selected = executeCommand(state, "host", { type: "SELECT_ANCIENT_ONE", ancientOneId: "yog_sothoth" }, testContent);
    expect(selected.ok).toBe(true);
    if (selected.ok) expect(selected.state.ancientOneId).toBe("yog_sothoth");
  });

  it("requires an Ancient One before the host can start", () => {
    const state = createLobby(["host", "guest"]);
    state.players[0]!.investigatorId = "akachi_onyele";
    state.players[1]!.investigatorId = "trish_scarborough";
    expect(executeCommand(state, "host", { type: "START_GAME" }, testContent)).toMatchObject({
      ok: false,
      error: { code: "ANCIENT_ONE_REQUIRED" },
    });
  });
});

describe("Mystery lifecycle", () => {
  it("solves, reveals privately ordered replacements, and wins after three Mysteries", () => {
    const state = startedGame();
    state.privateState.deckOrderById.mysteries = ["cthulhu_two", "cthulhu_three", "cthulhu_four"];
    const first = applyMysteryProgress(state, 2, testContent);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.state).toMatchObject({ activeMysteryId: "cthulhu_two", completedMysteryIds: ["cthulhu_one"], mysteryProgress: 0, mysteryTarget: 1 });
    expect(first.events.map((event) => event.type)).toEqual(["MYSTERY_PROGRESS_ADDED", "MYSTERY_SOLVED", "MYSTERY_REVEALED"]);
    const second = applyMysteryProgress(first.state, 1, testContent);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const third = applyMysteryProgress(second.state, 1, testContent);
    expect(third.ok).toBe(true);
    if (!third.ok) return;
    expect(third.state).toMatchObject({ completedMysteryIds: ["cthulhu_one", "cthulhu_two", "cthulhu_three"], gameResult: "investigators_win", mysteryTarget: 0 });
    expect(third.state.activeMysteryId).toBeUndefined();
    expect(third.events.at(-1)).toEqual({ type: "GAME_ENDED", result: "investigators_win", reason: "three_mysteries_solved" });
    expect(applyMysteryProgress(third.state, 1, testContent)).toMatchObject({ ok: false, error: { code: "GAME_ENDED" } });
  });

  it("rejects invalid progress without mutation", () => {
    const state = startedGame();
    const snapshot = structuredClone(state);
    expect(applyMysteryProgress(state, 0, testContent)).toMatchObject({ ok: false, error: { code: "INVALID_MYSTERY_PROGRESS" } });
    expect(state).toEqual(snapshot);
  });
});

describe("Acquire Assets", () => {
  function marketState(): GameState {
    const state = startedGame();
    state.players[0]!.clues = 0;
    state.reserveAssetIds = ["asset_bandages", "asset_whiskey", "asset_axe", "asset_holy_water"];
    state.privateState.deckOrderById.assets = ["asset_arcane_tome"];
    return state;
  }

  it("offers a Bank Loan only without Debt and atomically grants Debt plus two buying successes", () => {
    const conditionContent: GameContent = { ...testContent, conditions: [{ id: "condition_debt_01", kind: "debt" }] };
    const before = marketState();
    before.players[0]!.conditionIds = [];
    before.privateState.tokenPoolById["condition:debt"] = ["condition_debt_01"];
    const initiated = executeCommand(before, "host", { type: "ACQUIRE_ASSETS" }, conditionContent,
      createDeterministicEngineContext({ dice: [1, 2], ids: ["test", "buy"] }));
    expect(initiated.ok).toBe(true);
    if (!initiated.ok) return;
    expect(initiated.state.pendingDecision?.optionIds).toContain("bank-loan");
    const purchased = executeCommand(initiated.state, "host", { type: "RESOLVE_DECISION", decisionId: "buy", selectedOptionIds: ["bank-loan", "asset_bandages"] }, conditionContent,
      createDeterministicEngineContext({ tokenIndexes: [0] }));
    expect(purchased.ok).toBe(true);
    if (!purchased.ok) return;
    expect(purchased.state.players[0]!.conditionIds).toEqual(["condition_debt_01"]);
    expect(purchased.state.players[0]!.assetIds).toContain("asset_bandages");
    expect(purchased.state.privateState.tokenPoolById["condition:debt"]).toEqual([]);
    expect(initiated.state.players[0]!.conditionIds).toEqual([]);
    expect(purchased.events).toContainEqual({ type: "CONDITION_GAINED", playerId: "host", conditionId: "condition_debt" });
    const nextTurn = marketState();
    nextTurn.players[0]!.conditionIds = ["condition_debt_01"];
    nextTurn.privateState.tokenPoolById["condition:debt"] = [];
    const blocked = executeCommand(nextTurn, "host", { type: "ACQUIRE_ASSETS" }, conditionContent,
      createDeterministicEngineContext({ dice: [1, 2], ids: ["test", "buy"] }));
    expect(blocked.ok && blocked.state.pendingDecision?.optionIds).not.toContain("bank-loan");
  });

  it.each([
    ["condition_blessed_01", 1, 4],
    ["condition_cursed_01", 0, 6],
  ] as const)("applies %s to an authoritative skill test", (conditionId, successes, threshold) => {
    const state = marketState();
    state.players[0]!.conditionIds = [conditionId];
    state.players[0]!.clues = 1;
    const result = executeCommand(state, "host", { type: "ACQUIRE_ASSETS" }, testContent,
      createDeterministicEngineContext({ dice: [4, 2], ids: ["test", "decision"] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.activeTest).toMatchObject({ successThreshold: threshold, successes });
    expect(result.state.players[0]!.conditionIds).toEqual([conditionId]);
    expect(state.players[0]!.conditionIds).toEqual([conditionId]);
  });

  it("rolls Influence, buys within the success budget, and refills the Reserve", () => {
    const initiated = executeCommand(
      marketState(),
      "host",
      { type: "ACQUIRE_ASSETS" },
      testContent,
      createDeterministicEngineContext({ dice: [6, 5], ids: ["influence-test", "buy-assets"] }),
    );
    expect(initiated.ok).toBe(true);
    if (!initiated.ok) return;
    expect(initiated.events).toEqual([
      { type: "TEST_ROLLED", testId: "influence-test", playerId: "host", skill: "influence", modifier: 0, dice: [6, 5], successes: 2 },
      { type: "TEST_RESOLVED", testId: "influence-test", playerId: "host", successes: 2, continuation: "acquire_assets" },
    ]);
    expect(initiated.state.activeTest).toBeUndefined();
    expect(initiated.state.pendingDecision).toMatchObject({
      id: "buy-assets",
      kind: "select_acquired_cards",
      optionIds: ["asset_bandages", "asset_whiskey", "asset_axe", "asset_holy_water"],
      selectionBudget: 2,
      continuation: "acquire_assets_purchase",
    });

    const purchased = executeCommand(initiated.state, "host", {
      type: "RESOLVE_DECISION",
      decisionId: "buy-assets",
      selectedOptionIds: ["asset_bandages", "asset_whiskey"],
    }, testContent);
    expect(purchased.ok).toBe(true);
    if (!purchased.ok) return;
    expect(purchased.state.players[0]?.assetIds).toEqual(["asset_bandages", "asset_whiskey"]);
    expect(purchased.state.reserveAssetIds).toEqual(["asset_axe", "asset_holy_water", "asset_arcane_tome"]);
    expect(purchased.state.privateState.deckOrderById.assets).toEqual([]);
    expect(purchased.state).toMatchObject({ actionsRemaining: 1, performedActions: ["acquire_assets"] });
  });

  it("rejects purchases over budget without mutation", () => {
    const initiated = executeCommand(
      marketState(),
      "host",
      { type: "ACQUIRE_ASSETS" },
      testContent,
      createDeterministicEngineContext({ dice: [6, 1], ids: ["influence-test", "buy-assets"] }),
    );
    if (!initiated.ok) throw new Error("Acquire Assets setup failed.");
    const snapshot = structuredClone(initiated.state);
    expect(executeCommand(initiated.state, "host", {
      type: "RESOLVE_DECISION",
      decisionId: "buy-assets",
      selectedOptionIds: ["asset_axe"],
    }, testContent)).toMatchObject({ ok: false, error: { code: "ASSET_PURCHASE_OVER_BUDGET" } });
    expect(initiated.state).toEqual(snapshot);
  });

  it("allows one Reserve discard after buying nothing, then completes the action", () => {
    const initiated = executeCommand(
      marketState(),
      "host",
      { type: "ACQUIRE_ASSETS" },
      testContent,
      createDeterministicEngineContext({ dice: [1, 2], ids: ["influence-test", "buy-assets"] }),
    );
    if (!initiated.ok) throw new Error("Acquire Assets setup failed.");
    const declined = executeCommand(initiated.state, "host", {
      type: "RESOLVE_DECISION",
      decisionId: "buy-assets",
      selectedOptionIds: [],
    }, testContent, createDeterministicEngineContext({ ids: ["discard-asset"] }));
    expect(declined.ok).toBe(true);
    if (!declined.ok) return;
    expect(declined.state.pendingDecision).toMatchObject({ id: "discard-asset", kind: "discard_reserve_card", minSelections: 0, maxSelections: 1 });
    expect(declined.state.actionsRemaining).toBe(2);

    const discarded = executeCommand(declined.state, "host", {
      type: "RESOLVE_DECISION",
      decisionId: "discard-asset",
      selectedOptionIds: ["asset_axe"],
    }, testContent);
    expect(discarded.ok).toBe(true);
    if (!discarded.ok) return;
    expect(discarded.state.assetDiscardIds).toEqual(["asset_axe"]);
    expect(discarded.state.reserveAssetIds).toEqual(["asset_bandages", "asset_whiskey", "asset_holy_water", "asset_arcane_tome"]);
    expect(discarded.state).toMatchObject({ actionsRemaining: 1, performedActions: ["acquire_assets"] });
  });

  it("requires a City without Monsters and explicit random input", () => {
    const state = marketState();
    expect(executeCommand(state, "host", { type: "ACQUIRE_ASSETS" }, testContent)).toMatchObject({ ok: false, error: { code: "RANDOM_INPUT_REQUIRED" } });
    state.monsterLocationIds = ["san_francisco"];
    expect(executeCommand(state, "host", { type: "ACQUIRE_ASSETS" }, testContent)).toMatchObject({ ok: false, error: { code: "ASSET_ACTION_BLOCKED_BY_MONSTER" } });
    state.monsterLocationIds = [];
    state.players[0]!.locationId = "space_4";
    expect(executeCommand(state, "host", { type: "ACQUIRE_ASSETS" }, testContent)).toMatchObject({ ok: false, error: { code: "CITY_REQUIRED" } });
  });

  it("applies structured Influence and six-counting effects", () => {
    const state = marketState();
    state.players[0]!.assetIds = ["asset_personal_assistant", "asset_fine_clothes"];
    const result = executeCommand(
      state,
      "host",
      { type: "ACQUIRE_ASSETS" },
      testContent,
      createDeterministicEngineContext({ dice: [6, 5, 1], ids: ["influence-test", "enhanced-buy"] }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.events).toEqual([
      { type: "TEST_ROLLED", testId: "influence-test", playerId: "host", skill: "influence", modifier: 0, dice: [6, 5, 1], successes: 3 },
      { type: "TEST_RESOLVED", testId: "influence-test", playerId: "host", successes: 3, continuation: "acquire_assets" },
    ]);
  });

  it("applies skill improvements and offers sequential Clue rerolls", () => {
    const state = marketState();
    state.players[0]!.clues = 2;
    state.privateState.tokenPoolById.clues = [];
    state.privateState.tokenPoolById.clue_discard = [];
    state.privateState.tokenPoolById["held_clues:host"] = ["clue_arkham", "clue_london"];
    state.players[0]!.skillImprovements.influence = 1;
    const initiated = executeCommand(
      state,
      "host",
      { type: "ACQUIRE_ASSETS" },
      testContent,
      createDeterministicEngineContext({ dice: [1, 5, 2], ids: ["influence-test", "reroll-one"] }),
    );
    expect(initiated.ok).toBe(true);
    if (!initiated.ok) return;
    expect(initiated.state.activeTest).toMatchObject({ id: "influence-test", dicePool: 3, dice: [1, 5, 2], successes: 1 });
    expect(initiated.state.pendingDecision).toMatchObject({ id: "reroll-one", kind: "select_rerolls", optionIds: ["die-0", "die-1", "die-2"] });

    const invalidHoldings = structuredClone(initiated.state);
    invalidHoldings.privateState.tokenPoolById["held_clues:host"] = [];
    const invalidSnapshot = structuredClone(invalidHoldings);
    expect(executeCommand(invalidHoldings, "host", { type: "RESOLVE_DECISION", decisionId: "reroll-one", selectedOptionIds: ["die-0"] }, testContent,
      createDeterministicEngineContext({ dice: [6], ids: ["unused"] })))
      .toMatchObject({ ok: false, error: { code: "CLUE_CONTENT_MISSING" } });
    expect(invalidHoldings).toEqual(invalidSnapshot);

    const reconnectedState = JSON.parse(JSON.stringify(initiated.state)) as GameState;
    const rerolled = executeCommand(reconnectedState, "host", {
      type: "RESOLVE_DECISION",
      decisionId: "reroll-one",
      selectedOptionIds: ["die-0"],
    }, testContent, createDeterministicEngineContext({ dice: [6], ids: ["reroll-two"] }));
    expect(rerolled.ok).toBe(true);
    if (!rerolled.ok) return;
    expect(rerolled.state.players[0]!.clues).toBe(1);
    expect(rerolled.state.privateState.tokenPoolById["held_clues:host"]).toEqual(["clue_london"]);
    expect(rerolled.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_arkham"]);
    expect(rerolled.state.activeTest).toMatchObject({ dice: [6, 5, 2], successes: 2 });
    expect(rerolled.state.pendingDecision).toMatchObject({ id: "reroll-two", kind: "select_rerolls" });
    expect(rerolled.events).toContainEqual({ type: "CLUE_SPENT_FOR_REROLL", testId: "influence-test", playerId: "host", dieIndex: 0 });

    const kept = executeCommand(rerolled.state, "host", {
      type: "RESOLVE_DECISION",
      decisionId: "reroll-two",
      selectedOptionIds: [],
    }, testContent, createDeterministicEngineContext({ ids: ["buy-assets"] }));
    expect(kept.ok).toBe(true);
    if (!kept.ok) return;
    expect(kept.state.players[0]!.clues).toBe(1);
    expect(kept.state.activeTest).toBeUndefined();
    expect(kept.state.pendingDecision).toMatchObject({ id: "buy-assets", selectionBudget: 2, continuation: "acquire_assets_purchase" });
    expect(kept.events.at(-1)).toEqual({ type: "TEST_RESOLVED", testId: "influence-test", playerId: "host", successes: 2, continuation: "acquire_assets" });
  });

  it("rejects an invalid reroll without spending a Clue or mutating the test", () => {
    const state = marketState();
    state.players[0]!.clues = 1;
    const initiated = executeCommand(
      state,
      "host",
      { type: "ACQUIRE_ASSETS" },
      testContent,
      createDeterministicEngineContext({ dice: [1, 2], ids: ["influence-test", "reroll"] }),
    );
    if (!initiated.ok) throw new Error("Acquire Assets setup failed.");
    const snapshot = structuredClone(initiated.state);
    expect(executeCommand(initiated.state, "host", {
      type: "RESOLVE_DECISION",
      decisionId: "reroll",
      selectedOptionIds: ["die-9"],
    }, testContent, createDeterministicEngineContext({ dice: [6], ids: ["unused"] }))).toMatchObject({
      ok: false,
      error: { code: "INVALID_DECISION_SELECTION" },
    });
    expect(initiated.state).toEqual(snapshot);
  });

  it("resolves Private Care immediately and discards it instead of retaining it", () => {
    const state = marketState();
    state.reserveAssetIds = ["asset_private_care", "asset_whiskey", "asset_axe", "asset_holy_water"];
    const initiated = executeCommand(
      state,
      "host",
      { type: "ACQUIRE_ASSETS" },
      testContent,
      createDeterministicEngineContext({ dice: [6, 5], ids: ["influence-test", "private-care"] }),
    );
    if (!initiated.ok) throw new Error("Acquire Assets setup failed.");
    const purchased = executeCommand(initiated.state, "host", {
      type: "RESOLVE_DECISION",
      decisionId: "private-care",
      selectedOptionIds: ["asset_private_care"],
    }, testContent);
    expect(purchased.ok).toBe(true);
    if (!purchased.ok) return;
    expect(purchased.state.players[0]).toMatchObject({ health: 5, sanity: 7, assetIds: [] });
    expect(purchased.state.assetDiscardIds).toContain("asset_private_care");
    expect(purchased.events).toContainEqual({ type: "ASSET_DISCARDED", playerId: "host", assetId: "asset_private_care", reason: "on_gain_effect" });
  });
});

describe("Asset Rest effects", () => {
  it("recovers one additional Sanity from the King James Bible", () => {
    const state = startedGame();
    state.players[0]!.sanity = 4;
    state.players[0]!.assetIds = ["asset_king_james_bible"];
    const result = executeCommand(state, "host", { type: "REST" }, testContent);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.players[0]?.sanity).toBe(6);
  });
});

describe("projectPublicState", () => {
  it("removes hidden deck and token order from the synchronized projection", () => {
    const state = startedGame();
    state.privateState = {
      deckOrderById: { mythos: ["mythos_03", "mythos_01"], mysteries: ["hidden_mystery"] },
      tokenPoolById: { gates: ["gate_rome", "gate_tokyo"] },
    };

    const projection = projectPublicState(state);

    expect(projection).not.toHaveProperty("privateState");
    expect(JSON.stringify(projection)).not.toContain("mythos_03");
    expect(JSON.stringify(projection)).not.toContain("gate_rome");
    expect(JSON.stringify(projection)).not.toContain("hidden_mystery");
    expect(projection.activeMysteryId).toBe("cthulhu_one");
  });

  it("returns detached public collections", () => {
    const state = startedGame();
    const projection = projectPublicState(state);

    projection.players[0]!.travelTickets!.push("ship");
    projection.performedActions.push("rest");
    projection.monsterLocationIds.push("rome");

    expect(state.players[0]!.travelTickets).toEqual([]);
    expect(state.performedActions).toEqual([]);
    expect(state.monsterLocationIds).toEqual([]);
  });

  it("shows owner-only options to the owner but only a summary to other players", () => {
    const state = startedGame();
    state.pendingDecision = {
      id: "decision-1",
      kind: "select_rerolls",
      playerId: "host",
      visibility: "owner",
      prompt: "Choose a die to reroll.",
      optionIds: ["die-1", "die-2"],
      minSelections: 0,
      maxSelections: 1,
    };

    expect(projectStateForPlayer(state, "host").pendingDecision).toHaveProperty("optionIds", ["die-1", "die-2"]);
    expect(projectStateForPlayer(state, "guest").pendingDecision).toEqual({
      id: "decision-1",
      kind: "select_rerolls",
      playerId: "host",
      visibility: "owner",
      prompt: "Choose a die to reroll.",
      optionCount: 2,
      minSelections: 0,
      maxSelections: 1,
    });
    expect(projectPublicState(state).pendingDecision).not.toHaveProperty("optionIds");
  });
});

describe("private Mythos draw", () => {
  it("reveals only the top card, removes it from the private deck, and prevents a second draw", () => {
    const before = startedGame();
    before.phase = "mythos";
    before.omen = 0;
    before.doom = 12;
    before.privateState.deckOrderById.mythos = ["mythos_green_01", "mythos_yellow_02"];
    const content: GameContent = { ...testContent, mythosCards: [{ id: "mythos_green_01", color: "green", icons: [{ type: "advance_omen" }] }, { id: "mythos_yellow_02", color: "yellow", icons: [{ type: "advance_omen" }] }] };
    const drawn = drawMythosCard(before, content);
    expect(drawn).toMatchObject({ ok: true, events: [{ type: "MYTHOS_CARD_REVEALED", cardId: "mythos_green_01" }, { type: "OMEN_ADVANCED" }] });
    if (!drawn.ok) return;
    expect(drawn.state.currentMythosCardId).toBe("mythos_green_01");
    expect(drawn.state.omen).toBe(1);
    expect(drawn.state.currentMythosIconIndex).toBe(1);
    expect(drawn.state.privateState.deckOrderById.mythos).toEqual(["mythos_yellow_02"]);
    expect(before.privateState.deckOrderById.mythos).toHaveLength(2);
    expect(JSON.stringify(projectPublicState(drawn.state))).not.toContain("mythos_yellow_02");
    expect(projectPublicState(drawn.state).currentMythosCardId).toBe("mythos_green_01");
    expect(drawMythosCard(drawn.state, content)).toMatchObject({ ok: false, error: { code: "MYTHOS_CARD_ACTIVE" } });
    expect(openReplacementWindow(drawn.state)).toMatchObject({ ok: false, error: { code: "WRONG_PHASE" } });
  });

  it("loses when asked to draw from an exhausted deck, but not an uninitialized one", () => {
    const before = startedGame();
    before.phase = "mythos";
    expect(drawMythosCard(before, testContent)).toMatchObject({ ok: false, error: { code: "MYTHOS_DECK_MISSING" } });
    before.privateState.deckOrderById.mythos = [];
    const lost = drawMythosCard(before, testContent);
    expect(lost).toMatchObject({ ok: true, events: [{ type: "GAME_ENDED", result: "investigators_lose", reason: "mythos_deck_exhausted" }] });
    if (!lost.ok) return;
    expect(lost.state.gameResult).toBe("investigators_lose");
    expect(before.gameResult).toBeUndefined();
    expect(drawMythosCard(lost.state, testContent)).toMatchObject({ ok: false, error: { code: "GAME_ENDED" } });
  });

  it("rejects an unknown next card without consuming it or changing the version", () => {
    const before = startedGame();
    before.phase = "mythos";
    before.privateState.deckOrderById.mythos = ["unknown"];
    const snapshot = structuredClone(before);
    expect(drawMythosCard(before, testContent)).toMatchObject({ ok: false, error: { code: "MYTHOS_CONTENT_MISSING" } });
    expect(before).toEqual(snapshot);
    before.phase = "encounter";
    expect(drawMythosCard(before, testContent)).toMatchObject({ ok: false, error: { code: "WRONG_PHASE" } });
  });
});

describe("pending decisions", () => {
  function stateWithDecision(): GameState {
    const state = startedGame();
    state.pendingDecision = {
      id: "decision-1",
      kind: "choose_encounter",
      playerId: "host",
      visibility: "owner",
      prompt: "Choose an encounter deck.",
      optionIds: ["city", "research"],
      minSelections: 1,
      maxSelections: 1,
    };
    return state;
  }

  it("serializes and resolves an interrupted decision", () => {
    const restored = JSON.parse(JSON.stringify(stateWithDecision())) as GameState;
    const result = executeCommand(restored, "host", {
      type: "RESOLVE_DECISION",
      decisionId: "decision-1",
      selectedOptionIds: ["research"],
    }, testContent);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.pendingDecision).toBeUndefined();
    expect(result.state.stateVersion).toBe(4);
    expect(result.events).toEqual([{
      type: "DECISION_RESOLVED",
      decisionId: "decision-1",
      playerId: "host",
      selectedOptionIds: ["research"],
    }]);
  });

  it("blocks unrelated commands while a decision is pending", () => {
    const state = stateWithDecision();
    expect(executeCommand(state, "host", { type: "REST" }, testContent)).toMatchObject({
      ok: false,
      error: { code: "DECISION_PENDING" },
    });
  });

  it.each([
    ["guest", "decision-1", ["city"], "NOT_DECISION_OWNER"],
    ["host", "old-decision", ["city"], "DECISION_ID_MISMATCH"],
    ["host", "decision-1", [], "INVALID_DECISION_SELECTION"],
    ["host", "decision-1", ["unknown"], "INVALID_DECISION_SELECTION"],
    ["host", "decision-1", ["city", "city"], "INVALID_DECISION_SELECTION"],
  ])("rejects an invalid resolution without mutation", (playerId, decisionId, selections, errorCode) => {
    const state = stateWithDecision();
    const snapshot = structuredClone(state);
    const result = executeCommand(state, playerId as string, {
      type: "RESOLVE_DECISION",
      decisionId: decisionId as string,
      selectedOptionIds: selections as string[],
    }, testContent);

    expect(result).toMatchObject({ ok: false, error: { code: errorCode } });
    expect(state).toEqual(snapshot);
  });

  it("rejects resolution when no decision exists", () => {
    expect(executeCommand(startedGame(), "host", {
      type: "RESOLVE_DECISION",
      decisionId: "decision-1",
      selectedOptionIds: [],
    }, testContent)).toMatchObject({ ok: false, error: { code: "NO_PENDING_DECISION" } });
  });
});

describe("createDeterministicEngineContext", () => {
  it("replays identical random inputs as identical outcomes", () => {
    const inputs = {
      dice: [6, 2],
      shuffleIndexes: [1, 0],
      tokenIndexes: [2],
      ids: ["decision-001"],
    } as const;

    const run = () => {
      const context = createDeterministicEngineContext(inputs);
      return {
        dice: [context.rollDie(), context.rollDie()],
        shuffled: context.shuffle(["a", "b", "c"]),
        tokenDraw: context.drawToken(["gate-a", "gate-b", "gate-c"]),
        id: context.createId(),
      };
    };

    expect(run()).toEqual(run());
    expect(run()).toEqual({
      dice: [6, 2],
      shuffled: ["c", "a", "b"],
      tokenDraw: { token: "gate-c", remaining: ["gate-a", "gate-b"] },
      id: "decision-001",
    });
  });

  it("fails clearly on exhausted or out-of-range inputs", () => {
    expect(() => createDeterministicEngineContext({}).rollDie()).toThrow("die input is exhausted");
    expect(() => createDeterministicEngineContext({ dice: [0] }).rollDie()).toThrow("integer from 1 to 6");
    expect(() => createDeterministicEngineContext({ shuffleIndexes: [2] }).shuffle(["a", "b"])).toThrow("between 0 and 1");
    expect(() => createDeterministicEngineContext({ tokenIndexes: [1] }).drawToken(["only"])).toThrow("between 0 and 0");
    expect(() => createDeterministicEngineContext({ ids: [""] }).createId()).toThrow("exhausted or empty");
  });

  it("does not mutate source collections", () => {
    const cards = ["a", "b", "c"];
    const tokens = ["one", "two"];
    const context = createDeterministicEngineContext({ shuffleIndexes: [1, 0], tokenIndexes: [0] });

    context.shuffle(cards);
    context.drawToken(tokens);

    expect(cards).toEqual(["a", "b", "c"]);
    expect(tokens).toEqual(["one", "two"]);
  });
});
