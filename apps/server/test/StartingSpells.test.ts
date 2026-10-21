import assert from "node:assert/strict";
import type { ColyseusTestServer } from "@colyseus/testing";
import type config from "../src/app.config.js";
import { GameRoom } from "../src/rooms/GameRoom.js";
import { validateSpellInventory, type GameState } from "@eldritch/engine";
import { baseGameSpells } from "@eldritch/content";
import { commandMessageType, commandErrorMessageType, pendingDecisionMessageType, type GameCommand, type PendingDecision, type InvestigatorId } from "@eldritch/protocol";

async function eventually(check: () => boolean): Promise<void> {
  for (let n = 0; n < 100; n++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
  assert.ok(check());
}

export function registerStartingSpellRoomTests(getServer: () => ColyseusTestServer<typeof config>): void {
  describe("starting Spell", () => {
    async function fixture(investigatorId: InvestigatorId = "norman_withers") {
      const server = getServer(), room = await server.createRoom<GameRoom>("game", {});
      const host = await server.connectTo(room, { displayName: "Norman" }), guest = await server.connectTo(room, { displayName: "Mark" });
      const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
      async function send(client: typeof host, command: GameCommand, version = room.state.stateVersion) {
        client.send(commandMessageType, { expectedStateVersion: version, command }); await room.waitForMessage(commandMessageType);
      }
      await send(host, { type: "SELECT_INVESTIGATOR", investigatorId });
      await send(guest, { type: "SELECT_INVESTIGATOR", investigatorId: "mark_harrigan" });
      await send(host, { type: "SELECT_ANCIENT_ONE", ancientOneId: "azathoth" });
      return { server, room, host, guest, internal, send };
    }

    it("grants from ordinary setup once, restores the seat and keeps only fronts public", async () => {
      const { server, room, host, guest, internal, send } = await fixture();
      const version = room.state.stateVersion;
      await send(host, { type: "START_GAME" });
      const state = internal.toEngineState(), hostId = state.players[0]!.id;
      assert.equal(room.state.stateVersion, version + 1);
      assert.equal(state.privateState.spells!.heldByPlayer[hostId]!.length, 1);
      assert.equal(state.privateState.spells!.deck.length, 19);
      assert.equal(validateSpellInventory(state, baseGameSpells), undefined);
      await eventually(() => guest.state.players.get(hostId)?.spellIds === "spell_feed_the_mind");
      const token = host.reconnectionToken;
      host.reconnection.enabled = false; host.connection.close();
      await eventually(() => !room.state.players.get(hostId)?.connected);
      const restored = await server.sdk.reconnect(token);
      await eventually(() => restored.state?.players?.get(hostId)?.spellIds === "spell_feed_the_mind");
      assert.deepEqual(internal.toEngineState().privateState.spells, state.privateState.spells);
      internal.applyEngineState(JSON.parse(JSON.stringify(internal.toEngineState())) as GameState);
      assert.deepEqual(internal.toEngineState().privateState.spells, state.privateState.spells);
      await send(restored, { type: "START_GAME" });
      assert.deepEqual(internal.toEngineState().privateState.spells, state.privateState.spells);
      for (const value of [room.state, guest.state, restored.state]) assert.doesNotMatch(JSON.stringify(value), /spell_[a-z_]+_0[12]|heldByPlayer|heldByDefeatedInvestigator|sourcePhysicalId|feedTheMindByPhysicalId|private-card-assets/);
    });

    it("authorizes start and cast, rejects stale replay and isolates owner choices and rooms", async () => {
      const { server, room, host, guest, internal, send } = await fixture();
      const errors: {code: string}[] = [], own: PendingDecision[] = [], foreign: PendingDecision[] = [];
      host.onMessage(commandErrorMessageType, e => errors.push(e)); guest.onMessage(commandErrorMessageType, e => errors.push(e));
      host.onMessage(pendingDecisionMessageType, d => own.push(d)); guest.onMessage(pendingDecisionMessageType, d => foreign.push(d));
      const before = internal.toEngineState();
      await send(guest, { type: "START_GAME" });
      assert.deepEqual(internal.toEngineState(), before);
      await send(host, { type: "START_GAME" }, room.state.stateVersion - 1);
      assert.deepEqual(internal.toEngineState(), before);
      await send(host, { type: "START_GAME" });
      const started = internal.toEngineState();
      await send(guest, { type: "CAST_SPELL", spellId: "spell_feed_the_mind" });
      assert.deepEqual(internal.toEngineState(), started);
      const other = await server.createRoom<GameRoom>("game", {}), otherBefore = JSON.stringify(other.state);
      await send(host, { type: "CAST_SPELL", spellId: "spell_feed_the_mind" });
      await eventually(() => own.some(d => d.optionIds.includes("norman-sanity:0")));
      assert.ok(foreign.every(d => !d.optionIds?.some(id => id.startsWith("norman-sanity:"))));
      const pending = internal.toEngineState();
      await send(guest, { type: "RESOLVE_DECISION", decisionId: pending.pendingDecision!.id, selectedOptionIds: ["norman-sanity:0"] });
      assert.deepEqual(internal.toEngineState(), pending);
      assert.equal(JSON.stringify(other.state), otherBefore);
      await eventually(() => errors.some(e => e.code === "STALE_STATE"));
      for (const value of [room.state, guest.state, ...foreign]) assert.doesNotMatch(JSON.stringify(value), /spell_[a-z_]+_0[12]|heldByPlayer|sourcePhysicalId|feedTheMindByPhysicalId|private-card-assets/);
    });

    it("replaces a defeated investigator with Norman using real server shuffle and preserves snapshot conservation", async () => {
      const { room, host, internal, send } = await fixture("trish_scarborough");
      await send(host, { type: "START_GAME" });
      const state = internal.toEngineState(), hostId = state.players[0]!.id;
      state.players[0]!.health = 0;
      state.players[0]!.defeated = true;
      state.pendingDefeat = { playerId: hostId, cityIds: ["arkham"], causes: ["health"] };
      internal.applyEngineState(state);
      await send(host, { type: "RESOLVE_DEFEAT", cityId: "arkham", cause: "health", leadPlayerId: state.players[1]!.id });
      const defeated = internal.toEngineState(); defeated.phase = "mythos"; defeated.replacementWindow = true;
      internal.applyEngineState(defeated);
      const version = room.state.stateVersion;
      await send(host, { type: "REPLACE_INVESTIGATOR", investigatorId: "norman_withers" });
      const replaced = internal.toEngineState();
      assert.equal(replaced.players[0]!.investigatorId, "norman_withers");
      assert.equal(replaced.privateState.spells!.heldByPlayer[hostId]!.length, 1);
      assert.equal(validateSpellInventory(replaced, baseGameSpells), undefined);
      assert.equal(room.state.stateVersion, version + 1);
      await send(host, { type: "REPLACE_INVESTIGATOR", investigatorId: "norman_withers" });
      assert.deepEqual(internal.toEngineState(), replaced);
      const corrupt = structuredClone(replaced); corrupt.privateState.spells!.deck.pop();
      assert.throws(() => internal.applyEngineState(corrupt), /Spell/);
      assert.deepEqual(internal.toEngineState(), replaced);
    });

    it("preserves Clue recycling for a replacement whose printed setup needs a Clue", async () => {
      const { host, internal, send } = await fixture("trish_scarborough");
      await send(host, { type: "START_GAME" });
      const state = internal.toEngineState(), hostId = state.players[0]!.id;
      state.players[0]!.defeated = true; state.players[0]!.health = 0;
      state.pendingDefeat = { playerId: hostId, cityIds: ["arkham"], causes: ["health"] };
      internal.applyEngineState(state);
      await send(host, { type: "RESOLVE_DEFEAT", cityId: "arkham", cause: "health", leadPlayerId: state.players[1]!.id });
      const defeated = internal.toEngineState(); defeated.phase = "mythos"; defeated.replacementWindow = true;
      const recycled = defeated.privateState.tokenPoolById.clues!.splice(0);
      assert.ok(recycled.length > 1);
      defeated.privateState.tokenPoolById.clue_discard = recycled;
      internal.applyEngineState(defeated);
      await send(host, { type: "REPLACE_INVESTIGATOR", investigatorId: "akachi_onyele" });
      const replaced = internal.toEngineState();
      assert.equal(replaced.players[0]!.investigatorId, "akachi_onyele");
      assert.equal(replaced.players[0]!.clues, 1);
      assert.equal(replaced.privateState.tokenPoolById.clue_discard!.length, 0);
      assert.equal(replaced.privateState.tokenPoolById.clues!.length, recycled.length - 1);
      assert.deepEqual(replaced.privateState.spells, defeated.privateState.spells);
    });

    it("does not grant retroactively when an old active empty-hand snapshot reconnects", async () => {
      const { server, room, host, internal, send } = await fixture();
      await send(host, { type: "START_GAME" });
      const legacy = internal.toEngineState(), hostId = legacy.players[0]!.id;
      legacy.privateState.spells!.deck.push(...legacy.privateState.spells!.heldByPlayer[hostId]!);
      legacy.privateState.spells!.heldByPlayer[hostId] = [];
      internal.applyEngineState(legacy);
      const token = host.reconnectionToken; host.reconnection.enabled = false; host.connection.close();
      await eventually(() => !room.state.players.get(hostId)?.connected);
      const restored = await server.sdk.reconnect(token);
      await eventually(() => restored.state?.players?.get(hostId)?.connected === true);
      assert.equal(restored.state.players.get(hostId)?.spellIds, "");
      assert.deepEqual(internal.toEngineState().privateState.spells, legacy.privateState.spells);
    });
  });
}
