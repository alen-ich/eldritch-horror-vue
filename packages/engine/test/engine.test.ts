import { describe, expect, it } from "vitest";
import {
  applyMysteryProgress,
  delayInvestigator,
  damageInvestigator,
  resolveCombatEncounter,
  openReplacementWindow,
  createDeterministicEngineContext,
  createLobby,
  executeCommand,
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
    expect(result.state.privateState.tokenPoolById.monsters).toEqual(["token-1"]);
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
});

describe("executeCommand", () => {
  it("interrupts a defeated investigator and preserves their possessions on their sheet", () => {
    const state = startedGame();
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
  it("requires the recipient's consent and exchanges possessions atomically", () => {
    const state = startedGame();
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
    const context = createDeterministicEngineContext({ shuffleIndexes: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
    const started = executeCommand(selectedAncientOne.state, "host", { type: "START_GAME" }, testContent, context);
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

    const reconnectedState = JSON.parse(JSON.stringify(initiated.state)) as GameState;
    const rerolled = executeCommand(reconnectedState, "host", {
      type: "RESOLVE_DECISION",
      decisionId: "reroll-one",
      selectedOptionIds: ["die-0"],
    }, testContent, createDeterministicEngineContext({ dice: [6], ids: ["reroll-two"] }));
    expect(rerolled.ok).toBe(true);
    if (!rerolled.ok) return;
    expect(rerolled.state.players[0]!.clues).toBe(1);
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
