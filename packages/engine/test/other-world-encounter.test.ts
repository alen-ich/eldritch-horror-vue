import { describe, expect, it } from "vitest";
import { baseGameAssets } from "../../content/src/assets.js";
import { baseGameOtherWorldEncounterRules } from "../../content/src/other-world-encounter-rules.js";
import { parseLocationEncounterInstruction } from "../src/encounter-instructions.js";
import { createDeterministicEngineContext, executeCommand, projectStateForPlayer, resolveOtherWorldEncounter, type GameContent, type GameState } from "../src/index.js";

const ids = ["encounter_other_world_02", "encounter_other_world_01", "encounter_other_world_04", "encounter_other_world_03", "encounter_other_world_05", "encounter_other_world_07", "encounter_other_world_08", "encounter_other_world_09", "encounter_other_world_10", "encounter_other_world_11", "encounter_other_world_12", "encounter_other_world_13", "encounter_other_world_14", "encounter_other_world_15", "encounter_other_world_16", "encounter_other_world_17", "encounter_other_world_18", "encounter_other_world_19"];
const content: GameContent = {
  otherWorldEncounters: baseGameOtherWorldEncounterRules, otherWorldEncounterIds: ids,
  conditions: [{ id: "condition_paranoia_01", kind: "paranoia", trait: "madness" }, { id: "condition_paranoia_02", kind: "paranoia", trait: "madness" }, { id: "condition_hallucinations_01", kind: "hallucinations", trait: "madness" }, { id: "condition_amnesia_01", kind: "amnesia", trait: "madness" }],
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

describe("Other World card 19: City of the Great Race", () => {
  function card19(clues = 0) {
    const before = state(clues);
    before.privateState.deckOrderById["encounter:other_world"] = [ids[17]!, ...ids.filter(id => id !== ids[17])];
    return before;
  }
  function choose(before: GameState, selection: string[] = [], dice: number[] = [], owner = "host") {
    return executeCommand(JSON.parse(JSON.stringify(before)), owner, { type: "RESOLVE_DECISION", decisionId: before.pendingDecision!.id, selectedOptionIds: selection }, content, rng(dice));
  }
  function offer() { return accepted(resolveOtherWorldEncounter(card19(), "host", "gate_arkham", content, rng([1]))).state; }
  function lore() { return accepted(resolveOtherWorldEncounter(card19(), "host", "gate_arkham", content, rng([6, 1]))).state; }
  it.each([true, false])("reward precedes Lore -1 and survives its final outcome (%s)", pass => {
    const before = card19(); const snapshot = structuredClone(before);
    const follow = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6, pass ? 6 : 1])));
    expect(follow.state.activeTest).toMatchObject({ skill: "lore", modifier: -1, dicePool: 1 });
    expect(follow.state.players[0]?.clues).toBe(2); expect(follow.state.privateState.tokenPoolById["held_clues:host"]).toEqual(["clue_a", "clue_b"]);
    expect(follow.state.activeGateIds).toEqual(["gate_arkham"]); expect(follow.events.findIndex(event => event.type === "CLUE_GAINED")).toBeLessThan(follow.events.findIndex(event => event.type === "TEST_ROLLED"));
    const result = accepted(choose(follow.state));
    expect(result.state.players[0]).toMatchObject({ health: 7, sanity: pass ? 5 : 4, clues: 2 });
    expect(result.state.activeGateIds).toEqual(pass ? [] : ["gate_arkham"]); expect(result.state.activePlayerId).toBe("guest");
    expect(result.state.players[0]?.conditionIds ?? []).toEqual([]); expect(result.state.pendingLocationEncounter).toBeUndefined();
    expect(result.state.privateState.deckOrderById["encounter:other_world"]).toEqual([...ids.filter(id => id !== ids[17]), ids[17]]); expect(before).toEqual(snapshot);
  });
  it("newly awarded Clues fund repeated restored Lore rerolls before exact closure", () => {
    const before = lore(); const snapshot = structuredClone(before);
    expect(choose(before, ["die-0"], [6], "guest")).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const once = accepted(choose(before, ["die-0"], [1]));
    expect(once.state.players[0]?.clues).toBe(1); expect(once.state.activeTest?.dicePool).toBe(1);
    const result = accepted(choose(once.state, ["die-0"], [6]));
    expect(result.state.players[0]).toMatchObject({ clues: 0, sanity: 5 }); expect(result.state.activeGateIds).toEqual([]);
    expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_a", "clue_b"]); expect(before).toEqual(snapshot);
  });
  it("Initial reroll success gains two Clues before Lore, not before Influence", () => {
    const initial = accepted(resolveOtherWorldEncounter(card19(1), "host", "gate_arkham", content, rng([1])));
    expect(initial.state.activeTest).toMatchObject({ skill: "influence", modifier: 0, dicePool: 1 }); expect(initial.state.players[0]?.clues).toBe(1);
    const follow = accepted(choose(initial.state, ["die-0"], [6, 1]));
    expect(follow.state.players[0]?.clues).toBe(2); expect(follow.state.activeTest).toMatchObject({ skill: "lore", modifier: -1 });
    expect(follow.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_a"]);
  });
  it.each([0, 1])("depleted supply grants only %i available Clues and still tests Lore", available => {
    const before = card19(); before.privateState.tokenPoolById.clues = available ? ["clue_a"] : [];
    const held = available ? ["clue_b", "clue_c"] : ["clue_a", "clue_b", "clue_c"];
    before.players[1]!.clues = held.length; before.privateState.tokenPoolById["held_clues:guest"] = held;
    const rolled = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6, 6])));
    const result = available ? accepted(choose(rolled.state)) : rolled;
    expect(result.state.players[0]?.clues).toBe(available); expect(result.state.activeGateIds).toEqual([]);
    expect(result.state.privateState.tokenPoolById["held_clues:host"]).toHaveLength(available);
  });
  it("reward recycles discarded Clues without collecting a board Clue", () => {
    const before = card19(); before.privateState.tokenPoolById.clues = []; before.privateState.tokenPoolById.clue_discard = ["clue_a", "clue_b"];
    before.boardClues = [{ id: "marker", locationId: "arkham" }]; before.privateState.tokenPoolById["board_clue:marker"] = ["clue_c"];
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, createDeterministicEngineContext({ dice: [6, 1], shuffleIndexes: [0], tokenIndexes: [0, 0], ids: ["test", "decision"] })));
    expect(result.state.players[0]?.clues).toBe(2); expect(result.state.privateState.tokenPoolById.clue_discard).toEqual([]);
    expect(result.state.boardClues).toEqual(before.boardClues); expect(result.state.privateState.tokenPoolById["board_clue:marker"]).toEqual(["clue_c"]);
  });
  it.each(["accept", "skip"])("Delay %s avoids both penalties or gains Paranoia before Sanity loss", option => {
    const before = offer(); const snapshot = structuredClone(before);
    expect(before.pendingDecision?.optionIds).toEqual(["accept", "skip"]); expect(before.players[0]?.clues).toBe(0);
    const result = accepted(choose(before, [option]));
    expect(result.state.players[0]).toMatchObject({ health: 7, sanity: option === "accept" ? 5 : 4, clues: 0 });
    expect(result.state.players[0]?.delayed ?? false).toBe(option === "accept");
    expect(result.state.players[0]?.conditionIds ?? []).toEqual(option === "accept" ? [] : ["condition_paranoia_01"]);
    if (option === "skip") expect(result.events.findIndex(event => event.type === "CONDITION_GAINED")).toBeLessThan(result.events.findIndex(event => event.type === "INVESTIGATOR_DAMAGED"));
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.activePlayerId).toBe("guest");
    expect(JSON.stringify(projectStateForPlayer(result.state, "guest"))).not.toContain("condition_paranoia_01"); expect(before).toEqual(snapshot);
  });
  it("already Delayed cannot pay again and takes both consequences without an offer", () => {
    const before = card19(); before.players[0]!.delayed = true;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([1])));
    expect(result.state.players[0]).toMatchObject({ delayed: true, sanity: 4, conditionIds: ["condition_paranoia_01"] }); expect(result.state.pendingDecision).toBeUndefined();
  });
  it.each(["accept", "skip"])("Mark's chosen %s preserves the actual Delay cost, with no free prevention", option => {
    const before = offer(); before.players[0]!.investigatorId = "mark_harrigan";
    const result = accepted(choose(before, [option])); expect(result.state.pendingDecision).toBeUndefined();
    expect(result.state.players[0]?.delayed ?? false).toBe(option === "accept"); expect(result.state.players[0]?.sanity).toBe(option === "accept" ? 5 : 4);
  });
  it.each(["held", "empty"])("%s Paranoia does not skip the Sanity penalty", kind => {
    const before = offer();
    if (kind === "held") { before.players[0]!.conditionIds = ["condition_paranoia_01"]; before.privateState.tokenPoolById["condition:paranoia"] = ["condition_paranoia_02"]; }
    else before.privateState.tokenPoolById["condition:paranoia"] = [];
    const result = accepted(choose(before, ["skip"])); expect(result.state.players[0]?.sanity).toBe(4);
    expect(result.state.players[0]?.conditionIds ?? []).toEqual(kind === "held" ? ["condition_paranoia_01"] : []);
  });
  it.each(["missing", "unknown", "duplicate", "overlap"])("invalid Paranoia %s rejects before Initial dice and restored payment", field => {
    const mutate = (before: GameState) => {
      if (field === "missing") delete before.privateState.tokenPoolById["condition:paranoia"];
      if (field === "unknown") before.privateState.tokenPoolById["condition:paranoia"] = ["unknown"];
      if (field === "duplicate") before.privateState.tokenPoolById["condition:paranoia"] = ["condition_paranoia_01", "condition_paranoia_01"];
      if (field === "overlap") before.players[1]!.conditionIds = ["condition_paranoia_01"];
    };
    const before = card19(); mutate(before); const snapshot = structuredClone(before);
    expect(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([])).ok).toBe(false); expect(before).toEqual(snapshot);
    const restored = offer(); mutate(restored); const restoredSnapshot = structuredClone(restored);
    expect(choose(restored, ["accept"]).ok).toBe(false); expect(restored).toEqual(restoredSnapshot);
  });
  it.each(["gate", "location", "deck", "delay", "asset", "option"])("restored avoidance rejects changed %s atomically", field => {
    const before = offer();
    if (field === "gate") { before.activeGateIds = []; before.discardedGateIds = ["gate_arkham"]; }
    if (field === "location") before.players[0]!.locationId = "london";
    if (field === "deck") before.privateState.deckOrderById["encounter:other_world"]!.reverse();
    if (field === "delay") before.players[0]!.delayed = true;
    if (field === "asset") before.players[0]!.assetIds = ["unsupported"];
    const snapshot = structuredClone(before);
    expect(choose(before, [field === "option" ? "close" : "accept"]).ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it.each(["count", "held", "gate", "card"])("new-Clue restored reroll rejects changed %s without spending", field => {
    const before = lore();
    if (field === "count") before.players[0]!.clues = 0;
    if (field === "held") before.privateState.tokenPoolById["held_clues:host"] = [];
    if (field === "gate") { before.activeGateIds = []; before.discardedGateIds = ["gate_arkham"]; }
    if (field === "card") before.currentLocationEncounterCardId = ids[0];
    const snapshot = structuredClone(before); expect(choose(before, ["die-0"]).ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it.each(["lore", "refusal"])("lethal %s stops handoff and cycles exactly once", path => {
    const before = path === "lore" ? lore() : offer(); before.players[0]!.sanity = 1;
    const result = accepted(choose(before, path === "lore" ? [] : ["skip"]));
    expect(result.state.pendingDefeat).toBeDefined(); expect(result.state.players[0]?.sanity).toBe(0); expect(result.state.activePlayerId).toBe("host");
    expect(result.state.players[0]?.clues).toBe(path === "lore" ? 2 : 0);
    if (path === "refusal") expect(result.events.findIndex(event => event.type === "CONDITION_GAINED")).toBeLessThan(result.events.findIndex(event => event.type === "INVESTIGATOR_DEFEATED"));
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.pendingLocationEncounter).toBeUndefined();
    expect(result.state.privateState.deckOrderById["encounter:other_world"]).toEqual([...ids.filter(id => id !== ids[17]), ids[17]]);
  });
  it("Delay acceptance avoids otherwise lethal Sanity loss", () => {
    const before = offer(); before.players[0]!.sanity = 1;
    const result = accepted(choose(before, ["accept"])); expect(result.state.players[0]).toMatchObject({ sanity: 1, delayed: true }); expect(result.state.pendingDefeat).toBeUndefined();
  });
  it.each(["lore", "refusal"])("Azathoth loses on lethal %s at Doom 1", path => {
    const before = path === "lore" ? lore() : offer(); before.players[0]!.sanity = 1; before.doom = 1;
    const result = accepted(choose(before, path === "lore" ? [] : ["skip"])); expect(result.state.gameResult).toBe("investigators_lose"); expect(result.state.activePlayerId).toBe("host");
  });
  it("unsupported awakening rejects the restored penalty without taking its Condition", () => {
    const before = offer(); before.players[0]!.sanity = 1; before.doom = 1; before.ancientOneId = "cthulhu";
    const snapshot = structuredClone(before); expect(choose(before, ["skip"]).ok).toBe(false); expect(before).toEqual(snapshot);
  });
});

describe("Other World card 18: The Underworld", () => {
  const leg1 = "condition_leg_injury_01", leg2 = "condition_leg_injury_02", back = "condition_back_injury_01";
  const itemContent: GameContent = { ...content, assets: baseGameAssets, conditions: [...content.conditions!,
    { id: leg1, kind: "leg_injury", trait: "injury" }, { id: leg2, kind: "leg_injury", trait: "injury" }, { id: back, kind: "back_injury", trait: "injury" }] };
  function card18(items: string[] = [], clues = 0) {
    const before = state(clues); before.players[0]!.assetIds = [...items];
    before.privateState.deckOrderById["encounter:other_world"] = [ids[16]!, ...ids.filter(id => id !== ids[16])];
    before.privateState.tokenPoolById["condition:leg_injury"] = [leg1, leg2]; before.privateState.tokenPoolById["condition:back_injury"] = [back];
    return before;
  }
  function resolve(before: GameState, dice: number[], tokenIndexes = [0]) {
    return resolveOtherWorldEncounter(before, "host", "gate_arkham", itemContent, createDeterministicEngineContext({ dice, tokenIndexes, ids: ["initial", "choice", "follow", "later"] }));
  }
  function choose(before: GameState, selection: string[] = [], dice: number[] = [], owner = "host") {
    return executeCommand(JSON.parse(JSON.stringify(before)), owner, { type: "RESOLVE_DECISION", decisionId: before.pendingDecision!.id, selectedOptionIds: selection }, itemContent, rng(dice));
  }
  function offer(items = ["asset_38_revolver", "asset_45_automatic"]) { return accepted(resolve(card18(items), [1])).state; }
  it.each([true, false])("Initial success tests Will and closes only on its success (%s)", pass => {
    const initial = accepted(resolve(card18([], 1), [6]));
    expect(initial.state.activeTest).toMatchObject({ skill: "influence", modifier: 0 });
    const follow = accepted(choose(initial.state, [], pass ? [6, 6] : [1, 1]));
    expect(follow.state.activeTest).toMatchObject({ skill: "will", modifier: 0, dicePool: 2 });
    expect(follow.state.activeGateIds).toEqual(["gate_arkham"]);
    const result = accepted(choose(follow.state));
    expect(result.state.activeGateIds).toEqual(pass ? [] : ["gate_arkham"]);
    expect(result.state.players[0]).toMatchObject({ health: 7, sanity: pass ? 5 : 4, clues: 1 });
    expect(result.state.players[0]?.conditionIds ?? []).toEqual([]); expect(result.state.activePlayerId).toBe("guest");
  });
  it.each(["asset_38_revolver", "asset_45_automatic"])("owner selects exactly one physical Item (%s), payment precedes closure", id => {
    const before = offer(); const snapshot = structuredClone(before);
    expect(before.pendingDecision?.optionIds).toEqual(["asset_38_revolver", "asset_45_automatic", "skip"]);
    expect(choose(before, [id], [], "guest")).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const result = accepted(choose(before, [id]));
    expect(result.state.players[0]?.assetIds).toEqual(snapshot.players[0]!.assetIds.filter(candidate => candidate !== id));
    expect(result.state.assetDiscardIds).toEqual([id]); expect(result.state.activeGateIds).toEqual([]);
    expect(result.state.players[0]).toMatchObject({ health: 7, sanity: 5 }); expect(result.state.players[0]?.conditionIds ?? []).toEqual([]);
    expect(result.events.findIndex(event => event.type === "ASSET_DISCARDED")).toBeLessThan(result.events.findIndex(event => event.type === "GATE_CLOSED"));
    expect(result.state.pendingLocationEncounter).toBeUndefined(); expect(result.state.activePlayerId).toBe("guest");
    expect(result.state.privateState.deckOrderById["encounter:other_world"]).toEqual([...ids.filter(id => id !== ids[16]), ids[16]]); expect(before).toEqual(snapshot);
  });
  it("refusal retains Items, loses Health then privately draws an Injury", () => {
    const result = accepted(choose(offer(), ["skip"]));
    expect(result.state.players[0]).toMatchObject({ health: 6, sanity: 5, assetIds: ["asset_38_revolver", "asset_45_automatic"], conditionIds: [leg1] });
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.assetDiscardIds).toEqual([]);
    expect(result.state.privateState.tokenPoolById["condition:leg_injury"]).toEqual([leg2]);
    expect(result.events.at(-2)).toMatchObject({ type: "CONDITION_GAINED", conditionId: "condition_leg_injury" });
    expect(JSON.stringify(projectStateForPlayer(result.state, "guest"))).not.toContain(leg1);
  });
  it.each([{ assets: [] }, { assets: ["asset_puzzle_box"] }, { assets: ["asset_witch_doctor"] }])("no Item cannot pay, including a non-Item Asset ($assets)", ({ assets }) => {
    const result = accepted(resolve(card18(assets), [1]));
    expect(result.state.players[0]).toMatchObject({ health: 6, sanity: 5, assetIds: assets, conditionIds: [leg1] });
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.pendingDecision).toBeUndefined();
  });
  it("trait draw includes all available Injury copies, not a hard-coded named Injury", () => {
    const result = accepted(resolve(card18(), [1], [2])); expect(result.state.players[0]?.conditionIds).toEqual([back]);
  });
  it("empty initialized Injury supply grants nothing after Health loss", () => {
    const before = card18(); before.privateState.tokenPoolById["condition:leg_injury"] = []; before.privateState.tokenPoolById["condition:back_injury"] = [];
    const result = accepted(resolve(before, [1])); expect(result.state.players[0]?.health).toBe(6); expect(result.state.players[0]?.conditionIds ?? []).toEqual([]);
  });
  it("drawing an already held kind does not duplicate it or substitute another kind", () => {
    const before = card18(); before.players[0]!.conditionIds = [leg1]; before.privateState.tokenPoolById["condition:leg_injury"] = [leg2];
    const result = accepted(resolve(before, [1])); expect(result.state.players[0]?.conditionIds).toEqual([leg1]);
    expect(result.state.privateState.tokenPoolById["condition:leg_injury"]).toEqual([leg2]);
  });
  it("a different held Injury does not prevent gaining the drawn kind", () => {
    const before = card18(); before.players[0]!.conditionIds = [back]; before.privateState.tokenPoolById["condition:back_injury"] = [];
    expect(accepted(resolve(before, [1])).state.players[0]?.conditionIds).toEqual([back, leg1]);
  });
  it.each(["missing", "unknown", "wrong-kind", "duplicate", "held-overlap", "unknown-held"])("invalid Injury %s rejects before Initial RNG and restored payment", field => {
    const mutate = (before: GameState) => {
      if (field === "missing") delete before.privateState.tokenPoolById["condition:back_injury"];
      if (field === "unknown") before.privateState.tokenPoolById["condition:leg_injury"] = ["unknown"];
      if (field === "wrong-kind") before.privateState.tokenPoolById["condition:leg_injury"] = [back];
      if (field === "duplicate") before.privateState.tokenPoolById["condition:leg_injury"] = [leg1, leg1];
      if (field === "held-overlap") before.players[1]!.conditionIds = [leg1];
      if (field === "unknown-held") before.players[0]!.conditionIds = ["unknown"];
    };
    const before = card18(); mutate(before); const snapshot = structuredClone(before);
    expect(resolve(before, []).ok).toBe(false); expect(before).toEqual(snapshot);
    const restored = offer(); mutate(restored); const restoredSnapshot = structuredClone(restored);
    expect(choose(restored, ["asset_38_revolver"]).ok).toBe(false); expect(restored).toEqual(restoredSnapshot);
  });
  it.each(["missing", "other-seat", "deck", "reserve", "discard", "sheet", "gate", "location", "non-item", "accept"])("restored Item choice rejects changed %s atomically", field => {
    const before = offer();
    if (field === "missing") before.players[0]!.assetIds = [];
    if (field === "other-seat") { before.players[0]!.assetIds = []; before.players[1]!.assetIds = ["asset_38_revolver"]; }
    if (field === "deck") before.privateState.deckOrderById.assets = ["asset_38_revolver"];
    if (field === "reserve") before.reserveAssetIds = ["asset_38_revolver"];
    if (field === "discard") before.assetDiscardIds = ["asset_38_revolver"];
    if (field === "sheet") before.defeatedInvestigators = [{ investigatorId: "mark_harrigan", locationId: "london", cause: "health", assetIds: ["asset_38_revolver"], clues: 0, travelTickets: [] }];
    if (field === "gate") { before.activeGateIds = []; before.discardedGateIds = ["gate_arkham"]; }
    if (field === "location") before.players[0]!.locationId = "london";
    const snapshot = structuredClone(before);
    expect(choose(before, [field === "non-item" ? "asset_fine_clothes" : field === "accept" ? "accept" : "asset_38_revolver"]).ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it.each(["asset_personal_assistant", "asset_bandages", "artifact_gate_box", "artifact_the_silver_key"])("applicable possession %s remains guarded before RNG", id => {
    const before = card18(); if (id.startsWith("asset_")) before.players[0]!.assetIds = [id]; else before.players[0]!.artifactIds = [id];
    expect(resolve(before, []).ok).toBe(false);
  });
  it("a colleague's Item is not offered for the actor's payment", () => {
    const before = card18(); before.players[1]!.locationId = "arkham"; before.players[1]!.assetIds = ["asset_38_revolver"];
    const result = accepted(resolve(before, [1])); expect(result.state.players[0]?.health).toBe(6); expect(result.state.players[1]?.assetIds).toEqual(["asset_38_revolver"]);
  });
  it("final-Clue reroll failure continues to Item payment without a new test", () => {
    const initial = accepted(resolve(card18(["asset_38_revolver"], 1), [1]));
    const follow = accepted(choose(initial.state, ["die-0"], [1]));
    expect(follow.state.players[0]?.clues).toBe(0); expect(follow.state.pendingDecision?.optionIds).toEqual(["asset_38_revolver", "skip"]);
    expect(accepted(choose(follow.state, ["asset_38_revolver"])).state.activeGateIds).toEqual([]);
  });
  it.each(["no-item", "refusal", "will"])("lethal %s stops before Injury and handoff, cycling once", path => {
    const before = card18(path === "refusal" ? ["asset_38_revolver"] : []); before.players[0]!.health = 1; before.players[0]!.sanity = 1;
    let result = accepted(resolve(before, path === "will" ? [6, 1, 1] : [1]));
    if (path === "refusal") result = accepted(choose(result.state, ["skip"]));
    expect(result.state.pendingDefeat).toBeDefined(); expect(result.state.players[0]?.conditionIds ?? []).toEqual([]);
    expect(result.state.activePlayerId).toBe("host"); expect(result.state.pendingLocationEncounter).toBeUndefined();
    expect(result.state.privateState.deckOrderById["encounter:other_world"]).toEqual([...ids.filter(id => id !== ids[16]), ids[16]]);
  });
  it("one Health can still pay an Item and close without damage", () => {
    const before = offer(); before.players[0]!.health = 1;
    const result = accepted(choose(before, ["asset_38_revolver"])); expect(result.state.players[0]?.health).toBe(1); expect(result.state.activeGateIds).toEqual([]);
  });
  it("multiple selections cannot pay twice or combine payment with refusal", () => {
    const before = offer(); const snapshot = structuredClone(before);
    expect(choose(before, ["asset_38_revolver", "skip"]).ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it("duplicate irrelevant Item rejects before Initial RNG", () => {
    const before = card18(["asset_38_revolver"]); before.reserveAssetIds = ["asset_38_revolver"];
    const snapshot = structuredClone(before); expect(resolve(before, []).ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it.each(["missing", "duplicate"])("Injury catalog %s rejects before RNG", problem => {
    const invalidContent = { ...itemContent, conditions: problem === "missing" ? content.conditions : [...itemContent.conditions!, itemContent.conditions!.at(-1)!] };
    expect(resolveOtherWorldEncounter(card18(), "host", "gate_arkham", invalidContent, rng([])).ok).toBe(false);
  });
  it("Azathoth lethal refusal ends the game without drawing Injury", () => {
    const before = offer(); before.doom = 1; before.players[0]!.health = 1;
    const result = accepted(choose(before, ["skip"])); expect(result.state.gameResult).toBe("investigators_lose");
    expect(result.state.players[0]?.conditionIds ?? []).toEqual([]); expect(result.state.activePlayerId).toBe("host");
  });
  it("unsupported awakening rejects restored refusal without damage or Injury", () => {
    const before = offer(); before.doom = 1; before.ancientOneId = "cthulhu"; before.players[0]!.health = 1;
    const snapshot = structuredClone(before); expect(choose(before, ["skip"]).ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it("Item cost parser rejects mixed and multi-card costs instead of partial payment", () => {
    const node = { kind: "optional", cost: [{ kind: "discard_item_assets", amount: 1 }], reward: { kind: "effects", effects: [] } };
    expect(parseLocationEncounterInstruction(node)).toBeDefined();
    expect(parseLocationEncounterInstruction({ ...node, cost: [{ kind: "discard_item_assets", amount: 2 }] })).toBeUndefined();
    expect(parseLocationEncounterInstruction({ ...node, cost: [...node.cost, { kind: "clues", amount: -1 }] })).toBeUndefined();
  });
});

describe("Other World card 17: Lost Carcosa", () => {
  function card17(clues = 0) {
    const before = state(clues);
    before.privateState.deckOrderById["encounter:other_world"] = [ids[15]!, ...ids.filter(id => id !== ids[15])];
    return before;
  }
  it.each([true, false])("Initial pass %s selects Lore modifier and closes only on final success", pass => {
    const initial = accepted(resolveOtherWorldEncounter(card17(1), "host", "gate_arkham", content, rng(pass ? [6, 6] : [1, 1])));
    expect(initial.state.activeTest).toMatchObject({ skill: "will", modifier: 0 });
    const follow = accepted(keep(initial.state, [6]));
    expect(follow.state.activeTest).toMatchObject({ skill: "lore", modifier: pass ? 0 : -1, dicePool: 1 });
    expect(follow.state.activeGateIds).toEqual(["gate_arkham"]); const snapshot = structuredClone(follow.state);
    expect(keep(follow.state, [], "guest")).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const result = accepted(keep(follow.state));
    expect(result.state.activeGateIds).toEqual([]); expect(result.state.players[0]).toMatchObject({ health: 7, sanity: 5, clues: 1 });
    expect(result.events.filter(event => event.type === "GATE_CLOSED")).toHaveLength(1);
    expect(result.state.pendingLocationEncounter).toBeUndefined(); expect(result.state.activePlayerId).toBe("guest"); expect(follow.state).toEqual(snapshot);
    expect(result.state.stateVersion).toBe(follow.state.stateVersion + 1);
    expect(result.state.privateState.deckOrderById["encounter:other_world"]).toEqual([...ids.filter(id => id !== ids[15]), ids[15]]);
  });
  it.each([true, false])("failed Lore after Initial pass %s loses only the printed resource", pass => {
    const before = card17(); const snapshot = structuredClone(before);
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng(pass ? [6, 6, 1] : [1, 1, 1])));
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(result.state.players[0]).toMatchObject({ health: pass ? 7 : 5, sanity: pass ? 4 : 5 });
    expect(result.state.players[0]?.delayed).toBeFalsy(); expect(result.state.players[0]?.conditionIds ?? []).toEqual([]); expect(before).toEqual(snapshot);
  });
  it.each([true, false])("restored Lore reroll closes on either branch (%s)", pass => {
    const initial = accepted(resolveOtherWorldEncounter(card17(1), "host", "gate_arkham", content, rng(pass ? [6, 6] : [1, 1])));
    const follow = accepted(keep(initial.state, [1]));
    const result = accepted(executeCommand(JSON.parse(JSON.stringify(follow.state)), "host", { type: "RESOLVE_DECISION", decisionId: follow.state.pendingDecision!.id, selectedOptionIds: ["die-0"] }, content, rng([6])));
    expect(result.state.players[0]?.clues).toBe(0); expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_a"]);
    expect(result.state.activeGateIds).toEqual([]); expect(result.state.players[0]).toMatchObject({ health: 7, sanity: 5 });
  });
  it("final-Clue failed Initial reroll resolves discounted Lore without a second payment", () => {
    const initial = accepted(resolveOtherWorldEncounter(card17(1), "host", "gate_arkham", content, rng([1, 1])));
    const result = accepted(executeCommand(JSON.parse(JSON.stringify(initial.state)), "host", { type: "RESOLVE_DECISION", decisionId: initial.state.pendingDecision!.id, selectedOptionIds: ["die-0"] }, content, rng([1, 1])));
    expect(result.state.players[0]).toMatchObject({ clues: 0, health: 5, sanity: 5 });
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.pendingDecision).toBeUndefined();
  });
  it.each([1, 2])("lethal discounted Lore failure at Health %i stops handoff and cycles once", health => {
    const before = card17(); before.players[0]!.health = health;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([1, 1, 1])));
    expect(result.state.players[0]).toMatchObject({ health: 0, sanity: 5 }); expect(result.state.pendingDefeat).toBeDefined();
    expect(result.state.pendingLocationEncounter).toBeUndefined(); expect(result.state.activePlayerId).toBe("host"); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(result.state.privateState.deckOrderById["encounter:other_world"]).toEqual([...ids.filter(id => id !== ids[15]), ids[15]]);
  });
  it("lethal successful-Initial branch loses Sanity without closing", () => {
    const before = card17(); before.players[0]!.sanity = 1;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6, 6, 1])));
    expect(result.state.players[0]).toMatchObject({ health: 7, sanity: 0 }); expect(result.state.pendingDefeat).toBeDefined();
    expect(result.state.activePlayerId).toBe("host"); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
  });
  it.each([true, false])("Azathoth loses at Doom 1 on either lethal branch (%s)", pass => {
    const before = card17(); before.doom = 1; before.players[0]!.health = 2; before.players[0]!.sanity = 1;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng(pass ? [6, 6, 1] : [1, 1, 1])));
    expect(result.state.gameResult).toBe("investigators_lose"); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(result.state.activePlayerId).toBe("host"); expect(result.state.pendingLocationEncounter).toBeUndefined();
  });
  it.each(["gate", "location", "deck", "clues", "held", "asset", "option"])("rejects changed restored Lore %s atomically", field => {
    const initial = accepted(resolveOtherWorldEncounter(card17(1), "host", "gate_arkham", content, rng([6, 6])));
    const before = accepted(keep(initial.state, [1])).state;
    if (field === "gate") { before.activeGateIds = []; before.discardedGateIds = ["gate_arkham"]; }
    if (field === "location") before.players[0]!.locationId = "london";
    if (field === "deck") before.privateState.deckOrderById["encounter:other_world"]!.reverse();
    if (field === "clues") before.players[0]!.clues = 0;
    if (field === "held") before.privateState.tokenPoolById["held_clues:host"] = [];
    if (field === "asset") before.players[0]!.assetIds = ["unsupported"];
    const snapshot = structuredClone(before);
    expect(executeCommand(before, "host", { type: "RESOLVE_DECISION", decisionId: before.pendingDecision!.id, selectedOptionIds: [field === "option" ? "close" : "die-0"] }, content, rng([])).ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it.each([true, false])("guards unsupported awakening on either restored Lore failure (%s)", pass => {
    const initial = accepted(resolveOtherWorldEncounter(card17(1), "host", "gate_arkham", content, rng(pass ? [6, 6] : [1, 1])));
    const before = accepted(keep(initial.state, [1])).state;
    before.players[0]!.health = 2; before.players[0]!.sanity = 1; before.doom = 1; before.ancientOneId = "cthulhu";
    const snapshot = structuredClone(before); expect(keep(before).ok).toBe(false); expect(before).toEqual(snapshot);
  });
});

describe("Other World card 16: Great Hall of Celaeno", () => {
  function card16(clues = 0) {
    const before = state(clues);
    before.privateState.deckOrderById["encounter:other_world"] = [ids[14]!, ...ids.filter(id => id !== ids[14])];
    return before;
  }
  function offer() { return accepted(keep(accepted(resolveOtherWorldEncounter(card16(1), "host", "gate_arkham", content, rng([1, 1]))).state)).state; }
  function choose(before: GameState, option: string, dice: number[] = [], owner = "host") {
    return executeCommand(JSON.parse(JSON.stringify(before)), owner, { type: "RESOLVE_DECISION", decisionId: before.pendingDecision!.id, selectedOptionIds: [option] }, content, rng(dice));
  }
  it.each(["accept", "skip"])("restores direct closure payment (%s), otherwise Delays and retains Gate", option => {
    const before = offer(); const snapshot = structuredClone(before);
    expect(before.pendingDecision?.kind).toBe("encounter_choice");
    expect(choose(before, option, [], "guest")).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const result = accepted(choose(before, option));
    expect(result.state.activeGateIds).toEqual(option === "accept" ? [] : ["gate_arkham"]);
    expect(result.state.players[0]?.clues).toBe(option === "accept" ? 0 : 1);
    expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(option === "accept" ? ["clue_a"] : []);
    expect(result.state.players[0]?.delayed ?? false).toBe(option === "skip");
    expect(result.state.players[0]).toMatchObject({ health: 7, sanity: 5 }); expect(result.state.players[0]?.conditionIds ?? []).toEqual([]);
    expect(result.events.filter(event => event.type === "GATE_CLOSED")).toHaveLength(option === "accept" ? 1 : 0);
    expect(result.state.activePlayerId).toBe("guest"); expect(result.state.pendingLocationEncounter).toBeUndefined();
    expect(result.state.stateVersion).toBe(before.stateVersion + 1); expect(before).toEqual(snapshot);
    expect(result.state.privateState.deckOrderById["encounter:other_world"]).toEqual([...ids.filter(id => id !== ids[14]), ids[14]]);
  });
  it.each([1, 6])("Lore %i closes on success or loses exactly one Sanity", die => {
    const result = accepted(resolveOtherWorldEncounter(card16(), "host", "gate_arkham", content, rng([6, 6, die])));
    expect(result.state.activeGateIds).toEqual(die === 6 ? [] : ["gate_arkham"]);
    expect(result.state.players[0]).toMatchObject({ health: 7, sanity: die === 6 ? 5 : 4 });
    expect(result.state.players[0]?.delayed).toBeFalsy(); expect(result.state.players[0]?.conditionIds ?? []).toEqual([]);
  });
  it("no Clues automatically Delays without another roll or closure", () => {
    const result = accepted(resolveOtherWorldEncounter(card16(), "host", "gate_arkham", content, rng([1, 1])));
    expect(result.state.players[0]).toMatchObject({ delayed: true, sanity: 5 }); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(result.state.pendingDecision).toBeUndefined();
  });
  it.each([1, 6])("last-Clue Initial reroll %i cannot also buy direct closure", die => {
    const initial = accepted(resolveOtherWorldEncounter(card16(1), "host", "gate_arkham", content, rng([1, 1])));
    const result = accepted(choose(initial.state, "die-0", die === 6 ? [6, 6] : [1]));
    expect(result.state.players[0]?.clues).toBe(0); expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_a"]);
    expect(result.state.activeGateIds).toEqual(die === 6 ? [] : ["gate_arkham"]); expect(result.state.players[0]?.delayed ?? false).toBe(die === 1);
    expect(result.state.pendingDecision).toBeUndefined();
  });
  it("restores independent Will and Lore checkpoints and closes after a Lore reroll", () => {
    const initial = accepted(resolveOtherWorldEncounter(card16(1), "host", "gate_arkham", content, rng([6, 6])));
    expect(initial.state.activeTest).toMatchObject({ skill: "will", modifier: 0 });
    const follow = accepted(keep(initial.state, [1]));
    expect(follow.state.activeTest).toMatchObject({ skill: "lore", modifier: 0 }); expect(follow.state.activeGateIds).toEqual(["gate_arkham"]);
    const result = accepted(choose(follow.state, "die-0", [6]));
    expect(result.state.activeGateIds).toEqual([]); expect(result.state.players[0]?.clues).toBe(0);
  });
  it.each(["accept", "skip"])("already Delayed may %s payment without losing Sanity", option => {
    const before = offer(); before.players[0]!.delayed = true;
    const result = accepted(choose(before, option));
    expect(result.state.players[0]).toMatchObject({ delayed: true, sanity: 5 });
    expect(result.state.activeGateIds).toEqual(option === "accept" ? [] : ["gate_arkham"]);
  });
  it.each(["accept", "refuse"])("Mark may %s mandatory Delay after refusing direct closure", option => {
    const before = card16(); before.players[0]!.investigatorId = "mark_harrigan";
    const markContent: GameContent = { ...content, investigators: { ...content.investigators, mark_harrigan: content.investigators.trish_scarborough! } };
    const offered = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", markContent, rng([1, 1])));
    expect(offered.state.pendingDecision?.kind).toBe("encounter_choice");
    const result = accepted(executeCommand(JSON.parse(JSON.stringify(offered.state)), "host", { type: "RESOLVE_DECISION", decisionId: offered.state.pendingDecision!.id, selectedOptionIds: [option] }, markContent, rng([])));
    expect(result.state.players[0]?.delayed ?? false).toBe(option === "accept"); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(result.state.activePlayerId).toBe("guest"); expect(result.state.pendingLocationEncounter).toBeUndefined();
  });
  it("lethal Lore loss stops handoff and cycles once", () => {
    const before = card16(); before.players[0]!.sanity = 1;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6, 6, 1])));
    expect(result.state.players[0]?.sanity).toBe(0); expect(result.state.pendingDefeat).toBeDefined();
    expect(result.state.activePlayerId).toBe("host"); expect(result.state.pendingLocationEncounter).toBeUndefined();
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.privateState.deckOrderById["encounter:other_world"]?.at(-1)).toBe(ids[14]);
  });
  it("Azathoth Doom 1 loses on lethal Lore failure, not on direct payment", () => {
    const before = card16(); before.players[0]!.sanity = 1; before.doom = 1;
    expect(accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6, 6, 1]))).state.gameResult).toBe("investigators_lose");
    const payment = offer(); payment.players[0]!.sanity = 1; payment.doom = 1;
    expect(accepted(choose(payment, "accept")).state.activeGateIds).toEqual([]);
  });
  it.each(["gate", "location", "deck", "clues", "held", "asset", "option"])("rejects changed restored payment %s atomically", field => {
    const before = offer();
    if (field === "gate") { before.activeGateIds = []; before.discardedGateIds = ["gate_arkham"]; }
    if (field === "location") before.players[0]!.locationId = "london";
    if (field === "deck") before.privateState.deckOrderById["encounter:other_world"]!.reverse();
    if (field === "clues") before.players[0]!.clues = 0;
    if (field === "held") before.privateState.tokenPoolById["held_clues:host"] = [];
    if (field === "asset") before.players[0]!.assetIds = ["unsupported"];
    const snapshot = structuredClone(before); expect(choose(before, field === "option" ? "close" : "accept").ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it("guards unsupported awakening after restored Lore failure", () => {
    const initial = accepted(resolveOtherWorldEncounter(card16(1), "host", "gate_arkham", content, rng([6, 6])));
    const follow = accepted(keep(initial.state, [1])).state; follow.players[0]!.sanity = 1; follow.doom = 1; follow.ancientOneId = "cthulhu";
    const snapshot = structuredClone(follow); expect(keep(follow).ok).toBe(false); expect(follow).toEqual(snapshot);
  });
});

describe("Other World card 15: Yuggoth", () => {
  function card15(clues = 0) {
    const before = state(clues);
    before.privateState.deckOrderById["encounter:other_world"] = [ids[13]!, ...ids.filter(id => id !== ids[13])];
    before.privateState.tokenPoolById["condition:hallucinations"] = ["condition_hallucinations_01"];
    return before;
  }
  function offer() { return accepted(resolveOtherWorldEncounter(card15(1), "host", "gate_arkham", content, rng([]))).state; }
  function choose(before: GameState, option: string, dice: number[] = [], owner = "host") {
    return executeCommand(JSON.parse(JSON.stringify(before)), owner, { type: "RESOLVE_DECISION", decisionId: before.pendingDecision!.id, selectedOptionIds: [option] }, content, rng(dice));
  }
  it.each(["accept", "skip"])("restores no-Initial-test choice (%s) and closes only after success", option => {
    const before = offer(); const snapshot = structuredClone(before);
    expect(before.activeTest).toBeUndefined(); expect(before.pendingDecision?.kind).toBe("encounter_choice");
    expect(choose(before, option, [], "guest")).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const follow = accepted(choose(before, option, [6, 6]));
    if (option === "skip") { expect(follow.state.activeTest).toMatchObject({ skill: "will", modifier: 0 }); expect(follow.state.activeGateIds).toEqual(["gate_arkham"]); }
    const result = option === "skip" ? accepted(keep(follow.state)) : follow;
    expect(result.state.activeGateIds).toEqual([]); expect(result.state.players[0]?.clues).toBe(option === "accept" ? 0 : 1);
    expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(option === "accept" ? ["clue_a"] : []);
    expect(result.state.players[0]).toMatchObject({ health: 7, sanity: 5 }); expect(result.state.players[0]?.conditionIds ?? []).toEqual([]);
    expect(result.state.activePlayerId).toBe("guest"); expect(before).toEqual(snapshot);
    expect(result.state.privateState.deckOrderById["encounter:other_world"]).toEqual([...ids.filter(id => id !== ids[13]), ids[13]]);
  });
  it("spending the last Clue leaves no Lore reroll and gains front-only Hallucinations on failure", () => {
    const result = accepted(choose(offer(), "accept", [1]));
    expect(result.state.players[0]).toMatchObject({ health: 7, sanity: 5, clues: 0, conditionIds: ["condition_hallucinations_01"] });
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.pendingDecision).toBeUndefined();
    expect(JSON.stringify(projectStateForPlayer(result.state, "guest"))).not.toContain("condition_hallucinations_01");
  });
  it.each([1, 6])("no Clues selects Will, whose result %i closes or loses one Health", die => {
    const result = accepted(resolveOtherWorldEncounter(card15(), "host", "gate_arkham", content, rng([die, die])));
    expect(result.state.players[0]).toMatchObject({ health: die === 6 ? 7 : 6, sanity: 5, clues: 0 });
    expect(result.state.activeGateIds).toEqual(die === 6 ? [] : ["gate_arkham"]); expect(result.state.players[0]?.conditionIds ?? []).toEqual([]);
  });
  it.each([1, 6])("refusal retains a Clue for a restored Will reroll (%i)", die => {
    const follow = accepted(choose(offer(), "skip", [1, 1]));
    const result = accepted(choose(follow.state, "die-0", [die]));
    expect(result.state.players[0]?.clues).toBe(0); expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_a"]);
    expect(result.state.activeGateIds).toEqual(die === 6 ? [] : ["gate_arkham"]); expect(result.state.players[0]?.health).toBe(die === 6 ? 7 : 6);
  });
  it("two Clues allow one payment and one independent Lore reroll", () => {
    const before = card15(1); before.players[0]!.clues = 2;
    before.privateState.tokenPoolById["held_clues:host"] = ["clue_a", "clue_b"]; before.privateState.tokenPoolById.clues = ["clue_c"];
    const offered = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([])));
    const follow = accepted(choose(offered.state, "accept", [1]));
    expect(follow.state.activeTest).toMatchObject({ skill: "lore", modifier: 0 }); expect(follow.state.players[0]?.clues).toBe(1);
    const result = accepted(choose(follow.state, "die-0", [6]));
    expect(result.state.activeGateIds).toEqual([]); expect(result.state.players[0]?.clues).toBe(0);
    expect(new Set(result.state.privateState.tokenPoolById.clue_discard)).toEqual(new Set(["clue_a", "clue_b"]));
  });
  it.each(["held", "empty"])("handles %s Hallucinations without duplicating a physical copy", scenario => {
    const before = offer(); before.privateState.tokenPoolById["condition:hallucinations"] = [];
    if (scenario === "held") before.players[0]!.conditionIds = ["condition_hallucinations_01"];
    const result = accepted(choose(before, "accept", [1]));
    expect(result.state.players[0]?.conditionIds?.length ?? 0).toBe(scenario === "held" ? 1 : 0);
    expect(result.state.players[0]?.clues).toBe(0); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
  });
  it("lethal Will loss stops handoff, cycles once and preserves Sanity", () => {
    const before = card15(); before.players[0]!.health = 1;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([1, 1])));
    expect(result.state.players[0]).toMatchObject({ health: 0, sanity: 5 });
    expect(result.state.pendingDefeat).toBeDefined(); expect(result.state.activePlayerId).toBe("host"); expect(result.state.pendingLocationEncounter).toBeUndefined();
    expect(result.state.privateState.deckOrderById["encounter:other_world"]).toEqual([...ids.filter(id => id !== ids[13]), ids[13]]);
  });
  it("Azathoth Doom 1 loses on lethal Will failure without closure", () => {
    const before = card15(); before.players[0]!.health = 1; before.doom = 1;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([1, 1])));
    expect(result.state.gameResult).toBe("investigators_lose"); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
  });
  it.each(["gate", "location", "deck", "clues", "held", "condition", "option"])("rejects changed restored payment %s atomically", field => {
    const before = offer();
    if (field === "gate") { before.activeGateIds = []; before.discardedGateIds = ["gate_arkham"]; }
    if (field === "location") before.players[0]!.locationId = "london";
    if (field === "deck") before.privateState.deckOrderById["encounter:other_world"]!.reverse();
    if (field === "clues") before.players[0]!.clues = 0;
    if (field === "held") before.privateState.tokenPoolById["held_clues:host"] = [];
    if (field === "condition") before.privateState.tokenPoolById["condition:hallucinations"] = ["unknown"];
    const snapshot = structuredClone(before); expect(choose(before, field === "option" ? "close" : "accept").ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it.each(["missing", "unknown", "duplicate", "held"])("guards %s Hallucinations before even offering payment", scenario => {
    const before = card15(1);
    if (scenario === "missing") delete before.privateState.tokenPoolById["condition:hallucinations"];
    if (scenario === "unknown") before.privateState.tokenPoolById["condition:hallucinations"] = ["unknown"];
    if (scenario === "duplicate") before.privateState.tokenPoolById["condition:hallucinations"] = ["condition_hallucinations_01", "condition_hallucinations_01"];
    if (scenario === "held") before.players[0]!.conditionIds = ["condition_hallucinations_01"];
    const snapshot = structuredClone(before); expect(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([])).ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it("revalidates Hallucinations before resolving a restored Lore checkpoint", () => {
    const before = card15(1); before.players[0]!.clues = 2;
    before.privateState.tokenPoolById["held_clues:host"] = ["clue_a", "clue_b"]; before.privateState.tokenPoolById.clues = ["clue_c"];
    const offered = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([])));
    const follow = accepted(choose(offered.state, "accept", [1])).state;
    follow.privateState.tokenPoolById["condition:hallucinations"] = ["unknown"];
    const snapshot = structuredClone(follow); expect(keep(follow).ok).toBe(false); expect(follow).toEqual(snapshot);
  });
  it("guards unsupported awakening after restored Will failure", () => {
    const follow = accepted(choose(offer(), "skip", [1, 1])).state;
    follow.players[0]!.health = 1; follow.doom = 1; follow.ancientOneId = "cthulhu";
    const snapshot = structuredClone(follow); expect(keep(follow).ok).toBe(false); expect(follow).toEqual(snapshot);
  });
});

describe("Other World card 14: City of the Great Race", () => {
  function card14(clues = 0) {
    const before = state(clues);
    before.privateState.deckOrderById["encounter:other_world"] = [ids[12]!, ...ids.filter(id => id !== ids[12])];
    return before;
  }
  function offer() { return accepted(resolveOtherWorldEncounter(card14(1), "host", "gate_arkham", content, rng([]))).state; }
  function choose(before: GameState, option: string, dice: number[] = [], owner = "host") {
    return executeCommand(JSON.parse(JSON.stringify(before)), owner, { type: "RESOLVE_DECISION", decisionId: before.pendingDecision!.id, selectedOptionIds: [option] }, content, rng(dice));
  }
  it.each(["accept", "skip"])("restores the no-Initial-test payment (%s) and closes only after its test", option => {
    const before = offer(); const snapshot = structuredClone(before);
    expect(before.activeTest).toBeUndefined(); expect(before.pendingDecision?.kind).toBe("encounter_choice");
    expect(choose(before, option, [], "guest")).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const follow = accepted(choose(before, option, [6, 6]));
    if (option === "skip") {
      expect(follow.state.activeTest).toMatchObject({ skill: "strength", modifier: 0 });
      expect(follow.state.activeGateIds).toEqual(["gate_arkham"]);
    }
    const result = option === "skip" ? accepted(keep(follow.state)) : follow;
    expect(result.state.activeGateIds).toEqual([]); expect(result.state.players[0]?.clues).toBe(option === "accept" ? 0 : 1);
    expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(option === "accept" ? ["clue_a"] : []);
    expect(result.state.players[0]).toMatchObject({ health: 7, sanity: 5 });
    expect(result.state.players[0]?.delayed).toBeFalsy(); expect(result.state.players[0]?.conditionIds ?? []).toEqual([]);
    expect(result.events.filter(event => event.type === "GATE_CLOSED")).toHaveLength(1);
    expect(result.state.pendingLocationEncounter).toBeUndefined(); expect(result.state.activePlayerId).toBe("guest"); expect(before).toEqual(snapshot);
    expect(result.state.privateState.deckOrderById["encounter:other_world"]).toEqual([...ids.filter(id => id !== ids[12]), ids[12]]);
  });
  it("payment spends the last Clue before Will, leaving none for a reroll", () => {
    const result = accepted(choose(offer(), "accept", [1, 1]));
    expect(result.state.players[0]).toMatchObject({ health: 7, sanity: 4, clues: 0 });
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.pendingDecision).toBeUndefined();
  });
  it("no Clues automatically selects Strength, never an Initial roll or free Will branch", () => {
    const result = accepted(resolveOtherWorldEncounter(card14(), "host", "gate_arkham", content, rng([1])));
    expect(result.state.players[0]).toMatchObject({ health: 6, sanity: 4, clues: 0 });
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.pendingDecision).toBeUndefined();
  });
  it.each([1, 6])("declined payment permits a conserved Strength reroll (%i)", die => {
    const follow = accepted(choose(offer(), "skip", [1]));
    expect(follow.state.activeTest).toMatchObject({ skill: "strength", modifier: 0 });
    const result = accepted(choose(follow.state, "die-0", [die]));
    expect(result.state.players[0]?.clues).toBe(0); expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_a"]);
    expect(result.state.activeGateIds).toEqual(die === 6 ? [] : ["gate_arkham"]);
    expect(result.state.players[0]).toMatchObject({ health: die === 6 ? 7 : 6, sanity: die === 6 ? 5 : 4 });
  });
  it("two physical Clues allow paying one and rerolling Will with the other", () => {
    const before = card14(1); before.players[0]!.clues = 2;
    before.privateState.tokenPoolById["held_clues:host"] = ["clue_a", "clue_b"]; before.privateState.tokenPoolById.clues = ["clue_c"];
    const offered = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([])));
    const follow = accepted(choose(offered.state, "accept", [1, 1]));
    expect(follow.state.activeTest).toMatchObject({ skill: "will", modifier: 0 });
    expect(follow.state.players[0]?.clues).toBe(1);
    const result = accepted(choose(follow.state, "die-0", [6]));
    expect(result.state.activeGateIds).toEqual([]); expect(result.state.players[0]?.clues).toBe(0);
    expect(new Set(result.state.privateState.tokenPoolById.clue_discard)).toEqual(new Set(["clue_a", "clue_b"]));
  });
  it.each(["health", "sanity", "both"])("simultaneous Strength loss defeats at depleted %s without dropping the other loss", resource => {
    const before = card14(); if (resource !== "sanity") before.players[0]!.health = 1; if (resource !== "health") before.players[0]!.sanity = 1;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([1])));
    expect(result.state.players[0]?.health).toBe(resource === "sanity" ? 6 : 0);
    expect(result.state.players[0]?.sanity).toBe(resource === "health" ? 4 : 0);
    expect(result.state.pendingDefeat).toBeDefined(); expect(result.state.activePlayerId).toBe("host");
    expect(result.state.pendingLocationEncounter).toBeUndefined(); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(result.state.privateState.deckOrderById["encounter:other_world"]?.at(-1)).toBe(ids[12]);
  });
  it("lethal paid Will loss retains the Gate and stops handoff", () => {
    const before = offer(); before.players[0]!.sanity = 1;
    const result = accepted(choose(before, "accept", [1, 1]));
    expect(result.state.players[0]).toMatchObject({ health: 7, sanity: 0, clues: 0 });
    expect(result.state.pendingDefeat).toBeDefined(); expect(result.state.activePlayerId).toBe("host"); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
  });
  it("simultaneous defeat advances Doom once and Azathoth loses at Doom 1", () => {
    const before = card14(); before.players[0]!.health = before.players[0]!.sanity = 1; before.doom = 1;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([1])));
    expect(result.state.doom).toBe(0); expect(result.state.gameResult).toBe("investigators_lose");
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.pendingLocationEncounter).toBeUndefined();
  });
  it.each(["gate", "location", "deck", "clues", "held", "asset", "option"])("rejects restored payment %s atomically", field => {
    const before = offer();
    if (field === "gate") { before.activeGateIds = []; before.discardedGateIds = ["gate_arkham"]; }
    if (field === "location") before.players[0]!.locationId = "london";
    if (field === "deck") before.privateState.deckOrderById["encounter:other_world"]!.reverse();
    if (field === "clues") before.players[0]!.clues = 0;
    if (field === "held") before.privateState.tokenPoolById["held_clues:host"] = [];
    if (field === "asset") before.players[0]!.assetIds = ["unsupported"];
    const snapshot = structuredClone(before); expect(choose(before, field === "option" ? "close" : "accept").ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it.each(["accept", "skip"])("guards unsupported awakening on restored %s damage", option => {
    const before = offer(); before.players[0]!.sanity = 1; before.doom = 1; before.ancientOneId = "cthulhu";
    const snapshot = structuredClone(before);
    const selected = choose(before, option, [1, 1]);
    if (option === "accept") expect(selected.ok).toBe(false);
    else { const follow = accepted(selected).state; const followSnapshot = structuredClone(follow); expect(keep(follow).ok).toBe(false); expect(follow).toEqual(followSnapshot); }
    expect(before).toEqual(snapshot);
  });
});

describe("Other World card 13: Yuggoth", () => {
  function card13(clues = 0) {
    const before = state(clues);
    before.privateState.deckOrderById["encounter:other_world"] = [ids[11]!, ...ids.filter(id => id !== ids[11])];
    return before;
  }
  it.each([true, false])("Initial pass %s selects printed Lore modifier and closes only on Lore success", pass => {
    const initial = accepted(resolveOtherWorldEncounter(card13(1), "host", "gate_arkham", content, rng(pass ? [6, 6] : [1, 1])));
    expect(initial.state.activeTest).toMatchObject({ skill: "will", modifier: 0, dicePool: 2 });
    const follow = accepted(keep(initial.state, [6]));
    expect(follow.state.activeTest).toMatchObject({ skill: "lore", modifier: pass ? 0 : -1, dicePool: 1 });
    expect(follow.state.activeGateIds).toEqual(["gate_arkham"]);
    const snapshot = structuredClone(follow.state);
    expect(keep(follow.state, [], "guest")).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const result = accepted(keep(follow.state));
    expect(result.state.activeGateIds).toEqual([]); expect(result.state.players[0]).toMatchObject({ health: 7, sanity: 5, clues: 1 });
    expect(result.state.players[0]?.delayed).toBeFalsy(); expect(result.state.players[0]?.conditionIds ?? []).toEqual([]);
    expect(result.events.filter(event => event.type === "GATE_CLOSED")).toHaveLength(1);
    expect(result.state.pendingLocationEncounter).toBeUndefined(); expect(result.state.activePlayerId).toBe("guest");
    expect(result.state.stateVersion).toBe(follow.state.stateVersion + 1); expect(follow.state).toEqual(snapshot);
    expect(result.state.privateState.deckOrderById["encounter:other_world"]).toEqual([...ids.filter(id => id !== ids[11]), ids[11]]);
    expect(JSON.stringify(projectStateForPlayer(result.state, "guest"))).not.toContain("encounter_other_world_12");
  });
  it.each([true, false])("failed Lore after Initial pass %s Delays or loses exactly three Sanity", pass => {
    const before = card13(); const snapshot = structuredClone(before);
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng(pass ? [6, 6, 1] : [1, 1, 1])));
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(result.state.players[0]?.delayed ?? false).toBe(pass);
    expect(result.state.players[0]?.sanity).toBe(pass ? 5 : 2);
    expect(result.state.players[0]?.health).toBe(7); expect(result.state.players[0]?.conditionIds ?? []).toEqual([]);
    expect(result.events.some(event => event.type === "GATE_CLOSED")).toBe(false); expect(before).toEqual(snapshot);
  });
  it.each([true, false])("restored Lore reroll closes on either branch (%s)", pass => {
    const initial = accepted(resolveOtherWorldEncounter(card13(1), "host", "gate_arkham", content, rng(pass ? [6, 6] : [1, 1])));
    const follow = accepted(keep(initial.state, [1]));
    const result = accepted(executeCommand(JSON.parse(JSON.stringify(follow.state)), "host", { type: "RESOLVE_DECISION", decisionId: follow.state.pendingDecision!.id, selectedOptionIds: ["die-0"] }, content, rng([6])));
    expect(result.state.players[0]?.clues).toBe(0); expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_a"]);
    expect(result.state.activeGateIds).toEqual([]); expect(result.state.players[0]?.delayed).toBeFalsy(); expect(result.state.players[0]?.sanity).toBe(5);
  });
  it("a final-Clue failed Initial reroll still resolves the discounted Lore test", () => {
    const initial = accepted(resolveOtherWorldEncounter(card13(1), "host", "gate_arkham", content, rng([1, 1])));
    const result = accepted(executeCommand(JSON.parse(JSON.stringify(initial.state)), "host", { type: "RESOLVE_DECISION", decisionId: initial.state.pendingDecision!.id, selectedOptionIds: ["die-0"] }, content, rng([1, 6])));
    expect(result.state.players[0]?.clues).toBe(0); expect(result.state.activeGateIds).toEqual([]);
    expect(result.events.some(event => event.type === "GATE_CLOSED")).toBe(true);
  });
  it.each(["accept", "refuse"])("Mark may %s mandatory Delay without changing the Gate", option => {
    const before = card13(); before.players[0]!.investigatorId = "mark_harrigan";
    const markContent: GameContent = { ...content, investigators: { ...content.investigators, mark_harrigan: content.investigators.trish_scarborough! } };
    const offered = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", markContent, rng([6, 6, 1])));
    const decision = offered.state.pendingDecision!; expect(decision.kind).toBe("encounter_choice");
    expect(executeCommand(offered.state, "guest", { type: "RESOLVE_DECISION", decisionId: decision.id, selectedOptionIds: [option] }, markContent, rng([]))).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const result = accepted(executeCommand(JSON.parse(JSON.stringify(offered.state)), "host", { type: "RESOLVE_DECISION", decisionId: decision.id, selectedOptionIds: [option] }, markContent, rng([])));
    expect(result.state.players[0]?.delayed ?? false).toBe(option === "accept"); expect(result.state.players[0]?.sanity).toBe(5);
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.activePlayerId).toBe("guest");
    expect(result.state.privateState.deckOrderById["encounter:other_world"]?.at(-1)).toBe(ids[11]);
  });
  it("already Delayed remains Delayed after the zero-modifier Lore failure", () => {
    const before = card13(); before.players[0]!.delayed = true;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6, 6, 1])));
    expect(result.state.players[0]).toMatchObject({ delayed: true, sanity: 5 }); expect(result.state.pendingDecision).toBeUndefined();
  });
  it.each([1, 2, 3])("lethal discounted Lore failure at Sanity %i stops handoff and cycles once", sanity => {
    const before = card13(); before.players[0]!.sanity = sanity;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([1, 1, 1])));
    expect(result.state.players[0]?.sanity).toBe(0); expect(result.state.pendingDefeat).toBeDefined();
    expect(result.state.pendingLocationEncounter).toBeUndefined(); expect(result.state.activePlayerId).toBe("host");
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(result.state.privateState.deckOrderById["encounter:other_world"]).toEqual([...ids.filter(id => id !== ids[11]), ids[11]]);
  });
  it("at Azathoth Doom 1 lethal loss ends without closing", () => {
    const before = card13(); before.players[0]!.sanity = 3; before.doom = 1;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([1, 1, 1])));
    expect(result.state.gameResult).toBe("investigators_lose"); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(result.state.activePlayerId).toBe("host"); expect(result.state.pendingLocationEncounter).toBeUndefined();
  });
  it.each(["gate", "location", "deck", "clues", "held", "asset", "option"])("rejects restored Lore source %s atomically", field => {
    const initial = accepted(resolveOtherWorldEncounter(card13(1), "host", "gate_arkham", content, rng([6, 6])));
    const before = accepted(keep(initial.state, [1])).state;
    if (field === "gate") { before.activeGateIds = []; before.discardedGateIds = ["gate_arkham"]; }
    if (field === "location") before.players[0]!.locationId = "london";
    if (field === "deck") before.privateState.deckOrderById["encounter:other_world"]!.reverse();
    if (field === "clues") before.players[0]!.clues = 0;
    if (field === "held") before.privateState.tokenPoolById["held_clues:host"] = [];
    if (field === "asset") before.players[0]!.assetIds = ["unsupported"];
    const snapshot = structuredClone(before);
    expect(executeCommand(before, "host", { type: "RESOLVE_DECISION", decisionId: before.pendingDecision!.id, selectedOptionIds: [field === "option" ? "close" : "die-0"] }, content, rng([])).ok).toBe(false);
    expect(before).toEqual(snapshot);
  });
  it("guards unsupported awakening on restored lethal Lore failure", () => {
    const initial = accepted(resolveOtherWorldEncounter(card13(1), "host", "gate_arkham", content, rng([1, 1])));
    const before = accepted(keep(initial.state, [1])).state; before.players[0]!.sanity = 3; before.doom = 1; before.ancientOneId = "cthulhu";
    const snapshot = structuredClone(before); expect(keep(before).ok).toBe(false); expect(before).toEqual(snapshot);
  });
});

