import assert from "node:assert/strict";
import { registerResearchDiscardTests } from "./ResearchDiscard.test.js";
import { registerResearchOrphanRevealTests } from "./ResearchOrphanReveal.test.js";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { GameState } from "@eldritch/engine";
import { commandErrorMessageType, commandMessageType, type GameCommand } from "@eldritch/protocol";
import type appConfig from "../src/app.config.js";
import { GameRoom } from "../src/rooms/GameRoom.js";

export function registerResearchDrawIntegrityTests(getServer: () => ColyseusTestServer<typeof appConfig>): void {
registerResearchDiscardTests(getServer);
registerResearchOrphanRevealTests(getServer);
describe("Research draw physical integrity over the network", () => {
  it("rejects inconsistent restored Research before changing either client's state", async () => {
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
    const state = internal.toEngineState(), cardId = state.privateState.deckOrderById["encounter:research_azathoth"]![0]!;
    state.phase = "encounter"; state.activePlayerId = state.players[0]!.id;
    state.currentLocationEncounterCardId = cardId;
    state.pendingLocationEncounter = { playerId: state.activePlayerId, cardId, deck: "research_azathoth", queue: [], dice: [], successes: 0 };
    internal.applyEngineState(JSON.parse(JSON.stringify(state)) as GameState);
    await new Promise(resolve => setTimeout(resolve, room.patchRate * 2));
    const before = structuredClone(internal.toEngineState()), publicBefore = [host, guest].map(client => JSON.stringify(client.state));
    for (const corrupt of ["top", "reveal", "owner", "phase", "tail"]) {
      const invalid = structuredClone(before);
      if (corrupt === "top") invalid.privateState.deckOrderById["encounter:research_azathoth"]!.reverse();
      if (corrupt === "reveal") invalid.currentLocationEncounterCardId = "secret_wrong_reveal";
      if (corrupt === "owner") invalid.pendingLocationEncounter!.playerId = invalid.players[1]!.id;
      if (corrupt === "phase") invalid.phase = "action";
      if (corrupt === "tail") invalid.privateState.deckOrderById["encounter:research_azathoth"]![7] = cardId;
      assert.throws(() => internal.applyEngineState(invalid), /Research restoration rejected/);
      assert.deepEqual(internal.toEngineState(), before);
    }
    await new Promise(resolve => setTimeout(resolve, room.patchRate * 2));
    assert.deepEqual([host, guest].map(client => JSON.stringify(client.state)), publicBefore);
  });
  it("rejects a corrupted hidden tail without changing state or exposing card IDs", async () => {
    const server = getServer(), room = await server.createRoom<GameRoom>("game", {});
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
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState(), marker = state.boardClues![0]!;
    state.phase = "encounter"; state.activePlayerId = state.players[0]!.id;
    state.players[0]!.locationId = marker.locationId; state.monsters = []; state.monsterLocationIds = [];
    internal.applyEngineState(state);
    // Simulate server-private corruption after the restoration boundary accepted a valid snapshot.
    const live = room as unknown as { privateState: GameState["privateState"] };
    const order = live.privateState.deckOrderById["encounter:research_azathoth"]!;
    order[7] = order[0]!;
    const before = structuredClone(internal.toEngineState()), error = host.waitForMessage(commandErrorMessageType);
    await send({ type: "RESOLVE_RESEARCH_ENCOUNTER", clueId: marker.id });
    const rejected = await error;
    assert.equal(rejected.code, "ENCOUNTER_CONTENT_MISSING");
    assert.doesNotMatch(JSON.stringify(rejected), /encounter_research_|deckOrderById/);
    assert.deepEqual(internal.toEngineState(), before);
    await new Promise(resolve => setTimeout(resolve, room.patchRate * 2));
    assert.doesNotMatch(JSON.stringify(guest.state), /encounter_research_|deckOrderById/);
  });
});
}
