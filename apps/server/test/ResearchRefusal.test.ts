import assert from "node:assert/strict";
import type { ColyseusTestServer } from "@colyseus/testing";
import type config from "../src/app.config.js";
import { GameRoom } from "../src/rooms/GameRoom.js";
import { createSpellInventory, createDeterministicEngineContext, type GameState } from "@eldritch/engine";
import { baseGameConditions, baseGameScannedTokenEncounters, baseGameSpells } from "@eldritch/content";
import { commandErrorMessageType, commandMessageType, pendingDecisionMessageType, type GameCommand } from "@eldritch/protocol";

export function registerResearchRefusalTests(getServer: () => ColyseusTestServer<typeof config>): void {
  describe("bound Research refusal room", () => {
    for (const accept of [false, true]) it(`restores the complete optional branch (accept=${accept})`, async () => {
      const server = getServer(), room = await server.createRoom<GameRoom>("game", {});
      const host = await server.connectTo(room, { displayName: "Host" }), guest = await server.connectTo(room, { displayName: "Guest" });
      const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
      const state = internal.toEngineState(), hostId = state.players[0]!.id;
      state.privateState.spells = createSpellInventory(baseGameSpells, state.players.map(p => p.id), createDeterministicEngineContext({ shuffleIndexes: Array<number>(19).fill(0) }));
      state.phase = "encounter"; state.activePlayerId = state.leadInvestigatorId = hostId; state.ancientOneId = "cthulhu"; state.doom = 12;
      state.players[0] = { ...state.players[0]!, investigatorId: "akachi_onyele", locationId: "space_2", health: 5, sanity: 7, clues: 1, assetIds: [] };
      state.boardClues = [{ id: "bound-clue", locationId: "space_2" }];
      state.monsters = [{ id: "physical", monsterId: "monster_star_spawn", locationId: "arkham", damage: 2, setAside: true }];
      state.privateState.tokenPoolById = { "board_clue:bound-clue": ["clue_arkham"], [`held_clues:${hostId}`]: ["clue_london"], clues: [], monsters: ["monster_star_spawn"], "set_aside:monster_star_spawn": ["monster_star_spawn"] };
      for (const c of baseGameConditions) (state.privateState.tokenPoolById[`condition:${c.kind}`] ??= []).push(c.id);
      const first = "encounter_research_cthulhu_01";
      state.privateState.deckOrderById["encounter:research_cthulhu"] = [first, ...baseGameScannedTokenEncounters.filter(c => c.deck === "research_cthulhu" && c.id !== first).map(c => c.id)];
      internal.applyEngineState(state);
      async function send(command: GameCommand) {
        host.send(commandMessageType, { expectedStateVersion: room.state.stateVersion, command }); await room.waitForMessage(commandMessageType);
      }
      await send({ type: "RESOLVE_RESEARCH_ENCOUNTER", clueId: "bound-clue" });
      const offer = internal.toEngineState(); assert.deepEqual(offer.pendingDecision?.optionIds, ["accept", "skip"]);
      const refreshedOffer = host.waitForMessage(pendingDecisionMessageType);
      internal.applyEngineState(JSON.parse(JSON.stringify(offer)) as GameState); await refreshedOffer;
      const rejected = guest.waitForMessage(commandErrorMessageType);
      guest.send(commandMessageType, { expectedStateVersion: room.state.stateVersion, command: { type: "RESOLVE_DECISION", decisionId: offer.pendingDecision!.id, selectedOptionIds: [accept ? "accept" : "skip"] } });
      await room.waitForMessage(commandMessageType); assert.equal((await rejected).code, "NOT_DECISION_OWNER");
      await send({ type: "RESOLVE_DECISION", decisionId: offer.pendingDecision!.id, selectedOptionIds: [accept ? "accept" : "skip"] });
      if (!accept) {
        for (const skill of ["will", "strength"]) {
          const paused = internal.toEngineState(); assert.equal(paused.activeTest?.skill, skill);
          assert.deepEqual(paused.boardClues, []); assert.deepEqual(paused.privateState.tokenPoolById.clue_discard, ["clue_arkham"]);
          paused.activeTest!.dice = paused.activeTest!.dice.map(() => 6); paused.activeTest!.successes = paused.activeTest!.dice.length;
          const refreshed = host.waitForMessage(pendingDecisionMessageType);
          internal.applyEngineState(JSON.parse(JSON.stringify(paused)) as GameState); await refreshed;
          await send({ type: "RESOLVE_DECISION", decisionId: paused.pendingDecision!.id, selectedOptionIds: [] });
        }
      }
      const after = internal.toEngineState(); assert.equal(after.pendingLocationEncounter, undefined); assert.equal(after.activePlayerId, after.players[1]!.id);
      assert.equal(after.players[0]?.clues, accept ? 2 : 1); assert.equal(after.privateState.spells!.heldByPlayer[hostId]!.length, accept ? 1 : 0);
      assert.equal((after.players[0]?.conditionIds ?? []).some(id => id.includes("dark_pact")), accept);
      assert.deepEqual(after.privateState.tokenPoolById.clue_discard ?? [], accept ? [] : ["clue_arkham"]);
      assert.deepEqual(after.researchDiscardIds, [first]); assert.deepEqual(after.monsters, state.monsters);
      assert.deepEqual(after.privateState.tokenPoolById.monsters, state.privateState.tokenPoolById.monsters);
      assert.deepEqual(after.privateState.tokenPoolById["set_aside:monster_star_spawn"], ["monster_star_spawn"]);
      await new Promise(resolve => setTimeout(resolve, room.patchRate * 2));
      for (const view of [room.state, host.state, guest.state]) assert.doesNotMatch(JSON.stringify(view), /ambush_result|deckOrderById|researchMarkerBinding|heldByPlayer/);
    });
  });
}