describe("Other World card 12: Lost Carcosa", () => {
  function card12(clues = 0) {
    const before = state(clues);
    before.privateState.deckOrderById["encounter:other_world"] = [ids[10]!, ...ids.filter(id => id !== ids[10])];
    return before;
  }
  function offer() { return accepted(resolveOtherWorldEncounter(card12(), "host", "gate_arkham", content, rng([1]))).state; }
  function choose(before: GameState, option: string, owner = "host") {
    return executeCommand(JSON.parse(JSON.stringify(before)), owner, { type: "RESOLVE_DECISION", decisionId: before.pendingDecision!.id, selectedOptionIds: [option] }, content, rng([]));
  }
  it.each(["accept", "skip"])("restores optional Delay (%s) with exact Sanity avoidance", option => {
    const before = offer(); const snapshot = structuredClone(before);
    expect(before.pendingDecision?.kind).toBe("encounter_choice");
    expect(choose(before, option, "guest")).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const result = accepted(choose(before, option));
    expect(result.state.players[0]?.sanity).toBe(option === "accept" ? 5 : 3);
    expect(result.state.players[0]?.delayed ?? false).toBe(option === "accept");
    expect(result.state.players[0]?.conditionIds ?? []).toEqual([]);
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.activePlayerId).toBe("guest");
    expect(result.state.pendingLocationEncounter).toBeUndefined();
    expect(result.state.privateState.deckOrderById["encounter:other_world"]).toEqual([...ids.filter(id => id !== ids[10]), ids[10]]);
    expect(result.state.stateVersion).toBe(before.stateVersion + 1); expect(before).toEqual(snapshot);
  });
  it("already Delayed cannot pay again and automatically loses two Sanity", () => {
    const before = card12(); before.players[0]!.delayed = true;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([1])));
    expect(result.state.players[0]).toMatchObject({ delayed: true, sanity: 3 });
    expect(result.state.pendingDecision).toBeUndefined(); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
  });
  it.each(["accept", "skip"])("Mark's optional Delay %s cannot yield free avoidance", option => {
    const before = card12(); before.players[0]!.investigatorId = "mark_harrigan";
    const markContent: GameContent = { ...content, investigators: { ...content.investigators, mark_harrigan: content.investigators.trish_scarborough! } };
    const offered = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", markContent, rng([1])));
    const result = accepted(executeCommand(JSON.parse(JSON.stringify(offered.state)), "host", { type: "RESOLVE_DECISION", decisionId: offered.state.pendingDecision!.id, selectedOptionIds: [option] }, markContent, rng([])));
    expect(result.state.players[0]?.delayed ?? false).toBe(option === "accept");
    expect(result.state.players[0]?.sanity).toBe(option === "accept" ? 5 : 3);
    expect(result.state.pendingDecision).toBeUndefined(); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
  });
  it.each([1, 6])("closes only after Lore %i; failure gains Paranoia without damage", die => {
    const result = accepted(resolveOtherWorldEncounter(card12(), "host", "gate_arkham", content, rng([6, die])));
    expect(result.state.activeGateIds).toEqual(die === 6 ? [] : ["gate_arkham"]);
    expect(result.state.players[0]?.conditionIds ?? []).toEqual(die === 6 ? [] : ["condition_paranoia_01"]);
    expect(result.state.players[0]).toMatchObject({ health: 7, sanity: 5 }); expect(result.state.players[0]?.delayed).toBeFalsy();
    expect(result.events.filter(event => event.type === "GATE_CLOSED")).toHaveLength(die === 6 ? 1 : 0);
    expect(JSON.stringify(projectStateForPlayer(result.state, "guest"))).not.toContain("condition_paranoia_01");
  });
  it.each(["held", "empty"])("handles %s Paranoia without duplicating a physical copy", scenario => {
    const before = card12(); before.privateState.tokenPoolById["condition:paranoia"] = [];
    if (scenario === "held") before.players[0]!.conditionIds = ["condition_paranoia_01"];
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6, 1])));
    expect(result.state.players[0]?.conditionIds?.length ?? 0).toBe(scenario === "held" ? 1 : 0);
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
  });
  it("restores independent Observation and Lore rerolls before Gate closure", () => {
    const initial = accepted(resolveOtherWorldEncounter(card12(1), "host", "gate_arkham", content, rng([6])));
    expect(initial.state.activeTest).toMatchObject({ skill: "observation", modifier: 0 });
    const follow = accepted(keep(initial.state, [1]));
    expect(follow.state.activeTest).toMatchObject({ skill: "lore", modifier: 0 }); expect(follow.state.activeGateIds).toEqual(["gate_arkham"]);
    const result = accepted(executeCommand(JSON.parse(JSON.stringify(follow.state)), "host", { type: "RESOLVE_DECISION", decisionId: follow.state.pendingDecision!.id, selectedOptionIds: ["die-0"] }, content, rng([6])));
    expect(result.state.activeGateIds).toEqual([]); expect(result.state.players[0]?.clues).toBe(0);
    expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_a"]);
  });
  it("a failed final-Clue Initial reroll still offers Delay avoidance", () => {
    const initial = accepted(resolveOtherWorldEncounter(card12(1), "host", "gate_arkham", content, rng([1])));
    const follow = accepted(executeCommand(JSON.parse(JSON.stringify(initial.state)), "host", { type: "RESOLVE_DECISION", decisionId: initial.state.pendingDecision!.id, selectedOptionIds: ["die-0"] }, content, rng([1])));
    expect(follow.state.pendingDecision?.kind).toBe("encounter_choice"); expect(follow.state.players[0]?.clues).toBe(0);
    const result = accepted(choose(follow.state, "accept")); expect(result.state.players[0]).toMatchObject({ delayed: true, sanity: 5 });
  });
  it.each([1, 2])("lethal refusal at Sanity %i stops handoff and cycles once", sanity => {
    const before = offer(); before.players[0]!.sanity = sanity;
    const result = accepted(choose(before, "skip"));
    expect(result.state.players[0]?.sanity).toBe(0); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(result.state.activePlayerId).toBe("host"); expect(result.state.pendingLocationEncounter).toBeUndefined();
    expect(result.state.privateState.deckOrderById["encounter:other_world"]?.at(-1)).toBe(ids[10]);
  });
  it("accepting Delay avoids lethal loss, while Azathoth Doom 1 ends on refusal", () => {
    const before = offer(); before.players[0]!.sanity = 1; before.doom = 1;
    expect(accepted(choose(before, "accept")).state.players[0]).toMatchObject({ sanity: 1, delayed: true });
    const result = accepted(choose(before, "skip")); expect(result.state.gameResult).toBe("investigators_lose");
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.activePlayerId).toBe("host");
  });
  it.each(["gate", "location", "deck", "delay", "asset", "option"])("rejects changed restored avoidance %s atomically", field => {
    const before = offer();
    if (field === "gate") { before.activeGateIds = []; before.discardedGateIds = ["gate_arkham"]; }
    if (field === "location") before.players[0]!.locationId = "london";
    if (field === "deck") before.privateState.deckOrderById["encounter:other_world"]!.reverse();
    if (field === "delay") before.players[0]!.delayed = true;
    if (field === "asset") before.players[0]!.assetIds = ["unsupported"];
    const snapshot = structuredClone(before); expect(choose(before, field === "option" ? "refuse" : "accept").ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it.each(["missing", "unknown", "duplicate", "held"])("rejects %s Paranoia supply before Initial RNG", scenario => {
    const before = card12();
    if (scenario === "missing") delete before.privateState.tokenPoolById["condition:paranoia"];
    if (scenario === "unknown") before.privateState.tokenPoolById["condition:paranoia"] = ["unknown"];
    if (scenario === "duplicate") before.privateState.tokenPoolById["condition:paranoia"] = ["condition_paranoia_01", "condition_paranoia_01"];
    if (scenario === "held") before.players[0]!.conditionIds = ["condition_paranoia_01"];
    const snapshot = structuredClone(before); expect(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([])).ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it("guards unsupported awakening on lethal restored refusal", () => {
    const before = offer(); before.players[0]!.sanity = 2; before.doom = 1; before.ancientOneId = "cthulhu";
    const snapshot = structuredClone(before); expect(choose(before, "skip").ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it("revalidates Paranoia before restored Lore RNG", () => {
    const initial = accepted(resolveOtherWorldEncounter(card12(1), "host", "gate_arkham", content, rng([6])));
    initial.state.privateState.tokenPoolById["condition:paranoia"] = ["unknown"];
    const snapshot = structuredClone(initial.state); expect(keep(initial.state).ok).toBe(false); expect(initial.state).toEqual(snapshot);
  });
});

describe("Other World card 11: Great Hall of Celaeno", () => {
  function card11(clues = 0) {
    const before = state(clues);
    before.privateState.deckOrderById["encounter:other_world"] = [ids[9]!, ...ids.filter(id => id !== ids[9])];
    before.privateState.tokenPoolById["condition:amnesia"] = ["condition_amnesia_01"];
    return before;
  }
  function offer() {
    return accepted(keep(accepted(resolveOtherWorldEncounter(card11(1), "host", "gate_arkham", content, rng([1]))).state)).state;
  }
  function choose(before: GameState, option: string, owner = "host") {
    return executeCommand(JSON.parse(JSON.stringify(before)), owner, { type: "RESOLVE_DECISION", decisionId: before.pendingDecision!.id, selectedOptionIds: [option] }, content, rng([]));
  }
  it.each(["accept", "skip"])("restores Amnesia avoidance (%s) with exact physical Clue payment", option => {
    const before = offer(); const snapshot = structuredClone(before);
    expect(before.pendingDecision?.optionLabels?.skip).toContain("amnesia");
    expect(choose(before, option, "guest")).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const result = accepted(choose(before, option));
    expect(result.state.players[0]?.clues).toBe(option === "accept" ? 0 : 1);
    expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(option === "accept" ? ["clue_a"] : []);
    expect(result.state.players[0]?.conditionIds ?? []).toEqual(option === "accept" ? [] : ["condition_amnesia_01"]);
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.players[0]?.delayed).toBeFalsy();
    expect(result.state.players[0]).toMatchObject({ health: 7, sanity: 5 });
    expect(result.state.pendingLocationEncounter).toBeUndefined(); expect(result.state.activePlayerId).toBe("guest");
    expect(result.state.privateState.deckOrderById["encounter:other_world"]).toEqual([...ids.filter(id => id !== ids[9]), ids[9]]);
    expect(result.state.stateVersion).toBe(before.stateVersion + 1); expect(before).toEqual(snapshot);
    expect(JSON.stringify(projectStateForPlayer(result.state, "guest"))).not.toContain("condition_amnesia_01");
  });
  it("without Clues automatically gains Amnesia rather than free avoidance", () => {
    const result = accepted(resolveOtherWorldEncounter(card11(), "host", "gate_arkham", content, rng([1])));
    expect(result.state.players[0]?.conditionIds).toEqual(["condition_amnesia_01"]);
    expect(result.state.pendingDecision).toBeUndefined(); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(result.state.stateVersion).toBe(3);
  });
  it.each([1, 6])("last-Clue Lore reroll %i cannot also pay for avoidance", die => {
    const initial = accepted(resolveOtherWorldEncounter(card11(1), "host", "gate_arkham", content, rng([1])));
    const result = accepted(executeCommand(JSON.parse(JSON.stringify(initial.state)), "host", { type: "RESOLVE_DECISION", decisionId: initial.state.pendingDecision!.id, selectedOptionIds: ["die-0"] }, content, rng(die === 6 ? [6, 6, 6] : [1])));
    expect(result.state.players[0]?.clues).toBe(0); expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_a"]);
    expect(result.state.players[0]?.conditionIds?.length ?? 0).toBe(die === 1 ? 1 : 0);
    expect(result.state.activeGateIds).toEqual(die === 6 ? [] : ["gate_arkham"]); expect(result.state.pendingDecision).toBeUndefined();
  });
  it.each([1, 6])("closes only after Will %i, otherwise Delays without damage", die => {
    const before = card11(); const snapshot = structuredClone(before);
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6, die, die])));
    expect(result.state.activeGateIds).toEqual(die === 6 ? [] : ["gate_arkham"]);
    expect(result.state.players[0]?.delayed ?? false).toBe(die === 1);
    expect(result.state.players[0]).toMatchObject({ health: 7, sanity: 5 }); expect(result.state.players[0]?.conditionIds ?? []).toEqual([]);
    expect(result.events.filter(event => event.type === "GATE_CLOSED")).toHaveLength(die === 6 ? 1 : 0);
    expect(result.state.activePlayerId).toBe("guest"); expect(before).toEqual(snapshot);
  });
  it("already Delayed remains Delayed without closing or drawing a Condition", () => {
    const before = card11(); before.players[0]!.delayed = true;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6, 1, 1])));
    expect(result.state.players[0]?.delayed).toBe(true); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(result.state.players[0]?.conditionIds ?? []).toEqual([]); expect(result.state.pendingDecision).toBeUndefined();
  });
  it("restores independent Lore and Will rerolls before any closure", () => {
    const initial = accepted(resolveOtherWorldEncounter(card11(1), "host", "gate_arkham", content, rng([6])));
    expect(initial.state.activeTest).toMatchObject({ skill: "lore", modifier: 0, dicePool: 1 });
    const follow = accepted(keep(initial.state, [1, 1]));
    expect(follow.state.activeTest).toMatchObject({ skill: "will", modifier: 0, dicePool: 2 }); expect(follow.state.activeGateIds).toEqual(["gate_arkham"]);
    const result = accepted(executeCommand(JSON.parse(JSON.stringify(follow.state)), "host", { type: "RESOLVE_DECISION", decisionId: follow.state.pendingDecision!.id, selectedOptionIds: ["die-0"] }, content, rng([6])));
    expect(result.state.activeGateIds).toEqual([]); expect(result.state.players[0]?.delayed).toBeFalsy();
    expect(result.state.players[0]?.clues).toBe(0);
  });
  it.each(["accept", "refuse"])("Mark may %s Delay after failed Will without closing the Gate", option => {
    const before = card11(); before.players[0]!.investigatorId = "mark_harrigan";
    const markContent: GameContent = { ...content, investigators: { ...content.investigators, mark_harrigan: content.investigators.trish_scarborough! } };
    const offered = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", markContent, rng([6, 1, 1])));
    expect(offered.state.pendingDecision?.kind).toBe("encounter_choice"); expect(offered.state.players[0]?.delayed).toBeFalsy();
    const result = accepted(executeCommand(JSON.parse(JSON.stringify(offered.state)), "host", { type: "RESOLVE_DECISION", decisionId: offered.state.pendingDecision!.id, selectedOptionIds: [option] }, markContent, rng([])));
    expect(result.state.players[0]?.delayed ?? false).toBe(option === "accept"); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(result.state.players[0]?.conditionIds ?? []).toEqual([]); expect(result.state.activePlayerId).toBe("guest");
    expect(result.state.pendingLocationEncounter).toBeUndefined(); expect(result.state.privateState.deckOrderById["encounter:other_world"]?.at(-1)).toBe(ids[9]);
  });
  it.each(["held", "empty"])("handles %s Amnesia without inventing a copy", scenario => {
    const before = card11(); before.privateState.tokenPoolById["condition:amnesia"] = [];
    if (scenario === "held") before.players[0]!.conditionIds = ["condition_amnesia_01"];
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([1])));
    expect(result.state.players[0]?.conditionIds?.length ?? 0).toBe(scenario === "held" ? 1 : 0); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
  });
  it.each(["gate", "location", "deck", "clues", "held", "condition", "option"])("rejects changed restored payment %s atomically", field => {
    const before = offer();
    if (field === "gate") { before.activeGateIds = []; before.discardedGateIds = ["gate_arkham"]; }
    if (field === "location") before.players[0]!.locationId = "london";
    if (field === "deck") before.privateState.deckOrderById["encounter:other_world"]!.reverse();
    if (field === "clues") before.players[0]!.clues = 0;
    if (field === "held") before.privateState.tokenPoolById["held_clues:host"] = [];
    if (field === "condition") before.privateState.tokenPoolById["condition:amnesia"] = ["unknown"];
    const snapshot = structuredClone(before); expect(choose(before, field === "option" ? "invented" : "accept").ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it("validates optional Amnesia refusal before Initial RNG", () => {
    const before = card11(); delete before.privateState.tokenPoolById["condition:amnesia"];
    const snapshot = structuredClone(before); expect(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([])).ok).toBe(false); expect(before).toEqual(snapshot);
  });
});

