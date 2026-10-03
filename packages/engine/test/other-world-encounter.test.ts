import { describe, expect, it } from "vitest";
import { baseGameOtherWorldEncounterRules } from "../../content/src/other-world-encounter-rules.js";
import { parseLocationEncounterInstruction } from "../src/encounter-instructions.js";
import { createDeterministicEngineContext, executeCommand, projectStateForPlayer, resolveOtherWorldEncounter, type GameContent, type GameState } from "../src/index.js";

const ids = ["encounter_other_world_02", "encounter_other_world_01", "encounter_other_world_03"];
const content: GameContent = {
  otherWorldEncounters: baseGameOtherWorldEncounterRules, otherWorldEncounterIds: ids,
  gates: [{ id: "gate_arkham", locationId: "arkham", omenSymbol: "eclipse" }, { id: "gate_london", locationId: "london", omenSymbol: "constellation" }],
  clues: [{ id: "clue_a", locationId: "arkham" }, { id: "clue_b", locationId: "london" }, { id: "clue_c", locationId: "rome" }],
  map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city", london: "city" } },
  investigators: { trish_scarborough: { startingLocationId: "arkham", health: 7, sanity: 5, skills: { lore: 1, influence: 1, observation: 1, strength: 1, will: 2 }, startingAssetIds: [], startingClues: 0 } },
  assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};
