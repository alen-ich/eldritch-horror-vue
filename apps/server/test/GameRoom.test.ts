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
    state.privateState.tokenPoolById.monsters = ["monster_deep_one"];
    internal.applyEngineState(state);
    assert.deepEqual(internal.toEngineState().monsters, state.monsters);
    assert.deepEqual(internal.toEngineState().monsterLocationIds, ["arkham"]);
    assert.deepEqual(internal.toEngineState().activeGateIds, ["gate_arkham"]);
    assert.ok(room.state.monsters.includes("monster_ghoul"));
    assert.ok(!JSON.stringify(room.state).includes("monster_deep_one"));
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