describe("Other World card 10: Yuggoth", () => {
  function card10(clues = 0) {
    const before = state(clues);
    before.privateState.deckOrderById["encounter:other_world"] = [ids[8]!, ...ids.filter(id => id !== ids[8])];
    return before;
  }
  function offer(sanity = 5) {
    const before = card10(1); before.players[0]!.sanity = sanity;
    return accepted(keep(accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([1]))).state)).state;
  }
  function choose(before: GameState, option: string, owner = "host") {
    return executeCommand(JSON.parse(JSON.stringify(before)), owner, { type: "RESOLVE_DECISION", decisionId: before.pendingDecision!.id, selectedOptionIds: [option] }, content, rng([]));
  }
  it.each(["accept", "skip"])("restores exact Clue payment or two-Sanity refusal (%s)", option => {
    const before = offer(); const snapshot = structuredClone(before);
    expect(before.pendingDecision?.optionLabels?.skip).toContain("2 sanity");
    expect(choose(before, option, "guest")).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const result = accepted(choose(before, option));
    expect(result.state.players[0]?.clues).toBe(option === "accept" ? 0 : 1);
    expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(option === "accept" ? ["clue_a"] : []);
    expect(result.state.players[0]?.sanity).toBe(option === "accept" ? 5 : 3);
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.players[0]?.health).toBe(7);
    expect(result.state.players[0]?.conditionIds ?? []).toEqual([]); expect(result.state.players[0]?.delayed).toBeFalsy();
    expect(result.state.pendingLocationEncounter).toBeUndefined(); expect(result.state.activePlayerId).toBe("guest");
    expect(result.state.privateState.deckOrderById["encounter:other_world"]).toEqual([...ids.filter(id => id !== ids[8]), ids[8]]);
    expect(result.state.stateVersion).toBe(before.stateVersion + 1); expect(before).toEqual(snapshot);
  });
  it("no Clue runs the two-Sanity penalty without a payment decision", () => {
    const result = accepted(resolveOtherWorldEncounter(card10(), "host", "gate_arkham", content, rng([1])));
    expect(result.state.players[0]?.sanity).toBe(3); expect(result.state.pendingDecision).toBeUndefined();
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.stateVersion).toBe(3);
  });
  it.each([1, 6])("last-Clue Initial reroll %i cannot also buy avoidance", die => {
    const initial = accepted(resolveOtherWorldEncounter(card10(1), "host", "gate_arkham", content, rng([1])));
    const result = accepted(executeCommand(JSON.parse(JSON.stringify(initial.state)), "host", { type: "RESOLVE_DECISION", decisionId: initial.state.pendingDecision!.id, selectedOptionIds: ["die-0"] }, content, rng(die === 6 ? [6, 6] : [1])));
    expect(result.state.players[0]?.clues).toBe(0); expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_a"]);
    expect(result.state.players[0]?.sanity).toBe(die === 1 ? 3 : 5); expect(result.state.pendingDecision).toBeUndefined();
    expect(result.state.activeGateIds).toEqual(die === 6 ? [] : ["gate_arkham"]);
  });
  it.each([1, 6])("closes only on Lore %i, losing one Sanity on failure", die => {
    const before = card10(); const snapshot = structuredClone(before);
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6, die])));
    expect(result.state.activeGateIds).toEqual(die === 6 ? [] : ["gate_arkham"]);
    expect(result.state.players[0]?.sanity).toBe(die === 6 ? 5 : 4);
    expect(result.events.filter(event => event.type === "GATE_CLOSED")).toHaveLength(die === 6 ? 1 : 0);
    expect(result.state.doom).toBe(15); expect(result.state.activePlayerId).toBe("guest"); expect(before).toEqual(snapshot);
  });
  it("restores Influence then Lore, preserving the open Gate until final reroll", () => {
    const initial = accepted(resolveOtherWorldEncounter(card10(1), "host", "gate_arkham", content, rng([6])));
    expect(initial.state.activeTest).toMatchObject({ skill: "influence", modifier: 0, dicePool: 1 });
    const follow = accepted(keep(initial.state, [1]));
    expect(follow.state.activeTest).toMatchObject({ skill: "lore", modifier: 0, dicePool: 1 });
    expect(follow.state.activeGateIds).toEqual(["gate_arkham"]); expect(projectStateForPlayer(follow.state, "guest")).not.toHaveProperty("pendingLocationEncounter");
    const result = accepted(executeCommand(JSON.parse(JSON.stringify(follow.state)), "host", { type: "RESOLVE_DECISION", decisionId: follow.state.pendingDecision!.id, selectedOptionIds: ["die-0"] }, content, rng([6])));
    expect(result.state.activeGateIds).toEqual([]); expect(result.state.players[0]?.sanity).toBe(5);
    expect(result.state.players[0]?.clues).toBe(0);
  });
  it.each(["gate", "location", "deck", "clues", "held", "option"])("rejects changed restored payment %s atomically", field => {
    const before = offer();
    if (field === "gate") { before.activeGateIds = []; before.discardedGateIds = ["gate_arkham"]; }
    if (field === "location") before.players[0]!.locationId = "london";
    if (field === "deck") before.privateState.deckOrderById["encounter:other_world"]!.reverse();
    if (field === "clues") before.players[0]!.clues = 0;
    if (field === "held") before.privateState.tokenPoolById["held_clues:host"] = [];
    const snapshot = structuredClone(before); expect(choose(before, field === "option" ? "invented" : "accept").ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it.each([1, 2])("lethal Initial refusal at Sanity %i stops handoff and cycles once", sanity => {
    const before = offer(sanity);
    const result = accepted(choose(before, "skip"));
    expect(result.state.pendingDefeat).toBeDefined(); expect(result.state.players[0]?.sanity).toBe(0);
    expect(result.state.players[0]?.clues).toBe(1); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(result.state.activePlayerId).toBe("host"); expect(result.state.pendingLocationEncounter).toBeUndefined();
    expect(result.state.privateState.deckOrderById["encounter:other_world"]?.at(-1)).toBe(ids[8]);
  });
  it("accepting the payment avoids otherwise lethal Sanity loss", () => {
    const result = accepted(choose(offer(1), "accept"));
    expect(result.state.players[0]?.sanity).toBe(1); expect(result.state.pendingDefeat).toBeUndefined();
    expect(result.state.activePlayerId).toBe("guest"); expect(result.state.players[0]?.clues).toBe(0);
  });
  it("lethal Lore loss retains the Gate and stops handoff", () => {
    const before = card10(); before.players[0]!.sanity = 1;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6, 1])));
    expect(result.state.pendingDefeat).toBeDefined(); expect(result.state.activePlayerId).toBe("host");
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.pendingLocationEncounter).toBeUndefined();
  });
  it("lethal penalty at Azathoth Doom 1 ends rather than handing off", () => {
    const before = card10(); before.players[0]!.sanity = 2; before.doom = 1;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([1])));
    expect(result.state.gameResult).toBe("investigators_lose"); expect(result.state.activePlayerId).toBe("host");
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.pendingLocationEncounter).toBeUndefined();
  });
  it("guards unsupported awakening on restored refusal without payment or loss", () => {
    const before = offer(1); before.doom = 1; before.ancientOneId = "cthulhu";
    const snapshot = structuredClone(before); expect(choose(before, "skip").ok).toBe(false); expect(before).toEqual(snapshot);
  });
});

