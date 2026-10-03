import { describe, expect, it } from "vitest";
import { baseGameOtherWorldEncounterRules } from "../../content/src/other-world-encounter-rules.js";
import { parseLocationEncounterInstruction } from "../src/encounter-instructions.js";
import { createDeterministicEngineContext, executeCommand, projectStateForPlayer, resolveOtherWorldEncounter, type GameContent, type GameState } from "../src/index.js";

const ids = ["encounter_other_world_02", "encounter_other_world_01", "encounter_other_world_04", "encounter_other_world_03"];
const content: GameContent = {
  otherWorldEncounters: baseGameOtherWorldEncounterRules, otherWorldEncounterIds: ids,
  conditions: [{ id: "condition_paranoia_01", kind: "paranoia", trait: "madness" }, { id: "condition_paranoia_02", kind: "paranoia", trait: "madness" }],
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
    privateState: { deckOrderById: { "encounter:other_world": [...ids], gates: ["gate_london"] }, tokenPoolById: { "condition:paranoia": ["condition_paranoia_01", "condition_paranoia_02"], clues: clues ? ["clue_b", "clue_c"] : ["clue_a", "clue_b", "clue_c"], clue_discard: [], "held_clues:host": clues ? ["clue_a"] : [], "held_clues:guest": [] } },
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
  it.each(["wrong-phase", "wrong-owner", "monster", "missing-gate", "duplicate-gate", "unknown-gate", "missing-card", "duplicate-card", "akachi", "yog", "asset", "local-asset", "artifact", "card-1", "card-4"])("atomically guards %s before RNG", scenario => {
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
    if (scenario === "card-1" || scenario === "card-4") {
      const top = scenario === "card-1" ? ids[1]! : ids[2]!;
      before.privateState.deckOrderById["encounter:other_world"] = [top, ...ids.filter(id => id !== top)];
    }
    const snapshot = structuredClone(before);
    const guardedContent = scenario === "card-4" ? { ...content, otherWorldEncounters: baseGameOtherWorldEncounterRules.filter(card => card.number !== 4) } : content;
    expect(resolveOtherWorldEncounter(before, "host", "gate_arkham", guardedContent, rng([])).ok).toBe(false); expect(before).toEqual(snapshot);
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

describe("Other World card 4: Lost Carcosa", () => {
  function card4(clues = 0) {
    const before = state(clues);
    before.privateState.deckOrderById["encounter:other_world"] = [ids[2]!, ...ids.filter(id => id !== ids[2])];
    return before;
  }
  function choose(before: GameState, option: string, owner = "host") {
    return executeCommand(JSON.parse(JSON.stringify(before)), owner, { type: "RESOLVE_DECISION", decisionId: before.pendingDecision!.id, selectedOptionIds: [option] }, content, rng([]));
  }
  it.each(["accept", "skip"])("closes before the optional Delay choice and honors %s", option => {
    const before = card4(); const snapshot = structuredClone(before);
    const offered = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6])));
    expect(offered.state.activeGateIds).toEqual([]); expect(offered.state.discardedGateIds).toEqual(["gate_arkham"]);
    expect(offered.state.players[0]?.delayed).toBeFalsy(); expect(offered.state.players[0]?.clues).toBe(0);
    expect(offered.state.activePlayerId).toBe("host"); expect(offered.state.pendingLocationEncounter?.gateClosed).toBe(true);
    expect(offered.state.pendingDecision?.optionLabels?.accept).toContain("Become Delayed");
    expect(choose(offered.state, option, "guest")).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const result = accepted(choose(offered.state, option));
    expect(result.state.players[0]?.delayed ?? false).toBe(option === "accept");
    expect(result.state.players[0]?.clues).toBe(option === "accept" ? 2 : 0);
    expect(result.state.pendingLocationEncounter).toBeUndefined(); expect(result.state.activePlayerId).toBe("guest");
    expect(result.state.privateState.deckOrderById["encounter:other_world"]?.at(-1)).toBe(ids[2]);
    expect(result.state.doom).toBe(15); expect(result.state.stateVersion).toBe(4); expect(before).toEqual(snapshot);
  });
  it.each([1, 6])("retains the Gate after Initial failure and Influence (%i)", die => {
    const result = accepted(resolveOtherWorldEncounter(card4(), "host", "gate_arkham", content, rng([1, die])));
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.discardedGateIds).toEqual([]);
    expect(result.state.doom).toBe(die === 6 ? 15 : 14); expect(result.state.omen).toBe(0);
    expect(result.state.players[0]?.delayed).toBeFalsy(); expect(result.state.players[0]?.clues).toBe(0);
    expect(result.events.filter(event => event.type === "DOOM_ADVANCED")).toEqual(die === 6 ? [] : [{ type: "DOOM_ADVANCED", amount: 1, newDoom: 14 }]);
    expect(result.state.activePlayerId).toBe("guest"); expect(result.state.stateVersion).toBe(3);
  });
  it("does not pay Delay again for an already Delayed investigator", () => {
    const before = card4(); before.players[0]!.delayed = true;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6])));
    expect(result.state.pendingDecision).toBeUndefined(); expect(result.state.players[0]?.clues).toBe(0);
    expect(result.state.players[0]?.delayed).toBe(true); expect(result.state.activeGateIds).toEqual([]);
  });
  it("Mark's accepted optional Delay cost cannot be refused while retaining its reward", () => {
    const before = card4(); before.players[0]!.investigatorId = "mark_harrigan";
    const markContent: GameContent = { ...content, investigators: { ...content.investigators, mark_harrigan: { ...content.investigators.trish_scarborough!, health: 8, sanity: 4 } } };
    const offered = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", markContent, rng([6])));
    const result = accepted(executeCommand(offered.state, "host", { type: "RESOLVE_DECISION", decisionId: offered.state.pendingDecision!.id, selectedOptionIds: ["accept"] }, markContent, rng([])));
    expect(result.state.players[0]).toMatchObject({ delayed: true, clues: 2 }); expect(result.state.pendingDecision).toBeUndefined();
  });
  it("pays Delay even when the finite Clue supply has no reward tokens left", () => {
    const before = card4(); before.privateState.tokenPoolById.clues = []; before.players[1]!.clues = 3; before.privateState.tokenPoolById["held_clues:guest"] = ["clue_a", "clue_b", "clue_c"];
    const offered = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6])));
    const result = accepted(choose(offered.state, "accept"));
    expect(result.state.players[0]).toMatchObject({ delayed: true, clues: 0 });
  });
  it("restores both tests and physical Clue rerolls before the single Doom consequence", () => {
    const initial = accepted(resolveOtherWorldEncounter(card4(1), "host", "gate_arkham", content, rng([1])));
    expect(initial.state.activeTest).toMatchObject({ skill: "lore", modifier: -1, dicePool: 1 });
    const follow = accepted(keep(initial.state, [1]));
    expect(follow.state.activeTest).toMatchObject({ skill: "influence", modifier: 0, dicePool: 1 });
    const result = accepted(executeCommand(JSON.parse(JSON.stringify(follow.state)), "host", { type: "RESOLVE_DECISION", decisionId: follow.state.pendingDecision!.id, selectedOptionIds: ["die-0"] }, content, rng([1])));
    expect(result.state.doom).toBe(14); expect(result.state.players[0]?.clues).toBe(0);
    expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_a"]);
    expect(result.events.filter(event => event.type === "DOOM_ADVANCED")).toHaveLength(1);
  });
  it("Azathoth loses immediately at zero Doom, cycles once, and does not hand off", () => {
    const before = card4(); before.doom = 1;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([1, 1])));
    expect(result.state).toMatchObject({ doom: 0, gameResult: "investigators_lose", activePlayerId: "host" });
    expect(result.state.pendingLocationEncounter).toBeUndefined(); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(result.events).toContainEqual({ type: "GAME_ENDED", result: "investigators_lose", reason: "azathoth_awakened" });
    expect(result.state.privateState.deckOrderById["encounter:other_world"]?.at(-1)).toBe(ids[2]);
    expect(resolveOtherWorldEncounter(result.state, "host", "gate_arkham", content, rng([]))).toMatchObject({ ok: false, error: { code: "GAME_ENDED" } });
  });
  it.each([undefined, NaN, 0, -1, 21, 1.5])("guards invalid Doom %s before RNG or closure", doom => {
    const before = card4(); before.doom = doom; const snapshot = structuredClone(before);
    expect(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([]))).toMatchObject({ ok: false, error: { code: "OMEN_CONTENT_MISSING" } });
    expect(before).toEqual(snapshot);
  });
  it.each(["cthulhu", "shub_niggurath"] as const)("guards %s awakening even on the potentially successful Initial branch", ancientOneId => {
    const before = card4(); before.doom = 1; before.ancientOneId = ancientOneId;
    expect(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([]))).toMatchObject({ ok: false, error: { code: "AWAKENING_UNSUPPORTED" } });
    expect(before.activeGateIds).toEqual(["gate_arkham"]);
  });
  it.each(["cthulhu", "shub_niggurath"] as const)("advances %s Doom safely from 2 to 1 without awakening", ancientOneId => {
    const before = card4(); before.doom = 2; before.ancientOneId = ancientOneId;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([1, 1])));
    expect(result.state.doom).toBe(1); expect(result.state.gameResult).toBeUndefined();
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.activePlayerId).toBe("guest");
  });
  it.each(["missing-ancient", "awakened"])("guards %s before RNG", scenario => {
    const before = card4(); if (scenario === "missing-ancient") before.ancientOneId = undefined; else before.awakened = true;
    expect(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([])).ok).toBe(false);
  });
  it("rejects changed Doom before a restored reroll consumes RNG or a Clue", () => {
    const before = accepted(resolveOtherWorldEncounter(card4(1), "host", "gate_arkham", content, rng([1]))).state;
    before.doom = 1; before.ancientOneId = "cthulhu"; const snapshot = structuredClone(before);
    expect(executeCommand(before, "host", { type: "RESOLVE_DECISION", decisionId: before.pendingDecision!.id, selectedOptionIds: ["die-0"] }, content, rng([]))).toMatchObject({ ok: false, error: { code: "AWAKENING_UNSUPPORTED" } });
    expect(before).toEqual(snapshot);
  });
  it("rejects a restored newly-Delayed payment without granting Clues", () => {
    const offered = accepted(resolveOtherWorldEncounter(card4(), "host", "gate_arkham", content, rng([6]))).state;
    offered.players[0]!.delayed = true; const snapshot = structuredClone(offered);
    expect(choose(offered, "accept").ok).toBe(false); expect(offered).toEqual(snapshot);
  });
});

