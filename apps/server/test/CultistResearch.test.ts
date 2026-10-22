import assert from "node:assert/strict";
import type { ColyseusTestServer } from "@colyseus/testing";
import type config from "../src/app.config.js";
import { GameRoom } from "../src/rooms/GameRoom.js";
import { createSpellInventory, createDeterministicEngineContext, type GameState } from "@eldritch/engine";
import { baseGameConditions, baseGameScannedTokenEncounters, baseGameSpells } from "@eldritch/content";
import { commandErrorMessageType, commandMessageType, pendingDecisionMessageType, type GameCommand } from "@eldritch/protocol";

export function registerCultistResearchTests(getServer: () => ColyseusTestServer<typeof config>): void {
  describe("normal Cthulhu Cultist Research room", () => {
    for (const lethal of [false, true]) it(`transfers verified stats and restores private Strength (lethal=${lethal})`, async () => {
      const server = getServer(), room = await server.createRoom<GameRoom>("game", {});
      const host = await server.connectTo(room, { displayName: "Host" }), guest = await server.connectTo(room, { displayName: "Guest" });
      const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
      const state = internal.toEngineState(), hostId = state.players[0]!.id;
      state.privateState.spells = createSpellInventory(baseGameSpells, state.players.map(player => player.id), createDeterministicEngineContext({ shuffleIndexes: Array<number>(19).fill(0) }));
      state.phase = "encounter"; state.activePlayerId = state.leadInvestigatorId = hostId; state.ancientOneId = "cthulhu"; state.doom = 12;
      state.players[0] = { ...state.players[0]!, investigatorId: "akachi_onyele", locationId: "arkham", health: 5, sanity: lethal ? 1 : 7, clues: 1, assetIds: [] };
      state.boardClues = [{ id: "cultist-clue", locationId: "arkham" }];
      state.monsters = [{ id: "remote", monsterId: "monster_cultist", locationId: "london", damage: 0 }];
      state.privateState.tokenPoolById = { "board_clue:cultist-clue": ["clue_arkham"], [`held_clues:${hostId}`]: ["clue_london"], clues: [], monsters: ["monster_cultist"], "set_aside:monster_deep_one": ["monster_deep_one"] };
      for (const c of baseGameConditions) (state.privateState.tokenPoolById[`condition:${c.kind}`] ??= []).push(c.id);
      const first = "encounter_research_cthulhu_07";
      state.privateState.deckOrderById["encounter:research_cthulhu"] = [first, ...baseGameScannedTokenEncounters.filter(card => card.deck === "research_cthulhu" && card.id !== first).map(card => card.id)];
      internal.applyEngineState(state);
      async function send(command: GameCommand) {
        host.send(commandMessageType, { expectedStateVersion: room.state.stateVersion, command });
        await room.waitForMessage(commandMessageType);
      }
      await send({ type: "RESOLVE_RESEARCH_ENCOUNTER", clueId: "cultist-clue" });
      const paused = internal.toEngineState();
      if (lethal) {
        assert.deepEqual(paused.pendingDefeat?.causes, ["sanity"]);
        assert.equal(paused.pendingLocationEncounter, undefined); assert.equal(paused.activeTest, undefined);
        assert.deepEqual(paused.boardClues, state.boardClues);
      } else {
        assert.equal(paused.activeTest?.skill, "strength"); assert.equal(paused.players[0]?.sanity, 6);
        paused.activeTest!.dice = paused.activeTest!.dice.map(() => 6); paused.activeTest!.successes = paused.activeTest!.dice.length;
        const refreshed = host.waitForMessage(pendingDecisionMessageType);
        internal.applyEngineState(JSON.parse(JSON.stringify(paused)) as GameState); await refreshed;
        await new Promise(resolve => setTimeout(resolve, room.patchRate * 2));
        for (const view of [room.state, host.state, guest.state]) assert.doesNotMatch(JSON.stringify(view), /ambush_result|normalCultistCombat|deckOrderById/);
        const rejected = guest.waitForMessage(commandErrorMessageType);
        guest.send(commandMessageType, { expectedStateVersion: room.state.stateVersion, command: { type: "RESOLVE_DECISION", decisionId: paused.pendingDecision!.id, selectedOptionIds: [] } });
        await room.waitForMessage(commandMessageType); assert.equal((await rejected).code, "NOT_DECISION_OWNER");
        await send({ type: "RESOLVE_DECISION", decisionId: paused.pendingDecision!.id, selectedOptionIds: [] });
        const after = internal.toEngineState();
        assert.equal(after.players[0]?.sanity, 6); assert.equal(after.players[0]?.clues, 2);
        assert.equal(after.activePlayerId, state.players[1]?.id); assert.equal(after.pendingLocationEncounter, undefined);
      }
      const after = internal.toEngineState();
      assert.deepEqual(after.monsters, state.monsters); assert.deepEqual(after.privateState.tokenPoolById.monsters, ["monster_cultist"]);
      assert.deepEqual(after.privateState.tokenPoolById["set_aside:monster_deep_one"], ["monster_deep_one"]);
      assert.deepEqual(after.researchDiscardIds, [first]);
    });
  });
}
