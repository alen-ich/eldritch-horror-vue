import assert from "node:assert/strict";
import type { ColyseusTestServer } from "@colyseus/testing";
import type config from "../src/app.config.js";
import { GameRoom } from "../src/rooms/GameRoom.js";
import type { GameState } from "@eldritch/engine";
import { baseGameClues, baseGameGates } from "@eldritch/content";
import { commandMessageType, pendingDecisionMessageType, type GameCommand } from "@eldritch/protocol";

export function registerOtherWorldStateRoomTests(getServer: () => ColyseusTestServer<typeof config>): void {
  describe("Other World inventory restoration", () => {
    async function fixture() {
      const server = getServer(), room = await server.createRoom<GameRoom>("game", {});
      const host = await server.connectTo(room, { displayName: "Host" });
      const guest = await server.connectTo(room, { displayName: "Guest" });
      const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
      async function send(client: typeof host, command: GameCommand) {
        client.send(commandMessageType, { expectedStateVersion: room.state.stateVersion, command });
        await room.waitForMessage(commandMessageType);
      }
      await send(host, { type: "SELECT_INVESTIGATOR", investigatorId: "mark_harrigan" });
      await send(guest, { type: "SELECT_INVESTIGATOR", investigatorId: "trish_scarborough" });
      await send(host, { type: "SELECT_ANCIENT_ONE", ancientOneId: "azathoth" });
      await send(host, { type: "START_GAME" });
      return { room, host, guest, internal, send };
    }
    for (const corruption of ["missing", "duplicate", "unknown", "incomplete", "empty", "orphan", "sparse"]) {
      it(`rejects ${corruption} inventory before any room mutation`, async () => {
        const { room, internal } = await fixture();
        const before = JSON.stringify(internal.toEngineState()), publicBefore = JSON.stringify(room.state);
        const bad = JSON.parse(before) as GameState;
        const deck = bad.privateState.deckOrderById["encounter:other_world"]!;
        if (corruption === "missing") delete bad.privateState.deckOrderById["encounter:other_world"];
        if (corruption === "duplicate") deck[1] = deck[0]!;
        if (corruption === "unknown") deck[0] = "unknown";
        if (corruption === "incomplete") deck.pop();
        if (corruption === "empty") deck.length = 0;
        if (corruption === "sparse") delete deck[1];
        if (corruption === "orphan") bad.currentLocationEncounterCardId = deck[0];
        bad.doom = 1;
        assert.throws(() => internal.applyEngineState(bad), /Other World/);
        assert.equal(JSON.stringify(internal.toEngineState()), before);
        assert.equal(JSON.stringify(room.state), publicBefore);
      });
    }
    it("restores a live owner decision and a closed Gate without exposing either binding", async () => {
      const { room, host, guest, internal, send } = await fixture();
      const before = internal.toEngineState(), owner = before.players[0]!;
      before.phase = "encounter"; before.activePlayerId = owner.id; before.monsters = []; before.monsterLocationIds = [];
      owner.locationId = "arkham"; owner.assetIds = []; owner.clues = 1;
      before.players[1]!.locationId = "london"; before.players[1]!.clues = 0;
      before.activeGateIds = ["gate_arkham"]; before.discardedGateIds = [];
      before.privateState.deckOrderById.gates = baseGameGates.filter(gate => gate.id !== "gate_arkham").map(gate => gate.id);
      const deck = before.privateState.deckOrderById["encounter:other_world"]!, card = "encounter_other_world_02";
      before.privateState.deckOrderById["encounter:other_world"] = [card, ...deck.filter(id => id !== card)];
      before.privateState.tokenPoolById.clues = baseGameClues.filter(clue => clue.id !== "clue_arkham").map(clue => clue.id);
      before.privateState.tokenPoolById.clue_discard = [];
      before.privateState.tokenPoolById[`held_clues:${owner.id}`] = ["clue_arkham"];
      before.privateState.tokenPoolById[`held_clues:${before.players[1]!.id}`] = [];
      internal.applyEngineState(before);
      const offered = host.waitForMessage(pendingDecisionMessageType);
      await send(host, { type: "RESOLVE_OTHER_WORLD_ENCOUNTER", gateId: "gate_arkham" }); await offered;
      const initial = internal.toEngineState(); assert.ok(initial.pendingDecision); assert.ok(initial.activeTest);
      initial.activeTest.dice = initial.activeTest.dice.map(() => 6); initial.activeTest.successes = initial.activeTest.dice.length;
      const refreshed = host.waitForMessage(pendingDecisionMessageType);
      internal.applyEngineState(JSON.parse(JSON.stringify(initial)) as GameState); await refreshed;
      assert.deepEqual(internal.toEngineState().pendingLocationEncounter, initial.pendingLocationEncounter);
      const followOffer = host.waitForMessage(pendingDecisionMessageType);
      await send(host, { type: "RESOLVE_DECISION", decisionId: initial.pendingDecision.id, selectedOptionIds: [] }); await followOffer;
      const follow = internal.toEngineState(); assert.equal(follow.pendingLocationEncounter?.gateClosed, true);
      const closedOffer = host.waitForMessage(pendingDecisionMessageType);
      internal.applyEngineState(JSON.parse(JSON.stringify(follow)) as GameState); await closedOffer;
      assert.deepEqual(internal.toEngineState().pendingLocationEncounter, follow.pendingLocationEncounter);
      await new Promise(resolve => setTimeout(resolve, room.patchRate * 2));
      for (const state of [room.state, host.state, guest.state]) {
        const wire = JSON.stringify(state);
        assert.doesNotMatch(wire, /deckOrderById|pendingLocationEncounter|gateLocationId|gateClosed/);
        for (const id of deck.filter(id => id !== card)) assert.ok(!wire.includes(id));
      }
    });
    it("restores exact private order while both peers see only public state", async () => {
      const { room, host, guest, internal } = await fixture();
      const saved = JSON.parse(JSON.stringify(internal.toEngineState())) as GameState;
      saved.privateState.deckOrderById["encounter:other_world"]!.reverse();
      internal.applyEngineState(saved);
      assert.deepEqual(JSON.parse(JSON.stringify(internal.toEngineState())), saved);
      await new Promise(resolve => setTimeout(resolve, room.patchRate * 2));
      for (const state of [room.state, host.state, guest.state]) {
        assert.doesNotMatch(JSON.stringify(state), /encounter_other_world_|deckOrderById|pendingLocationEncounter|gateLocationId/);
      }
    });
  });
}
