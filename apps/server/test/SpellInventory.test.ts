import assert from "node:assert/strict";
import { ColyseusTestServer } from "@colyseus/testing";
import { baseGameSpells } from "@eldritch/content";
import { executeCommand, gainSpell, discardSpell, type GameState, type GameContent, type EngineContext } from "@eldritch/engine";
import { commandMessageType, commandErrorMessageType, pendingDecisionMessageType, type GameCommand } from "@eldritch/protocol";
import config from "../src/app.config.js";
import { GameRoom } from "../src/rooms/GameRoom.js";
import { baseGameSpellBacks } from "../src/private-spell-backs.js";
import { assertNoPrivateSpellBackData } from "../src/spell-back-privacy.js";

const context: EngineContext = { shuffle: items => [...items], rollDie: () => 6, createId: () => "id", drawToken: pool => ({ token: pool[0]!, remaining: pool.slice(1) }) };
const content: GameContent = { spells: baseGameSpells, map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city" } }, investigators: {}, assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {} };
async function eventually(check: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
  assert.ok(check(), "synchronized Spell state did not arrive");
}
function privateFree(value: unknown) {
  const text = JSON.stringify(value);
  assert.doesNotMatch(text, /spell_[a-z_]+_0[12]|heldByPlayer|heldByDefeatedInvestigator|private-card-assets/);
  assertNoPrivateSpellBackData([{ path: "room payload", text }], baseGameSpellBacks);
}

export function registerSpellRoomTests(getServer: () => ColyseusTestServer<typeof config>): void {
describe("private physical Spell room boundary", () => {
  it("detects hidden reverse text even without a physical ID", () => {
    assert.throws(() => privateFree({ text: baseGameSpellBacks[0]!.branches[0]!.instructions[0]!.text }), /Private Spell/);
  });
  let server: ColyseusTestServer<typeof config>;
  before(() => { server = getServer(); });
  async function started() {
    const room = await server.createRoom<GameRoom>("game", {});
    const host = await server.connectTo(room, { displayName: "Host" });
    const guest = await server.connectTo(room, { displayName: "Guest" });
    async function send(client: typeof host, command: GameCommand) {
      client.send(commandMessageType, { expectedStateVersion: room.state.stateVersion, command });
      await room.waitForMessage(commandMessageType);
    }
    await send(host, { type: "SELECT_INVESTIGATOR", investigatorId: "trish_scarborough" });
    await send(guest, { type: "SELECT_INVESTIGATOR", investigatorId: "mark_harrigan" });
    await send(host, { type: "SELECT_ANCIENT_ONE", ancientOneId: "azathoth" });
    await send(host, { type: "START_GAME" });
    assert.equal(room.state.phase, "action");
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    // Setup itself uses server randomness. Pin only the Spell supply so copy
    // assertions below are independent of which legal shuffle setup produced.
    const ordered = internal.toEngineState();
    ordered.privateState.spells!.deck = baseGameSpells.map(card => card.id);
    internal.applyEngineState(ordered);
    const hostId = [...room.state.players.values()].find(player => player.displayName === "Host")!.id;
    return { room, host, guest, internal, hostId, send };
  }
  it("initializes, grants, discards and restores exact copies while both clients see only fronts", async () => {
    const { room, host, guest, internal, hostId } = await started();
    const initial = internal.toEngineState(); assert.equal(initial.privateState.spells?.deck.length, 20);
    const result = gainSpell(initial, hostId, { type: "kind", kind: "wither" }, content, context);
    assert.ok(result.ok); internal.applyEngineState(result.state);
    await eventually(() => host.state.players.get(hostId)?.spellIds === "spell_wither" && guest.state.players.get(hostId)?.spellIds === "spell_wither");
    const restored = JSON.parse(JSON.stringify(internal.toEngineState())) as GameState;
    assert.deepEqual(restored.privateState.spells?.heldByPlayer[hostId], ["spell_wither_02"]);
    internal.applyEngineState(restored);
    restored.privateState.spells!.deck.pop();
    assert.equal(internal.toEngineState().privateState.spells?.deck.length, 19);
    const detached = internal.toEngineState(); detached.privateState.spells!.deck.pop();
    assert.equal(internal.toEngineState().privateState.spells?.deck.length, 19);
    [room.state, host.state, guest.state, result.events].forEach(privateFree);
    const discarded = discardSpell(internal.toEngineState(), hostId, "spell_wither_02", content, context);
    assert.ok(discarded.ok); internal.applyEngineState(discarded.state);
    await eventually(() => host.state.players.get(hostId)?.spellIds === "");
    assert.equal(internal.toEngineState().privateState.spells?.deck.length, 20);
  });
  it("rejects corrupt restoration before touching the last valid room state", async () => {
    const { room, internal } = await started();
    const before = internal.toEngineState(); const publicBefore = JSON.stringify(room.state);
    const corrupted = structuredClone(before); delete corrupted.privateState.spells;
    assert.throws(() => internal.applyEngineState(corrupted), /Spell inventory/);
    assert.deepEqual(internal.toEngineState(), before); assert.equal(JSON.stringify(room.state), publicBefore);
    const duplicate = structuredClone(before); duplicate.privateState.spells!.deck.push("spell_wither_01");
    assert.throws(() => internal.applyEngineState(duplicate), /Spell/);
    assert.deepEqual(internal.toEngineState(), before);
    const fresh = new GameRoom() as unknown as { applyEngineState(state: GameState): void };
    assert.throws(() => fresh.applyEngineState(corrupted), /Spell inventory/);
  });
  it("preserves the same physical holdings through real seat reconnect", async () => {
    const { room, host, guest, internal, hostId } = await started();
    const result = gainSpell(internal.toEngineState(), hostId, { type: "kind", kind: "wither" }, content, context);
    assert.ok(result.ok); internal.applyEngineState(result.state);
    const token = host.reconnectionToken; host.reconnection.enabled = false;
    host.connection.close(); await eventually(() => !room.state.players.get(hostId)?.connected);
    const restored = await server.sdk.reconnect(token);
    await eventually(() => room.state.players.get(hostId)?.connected === true);
    await eventually(() => restored.state.players?.get(hostId)?.spellIds === "spell_wither");
    assert.deepEqual(internal.toEngineState().privateState.spells?.heldByPlayer[hostId], ["spell_wither_02"]);
    [restored.state, guest.state].forEach(privateFree);
  });
  it("keeps owner-targeted decision delivery free of unrevealed reverse content", async () => {
    const { room, host, guest, internal, hostId } = await started();
    const grant = gainSpell(internal.toEngineState(), hostId, { type: "kind", kind: "wither" }, content, context);
    assert.ok(grant.ok);
    grant.state.pendingDecision = { id: "spell-privacy-decision", kind: "select_rerolls", playerId: hostId,
      visibility: "owner", prompt: "Choose a die to reroll.", optionIds: ["die-1"], minSelections: 0, maxSelections: 1 };
    const delivery = host.waitForMessage(pendingDecisionMessageType);
    internal.applyEngineState(grant.state);
    const payload = await delivery;
    assert.deepEqual(payload, grant.state.pendingDecision); privateFree(payload);
    // Exercise the same targeted restore hook used by reconnect, and await a real payload.
    const restoredDelivery = host.waitForMessage(pendingDecisionMessageType);
    room.onReconnect(room.clients.find(client => client.sessionId === host.sessionId)!);
    privateFree(await restoredDelivery);
    await eventually(() => guest.state.pendingDecision?.id === "spell-privacy-decision");
    assert.equal("optionIds" in guest.state.pendingDecision!, false);
    [host.state, guest.state, room.state].forEach(privateFree);
  });
  it("keeps defeated caches private and rejects invented commands in isolated rooms", async () => {
    const { room, host, internal, hostId } = await started();
    const other = await server.createRoom<GameRoom>("game", {});
    await server.connectTo(other, { displayName: "Other" });
    const grant = gainSpell(internal.toEngineState(), hostId, { type: "kind", kind: "wither" }, content, context); assert.ok(grant.ok);
    const before = grant.state; before.players.find(player => player.id === hostId)!.defeated = true;
    before.pendingDefeat = { playerId: hostId, causes: ["health"], cityIds: ["arkham"] };
    const guestId = before.players.find(player => player.id !== hostId)!.id;
    const defeat = executeCommand(before, hostId, { type: "RESOLVE_DEFEAT", cityId: "arkham", cause: "health", leadPlayerId: guestId }, content); assert.ok(defeat.ok);
    internal.applyEngineState(defeat.state);
    assert.deepEqual(internal.toEngineState().privateState.spells?.heldByDefeatedInvestigator.trish_scarborough, ["spell_wither_02"]);
    assert.deepEqual(JSON.parse(room.state.investigatorLifecycle).defeatedInvestigators[0].spellIds, ["spell_wither"]);
    privateFree(room.state); assert.equal(other.state.spellSupplyTopId, "");
    for (const type of ["GAIN_SPELL", "CAST_SPELL", "DISCARD_SPELL"]) {
      const error = host.waitForMessage(commandErrorMessageType);
      host.send(commandMessageType, { expectedStateVersion: room.state.stateVersion, command: { type, spellId: "spell_wither_02" } });
      await room.waitForMessage(commandMessageType); privateFree(await error);
      assert.deepEqual(internal.toEngineState().privateState.spells, defeat.state.privateState.spells);
    }
  });
});
}
