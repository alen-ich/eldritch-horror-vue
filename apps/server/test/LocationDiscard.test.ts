import assert from "node:assert/strict";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { GameState } from "@eldritch/engine";
import { commandMessageType, type GameCommand } from "@eldritch/protocol";
import type appConfig from "../src/app.config.js";
import { GameRoom } from "../src/rooms/GameRoom.js";

export function registerLocationDiscardTests(getServer: () => ColyseusTestServer<typeof appConfig>): void {
  describe("physical Location discard projection", () => {
    it("restores public discards and a removed active card while rejecting corrupted zones atomically", async () => {
      const server = getServer(), room = await server.createRoom<GameRoom>("game", {});
      const host = await server.connectTo(room, { displayName: "Host" }), guest = await server.connectTo(room, { displayName: "Guest" });
      async function send(command: GameCommand, client = host) {
        client.send(commandMessageType, { expectedStateVersion: room.state.stateVersion, command });
        await room.waitForMessage(commandMessageType);
      }
      await send({ type: "SELECT_INVESTIGATOR", investigatorId: "mark_harrigan" });
      await send({ type: "SELECT_INVESTIGATOR", investigatorId: "trish_scarborough" }, guest);
      await send({ type: "SELECT_ANCIENT_ONE", ancientOneId: "azathoth" }); await send({ type: "START_GAME" });
      const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
      const state = internal.toEngineState(), key = "encounter:general";
      const discarded = state.privateState.deckOrderById[key]!.shift()!;
      const active = state.privateState.deckOrderById[key]!.shift()!;
      state.phase = "encounter"; state.activePlayerId = state.players[0]!.id;
      state.locationDiscardIdsByDeck = { general: [discarded] }; state.currentLocationEncounterCardId = active;
      state.pendingLocationEncounter = { playerId: state.activePlayerId, cardId: active, deck: "general", queue: [], dice: [], successes: 0, cardRemovedFromDeck: true };
      internal.applyEngineState(JSON.parse(JSON.stringify(state)) as GameState);
      assert.deepEqual(internal.toEngineState().locationDiscardIdsByDeck?.general, [discarded]);
      assert.deepEqual(internal.toEngineState().privateState.deckOrderById[key], state.privateState.deckOrderById[key]);
      await new Promise(resolve => setTimeout(resolve, room.patchRate * 2));
      for (const peer of [host, guest]) {
        assert.deepEqual(JSON.parse((peer.state as { locationDiscardIdsByDeck: string }).locationDiscardIdsByDeck).general, [discarded]);
        const wire = JSON.stringify(peer.state);
        assert.ok(wire.includes(active)); assert.doesNotMatch(wire, /cardRemovedFromDeck|pendingLocationEncounter|deckOrderById/);
        for (const id of state.privateState.deckOrderById[key]!) assert.ok(!wire.includes(id));
      }
      const before = structuredClone(internal.toEngineState()), publicBefore = JSON.stringify(room.state);
      for (const corrupt of ["duplicate", "foreign", "sparse", "missing deck", "false flag", "stripped active"] as const) {
        const bad = structuredClone(before);
        if (corrupt === "duplicate") bad.locationDiscardIdsByDeck!.general!.push(active);
        if (corrupt === "foreign") bad.locationDiscardIdsByDeck = { general: ["foreign"] };
        if (corrupt === "sparse") bad.locationDiscardIdsByDeck = { general: Array(1) };
        if (corrupt === "missing deck") delete bad.privateState.deckOrderById[key];
        if (corrupt === "false flag") Reflect.set(bad.pendingLocationEncounter!, "cardRemovedFromDeck", false);
        if (corrupt === "stripped active") { bad.pendingLocationEncounter = undefined; bad.currentLocationEncounterCardId = undefined; }
        assert.throws(() => internal.applyEngineState(bad), /Location restoration rejected/);
        assert.deepEqual(internal.toEngineState(), before); assert.equal(JSON.stringify(room.state), publicBefore);
      }
      await guest.leave(false);
      const resumed = await server.sdk.reconnect(guest.reconnectionToken);
      await resumed.waitForInitialState();
      assert.deepEqual(JSON.parse((resumed.state as { locationDiscardIdsByDeck: string }).locationDiscardIdsByDeck).general, [discarded]);
    });
  });
}