describe("Other World card 9: City of the Great Race", () => {
  function card9(clues = 0) {
    const before = state(clues);
    before.privateState.deckOrderById["encounter:other_world"] = [ids[7]!, ...ids.filter(id => id !== ids[7])];
    before.privateState.tokenPoolById["condition:hallucinations"] = ["condition_hallucinations_01"];
    return before;
  }
  function offer() {
    return accepted(keep(accepted(resolveOtherWorldEncounter(card9(1), "host", "gate_arkham", content, rng([1, 1]))).state)).state;
  }
  function choose(before: GameState, option: string, owner = "host") {
    return executeCommand(JSON.parse(JSON.stringify(before)), owner, { type: "RESOLVE_DECISION", decisionId: before.pendingDecision!.id, selectedOptionIds: [option] }, content, rng([]));
  }
  it.each(["accept", "skip"])("restores the Hallucinations avoidance choice (%s) with exact physical payment", option => {
    const before = offer(); const snapshot = structuredClone(before);
    expect(before.activeGateIds).toEqual(["gate_arkham"]); expect(before.players[0]?.conditionIds ?? []).toEqual([]);
    expect(before.pendingDecision?.optionLabels?.skip).toContain("hallucinations");
    expect(choose(before, option, "guest")).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const result = accepted(choose(before, option));
    expect(result.state.players[0]?.clues).toBe(option === "accept" ? 0 : 1);
    expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(option === "accept" ? ["clue_a"] : []);
    expect(result.state.players[0]?.conditionIds ?? []).toEqual(option === "accept" ? [] : ["condition_hallucinations_01"]);
    expect(result.state.players[0]?.health).toBe(7); expect(result.state.players[0]?.delayed).toBeFalsy();
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.discardedGateIds).toEqual([]);
    expect(result.state.privateState.deckOrderById["encounter:other_world"]).toEqual([...ids.filter(id => id !== ids[7]), ids[7]]);
    expect(result.state.pendingLocationEncounter).toBeUndefined(); expect(result.state.activePlayerId).toBe("guest");
    expect(result.state.stateVersion).toBe(before.stateVersion + 1); expect(before).toEqual(snapshot);
    expect(JSON.stringify(projectStateForPlayer(result.state, "guest"))).not.toContain("condition_hallucinations_01");
  });
  it("no Clues makes the printed failure consequence unavoidable", () => {
    const before = card9(); const snapshot = structuredClone(before);
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([1, 1])));
    expect(result.state.players[0]?.conditionIds).toEqual(["condition_hallucinations_01"]);
    expect(result.state.pendingDecision).toBeUndefined(); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(result.state.stateVersion).toBe(3); expect(before).toEqual(snapshot);
  });
  it.each([1, 6])("last-Clue Initial reroll %i cannot also fund avoidance", die => {
    const initial = accepted(resolveOtherWorldEncounter(card9(1), "host", "gate_arkham", content, rng([1, 1])));
    const result = accepted(executeCommand(JSON.parse(JSON.stringify(initial.state)), "host", { type: "RESOLVE_DECISION", decisionId: initial.state.pendingDecision!.id, selectedOptionIds: ["die-0"] }, content, rng(die === 6 ? [6, 6] : [1])));
    expect(result.state.players[0]?.clues).toBe(0); expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_a"]);
    expect(result.state.players[0]?.conditionIds?.length ?? 0).toBe(die === 1 ? 1 : 0);
    expect(result.state.activeGateIds).toEqual(die === 6 ? [] : ["gate_arkham"]); expect(result.state.pendingDecision).toBeUndefined();
  });
  it.each([1, 6])("closes only on follow-up Lore %i after Initial success", die => {
    const result = accepted(resolveOtherWorldEncounter(card9(), "host", "gate_arkham", content, rng([6, 6, die])));
    expect(result.state.activeGateIds).toEqual(die === 6 ? [] : ["gate_arkham"]);
    expect(result.state.players[0]?.health).toBe(die === 6 ? 7 : 5); expect(result.state.players[0]?.conditionIds ?? []).toEqual([]);
    expect(result.events.filter(event => event.type === "GATE_CLOSED")).toHaveLength(die === 6 ? 1 : 0);
  });
  it("restores the Lore reroll before closure without invoking the failure payment", () => {
    const initial = accepted(resolveOtherWorldEncounter(card9(1), "host", "gate_arkham", content, rng([6, 6])));
    expect(initial.state.activeTest).toMatchObject({ skill: "will", modifier: 0, dicePool: 2 });
    const follow = accepted(keep(initial.state, [1]));
    expect(follow.state.activeTest).toMatchObject({ skill: "lore", modifier: 0, dicePool: 1 });
    expect(follow.state.activeGateIds).toEqual(["gate_arkham"]);
    const result = accepted(executeCommand(JSON.parse(JSON.stringify(follow.state)), "host", { type: "RESOLVE_DECISION", decisionId: follow.state.pendingDecision!.id, selectedOptionIds: ["die-0"] }, content, rng([6])));
    expect(result.state.activeGateIds).toEqual([]); expect(result.state.players[0]?.health).toBe(7);
    expect(result.state.players[0]?.clues).toBe(0); expect(result.state.players[0]?.conditionIds ?? []).toEqual([]);
  });
  it.each(["held", "empty"])("does not duplicate or invent Hallucinations when %s", scenario => {
    const before = card9(); before.privateState.tokenPoolById["condition:hallucinations"] = [];
    if (scenario === "held") before.players[0]!.conditionIds = ["condition_hallucinations_01"];
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([1, 1])));
    expect(result.state.players[0]?.conditionIds?.length ?? 0).toBe(scenario === "held" ? 1 : 0);
    expect(result.state.activePlayerId).toBe("guest"); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
  });
  it.each(["gate", "location", "deck", "clues", "held", "condition", "option"])("rejects changed restored payment %s without side effects", field => {
    const before = offer();
    if (field === "gate") { before.activeGateIds = []; before.discardedGateIds = ["gate_arkham"]; }
    if (field === "location") before.players[0]!.locationId = "london";
    if (field === "deck") before.privateState.deckOrderById["encounter:other_world"]!.reverse();
    if (field === "clues") before.players[0]!.clues = 0;
    if (field === "held") before.privateState.tokenPoolById["held_clues:host"] = [];
    if (field === "condition") before.privateState.tokenPoolById["condition:hallucinations"] = ["unknown"];
    const snapshot = structuredClone(before);
    expect(choose(before, field === "option" ? "invented" : "accept").ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it("validates Hallucinations inside optional decline before Initial RNG", () => {
    const before = card9(); before.privateState.tokenPoolById["condition:hallucinations"] = ["condition_amnesia_01"];
    const snapshot = structuredClone(before);
    expect(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([])).ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it.each([1, 2])("lethal Lore damage at Health %i retains the Gate and stops handoff", health => {
    const before = card9(); before.players[0]!.health = health;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6, 6, 1])));
    expect(result.state.pendingDefeat).toBeDefined(); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(result.state.players[0]?.conditionIds ?? []).toEqual([]); expect(result.state.activePlayerId).toBe("host");
    expect(result.state.pendingLocationEncounter).toBeUndefined(); expect(result.state.privateState.deckOrderById["encounter:other_world"]?.at(-1)).toBe(ids[7]);
  });
});