describe("Other World card 3: City of the Great Race", () => {
  function card3(clues = 0) {
    const before = state(clues);
    before.privateState.deckOrderById["encounter:other_world"] = [ids[3]!, ...ids.slice(0, 3)];
    return before;
  }
  function choose(before: GameState, option: string, owner = "host") {
    return executeCommand(JSON.parse(JSON.stringify(before)), owner, { type: "RESOLVE_DECISION", decisionId: before.pendingDecision!.id, selectedOptionIds: [option] }, content, rng([]));
  }
  it.each([true, false])("closes before follow-up Will, with printed reward only on pass (%s)", pass => {
    const before = card3(); const snapshot = structuredClone(before);
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6, pass ? 6 : 1, 1])));
    expect(result.state.players[0]?.clues).toBe(pass ? 1 : 0);
    expect(result.state.players[0]?.sanity).toBe(5); expect(result.state.activeGateIds).toEqual([]);
    expect(result.state.discardedGateIds).toEqual(["gate_arkham"]); expect(result.state.doom).toBe(15);
    expect(result.state.activePlayerId).toBe("guest"); expect(result.state.stateVersion).toBe(3);
    expect(result.state.privateState.deckOrderById["encounter:other_world"]).toEqual([...ids.slice(0, 3), ids[3]]);
    expect(before).toEqual(snapshot);
  });
  it("resolves unavoidable Initial failure without offering an unaffordable payment", () => {
    const result = accepted(resolveOtherWorldEncounter(card3(), "host", "gate_arkham", content, rng([1])));
    expect(result.state.pendingDecision).toBeUndefined();
    expect(result.state.players[0]).toMatchObject({ sanity: 3, conditionIds: ["condition_paranoia_01"] });
    expect(result.state.privateState.tokenPoolById["condition:paranoia"]).toEqual(["condition_paranoia_02"]);
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.activePlayerId).toBe("guest");
    expect(result.events).toContainEqual({ type: "CONDITION_GAINED", playerId: "host", conditionId: "condition_paranoia" });
  });
  it.each(["accept", "skip"])("restores an owner-only pay-or-penalty choice (%s)", option => {
    const initial = accepted(resolveOtherWorldEncounter(card3(1), "host", "gate_arkham", content, rng([1])));
    expect(initial.state.activeTest).toMatchObject({ skill: "lore", modifier: -1, dicePool: 1 });
    const offered = accepted(keep(initial.state));
    expect(offered.state.pendingDecision?.optionLabels?.skip).toContain("paranoia");
    expect(choose(offered.state, option, "guest")).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const result = accepted(choose(offered.state, option));
    expect(result.state.players[0]?.clues).toBe(option === "accept" ? 0 : 1);
    expect(result.state.players[0]?.sanity).toBe(option === "accept" ? 5 : 3);
    expect(result.state.players[0]?.conditionIds ?? []).toEqual(option === "accept" ? [] : ["condition_paranoia_01"]);
    expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(option === "accept" ? ["clue_a"] : []);
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(result.state.pendingLocationEncounter).toBeUndefined(); expect(result.state.activePlayerId).toBe("guest");
    expect(result.state.stateVersion).toBe(5);
  });
  it("spending the last Clue on a failed reroll makes the penalty unavoidable", () => {
    const initial = accepted(resolveOtherWorldEncounter(card3(1), "host", "gate_arkham", content, rng([1])));
    const result = accepted(executeCommand(initial.state, "host", { type: "RESOLVE_DECISION", decisionId: initial.state.pendingDecision!.id, selectedOptionIds: ["die-0"] }, content, rng([1])));
    expect(result.state.players[0]).toMatchObject({ clues: 0, sanity: 3, conditionIds: ["condition_paranoia_01"] });
    expect(result.state.pendingDecision).toBeUndefined(); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
  });
  it("restores a closed Gate during the Will follow-up and grants only one physical Clue", () => {
    const initial = accepted(resolveOtherWorldEncounter(card3(1), "host", "gate_arkham", content, rng([6])));
    const follow = accepted(keep(initial.state, [6, 1]));
    expect(follow.state.activeTest).toMatchObject({ skill: "will", modifier: 0, dicePool: 2 });
    expect(follow.state.pendingLocationEncounter?.gateClosed).toBe(true);
    const result = accepted(keep(follow.state));
    expect(result.state.players[0]?.clues).toBe(2); expect(result.state.discardedGateIds).toEqual(["gate_arkham"]);
  });
  it.each(["insufficient", "missing-physical", "changed-gate", "forged-option"])("rejects restored invalid payment: %s", field => {
    const initial = accepted(resolveOtherWorldEncounter(card3(1), "host", "gate_arkham", content, rng([1])));
    const before = accepted(keep(initial.state)).state;
    if (field === "insufficient") { before.players[0]!.clues = 0; before.privateState.tokenPoolById["held_clues:host"] = []; }
    if (field === "missing-physical") before.privateState.tokenPoolById["held_clues:host"] = [];
    if (field === "changed-gate") { before.activeGateIds = []; before.discardedGateIds = ["gate_arkham"]; }
    const snapshot = structuredClone(before);
    expect(choose(before, field === "forged-option" ? "gain-clues" : "accept").ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it.each(["owned", "empty", "lethal"])("handles Condition/defeat edge: %s", scenario => {
    const before = card3();
    if (scenario === "owned") { before.players[0]!.conditionIds = ["condition_paranoia_01"]; before.privateState.tokenPoolById["condition:paranoia"] = ["condition_paranoia_02"]; }
    if (scenario === "empty") { before.players[1]!.conditionIds = ["condition_paranoia_01", "condition_paranoia_02"]; before.privateState.tokenPoolById["condition:paranoia"] = []; }
    if (scenario === "lethal") before.players[0]!.sanity = 2;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([1])));
    expect(result.state.players[0]?.conditionIds ?? []).toEqual(scenario === "owned" ? ["condition_paranoia_01"] : []);
    expect(result.state.pendingLocationEncounter).toBeUndefined(); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(Boolean(result.state.pendingDefeat)).toBe(scenario === "lethal");
    expect(result.state.privateState.deckOrderById["encounter:other_world"]?.at(-1)).toBe(ids[3]);
  });
  it("rejects unsupported refusal branches instead of silently dropping them", () => {
    const node = { kind: "optional", cost: [{ kind: "clues", amount: -1 }], reward: { kind: "effects", effects: [] }, decline: { kind: "effects", effects: [{ kind: "spell", amount: 1 }] } };
    expect(parseLocationEncounterInstruction(node)).toBeUndefined();
  });
});