function state(clues = 0): GameState {
  return {
    stateVersion: 2, phase: "encounter", activePlayerId: "host", leadInvestigatorId: "host", ancientOneId: "azathoth", doom: 15, omen: 0, turnNumber: 1,
    players: [{ id: "host", investigatorId: "trish_scarborough", locationId: "arkham", health: 7, sanity: 5, maxHealth: 7, maxSanity: 5, assetIds: [], clues, skillImprovements: {} }, { id: "guest", locationId: "london", assetIds: [], clues: 0, skillImprovements: {} }],
    actionsRemaining: 0, performedActions: [], monsterLocationIds: [], reserveAssetIds: [], assetDiscardIds: [], mysteryProgress: 0, mysteryTarget: 0, completedMysteryIds: [],
    activeGateIds: ["gate_arkham"], discardedGateIds: [],
    privateState: { deckOrderById: { "encounter:other_world": [...ids], gates: ["gate_london"] }, tokenPoolById: { clues: clues ? ["clue_b", "clue_c"] : ["clue_a", "clue_b", "clue_c"], clue_discard: [], "held_clues:host": clues ? ["clue_a"] : [], "held_clues:guest": [] } },
  };
}
const rng = (dice: number[]) => createDeterministicEngineContext({ dice, tokenIndexes: [0, 0], ids: ["test", "decision", "later", "next"] });
function keep(before: GameState, dice: number[] = [], owner = "host") {
  return executeCommand(JSON.parse(JSON.stringify(before)), owner, { type: "RESOLVE_DECISION", decisionId: before.pendingDecision!.id, selectedOptionIds: [] }, content, rng(dice));
}
function accepted(result: ReturnType<typeof resolveOtherWorldEncounter>) {
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

describe("Gate-bound Other World card 2", () => {
  it.each([1, 6])("closes before follow-up Observation (%i), without changing Doom or drawing a Gate", die => {
    const before = state(); const snapshot = structuredClone(before);
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6, die])));
    expect(result.state.activeGateIds).toEqual([]); expect(result.state.discardedGateIds).toEqual(["gate_arkham"]);
    expect(result.state.privateState.deckOrderById.gates).toEqual(["gate_london"]);
    expect(result.state.players[0]?.clues).toBe(die === 6 ? 2 : 0);
    expect(result.state.doom).toBe(15); expect(result.state.activePlayerId).toBe("guest");
    expect(result.state.privateState.deckOrderById["encounter:other_world"]).toEqual([...ids.slice(1), ids[0]]);
    expect(result.events.filter(event => event.type === "GATE_CLOSED")).toHaveLength(1);
    expect(result.events.some(event => event.type === "OTHER_WORLD_ENCOUNTER_RESOLVED")).toBe(true);
    expect(result.state.stateVersion).toBe(3); expect(before).toEqual(snapshot);
  });
  it.each([1, 6])("retains the Gate after Initial failure and Lore (%i)", die => {
    const result = accepted(resolveOtherWorldEncounter(state(), "host", "gate_arkham", content, rng([1, die])));
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.discardedGateIds).toEqual([]);
    expect(result.state.players[0]?.sanity).toBe(die === 6 ? 5 : 0);
    expect(Boolean(result.state.pendingDefeat)).toBe(die === 1);
    expect(result.state.activePlayerId).toBe(die === 6 ? "guest" : "host");
    expect(result.state.pendingLocationEncounter).toBeUndefined();
    expect(result.state.privateState.deckOrderById["encounter:other_world"]).toEqual([...ids.slice(1), ids[0]]);
  });
  it("restores both tests, closes exactly once, keeps the private binding hidden, and hands off only after completion", () => {
    const initial = accepted(resolveOtherWorldEncounter(state(1), "host", "gate_arkham", content, rng([6])));
    expect(initial.state.activeTest).toMatchObject({ skill: "will", modifier: -1, dicePool: 1 });
    expect(initial.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(keep(initial.state, [], "guest")).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const follow = accepted(keep(initial.state, [6]));
    expect(follow.state.activeTest?.skill).toBe("observation"); expect(follow.state.activeGateIds).toEqual([]);
    expect(follow.state.pendingLocationEncounter).toMatchObject({ gateId: "gate_arkham", gateClosed: true });
    expect(projectStateForPlayer(follow.state, "guest")).not.toHaveProperty("pendingLocationEncounter");
    expect(projectStateForPlayer(follow.state, "guest")).not.toHaveProperty("privateState");
    const result = accepted(keep(follow.state));
    expect(result.state.players[0]?.clues).toBe(3); expect(result.state.activePlayerId).toBe("guest");
    expect(result.events.filter(event => event.type === "GATE_CLOSED")).toHaveLength(0);
    expect(result.state.stateVersion).toBe(5);
  });
  it("uses a conserved physical Clue to reroll Initial before closing", () => {
    const initial = accepted(resolveOtherWorldEncounter(state(1), "host", "gate_arkham", content, rng([1])));
    const result = accepted(executeCommand(initial.state, "host", { type: "RESOLVE_DECISION", decisionId: initial.state.pendingDecision!.id, selectedOptionIds: ["die-0"] }, content, rng([6, 1])));
    expect(result.state.players[0]?.clues).toBe(0);
    expect(result.state.activeGateIds).toEqual([]); expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_a"]);
  });
  it("recycles discarded Gates when the stack is empty, without reopening the closed Gate", () => {
    const before = state(1); before.activeGateIds = ["gate_arkham", "gate_london"]; before.privateState.deckOrderById.gates = [];
    const initial = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6])));
    const follow = accepted(keep(initial.state, [1]));
    expect(follow.state.privateState.deckOrderById.gates).toEqual(["gate_arkham"]); expect(follow.state.discardedGateIds).toEqual([]);
    expect(keep(follow.state).ok).toBe(true);
  });
  it.each(["unknown", "gate_london"])("rejects absent or remote Gate %s before RNG", gateId => {
    expect(resolveOtherWorldEncounter(state(), "host", gateId, content, rng([])).ok).toBe(false);
  });
  it.each(["wrong-phase", "wrong-owner", "monster", "missing-gate", "duplicate-gate", "unknown-gate", "missing-card", "duplicate-card", "akachi", "yog", "asset", "local-asset", "artifact", "card-1", "card-3"])("atomically guards %s before RNG", scenario => {
    const before = state();
    if (scenario === "wrong-phase") before.phase = "action";
    if (scenario === "wrong-owner") before.activePlayerId = "guest";
    if (scenario === "monster") before.monsterLocationIds = ["arkham"];
    if (scenario === "missing-gate") before.privateState.deckOrderById.gates = [];
    if (scenario === "duplicate-gate") before.discardedGateIds = ["gate_arkham"];
    if (scenario === "unknown-gate") before.privateState.deckOrderById.gates = ["unknown"];
    if (scenario === "missing-card") before.privateState.deckOrderById["encounter:other_world"] = [ids[0]!];
    if (scenario === "duplicate-card") before.privateState.deckOrderById["encounter:other_world"] = [ids[0]!, ids[0]!, ids[2]!];
    if (scenario === "akachi") before.players[0]!.investigatorId = "akachi_onyele";
    if (scenario === "yog") before.ancientOneId = "yog_sothoth";
    if (scenario === "asset") before.players[0]!.assetIds = ["unsupported"];
    if (scenario === "local-asset") { before.players[1]!.locationId = "arkham"; before.players[1]!.assetIds = ["asset_whiskey"]; }
    if (scenario === "artifact") before.players[0]!.artifactIds = ["artifact_ttka_halot"];
    if (scenario === "card-1" || scenario === "card-3") before.privateState.deckOrderById["encounter:other_world"] = [scenario === "card-1" ? ids[1]! : ids[2]!, ids[0]!, scenario === "card-1" ? ids[2]! : ids[1]!];
    const snapshot = structuredClone(before);
    expect(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([])).ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it.each(["gate", "location", "deck", "card", "possession", "akachi"])("revalidates restored %s before rolling a reroll", field => {
    const before = accepted(resolveOtherWorldEncounter(state(1), "host", "gate_arkham", content, rng([1]))).state;
    if (field === "gate") { before.activeGateIds = []; before.discardedGateIds = ["gate_arkham"]; }
    if (field === "location") before.players[0]!.locationId = "london";
    if (field === "deck") before.privateState.deckOrderById["encounter:other_world"]!.reverse();
    if (field === "card") before.currentLocationEncounterCardId = ids[1];
    if (field === "possession") before.players[0]!.assetIds = ["asset_whiskey"];
    if (field === "akachi") before.players[0]!.investigatorId = "akachi_onyele";
    const snapshot = structuredClone(before);
    expect(keep(before).ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it("retains card 1's Spell alternative rather than enabling a partial tree", () => {
    expect(JSON.stringify(baseGameOtherWorldEncounterRules[0])).toContain('"kind":"spell"');
    expect(parseLocationEncounterInstruction(baseGameOtherWorldEncounterRules[0]!.sections.initial)).toBeUndefined();
  });
});