describe("Other World card 8: The Future", () => {
  function card8(clues = 0) {
    const before = state(clues);
    before.privateState.deckOrderById["encounter:other_world"] = [ids[6]!, ...ids.filter(id => id !== ids[6])];
    before.privateState.tokenPoolById["condition:amnesia"] = ["condition_amnesia_01"];
    return before;
  }
  it.each([[6, 6], [6, 1], [1, 6], [1, 1]])("resolves Initial %i and follow-up %i without premature closure", (initial, follow) => {
    const before = card8(); const snapshot = structuredClone(before);
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([initial, initial, follow])));
    const closes = initial === 6 && follow === 6;
    expect(result.state.activeGateIds).toEqual(closes ? [] : ["gate_arkham"]);
    expect(result.state.discardedGateIds).toEqual(closes ? ["gate_arkham"] : []);
    expect(result.events.filter(event => event.type === "GATE_CLOSED")).toHaveLength(closes ? 1 : 0);
    expect(result.state.players[0]?.health).toBe(initial === 6 && follow === 1 ? 5 : 7);
    expect(result.state.players[0]?.conditionIds ?? []).toEqual(initial === 1 && follow === 1 ? ["condition_amnesia_01"] : []);
    expect(result.state.players[0]?.delayed).toBeFalsy(); expect(result.state.doom).toBe(15);
    expect(result.state.activePlayerId).toBe("guest"); expect(result.state.pendingLocationEncounter).toBeUndefined();
    expect(result.state.privateState.deckOrderById["encounter:other_world"]).toEqual([...ids.filter(id => id !== ids[6]), ids[6]]);
    expect(result.state.stateVersion).toBe(3); expect(before).toEqual(snapshot);
  });
  it.each([1, 6])("restores both tests for Initial %i and rejects non-owner choices", die => {
    const initial = accepted(resolveOtherWorldEncounter(card8(1), "host", "gate_arkham", content, rng([die, die])));
    expect(initial.state.activeTest).toMatchObject({ skill: "will", modifier: 0, dicePool: 2 });
    expect(keep(initial.state, [], "guest")).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const follow = accepted(keep(initial.state, [6]));
    expect(follow.state.activeTest).toMatchObject({ skill: die === 6 ? "lore" : "strength", modifier: 0, dicePool: 1 });
    expect(follow.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(projectStateForPlayer(follow.state, "guest")).not.toHaveProperty("pendingLocationEncounter");
    const result = accepted(keep(follow.state));
    expect(result.state.activeGateIds).toEqual(die === 6 ? [] : ["gate_arkham"]);
    expect(result.state.stateVersion).toBe(5); expect(result.state.players[0]?.clues).toBe(1);
  });
  it.each(["held", "empty"])("does not invent Amnesia when supply is %s", scenario => {
    const before = card8(); before.privateState.tokenPoolById["condition:amnesia"] = [];
    if (scenario === "held") before.players[0]!.conditionIds = ["condition_amnesia_01"];
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([1, 1, 1])));
    expect(result.state.players[0]?.conditionIds?.length ?? 0).toBe(scenario === "held" ? 1 : 0);
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.activePlayerId).toBe("guest");
  });
  it.each([1, 2])("lethal Lore loss at Health %i stops handoff and retains the Gate", health => {
    const before = card8(); before.players[0]!.health = health;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6, 6, 1])));
    expect(result.state.pendingDefeat).toBeDefined(); expect(result.state.players[0]?.health).toBe(0);
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.activePlayerId).toBe("host");
    expect(result.state.pendingLocationEncounter).toBeUndefined(); expect(result.state.privateState.deckOrderById["encounter:other_world"]?.at(-1)).toBe(ids[6]);
  });
  it("ends at Azathoth Doom 1 on lethal Lore failure without closure", () => {
    const before = card8(); before.players[0]!.health = 2; before.doom = 1;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6, 6, 1])));
    expect(result.state.gameResult).toBe("investigators_lose"); expect(result.state.activePlayerId).toBe("host");
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.pendingLocationEncounter).toBeUndefined();
  });
  it("guards unsupported awakening at damage resolution without mutating input", () => {
    const before = card8(); before.players[0]!.health = 2; before.doom = 1; before.ancientOneId = "shub_niggurath";
    const snapshot = structuredClone(before);
    expect(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6, 6, 1])).ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it.each([1, 6])("uses a physical Clue reroll to determine Strength %i before Amnesia", die => {
    const initial = accepted(resolveOtherWorldEncounter(card8(1), "host", "gate_arkham", content, rng([1, 1])));
    const follow = accepted(keep(initial.state, [1]));
    const result = accepted(executeCommand(JSON.parse(JSON.stringify(follow.state)), "host", { type: "RESOLVE_DECISION", decisionId: follow.state.pendingDecision!.id, selectedOptionIds: ["die-0"] }, content, rng([die])));
    expect(result.state.players[0]?.clues).toBe(0); expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_a"]);
    expect(result.state.players[0]?.conditionIds?.length ?? 0).toBe(die === 1 ? 1 : 0); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
  });
  it.each(["missing", "unknown", "duplicate", "overlap"])("guards invalid Amnesia %s before RNG", scenario => {
    const before = card8();
    if (scenario === "missing") delete before.privateState.tokenPoolById["condition:amnesia"];
    if (scenario === "unknown") before.privateState.tokenPoolById["condition:amnesia"] = ["condition_paranoia_01"];
    if (scenario === "duplicate") before.privateState.tokenPoolById["condition:amnesia"]!.push("condition_amnesia_01");
    if (scenario === "overlap") before.players[1]!.conditionIds = ["condition_amnesia_01"];
    const snapshot = structuredClone(before);
    expect(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([])).ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it("guards missing Amnesia definitions before RNG", () => {
    expect(resolveOtherWorldEncounter(card8(), "host", "gate_arkham", { ...content, conditions: content.conditions!.filter(card => card.kind !== "amnesia") }, rng([])).ok).toBe(false);
  });
  it("revalidates Amnesia supply before a restored Strength reroll payment", () => {
    const initial = accepted(resolveOtherWorldEncounter(card8(1), "host", "gate_arkham", content, rng([1, 1])));
    const follow = accepted(keep(initial.state, [1])).state;
    follow.privateState.tokenPoolById["condition:amnesia"] = ["unknown"];
    const snapshot = structuredClone(follow);
    expect(executeCommand(follow, "host", { type: "RESOLVE_DECISION", decisionId: follow.pendingDecision!.id, selectedOptionIds: ["die-0"] }, content, rng([])).ok).toBe(false); expect(follow).toEqual(snapshot);
  });
  it.each(["gate", "deck", "location"])("rejects changed restored Lore source %s before closure", source => {
    const initial = accepted(resolveOtherWorldEncounter(card8(1), "host", "gate_arkham", content, rng([6, 6])));
    const follow = accepted(keep(initial.state, [6])).state;
    if (source === "gate") { follow.activeGateIds = []; follow.discardedGateIds = ["gate_arkham"]; }
    if (source === "deck") follow.privateState.deckOrderById["encounter:other_world"]!.reverse();
    if (source === "location") follow.players[0]!.locationId = "london";
    const snapshot = structuredClone(follow); expect(keep(follow).ok).toBe(false); expect(follow).toEqual(snapshot);
  });
});

