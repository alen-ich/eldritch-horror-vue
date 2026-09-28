import assert from "node:assert/strict";
import { ColyseusTestServer, boot } from "@colyseus/testing";
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

  function sendCommand(
    room: { state: GameRoomState },
    client: { send: (type: string, payload: unknown) => void },
    command: GameCommand,
    expectedStateVersion = room.state.stateVersion,
  ): void {
    client.send(commandMessageType, { expectedStateVersion, command });
  }

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
    assert.equal(guestPlayer.locationId, "space_16");
    assert.equal(guestPlayer.assetIds, "asset_45_automatic");
    assert.equal(room.state.reserveAssetIds.split(",").length, 4);
    const privateAssets = (room as unknown as { privateState: { deckOrderById: Record<string, string[]> } }).privateState.deckOrderById.assets;
    assert.equal(privateAssets?.length, 35);
    assert.ok(!JSON.stringify(room.state).includes(privateAssets![0]!));

    sendCommand(room, host, { type: "TRAVEL", destinationIds: ["space_10"] });
    await room.waitForMessage(commandMessageType);
    assert.equal(hostPlayer.locationId, "space_10");
    assert.equal(room.state.actionsRemaining, 1);
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
