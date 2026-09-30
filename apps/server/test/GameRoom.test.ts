import assert from "node:assert/strict";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import type { GameState } from "@eldritch/engine";
import {
  commandErrorMessageType,
  commandMessageType,
  pendingDecisionMessageType,
  type GameCommand,
  type PendingDecision,
} from "@eldritch/protocol";
import appConfig from "../src/app.config.js";
import { GameRoom } from "../src/rooms/GameRoom.js";
import { GameRoomState, PendingDecisionState } from "../src/rooms/schema/GameRoomState.js";

describe("authoritative game room", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  before(async () => { colyseus = await boot(appConfig); });
  after(async () => colyseus.shutdown());
  beforeEach(async () => colyseus.cleanup());

  it("round-trips public Monster instances through room state while keeping the cup private", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.monsters = [{ id: "on-board-1", monsterId: "monster_ghoul", locationId: "arkham", damage: 1 }];
    state.activeGateIds = ["gate_arkham"];
    state.boardClues = [{ id: "marker-1", locationId: "london" }];
    state.currentMythosIconIndex = 1;
    state.privateState.tokenPoolById.monsters = ["monster_deep_one"];
    state.privateState.tokenPoolById["board_clue:marker-1"] = ["clue_arkham"];
    internal.applyEngineState(state);
    assert.deepEqual(internal.toEngineState().monsters, state.monsters);
    assert.deepEqual(internal.toEngineState().monsterLocationIds, ["arkham"]);
    assert.deepEqual(internal.toEngineState().activeGateIds, ["gate_arkham"]);
    assert.deepEqual(internal.toEngineState().boardClues, [{ id: "marker-1", locationId: "london" }]);
    assert.equal(internal.toEngineState().currentMythosIconIndex, 1);
    assert.ok(room.state.monsters.includes("monster_ghoul"));
    assert.ok(!JSON.stringify(room.state).includes("monster_deep_one"));
    assert.ok(!JSON.stringify(room.state).includes("clue_arkham"));
  });

  it("accepts only the active investigator's Monster fight and records its result", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "encounter";
    state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
    state.players[0]!.investigatorId = "akachi_onyele";
    state.players[0]!.locationId = "arkham";
    state.players[0]!.health = 5;
    state.players[0]!.sanity = 7;
    state.players[0]!.assetIds = [];
    state.monsters = [{ id: "board-nightgaunt", monsterId: "monster_nightgaunt", locationId: "arkham", damage: 0 }];
    state.monsterLocationIds = ["arkham"];
    internal.applyEngineState(state);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "FIGHT_MONSTER", monsterInstanceId: "board-nightgaunt" });
    assert.equal((await denied as { code: string }).code, "INVALID_COMBAT");
    sendCommand(room, host, { type: "FIGHT_MONSTER", monsterInstanceId: "board-nightgaunt" });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.stateVersion, state.stateVersion + 1);
    const after = internal.toEngineState();
    assert.ok(after.monsters?.every(monster => monster.id !== "board-nightgaunt") || after.activePlayerId === state.players[1]!.id);
    assert.equal(after.players[0]!.health <= 5, true);
  });

  it("authorizes Mythos icon advancement and preserves the card on unsupported text", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = [...room.state.players.values()][0]!.id;
    state.currentMythosCardId = "mythos_yellow_01";
    state.currentMythosIconIndex = 3;
    internal.applyEngineState(state);
    const notLead = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "ADVANCE_MYTHOS" });
    assert.equal((await notLead as { code: string }).code, "WRONG_PHASE");
    const unsupported = host.waitForMessage(commandErrorMessageType);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    assert.equal((await unsupported as { code: string }).code, "MYTHOS_EFFECT_UNSUPPORTED");
    assert.equal(room.state.currentMythosCardId, "mythos_yellow_01");
    assert.equal(room.state.currentMythosIconIndex, 3);
  });

  it("resolves a typed Mythos blessing and opens replacement timing", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    const hostId = state.players[0]!.id;
    state.phase = "mythos";
    state.activePlayerId = state.leadInvestigatorId = hostId;
    state.currentMythosCardId = "mythos_green_04";
    state.currentMythosIconIndex = 3;
    state.players[0]!.investigatorId = "akachi_onyele";
    state.players[0]!.conditionIds = [];
    state.privateState.tokenPoolById["condition:blessed"] = ["condition_blessed_01"];
    internal.applyEngineState(state);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.currentMythosCardId, "");
    assert.equal(internal.toEngineState().replacementWindow, true);
    assert.deepEqual(internal.toEngineState().players[0]!.conditionIds, ["condition_blessed_01"]);
    sendCommand(room, host, { type: "BEGIN_NEXT_ROUND" });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.phase, "action");
    assert.equal(room.state.turnNumber, state.turnNumber + 1);
    assert.equal(internal.toEngineState().replacementWindow, false);
  });

  it("grants Rally the People's Ally from the private Asset deck to the Lead only", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    const hostId = state.players[0]!.id;
    state.phase = "mythos";
    state.activePlayerId = state.leadInvestigatorId = hostId;
    state.currentMythosCardId = "mythos_yellow_05";
    state.currentMythosIconIndex = 3;
    state.privateState.deckOrderById.assets = ["asset_axe", "asset_personal_assistant"];
    internal.applyEngineState(state);
    assert.equal(JSON.stringify(room.state).includes("asset_axe"), false);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const resolved = internal.toEngineState();
    assert.deepEqual(resolved.players[0]!.assetIds, ["asset_personal_assistant"]);
    assert.deepEqual(resolved.players[1]!.assetIds, []);
    assert.deepEqual(resolved.privateState.deckOrderById.assets, ["asset_axe"]);
    assert.equal(room.state.currentMythosCardId, "");
    assert.equal(resolved.replacementWindow, true);
    assert.equal(JSON.stringify(room.state).includes("asset_axe"), false);
  });

  it("resolves Perplexing Stars from the public Gate symbols without exposing deck order", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.omen = 0;
    state.doom = 8;
    state.activeGateIds = ["gate_london", "gate_tokyo"];
    state.currentMythosCardId = "mythos_yellow_13";
    state.currentMythosIconIndex = 3;
    state.privateState.deckOrderById.mythos = ["mythos_green_01"];
    internal.applyEngineState(state);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.omen, 3);
    assert.equal(room.state.doom, 6);
    assert.equal(room.state.currentMythosCardId, "");
    assert.equal(internal.toEngineState().replacementWindow, true);
    assert.deepEqual(internal.toEngineState().privateState.deckOrderById.mythos, ["mythos_green_01"]);
    assert.ok(!JSON.stringify(room.state).includes("mythos_green_01"));
  });

  it("discards Dimensional Instability Gates into a public pile while keeping the remaining stack private", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.omen = 1;
    state.doom = 8;
    state.currentMythosCardId = "mythos_green_14";
    state.currentMythosIconIndex = 3;
    state.activeGateIds = ["gate_london", "gate_tokyo"];
    state.privateState.deckOrderById.gates = ["gate_arkham"];
    internal.applyEngineState(state);
    assert.equal(JSON.stringify(room.state).includes("gate_arkham"), false);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.doom, 6);
    assert.equal(room.state.activeGateIds, "");
    assert.equal(room.state.discardedGateIds, "gate_london,gate_tokyo");
    assert.equal(room.state.currentMythosCardId, "");
    assert.deepEqual(internal.toEngineState().privateState.deckOrderById.gates, ["gate_arkham"]);
    assert.equal(JSON.stringify(room.state).includes("gate_arkham"), false);
  });

  it("spawns Calling the Elder Things Monsters without publishing the remaining cup", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.currentMythosCardId = "mythos_green_18";
    state.currentMythosIconIndex = 3;
    state.monsters = [{ id: "cultist-one", monsterId: "monster_cultist", locationId: "arkham", damage: 0 }];
    state.monsterLocationIds = ["arkham"];
    state.privateState.tokenPoolById.monsters = ["monster_ghoul", "monster_deep_one"];
    internal.applyEngineState(state);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "ADVANCE_MYTHOS" });
    assert.equal((await denied as { code: string }).code, "WRONG_PHASE");
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const resolved = internal.toEngineState();
    assert.equal(resolved.monsters?.length, 2);
    assert.equal(resolved.monsters?.[1]?.locationId, "arkham");
    assert.equal(resolved.privateState.tokenPoolById.monsters?.length, 1);
    assert.equal(resolved.replacementWindow, true);
    assert.equal(room.state.currentMythosCardId, "");
    assert.equal(JSON.stringify(room.state).includes(resolved.privateState.tokenPoolById.monsters![0]!), false);
  });

  it("resolves The Bermuda Triangle with server-owned rolls and public movement", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.currentMythosCardId = "mythos_yellow_20";
    state.currentMythosIconIndex = 3;
    state.players.forEach(player => { player.locationId = "arkham"; player.delayed = false; });
    internal.applyEngineState(state);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "ADVANCE_MYTHOS" });
    assert.equal((await denied as { code: string }).code, "WRONG_PHASE");
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const resolved = internal.toEngineState();
    assert.equal(resolved.stateVersion, state.stateVersion + 1);
    for (const player of resolved.players) {
      assert.ok(player.locationId === "arkham" || player.locationId === "space_8");
      assert.equal(Boolean(player.delayed), player.locationId === "space_8");
    }
    assert.equal(resolved.replacementWindow, true);
    assert.equal(room.state.currentMythosCardId, "");
  });

  it("keeps That Which Consumes Gate choices owner-only and discards the selected Gate", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.omen = 2;
    state.doom = 8;
    state.currentMythosCardId = "mythos_green_03";
    state.currentMythosIconIndex = 3;
    state.activeGateIds = ["gate_arkham", "gate_london"];
    state.privateState.deckOrderById.gates = ["gate_tokyo"];
    internal.applyEngineState(state);
    const ownerOptions = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const choice = await ownerOptions as PendingDecision;
    assert.equal(choice.kind, "choose_that_which_consumes_gate");
    assert.deepEqual(choice.optionIds, ["gate_arkham", "gate_london"]);
    assert.equal(room.state.pendingDecision?.optionCount, 2);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: ["gate_london"] });
    assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: ["gate_london"] });
    await room.waitForMessage(commandMessageType);
    const resolved = internal.toEngineState();
    assert.deepEqual(resolved.activeGateIds, ["gate_arkham"]);
    assert.deepEqual(resolved.discardedGateIds, ["gate_london"]);
    assert.equal(resolved.doom, 7);
    assert.equal(resolved.replacementWindow, true);
    assert.deepEqual(resolved.privateState.deckOrderById.gates, ["gate_tokyo"]);
    assert.equal(JSON.stringify(room.state).includes("gate_tokyo"), false);
  });

  it("resumes Torn Asunder damage after the first investigator resolves defeat", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.omen = 2;
    state.doom = 8;
    state.currentMythosCardId = "mythos_green_08";
    state.currentMythosIconIndex = 3;
    state.activeGateIds = ["gate_arkham", "gate_rome"];
    state.players[0] = { ...state.players[0]!, investigatorId: "jim_culver", locationId: "arkham", health: 1, sanity: 4, clues: 0 };
    state.players[1] = { ...state.players[1]!, investigatorId: "trish_scarborough", locationId: "london", health: 4, sanity: 4, clues: 0 };
    delete state.privateState.tokenPoolById.clues;
    internal.applyEngineState(state);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const paused = internal.toEngineState();
    assert.equal(paused.pendingDefeat?.playerId, state.players[0]?.id);
    assert.deepEqual(paused.pendingMythosDamage?.remainingPlayerIds, [state.players[1]?.id]);
    assert.equal(paused.players[1]?.health, 4);
    assert.equal(room.state.currentMythosCardId, "mythos_green_08");
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "ADVANCE_MYTHOS" });
    assert.equal((await denied as { code: string }).code, "WRONG_PHASE");
    sendCommand(room, host, { type: "RESOLVE_DEFEAT", cityId: "arkham", cause: "health", leadPlayerId: state.players[1]!.id });
    await room.waitForMessage(commandMessageType);
    const resolved = internal.toEngineState();
    assert.equal(resolved.players[1]?.health, 2);
    assert.equal(resolved.pendingDefeat, undefined);
    assert.equal(resolved.pendingMythosDamage, undefined);
    assert.equal(resolved.replacementWindow, true);
    assert.equal(room.state.currentMythosCardId, "");
  });

  it("keeps Heat Wave choices private and resumes after a lethal Health loss", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.doom = 8;
    state.currentMythosCardId = "mythos_yellow_14";
    state.currentMythosIconIndex = 3;
    state.players[0] = { ...state.players[0]!, investigatorId: "jim_culver", locationId: "arkham", health: 2, sanity: 4, clues: 0 };
    state.players[1] = { ...state.players[1]!, investigatorId: "trish_scarborough", locationId: "london", health: 4, sanity: 4, clues: 0 };
    delete state.privateState.tokenPoolById.clues;
    internal.applyEngineState(state);

    const hostChoiceMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const hostChoice = await hostChoiceMessage as PendingDecision;
    assert.equal(hostChoice.kind, "choose_heat_wave");
    assert.deepEqual(hostChoice.optionIds, ["become_delayed", "lose_health"]);
    assert.equal(room.state.pendingDecision?.optionCount, 2);
    assert.equal(JSON.stringify(room.state).includes("become_delayed"), false);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: hostChoice.id, selectedOptionIds: ["lose_health"] });
    assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");

    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: hostChoice.id, selectedOptionIds: ["lose_health"] });
    await room.waitForMessage(commandMessageType);
    const paused = internal.toEngineState();
    assert.equal(paused.pendingDefeat?.playerId, state.players[0]!.id);
    assert.deepEqual(paused.pendingHeatWave?.remainingPlayerIds, [state.players[1]!.id]);
    assert.equal(paused.players[1]?.health, 4);

    const guestChoiceMessage = guest.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_DEFEAT", cityId: "arkham", cause: "health", leadPlayerId: state.players[1]!.id });
    await room.waitForMessage(commandMessageType);
    const guestChoice = await guestChoiceMessage as PendingDecision;
    assert.equal(guestChoice.kind, "choose_heat_wave");
    assert.equal(guestChoice.playerId, state.players[1]!.id);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: guestChoice.id, selectedOptionIds: ["become_delayed"] });
    await room.waitForMessage(commandMessageType);
    const resolved = internal.toEngineState();
    assert.equal(resolved.players[1]?.delayed, true);
    assert.equal(resolved.pendingHeatWave, undefined);
    assert.equal(resolved.replacementWindow, true);
    assert.equal(room.state.currentMythosCardId, "");
  });

  it("resolves Blood Flows through an owner-only Monster choice", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.doom = 8;
    state.currentMythosCardId = "mythos_green_16";
    state.currentMythosIconIndex = 3;
    state.players[0] = { ...state.players[0]!, investigatorId: "jim_culver", locationId: "arkham", health: 5, sanity: 4, clues: 0 };
    state.monsters = [{ id: "blood-ghoul", monsterId: "monster_ghoul", locationId: "london", damage: 0 }];
    state.monsterLocationIds = ["london"];
    state.privateState.tokenPoolById.monsters = [];
    delete state.privateState.tokenPoolById.clues;
    internal.applyEngineState(state);
    const ownerChoiceMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const choice = await ownerChoiceMessage as PendingDecision;
    assert.equal(choice.kind, "choose_blood_flows_monster");
    assert.deepEqual(choice.optionIds, ["blood-ghoul"]);
    assert.equal(JSON.stringify(room.state).includes("blood-ghoul"), true);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: ["blood-ghoul"] });
    assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: ["blood-ghoul"] });
    await room.waitForMessage(commandMessageType);
    const resolved = internal.toEngineState();
    assert.equal(resolved.monsters?.length, 0);
    assert.equal(resolved.players[0]?.health, 4);
    assert.equal(resolved.replacementWindow, true);
  });

  it("restores the Lead's private Omen of Good Fortune choice after reconnect", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.omen = 0;
    state.doom = 8;
    state.currentMythosCardId = "mythos_yellow_08";
    state.currentMythosIconIndex = 3;
    internal.applyEngineState(state);
    const ownerOptions = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const choice = await ownerOptions as PendingDecision;
    assert.equal(choice.kind, "choose_omen_space");
    assert.deepEqual(choice.optionIds, ["stay", "omen_0", "omen_1", "omen_2", "omen_3"]);
    assert.equal(room.state.pendingDecision?.optionCount, 5);
    assert.equal(JSON.stringify(room.state).includes("omen_2"), false);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: ["omen_2"] });
    assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
    const token = host.reconnectionToken;
    host.reconnection.enabled = false;
    host.connection.close();
    await eventually(() => ![...room.state.players.values()][0]!.connected);
    const restored = await colyseus.sdk.reconnect(token);
    restored.onMessage("seat-token", () => undefined);
    const restoredOptions = restored.waitForMessage(pendingDecisionMessageType);
    restored.send("request-seat-token");
    assert.deepEqual((await restoredOptions as PendingDecision).optionIds, choice.optionIds);
    sendCommand(room, restored, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: ["omen_2"] });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.omen, 2);
    assert.equal(room.state.doom, 8);
    assert.equal(room.state.currentMythosCardId, "");
    assert.equal(internal.toEngineState().replacementWindow, true);
  });

  it("passes The World Fights Back choices between owners without exposing private options", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.currentMythosCardId = "mythos_yellow_07";
    state.currentMythosIconIndex = 3;
    state.players[0]!.health = 1;
    state.players[0]!.maxHealth = 4;
    state.players[1]!.sanity = 1;
    state.players[1]!.maxSanity = 4;
    internal.applyEngineState(state);
    const hostDecisionMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const first = await hostDecisionMessage as PendingDecision;
    assert.equal(first.kind, "choose_world_fights_back");
    assert.equal(first.playerId, state.players[0]!.id);
    assert.equal(JSON.stringify(room.state).includes("recover_health"), false);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: first.id, selectedOptionIds: ["recover_health"] });
    assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
    const guestDecisionMessage = guest.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: first.id, selectedOptionIds: ["recover_health"] });
    await room.waitForMessage(commandMessageType);
    const second = await guestDecisionMessage as PendingDecision;
    assert.equal(second.playerId, state.players[1]!.id);
    assert.equal(internal.toEngineState().players[0]!.health, 3);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: second.id, selectedOptionIds: ["recover_sanity"] });
    await room.waitForMessage(commandMessageType);
    assert.equal(internal.toEngineState().players[1]!.sanity, 3);
    assert.equal(room.state.currentMythosCardId, "");
    assert.equal(internal.toEngineState().replacementWindow, true);
  });

  it("keeps Everyone Has a Price decisions owner-only and restores the next choice on reconnect", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.currentMythosCardId = "mythos_yellow_06";
    state.currentMythosIconIndex = 3;
    state.players[0]!.conditionIds = ["condition_blessed_01"];
    state.players[1]!.conditionIds = ["condition_cursed_01"];
    state.privateState.tokenPoolById["condition:debt"] = ["condition_debt_01", "condition_debt_02"];
    internal.applyEngineState(state);
    const hostOptions = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const first = await hostOptions as PendingDecision;
    assert.deepEqual(first.optionIds, ["condition_blessed", "skip"]);
    assert.equal(JSON.stringify(room.state).includes("condition_debt_01"), false);
    assert.equal(JSON.stringify(room.state).includes("condition_blessed_01"), false);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: first.id, selectedOptionIds: ["condition_blessed"] });
    assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
    const guestOptions = guest.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: first.id, selectedOptionIds: ["condition_blessed"] });
    await room.waitForMessage(commandMessageType);
    const second = await guestOptions as PendingDecision;
    assert.deepEqual(second.optionIds, ["condition_cursed", "skip"]);
    const firstDebtId = internal.toEngineState().players[0]!.conditionIds?.[0];
    assert.ok(firstDebtId === "condition_debt_01" || firstDebtId === "condition_debt_02");
    assert.deepEqual(internal.toEngineState().privateState.tokenPoolById["condition:blessed"], ["condition_blessed_01"]);
    const token = guest.reconnectionToken;
    guest.reconnection.enabled = false;
    guest.connection.close();
    await eventually(() => ![...room.state.players.values()][1]!.connected);
    const restored = await colyseus.sdk.reconnect(token);
    restored.onMessage("seat-token", () => undefined);
    const restoredOptions = restored.waitForMessage(pendingDecisionMessageType);
    restored.send("request-seat-token");
    assert.deepEqual((await restoredOptions as PendingDecision).optionIds, second.optionIds);
    sendCommand(room, restored, { type: "RESOLVE_DECISION", decisionId: second.id, selectedOptionIds: ["condition_cursed"] });
    await room.waitForMessage(commandMessageType);
    const secondDebtId = internal.toEngineState().players[1]!.conditionIds?.[0];
    assert.ok(secondDebtId === "condition_debt_01" || secondDebtId === "condition_debt_02");
    assert.notEqual(secondDebtId, firstDebtId);
    assert.equal(room.state.currentMythosCardId, "");
    assert.equal(internal.toEngineState().replacementWindow, true);
  });

  it("keeps Desperate Times private and grants Dark Pact without reducing Doom", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.doom = 8;
    state.currentMythosCardId = "mythos_yellow_10";
    state.currentMythosIconIndex = 3;
    state.privateState.tokenPoolById["condition:dark_pact"] = ["condition_dark_pact_01"];
    internal.applyEngineState(state);
    const ownerOptions = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const choice = await ownerOptions as PendingDecision;
    assert.deepEqual(choice.optionIds, ["gain_dark_pact", "advance_doom"]);
    assert.equal(JSON.stringify(room.state).includes("gain_dark_pact"), false);
    assert.equal(JSON.stringify(room.state).includes("condition_dark_pact_01"), false);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: ["gain_dark_pact"] });
    assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: ["gain_dark_pact"] });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.doom, 8);
    assert.equal(room.state.currentMythosCardId, "");
    assert.deepEqual(internal.toEngineState().players[0]!.conditionIds, ["condition_dark_pact_01"]);
    assert.equal(JSON.stringify(room.state).includes("condition_dark_pact_01"), false);
    assert.equal(internal.toEngineState().replacementWindow, true);
  });

  it("resolves a supported location encounter through the room and leaves unsupported cards private", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "encounter";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    for (const player of state.players) {
      player.investigatorId = "akachi_onyele";
      player.locationId = "space_2";
      player.clues = 0;
      player.assetIds = [];
      player.skillImprovements = {};
      state.privateState.tokenPoolById[`held_clues:${player.id}`] = [];
    }
    state.privateState.deckOrderById["encounter:general"] = ["encounter_general_08", "encounter_general_01"];
    state.privateState.tokenPoolById.clues = ["clue_arkham"];
    state.privateState.tokenPoolById.clue_discard = [];
    internal.applyEngineState(state);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_LOCATION_ENCOUNTER", deck: "general" });
    assert.equal((await denied as { code: string }).code, "WRONG_PHASE");
    sendCommand(room, host, { type: "RESOLVE_LOCATION_ENCOUNTER", deck: "general" });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.activePlayerId, state.players[1]!.id);
    assert.equal(room.state.lastLocationEncounterCardId, "encounter_general_08");
    assert.deepEqual(internal.toEngineState().privateState.deckOrderById["encounter:general"], ["encounter_general_01", "encounter_general_08"]);
    assert.ok(!JSON.stringify(room.state).includes("encounter_general_01"));
    const unsupported = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_LOCATION_ENCOUNTER", deck: "general" });
    assert.equal((await unsupported as { code: string }).code, "ENCOUNTER_UNSUPPORTED");
    assert.equal(room.state.phase, "encounter");
  });

  it("keeps a location encounter test pending for the owner and resumes it after a decision", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "encounter";
    const hostId = state.players[0]!.id;
    state.activePlayerId = state.leadInvestigatorId = hostId;
    state.players[0]!.investigatorId = "akachi_onyele";
    state.players[0]!.locationId = "space_2";
    state.players[0]!.clues = 1;
    state.privateState.tokenPoolById[`held_clues:${hostId}`] = ["clue_arkham"];
    state.privateState.tokenPoolById.clues = ["clue_london"];
    state.privateState.deckOrderById["encounter:general"] = ["encounter_general_08"];
    internal.applyEngineState(state);
    sendCommand(room, host, { type: "RESOLVE_LOCATION_ENCOUNTER", deck: "general" });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.currentLocationEncounterCardId, "encounter_general_08");
    assert.equal(room.state.pendingDecision?.kind, "select_rerolls");
    assert.equal(room.state.activeTest?.continuation, "location_encounter");
    const decisionId = room.state.pendingDecision!.id;
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId, selectedOptionIds: [] });
    assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId, selectedOptionIds: [] });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.currentLocationEncounterCardId, "");
    assert.equal(room.state.lastLocationEncounterCardId, "encounter_general_08");
    assert.equal(room.state.pendingDecision, undefined);
  });

  function sendCommand(
    room: { state: GameRoomState },
    client: { send: (type: string, payload: unknown) => void },
    command: GameCommand,
    expectedStateVersion = room.state.stateVersion,
  ): void {
    client.send(commandMessageType, { expectedStateVersion, command });
  }

  async function eventually(check: () => boolean): Promise<void> {
    const deadline = Date.now() + 4000;
    while (!check()) {
      if (Date.now() > deadline) throw new Error("State transition timed out");
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  for (const stage of ["reroll", "purchase"] as const) {
    it(`restores an actual dropped connection during ${stage}`, async () => {
      const room = await colyseus.createRoom<GameRoom>("game", {});
      const host = await colyseus.connectTo(room, { displayName: "Host" });
      const guest = await colyseus.connectTo(room, { displayName: "Guest" });
      host.onMessage(pendingDecisionMessageType, () => undefined);
      sendCommand(room, host, { type: "SELECT_INVESTIGATOR", investigatorId: "akachi_onyele" });
      await room.waitForMessage(commandMessageType);
      sendCommand(room, guest, { type: "SELECT_INVESTIGATOR", investigatorId: "trish_scarborough" });
      await room.waitForMessage(commandMessageType);
      sendCommand(room, host, { type: "SELECT_ANCIENT_ONE", ancientOneId: "cthulhu" });
      await room.waitForMessage(commandMessageType);
      sendCommand(room, host, { type: "START_GAME" });
      await room.waitForMessage(commandMessageType);
      sendCommand(room, host, { type: "ACQUIRE_ASSETS" });
      await room.waitForMessage(commandMessageType);
      if (stage === "purchase") {
        sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: room.state.pendingDecision!.id, selectedOptionIds: [] });
        await room.waitForMessage(commandMessageType);
      }
      const seat = [...room.state.players.values()].find(player => player.isHost)!;
      const decisionId = room.state.pendingDecision!.id;
      const dice = room.state.activeTest?.dice;
      const token = host.reconnectionToken;
      host.reconnection.enabled = false;
      host.connection.close();
      await eventually(() => !seat.connected);
      assert.equal(room.state.players.size, 2);
      const restored = await colyseus.sdk.reconnect(token);
      restored.onMessage("seat-token", () => undefined);
      const options = restored.waitForMessage(pendingDecisionMessageType);
      restored.send("request-seat-token");
      assert.equal((await options as PendingDecision).id, decisionId);
      assert.equal(room.state.activeTest?.dice, dice);
      assert.equal(seat.connected, true);
      sendCommand(room, restored, { type: "RESOLVE_DECISION", decisionId, selectedOptionIds: [] });
      await room.waitForMessage(commandMessageType);
      assert.notEqual(room.state.pendingDecision?.id, decisionId);
    });
  }

  it("offers an owner-only Bank Loan and synchronizes only its Condition front", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    sendCommand(room, host, { type: "SELECT_INVESTIGATOR", investigatorId: "akachi_onyele" });
    await room.waitForMessage(commandMessageType);
    sendCommand(room, guest, { type: "SELECT_INVESTIGATOR", investigatorId: "trish_scarborough" });
    await room.waitForMessage(commandMessageType);
    sendCommand(room, host, { type: "SELECT_ANCIENT_ONE", ancientOneId: "cthulhu" });
    await room.waitForMessage(commandMessageType);
    sendCommand(room, host, { type: "START_GAME" });
    await room.waitForMessage(commandMessageType);
    const privateDecision = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "ACQUIRE_ASSETS" });
    await room.waitForMessage(commandMessageType);
    const decision = await privateDecision as PendingDecision;
    if (decision.kind === "select_rerolls") {
      const purchaseDecision = host.waitForMessage(pendingDecisionMessageType);
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: decision.id, selectedOptionIds: [] });
      await room.waitForMessage(commandMessageType);
      const purchase = await purchaseDecision as PendingDecision;
      assert.ok(purchase.optionIds.includes("bank-loan"));
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: purchase.id, selectedOptionIds: ["bank-loan"] });
    } else {
      assert.ok(decision.optionIds.includes("bank-loan"));
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: decision.id, selectedOptionIds: ["bank-loan"] });
    }
    await room.waitForMessage(commandMessageType);
    const hostSeat = [...room.state.players.values()].find(player => player.isHost)!;
    assert.equal(hostSeat.conditionIds, "condition_debt");
    assert.doesNotMatch(JSON.stringify(room.state), /condition_debt_\d{2}/);
    assert.equal(JSON.stringify(room.state).includes("Unwilling Servant"), false);
    assert.equal(JSON.stringify(room.state).includes("Debt Collector"), false);
  });

  it("reclaims a disconnected seat by private token without exposing it in room state", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const seatTokenMessage = host.waitForMessage("seat-token");
    host.send("request-seat-token");
    const seatToken = await seatTokenMessage as string;
    assert.ok(seatToken);
    assert.ok(!JSON.stringify(room.state).includes(seatToken));
    const hostSeat = [...room.state.players.values()].find(player => player.isHost)!;
    sendCommand(room, host, { type: "SELECT_INVESTIGATOR", investigatorId: "akachi_onyele" });
    await room.waitForMessage(commandMessageType);
    sendCommand(room, guest, { type: "SELECT_INVESTIGATOR", investigatorId: "trish_scarborough" });
    await room.waitForMessage(commandMessageType);
    sendCommand(room, host, { type: "SELECT_ANCIENT_ONE", ancientOneId: "cthulhu" });
    await room.waitForMessage(commandMessageType);
    sendCommand(room, host, { type: "START_GAME" });
    await room.waitForMessage(commandMessageType);
    host.reconnection.enabled = false;
    host.connection.close();
    await eventually(() => !hostSeat.connected);
    const formerClient = room.clients.find(client => client.sessionId === host.sessionId);
    if (formerClient) room.onLeave(formerClient);
    const restored = await colyseus.sdk.joinById(room.roomId, { displayName: "Impostor name", resumeToken: seatToken });
    assert.equal(hostSeat.id, [...room.state.players.values()].find(player => player.isHost)?.id);
    assert.equal(hostSeat.sessionId, restored.sessionId);
    assert.equal(hostSeat.investigatorId, "akachi_onyele");
    assert.equal(room.state.players.size, 2);
    await assert.rejects(() => colyseus.sdk.joinById(room.roomId, { resumeToken: seatToken }));
  });

  it("runs investigator selection, game start, and movement for two players", async () => {
    const room = await colyseus.createRoom<GameRoomState>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const players = [...room.state.players.values()];
    const hostPlayer = players.find((player) => player.isHost)!;
    const guestPlayer = players.find((player) => !player.isHost)!;

    assert.equal(hostPlayer.sessionId, host.sessionId);
    assert.equal(guestPlayer.sessionId, guest.sessionId);

    sendCommand(room, host, { type: "SELECT_INVESTIGATOR", investigatorId: "akachi_onyele" });
    await room.waitForMessage(commandMessageType);
    sendCommand(room, guest, { type: "SELECT_INVESTIGATOR", investigatorId: "trish_scarborough" });
    await room.waitForMessage(commandMessageType);
    sendCommand(room, host, { type: "SELECT_ANCIENT_ONE", ancientOneId: "cthulhu" });
    await room.waitForMessage(commandMessageType);
    sendCommand(room, host, { type: "START_GAME" });
    await room.waitForMessage(commandMessageType);

    assert.equal(room.state.phase, "action");
    assert.equal(room.state.ancientOneId, "cthulhu");
    assert.match(room.state.activeMysteryId, /^cthulhu_/);
    assert.equal(room.state.mysteryProgress, 0);
    assert.ok(room.state.mysteryTarget >= 1);
    assert.equal(room.state.completedMysteryIds, "");
    const privateMysteries = (room as unknown as { privateState: { deckOrderById: Record<string, string[]> } }).privateState.deckOrderById.mysteries;
    assert.equal(privateMysteries?.length, 3);
    assert.ok(!JSON.stringify(room.state).includes(privateMysteries![0]!));
    const encounterDecks = (room as unknown as { privateState: { deckOrderById: Record<string, string[]> } }).privateState.deckOrderById;
    for (const [deck, count] of [["general", 12], ["america", 8], ["europe", 8], ["asia_australia", 8]] as const) {
      assert.equal(encounterDecks[`encounter:${deck}`]?.length, count);
      assert.ok(!JSON.stringify(room.state).includes(encounterDecks[`encounter:${deck}`]![0]!));
    }
    assert.equal(room.state.activePlayerId, hostPlayer.id);
    assert.equal(hostPlayer.locationId, "space_15");
    assert.equal(hostPlayer.health, 5);
    assert.equal(hostPlayer.sanity, 7);
    assert.equal(hostPlayer.clues, 1);
    assert.equal(guestPlayer.locationId, "space_16");
    assert.equal(guestPlayer.assetIds, "asset_45_automatic");
    assert.equal(room.state.reserveAssetIds.split(",").length, 4);
    const privateAssets = (room as unknown as { privateState: { deckOrderById: Record<string, string[]> } }).privateState.deckOrderById.assets;
    assert.equal(privateAssets?.length, 35);
    assert.ok(!JSON.stringify(room.state).includes(privateAssets![0]!));
    const privateClues = (room as unknown as { privateState: { tokenPoolById: Record<string, string[]> } }).privateState.tokenPoolById;
    assert.equal(privateClues.clues?.length, 35);
    assert.equal(privateClues[`held_clues:${hostPlayer.id}`]?.length, 1);
    assert.ok(!JSON.stringify(room.state).includes(privateClues.clues![0]!));

    sendCommand(room, host, { type: "ACQUIRE_ASSETS" });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.pendingDecision?.kind, "select_rerolls");
    assert.equal(room.state.activeTest?.playerId, hostPlayer.id);
    assert.equal(room.state.activeTest?.skill, "influence");
    assert.equal(room.state.activeTest?.dice.split(",").length, room.state.activeTest?.dicePool);
    sendCommand(room, host, {
      type: "RESOLVE_DECISION",
      decisionId: room.state.pendingDecision!.id,
      selectedOptionIds: [],
    });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.pendingDecision?.kind, "select_acquired_cards");
    assert.equal(room.state.activeTest, undefined);
    sendCommand(room, host, {
      type: "RESOLVE_DECISION",
      decisionId: room.state.pendingDecision!.id,
      selectedOptionIds: [],
    });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.pendingDecision?.kind, "discard_reserve_card");
    sendCommand(room, host, {
      type: "RESOLVE_DECISION",
      decisionId: room.state.pendingDecision!.id,
      selectedOptionIds: [],
    });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.pendingDecision, undefined);
    assert.equal(room.state.actionsRemaining, 1);

    sendCommand(room, host, { type: "TRAVEL", destinationIds: ["space_10"] });
    await room.waitForMessage(commandMessageType);
    assert.equal(hostPlayer.locationId, "space_10");
    assert.equal(room.state.activePlayerId, guestPlayer.id);
    assert.equal(room.state.actionsRemaining, 2);
  });

  it("rejects forged player identity and isolates rooms", async () => {
    const firstRoom = await colyseus.createRoom<GameRoomState>("game", {});
    const secondRoom = await colyseus.createRoom<GameRoomState>("game", {});
    const firstClient = await colyseus.connectTo(firstRoom, { displayName: "One" });
    await colyseus.connectTo(secondRoom, { displayName: "Two" });

    firstClient.send(commandMessageType, {
      expectedStateVersion: firstRoom.state.stateVersion,
      command: {
        type: "REST",
        investigatorId: "akachi_onyele",
        playerId: [...secondRoom.state.players.keys()][0],
      },
    });
    await firstRoom.waitForMessage(commandMessageType);

    assert.equal([...firstRoom.state.players.values()][0]?.investigatorId, "");
    assert.equal([...secondRoom.state.players.values()][0]?.investigatorId, "");
  });

  it("rejects a command created from a stale state version", async () => {
    const room = await colyseus.createRoom<GameRoomState>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const staleVersion = room.state.stateVersion;

    sendCommand(room, host, { type: "SELECT_INVESTIGATOR", investigatorId: "akachi_onyele" }, staleVersion);
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.stateVersion, staleVersion + 1);

    const errorPromise = new Promise<{ code: string }>((resolve) => {
      guest.onMessage(commandErrorMessageType, resolve);
    });
    sendCommand(room, guest, { type: "SELECT_INVESTIGATOR", investigatorId: "trish_scarborough" }, staleVersion);
    const error = await errorPromise;

    assert.equal(error.code, "STALE_STATE");
    assert.equal(room.state.stateVersion, staleVersion + 1);
    assert.equal([...room.state.players.values()].find((player) => !player.isHost)?.investigatorId, "");
  });

  it("re-sends owner-only decision options when the assigned player reconnects", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    await colyseus.connectTo(room, { displayName: "Guest" });
    const hostPlayer = [...room.state.players.values()].find((player) => player.isHost)!;
    const decision: PendingDecision = {
      id: "decision-1",
      kind: "select_rerolls",
      playerId: hostPlayer.id,
      visibility: "owner",
      prompt: "Choose a die to reroll.",
      optionIds: ["die-1", "die-2"],
      minSelections: 0,
      maxSelections: 1,
    };
    (room as unknown as { pendingDecision: PendingDecision }).pendingDecision = decision;
    room.state.pendingDecision = new PendingDecisionState({
      id: decision.id,
      kind: decision.kind,
      playerId: decision.playerId,
      visibility: decision.visibility,
      prompt: decision.prompt,
      optionCount: decision.optionIds.length,
      minSelections: decision.minSelections,
      maxSelections: decision.maxSelections,
    });

    const decisionMessage = host.waitForMessage(pendingDecisionMessageType);
    const serverClient = room.clients.find((client) => client.sessionId === host.sessionId)!;
    room.onReconnect(serverClient);

    assert.deepEqual(await decisionMessage, decision);
    assert.equal("optionIds" in room.state.pendingDecision!, false);
    assert.equal(room.state.pendingDecision?.optionCount, 2);
  });
});
