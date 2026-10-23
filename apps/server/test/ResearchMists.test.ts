import assert from "node:assert/strict";
import type { ColyseusTestServer } from "@colyseus/testing";
import type config from "../src/app.config.js";
import { GameRoom } from "../src/rooms/GameRoom.js";
import { createSpellInventory, createDeterministicEngineContext, type GameState } from "@eldritch/engine";
import { baseGameConditions, baseGameScannedTokenEncounters, baseGameSpells } from "@eldritch/content";
import { commandErrorMessageType, commandMessageType, pendingDecisionMessageType, type GameCommand } from "@eldritch/protocol";

export function registerResearchMistsTests(getServer: () => ColyseusTestServer<typeof config>): void {
  describe("named Mists Research room", () => {
    for (const pass of [false, true]) it(`restores private Observation and resolves named reward (pass=${pass})`, async () => {
      const server = getServer(), room = await server.createRoom<GameRoom>("game", {});
      const host = await server.connectTo(room, { displayName: "Host" }), guest = await server.connectTo(room, { displayName: "Guest" });
      const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
      const state = internal.toEngineState(), hostId = state.players[0]!.id;
      state.privateState.spells = createSpellInventory(baseGameSpells, state.players.map(p => p.id), createDeterministicEngineContext({ shuffleIndexes: Array<number>(19).fill(0) }));
      state.phase = "encounter"; state.activePlayerId = state.leadInvestigatorId = hostId; state.ancientOneId = "cthulhu"; state.doom = 12;
      state.players[0] = { ...state.players[0]!, investigatorId: "akachi_onyele", locationId: "arkham", health: 5, sanity: 7, clues: 1, assetIds: [] };
      state.boardClues = [{ id: "mists-clue", locationId: "arkham" }];
      state.privateState.tokenPoolById = { "board_clue:mists-clue": ["clue_arkham"], [`held_clues:${hostId}`]: ["clue_london"], clues: [] };
      for (const c of baseGameConditions) (state.privateState.tokenPoolById[`condition:${c.kind}`] ??= []).push(c.id);
      const first = "encounter_research_cthulhu_06";
      state.privateState.deckOrderById["encounter:research_cthulhu"] = [first, ...baseGameScannedTokenEncounters.filter(c => c.deck === "research_cthulhu" && c.id !== first).map(c => c.id)];
      internal.applyEngineState(state);
      async function send(command: GameCommand) {
        host.send(commandMessageType, { expectedStateVersion: room.state.stateVersion, command }); await room.waitForMessage(commandMessageType);
      }
      await send({ type: "RESOLVE_RESEARCH_ENCOUNTER", clueId: "mists-clue" });
      const paused = internal.toEngineState(); assert.equal(paused.activeTest?.skill, "observation");
      assert.equal(paused.privateState.spells!.heldByPlayer[hostId]!.length, 0);
      paused.activeTest!.dice = paused.activeTest!.dice.map(() => pass ? 6 : 1); paused.activeTest!.successes = pass ? paused.activeTest!.dice.length : 0;
      const refreshed = host.waitForMessage(pendingDecisionMessageType);
      internal.applyEngineState(JSON.parse(JSON.stringify(paused)) as GameState); await refreshed;
      const rejected = guest.waitForMessage(commandErrorMessageType);
      guest.send(commandMessageType, { expectedStateVersion: room.state.stateVersion, command: { type: "RESOLVE_DECISION", decisionId: paused.pendingDecision!.id, selectedOptionIds: [] } });
      await room.waitForMessage(commandMessageType); assert.equal((await rejected).code, "NOT_DECISION_OWNER");
      await send({ type: "RESOLVE_DECISION", decisionId: paused.pendingDecision!.id, selectedOptionIds: [] });
      const after = internal.toEngineState(), held = after.privateState.spells!.heldByPlayer[hostId]!;
      assert.equal(held.length, pass ? 1 : 0); assert.equal(after.players[0]?.clues, pass ? 2 : 1);
      if (pass) assert.equal(baseGameSpells.find(s => s.id === held[0])?.kind, "mists_of_releh");
      else assert.match(after.players[0]!.conditionIds![0]!, /paranoia/);
      assert.equal(after.pendingLocationEncounter, undefined); assert.equal(after.activePlayerId, after.players[1]!.id);
      assert.deepEqual(after.researchDiscardIds, [first]);
      const refreshAfter = internal.toEngineState(); internal.applyEngineState(JSON.parse(JSON.stringify(refreshAfter)) as GameState);
      assert.deepEqual(internal.toEngineState().privateState.spells, after.privateState.spells);
      await new Promise(resolve => setTimeout(resolve, room.patchRate * 2));
      for (const view of [room.state, host.state, guest.state]) {
        const json = JSON.stringify(view); assert.doesNotMatch(json, /deckOrderById|heldByPlayer/);
        for (const physicalId of held) assert.equal(json.includes(physicalId), false);
      }
    });
  });
}
