import assert from "node:assert/strict";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { gainNamedArtifact, type GameState, type GameContent } from "@eldritch/engine";
import { baseGameArtifacts, baseGameClues, baseGameConditions, baseGameGates, baseGameScannedTokenEncounters } from "@eldritch/content";
import {
  commandErrorMessageType,
  commandMessageType,
  pendingDecisionMessageType,
  type GameCommand,
  type PendingDecision,
} from "@eldritch/protocol";
import appConfig from "../src/app.config.js";
import { GameRoom } from "../src/rooms/GameRoom.js";
import { GameRoomState, PendingDecisionState } from "../src/rooms/schema/GameRoomState.js";

describe("authoritative game room", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  before(async () => { colyseus = await boot(appConfig); });
  after(async () => colyseus.shutdown());
  beforeEach(async () => colyseus.cleanup());

  for (const branch of ["close", "defeat", "hallucinations"]) {
    it(`restores Dreamlands' ${branch} branch with authoritative Clue dice`, async () => {
      const room = await colyseus.createRoom<GameRoom>("game", {});
      const host = await colyseus.connectTo(room, { displayName: "Host" });
      const guest = await colyseus.connectTo(room, { displayName: "Guest" });
      const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
      const state = internal.toEngineState();
      state.phase = "encounter"; state.ancientOneId = "azathoth"; state.doom = 15;
      state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
      Object.assign(state.players[0]!, { investigatorId: "trish_scarborough", locationId: "arkham", health: branch === "defeat" ? 2 : 7, sanity: 5, maxHealth: 7, maxSanity: 5, clues: 2, assetIds: [] });
      Object.assign(state.players[1]!, { locationId: "london", clues: 0, assetIds: [] });
      state.activeGateIds = ["gate_arkham"]; state.discardedGateIds = [];
      state.privateState.deckOrderById.gates = baseGameGates.filter(gate => gate.id !== "gate_arkham").map(gate => gate.id);
      const cardId = "encounter_other_world_07";
      state.privateState.deckOrderById["encounter:other_world"] = [cardId, ...baseGameScannedTokenEncounters.filter(card => card.deck === "other_world" && card.id !== cardId).map(card => card.id)];
      const held = baseGameClues.slice(0, 2).map(clue => clue.id);
      state.privateState.tokenPoolById.clues = baseGameClues.filter(clue => !held.includes(clue.id)).map(clue => clue.id);
      state.privateState.tokenPoolById.clue_discard = [];
      state.privateState.tokenPoolById[`held_clues:${state.players[0]!.id}`] = held;
      state.privateState.tokenPoolById[`held_clues:${state.players[1]!.id}`] = [];
      state.privateState.tokenPoolById["condition:hallucinations"] = baseGameConditions.filter(card => card.kind === "hallucinations").map(card => card.id);
      internal.applyEngineState(state);
      const initialMessage = host.waitForMessage(pendingDecisionMessageType);
      sendCommand(room, host, { type: "RESOLVE_OTHER_WORLD_ENCOUNTER", gateId: "gate_arkham" }); await room.waitForMessage(commandMessageType); await initialMessage;
      const initial = internal.toEngineState();
      assert.equal(initial.activeTest?.skill, "will"); assert.equal(initial.activeTest?.modifier, -1); assert.equal(initial.activeTest?.dicePool, 3);
      initial.activeTest!.dice = initial.activeTest!.dice.map(() => branch === "hallucinations" ? 1 : 6);
      initial.activeTest!.successes = branch === "hallucinations" ? 0 : 3;
      const restoredInitialMessage = host.waitForMessage(pendingDecisionMessageType);
      internal.applyEngineState(JSON.parse(JSON.stringify(initial))); const choice = await restoredInitialMessage as PendingDecision;
      const denied = guest.waitForMessage(commandErrorMessageType);
      sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: [] }); await room.waitForMessage(commandMessageType);
      assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER"); assert.deepEqual(internal.toEngineState(), initial);
      const followMessage = branch === "hallucinations" ? undefined : host.waitForMessage(pendingDecisionMessageType);
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: [] }); await room.waitForMessage(commandMessageType);
      if (followMessage) {
        await followMessage;
        const follow = internal.toEngineState();
        assert.equal(follow.activeTest?.skill, "strength"); assert.equal(follow.activeTest?.dicePool, 3);
        assert.deepEqual(follow.activeGateIds, ["gate_arkham"]);
        follow.activeTest!.dice = follow.activeTest!.dice.map(() => branch === "close" ? 6 : 1);
        follow.activeTest!.successes = branch === "close" ? 3 : 0;
        const restoredFollowMessage = host.waitForMessage(pendingDecisionMessageType);
        internal.applyEngineState(JSON.parse(JSON.stringify(follow))); const followChoice = await restoredFollowMessage as PendingDecision;
        sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: followChoice.id, selectedOptionIds: [] }); await room.waitForMessage(commandMessageType);
      }
      const after = internal.toEngineState();
      assert.equal(after.players[0]!.clues, 2); assert.equal(after.players[0]!.health, branch === "defeat" ? 0 : 7);
      assert.equal(after.players[0]!.delayed ?? false, branch === "hallucinations");
      assert.equal(after.players[0]!.conditionIds?.length ?? 0, branch === "hallucinations" ? 1 : 0);
      assert.equal(Boolean(after.pendingDefeat), branch === "defeat");
      assert.deepEqual(after.activeGateIds, branch === "close" ? [] : ["gate_arkham"]);
      assert.equal(after.activePlayerId, branch === "defeat" ? state.players[0]!.id : state.players[1]!.id);
      assert.equal(after.pendingLocationEncounter, undefined); assert.equal(after.privateState.deckOrderById["encounter:other_world"]!.length, 24);
      assert.equal(after.privateState.deckOrderById["encounter:other_world"]!.at(-1), cardId);
      assert.equal(JSON.stringify(room.state).includes("condition_hallucinations_0"), false); assert.equal(JSON.stringify(room.state).includes("encounter_other_world_24"), false);
    });
  }

  for (const branch of ["accept", "skip", "defeat"]) {
    it(`restores The Past's ${branch} branch with an open Gate and owner-only choices`, async () => {
      const room = await colyseus.createRoom<GameRoom>("game", {});
      const host = await colyseus.connectTo(room, { displayName: "Host" });
      const guest = await colyseus.connectTo(room, { displayName: "Guest" });
      const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
      const state = internal.toEngineState();
      state.phase = "encounter"; state.ancientOneId = "azathoth"; state.doom = 15;
      state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
      Object.assign(state.players[0]!, { investigatorId: "trish_scarborough", locationId: "arkham", health: branch === "defeat" ? 6 : 7, sanity: 5, maxHealth: 7, maxSanity: 5, clues: 1, assetIds: [] });
      Object.assign(state.players[1]!, { locationId: "london", clues: 0, assetIds: [] });
      state.activeGateIds = ["gate_arkham"]; state.discardedGateIds = [];
      state.privateState.deckOrderById.gates = baseGameGates.filter(gate => gate.id !== "gate_arkham").map(gate => gate.id);
      const cardId = "encounter_other_world_05";
      state.privateState.deckOrderById["encounter:other_world"] = [cardId, ...baseGameScannedTokenEncounters.filter(card => card.deck === "other_world" && card.id !== cardId).map(card => card.id)];
      state.privateState.tokenPoolById.clues = baseGameClues.filter(clue => clue.id !== "clue_arkham").map(clue => clue.id);
      state.privateState.tokenPoolById.clue_discard = [];
      state.privateState.tokenPoolById[`held_clues:${state.players[0]!.id}`] = ["clue_arkham"];
      state.privateState.tokenPoolById[`held_clues:${state.players[1]!.id}`] = [];
      internal.applyEngineState(state);
      const initialMessage = host.waitForMessage(pendingDecisionMessageType);
      sendCommand(room, host, { type: "RESOLVE_OTHER_WORLD_ENCOUNTER", gateId: "gate_arkham" }); await room.waitForMessage(commandMessageType); await initialMessage;
      const initial = internal.toEngineState();
      assert.equal(initial.activeTest?.skill, "influence"); assert.equal(initial.activeTest?.modifier, -1);
      initial.activeTest!.dice = initial.activeTest!.dice.map(() => branch === "defeat" ? 1 : 6);
      initial.activeTest!.successes = branch === "defeat" ? 0 : initial.activeTest!.dice.length;
      const restoredInitialMessage = host.waitForMessage(pendingDecisionMessageType);
      internal.applyEngineState(JSON.parse(JSON.stringify(initial))); const initialChoice = await restoredInitialMessage as PendingDecision;
      const followMessage = host.waitForMessage(pendingDecisionMessageType);
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: initialChoice.id, selectedOptionIds: [] }); await room.waitForMessage(commandMessageType); await followMessage;
      const follow = internal.toEngineState();
      assert.deepEqual(follow.activeGateIds, ["gate_arkham"]); assert.equal(follow.pendingLocationEncounter?.gateClosed, false);
      if (branch === "defeat") {
        assert.equal(follow.activeTest?.skill, "strength"); assert.equal(follow.activeTest?.modifier, 0);
        follow.activeTest!.dice = follow.activeTest!.dice.map(() => 1); follow.activeTest!.successes = 0;
      } else assert.equal(follow.pendingDecision?.kind, "encounter_choice");
      const restoredFollowMessage = host.waitForMessage(pendingDecisionMessageType);
      internal.applyEngineState(JSON.parse(JSON.stringify(follow))); const choice = await restoredFollowMessage as PendingDecision;
      assert.equal(JSON.stringify(room.state).includes("gateClosed"), false); assert.equal(JSON.stringify(room.state).includes("encounter_other_world_24"), false);
      const options = branch === "defeat" ? [] : [branch];
      const denied = guest.waitForMessage(commandErrorMessageType);
      sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: options }); await room.waitForMessage(commandMessageType);
      assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER"); assert.deepEqual(internal.toEngineState(), follow);
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: options }); await room.waitForMessage(commandMessageType);
      const after = internal.toEngineState();
      assert.equal(after.pendingLocationEncounter, undefined); assert.equal(after.privateState.deckOrderById["encounter:other_world"]!.length, 24);
      assert.equal(new Set(after.privateState.deckOrderById["encounter:other_world"]).size, 24);
      assert.equal(after.privateState.deckOrderById["encounter:other_world"]!.at(-1), cardId);
      assert.equal(after.players[0]!.clues, branch === "accept" ? 3 : 1); assert.equal(after.players[0]!.delayed ?? false, branch === "accept");
      assert.deepEqual(after.activeGateIds, branch === "defeat" ? ["gate_arkham"] : []);
      assert.equal(after.players[0]!.health, branch === "defeat" ? 0 : 7);
      assert.equal(Boolean(after.pendingDefeat), branch === "defeat");
      assert.equal(after.activePlayerId, branch === "defeat" ? state.players[0]!.id : state.players[1]!.id);
    });
  }

  for (const branch of ["reward", "doom"]) {
    it(`restores Lost Carcosa's ${branch} branch with owner-only choices`, async () => {
      const room = await colyseus.createRoom<GameRoom>("game", {});
      const host = await colyseus.connectTo(room, { displayName: "Host" });
      const guest = await colyseus.connectTo(room, { displayName: "Guest" });
      const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
      const state = internal.toEngineState();
      state.phase = "encounter"; state.ancientOneId = "azathoth"; state.doom = branch === "doom" ? 1 : 15;
      state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
      Object.assign(state.players[0]!, { investigatorId: "trish_scarborough", locationId: "arkham", health: 7, sanity: 5, maxHealth: 7, maxSanity: 5, clues: 1, assetIds: [] });
      Object.assign(state.players[1]!, { locationId: "london", clues: 0, assetIds: [] });
      state.activeGateIds = ["gate_arkham"]; state.discardedGateIds = [];
      state.privateState.deckOrderById.gates = baseGameGates.filter(gate => gate.id !== "gate_arkham").map(gate => gate.id);
      const cardId = "encounter_other_world_04";
      state.privateState.deckOrderById["encounter:other_world"] = [cardId, ...baseGameScannedTokenEncounters.filter(card => card.deck === "other_world" && card.id !== cardId).map(card => card.id)];
      state.privateState.tokenPoolById.clues = baseGameClues.filter(clue => clue.id !== "clue_arkham").map(clue => clue.id);
      state.privateState.tokenPoolById.clue_discard = [];
      state.privateState.tokenPoolById[`held_clues:${state.players[0]!.id}`] = ["clue_arkham"];
      state.privateState.tokenPoolById[`held_clues:${state.players[1]!.id}`] = [];
      internal.applyEngineState(state);
      const initialMessage = host.waitForMessage(pendingDecisionMessageType);
      sendCommand(room, host, { type: "RESOLVE_OTHER_WORLD_ENCOUNTER", gateId: "gate_arkham" }); await room.waitForMessage(commandMessageType);
      await initialMessage;
      const initial = internal.toEngineState();
      assert.equal(initial.activeTest?.skill, "lore"); assert.equal(initial.activeTest?.modifier, -1);
      initial.activeTest!.dice = [branch === "reward" ? 6 : 1]; initial.activeTest!.successes = branch === "reward" ? 1 : 0;
      const restoredInitialMessage = host.waitForMessage(pendingDecisionMessageType);
      internal.applyEngineState(JSON.parse(JSON.stringify(initial))); const initialChoice = await restoredInitialMessage as PendingDecision;
      const followMessage = host.waitForMessage(pendingDecisionMessageType);
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: initialChoice.id, selectedOptionIds: [] }); await room.waitForMessage(commandMessageType);
      await followMessage;
      const follow = internal.toEngineState();
      if (branch === "reward") {
        assert.equal(follow.pendingDecision?.kind, "encounter_choice"); assert.ok(follow.pendingDecision?.optionLabels?.accept?.includes("Become Delayed"));
        assert.deepEqual(follow.discardedGateIds, ["gate_arkham"]); assert.deepEqual(follow.activeGateIds, []);
        assert.equal(follow.players[0]!.delayed ?? false, false);
      } else {
        assert.equal(follow.activeTest?.skill, "influence"); assert.equal(follow.activeTest?.modifier, 0);
        follow.activeTest!.dice = follow.activeTest!.dice.map(() => 1); follow.activeTest!.successes = 0;
        assert.deepEqual(follow.activeGateIds, ["gate_arkham"]);
      }
      const restoredFollowMessage = host.waitForMessage(pendingDecisionMessageType);
      internal.applyEngineState(JSON.parse(JSON.stringify(follow))); const choice = await restoredFollowMessage as PendingDecision;
      assert.equal(JSON.stringify(room.state).includes("gateClosed"), false); assert.equal(JSON.stringify(room.state).includes("encounter_other_world_24"), false);
      const denied = guest.waitForMessage(commandErrorMessageType);
      sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: branch === "reward" ? ["accept"] : [] }); await room.waitForMessage(commandMessageType);
      assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: branch === "reward" ? ["accept"] : [] }); await room.waitForMessage(commandMessageType);
      const after = internal.toEngineState();
      assert.equal(after.pendingLocationEncounter, undefined); assert.equal(after.privateState.deckOrderById["encounter:other_world"]!.length, 24);
      assert.equal(after.privateState.deckOrderById["encounter:other_world"]!.at(-1), cardId);
      assert.equal(after.players[0]!.clues, branch === "reward" ? 3 : 1);
      assert.equal(after.players[0]!.delayed ?? false, branch === "reward");
      assert.equal(after.doom, branch === "reward" ? 15 : 0);
      assert.equal(after.activePlayerId, branch === "reward" ? state.players[1]!.id : state.players[0]!.id);
      assert.equal(after.gameResult, branch === "doom" ? "investigators_lose" : undefined);
      assert.deepEqual(after.activeGateIds, branch === "reward" ? [] : ["gate_arkham"]);
    });
  }

  for (const option of ["accept", "skip"]) {
    it(`restores card 3's private Clue-or-Paranoia decision (${option})`, async () => {
      const room = await colyseus.createRoom<GameRoom>("game", {});
      const host = await colyseus.connectTo(room, { displayName: "Host" });
      const guest = await colyseus.connectTo(room, { displayName: "Guest" });
      const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
      const state = internal.toEngineState();
      state.phase = "encounter"; state.ancientOneId = "azathoth"; state.doom = 15;
      state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
      Object.assign(state.players[0]!, { investigatorId: "trish_scarborough", locationId: "arkham", health: 7, sanity: 5, maxHealth: 7, maxSanity: 5, clues: 1, assetIds: [] });
      Object.assign(state.players[1]!, { locationId: "london", clues: 0, assetIds: [] });
      state.activeGateIds = ["gate_arkham"]; state.discardedGateIds = [];
      state.privateState.deckOrderById.gates = baseGameGates.filter(gate => gate.id !== "gate_arkham").map(gate => gate.id);
      const cardId = "encounter_other_world_03";
      state.privateState.deckOrderById["encounter:other_world"] = [cardId, ...baseGameScannedTokenEncounters.filter(card => card.deck === "other_world" && card.id !== cardId).map(card => card.id)];
      state.privateState.tokenPoolById.clues = baseGameClues.filter(clue => clue.id !== "clue_arkham").map(clue => clue.id);
      state.privateState.tokenPoolById.clue_discard = [];
      state.privateState.tokenPoolById[`held_clues:${state.players[0]!.id}`] = ["clue_arkham"];
      state.privateState.tokenPoolById[`held_clues:${state.players[1]!.id}`] = [];
      const paranoia = baseGameConditions.filter(card => card.kind === "paranoia").map(card => card.id);
      state.privateState.tokenPoolById["condition:paranoia"] = paranoia;
      internal.applyEngineState(state);
      const initialMessage = host.waitForMessage(pendingDecisionMessageType);
      sendCommand(room, host, { type: "RESOLVE_OTHER_WORLD_ENCOUNTER", gateId: "gate_arkham" }); await room.waitForMessage(commandMessageType);
      await initialMessage;
      const initial = internal.toEngineState();
      assert.equal(initial.activeTest?.skill, "lore"); assert.equal(initial.activeTest?.modifier, -1);
      initial.activeTest!.dice = [1]; initial.activeTest!.successes = 0;
      const restoredTestMessage = host.waitForMessage(pendingDecisionMessageType);
      internal.applyEngineState(JSON.parse(JSON.stringify(initial))); const test = await restoredTestMessage as PendingDecision;
      const offeredMessage = host.waitForMessage(pendingDecisionMessageType);
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: test.id, selectedOptionIds: [] }); await room.waitForMessage(commandMessageType);
      await offeredMessage;
      const before = internal.toEngineState();
      assert.equal(before.pendingDecision?.kind, "encounter_choice");
      assert.ok(before.pendingDecision?.optionLabels?.skip?.includes("paranoia"));
      const restoredChoiceMessage = host.waitForMessage(pendingDecisionMessageType);
      internal.applyEngineState(JSON.parse(JSON.stringify(before))); const choice = await restoredChoiceMessage as PendingDecision;
      assert.equal(JSON.stringify(room.state).includes("condition_paranoia_01"), false);
      assert.equal(JSON.stringify(room.state).includes("Spend 1 clues"), false);
      const denied = guest.waitForMessage(commandErrorMessageType);
      sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: [option] }); await room.waitForMessage(commandMessageType);
      assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
      assert.deepEqual(internal.toEngineState(), before);
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: [option] }); await room.waitForMessage(commandMessageType);
      const after = internal.toEngineState();
      assert.equal(after.players[0]!.clues, option === "accept" ? 0 : 1);
      assert.equal(after.players[0]!.sanity, option === "accept" ? 5 : 3);
      assert.equal(after.players[0]!.conditionIds?.length ?? 0, option === "accept" ? 0 : 1);
      assert.equal(after.privateState.tokenPoolById["condition:paranoia"]!.length, option === "accept" ? 3 : 2);
      assert.deepEqual(after.activeGateIds, ["gate_arkham"]); assert.deepEqual(after.discardedGateIds, []);
      assert.equal(after.activePlayerId, state.players[1]!.id); assert.equal(after.pendingLocationEncounter, undefined);
      assert.equal(after.privateState.deckOrderById["encounter:other_world"]!.at(-1), cardId);
      assert.equal(after.privateState.deckOrderById["encounter:other_world"]!.length, 24);
      const publicHost = [...room.state.players.values()].find(player => player.id === state.players[0]!.id)!;
      assert.equal(publicHost.conditionIds, option === "accept" ? "" : "condition_paranoia");
      assert.equal(JSON.stringify(room.state).includes("condition_paranoia_0"), false);
    });
  }

  it("binds Other World tests to the original Gate across private restoration and owner-only decisions", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "encounter"; state.ancientOneId = "azathoth"; state.doom = 15;
    state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
    Object.assign(state.players[0]!, { investigatorId: "trish_scarborough", locationId: "arkham", health: 7, sanity: 5, maxHealth: 7, maxSanity: 5, clues: 1, assetIds: [] });
    Object.assign(state.players[1]!, { locationId: "london", clues: 0, assetIds: [] });
    state.activeGateIds = ["gate_arkham"]; state.discardedGateIds = [];
    state.privateState.deckOrderById.gates = baseGameGates.filter(gate => gate.id !== "gate_arkham").map(gate => gate.id);
    const cardId = "encounter_other_world_02";
    state.privateState.deckOrderById["encounter:other_world"] = [cardId, ...baseGameScannedTokenEncounters.filter(card => card.deck === "other_world" && card.id !== cardId).map(card => card.id)];
    state.privateState.tokenPoolById.clues = baseGameClues.filter(clue => clue.id !== "clue_arkham").map(clue => clue.id);
    state.privateState.tokenPoolById.clue_discard = [];
    state.privateState.tokenPoolById[`held_clues:${state.players[0]!.id}`] = ["clue_arkham"];
    state.privateState.tokenPoolById[`held_clues:${state.players[1]!.id}`] = [];
    internal.applyEngineState(state);
    const initialMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_OTHER_WORLD_ENCOUNTER", gateId: "gate_arkham" }); await room.waitForMessage(commandMessageType);
    await initialMessage;
    const initial = internal.toEngineState();
    assert.equal(initial.activeTest?.skill, "will"); assert.deepEqual(initial.activeGateIds, ["gate_arkham"]);
    initial.activeTest!.dice = [6]; initial.activeTest!.successes = 1;
    const restoredMessage = host.waitForMessage(pendingDecisionMessageType);
    internal.applyEngineState(JSON.parse(JSON.stringify(initial))); const restored = await restoredMessage as PendingDecision;
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: restored.id, selectedOptionIds: [] }); await room.waitForMessage(commandMessageType);
    assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
    const followMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: restored.id, selectedOptionIds: [] }); await room.waitForMessage(commandMessageType);
    await followMessage;
    const follow = internal.toEngineState();
    assert.equal(follow.activeTest?.skill, "observation"); assert.deepEqual(follow.activeGateIds, []); assert.deepEqual(follow.discardedGateIds, ["gate_arkham"]);
    assert.equal(follow.pendingLocationEncounter?.gateClosed, true);
    assert.equal(JSON.stringify(room.state).includes("gateClosed"), false);
    assert.equal(JSON.stringify(room.state).includes("encounter_other_world_24"), false);
    follow.activeTest!.dice = follow.activeTest!.dice.map(() => 6); follow.activeTest!.successes = follow.activeTest!.dice.length;
    const followRestoredMessage = host.waitForMessage(pendingDecisionMessageType);
    internal.applyEngineState(JSON.parse(JSON.stringify(follow))); const followRestored = await followRestoredMessage as PendingDecision;
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: followRestored.id, selectedOptionIds: [] }); await room.waitForMessage(commandMessageType);
    const after = internal.toEngineState();
    assert.equal(after.players[0]!.clues, 3); assert.equal(after.activePlayerId, state.players[1]!.id);
    assert.equal(after.pendingLocationEncounter, undefined); assert.equal(after.doom, 15);
    assert.deepEqual(after.discardedGateIds, ["gate_arkham"]);
    assert.equal(after.privateState.deckOrderById["encounter:other_world"]!.at(-1), cardId);
    assert.equal(after.privateState.deckOrderById["encounter:other_world"]!.length, 24);
  });

  it("rejects an unsupported Other World top card without revealing it or changing components", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "encounter"; state.ancientOneId = "azathoth";
    state.activePlayerId = state.players[0]!.id;
    Object.assign(state.players[0]!, { investigatorId: "trish_scarborough", locationId: "arkham", health: 7, sanity: 5, assetIds: [] });
    state.activeGateIds = ["gate_arkham"]; state.discardedGateIds = [];
    state.privateState.deckOrderById.gates = baseGameGates.filter(gate => gate.id !== "gate_arkham").map(gate => gate.id);
    state.privateState.deckOrderById["encounter:other_world"] = baseGameScannedTokenEncounters.filter(card => card.deck === "other_world").map(card => card.id);
    internal.applyEngineState(state);
    const before = internal.toEngineState(); const error = host.waitForMessage(commandErrorMessageType);
    sendCommand(room, host, { type: "RESOLVE_OTHER_WORLD_ENCOUNTER", gateId: "gate_arkham" }); await room.waitForMessage(commandMessageType);
    assert.equal((await error as { code: string }).code, "ENCOUNTER_UNSUPPORTED");
    assert.deepEqual(internal.toEngineState(), before);
    assert.equal(JSON.stringify(room.state).includes("encounter_other_world_01"), false);
  });

  for (const source of ["artifact_cultes_des_goules", "artifact_de_vermis_mysteriis"] as const) {
    it(`restores Asset-modified Lore and authorized payment for ${source}`, async () => {
      const room = await colyseus.createRoom<GameRoom>("game", {});
      const host = await colyseus.connectTo(room, { displayName: "Host" });
      const guest = await colyseus.connectTo(room, { displayName: "Guest" });
      const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
      const state = internal.toEngineState();
      state.phase = "action"; state.ancientOneId = "cthulhu"; state.doom = 12; state.actionsRemaining = 2;
      state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
      Object.assign(state.players[0]!, { investigatorId: "akachi_onyele", locationId: "arkham", health: 5, sanity: 7, clues: 0, assetIds: ["asset_lucky_rabbits_foot", "asset_lucky_cigarette_case", "asset_arcane_manuscripts", "asset_whiskey"], artifactIds: [source] });
      Object.assign(state.players[1]!, { investigatorId: "trish_scarborough", locationId: "arkham", health: 7, sanity: 5, assetIds: ["asset_urban_guide"] });
      state.privateState.deckOrderById.artifacts = baseGameArtifacts.filter(card => card.id !== source).map(card => card.id);
      state.privateState.tokenPoolById.clues = baseGameClues.map(card => card.id);
      state.privateState.tokenPoolById[`held_clues:${state.players[0]!.id}`] = [];
      internal.applyEngineState(state);
      const testMessage = host.waitForMessage(pendingDecisionMessageType);
      sendCommand(room, host, { type: "USE_ARTIFACT_ACTION", artifactId: source }); await room.waitForMessage(commandMessageType);
      await testMessage;
      const rolled = internal.toEngineState();
      assert.equal(rolled.activeTest?.dicePool, 4); // Printed Akachi Lore 3 + local Urban Guide 1, not Spell-only Manuscripts.
      rolled.activeTest!.dice = [4, 1, 1, 1]; rolled.activeTest!.successes = 0;
      // Keep the trusted deterministic checkpoint's offered modifier in sync with its edited die.
      const modifier = "asset-increment:asset_lucky_cigarette_case:0";
      if (!rolled.pendingDecision!.optionIds.includes(modifier)) rolled.pendingDecision!.optionIds.push(modifier);
      rolled.pendingDecision!.optionLabels = { ...rolled.pendingDecision!.optionLabels, [modifier]: "Lucky Cigarette Case: add 1 to die 1 (4 → 5; no Clue)" };
      const refreshed = host.waitForMessage(pendingDecisionMessageType);
      internal.applyEngineState(JSON.parse(JSON.stringify(rolled))); const test = await refreshed as PendingDecision;
      assert.ok(test.optionLabels?.[modifier]?.includes("4 → 5"));
      const denied = guest.waitForMessage(commandErrorMessageType);
      sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: test.id, selectedOptionIds: [modifier] }); await room.waitForMessage(commandMessageType);
      assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
      const footMessage = host.waitForMessage(pendingDecisionMessageType);
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: test.id, selectedOptionIds: [modifier] }); await room.waitForMessage(commandMessageType);
      const footChoice = await footMessage as PendingDecision;
      const checkpoint = internal.toEngineState(); assert.equal(checkpoint.activeTest?.successes, 1);
      assert.deepEqual(checkpoint.usedAssetDieModifierIds, ["asset_lucky_cigarette_case"]);
      assert.equal(JSON.stringify(room.state).includes("asset-reroll:"), false);
      assert.equal(JSON.stringify(room.state).includes("artifact_grotesque_statue"), false);
      const restoreFoot = host.waitForMessage(pendingDecisionMessageType);
      internal.applyEngineState(JSON.parse(JSON.stringify(checkpoint))); await restoreFoot;
      const paymentMessage = host.waitForMessage(pendingDecisionMessageType);
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: footChoice.id, selectedOptionIds: ["asset-reroll:asset_lucky_rabbits_foot:1"] }); await room.waitForMessage(commandMessageType);
      const payment = await paymentMessage as PendingDecision; assert.equal(payment.kind, "artifact_payment");
      const beforePay = internal.toEngineState(); assert.deepEqual(beforePay.usedAssetRerollIds, ["asset_lucky_rabbits_foot"]);
      assert.equal(beforePay.players[0]?.clues, 0); assert.equal(beforePay.players[0]?.sanity, 7); assert.equal(beforePay.actionsRemaining, 2);
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: payment.id, selectedOptionIds: [source === "artifact_cultes_des_goules" ? "cultes:accept" : "vermis:will:1"] }); await room.waitForMessage(commandMessageType);
      const after = internal.toEngineState(); assert.equal(after.players[0]?.sanity, 6); assert.equal(after.actionsRemaining, 1);
      assert.equal(after.stateVersion, beforePay.stateVersion + 1);
      assert.deepEqual(after.players[0]?.assetIds, state.players[0]?.assetIds); assert.deepEqual(after.assetDiscardIds, []);
      if (source === "artifact_cultes_des_goules") assert.equal(after.players[0]?.clues, 2);
      else assert.equal(after.players[0]?.skillImprovements.will, 1);
      assert.deepEqual(after.usedArtifactActionIds, [source]);
    });
  }

  for (const lily of [false, true]) {
    it(`restores De Vermis Mysteriis' private skill payment for ${lily ? "Lily's double improvement" : "an ordinary improvement"}`, async () => {
      const room = await colyseus.createRoom<GameRoom>("game", {});
      const host = await colyseus.connectTo(room, { displayName: "Host" });
      const guest = await colyseus.connectTo(room, { displayName: "Guest" });
      const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
      const state = internal.toEngineState(), source = "artifact_de_vermis_mysteriis";
      state.phase = "action"; state.ancientOneId = "cthulhu"; state.doom = 12; state.actionsRemaining = 2;
      state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
      Object.assign(state.players[0]!, { investigatorId: lily ? "lily_chen" : "akachi_onyele", locationId: "arkham", health: 5, sanity: 6, clues: 1, assetIds: [], artifactIds: [source] });
      state.privateState.deckOrderById.artifacts = baseGameArtifacts.filter(card => card.id !== source).map(card => card.id);
      state.privateState.tokenPoolById.clues = baseGameClues.map(card => card.id);
      state.privateState.tokenPoolById[`held_clues:${state.players[0]!.id}`] = [state.privateState.tokenPoolById.clues.shift()!];
      internal.applyEngineState(state);
      const testMessage = host.waitForMessage(pendingDecisionMessageType);
      sendCommand(room, host, { type: "USE_ARTIFACT_ACTION", artifactId: source }); await room.waitForMessage(commandMessageType);
      const test = await testMessage as PendingDecision;
      const rolled = internal.toEngineState(); assert.equal(rolled.activeTest?.sourceArtifactId, source);
      rolled.activeTest!.dice = rolled.activeTest!.dice.map(() => 6); rolled.activeTest!.successes = rolled.activeTest!.dice.length;
      const refresh = host.waitForMessage(pendingDecisionMessageType);
      internal.applyEngineState(JSON.parse(JSON.stringify(rolled))); await refresh;
      const paymentMessage = host.waitForMessage(pendingDecisionMessageType);
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: test.id, selectedOptionIds: [] }); await room.waitForMessage(commandMessageType);
      const payment = await paymentMessage as PendingDecision;
      assert.equal(payment.kind, "artifact_payment"); assert.equal(payment.optionIds.length, lily ? 11 : 6);
      const selected = lily ? "vermis:will:2" : "vermis:will:1";
      assert.ok(payment.optionLabels?.[selected]?.includes("Spend 1 Sanity"));
      assert.equal(JSON.stringify(room.state).includes("vermis:will"), false);
      assert.equal(JSON.stringify(room.state).includes("artifact_grotesque_statue"), false);
      const checkpoint = internal.toEngineState(), restored = host.waitForMessage(pendingDecisionMessageType);
      internal.applyEngineState(JSON.parse(JSON.stringify(checkpoint))); await restored;
      const denied = guest.waitForMessage(commandErrorMessageType);
      sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: payment.id, selectedOptionIds: [selected] }); await room.waitForMessage(commandMessageType);
      assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: payment.id, selectedOptionIds: [selected] }); await room.waitForMessage(commandMessageType);
      const after = internal.toEngineState();
      assert.equal(after.players[0]?.skillImprovements.will, lily ? 2 : 1);
      assert.equal(after.players[0]?.sanity, 5); assert.equal(after.actionsRemaining, 1);
      assert.equal(after.stateVersion, checkpoint.stateVersion + 1);
      assert.deepEqual(after.players[0]?.artifactIds, [source]); assert.deepEqual(after.usedArtifactActionIds, [source]);
      assert.equal(after.pendingDecision, undefined); assert.equal(after.activeTest, undefined);
      assert.deepEqual(after.privateState, checkpoint.privateState);
    });
  }

  for (const accept of [false, true]) {
    it(`restores Cultes des Goules' owner-only payment and ${accept ? "gains physical Clues" : "declines"}`, async () => {
      const room = await colyseus.createRoom<GameRoom>("game", {});
      const host = await colyseus.connectTo(room, { displayName: "Host" });
      const guest = await colyseus.connectTo(room, { displayName: "Guest" });
      const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
      const state = internal.toEngineState(), source = "artifact_cultes_des_goules";
      state.phase = "action"; state.ancientOneId = "cthulhu"; state.doom = 12; state.actionsRemaining = 2;
      state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
      Object.assign(state.players[0]!, { investigatorId: "akachi_onyele", locationId: "arkham", health: 5, sanity: 7, clues: 1, assetIds: [], artifactIds: [source] });
      state.privateState.deckOrderById.artifacts = baseGameArtifacts.filter(card => card.id !== source).map(card => card.id);
      state.privateState.tokenPoolById.clues = baseGameClues.map(card => card.id);
      state.privateState.tokenPoolById.clue_discard = [];
      state.privateState.tokenPoolById[`held_clues:${state.players[0]!.id}`] = [state.privateState.tokenPoolById.clues.shift()!];
      internal.applyEngineState(state);
      const testMessage = host.waitForMessage(pendingDecisionMessageType);
      sendCommand(room, host, { type: "USE_ARTIFACT_ACTION", artifactId: source }); await room.waitForMessage(commandMessageType);
      const testDecision = await testMessage as PendingDecision;
      const rolled = internal.toEngineState(); assert.equal(rolled.activeTest?.sourceArtifactId, source);
      rolled.activeTest!.dice = rolled.activeTest!.dice.map(() => 6); rolled.activeTest!.successes = rolled.activeTest!.dice.length;
      const refreshedTest = host.waitForMessage(pendingDecisionMessageType);
      internal.applyEngineState(JSON.parse(JSON.stringify(rolled))); await refreshedTest;
      const paymentMessage = host.waitForMessage(pendingDecisionMessageType);
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: testDecision.id, selectedOptionIds: [] }); await room.waitForMessage(commandMessageType);
      const payment = await paymentMessage as PendingDecision;
      assert.equal(payment.kind, "artifact_payment"); assert.deepEqual(payment.optionIds, ["cultes:accept", "cultes:skip"]);
      const checkpoint = internal.toEngineState(); assert.equal(checkpoint.players[0]?.sanity, 7); assert.equal(checkpoint.actionsRemaining, 2);
      assert.equal(JSON.stringify(room.state).includes("cultes:accept"), false);
      assert.equal(JSON.stringify(room.state).includes(baseGameClues[0]!.id), false);
      assert.equal(JSON.stringify(room.state).includes("artifact_grotesque_statue"), false);
      const restored = host.waitForMessage(pendingDecisionMessageType);
      internal.applyEngineState(JSON.parse(JSON.stringify(checkpoint))); await restored;
      const denied = guest.waitForMessage(commandErrorMessageType);
      sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: payment.id, selectedOptionIds: ["cultes:accept"] }); await room.waitForMessage(commandMessageType);
      assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: payment.id, selectedOptionIds: [accept ? "cultes:accept" : "cultes:skip"] }); await room.waitForMessage(commandMessageType);
      const after = internal.toEngineState();
      assert.equal(after.stateVersion, checkpoint.stateVersion + 1); assert.equal(after.actionsRemaining, 1);
      assert.equal(after.players[0]?.sanity, accept ? 6 : 7); assert.equal(after.players[0]?.clues, accept ? 3 : 1);
      assert.equal(after.privateState.tokenPoolById[`held_clues:${state.players[0]!.id}`]?.length, accept ? 3 : 1);
      assert.equal(after.privateState.tokenPoolById.clues?.length, baseGameClues.length - (accept ? 3 : 1));
      assert.deepEqual(after.players[0]?.artifactIds, [source]); assert.deepEqual(after.usedArtifactActionIds, [source]);
      assert.equal(after.pendingDecision, undefined); assert.equal(after.activeTest, undefined);
    });
  }

  for (const pass of [false, true]) {
    it(`restores Puzzle Box's private reroll and ${pass ? "Artifact gain" : "failure"} before the remaining Witch Doctor bonus`, async () => {
      const room = await colyseus.createRoom<GameRoom>("game", {});
      const host = await colyseus.connectTo(room, { displayName: "Host" });
      const guest = await colyseus.connectTo(room, { displayName: "Guest" });
      const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
      const state = internal.toEngineState();
      state.phase = "action"; state.ancientOneId = "cthulhu"; state.doom = 12; state.actionsRemaining = 2;
      state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
      Object.assign(state.players[0]!, { investigatorId: "akachi_onyele", locationId: "arkham", health: 2, maxHealth: 5, sanity: 3, maxSanity: 7, clues: 0, assetIds: ["asset_puzzle_box", "asset_lucky_rabbits_foot"], artifactIds: [] });
      Object.assign(state.players[1]!, { investigatorId: "trish_scarborough", locationId: "arkham", health: 7, sanity: 5, assetIds: ["asset_witch_doctor"], artifactIds: [] });
      state.privateState.deckOrderById.artifacts = ["artifact_ttka_halot", ...baseGameArtifacts.filter(card => card.id !== "artifact_ttka_halot").map(card => card.id)];
      internal.applyEngineState(state);
      const restMessage = host.waitForMessage(pendingDecisionMessageType);
      sendCommand(room, host, { type: "REST" }); await room.waitForMessage(commandMessageType);
      const restDecision = await restMessage as PendingDecision;
      assert.ok(restDecision.optionIds.includes("asset_puzzle_box:attempt"));
      assert.equal(restDecision.optionLabels?.["asset_puzzle_box:attempt"], "Puzzle Box: attempt Observation −2");
      const testMessage = host.waitForMessage(pendingDecisionMessageType);
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: restDecision.id, selectedOptionIds: ["asset_puzzle_box:attempt"] }); await room.waitForMessage(commandMessageType);
      const testDecision = await testMessage as PendingDecision;
      const rolled = internal.toEngineState(); assert.equal(rolled.activeTest?.continuation, "rest_asset"); assert.equal(rolled.activeTest?.modifier, -2);
      assert.equal(rolled.pendingRest?.testingAssetId, "asset_puzzle_box"); assert.equal(rolled.actionsRemaining, 2);
      rolled.activeTest!.dice = rolled.activeTest!.dice.map(() => pass ? 6 : 1); rolled.activeTest!.successes = pass ? rolled.activeTest!.dice.length : 0;
      const restored = host.waitForMessage(pendingDecisionMessageType);
      internal.applyEngineState(JSON.parse(JSON.stringify(rolled))); await restored;
      assert.equal(JSON.stringify(room.state).includes("pendingRest"), false); assert.equal(JSON.stringify(room.state).includes("remainingAssetIds"), false);
      assert.equal(JSON.stringify(room.state).includes("artifact_grotesque_statue"), false);
      const denied = guest.waitForMessage(commandErrorMessageType);
      sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: testDecision.id, selectedOptionIds: [] }); await room.waitForMessage(commandMessageType);
      assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
      const bonusMessage = host.waitForMessage(pendingDecisionMessageType);
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: testDecision.id, selectedOptionIds: [] }); await room.waitForMessage(commandMessageType);
      const bonus = await bonusMessage as PendingDecision;
      assert.deepEqual(bonus.optionIds, ["asset_witch_doctor:health", "asset_witch_doctor:skip"]);
      const middle = internal.toEngineState(); assert.equal(middle.actionsRemaining, 2);
      assert.deepEqual(middle.players[0]?.artifactIds, pass ? ["artifact_ttka_halot"] : []);
      assert.deepEqual(middle.assetDiscardIds, pass ? ["asset_puzzle_box"] : []);
      assert.equal(middle.players[0]?.assetIds.includes("asset_puzzle_box"), !pass);
      assert.deepEqual(middle.privateState.deckOrderById.artifacts, pass ? state.privateState.deckOrderById.artifacts!.slice(1) : state.privateState.deckOrderById.artifacts);
      const refreshed = host.waitForMessage(pendingDecisionMessageType);
      internal.applyEngineState(JSON.parse(JSON.stringify(middle))); await refreshed;
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: bonus.id, selectedOptionIds: ["asset_witch_doctor:health"] }); await room.waitForMessage(commandMessageType);
      const after = internal.toEngineState();
      assert.equal(after.players[0]?.health, 4); assert.equal(after.players[0]?.sanity, 4);
      assert.equal(after.actionsRemaining, 1); assert.deepEqual(after.performedActions, ["rest"]); assert.equal(after.pendingRest, undefined);
      assert.deepEqual(after.players[1]?.assetIds, ["asset_witch_doctor"]);
    });
  }

  for (const effect of ["health", "discard-cursed"] as const) {
    it(`restores the resting owner's Witch Doctor ${effect} choice from a colleague's Ally`, async () => {
      const room = await colyseus.createRoom<GameRoom>("game", {});
      const host = await colyseus.connectTo(room, { displayName: "Host" });
      const guest = await colyseus.connectTo(room, { displayName: "Guest" });
      const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
      const state = internal.toEngineState();
      state.phase = "action"; state.ancientOneId = "cthulhu"; state.doom = 12; state.actionsRemaining = 2;
      state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
      Object.assign(state.players[0]!, { investigatorId: "akachi_onyele", locationId: "arkham", health: 2, maxHealth: 5, sanity: 3, maxSanity: 7, assetIds: [], conditionIds: ["condition_cursed_01"] });
      Object.assign(state.players[1]!, { investigatorId: "trish_scarborough", locationId: "arkham", health: 7, sanity: 5, assetIds: ["asset_witch_doctor"] });
      state.privateState.tokenPoolById["condition:cursed"] = [];
      internal.applyEngineState(state);
      const message = host.waitForMessage(pendingDecisionMessageType);
      sendCommand(room, host, { type: "REST" }); await room.waitForMessage(commandMessageType);
      const decision = await message as PendingDecision;
      assert.equal(decision.kind, "rest_asset_choice"); assert.equal(decision.playerId, state.players[0]!.id);
      assert.equal(decision.optionLabels?.["asset_witch_doctor:discard-cursed"], "Discard Cursed");
      const checkpoint = internal.toEngineState();
      assert.equal(checkpoint.actionsRemaining, 2); assert.equal(checkpoint.players[0]?.health, 3);
      assert.equal(JSON.stringify(room.state).includes("discard-cursed"), false);
      assert.equal(JSON.stringify(room.state).includes("condition_cursed_01"), false);
      const refreshed = host.waitForMessage(pendingDecisionMessageType);
      internal.applyEngineState(JSON.parse(JSON.stringify(checkpoint))); await refreshed;
      const denied = guest.waitForMessage(commandErrorMessageType);
      sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: decision.id, selectedOptionIds: [`asset_witch_doctor:${effect}`] });
      await room.waitForMessage(commandMessageType);
      assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: decision.id, selectedOptionIds: [`asset_witch_doctor:${effect}`] });
      await room.waitForMessage(commandMessageType);
      const after = internal.toEngineState();
      assert.equal(after.players[0]?.health, effect === "health" ? 4 : 3);
      assert.equal(after.players[0]?.sanity, 4);
      assert.deepEqual(after.players[0]?.conditionIds, effect === "discard-cursed" ? [] : ["condition_cursed_01"]);
      assert.deepEqual(after.privateState.tokenPoolById["condition:cursed"], effect === "discard-cursed" ? ["condition_cursed_01"] : []);
      assert.deepEqual(after.players[1]?.assetIds, ["asset_witch_doctor"]);
      assert.equal(after.actionsRemaining, 1); assert.deepEqual(after.performedActions, ["rest"]); assert.equal(after.pendingDecision, undefined);
    });
  }

  it("restores an owner-private Lucky Cigarette Case modifier independently of the Foot", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState(); state.phase = "action"; state.ancientOneId = "cthulhu"; state.doom = 12; state.actionsRemaining = 2;
    state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
    Object.assign(state.players[0]!, { investigatorId: "akachi_onyele", locationId: "arkham", health: 5, sanity: 7, clues: 0,
      assetIds: ["asset_lucky_cigarette_case", "asset_lucky_rabbits_foot", "asset_fine_clothes"] });
    internal.applyEngineState(state);
    const initialMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "ACQUIRE_ASSETS" }); await room.waitForMessage(commandMessageType); await initialMessage;
    const rolled = internal.toEngineState(); rolled.activeTest!.dice = [5, 1]; rolled.activeTest!.successes = 1;
    // Rebuild options from a genuine remaining reroll; the room owns the dice.
    const refresh = host.waitForMessage(pendingDecisionMessageType); internal.applyEngineState(rolled); await refresh;
    const bumpedMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: rolled.pendingDecision!.id, selectedOptionIds: ["asset-reroll:asset_lucky_rabbits_foot:1"] });
    await room.waitForMessage(commandMessageType); const decision = await bumpedMessage as PendingDecision;
    const option = "asset-increment:asset_lucky_cigarette_case:0";
    assert.equal(decision.optionLabels?.[option], "Lucky Cigarette Case: add 1 to die 1 (5 → 6; no Clue)");
    const checkpoint = internal.toEngineState();
    const restored = host.waitForMessage(pendingDecisionMessageType); internal.applyEngineState(JSON.parse(JSON.stringify(checkpoint))); await restored;
    assert.equal(JSON.stringify(room.state).includes("asset-increment:"), false);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: decision.id, selectedOptionIds: [option] }); await room.waitForMessage(commandMessageType);
    assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: decision.id, selectedOptionIds: [option] }); await room.waitForMessage(commandMessageType);
    const after = internal.toEngineState();
    assert.deepEqual(after.usedAssetDieModifierIds, ["asset_lucky_cigarette_case"]);
    assert.deepEqual(after.usedAssetRerollIds, ["asset_lucky_rabbits_foot"]);
    assert.equal(after.players[0]?.clues, 0); assert.deepEqual(after.players[0]?.assetIds, state.players[0]?.assetIds);
    assert.equal(after.pendingDecision?.selectionBudget, checkpoint.activeTest!.successes + 1);
    assert.equal(room.state.usedAssetDieModifierIds, "asset_lucky_cigarette_case");
    internal.applyEngineState(JSON.parse(JSON.stringify(after)));
    assert.deepEqual(internal.toEngineState().usedAssetDieModifierIds, ["asset_lucky_cigarette_case"]);
  });

  for (const resource of ["health", "sanity"] as const) {
    it(`restores a colleague's private ${resource === "health" ? "Bandages" : "Whiskey"} decision before Research damage and defeat`, async () => {
      const assetId = resource === "health" ? "asset_bandages" : "asset_whiskey";
      const locationId = resource === "health" ? "the_amazon" : "arkham";
      const cardId = resource === "health" ? "encounter_research_azathoth_01" : "encounter_research_azathoth_03";
      const room = await colyseus.createRoom<GameRoom>("game", {});
      const host = await colyseus.connectTo(room, { displayName: "Host" });
      const guest = await colyseus.connectTo(room, { displayName: "Guest" });
      const hostErrors: unknown[] = []; host.onMessage(commandErrorMessageType, error => hostErrors.push(error));
      const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
      const state = internal.toEngineState(); state.phase = "encounter"; state.ancientOneId = "azathoth"; state.doom = 15;
      state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
      Object.assign(state.players[0]!, { investigatorId: "akachi_onyele", locationId, health: resource === "health" ? 1 : 5, sanity: resource === "sanity" ? 1 : 7, clues: 1, assetIds: [] });
      Object.assign(state.players[1]!, { investigatorId: "trish_scarborough", locationId, health: 7, sanity: 5, assetIds: [assetId] });
      state.boardClues = [{ id: "research-clue", locationId }];
      state.privateState.tokenPoolById = { "board_clue:research-clue": ["clue_arkham"], [`held_clues:${state.players[0]!.id}`]: ["clue_london"], clues: [], clue_discard: [] };
      state.privateState.deckOrderById["encounter:research_azathoth"] = [cardId, "encounter_research_azathoth_02"];
      internal.applyEngineState(state);
      const testMessage = host.waitForMessage(pendingDecisionMessageType);
      sendCommand(room, host, { type: "RESOLVE_RESEARCH_ENCOUNTER", clueId: "research-clue" }); await room.waitForMessage(commandMessageType);
      assert.deepEqual(hostErrors, []);
      const testDecision = await testMessage as PendingDecision;
      const failed = internal.toEngineState(); failed.activeTest!.dice = failed.activeTest!.dice.map(() => 1); failed.activeTest!.successes = 0;
      const refreshedTest = host.waitForMessage(pendingDecisionMessageType); internal.applyEngineState(failed); await refreshedTest;
      const preventionMessage = guest.waitForMessage(pendingDecisionMessageType);
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: testDecision.id, selectedOptionIds: [] }); await room.waitForMessage(commandMessageType);
      assert.deepEqual(hostErrors, []);
      const decision = await preventionMessage as PendingDecision;
      assert.equal(decision.playerId, state.players[1]?.id); assert.equal(decision.optionLabels?.[assetId], resource === "health" ? "Discard Bandages: prevent 1 Health loss" : "Discard Whiskey: prevent 1 Sanity loss");
      const paused = internal.toEngineState(); assert.equal(paused.players[0]?.[resource], 1); assert.equal(paused.pendingDefeat, undefined);
      assert.equal(paused.pendingLocationEncounter?.playerId, state.players[0]?.id);
      assert.deepEqual(paused.privateState.deckOrderById["encounter:research_azathoth"], state.privateState.deckOrderById["encounter:research_azathoth"]);
      assert.equal(JSON.stringify(room.state).includes("damage_reaction"), false); assert.equal(JSON.stringify(room.state).includes("optionIds"), false);
      const refresh = guest.waitForMessage(pendingDecisionMessageType); internal.applyEngineState(JSON.parse(JSON.stringify(paused))); await refresh;
      const denied = host.waitForMessage(commandErrorMessageType);
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: decision.id, selectedOptionIds: [assetId] }); await room.waitForMessage(commandMessageType);
      assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
      sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: decision.id, selectedOptionIds: [assetId] }); await room.waitForMessage(commandMessageType);
      const after = internal.toEngineState(); assert.equal(after.players[0]?.health, state.players[0]?.health); assert.equal(after.players[0]?.sanity, state.players[0]?.sanity); assert.equal(after.doom, 15);
      assert.deepEqual(after.assetDiscardIds, [assetId]); assert.deepEqual(after.players[1]?.assetIds, []);
      assert.deepEqual(after.boardClues, state.boardClues); assert.equal(after.pendingDefeat, undefined);
      assert.equal(after.pendingLocationEncounter, undefined); assert.equal(after.activePlayerId, state.players[1]?.id);
      assert.deepEqual(after.privateState.deckOrderById["encounter:research_azathoth"], ["encounter_research_azathoth_02", cardId]);
    });
  }

  it("round-trips Hired Muscle's private Strength bonus and consumed reroll", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "encounter"; state.ancientOneId = "cthulhu"; state.doom = 12;
    state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
    state.players[0] = { ...state.players[0]!, investigatorId: "akachi_onyele", locationId: "space_2", health: 5, sanity: 7, clues: 1,
      assetIds: ["asset_hired_muscle", "asset_lucky_rabbits_foot"], skillImprovements: { strength: 1 } };
    state.privateState.tokenPoolById[`held_clues:${state.players[0]!.id}`] = ["clue_london"];
    // General 10 Sea has a Strength test with no pass reward; its failure Delays.
    state.privateState.deckOrderById["encounter:general"] = ["encounter_general_10"];
    internal.applyEngineState(state);
    const offered = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_LOCATION_ENCOUNTER", deck: "general" }); await room.waitForMessage(commandMessageType);
    const decision = await offered as PendingDecision;
    assert.equal(internal.toEngineState().activeTest?.skill, "strength");
    assert.equal(internal.toEngineState().activeTest?.dicePool, 4);
    assert.equal(decision.optionLabels?.["asset-reroll:asset_hired_muscle:0"], "Hired Muscle: reroll die 1 (no Clue)");
    const rejected = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: decision.id, selectedOptionIds: ["asset-reroll:asset_hired_muscle:0"] });
    await room.waitForMessage(commandMessageType); assert.equal((await rejected as { code: string }).code, "NOT_DECISION_OWNER");
    const nextMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: decision.id, selectedOptionIds: ["asset-reroll:asset_hired_muscle:0"] }); await room.waitForMessage(commandMessageType);
    const remaining = await nextMessage as PendingDecision;
    assert.ok(!remaining.optionIds.some(id => id.startsWith("asset-reroll:asset_hired_muscle:")));
    assert.ok(remaining.optionIds.includes("asset-reroll:asset_lucky_rabbits_foot:0"));
    const checkpoint = internal.toEngineState();
    assert.equal(checkpoint.players[0]?.clues, 1); assert.deepEqual(checkpoint.usedAssetRerollIds, []);
    assert.deepEqual(checkpoint.activeTest?.usedRerollAssetIds, ["asset_hired_muscle"]);
    assert.equal(JSON.stringify(room.state).includes("usedRerollAssetIds"), false);
    const refresh = host.waitForMessage(pendingDecisionMessageType);
    internal.applyEngineState(JSON.parse(JSON.stringify(checkpoint))); await refresh;
    assert.deepEqual(internal.toEngineState().activeTest?.usedRerollAssetIds, ["asset_hired_muscle"]);
    const illegal = host.waitForMessage(commandErrorMessageType);
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: remaining.id, selectedOptionIds: ["asset-reroll:asset_hired_muscle:1"] }); await room.waitForMessage(commandMessageType);
    assert.equal((await illegal as { code: string }).code, "INVALID_DECISION_SELECTION");
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: remaining.id, selectedOptionIds: [] }); await room.waitForMessage(commandMessageType);
    assert.equal(internal.toEngineState().pendingDecision, undefined); assert.equal(internal.toEngineState().activePlayerId, checkpoint.players[1]?.id);
  });

  it("round-trips the Foot's round limit independently of Personal Assistant and resets at the next round", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "action"; state.ancientOneId = "cthulhu"; state.actionsRemaining = 2;
    state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
    state.players[0] = { ...state.players[0]!, investigatorId: "akachi_onyele", locationId: "arkham", health: 5, sanity: 7, clues: 1, assetIds: ["asset_personal_assistant", "asset_lucky_rabbits_foot"] };
    state.privateState.tokenPoolById[`held_clues:${state.players[0]!.id}`] = ["clue_london"];
    internal.applyEngineState(state);
    const offered = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "ACQUIRE_ASSETS" }); await room.waitForMessage(commandMessageType);
    const decision = await offered as PendingDecision;
    assert.equal(decision.optionLabels?.["asset-reroll:asset_lucky_rabbits_foot:0"], "Lucky Rabbit's Foot: reroll die 1 (no Clue)");
    assert.equal(decision.optionLabels?.["asset-reroll:asset_personal_assistant:0"], "Personal Assistant: reroll die 1 (no Clue)");
    const rejected = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: decision.id, selectedOptionIds: ["asset-reroll:asset_lucky_rabbits_foot:0"] });
    await room.waitForMessage(commandMessageType); assert.equal((await rejected as { code: string }).code, "NOT_DECISION_OWNER");
    const nextMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: decision.id, selectedOptionIds: ["asset-reroll:asset_lucky_rabbits_foot:0"] }); await room.waitForMessage(commandMessageType);
    const remaining = await nextMessage as PendingDecision;
    assert.ok(!remaining.optionIds.some(id => id.startsWith("asset-reroll:asset_lucky_rabbits_foot:")));
    assert.ok(remaining.optionIds.includes("asset-reroll:asset_personal_assistant:0"));
    assert.equal(room.state.usedAssetRerollIds, "asset_lucky_rabbits_foot");
    const checkpoint = internal.toEngineState(); assert.equal(checkpoint.players[0]?.clues, 1);
    const refresh = host.waitForMessage(pendingDecisionMessageType);
    internal.applyEngineState(JSON.parse(JSON.stringify(checkpoint))); await refresh;
    assert.deepEqual(internal.toEngineState().usedAssetRerollIds, ["asset_lucky_rabbits_foot"]);
    const illegal = host.waitForMessage(commandErrorMessageType);
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: remaining.id, selectedOptionIds: ["asset-reroll:asset_lucky_rabbits_foot:1"] }); await room.waitForMessage(commandMessageType);
    assert.equal((await illegal as { code: string }).code, "INVALID_DECISION_SELECTION");
    // Isolate the next-round transition after the private test has ended.
    const ready = internal.toEngineState(); ready.activeTest = undefined; ready.pendingDecision = undefined;
    ready.phase = "mythos"; ready.replacementWindow = true; ready.currentMythosCardId = undefined;
    internal.applyEngineState(ready);
    sendCommand(room, host, { type: "BEGIN_NEXT_ROUND" }); await room.waitForMessage(commandMessageType);
    assert.deepEqual(internal.toEngineState().usedAssetRerollIds, []); assert.equal(room.state.usedAssetRerollIds, "");
    const freshMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "ACQUIRE_ASSETS" }); await room.waitForMessage(commandMessageType);
    assert.ok((await freshMessage as PendingDecision).optionIds.includes("asset-reroll:asset_lucky_rabbits_foot:0"));
  });

  it("restores successive Research Item discards before moving the exact Clue", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "encounter"; state.ancientOneId = "cthulhu"; state.doom = 12;
    state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
    state.players[0] = { ...state.players[0]!, investigatorId: "akachi_onyele", locationId: "the_amazon", health: 5, sanity: 7, clues: 1, assetIds: ["asset_45_automatic", "asset_38_revolver", "asset_personal_assistant"] };
    state.boardClues = [{ id: "discard-clue", locationId: "the_amazon" }];
    state.privateState.tokenPoolById = { "board_clue:discard-clue": ["clue_arkham"], [`held_clues:${state.players[0]!.id}`]: ["clue_london"], clues: [], clue_discard: [] };
    state.privateState.deckOrderById.assets = ["asset_holy_cross"];
    state.privateState.deckOrderById["encounter:research_cthulhu"] = ["encounter_research_cthulhu_06", "encounter_research_cthulhu_02"];
    internal.applyEngineState(state);
    const rolledMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_RESEARCH_ENCOUNTER", clueId: "discard-clue" }); await room.waitForMessage(commandMessageType);
    const rolled = await rolledMessage as PendingDecision;
    const paused = internal.toEngineState(); paused.activeTest!.dice = paused.activeTest!.dice.map(() => 1); paused.activeTest!.successes = 0;
    const refresh = host.waitForMessage(pendingDecisionMessageType);
    internal.applyEngineState(paused); await refresh;
    const firstMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: rolled.id, selectedOptionIds: [] }); await room.waitForMessage(commandMessageType);
    const first = await firstMessage as PendingDecision;
    assert.deepEqual(first.optionIds, ["asset_45_automatic", "asset_38_revolver"]);
    const secondMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: first.id, selectedOptionIds: ["asset_45_automatic"] }); await room.waitForMessage(commandMessageType);
    const second = await secondMessage as PendingDecision;
    assert.deepEqual(second.optionIds, ["asset_38_revolver"]);
    const checkpoint = internal.toEngineState();
    assert.deepEqual(checkpoint.boardClues, state.boardClues); assert.deepEqual(checkpoint.assetDiscardIds, ["asset_45_automatic"]);
    const restoredMessage = host.waitForMessage(pendingDecisionMessageType);
    internal.applyEngineState(JSON.parse(JSON.stringify(checkpoint))); await restoredMessage;
    assert.equal(JSON.stringify(room.state).includes("pendingLocationEncounter"), false);
    assert.equal(JSON.stringify(room.state).includes("deckOrderById"), false);
    const rejected = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: second.id, selectedOptionIds: ["asset_38_revolver"] }); await room.waitForMessage(commandMessageType);
    assert.equal((await rejected as { code: string }).code, "NOT_DECISION_OWNER");
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: second.id, selectedOptionIds: ["asset_38_revolver"] }); await room.waitForMessage(commandMessageType);
    // If the actual map has a nearest-Sea tie, resolve the separately authorized destination choice.
    const destination = internal.toEngineState().pendingDecision;
    if (destination) {
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: destination.id, selectedOptionIds: [destination.optionIds[0]!] }); await room.waitForMessage(commandMessageType);
    }
    const after = internal.toEngineState();
    assert.deepEqual(after.players[0]?.assetIds, ["asset_personal_assistant"]);
    assert.deepEqual(after.assetDiscardIds, ["asset_45_automatic", "asset_38_revolver"]);
    assert.equal(after.boardClues?.[0]?.id, "discard-clue"); assert.notEqual(after.boardClues?.[0]?.locationId, "the_amazon");
    assert.deepEqual(after.privateState.tokenPoolById, state.privateState.tokenPoolById);
    assert.deepEqual(after.privateState.deckOrderById.assets, state.privateState.deckOrderById.assets);
    assert.deepEqual(after.privateState.deckOrderById["encounter:research_cthulhu"], ["encounter_research_cthulhu_02", "encounter_research_cthulhu_06"]);
    assert.equal(after.pendingLocationEncounter, undefined); assert.equal(after.activePlayerId, after.players[1]?.id);
  });

  it("preserves Personal Assistant's consumed free reroll across room state restoration", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "action"; state.ancientOneId = "cthulhu"; state.actionsRemaining = 2;
    state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
    state.players[0] = { ...state.players[0]!, investigatorId: "akachi_onyele", locationId: "arkham", health: 5, sanity: 7, clues: 1, assetIds: ["asset_personal_assistant"] };
    state.privateState.tokenPoolById[`held_clues:${state.players[0]!.id}`] = ["clue_london"];
    internal.applyEngineState(state);
    const offered = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "ACQUIRE_ASSETS" }); await room.waitForMessage(commandMessageType);
    const decision = await offered as PendingDecision;
    assert.equal(internal.toEngineState().activeTest?.dicePool, 3);
    assert.ok(decision.optionIds.includes("asset-reroll:asset_personal_assistant:0"));
    const rejected = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: decision.id, selectedOptionIds: ["asset-reroll:asset_personal_assistant:0"] });
    await room.waitForMessage(commandMessageType); assert.equal((await rejected as { code: string }).code, "NOT_DECISION_OWNER");
    const nextMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: decision.id, selectedOptionIds: ["asset-reroll:asset_personal_assistant:0"] });
    await room.waitForMessage(commandMessageType); const clueDecision = await nextMessage as PendingDecision;
    const paused = internal.toEngineState();
    assert.equal(paused.players[0]?.clues, 1); assert.deepEqual(paused.activeTest?.usedRerollAssetIds, ["asset_personal_assistant"]);
    assert.ok(clueDecision.optionIds.every(id => id.startsWith("die-")));
    const restored = host.waitForMessage(pendingDecisionMessageType);
    internal.applyEngineState(JSON.parse(JSON.stringify(paused))); await restored;
    assert.deepEqual(internal.toEngineState().activeTest?.usedRerollAssetIds, ["asset_personal_assistant"]);
    const invalid = host.waitForMessage(commandErrorMessageType);
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: clueDecision.id, selectedOptionIds: ["asset-reroll:asset_personal_assistant:1"] });
    await room.waitForMessage(commandMessageType); assert.equal((await invalid as { code: string }).code, "INVALID_DECISION_SELECTION");
    const acquisition = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: clueDecision.id, selectedOptionIds: [] });
    await room.waitForMessage(commandMessageType); assert.equal((await acquisition as PendingDecision).kind, "select_acquired_cards");
    assert.equal(internal.toEngineState().activeTest, undefined);
  });

  it("applies a colleague's Urban Guide aura to a carried-Asset Research test and restores the bonus die", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "encounter"; state.ancientOneId = "cthulhu"; state.doom = 12;
    state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
    state.players[0] = { ...state.players[0]!, investigatorId: "akachi_onyele", locationId: "arkham", health: 5, sanity: 7, clues: 1, assetIds: ["asset_45_automatic"] };
    state.players[1] = { ...state.players[1]!, investigatorId: "trish_scarborough", locationId: "arkham", health: 7, sanity: 5, assetIds: ["asset_urban_guide"] };
    state.boardClues = [{ id: "aura-clue", locationId: "arkham" }];
    state.privateState.tokenPoolById = { "board_clue:aura-clue": ["clue_arkham"], [`held_clues:${state.players[0]!.id}`]: ["clue_london"], clues: [], clue_discard: [] };
    state.privateState.deckOrderById["encounter:research_cthulhu"] = ["encounter_research_cthulhu_01", "encounter_research_cthulhu_02"];
    internal.applyEngineState(state);
    const decisionMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_RESEARCH_ENCOUNTER", clueId: "aura-clue" });
    await room.waitForMessage(commandMessageType);
    const decision = await decisionMessage as PendingDecision;
    const paused = internal.toEngineState();
    assert.equal(paused.activeTest?.dicePool, 3);
    assert.deepEqual(decision.optionIds, ["die-0", "die-1", "die-2"]);
    paused.activeTest!.dice = [6, 1, 1]; paused.activeTest!.successes = 1;
    const refreshed = host.waitForMessage(pendingDecisionMessageType);
    internal.applyEngineState(JSON.parse(JSON.stringify(paused))); await refreshed;
    assert.equal(JSON.stringify(room.state).includes("pendingLocationEncounter"), false);
    const rejected = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: decision.id, selectedOptionIds: [] });
    await room.waitForMessage(commandMessageType);
    assert.equal((await rejected as { code: string }).code, "NOT_DECISION_OWNER");
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: decision.id, selectedOptionIds: [] });
    await room.waitForMessage(commandMessageType);
    const after = internal.toEngineState();
    assert.equal(after.players[0]?.clues, 2); assert.equal(after.boardClues?.length, 0);
    assert.deepEqual(after.players[0]?.assetIds, ["asset_45_automatic"]);
    assert.deepEqual(after.players[1]?.assetIds, ["asset_urban_guide"]);
    assert.equal(after.pendingLocationEncounter, undefined); assert.equal(after.activePlayerId, after.players[1]?.id);
  });

  it("restores Star Spawn Research failure and its private ambush checkpoint", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "encounter"; state.ancientOneId = "cthulhu"; state.doom = 12;
    state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
    state.players[0] = { ...state.players[0]!, investigatorId: "akachi_onyele", locationId: "space_2", health: 5, sanity: 7, clues: 1, assetIds: [] };
    state.monsters = [{ id: "remote-star", monsterId: "monster_star_spawn", locationId: "arkham", damage: 4, setAside: true }];
    state.boardClues = [{ id: "star-clue", locationId: "space_2" }];
    state.privateState.tokenPoolById = { "board_clue:star-clue": ["clue_arkham"], [`held_clues:${state.players[0]!.id}`]: ["clue_london"], monsters: ["monster_ghoul"], "set_aside:monster_star_spawn": [] };
    state.privateState.deckOrderById["encounter:research_cthulhu"] = ["encounter_research_cthulhu_05", "encounter_research_cthulhu_01"];
    internal.applyEngineState(state);
    const researchMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_RESEARCH_ENCOUNTER", clueId: "star-clue" });
    await room.waitForMessage(commandMessageType);
    let decision = await researchMessage as PendingDecision;
    for (const skill of ["observation", "will", "strength"] as const) {
      const paused = internal.toEngineState();
      assert.equal(paused.activeTest?.skill, skill);
      if (skill === "strength") assert.equal(paused.activeTest?.dice.length, 1);
      paused.activeTest!.dice = paused.activeTest!.dice.map(() => 1); paused.activeTest!.successes = 0;
      const refresh = host.waitForMessage(pendingDecisionMessageType);
      internal.applyEngineState(JSON.parse(JSON.stringify(paused))); await refresh;
      assert.equal(JSON.stringify(room.state).includes("ambush_result"), false);
      const rejected = guest.waitForMessage(commandErrorMessageType);
      sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: decision.id, selectedOptionIds: [] });
      await room.waitForMessage(commandMessageType);
      assert.equal((await rejected as { code: string }).code, "NOT_DECISION_OWNER");
      const nextMessage = skill !== "strength" ? host.waitForMessage(pendingDecisionMessageType) : undefined;
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: decision.id, selectedOptionIds: [] });
      await room.waitForMessage(commandMessageType);
      if (nextMessage) decision = await nextMessage as PendingDecision;
    }
    const after = internal.toEngineState();
    assert.equal(after.players[0]?.health, 2); assert.equal(after.players[0]?.sanity, 4);
    assert.equal(after.players[0]?.clues, 1); assert.equal(after.doom, 12);
    assert.deepEqual(after.boardClues, state.boardClues); assert.deepEqual(after.monsters, state.monsters);
    assert.deepEqual(after.privateState.tokenPoolById, state.privateState.tokenPoolById);
    assert.equal(after.pendingLocationEncounter, undefined); assert.equal(after.activePlayerId, after.players[1]?.id);
  });

  it("restores private Deep One ambush tests without touching physical Monsters", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "encounter"; state.ancientOneId = "cthulhu"; state.doom = 12;
    state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
    state.players[0] = { ...state.players[0]!, investigatorId: "akachi_onyele", locationId: "space_2", health: 5, sanity: 7, clues: 1, assetIds: [], skillImprovements: { strength: 1 } };
    state.monsters = [{ id: "remote", monsterId: "monster_deep_one", locationId: "arkham", damage: 1, setAside: true }];
    state.boardClues = [{ id: "ambush-clue", locationId: "space_2" }];
    state.privateState.tokenPoolById = { "board_clue:ambush-clue": ["clue_arkham"], [`held_clues:${state.players[0]!.id}`]: ["clue_london"], clues: ["clue_rome"], monsters: ["monster_deep_one"], "set_aside:monster_deep_one": ["monster_deep_one"] };
    state.privateState.deckOrderById["encounter:research_cthulhu"] = ["encounter_research_cthulhu_07", "encounter_research_cthulhu_01"];
    internal.applyEngineState(state);
    const horrorMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_RESEARCH_ENCOUNTER", clueId: "ambush-clue" });
    await room.waitForMessage(commandMessageType);
    const horror = await horrorMessage as PendingDecision;
    assert.equal(internal.toEngineState().activeTest?.skill, "will");
    const paused = internal.toEngineState();
    paused.activeTest!.dice = paused.activeTest!.dice.map(() => 6); paused.activeTest!.successes = paused.activeTest!.dice.length;
    const refresh = host.waitForMessage(pendingDecisionMessageType);
    internal.applyEngineState(JSON.parse(JSON.stringify(paused))); await refresh;
    const strengthMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: horror.id, selectedOptionIds: [] });
    await room.waitForMessage(commandMessageType);
    const strength = await strengthMessage as PendingDecision;
    const pausedStrength = internal.toEngineState();
    assert.equal(pausedStrength.activeTest?.skill, "strength");
    assert.equal(pausedStrength.activeTest?.dice.length, 2);
    pausedStrength.activeTest!.dice = [6, 6]; pausedStrength.activeTest!.successes = 2;
    const refreshStrength = host.waitForMessage(pendingDecisionMessageType);
    internal.applyEngineState(JSON.parse(JSON.stringify(pausedStrength))); await refreshStrength;
    assert.equal(JSON.stringify(room.state).includes("ambush_result"), false);
    const rejected = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: strength.id, selectedOptionIds: [] });
    await room.waitForMessage(commandMessageType);
    assert.equal((await rejected as { code: string }).code, "NOT_DECISION_OWNER");
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: strength.id, selectedOptionIds: [] });
    await room.waitForMessage(commandMessageType);
    const after = internal.toEngineState();
    assert.equal(after.players[0]?.clues, 3); assert.equal(after.players[0]?.sanity, 7);
    assert.deepEqual(after.monsters, state.monsters);
    assert.deepEqual(after.privateState.tokenPoolById.monsters, ["monster_deep_one"]);
    assert.deepEqual(after.privateState.tokenPoolById["set_aside:monster_deep_one"], ["monster_deep_one"]);
    assert.equal(after.pendingLocationEncounter, undefined); assert.equal(after.activePlayerId, after.players[1]?.id);
  });

  it("resolves Cthulhu Research with private serialized rerolls and exact Clue relocation", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "encounter"; state.ancientOneId = "cthulhu"; state.doom = 12;
    state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
    state.players[0] = { ...state.players[0]!, investigatorId: "akachi_onyele", locationId: "arkham", health: 5, sanity: 7, clues: 1, assetIds: [] };
    state.boardClues = [{ id: "cthulhu-clue", locationId: "arkham" }];
    state.privateState.tokenPoolById["board_clue:cthulhu-clue"] = ["clue_arkham"];
    state.privateState.tokenPoolById[`held_clues:${state.players[0]!.id}`] = ["clue_london"];
    state.privateState.deckOrderById["encounter:research_cthulhu"] = ["encounter_research_cthulhu_01", "encounter_research_cthulhu_02"];
    internal.applyEngineState(state);
    const rerollMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_RESEARCH_ENCOUNTER", clueId: "cthulhu-clue" });
    await room.waitForMessage(commandMessageType);
    const reroll = await rerollMessage as PendingDecision;
    const paused = internal.toEngineState();
    paused.activeTest!.dice = paused.activeTest!.dice.map(() => 1); paused.activeTest!.successes = 0;
    const refreshed = host.waitForMessage(pendingDecisionMessageType);
    internal.applyEngineState(JSON.parse(JSON.stringify(paused))); await refreshed;
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: reroll.id, selectedOptionIds: [] });
    await room.waitForMessage(commandMessageType);
    const after = internal.toEngineState();
    assert.equal(after.boardClues?.[0]?.locationId, "space_8");
    assert.deepEqual(after.privateState.tokenPoolById["board_clue:cthulhu-clue"], ["clue_arkham"]);
    assert.deepEqual(after.privateState.deckOrderById["encounter:research_cthulhu"], ["encounter_research_cthulhu_02", "encounter_research_cthulhu_01"]);
    assert.equal(after.activePlayerId, after.players[1]?.id);
    assert.equal(after.players[0]?.clues, 1);
    assert.equal(JSON.stringify(room.state).includes("encounter_research_cthulhu_02"), false);
  });

  it("resolves the private Sea Research Dark Pact exchange through authenticated intent", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "encounter"; state.ancientOneId = "azathoth"; state.doom = 15;
    state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
    state.players[0] = { ...state.players[0]!, investigatorId: "akachi_onyele", locationId: "space_2", health: 5, sanity: 7, assetIds: [], clues: 0 };
    state.boardClues = [{ id: "sea-research", locationId: "space_2" }];
    state.privateState.tokenPoolById["board_clue:sea-research"] = ["clue_arkham"];
    state.privateState.tokenPoolById[`held_clues:${state.players[0]!.id}`] = [];
    state.privateState.tokenPoolById["condition:dark_pact"] = ["condition_dark_pact_01"];
    state.privateState.deckOrderById.artifacts = baseGameArtifacts.map(card => card.id);
    state.privateState.deckOrderById["encounter:research_azathoth"] = ["encounter_research_azathoth_05", "encounter_research_azathoth_01"];
    internal.applyEngineState(state);
    const offerMessage = host.waitForMessage(pendingDecisionMessageType);
    let exchangeError: unknown;
    host.onMessage(commandErrorMessageType, message => { exchangeError = message; });
    sendCommand(room, host, { type: "RESOLVE_RESEARCH_ENCOUNTER", clueId: "sea-research" });
    await room.waitForMessage(commandMessageType);
    assert.equal(exchangeError, undefined, JSON.stringify(exchangeError));
    assert.equal(room.state.pendingDecision?.kind, "encounter_choice");
    const offer = await offerMessage as PendingDecision;
    assert.deepEqual(offer.optionIds, ["accept", "skip"]);
    assert.ok(offer.optionLabels?.accept.includes("T'tka Halot"));
    assert.equal("optionIds" in room.state.pendingDecision!, false);
    const refresh = host.waitForMessage(pendingDecisionMessageType);
    internal.applyEngineState(JSON.parse(JSON.stringify(internal.toEngineState())));
    await refresh;
    const rejected = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: offer.id, selectedOptionIds: ["accept"] });
    await room.waitForMessage(commandMessageType);
    assert.equal((await rejected as { code: string }).code, "NOT_DECISION_OWNER");
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: offer.id, selectedOptionIds: ["accept"] });
    await room.waitForMessage(commandMessageType);
    const after = internal.toEngineState();
    assert.deepEqual(after.players[0]?.artifactIds, ["artifact_ttka_halot"]);
    assert.equal(after.players[0]?.clues, 1);
    assert.equal(after.players[0]?.conditionIds?.length, 1);
    assert.equal(after.privateState.deckOrderById.artifacts?.length, 13);
    assert.equal(after.activePlayerId, after.players[1]?.id);
  });

  it("keeps the Artifact target choice private and preserves its round usage", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "action"; state.actionsRemaining = 2;
    state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
    state.players[0] = { ...state.players[0]!, investigatorId: "akachi_onyele", locationId: "arkham", health: 5, sanity: 7, clues: 1, artifactIds: ["artifact_ttka_halot"], assetIds: [] };
    state.monsters = [{ id: "artifact-target", monsterId: "monster_elder_thing", locationId: "arkham", damage: 0 }];
    internal.applyEngineState(state);
    const rerollMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "USE_ARTIFACT_ACTION", artifactId: "artifact_ttka_halot" });
    await room.waitForMessage(commandMessageType);
    const reroll = await rerollMessage as PendingDecision;
    const paused = internal.toEngineState();
    assert.equal(paused.activeTest?.sourceArtifactId, "artifact_ttka_halot");
    paused.activeTest!.dice = paused.activeTest!.dice.map(() => 6); paused.activeTest!.successes = paused.activeTest!.dice.length;
    const refresh = host.waitForMessage(pendingDecisionMessageType);
    internal.applyEngineState(JSON.parse(JSON.stringify(paused)));
    await refresh;
    const targetMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: reroll.id, selectedOptionIds: [] });
    await room.waitForMessage(commandMessageType);
    const decision = await targetMessage as PendingDecision;
    assert.equal(decision.kind, "artifact_target");
    assert.ok(decision.optionIds.includes("artifact-target"));
    assert.equal("optionIds" in room.state.pendingDecision!, false);
    const rejected = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: decision.id, selectedOptionIds: ["artifact-target"] });
    await room.waitForMessage(commandMessageType);
    assert.equal((await rejected as { code: string }).code, "NOT_DECISION_OWNER");
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: decision.id, selectedOptionIds: ["artifact-target"] });
    await room.waitForMessage(commandMessageType);
    const after = internal.toEngineState();
    assert.equal(after.players[0]?.sanity, 6); assert.equal(after.actionsRemaining, 1);
    assert.deepEqual(after.usedArtifactActionIds, ["artifact_ttka_halot"]);
    assert.equal(after.monsters?.length, 0);
    assert.ok(after.privateState.tokenPoolById.monsters?.includes("monster_elder_thing"));
  });

  it("keeps Artifact supply private and round-trips public physical holdings", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "encounter";
    state.privateState.deckOrderById.artifacts = baseGameArtifacts.map(card => card.id);
    const content: GameContent = { artifacts: baseGameArtifacts, map: { adjacentLocationIds: {}, routes: [], locationTypes: {} }, investigators: {}, assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {} };
    const granted = gainNamedArtifact(state, state.players[0]!.id, "artifact_ttka_halot", content);
    assert.equal(granted.ok, true);
    if (!granted.ok) return;
    internal.applyEngineState(granted.state);
    assert.equal([...room.state.players.values()][0]?.artifactIds, "artifact_ttka_halot");
    assert.deepEqual(internal.toEngineState().players[0]?.artifactIds, ["artifact_ttka_halot"]);
    assert.equal(JSON.stringify(room.state).includes("artifact_grotesque_statue"), false);
    assert.equal(internal.toEngineState().privateState.deckOrderById.artifacts?.length, 13);
    const rejected = host.waitForMessage(commandErrorMessageType);
    host.send(commandMessageType, { expectedStateVersion: room.state.stateVersion, command: { type: "GAIN_ARTIFACT", artifactId: "artifact_ttka_halot" } });
    assert.equal((await rejected as { code: string }).code, "INVALID_COMMAND");
  });

  it("returns a solved Mystery from Research without exposing the reshuffled deck", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "encounter"; state.ancientOneId = "azathoth"; state.doom = 15; state.omen = 0;
    state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
    state.players[0] = { ...state.players[0]!, investigatorId: "akachi_onyele", locationId: "arkham", health: 5, sanity: 7, maxHealth: 5, maxSanity: 7, clues: 1, assetIds: [] };
    state.completedMysteryIds = ["azathoth_occult_research", "azathoth_omen_of_devastation"];
    state.activeMysteryId = "azathoth_seed_of_the_daemon_sultan";
    state.mysteryProgress = 1; state.mysteryTarget = 2;
    state.boardClues = [{ id: "mystery-research", locationId: "arkham" }];
    state.privateState.tokenPoolById = { clues: ["clue_rome"], clue_discard: [], "board_clue:mystery-research": ["clue_arkham"], [`held_clues:${state.players[0]!.id}`]: ["clue_london"] };
    state.privateState.deckOrderById.mysteries = ["azathoth_the_true_name"];
    state.privateState.deckOrderById["encounter:research_azathoth"] = ["encounter_research_azathoth_05", "encounter_research_azathoth_01"];
    internal.applyEngineState(state);
    const rerollMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_RESEARCH_ENCOUNTER", clueId: "mystery-research" });
    await room.waitForMessage(commandMessageType);
    const reroll = await rerollMessage as PendingDecision;
    const paused = internal.toEngineState();
    paused.activeTest!.dice = paused.activeTest!.dice.map(() => 1); paused.activeTest!.successes = 0;
    const refreshedMessage = host.waitForMessage(pendingDecisionMessageType);
    internal.applyEngineState(paused);
    await refreshedMessage;
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: reroll.id, selectedOptionIds: [] });
    await room.waitForMessage(commandMessageType);
    const resolved = internal.toEngineState();
    assert.equal(resolved.completedMysteryIds.length, 1);
    const returned = state.completedMysteryIds.find(id => !resolved.completedMysteryIds.includes(id))!;
    assert.deepEqual(new Set(resolved.privateState.deckOrderById.mysteries), new Set(["azathoth_the_true_name", returned]));
    assert.equal(resolved.activeMysteryId, state.activeMysteryId);
    assert.equal(resolved.mysteryProgress, 1); assert.equal(resolved.mysteryTarget, 2);
    assert.equal(resolved.boardClues?.length, 1);
    assert.equal(JSON.stringify(room.state).includes("azathoth_the_true_name"), false);
    assert.equal(resolved.activePlayerId, state.players[1]!.id);
  });

  it("keeps Research Omen destinations owner-only and restores their continuation", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "encounter"; state.ancientOneId = "azathoth"; state.doom = 1; state.omen = 3; state.greenOmenTokens = 4;
    state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
    state.players[0] = { ...state.players[0]!, investigatorId: "akachi_onyele", locationId: "space_2", health: 5, sanity: 7, maxHealth: 5, maxSanity: 7, clues: 0, assetIds: [] };
    state.players[1] = { ...state.players[1]!, locationId: "london", clues: 0 };
    state.boardClues = [{ id: "omen-research", locationId: "space_2" }];
    state.privateState.tokenPoolById = { clues: [], clue_discard: [], "board_clue:omen-research": ["clue_arkham"], [`held_clues:${state.players[0]!.id}`]: [], [`held_clues:${state.players[1]!.id}`]: [] };
    state.privateState.deckOrderById["encounter:research_azathoth"] = ["encounter_research_azathoth_08", "encounter_research_azathoth_01"];
    internal.applyEngineState(state);
    const rerollMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_RESEARCH_ENCOUNTER", clueId: "omen-research" });
    await room.waitForMessage(commandMessageType);
    const reroll = await rerollMessage as PendingDecision;
    // Fix the pending test result for this transport test; dice rules are separately deterministic engine tests.
    const paused = internal.toEngineState();
    paused.activeTest!.dice = paused.activeTest!.dice.map(() => 6);
    paused.activeTest!.successes = paused.activeTest!.dice.length;
    const refreshedTestMessage = host.waitForMessage(pendingDecisionMessageType);
    internal.applyEngineState(paused);
    await refreshedTestMessage;
    const choiceMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: reroll.id, selectedOptionIds: [] });
    await room.waitForMessage(commandMessageType);
    const choice = await choiceMessage as PendingDecision;
    assert.deepEqual(choice.optionIds, ["omen-0", "omen-1", "omen-2", "omen-3"]);
    assert.equal(JSON.stringify(room.state).includes("omen-0"), false);
    const continuation = internal.toEngineState();
    internal.applyEngineState(JSON.parse(JSON.stringify(continuation)) as GameState);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: ["omen-0"] });
    assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: ["omen-0"] });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.omen, 0); assert.equal(room.state.doom, 1); assert.equal(room.state.greenOmenTokens, 4);
    assert.equal(internal.toEngineState().gameResult, undefined);
    assert.equal(internal.toEngineState().activePlayerId, state.players[1]!.id);
  });

  it("resolves Research through an authenticated marker intent and private reconnect-safe continuation", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "encounter";
    state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.doom = 15;
    state.players[0] = { ...state.players[0]!, investigatorId: "akachi_onyele", locationId: "space_2", health: 5, sanity: 7, maxHealth: 5, maxSanity: 7, clues: 0, assetIds: [] };
    state.players[1] = { ...state.players[1]!, locationId: "london", clues: 0 };
    state.boardClues = [{ id: "research-marker", locationId: "space_2" }];
    state.privateState.tokenPoolById = { clues: [], clue_discard: [], "board_clue:research-marker": ["clue_arkham"], [`held_clues:${state.players[0]!.id}`]: [], [`held_clues:${state.players[1]!.id}`]: [] };
    state.privateState.deckOrderById["encounter:research_azathoth"] = ["encounter_research_azathoth_02", "encounter_research_azathoth_01"];
    internal.applyEngineState(state);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_RESEARCH_ENCOUNTER", clueId: "research-marker" });
    assert.equal((await denied as { code: string }).code, "WRONG_PHASE");
    const choiceMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_RESEARCH_ENCOUNTER", clueId: "research-marker" });
    await room.waitForMessage(commandMessageType);
    const choice = await choiceMessage as PendingDecision;
    assert.equal(choice.kind, "select_rerolls");
    const paused = internal.toEngineState();
    assert.equal(paused.players[0]?.clues, 1);
    assert.equal(paused.boardClues?.length, 0);
    assert.equal(paused.pendingLocationEncounter?.deck, "research_azathoth");
    assert.equal(JSON.stringify(room.state).includes("clue_arkham"), false);
    assert.equal(JSON.stringify(room.state).includes("encounter_research_azathoth_01"), false);
    internal.applyEngineState(JSON.parse(JSON.stringify(paused)) as GameState);
    const guestDenied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: [] });
    assert.equal((await guestDenied as { code: string }).code, "NOT_DECISION_OWNER");
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: [] });
    await room.waitForMessage(commandMessageType);
    const resolved = internal.toEngineState();
    assert.equal(resolved.pendingLocationEncounter, undefined);
    assert.equal(resolved.activePlayerId, state.players[1]!.id);
    assert.deepEqual(resolved.privateState.tokenPoolById[`held_clues:${state.players[0]!.id}`], ["clue_arkham"]);
    assert.deepEqual(resolved.privateState.deckOrderById["encounter:research_azathoth"], ["encounter_research_azathoth_01", "encounter_research_azathoth_02"]);
  });

  it("places starting Gates, Monsters, and Clues without exposing private token order", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState };
    sendCommand(room, host, { type: "SELECT_INVESTIGATOR", investigatorId: "akachi_onyele" });
    await room.waitForMessage(commandMessageType);
    sendCommand(room, guest, { type: "SELECT_INVESTIGATOR", investigatorId: "trish_scarborough" });
    await room.waitForMessage(commandMessageType);
    sendCommand(room, host, { type: "SELECT_ANCIENT_ONE", ancientOneId: "cthulhu" });
    await room.waitForMessage(commandMessageType);
    sendCommand(room, host, { type: "START_GAME" });
    await room.waitForMessage(commandMessageType);
    const game = internal.toEngineState();
    assert.equal(game.privateState.deckOrderById.artifacts?.length, 14);
    assert.equal(new Set(game.privateState.deckOrderById.artifacts).size, 14);
    assert.equal(JSON.stringify(room.state).includes("artifact_ttka_halot"), false);
    assert.equal(game.phase, "action");
    assert.equal(game.activeGateIds?.length, 1);
    assert.equal(game.monsters?.length, 1);
    assert.equal(game.boardClues?.length, 1);
    assert.equal(game.privateState.deckOrderById.gates?.length, 8);
    assert.ok(room.state.activeGateIds.includes(game.activeGateIds![0]!));
    assert.ok(!JSON.stringify(room.state).includes(game.privateState.deckOrderById.gates![0]!));
  });

  it("round-trips public Monster instances through room state while keeping the cup private", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.monsters = [{ id: "on-board-1", monsterId: "monster_ghoul", locationId: "arkham", damage: 1 }];
    state.activeGateIds = ["gate_arkham"];
    state.boardClues = [{ id: "marker-1", locationId: "london" }];
    state.currentMythosIconIndex = 1;
    state.privateState.tokenPoolById.monsters = ["monster_deep_one"];
    state.privateState.tokenPoolById["board_clue:marker-1"] = ["clue_arkham"];
    internal.applyEngineState(state);
    assert.deepEqual(internal.toEngineState().monsters, state.monsters);
    assert.deepEqual(internal.toEngineState().monsterLocationIds, ["arkham"]);
    assert.deepEqual(internal.toEngineState().activeGateIds, ["gate_arkham"]);
    assert.deepEqual(internal.toEngineState().boardClues, [{ id: "marker-1", locationId: "london" }]);
    assert.equal(internal.toEngineState().currentMythosIconIndex, 1);
    assert.ok(room.state.monsters.includes("monster_ghoul"));
    assert.ok(!JSON.stringify(room.state).includes("monster_deep_one"));
    assert.ok(!JSON.stringify(room.state).includes("clue_arkham"));
  });

  it("accepts only the active investigator's Monster fight and records its result", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "encounter";
    state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
    state.players[0]!.investigatorId = "akachi_onyele";
    state.players[0]!.locationId = "arkham";
    state.players[0]!.health = 5;
    state.players[0]!.sanity = 7;
    state.players[0]!.assetIds = [];
    state.monsters = [{ id: "board-nightgaunt", monsterId: "monster_nightgaunt", locationId: "arkham", damage: 0 }];
    state.monsterLocationIds = ["arkham"];
    internal.applyEngineState(state);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "FIGHT_MONSTER", monsterInstanceId: "board-nightgaunt" });
    assert.equal((await denied as { code: string }).code, "INVALID_COMBAT");
    sendCommand(room, host, { type: "FIGHT_MONSTER", monsterInstanceId: "board-nightgaunt" });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.stateVersion, state.stateVersion + 1);
    const after = internal.toEngineState();
    assert.ok(after.monsters?.every(monster => monster.id !== "board-nightgaunt") || after.activePlayerId === state.players[1]!.id);
    assert.equal(after.players[0]!.health <= 5, true);
  });

  it("authorizes Mythos icon advancement and preserves the card on unsupported text", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = [...room.state.players.values()][0]!.id;
    state.currentMythosCardId = "mythos_yellow_01";
    state.currentMythosIconIndex = 3;
    internal.applyEngineState(state);
    const notLead = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "ADVANCE_MYTHOS" });
    assert.equal((await notLead as { code: string }).code, "WRONG_PHASE");
    const unsupported = host.waitForMessage(commandErrorMessageType);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    assert.equal((await unsupported as { code: string }).code, "MYTHOS_EFFECT_UNSUPPORTED");
    assert.equal(room.state.currentMythosCardId, "mythos_yellow_01");
    assert.equal(room.state.currentMythosIconIndex, 3);
  });

  it("resolves a typed Mythos blessing and opens replacement timing", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    const hostId = state.players[0]!.id;
    state.phase = "mythos";
    state.activePlayerId = state.leadInvestigatorId = hostId;
    state.currentMythosCardId = "mythos_green_04";
    state.currentMythosIconIndex = 3;
    state.players[0]!.investigatorId = "akachi_onyele";
    state.players[0]!.conditionIds = [];
    state.privateState.tokenPoolById["condition:blessed"] = ["condition_blessed_01"];
    internal.applyEngineState(state);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.currentMythosCardId, "");
    assert.equal(internal.toEngineState().replacementWindow, true);
    assert.deepEqual(internal.toEngineState().players[0]!.conditionIds, ["condition_blessed_01"]);
    sendCommand(room, host, { type: "BEGIN_NEXT_ROUND" });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.phase, "action");
    assert.equal(room.state.turnNumber, state.turnNumber + 1);
    assert.equal(internal.toEngineState().replacementWindow, false);
  });

  it("grants Rally the People's Ally from the private Asset deck to the Lead only", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    const hostId = state.players[0]!.id;
    state.phase = "mythos";
    state.activePlayerId = state.leadInvestigatorId = hostId;
    state.currentMythosCardId = "mythos_yellow_05";
    state.currentMythosIconIndex = 3;
    state.privateState.deckOrderById.assets = ["asset_axe", "asset_personal_assistant"];
    internal.applyEngineState(state);
    assert.equal(JSON.stringify(room.state).includes("asset_axe"), false);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const resolved = internal.toEngineState();
    assert.deepEqual(resolved.players[0]!.assetIds, ["asset_personal_assistant"]);
    assert.deepEqual(resolved.players[1]!.assetIds, []);
    assert.deepEqual(resolved.privateState.deckOrderById.assets, ["asset_axe"]);
    assert.equal(room.state.currentMythosCardId, "");
    assert.equal(resolved.replacementWindow, true);
    assert.equal(JSON.stringify(room.state).includes("asset_axe"), false);
  });

  it("resolves Perplexing Stars from the public Gate symbols without exposing deck order", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.omen = 0;
    state.doom = 8;
    state.activeGateIds = ["gate_london", "gate_tokyo"];
    state.currentMythosCardId = "mythos_yellow_13";
    state.currentMythosIconIndex = 3;
    state.privateState.deckOrderById.mythos = ["mythos_green_01"];
    internal.applyEngineState(state);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.omen, 3);
    assert.equal(room.state.doom, 6);
    assert.equal(room.state.currentMythosCardId, "");
    assert.equal(internal.toEngineState().replacementWindow, true);
    assert.deepEqual(internal.toEngineState().privateState.deckOrderById.mythos, ["mythos_green_01"]);
    assert.ok(!JSON.stringify(room.state).includes("mythos_green_01"));
  });

  it("discards Dimensional Instability Gates into a public pile while keeping the remaining stack private", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.omen = 1;
    state.doom = 8;
    state.currentMythosCardId = "mythos_green_14";
    state.currentMythosIconIndex = 3;
    state.activeGateIds = ["gate_london", "gate_tokyo"];
    state.privateState.deckOrderById.gates = ["gate_arkham"];
    internal.applyEngineState(state);
    assert.equal(JSON.stringify(room.state).includes("gate_arkham"), false);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.doom, 6);
    assert.equal(room.state.activeGateIds, "");
    assert.equal(room.state.discardedGateIds, "gate_london,gate_tokyo");
    assert.equal(room.state.currentMythosCardId, "");
    assert.deepEqual(internal.toEngineState().privateState.deckOrderById.gates, ["gate_arkham"]);
    assert.equal(JSON.stringify(room.state).includes("gate_arkham"), false);
  });

  it("spawns Calling the Elder Things Monsters without publishing the remaining cup", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.currentMythosCardId = "mythos_green_18";
    state.currentMythosIconIndex = 3;
    state.monsters = [{ id: "cultist-one", monsterId: "monster_cultist", locationId: "arkham", damage: 0 }];
    state.monsterLocationIds = ["arkham"];
    state.privateState.tokenPoolById.monsters = ["monster_ghoul", "monster_deep_one"];
    internal.applyEngineState(state);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "ADVANCE_MYTHOS" });
    assert.equal((await denied as { code: string }).code, "WRONG_PHASE");
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const resolved = internal.toEngineState();
    assert.equal(resolved.monsters?.length, 2);
    assert.equal(resolved.monsters?.[1]?.locationId, "arkham");
    assert.equal(resolved.privateState.tokenPoolById.monsters?.length, 1);
    assert.equal(resolved.replacementWindow, true);
    assert.equal(room.state.currentMythosCardId, "");
    assert.equal(JSON.stringify(room.state).includes(resolved.privateState.tokenPoolById.monsters![0]!), false);
  });

  it("resolves The Bermuda Triangle with server-owned rolls and public movement", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.currentMythosCardId = "mythos_yellow_20";
    state.currentMythosIconIndex = 3;
    state.players.forEach(player => { player.locationId = "arkham"; player.delayed = false; });
    internal.applyEngineState(state);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "ADVANCE_MYTHOS" });
    assert.equal((await denied as { code: string }).code, "WRONG_PHASE");
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const resolved = internal.toEngineState();
    assert.equal(resolved.stateVersion, state.stateVersion + 1);
    for (const player of resolved.players) {
      assert.ok(player.locationId === "arkham" || player.locationId === "space_8");
      assert.equal(Boolean(player.delayed), player.locationId === "space_8");
    }
    assert.equal(resolved.replacementWindow, true);
    assert.equal(room.state.currentMythosCardId, "");
  });

  it("keeps That Which Consumes Gate choices owner-only and discards the selected Gate", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.omen = 2;
    state.doom = 8;
    state.currentMythosCardId = "mythos_green_03";
    state.currentMythosIconIndex = 3;
    state.activeGateIds = ["gate_arkham", "gate_london"];
    state.privateState.deckOrderById.gates = ["gate_tokyo"];
    internal.applyEngineState(state);
    const ownerOptions = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const choice = await ownerOptions as PendingDecision;
    assert.equal(choice.kind, "choose_that_which_consumes_gate");
    assert.deepEqual(choice.optionIds, ["gate_arkham", "gate_london"]);
    assert.equal(room.state.pendingDecision?.optionCount, 2);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: ["gate_london"] });
    assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: ["gate_london"] });
    await room.waitForMessage(commandMessageType);
    const resolved = internal.toEngineState();
    assert.deepEqual(resolved.activeGateIds, ["gate_arkham"]);
    assert.deepEqual(resolved.discardedGateIds, ["gate_london"]);
    assert.equal(resolved.doom, 7);
    assert.equal(resolved.replacementWindow, true);
    assert.deepEqual(resolved.privateState.deckOrderById.gates, ["gate_tokyo"]);
    assert.equal(JSON.stringify(room.state).includes("gate_tokyo"), false);
  });

  it("resumes Torn Asunder damage after the first investigator resolves defeat", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.omen = 2;
    state.doom = 8;
    state.currentMythosCardId = "mythos_green_08";
    state.currentMythosIconIndex = 3;
    state.activeGateIds = ["gate_arkham", "gate_rome"];
    state.players[0] = { ...state.players[0]!, investigatorId: "jim_culver", locationId: "arkham", health: 1, sanity: 4, clues: 0 };
    state.players[1] = { ...state.players[1]!, investigatorId: "trish_scarborough", locationId: "london", health: 4, sanity: 4, clues: 0 };
    delete state.privateState.tokenPoolById.clues;
    internal.applyEngineState(state);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const paused = internal.toEngineState();
    assert.equal(paused.pendingDefeat?.playerId, state.players[0]?.id);
    assert.deepEqual(paused.pendingMythosDamage?.remainingPlayerIds, [state.players[1]?.id]);
    assert.equal(paused.players[1]?.health, 4);
    assert.equal(room.state.currentMythosCardId, "mythos_green_08");
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "ADVANCE_MYTHOS" });
    assert.equal((await denied as { code: string }).code, "WRONG_PHASE");
    sendCommand(room, host, { type: "RESOLVE_DEFEAT", cityId: "arkham", cause: "health", leadPlayerId: state.players[1]!.id });
    await room.waitForMessage(commandMessageType);
    const resolved = internal.toEngineState();
    assert.equal(resolved.players[1]?.health, 2);
    assert.equal(resolved.pendingDefeat, undefined);
    assert.equal(resolved.pendingMythosDamage, undefined);
    assert.equal(resolved.replacementWindow, true);
    assert.equal(room.state.currentMythosCardId, "");
  });

  it("keeps Heat Wave choices private and resumes after a lethal Health loss", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.doom = 8;
    state.currentMythosCardId = "mythos_yellow_14";
    state.currentMythosIconIndex = 3;
    state.players[0] = { ...state.players[0]!, investigatorId: "jim_culver", locationId: "arkham", health: 2, sanity: 4, clues: 0 };
    state.players[1] = { ...state.players[1]!, investigatorId: "trish_scarborough", locationId: "london", health: 4, sanity: 4, clues: 0 };
    delete state.privateState.tokenPoolById.clues;
    internal.applyEngineState(state);

    const hostChoiceMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const hostChoice = await hostChoiceMessage as PendingDecision;
    assert.equal(hostChoice.kind, "choose_heat_wave");
    assert.deepEqual(hostChoice.optionIds, ["become_delayed", "lose_health"]);
    assert.equal(room.state.pendingDecision?.optionCount, 2);
    assert.equal(JSON.stringify(room.state).includes("become_delayed"), false);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: hostChoice.id, selectedOptionIds: ["lose_health"] });
    assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");

    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: hostChoice.id, selectedOptionIds: ["lose_health"] });
    await room.waitForMessage(commandMessageType);
    const paused = internal.toEngineState();
    assert.equal(paused.pendingDefeat?.playerId, state.players[0]!.id);
    assert.deepEqual(paused.pendingHeatWave?.remainingPlayerIds, [state.players[1]!.id]);
    assert.equal(paused.players[1]?.health, 4);

    const guestChoiceMessage = guest.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_DEFEAT", cityId: "arkham", cause: "health", leadPlayerId: state.players[1]!.id });
    await room.waitForMessage(commandMessageType);
    const guestChoice = await guestChoiceMessage as PendingDecision;
    assert.equal(guestChoice.kind, "choose_heat_wave");
    assert.equal(guestChoice.playerId, state.players[1]!.id);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: guestChoice.id, selectedOptionIds: ["become_delayed"] });
    await room.waitForMessage(commandMessageType);
    const resolved = internal.toEngineState();
    assert.equal(resolved.players[1]?.delayed, true);
    assert.equal(resolved.pendingHeatWave, undefined);
    assert.equal(resolved.replacementWindow, true);
    assert.equal(room.state.currentMythosCardId, "");
  });

  it("resolves Blood Flows through an owner-only Monster choice", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.doom = 8;
    state.currentMythosCardId = "mythos_green_16";
    state.currentMythosIconIndex = 3;
    state.players[0] = { ...state.players[0]!, investigatorId: "jim_culver", locationId: "arkham", health: 5, sanity: 4, clues: 0 };
    state.monsters = [{ id: "blood-ghoul", monsterId: "monster_ghoul", locationId: "london", damage: 0 }];
    state.monsterLocationIds = ["london"];
    state.privateState.tokenPoolById.monsters = [];
    delete state.privateState.tokenPoolById.clues;
    internal.applyEngineState(state);
    const ownerChoiceMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const choice = await ownerChoiceMessage as PendingDecision;
    assert.equal(choice.kind, "choose_blood_flows_monster");
    assert.deepEqual(choice.optionIds, ["blood-ghoul"]);
    assert.equal(JSON.stringify(room.state).includes("blood-ghoul"), true);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: ["blood-ghoul"] });
    assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: ["blood-ghoul"] });
    await room.waitForMessage(commandMessageType);
    const resolved = internal.toEngineState();
    assert.equal(resolved.monsters?.length, 0);
    assert.equal(resolved.players[0]?.health, 4);
    assert.equal(resolved.replacementWindow, true);
  });

  it("persists Tide of Despair choices through defeat without exposing Blessed copies", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.doom = 8;
    state.currentMythosCardId = "mythos_yellow_16";
    state.currentMythosIconIndex = 3;
    state.players[0] = { ...state.players[0]!, investigatorId: "jim_culver", locationId: "arkham", health: 2, sanity: 2, clues: 0, conditionIds: [] };
    state.players[1] = { ...state.players[1]!, investigatorId: "trish_scarborough", locationId: "london", health: 4, sanity: 4, clues: 0, conditionIds: ["condition_blessed_01"] };
    delete state.privateState.tokenPoolById.clues;
    internal.applyEngineState(state);
    const hostChoiceMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const hostChoice = await hostChoiceMessage as PendingDecision;
    assert.deepEqual(hostChoice.optionIds, ["lose_health_and_sanity"]);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: hostChoice.id, selectedOptionIds: ["lose_health_and_sanity"] });
    assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: hostChoice.id, selectedOptionIds: ["lose_health_and_sanity"] });
    await room.waitForMessage(commandMessageType);
    assert.deepEqual(internal.toEngineState().pendingDefeat?.causes, ["health", "sanity"]);
    assert.deepEqual(internal.toEngineState().pendingTideOfDespair?.remainingPlayerIds, [state.players[1]!.id]);
    const guestChoiceMessage = guest.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_DEFEAT", cityId: "arkham", cause: "sanity", leadPlayerId: state.players[1]!.id });
    await room.waitForMessage(commandMessageType);
    const guestChoice = await guestChoiceMessage as PendingDecision;
    assert.deepEqual(guestChoice.optionIds, ["discard_blessed", "lose_health_and_sanity"]);
    assert.equal(JSON.stringify(room.state).includes("condition_blessed_01"), false);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: guestChoice.id, selectedOptionIds: ["discard_blessed"] });
    await room.waitForMessage(commandMessageType);
    const resolved = internal.toEngineState();
    assert.equal(resolved.players[1]?.conditionIds?.length, 0);
    assert.equal(resolved.replacementWindow, true);
    assert.equal(room.state.currentMythosCardId, "");
  });

  it("resumes Unexpected Betrayal after defeat with the selected Ally already discarded", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.doom = 8;
    state.currentMythosCardId = "mythos_green_11";
    state.currentMythosIconIndex = 3;
    state.players[0] = { ...state.players[0]!, investigatorId: "jim_culver", locationId: "arkham", health: 2, sanity: 4, clues: 0, assetIds: ["asset_personal_assistant", "asset_lodge_researcher"] };
    state.players[1] = { ...state.players[1]!, investigatorId: "trish_scarborough", locationId: "london", health: 5, sanity: 4, clues: 0, assetIds: ["asset_hired_muscle"] };
    delete state.privateState.tokenPoolById.clues;
    internal.applyEngineState(state);
    const hostChoiceMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const hostChoice = await hostChoiceMessage as PendingDecision;
    assert.deepEqual(hostChoice.optionIds, ["asset_personal_assistant", "asset_lodge_researcher"]);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: hostChoice.id, selectedOptionIds: ["asset_personal_assistant"] });
    assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: hostChoice.id, selectedOptionIds: ["asset_personal_assistant"] });
    await room.waitForMessage(commandMessageType);
    const paused = internal.toEngineState();
    assert.equal(paused.pendingDefeat?.playerId, state.players[0]!.id);
    assert.deepEqual(paused.players[0]?.assetIds, ["asset_lodge_researcher"]);
    assert.deepEqual(paused.pendingUnexpectedBetrayal?.remainingPlayerIds, [state.players[1]!.id]);
    const guestChoiceMessage = guest.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_DEFEAT", cityId: "arkham", cause: "health", leadPlayerId: state.players[1]!.id });
    await room.waitForMessage(commandMessageType);
    const guestChoice = await guestChoiceMessage as PendingDecision;
    assert.deepEqual(internal.toEngineState().defeatedInvestigators?.[0]?.assetIds, ["asset_lodge_researcher"]);
    assert.deepEqual(guestChoice.optionIds, ["asset_hired_muscle"]);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: guestChoice.id, selectedOptionIds: ["asset_hired_muscle"] });
    await room.waitForMessage(commandMessageType);
    const resolved = internal.toEngineState();
    assert.equal(resolved.players[1]?.health, 2);
    assert.deepEqual(resolved.assetDiscardIds, ["asset_personal_assistant", "asset_hired_muscle"]);
    assert.equal(resolved.replacementWindow, true);
  });

  it("persists From Bad to Worse damage and physical Clue discards through defeat", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.doom = 8;
    state.currentMythosCardId = "mythos_yellow_17";
    state.currentMythosIconIndex = 3;
    state.players[0] = { ...state.players[0]!, investigatorId: "jim_culver", locationId: "arkham", health: 1, sanity: 4, clues: 2, conditionIds: ["condition_leg_injury_01", "condition_debt_01"] };
    state.players[1] = { ...state.players[1]!, investigatorId: "trish_scarborough", locationId: "london", health: 4, sanity: 4, clues: 0, conditionIds: ["condition_paranoia_01"] };
    state.privateState.tokenPoolById.clues = ["clue_unused"];
    state.privateState.tokenPoolById[`held_clues:${state.players[0]!.id}`] = ["clue_one", "clue_two"];
    state.privateState.tokenPoolById[`held_clues:${state.players[1]!.id}`] = [];
    internal.applyEngineState(state);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const paused = internal.toEngineState();
    assert.equal(paused.pendingDefeat?.playerId, state.players[0]!.id);
    assert.equal(paused.players[0]?.clues, 1);
    assert.deepEqual(paused.privateState.tokenPoolById.clue_discard, ["clue_one"]);
    assert.deepEqual(paused.pendingFromBadToWorse?.remainingPlayerIds, [state.players[1]!.id]);
    sendCommand(room, host, { type: "RESOLVE_DEFEAT", cityId: "arkham", cause: "health", leadPlayerId: state.players[1]!.id });
    await room.waitForMessage(commandMessageType);
    const resolved = internal.toEngineState();
    assert.deepEqual(resolved.privateState.tokenPoolById["defeated_clues:jim_culver"], ["clue_two"]);
    assert.equal(resolved.players[1]?.sanity, 3);
    assert.equal(resolved.replacementWindow, true);
    assert.equal(room.state.currentMythosCardId, "");
    assert.equal(JSON.stringify(room.state).includes("clue_two"), false);
  });

  it("restores the Lead's private Omen of Good Fortune choice after reconnect", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.omen = 0;
    state.doom = 8;
    state.currentMythosCardId = "mythos_yellow_08";
    state.currentMythosIconIndex = 3;
    internal.applyEngineState(state);
    const ownerOptions = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const choice = await ownerOptions as PendingDecision;
    assert.equal(choice.kind, "choose_omen_space");
    assert.deepEqual(choice.optionIds, ["stay", "omen_0", "omen_1", "omen_2", "omen_3"]);
    assert.equal(room.state.pendingDecision?.optionCount, 5);
    assert.equal(JSON.stringify(room.state).includes("omen_2"), false);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: ["omen_2"] });
    assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
    const token = host.reconnectionToken;
    host.reconnection.enabled = false;
    host.connection.close();
    await eventually(() => ![...room.state.players.values()][0]!.connected);
    const restored = await colyseus.sdk.reconnect(token);
    restored.onMessage("seat-token", () => undefined);
    const restoredOptions = restored.waitForMessage(pendingDecisionMessageType);
    restored.send("request-seat-token");
    assert.deepEqual((await restoredOptions as PendingDecision).optionIds, choice.optionIds);
    sendCommand(room, restored, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: ["omen_2"] });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.omen, 2);
    assert.equal(room.state.doom, 8);
    assert.equal(room.state.currentMythosCardId, "");
    assert.equal(internal.toEngineState().replacementWindow, true);
  });

  it("passes The World Fights Back choices between owners without exposing private options", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.currentMythosCardId = "mythos_yellow_07";
    state.currentMythosIconIndex = 3;
    state.players[0]!.health = 1;
    state.players[0]!.maxHealth = 4;
    state.players[1]!.sanity = 1;
    state.players[1]!.maxSanity = 4;
    internal.applyEngineState(state);
    const hostDecisionMessage = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const first = await hostDecisionMessage as PendingDecision;
    assert.equal(first.kind, "choose_world_fights_back");
    assert.equal(first.playerId, state.players[0]!.id);
    assert.equal(JSON.stringify(room.state).includes("recover_health"), false);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: first.id, selectedOptionIds: ["recover_health"] });
    assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
    const guestDecisionMessage = guest.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: first.id, selectedOptionIds: ["recover_health"] });
    await room.waitForMessage(commandMessageType);
    const second = await guestDecisionMessage as PendingDecision;
    assert.equal(second.playerId, state.players[1]!.id);
    assert.equal(internal.toEngineState().players[0]!.health, 3);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: second.id, selectedOptionIds: ["recover_sanity"] });
    await room.waitForMessage(commandMessageType);
    assert.equal(internal.toEngineState().players[1]!.sanity, 3);
    assert.equal(room.state.currentMythosCardId, "");
    assert.equal(internal.toEngineState().replacementWindow, true);
  });

  it("keeps Everyone Has a Price decisions owner-only and restores the next choice on reconnect", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.currentMythosCardId = "mythos_yellow_06";
    state.currentMythosIconIndex = 3;
    state.players[0]!.conditionIds = ["condition_blessed_01"];
    state.players[1]!.conditionIds = ["condition_cursed_01"];
    state.privateState.tokenPoolById["condition:debt"] = ["condition_debt_01", "condition_debt_02"];
    internal.applyEngineState(state);
    const hostOptions = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const first = await hostOptions as PendingDecision;
    assert.deepEqual(first.optionIds, ["condition_blessed", "skip"]);
    assert.equal(JSON.stringify(room.state).includes("condition_debt_01"), false);
    assert.equal(JSON.stringify(room.state).includes("condition_blessed_01"), false);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: first.id, selectedOptionIds: ["condition_blessed"] });
    assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
    const guestOptions = guest.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: first.id, selectedOptionIds: ["condition_blessed"] });
    await room.waitForMessage(commandMessageType);
    const second = await guestOptions as PendingDecision;
    assert.deepEqual(second.optionIds, ["condition_cursed", "skip"]);
    const firstDebtId = internal.toEngineState().players[0]!.conditionIds?.[0];
    assert.ok(firstDebtId === "condition_debt_01" || firstDebtId === "condition_debt_02");
    assert.deepEqual(internal.toEngineState().privateState.tokenPoolById["condition:blessed"], ["condition_blessed_01"]);
    const token = guest.reconnectionToken;
    guest.reconnection.enabled = false;
    guest.connection.close();
    await eventually(() => ![...room.state.players.values()][1]!.connected);
    const restored = await colyseus.sdk.reconnect(token);
    restored.onMessage("seat-token", () => undefined);
    const restoredOptions = restored.waitForMessage(pendingDecisionMessageType);
    restored.send("request-seat-token");
    assert.deepEqual((await restoredOptions as PendingDecision).optionIds, second.optionIds);
    sendCommand(room, restored, { type: "RESOLVE_DECISION", decisionId: second.id, selectedOptionIds: ["condition_cursed"] });
    await room.waitForMessage(commandMessageType);
    const secondDebtId = internal.toEngineState().players[1]!.conditionIds?.[0];
    assert.ok(secondDebtId === "condition_debt_01" || secondDebtId === "condition_debt_02");
    assert.notEqual(secondDebtId, firstDebtId);
    assert.equal(room.state.currentMythosCardId, "");
    assert.equal(internal.toEngineState().replacementWindow, true);
  });

  it("keeps Desperate Times private and grants Dark Pact without reducing Doom", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "mythos";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    state.ancientOneId = "azathoth";
    state.doom = 8;
    state.currentMythosCardId = "mythos_yellow_10";
    state.currentMythosIconIndex = 3;
    state.privateState.tokenPoolById["condition:dark_pact"] = ["condition_dark_pact_01"];
    internal.applyEngineState(state);
    const ownerOptions = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "ADVANCE_MYTHOS" });
    await room.waitForMessage(commandMessageType);
    const choice = await ownerOptions as PendingDecision;
    assert.deepEqual(choice.optionIds, ["gain_dark_pact", "advance_doom"]);
    assert.equal(JSON.stringify(room.state).includes("gain_dark_pact"), false);
    assert.equal(JSON.stringify(room.state).includes("condition_dark_pact_01"), false);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: ["gain_dark_pact"] });
    assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: choice.id, selectedOptionIds: ["gain_dark_pact"] });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.doom, 8);
    assert.equal(room.state.currentMythosCardId, "");
    assert.deepEqual(internal.toEngineState().players[0]!.conditionIds, ["condition_dark_pact_01"]);
    assert.equal(JSON.stringify(room.state).includes("condition_dark_pact_01"), false);
    assert.equal(internal.toEngineState().replacementWindow, true);
  });

  it("resolves a supported location encounter through the room and leaves unsupported cards private", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "encounter";
    state.leadInvestigatorId = state.activePlayerId = state.players[0]!.id;
    for (const player of state.players) {
      player.investigatorId = "akachi_onyele";
      player.locationId = "space_2";
      player.clues = 0;
      player.assetIds = [];
      player.skillImprovements = {};
      state.privateState.tokenPoolById[`held_clues:${player.id}`] = [];
    }
    state.privateState.deckOrderById["encounter:general"] = ["encounter_general_08", "encounter_general_01"];
    state.privateState.tokenPoolById.clues = ["clue_arkham"];
    state.privateState.tokenPoolById.clue_discard = [];
    internal.applyEngineState(state);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_LOCATION_ENCOUNTER", deck: "general" });
    assert.equal((await denied as { code: string }).code, "WRONG_PHASE");
    sendCommand(room, host, { type: "RESOLVE_LOCATION_ENCOUNTER", deck: "general" });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.activePlayerId, state.players[1]!.id);
    assert.equal(room.state.lastLocationEncounterCardId, "encounter_general_08");
    assert.deepEqual(internal.toEngineState().privateState.deckOrderById["encounter:general"], ["encounter_general_01", "encounter_general_08"]);
    assert.ok(!JSON.stringify(room.state).includes("encounter_general_01"));
    const unsupported = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_LOCATION_ENCOUNTER", deck: "general" });
    assert.equal((await unsupported as { code: string }).code, "ENCOUNTER_UNSUPPORTED");
    assert.equal(room.state.phase, "encounter");
  });

  it("authorizes Trish's component action and conserves the private physical Clue", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "action";
    state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
    state.actionsRemaining = 2;
    Object.assign(state.players[0]!, { investigatorId: "trish_scarborough", locationId: "space_16", health: 7, sanity: 5, assetIds: [], clues: 0 });
    state.privateState.tokenPoolById.clues = ["clue_arkham"];
    state.privateState.tokenPoolById[`held_clues:${state.players[0]!.id}`] = [];
    internal.applyEngineState(state);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "USE_INVESTIGATOR_ACTION" });
    assert.equal((await denied as { code: string }).code, "NOT_ACTIVE_PLAYER");
    sendCommand(room, host, { type: "USE_INVESTIGATOR_ACTION" });
    await room.waitForMessage(commandMessageType);
    const finished = internal.toEngineState();
    assert.equal(finished.players[0]!.clues, 1);
    assert.equal(finished.actionsRemaining, 1);
    assert.deepEqual(finished.privateState.tokenPoolById.clues, []);
    assert.deepEqual(finished.privateState.tokenPoolById[`held_clues:${state.players[0]!.id}`], ["clue_arkham"]);
    assert.equal(JSON.stringify(room.state).includes("clue_arkham"), false);
  });

  it("resumes the scanned San Francisco optional encounter through two private choices", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "encounter";
    state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
    Object.assign(state.players[0]!, { investigatorId: "akachi_onyele", locationId: "san_francisco", health: 5, sanity: 7, assetIds: [], clues: 0, skillImprovements: {} });
    state.privateState.deckOrderById["encounter:america"] = ["encounter_america_05"];
    internal.applyEngineState(state);
    sendCommand(room, host, { type: "RESOLVE_LOCATION_ENCOUNTER", deck: "america" });
    await room.waitForMessage(commandMessageType);
    const offered = internal.toEngineState();
    assert.equal(offered.pendingDecision?.kind, "encounter_choice");
    assert.ok(offered.pendingLocationEncounter);
    assert.equal(JSON.stringify(room.state).includes("pendingLocationEncounter"), false);
    assert.equal(JSON.stringify(room.state).includes("optionLabels"), false);
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId: offered.pendingDecision!.id, selectedOptionIds: ["accept"] });
    assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: offered.pendingDecision!.id, selectedOptionIds: ["accept"] });
    await room.waitForMessage(commandMessageType);
    const accepted = internal.toEngineState();
    assert.equal(accepted.players[0]!.delayed, true);
    assert.deepEqual(accepted.pendingDecision?.optionIds, ["lore", "influence", "observation", "strength", "will"]);
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: accepted.pendingDecision!.id, selectedOptionIds: ["lore"] });
    await room.waitForMessage(commandMessageType);
    const finished = internal.toEngineState();
    assert.equal(finished.players[0]!.skillImprovements.lore, 1);
    assert.equal(finished.activePlayerId, state.players[1]!.id);
    assert.equal(finished.pendingLocationEncounter, undefined);
    assert.equal(finished.pendingDecision, undefined);
    assert.equal(finished.lastLocationEncounterCardId, "encounter_america_05");
  });

  it("pauses a lethal location encounter for defeat and resumes the encounter order", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "encounter";
    state.ancientOneId = "cthulhu";
    state.doom = 12;
    state.activePlayerId = state.leadInvestigatorId = state.players[0]!.id;
    Object.assign(state.players[0]!, { investigatorId: "akachi_onyele", locationId: "space_2", health: 5, sanity: 1 });
    Object.assign(state.players[1]!, { investigatorId: "trish_scarborough", locationId: "space_16", health: 7, sanity: 5 });
    state.privateState.deckOrderById["encounter:general"] = ["encounter_general_07"];
    internal.applyEngineState(state);
    sendCommand(room, host, { type: "RESOLVE_LOCATION_ENCOUNTER", deck: "general" });
    await room.waitForMessage(commandMessageType);
    const after = internal.toEngineState();
    assert.equal(after.activePlayerId, state.players[0]!.id);
    assert.equal(after.doom, 11);
    assert.equal(after.lastLocationEncounterCardId, "encounter_general_07");
    assert.deepEqual(after.players[0]!.conditionIds, []);
    assert.ok(after.pendingDefeat);
    sendCommand(room, host, { type: "RESOLVE_DEFEAT", cause: "sanity", cityId: after.pendingDefeat.cityIds[0]!, leadPlayerId: state.players[1]!.id });
    await room.waitForMessage(commandMessageType);
    assert.equal(internal.toEngineState().activePlayerId, state.players[1]!.id);
    assert.equal(internal.toEngineState().pendingDefeat, undefined);
  });

  it("keeps a location encounter test pending for the owner and resumes it after a decision", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const internal = room as unknown as { toEngineState(): GameState; applyEngineState(state: GameState): void };
    const state = internal.toEngineState();
    state.phase = "encounter";
    const hostId = state.players[0]!.id;
    state.activePlayerId = state.leadInvestigatorId = hostId;
    state.players[0]!.investigatorId = "akachi_onyele";
    state.players[0]!.locationId = "space_2";
    state.players[0]!.clues = 1;
    state.privateState.tokenPoolById[`held_clues:${hostId}`] = ["clue_arkham"];
    state.privateState.tokenPoolById.clues = ["clue_london"];
    state.privateState.deckOrderById["encounter:general"] = ["encounter_general_08"];
    internal.applyEngineState(state);
    sendCommand(room, host, { type: "RESOLVE_LOCATION_ENCOUNTER", deck: "general" });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.currentLocationEncounterCardId, "encounter_general_08");
    assert.equal(room.state.pendingDecision?.kind, "select_rerolls");
    assert.equal(room.state.activeTest?.continuation, "location_encounter");
    const decisionId = room.state.pendingDecision!.id;
    const denied = guest.waitForMessage(commandErrorMessageType);
    sendCommand(room, guest, { type: "RESOLVE_DECISION", decisionId, selectedOptionIds: [] });
    assert.equal((await denied as { code: string }).code, "NOT_DECISION_OWNER");
    sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId, selectedOptionIds: [] });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.currentLocationEncounterCardId, "");
    assert.equal(room.state.lastLocationEncounterCardId, "encounter_general_08");
    assert.equal(room.state.pendingDecision, undefined);
  });

  function sendCommand(
    room: { state: GameRoomState },
    client: { send: (type: string, payload: unknown) => void },
    command: GameCommand,
    expectedStateVersion = room.state.stateVersion,
  ): void {
    client.send(commandMessageType, { expectedStateVersion, command });
  }

  async function eventually(check: () => boolean): Promise<void> {
    const deadline = Date.now() + 4000;
    while (!check()) {
      if (Date.now() > deadline) throw new Error("State transition timed out");
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  for (const stage of ["reroll", "purchase"] as const) {
    it(`restores an actual dropped connection during ${stage}`, async () => {
      const room = await colyseus.createRoom<GameRoom>("game", {});
      const host = await colyseus.connectTo(room, { displayName: "Host" });
      const guest = await colyseus.connectTo(room, { displayName: "Guest" });
      host.onMessage(pendingDecisionMessageType, () => undefined);
      sendCommand(room, host, { type: "SELECT_INVESTIGATOR", investigatorId: "akachi_onyele" });
      await room.waitForMessage(commandMessageType);
      sendCommand(room, guest, { type: "SELECT_INVESTIGATOR", investigatorId: "trish_scarborough" });
      await room.waitForMessage(commandMessageType);
      sendCommand(room, host, { type: "SELECT_ANCIENT_ONE", ancientOneId: "cthulhu" });
      await room.waitForMessage(commandMessageType);
      sendCommand(room, host, { type: "START_GAME" });
      await room.waitForMessage(commandMessageType);
      sendCommand(room, host, { type: "ACQUIRE_ASSETS" });
      await room.waitForMessage(commandMessageType);
      if (stage === "purchase") {
        sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: room.state.pendingDecision!.id, selectedOptionIds: [] });
        await room.waitForMessage(commandMessageType);
      }
      const seat = [...room.state.players.values()].find(player => player.isHost)!;
      const decisionId = room.state.pendingDecision!.id;
      const dice = room.state.activeTest?.dice;
      const token = host.reconnectionToken;
      host.reconnection.enabled = false;
      host.connection.close();
      await eventually(() => !seat.connected);
      assert.equal(room.state.players.size, 2);
      const restored = await colyseus.sdk.reconnect(token);
      restored.onMessage("seat-token", () => undefined);
      const options = restored.waitForMessage(pendingDecisionMessageType);
      restored.send("request-seat-token");
      assert.equal((await options as PendingDecision).id, decisionId);
      assert.equal(room.state.activeTest?.dice, dice);
      assert.equal(seat.connected, true);
      sendCommand(room, restored, { type: "RESOLVE_DECISION", decisionId, selectedOptionIds: [] });
      await room.waitForMessage(commandMessageType);
      assert.notEqual(room.state.pendingDecision?.id, decisionId);
    });
  }

  it("offers an owner-only Bank Loan and synchronizes only its Condition front", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    sendCommand(room, host, { type: "SELECT_INVESTIGATOR", investigatorId: "akachi_onyele" });
    await room.waitForMessage(commandMessageType);
    sendCommand(room, guest, { type: "SELECT_INVESTIGATOR", investigatorId: "trish_scarborough" });
    await room.waitForMessage(commandMessageType);
    sendCommand(room, host, { type: "SELECT_ANCIENT_ONE", ancientOneId: "cthulhu" });
    await room.waitForMessage(commandMessageType);
    sendCommand(room, host, { type: "START_GAME" });
    await room.waitForMessage(commandMessageType);
    // A randomly selected Mystery can grant a starting Condition. The loan
    // adds Debt; it must preserve, not erase, those pre-existing fronts.
    const priorConditionFronts = [...room.state.players.values()].find(player => player.isHost)!.conditionIds.split(",").filter(Boolean);
    const privateDecision = host.waitForMessage(pendingDecisionMessageType);
    sendCommand(room, host, { type: "ACQUIRE_ASSETS" });
    await room.waitForMessage(commandMessageType);
    const decision = await privateDecision as PendingDecision;
    if (decision.kind === "select_rerolls") {
      const purchaseDecision = host.waitForMessage(pendingDecisionMessageType);
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: decision.id, selectedOptionIds: [] });
      await room.waitForMessage(commandMessageType);
      const purchase = await purchaseDecision as PendingDecision;
      assert.ok(purchase.optionIds.includes("bank-loan"));
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: purchase.id, selectedOptionIds: ["bank-loan"] });
    } else {
      assert.ok(decision.optionIds.includes("bank-loan"));
      sendCommand(room, host, { type: "RESOLVE_DECISION", decisionId: decision.id, selectedOptionIds: ["bank-loan"] });
    }
    await room.waitForMessage(commandMessageType);
    const hostSeat = [...room.state.players.values()].find(player => player.isHost)!;
    assert.deepEqual(hostSeat.conditionIds.split(",").sort(), [...priorConditionFronts, "condition_debt"].sort());
    assert.doesNotMatch(JSON.stringify(room.state), /condition_debt_\d{2}/);
    assert.equal(JSON.stringify(room.state).includes("Unwilling Servant"), false);
    assert.equal(JSON.stringify(room.state).includes("Debt Collector"), false);
  });

  it("reclaims a disconnected seat by private token without exposing it in room state", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const seatTokenMessage = host.waitForMessage("seat-token");
    host.send("request-seat-token");
    const seatToken = await seatTokenMessage as string;
    assert.ok(seatToken);
    assert.ok(!JSON.stringify(room.state).includes(seatToken));
    const hostSeat = [...room.state.players.values()].find(player => player.isHost)!;
    sendCommand(room, host, { type: "SELECT_INVESTIGATOR", investigatorId: "akachi_onyele" });
    await room.waitForMessage(commandMessageType);
    sendCommand(room, guest, { type: "SELECT_INVESTIGATOR", investigatorId: "trish_scarborough" });
    await room.waitForMessage(commandMessageType);
    sendCommand(room, host, { type: "SELECT_ANCIENT_ONE", ancientOneId: "cthulhu" });
    await room.waitForMessage(commandMessageType);
    sendCommand(room, host, { type: "START_GAME" });
    await room.waitForMessage(commandMessageType);
    host.reconnection.enabled = false;
    host.connection.close();
    await eventually(() => !hostSeat.connected);
    const formerClient = room.clients.find(client => client.sessionId === host.sessionId);
    if (formerClient) room.onLeave(formerClient);
    const restored = await colyseus.sdk.joinById(room.roomId, { displayName: "Impostor name", resumeToken: seatToken });
    assert.equal(hostSeat.id, [...room.state.players.values()].find(player => player.isHost)?.id);
    assert.equal(hostSeat.sessionId, restored.sessionId);
    assert.equal(hostSeat.investigatorId, "akachi_onyele");
    assert.equal(room.state.players.size, 2);
    await assert.rejects(() => colyseus.sdk.joinById(room.roomId, { resumeToken: seatToken }));
  });

  it("runs investigator selection, game start, and movement for two players", async () => {
    const room = await colyseus.createRoom<GameRoomState>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const players = [...room.state.players.values()];
    const hostPlayer = players.find((player) => player.isHost)!;
    const guestPlayer = players.find((player) => !player.isHost)!;

    assert.equal(hostPlayer.sessionId, host.sessionId);
    assert.equal(guestPlayer.sessionId, guest.sessionId);

    sendCommand(room, host, { type: "SELECT_INVESTIGATOR", investigatorId: "akachi_onyele" });
    await room.waitForMessage(commandMessageType);
    sendCommand(room, guest, { type: "SELECT_INVESTIGATOR", investigatorId: "trish_scarborough" });
    await room.waitForMessage(commandMessageType);
    sendCommand(room, host, { type: "SELECT_ANCIENT_ONE", ancientOneId: "cthulhu" });
    await room.waitForMessage(commandMessageType);
    sendCommand(room, host, { type: "START_GAME" });
    await room.waitForMessage(commandMessageType);

    assert.equal(room.state.phase, "action");
    assert.equal(room.state.ancientOneId, "cthulhu");
    assert.match(room.state.activeMysteryId, /^cthulhu_/);
    assert.equal(room.state.mysteryProgress, 0);
    assert.ok(room.state.mysteryTarget >= 1);
    assert.equal(room.state.completedMysteryIds, "");
    const privateMysteries = (room as unknown as { privateState: { deckOrderById: Record<string, string[]> } }).privateState.deckOrderById.mysteries;
    assert.equal(privateMysteries?.length, 3);
    assert.ok(!JSON.stringify(room.state).includes(privateMysteries![0]!));
    const encounterDecks = (room as unknown as { privateState: { deckOrderById: Record<string, string[]> } }).privateState.deckOrderById;
    for (const [deck, count] of [["general", 12], ["america", 8], ["europe", 8], ["asia_australia", 8]] as const) {
      assert.equal(encounterDecks[`encounter:${deck}`]?.length, count);
      assert.ok(!JSON.stringify(room.state).includes(encounterDecks[`encounter:${deck}`]![0]!));
    }
    assert.equal(room.state.activePlayerId, hostPlayer.id);
    assert.equal(hostPlayer.locationId, "space_15");
    assert.equal(hostPlayer.health, 5);
    assert.equal(hostPlayer.sanity, 7);
    assert.equal(hostPlayer.clues, 1);
    assert.equal(guestPlayer.locationId, "space_16");
    assert.equal(guestPlayer.assetIds, "asset_45_automatic");
    assert.equal(room.state.reserveAssetIds.split(",").length, 4);
    const privateAssets = (room as unknown as { privateState: { deckOrderById: Record<string, string[]> } }).privateState.deckOrderById.assets;
    assert.equal(privateAssets?.length, 35);
    assert.ok(!JSON.stringify(room.state).includes(privateAssets![0]!));
    const privateClues = (room as unknown as { privateState: { tokenPoolById: Record<string, string[]> } }).privateState.tokenPoolById;
    assert.equal(privateClues.clues?.length, 34);
    assert.equal(privateClues[`held_clues:${hostPlayer.id}`]?.length, 1);
    assert.ok(!JSON.stringify(room.state).includes(privateClues.clues![0]!));

    sendCommand(room, host, { type: "ACQUIRE_ASSETS" });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.pendingDecision?.kind, "select_rerolls");
    assert.equal(room.state.activeTest?.playerId, hostPlayer.id);
    assert.equal(room.state.activeTest?.skill, "influence");
    assert.equal(room.state.activeTest?.dice.split(",").length, room.state.activeTest?.dicePool);
    sendCommand(room, host, {
      type: "RESOLVE_DECISION",
      decisionId: room.state.pendingDecision!.id,
      selectedOptionIds: [],
    });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.pendingDecision?.kind, "select_acquired_cards");
    assert.equal(room.state.activeTest, undefined);
    sendCommand(room, host, {
      type: "RESOLVE_DECISION",
      decisionId: room.state.pendingDecision!.id,
      selectedOptionIds: [],
    });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.pendingDecision?.kind, "discard_reserve_card");
    sendCommand(room, host, {
      type: "RESOLVE_DECISION",
      decisionId: room.state.pendingDecision!.id,
      selectedOptionIds: [],
    });
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.pendingDecision, undefined);
    assert.equal(room.state.actionsRemaining, 1);

    sendCommand(room, host, { type: "TRAVEL", destinationIds: ["space_10"] });
    await room.waitForMessage(commandMessageType);
    assert.equal(hostPlayer.locationId, "space_10");
    assert.equal(room.state.activePlayerId, guestPlayer.id);
    assert.equal(room.state.actionsRemaining, 2);
  });

  it("rejects forged player identity and isolates rooms", async () => {
    const firstRoom = await colyseus.createRoom<GameRoomState>("game", {});
    const secondRoom = await colyseus.createRoom<GameRoomState>("game", {});
    const firstClient = await colyseus.connectTo(firstRoom, { displayName: "One" });
    await colyseus.connectTo(secondRoom, { displayName: "Two" });

    firstClient.send(commandMessageType, {
      expectedStateVersion: firstRoom.state.stateVersion,
      command: {
        type: "REST",
        investigatorId: "akachi_onyele",
        playerId: [...secondRoom.state.players.keys()][0],
      },
    });
    await firstRoom.waitForMessage(commandMessageType);

    assert.equal([...firstRoom.state.players.values()][0]?.investigatorId, "");
    assert.equal([...secondRoom.state.players.values()][0]?.investigatorId, "");
  });

  it("rejects a command created from a stale state version", async () => {
    const room = await colyseus.createRoom<GameRoomState>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    const guest = await colyseus.connectTo(room, { displayName: "Guest" });
    const staleVersion = room.state.stateVersion;

    sendCommand(room, host, { type: "SELECT_INVESTIGATOR", investigatorId: "akachi_onyele" }, staleVersion);
    await room.waitForMessage(commandMessageType);
    assert.equal(room.state.stateVersion, staleVersion + 1);

    const errorPromise = new Promise<{ code: string }>((resolve) => {
      guest.onMessage(commandErrorMessageType, resolve);
    });
    sendCommand(room, guest, { type: "SELECT_INVESTIGATOR", investigatorId: "trish_scarborough" }, staleVersion);
    const error = await errorPromise;

    assert.equal(error.code, "STALE_STATE");
    assert.equal(room.state.stateVersion, staleVersion + 1);
    assert.equal([...room.state.players.values()].find((player) => !player.isHost)?.investigatorId, "");
  });

  it("re-sends owner-only decision options when the assigned player reconnects", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {});
    const host = await colyseus.connectTo(room, { displayName: "Host" });
    await colyseus.connectTo(room, { displayName: "Guest" });
    const hostPlayer = [...room.state.players.values()].find((player) => player.isHost)!;
    const decision: PendingDecision = {
      id: "decision-1",
      kind: "select_rerolls",
      playerId: hostPlayer.id,
      visibility: "owner",
      prompt: "Choose a die to reroll.",
      optionIds: ["die-1", "die-2"],
      minSelections: 0,
      maxSelections: 1,
    };
    (room as unknown as { pendingDecision: PendingDecision }).pendingDecision = decision;
    room.state.pendingDecision = new PendingDecisionState({
      id: decision.id,
      kind: decision.kind,
      playerId: decision.playerId,
      visibility: decision.visibility,
      prompt: decision.prompt,
      optionCount: decision.optionIds.length,
      minSelections: decision.minSelections,
      maxSelections: decision.maxSelections,
    });

    const decisionMessage = host.waitForMessage(pendingDecisionMessageType);
    const serverClient = room.clients.find((client) => client.sessionId === host.sessionId)!;
    room.onReconnect(serverClient);

    assert.deepEqual(await decisionMessage, decision);
    assert.equal("optionIds" in room.state.pendingDecision!, false);
    assert.equal(room.state.pendingDecision?.optionCount, 2);
  });
});
