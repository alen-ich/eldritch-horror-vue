import assert from "node:assert/strict";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { commandErrorMessageType, commandMessageType, type GameCommand } from "@eldritch/protocol";
import appConfig from "../src/app.config.js";
import { GameRoomState } from "../src/rooms/schema/GameRoomState.js";

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
    sendCommand(room, host, { type: "START_GAME" });
    await room.waitForMessage(commandMessageType);

    assert.equal(room.state.phase, "action");
    assert.equal(room.state.activePlayerId, hostPlayer.id);
    assert.equal(hostPlayer.locationId, "space_15");
    assert.equal(hostPlayer.health, 5);
    assert.equal(hostPlayer.sanity, 7);
    assert.equal(guestPlayer.locationId, "space_16");

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
});
