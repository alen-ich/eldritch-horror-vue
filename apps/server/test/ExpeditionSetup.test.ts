import assert from "node:assert/strict";
import type { ColyseusTestServer } from "@colyseus/testing";
import type config from "../src/app.config.js";
import { GameRoom } from "../src/rooms/GameRoom.js";
import { baseGameExpeditionSetup } from "@eldritch/content";
import { drawExpeditionCard, discardExpeditionCard, type GameContent, type GameState } from "@eldritch/engine";
import { baseGameMap } from "@eldritch/content";
import { commandMessageType, commandErrorMessageType, type GameCommand } from "@eldritch/protocol";

async function eventually(check: () => boolean): Promise<void> {
  for (let n = 0; n < 100; n++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
  assert.ok(check());
}

export function registerExpeditionSetupRoomTests(getServer: () => ColyseusTestServer<typeof config>): void {
  describe("Expedition setup", () => {
    const inventoryContent: GameContent = { expeditionEncounters: baseGameExpeditionSetup, map: baseGameMap,
      investigators: {}, assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
    };
    const inventoryContext = { shuffle: <T>(cards: readonly T[]): T[] => [...cards], rollDie: () => 6, createId: () => "inventory", drawToken: <T>(pool: readonly T[]) => ({ token: pool[0]!, remaining: pool.slice(1) }) };
    async function fixture() {
      const server = getServer(), room = await server.createRoom<GameRoom>("game", {});
      const host = await server.connectTo(room, { displayName: "Host" }), guest = await server.connectTo(room, { displayName: "Guest" });
      const errors: string[] = [];
      for (const client of [host, guest]) client.onMessage(commandErrorMessageType, (error: { code: string }) => errors.push(error.code));
      const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
      async function send(client: typeof host, command: GameCommand, version = room.state.stateVersion) {
        client.send(commandMessageType, { expectedStateVersion: version, command });
        await room.waitForMessage(commandMessageType);
      }
      await send(host, { type: "SELECT_INVESTIGATOR", investigatorId: "mark_harrigan" });
      await send(guest, { type: "SELECT_INVESTIGATOR", investigatorId: "trish_scarborough" });
      await send(host, { type: "SELECT_ANCIENT_ONE", ancientOneId: "azathoth" });
      return { server, room, host, guest, internal, send, errors };
    }

    it("starts one hidden physical deck and synchronizes only its top-back location", async () => {
      const { room, host, guest, internal, send } = await fixture();
      const version = room.state.stateVersion;
      await send(host, { type: "START_GAME" });
      const state = internal.toEngineState(), deck = state.privateState.deckOrderById["encounter:expedition"];
      assert.ok(Array.isArray(deck));
      assert.equal(deck.length, 18);
      assert.equal(new Set(deck).size, 18);
      const location = baseGameExpeditionSetup.find(card => card.id === deck[0])!.locationId;
      assert.equal(state.activeExpeditionLocationId, location);
      assert.equal(room.state.stateVersion, version + 1);
      await eventually(() => host.state.activeExpeditionLocationId === location && guest.state.activeExpeditionLocationId === location);
      for (const publicState of [room.state, host.state, guest.state]) {
        assert.doesNotMatch(JSON.stringify(publicState), /encounter_expedition_|encounter:expedition|deckOrderById/);
      }
    });

    it("projects an internal draw/discard without revealing the remaining order or binding", async () => {
      const { room, host, guest, internal, send } = await fixture();
      await send(host, { type: "START_GAME" });
      const state = internal.toEngineState(), owner = state.players[0]!;
      owner.locationId = state.activeExpeditionLocationId;
      state.monsters = []; state.monsterLocationIds = []; state.phase = "encounter";
      const drawn = drawExpeditionCard(state, owner.id, inventoryContent, inventoryContext);
      if (drawn.ok === false) throw new Error(drawn.error.message);
      internal.applyEngineState(drawn.state);
      const cardId = drawn.state.currentLocationEncounterCardId!;
      await eventually(() => guest.state.currentLocationEncounterCardId === cardId);
      assert.deepEqual(internal.toEngineState().privateState.expeditionDraw, drawn.state.privateState.expeditionDraw);
      const saved = JSON.parse(JSON.stringify(internal.toEngineState())) as GameState;
      internal.applyEngineState(saved);
      assert.deepEqual(JSON.parse(JSON.stringify(internal.toEngineState())), saved);
      const before = internal.toEngineState();
      const invalid = structuredClone(before);
      invalid.expeditionDiscardIds = [invalid.privateState.deckOrderById["encounter:expedition"]![0]!];
      assert.throws(() => internal.applyEngineState(invalid), /Expedition/);
      assert.deepEqual(internal.toEngineState(), before);
      const discarded = discardExpeditionCard(before, owner.id, inventoryContent, inventoryContext);
      if (discarded.ok === false) throw new Error(discarded.error.message);
      internal.applyEngineState(discarded.state);
      await eventually(() => guest.state.expeditionDiscardIds === JSON.stringify([cardId]));
      assert.deepEqual(internal.toEngineState().expeditionDiscardIds, [cardId]);
      for (const publicState of [room.state, host.state, guest.state]) assert.doesNotMatch(JSON.stringify(publicState), /expeditionDraw|deckOrderById/);
      for (const id of discarded.state.privateState.deckOrderById["encounter:expedition"]!) assert.doesNotMatch(JSON.stringify(guest.state), new RegExp(id));
    });

    it("preserves exact order and marker through JSON restoration and reconnect", async () => {
      const { server, room, host, internal, send } = await fixture();
      await send(host, { type: "START_GAME" });
      const state = internal.toEngineState();
      assert.ok(state.activeExpeditionLocationId);
      internal.applyEngineState(JSON.parse(JSON.stringify(state)) as GameState);
      assert.deepEqual(internal.toEngineState(), state);
      const hostId = state.players[0]!.id, token = host.reconnectionToken;
      host.reconnection.enabled = false; host.connection.close();
      await eventually(() => !room.state.players.get(hostId)?.connected);
      const restored = await server.sdk.reconnect(token);
      await eventually(() => restored.state?.activeExpeditionLocationId === state.activeExpeditionLocationId);
      assert.deepEqual(internal.toEngineState().privateState.deckOrderById["encounter:expedition"], state.privateState.deckOrderById["encounter:expedition"]);
    });

    it("rejects mismatched, duplicated and stripped restoration atomically", async () => {
      const { room, host, internal, send } = await fixture();
      await send(host, { type: "START_GAME" });
      const before = internal.toEngineState(), publicBefore = JSON.stringify(room.state);
      for (const corruption of ["marker", "duplicate", "stripped"] as const) {
        const state = structuredClone(before);
        if (corruption === "marker") state.activeExpeditionLocationId = state.activeExpeditionLocationId === "antarctica" ? "tunguska" : "antarctica";
        if (corruption === "duplicate") state.privateState.deckOrderById["encounter:expedition"]![0] = state.privateState.deckOrderById["encounter:expedition"]![1]!;
        if (corruption === "stripped") { delete state.activeExpeditionLocationId; delete state.privateState.deckOrderById["encounter:expedition"]; }
        assert.throws(() => internal.applyEngineState(state), /Expedition/);
        assert.deepEqual(internal.toEngineState(), before);
        assert.equal(JSON.stringify(room.state), publicBefore);
      }
    });

    it("does not initialize on unauthorized or stale start or leak into another lobby", async () => {
      const { server, room, host, guest, internal, send, errors } = await fixture();
      const before = internal.toEngineState();
      await send(guest, { type: "START_GAME" });
      await send(host, { type: "START_GAME" }, room.state.stateVersion - 1);
      await eventually(() => errors.length === 2);
      assert.deepEqual(errors, ["NOT_HOST", "STALE_STATE"]);
      assert.deepEqual(internal.toEngineState(), before);
      await send(host, { type: "START_GAME" });
      assert.ok(room.state.activeExpeditionLocationId);
      const separate = await server.createRoom<GameRoom>("game", {});
      assert.equal(separate.state.activeExpeditionLocationId, "");
    });
  });
}