describe("Other World card 7: The Dreamlands", () => {
  function card7(clues = 0) {
    const before = state(); before.players[0]!.clues = clues;
    const physical = content.clues!.map(clue => clue.id);
    before.privateState.tokenPoolById["held_clues:host"] = physical.slice(0, clues);
    before.privateState.tokenPoolById.clues = physical.slice(clues);
    before.privateState.tokenPoolById["condition:hallucinations"] = ["condition_hallucinations_01"];
    before.privateState.deckOrderById["encounter:other_world"] = [ids[5]!, ...ids.filter(id => id !== ids[5])];
    return before;
  }
  it.each([0, 1, 2, 3])("adds %i held Clue dice before the minimum-one rule, only on Initial", clues => {
    const before = card7(clues); const snapshot = structuredClone(before);
    const initial = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng(Array(1 + clues).fill(6).concat(clues ? [] : [6]))));
    if (clues) {
      expect(initial.state.activeTest).toMatchObject({ skill: "will", modifier: -1, dicePool: 1 + clues });
      const follow = accepted(keep(initial.state, [6]));
      expect(follow.state.activeTest).toMatchObject({ skill: "strength", modifier: 0, dicePool: 1 });
      const result = accepted(keep(follow.state));
      expect(result.state.activeGateIds).toEqual([]); expect(result.state.players[0]?.clues).toBe(clues);
    } else expect(initial.state.activeGateIds).toEqual([]);
    expect(before).toEqual(snapshot);
  });
  it("adds improvements before the minimum and does not spend bonus Clues", () => {
    const before = card7(2); before.players[0]!.skillImprovements.will = 2;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6, 1, 1, 1, 1])));
    expect(result.state.activeTest?.dicePool).toBe(5); expect(result.state.players[0]?.clues).toBe(2);
  });
  it("combines the printed modifier and Clue bonus before clamping to one die", () => {
    const lowWill: GameContent = { ...content, investigators: { trish_scarborough: { ...content.investigators.trish_scarborough!, skills: { ...content.investigators.trish_scarborough!.skills, will: 1 } } } };
    const result = accepted(resolveOtherWorldEncounter(card7(2), "host", "gate_arkham", lowWill, rng([6, 1])));
    expect(result.state.activeTest?.dicePool).toBe(2);
  });
  it.each([1, 6])("retains the Gate until Strength %i determines closure or ordered loss/Delay", die => {
    const result = accepted(resolveOtherWorldEncounter(card7(), "host", "gate_arkham", content, rng([6, die])));
    expect(result.state.activeGateIds).toEqual(die === 6 ? [] : ["gate_arkham"]);
    expect(result.state.players[0]?.health).toBe(die === 6 ? 7 : 5);
    expect(result.state.players[0]?.delayed ?? false).toBe(die === 1);
    expect(result.state.players[0]?.conditionIds ?? []).toEqual([]);
    expect(result.state.pendingLocationEncounter).toBeUndefined(); expect(result.state.activePlayerId).toBe("guest");
    expect(result.state.privateState.deckOrderById["encounter:other_world"]?.at(-1)).toBe(ids[5]);
    expect(result.state.stateVersion).toBe(3);
  });
  it("Initial failure becomes Delayed before drawing Hallucinations and never closes", () => {
    const result = accepted(resolveOtherWorldEncounter(card7(), "host", "gate_arkham", content, rng([1])));
    expect(result.state.players[0]).toMatchObject({ delayed: true, conditionIds: ["condition_hallucinations_01"] });
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.players[0]?.health).toBe(7);
    expect(result.events.findIndex(event => event.type === "INVESTIGATOR_DELAYED")).toBeLessThan(result.events.findIndex(event => event.type === "CONDITION_GAINED"));
    expect(JSON.stringify(projectStateForPlayer(result.state, "guest"))).not.toContain("condition_hallucinations_01");
  });
  it.each(["held", "empty", "already-delayed"])("handles Hallucinations/Delay boundary %s", scenario => {
    const before = card7();
    if (scenario === "held") { before.players[0]!.conditionIds = ["condition_hallucinations_01"]; before.privateState.tokenPoolById["condition:hallucinations"] = []; }
    if (scenario === "empty") before.privateState.tokenPoolById["condition:hallucinations"] = [];
    if (scenario === "already-delayed") before.players[0]!.delayed = true;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([1])));
    expect(result.state.players[0]?.delayed).toBe(true); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
    expect(result.state.players[0]?.conditionIds?.length ?? 0).toBe(scenario === "empty" ? 0 : 1);
  });
  it.each([1, 2])("lethal Strength failure at Health %i stops before Delay", health => {
    const before = card7(); before.players[0]!.health = health;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6, 1])));
    expect(result.state.pendingDefeat).toBeDefined(); expect(result.state.players[0]?.delayed).toBeFalsy();
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.activePlayerId).toBe("host");
    expect(result.state.pendingLocationEncounter).toBeUndefined();
  });
  it("rerolling the last Clue preserves the original pool and leaves no follow-up bonus", () => {
    const initial = accepted(resolveOtherWorldEncounter(card7(1), "host", "gate_arkham", content, rng([1, 1])));
    const result = accepted(executeCommand(JSON.parse(JSON.stringify(initial.state)), "host", { type: "RESOLVE_DECISION", decisionId: initial.state.pendingDecision!.id, selectedOptionIds: ["die-0"] }, content, rng([6, 6])));
    expect(result.state.players[0]?.clues).toBe(0); expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_a"]);
    expect(result.state.activeGateIds).toEqual([]);
  });
  it.each(["missing", "duplicate", "count", "fraction", "unknown-condition", "duplicate-condition"])("rejects invalid dynamic source %s before RNG", scenario => {
    const before = card7(1);
    if (scenario === "missing") before.privateState.tokenPoolById["held_clues:host"] = [];
    if (scenario === "duplicate") before.privateState.tokenPoolById.clues!.push("clue_a");
    if (scenario === "count") before.players[0]!.clues = -1;
    if (scenario === "fraction") before.players[0]!.clues = 0.5;
    if (scenario === "unknown-condition") before.privateState.tokenPoolById["condition:hallucinations"] = ["unknown"];
    if (scenario === "duplicate-condition") before.privateState.tokenPoolById["condition:hallucinations"]!.push("condition_hallucinations_01");
    const snapshot = structuredClone(before);
    expect(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([])).ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it("revalidates restored bonus holdings before spending or rolling a reroll", () => {
    const initial = accepted(resolveOtherWorldEncounter(card7(1), "host", "gate_arkham", content, rng([1, 1]))).state;
    initial.privateState.tokenPoolById["held_clues:host"] = [];
    const snapshot = structuredClone(initial);
    expect(keep(initial).ok).toBe(false); expect(initial).toEqual(snapshot);
  });
  it("rejects unmodeled bonus descriptors instead of silently dropping them", () => {
    const initial = baseGameOtherWorldEncounterRules[5]!.sections.initial;
    expect(parseLocationEncounterInstruction({ ...initial, diceBonus: "unlimited" })).toBeUndefined();
  });
  it.each(["refuse", "accept"])("Mark may %s mandatory Delay without skipping the following Hallucinations", option => {
    const before = card7(); before.players[0]!.investigatorId = "mark_harrigan";
    const markContent: GameContent = { ...content, investigators: { ...content.investigators, mark_harrigan: content.investigators.trish_scarborough! } };
    const offered = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", markContent, rng([1])));
    expect(offered.state.players[0]?.conditionIds ?? []).toEqual([]); expect(offered.state.activeGateIds).toEqual(["gate_arkham"]);
    const result = accepted(executeCommand(JSON.parse(JSON.stringify(offered.state)), "host", { type: "RESOLVE_DECISION", decisionId: offered.state.pendingDecision!.id, selectedOptionIds: [option] }, markContent, rng([])));
    expect(result.state.players[0]?.delayed ?? false).toBe(option === "accept");
    expect(result.state.players[0]?.conditionIds).toEqual(["condition_hallucinations_01"]); expect(result.state.activePlayerId).toBe("guest");
  });
  it.each(["condition_blessed_01", "condition_cursed_01"])("uses the current %s success threshold with bonus dice", condition => {
    const before = card7(2); before.players[0]!.conditionIds = [condition];
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([4, 5, 1])));
    expect(result.state.activeTest?.successes).toBe(condition.includes("blessed") ? 2 : 0);
    expect(result.state.activeTest?.successThreshold).toBe(condition.includes("blessed") ? 4 : 6);
  });
  it("rejects missing Hallucinations definitions before Initial RNG", () => {
    const before = card7(); const snapshot = structuredClone(before);
    expect(resolveOtherWorldEncounter(before, "host", "gate_arkham", { ...content, conditions: content.conditions!.filter(card => card.kind !== "hallucinations") }, rng([])).ok).toBe(false);
    expect(before).toEqual(snapshot);
  });
  it("rejects a corrupted restored Hallucinations supply before spending a reroll Clue", () => {
    const initial = accepted(resolveOtherWorldEncounter(card7(1), "host", "gate_arkham", content, rng([1, 1]))).state;
    initial.privateState.tokenPoolById["condition:hallucinations"] = ["condition_paranoia_01"];
    const snapshot = structuredClone(initial);
    expect(executeCommand(initial, "host", { type: "RESOLVE_DECISION", decisionId: initial.pendingDecision!.id, selectedOptionIds: ["die-0"] }, content, rng([])).ok).toBe(false);
    expect(initial).toEqual(snapshot);
  });
});

