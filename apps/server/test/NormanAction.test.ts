import assert from "node:assert/strict";
import type { ColyseusTestServer } from "@colyseus/testing";
import type config from "../src/app.config.js";
import { GameRoom } from "../src/rooms/GameRoom.js";
import { baseGameGates, baseGameMonsters } from "@eldritch/content";
import type { GameState } from "@eldritch/engine";
import { commandMessageType, commandErrorMessageType, type GameCommand } from "@eldritch/protocol";

async function eventually(check: () => boolean): Promise<void> {
  for (let n = 0; n < 100; n++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
  assert.ok(check());
}

export function registerNormanActionRoomTests(getServer: () => ColyseusTestServer<typeof config>): void {
  describe("Norman's investigator action", () => {
    async function fixture() {
      const server = getServer(), room = await server.createRoom<GameRoom>("game", {});
      const host = await server.connectTo(room, { displayName: "Norman" }), guest = await server.connectTo(room, { displayName: "Mark" });
      const errors: string[] = [];
      host.onMessage(commandErrorMessageType, error => errors.push(error.code));
      guest.onMessage(commandErrorMessageType, error => errors.push(error.code));
      const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
      async function send(client: typeof host, command: GameCommand, version = room.state.stateVersion) {
        client.send(commandMessageType, { expectedStateVersion: version, command }); await room.waitForMessage(commandMessageType);
      }
      await send(host, { type: "SELECT_INVESTIGATOR", investigatorId: "norman_withers" });
      await send(guest, { type: "SELECT_INVESTIGATOR", investigatorId: "mark_harrigan" });
      await send(host, { type: "SELECT_ANCIENT_ONE", ancientOneId: "azathoth" });
      await send(host, { type: "START_GAME" });
      const state = internal.toEngineState(), player = state.players[0]!;
      const target = state.monsters!.find(monster => baseGameMonsters.find(def => def.id === monster.monsterId)?.type === "normal")!;
      assert.ok(target);
      // Spawn effects may move a drawn Monster away from its Gate. Bind the
      // test's target to an actual active Gate instead of depending on the draw.
      target.locationId = baseGameGates.find(gate => gate.id === state.activeGateIds![0])!.locationId;
      state.monsterLocationIds = [...new Set(state.monsters!.map(monster => monster.locationId))];
      player.clues = 2; state.privateState.tokenPoolById[`held_clues:${player.id}`] = state.privateState.tokenPoolById.clues!.splice(0, 2);
      player.locationId = target.locationId === "arkham" ? "london" : "arkham";
      internal.applyEngineState(state);
      return { server, room, host, guest, internal, send, errors, targetId: target.id, hostId: player.id };
    }
    for (const useSanity of [false, true]) it(`synchronizes an atomic remote discard with Sanity=${useSanity}`, async () => {
      const f = await fixture(), before = f.internal.toEngineState();
      const other = await f.server.createRoom<GameRoom>("game", {}), otherBefore = other.state.toJSON();
      const command: GameCommand = { type: "USE_INVESTIGATOR_ACTION", monsterInstanceId: f.targetId, useSanity };
      await f.send(f.host, command);
      const after = f.internal.toEngineState();
      assert.equal(after.players[0]!.clues, useSanity ? 1 : 0);
      assert.equal(after.players[0]!.sanity, useSanity ? 6 : 7);
      assert.equal(after.actionsRemaining, 1); assert.equal(after.stateVersion, before.stateVersion + 1);
      assert.ok(!after.monsters!.some(monster => monster.id === f.targetId));
      await eventually(() => f.guest.state.stateVersion === after.stateVersion);
      assert.equal(f.guest.state.players.get(f.hostId)?.clues, useSanity ? 1 : 0);
      assert.ok(!JSON.parse(f.guest.state.monsters).some((monster: { id: string }) => monster.id === f.targetId));
      assert.doesNotMatch(JSON.stringify(f.guest.state.toJSON()), /normanClueSubstitutions|held_clues|tokenPoolById|feedTheMindByPhysicalId/);
      assert.deepEqual(other.state.toJSON(), otherBefore);
      const snapshot = structuredClone(after); f.internal.applyEngineState(snapshot);
      assert.deepEqual(f.internal.toEngineState().privateState.investigatorAbilityUsage, snapshot.privateState.investigatorAbilityUsage);
      await f.send(f.host, command, before.stateVersion); await eventually(() => f.errors.length > 0);
      assert.equal(f.room.state.stateVersion, after.stateVersion);
      await f.send(f.host, command); await eventually(() => f.errors.length > 1);
      assert.equal(f.room.state.stateVersion, after.stateVersion);
    });
    it("rejects another player, malformed payment and a target whose Gate closed", async () => {
      const f = await fixture(), before = f.internal.toEngineState();
      const command: GameCommand = { type: "USE_INVESTIGATOR_ACTION", monsterInstanceId: f.targetId, useSanity: true };
      await f.send(f.guest, command); await eventually(() => f.errors.length === 1);
      assert.equal(f.room.state.stateVersion, before.stateVersion);
      f.host.send(commandMessageType, { expectedStateVersion: f.room.state.stateVersion, command: { ...command, useSanity: 1 } });
      await f.room.waitForMessage(commandMessageType); await eventually(() => f.errors.length === 2);
      assert.equal(f.errors[1], "INVALID_COMMAND");
      const closed = f.internal.toEngineState(); closed.activeGateIds = []; f.internal.applyEngineState(closed);
      await f.send(f.host, command); await eventually(() => f.errors.length === 3);
      assert.deepEqual(f.internal.toEngineState().players, closed.players);
    });
  });
}
