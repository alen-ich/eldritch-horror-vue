import assert from "node:assert/strict";
import type { ColyseusTestServer } from "@colyseus/testing";
import type config from "../src/app.config.js";
import { GameRoom } from "../src/rooms/GameRoom.js";
import type { GameState } from "@eldritch/engine";
import { baseGameScannedTokenEncounters } from "@eldritch/content";
import { commandErrorMessageType, commandMessageType, type GameCommand } from "@eldritch/protocol";

export function registerResearchSetupRoomTests(getServer: () => ColyseusTestServer<typeof config>): void {
  describe("physical Research setup", () => {
    for (const ancient of ["azathoth", "cthulhu", "shub_niggurath", "yog_sothoth"] as const) {
      it(`starts and privately restores all eight ${ancient} cards independently of effects`, async () => {
        const server = getServer(), room = await server.createRoom<GameRoom>("game", {});
        const host = await server.connectTo(room, { displayName: "Host" }), guest = await server.connectTo(room, { displayName: "Guest" });
        const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
        async function send(command: GameCommand) {
          host.send(commandMessageType, { expectedStateVersion: room.state.stateVersion, command });
          await room.waitForMessage(commandMessageType);
        }
        await send({ type: "SELECT_INVESTIGATOR", investigatorId: "mark_harrigan" });
        guest.send(commandMessageType, { expectedStateVersion: room.state.stateVersion, command: { type: "SELECT_INVESTIGATOR", investigatorId: "trish_scarborough" } });
        await room.waitForMessage(commandMessageType);
        await send({ type: "SELECT_ANCIENT_ONE", ancientOneId: ancient }); await send({ type: "START_GAME" });
        const saved = internal.toEngineState(), key = `encounter:research_${ancient}`, deck = saved.privateState.deckOrderById[key];
        assert.ok(deck); assert.equal(deck.length, 8); assert.equal(new Set(deck).size, 8);
        const expected = baseGameScannedTokenEncounters.filter(card => card.deck === `research_${ancient}`).map(card => card.id);
        assert.deepEqual([...deck].sort(), expected.sort());
        internal.applyEngineState(JSON.parse(JSON.stringify(saved)) as GameState);
        assert.deepEqual(internal.toEngineState().privateState.deckOrderById[key], deck);
        await new Promise(resolve => setTimeout(resolve, room.patchRate * 2));
        for (const state of [room.state, host.state, guest.state]) assert.doesNotMatch(JSON.stringify(state), /encounter_research_|deckOrderById/);
        if (ancient === "shub_niggurath" || ancient === "yog_sothoth") {
          saved.phase = "encounter"; saved.activePlayerId = saved.players[0]!.id;
          const marker = saved.boardClues![0]!; saved.players[0]!.locationId = marker.locationId;
          saved.monsters = []; saved.monsterLocationIds = [];
          internal.applyEngineState(saved);
          const before = JSON.stringify(internal.toEngineState()), error = host.waitForMessage(commandErrorMessageType);
          await send({ type: "RESOLVE_RESEARCH_ENCOUNTER", clueId: marker.id });
          assert.equal((await error).code, "ENCOUNTER_UNSUPPORTED");
          assert.equal(JSON.stringify(internal.toEngineState()), before);
        }
      });
    }
  });
}