describe("Other World card 5: The Past", () => {
  function card5(clues = 0) {
    const before = state(clues);
    before.privateState.deckOrderById["encounter:other_world"] = [ids[4]!, ...ids.filter(id => id !== ids[4])];
    return before;
  }
  function choose(before: GameState, option: string, owner = "host") {
    return executeCommand(JSON.parse(JSON.stringify(before)), owner, { type: "RESOLVE_DECISION", decisionId: before.pendingDecision!.id, selectedOptionIds: [option] }, content, rng([]));
  }
  it.each(["accept", "skip"])("keeps the Gate open during the offer and closes after %s", option => {
    const before = card5(); const snapshot = structuredClone(before);
    const offered = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6])));
    expect(offered.state.activeGateIds).toEqual(["gate_arkham"]); expect(offered.state.pendingLocationEncounter?.gateClosed).toBe(false);
    expect(offered.state.activePlayerId).toBe("host"); expect(offered.state.players[0]?.clues).toBe(0);
    expect(choose(offered.state, option, "guest")).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const result = accepted(choose(offered.state, option));
    expect(result.state.players[0]?.delayed ?? false).toBe(option === "accept");
    expect(result.state.players[0]?.clues).toBe(option === "accept" ? 2 : 0);
    expect(result.state.activeGateIds).toEqual([]); expect(result.state.discardedGateIds).toEqual(["gate_arkham"]);
    expect(result.events.filter(event => event.type === "GATE_CLOSED")).toHaveLength(1);
    if (option === "accept") expect(result.events.findIndex(event => event.type === "CLUES_GAINED")).toBeLessThan(result.events.findIndex(event => event.type === "GATE_CLOSED"));
    expect(result.state.privateState.deckOrderById["encounter:other_world"]).toEqual([...ids.filter(id => id !== ids[4]), ids[4]]);
    expect(result.state.pendingLocationEncounter).toBeUndefined(); expect(result.state.activePlayerId).toBe("guest");
    expect(result.state.doom).toBe(15); expect(result.state.stateVersion).toBe(4); expect(before).toEqual(snapshot);
  });
  it("already Delayed skips the reward but still closes the Gate", () => {
    const before = card5(); before.players[0]!.delayed = true;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6])));
    expect(result.state.pendingDecision).toBeUndefined(); expect(result.state.players[0]?.clues).toBe(0);
    expect(result.state.activeGateIds).toEqual([]); expect(result.state.players[0]?.delayed).toBe(true);
  });
  it.each([1, 6])("retains the Gate on Initial failure and Strength %i", die => {
    const result = accepted(resolveOtherWorldEncounter(card5(), "host", "gate_arkham", content, rng([1, die])));
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.discardedGateIds).toEqual([]);
    expect(result.state.players[0]?.health).toBe(die === 6 ? 7 : 1);
    expect(result.state.players[0]?.clues).toBe(0); expect(result.state.players[0]?.delayed).toBeFalsy();
    expect(result.state.activePlayerId).toBe("guest"); expect(result.state.pendingLocationEncounter).toBeUndefined();
  });
  it.each([1, 6])("lethal loss at Health %i interrupts handoff and cycles once", health => {
    const before = card5(); before.players[0]!.health = health;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([1, 1])));
    expect(result.state.pendingDefeat).toBeDefined(); expect(result.state.players[0]?.health).toBe(0);
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.activePlayerId).toBe("host");
    expect(result.state.pendingLocationEncounter).toBeUndefined();
    expect(result.state.privateState.deckOrderById["encounter:other_world"]?.at(-1)).toBe(ids[4]);
  });
  it("lethal loss at Azathoth Doom 1 ends the game without closing", () => {
    const before = card5(); before.players[0]!.health = 6; before.doom = 1;
    const result = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([1, 1])));
    expect(result.state.gameResult).toBe("investigators_lose"); expect(result.state.activePlayerId).toBe("host");
    expect(result.state.activeGateIds).toEqual(["gate_arkham"]); expect(result.state.pendingLocationEncounter).toBeUndefined();
  });
  it("guards unsupported awakening caused by lethal loss without mutating input", () => {
    const before = card5(); before.players[0]!.health = 6; before.doom = 1; before.ancientOneId = "cthulhu";
    const snapshot = structuredClone(before);
    expect(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([1, 1])).ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it("restores Influence and Strength independently and spends a physical Clue on the latter", () => {
    const initial = accepted(resolveOtherWorldEncounter(card5(1), "host", "gate_arkham", content, rng([1])));
    expect(initial.state.activeTest).toMatchObject({ skill: "influence", modifier: -1, dicePool: 1 });
    const follow = accepted(keep(initial.state, [1]));
    expect(follow.state.activeTest).toMatchObject({ skill: "strength", modifier: 0, dicePool: 1 });
    const result = accepted(executeCommand(JSON.parse(JSON.stringify(follow.state)), "host", { type: "RESOLVE_DECISION", decisionId: follow.state.pendingDecision!.id, selectedOptionIds: ["die-0"] }, content, rng([6])));
    expect(result.state.players[0]?.health).toBe(7); expect(result.state.players[0]?.clues).toBe(0);
    expect(result.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_a"]); expect(result.state.activeGateIds).toEqual(["gate_arkham"]);
  });
  it.each(["gate", "deck", "location", "delayed", "option"])("rejects a changed restored offer (%s) atomically", field => {
    const offered = accepted(resolveOtherWorldEncounter(card5(), "host", "gate_arkham", content, rng([6]))).state;
    if (field === "gate") { offered.activeGateIds = []; offered.discardedGateIds = ["gate_arkham"]; }
    if (field === "deck") offered.privateState.deckOrderById["encounter:other_world"]!.reverse();
    if (field === "location") offered.players[0]!.locationId = "london";
    if (field === "delayed") offered.players[0]!.delayed = true;
    const snapshot = structuredClone(offered);
    expect(choose(offered, field === "option" ? "invented" : "accept").ok).toBe(false); expect(offered).toEqual(snapshot);
  });
  it("charges accepted Delay even with exhausted Clue supply, then closes", () => {
    const before = card5(); before.privateState.tokenPoolById.clues = [];
    before.players[1]!.clues = 3; before.privateState.tokenPoolById["held_clues:guest"] = ["clue_a", "clue_b", "clue_c"];
    const offered = accepted(resolveOtherWorldEncounter(before, "host", "gate_arkham", content, rng([6])));
    const result = accepted(choose(offered.state, "accept"));
    expect(result.state.players[0]).toMatchObject({ delayed: true, clues: 0 }); expect(result.state.activeGateIds).toEqual([]);
  });
});

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
    before.privateState.deckOrderById["encounter:other_world"] = [ids[3]!, ...ids.filter(id => id !== ids[3])];
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
    expect(result.state.privateState.deckOrderById["encounter:other_world"]).toEqual([...ids.filter(id => id !== ids[3]), ids[3]]);
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
