import assert from "node:assert/strict";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { GameState } from "@eldritch/engine";
import { commandMessageType, type GameCommand } from "@eldritch/protocol";
import type appConfig from "../src/app.config.js";
import { GameRoom } from "../src/rooms/GameRoom.js";
export function registerResearchMarkerBindingTests(getServer: () => ColyseusTestServer<typeof appConfig>): void {
  describe("Research marker provenance restoration", () => {
    it("keeps original private binding and rejects stripping or replacement atomically", async () => {
      const server = getServer(), room = await server.createRoom<GameRoom>("game", {});
      const host = await server.connectTo(room, { displayName: "Host" }), guest = await server.connectTo(room, { displayName: "Guest" });
      async function send(command: GameCommand, client = host) {
        client.send(commandMessageType, { expectedStateVersion: room.state.stateVersion, command }); await room.waitForMessage(commandMessageType);
      }
      await send({ type: "SELECT_INVESTIGATOR", investigatorId: "mark_harrigan" });
      await send({ type: "SELECT_INVESTIGATOR", investigatorId: "trish_scarborough" }, guest);
      await send({ type: "SELECT_ANCIENT_ONE", ancientOneId: "azathoth" }); await send({ type: "START_GAME" });
      const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
      const state = internal.toEngineState(), marker = state.boardClues![0]!;
      const cardId = state.privateState.deckOrderById["encounter:research_azathoth"]!.shift()!;
      state.phase = "encounter"; state.activePlayerId = state.players[0]!.id; state.currentLocationEncounterCardId = cardId;
      state.pendingLocationEncounter = { playerId: state.activePlayerId, cardId, deck: "research_azathoth", queue: [], dice: [], successes: 0, cardRemovedFromDeck: true, researchMarkerBinding: { markerId: marker.id, clueId: state.privateState.tokenPoolById[`board_clue:${marker.id}`]![0]! } };
      internal.applyEngineState(JSON.parse(JSON.stringify(state)));
      assert.deepEqual(internal.toEngineState().pendingLocationEncounter?.researchMarkerBinding, state.pendingLocationEncounter.researchMarkerBinding);
      const before = structuredClone(internal.toEngineState()), publicBefore = JSON.stringify(room.state);
      for (const kind of ["strip", "replace"]) {
        const bad = structuredClone(before);
        if (kind === "strip") delete bad.pendingLocationEncounter!.researchMarkerBinding;
        else bad.pendingLocationEncounter!.researchMarkerBinding!.markerId = "private_redirect";
        assert.throws(() => internal.applyEngineState(bad), error => error instanceof Error && /Research/.test(error.message) && !error.message.includes("private_redirect"));
        assert.deepEqual(internal.toEngineState(), before); assert.equal(JSON.stringify(room.state), publicBefore);
      }
      await new Promise(resolve => setTimeout(resolve, room.patchRate * 2));
      for (const peer of [host, guest]) assert.doesNotMatch(JSON.stringify(peer.state), /researchMarkerBinding|clueId|deckOrderById/);
    });
  });
}
