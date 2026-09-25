import assert from "node:assert/strict";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { commandMessageType } from "@eldritch/protocol";
import appConfig from "../src/app.config.js";
import { GameRoomState } from "../src/rooms/schema/GameRoomState.js";

describe("authoritative game room", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  before(async () => { colyseus = await boot(appConfig); });
  after(async () => colyseus.shutdown());
  beforeEach(async () => colyseus.cleanup());

  it("runs investigator selection, game start, and movement for two players", async () => {
    const room = await colyseus.createRoom<GameRoomState>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const players = [...room.state.players.values()];
    const hostPlayer = players.find((player) => player.isHost)!;
    const guestPlayer = players.find((player) => !player.isHost)!;

    assert.equal(hostPlayer.sessionId, host.sessionId);
    assert.equal(guestPlayer.sessionId, guest.sessionId);

    host.send(commandMessageType, { type: "SELECT_INVESTIGATOR", investigatorId: "amanda_sharpe" });
    await room.waitForMessage(commandMessageType);
    guest.send(commandMessageType, { type: "SELECT_INVESTIGATOR", investigatorId: "trish_scarborough" });
    await room.waitForMessage(commandMessageType);
    host.send(commandMessageType, { type: "START_GAME" });
    await room.waitForMessage(commandMessageType);

    assert.equal(room.state.phase, "action");
    assert.equal(room.state.activePlayerId, hostPlayer.id);
    assert.equal(guestPlayer.locationId, "san_francisco");

    host.send(commandMessageType, { type: "MOVE", destinationId: "space_1" });
    await room.waitForMessage(commandMessageType);
    assert.equal(hostPlayer.locationId, "space_1");
  });

  it("rejects forged player identity and isolates rooms", async () => {
    const firstRoom = await colyseus.createRoom<GameRoomState>("game", {});
    const secondRoom = await colyseus.createRoom<GameRoomState>("game", {});
    const firstClient = await colyseus.connectTo(firstRoom, { displayName: "One" });
    await colyseus.connectTo(secondRoom, { displayName: "Two" });

    firstClient.send(commandMessageType, {
      type: "SELECT_INVESTIGATOR",
      investigatorId: "amanda_sharpe",
      playerId: [...secondRoom.state.players.keys()][0],
    });
    await firstRoom.waitForMessage(commandMessageType);

    assert.equal([...firstRoom.state.players.values()][0]?.investigatorId, "");
    assert.equal([...secondRoom.state.players.values()][0]?.investigatorId, "");
  });
});
