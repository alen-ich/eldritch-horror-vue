import assert from "node:assert/strict";
import type { ColyseusTestServer } from "@colyseus/testing";
import type config from "../src/app.config.js";
import { GameRoom } from "../src/rooms/GameRoom.js";
import type { GameState } from "@eldritch/engine";
export function registerLocationBindingRoomTests(getServer: () => ColyseusTestServer<typeof config>): void {
  describe("Location binding restoration", () => {
    it("rejects orphan reveals before two-peer room mutation", async () => {
      const room = await getServer().createRoom<GameRoom>("game", {});
      const host = await getServer().connectTo(room, { displayName: "Host" });
      const guest = await getServer().connectTo(room, { displayName: "Guest" });
      const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
      const before = JSON.stringify(internal.toEngineState()), publicBefore = JSON.stringify(room.state);
      for (const deck of ["general", "america", "europe", "asia_australia"]) {
        const bad = JSON.parse(before) as GameState;
        bad.currentLocationEncounterCardId = `encounter_${deck}_01`;
        assert.throws(() => internal.applyEngineState(bad), /Location/);
        assert.equal(JSON.stringify(internal.toEngineState()), before);
        assert.equal(JSON.stringify(room.state), publicBefore);
      }
      await new Promise(resolve => setTimeout(resolve, room.patchRate * 2));
      for (const state of [host.state, guest.state]) assert.doesNotMatch(JSON.stringify(state), /deckOrderById|pendingLocationEncounter|encounter_general_/);
    });
  });
}
