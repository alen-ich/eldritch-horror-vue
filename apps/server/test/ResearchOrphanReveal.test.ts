import assert from "node:assert/strict";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { GameState } from "@eldritch/engine";
import { commandMessageType, type GameCommand } from "@eldritch/protocol";
import type appConfig from "../src/app.config.js";
import { GameRoom } from "../src/rooms/GameRoom.js";

export function registerResearchOrphanRevealTests(getServer: () => ColyseusTestServer<typeof appConfig>): void {
describe("Research orphan reveal restoration", () => {

  for (const kind of ["absent", "generic"] as const) {
    it(`rejects ${kind} continuation without mutating either peer or canonical state`, async () => {
      const server = getServer();
      const room = await server.createRoom<GameRoom>("game", {});
      const host = await server.connectTo(room, { displayName: "Host" });
      const guest = await server.connectTo(room, { displayName: "Guest" });
      async function send(command: GameCommand, client = host) {
        client.send(commandMessageType, { expectedStateVersion: room.state.stateVersion, command });
        await room.waitForMessage(commandMessageType);
      }
      await send({ type: "SELECT_INVESTIGATOR", investigatorId: "mark_harrigan" });
      await send({ type: "SELECT_INVESTIGATOR", investigatorId: "trish_scarborough" }, guest);
      await send({ type: "SELECT_ANCIENT_ONE", ancientOneId: "azathoth" });
      await send({ type: "START_GAME" });
      await new Promise(resolve => setTimeout(resolve, room.patchRate * 2));
      const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
      const before = structuredClone(internal.toEngineState());
      const publicBefore = JSON.stringify(room.state), peersBefore = [host, guest].map(client => JSON.stringify(client.state));
      const bad = structuredClone(before);
      const cardId = bad.privateState.deckOrderById["encounter:research_azathoth"]![0]!;
      bad.phase = "encounter";
      bad.currentLocationEncounterCardId = cardId;
      if (kind === "generic") bad.pendingLocationEncounter = { playerId: bad.players[0]!.id, cardId, deck: "general", queue: [], dice: [], successes: 0 };
      assert.throws(() => internal.applyEngineState(bad), error => error instanceof Error
        && /Research restoration rejected/.test(error.message) && !error.message.includes(cardId));
      assert.deepEqual(internal.toEngineState(), before);
      assert.equal(JSON.stringify(room.state), publicBefore);
      await new Promise(resolve => setTimeout(resolve, room.patchRate * 2));
      assert.deepEqual([host, guest].map(client => JSON.stringify(client.state)), peersBefore);
    });
  }
});
}
