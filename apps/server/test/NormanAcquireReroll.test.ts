import assert from "node:assert/strict";
import type { ColyseusTestServer } from "@colyseus/testing";
import { createDeterministicEngineContext, type EngineContext, type GameState } from "@eldritch/engine";
import { commandMessageType, commandErrorMessageType, pendingDecisionMessageType, type GameCommand, type PendingDecision } from "@eldritch/protocol";
import type config from "../src/app.config.js";
import { GameRoom } from "../src/rooms/GameRoom.js";

async function eventually(check: () => boolean): Promise<void> {
  for (let n = 0; n < 100; n++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
  assert.ok(check());
}
export function registerNormanAcquireRerollRoomTests(getServer: () => ColyseusTestServer<typeof config>): void {
  describe("Norman acquisition", () => {
    async function fixture() {
      const server = getServer(), room = await server.createRoom<GameRoom>("game", {});
      const host = await server.connectTo(room, { displayName: "Norman" }), guest = await server.connectTo(room, { displayName: "Mark" });
      const internal = room as unknown as { toEngineState(): GameState; applyEngineState(s: GameState): void; createEngineContext(c: GameCommand): EngineContext | undefined };
      async function send(client: typeof host, command: GameCommand, version = room.state.stateVersion) {
        client.send(commandMessageType, { expectedStateVersion: version, command }); await room.waitForMessage(commandMessageType);
      }
      await send(host, { type: "SELECT_INVESTIGATOR", investigatorId: "norman_withers" });
      await send(guest, { type: "SELECT_INVESTIGATOR", investigatorId: "mark_harrigan" });
      await send(host, { type: "SELECT_ANCIENT_ONE", ancientOneId: "azathoth" }); await send(host, { type: "START_GAME" });
      const state = internal.toEngineState(), hostId = state.players[0]!.id;
      state.players[0]!.locationId = "arkham";
      // Keep physical Monsters conserved while clearing the action's City.
      for (const monster of state.monsters ?? []) if (monster.locationId === "arkham") monster.locationId = "london";
      state.monsterLocationIds = [...new Set((state.monsters ?? []).map(monster => monster.locationId))];
      internal.applyEngineState(state);
      internal.createEngineContext = () => createDeterministicEngineContext({ dice: Array(20).fill(1), ids: Array.from({ length: 20 }, (_, i) => `acquire-${room.state.stateVersion}-${i}`) });
      return { server, room, host, guest, internal, hostId, send };
    }
    it("rejects forged restored choices before mutating room state", async () => {
      const f = await fixture(); await f.send(f.host, { type: "ACQUIRE_ASSETS" });
      const before = f.internal.toEngineState(); assert.ok(before.pendingDecision!.optionIds.includes("norman-sanity:0"));
      for (const corrupt of [
        (s: GameState) => { s.pendingDecision!.optionIds.push("norman-sanity:99"); },
        (s: GameState) => { s.pendingDecision!.playerId = s.players[1]!.id; },
        (s: GameState) => { delete s.privateState.investigatorAbilityUsage; },
        (s: GameState) => { s.pendingDecision!.visibility = "public"; },
        (s: GameState) => { s.activeTest!.successes = 99; },
        (s: GameState) => { s.activeTest!.successThreshold = 2; },
        (s: GameState) => { s.activeTest!.dicePool = 99; },
      ]) {
        const snapshot = structuredClone(before); corrupt(snapshot);
        assert.throws(() => f.internal.applyEngineState(snapshot), /ability|acquisition/i);
        assert.deepEqual(f.internal.toEngineState(), before);
      }
      f.internal.applyEngineState(structuredClone(before)); assert.deepEqual(f.internal.toEngineState(), before);
    });
    it("restores owner-only choices, pays once, rejects stale/replay and isolates other rooms", async () => {
      const f = await fixture(), other = await f.server.createRoom<GameRoom>("game", {}), otherBefore = other.state.toJSON();
      const own: PendingDecision[] = [], foreign: PendingDecision[] = [], errors: { code: string }[] = [];
      f.host.onMessage(pendingDecisionMessageType, d => own.push(d)); f.guest.onMessage(pendingDecisionMessageType, d => foreign.push(d));
      f.guest.onMessage(commandErrorMessageType, e => errors.push(e));
      await f.send(f.host, { type: "ACQUIRE_ASSETS" }); await eventually(() => own.some(d => d.optionIds.includes("norman-sanity:0")));
      const before = f.internal.toEngineState(), decisionId = before.pendingDecision!.id;
      const command: GameCommand = { type: "RESOLVE_DECISION", decisionId, selectedOptionIds: ["norman-sanity:0"] };
      await f.send(f.guest, command); await eventually(() => errors.length > 0); assert.deepEqual(f.internal.toEngineState(), before);
      const token = f.host.reconnectionToken; f.host.reconnection.enabled = false; f.host.connection.close();
      await eventually(() => !f.room.state.players.get(f.hostId)?.connected);
      const restored = await f.server.sdk.reconnect(token), choices: PendingDecision[] = [], restoredErrors: { code: string }[] = [];
      restored.onMessage(pendingDecisionMessageType, d => choices.push(d)); restored.onMessage(commandErrorMessageType, e => restoredErrors.push(e));
      restored.send("request-seat-token"); await eventually(() => choices.some(d => d.id === decisionId && d.optionIds.includes("norman-sanity:0")));
      await f.send(restored, command, f.room.state.stateVersion - 1); await eventually(() => restoredErrors.some(e => e.code === "STALE_STATE"));
      assert.equal(f.internal.toEngineState().players[0]!.sanity, 7);
      const version = f.room.state.stateVersion;
      await f.send(restored, command); const paid = f.internal.toEngineState();
      assert.equal(paid.players[0]!.sanity, 6); assert.equal(paid.players[0]!.clues, 0); assert.equal(paid.stateVersion, version + 1);
      assert.equal(paid.privateState.investigatorAbilityUsage!.normanClueSubstitutions.length, 1);
      await eventually(() => f.guest.state.players.get(f.hostId)?.sanity === 6);
      await f.send(restored, command); assert.deepEqual(f.internal.toEngineState(), paid);
      f.internal.applyEngineState(structuredClone(paid)); assert.deepEqual(f.internal.toEngineState(), paid);
      for (const value of [f.room.state.toJSON(), f.guest.state.toJSON(), restored.state.toJSON(), ...foreign]) {
        assert.doesNotMatch(JSON.stringify(value), /investigatorAbilityUsage|normanClueSubstitutions|norman-sanity:|tokenPoolById|sourcePhysicalId|feedTheMindByPhysicalId|private-card-assets/);
      }
      assert.deepEqual(other.state.toJSON(), otherBefore);
    });
  });
}
