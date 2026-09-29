import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, createLobby, discardCondition, executeCommand, gainCondition, projectPublicState, resolveConditionReckoning, type GameContent } from "../src/index.js";

const content: GameContent = {
  conditions: [
    { id: "condition_blessed_01", kind: "blessed" },
    { id: "condition_blessed_02", kind: "blessed" },
    { id: "condition_cursed_01", kind: "cursed" },
    { id: "condition_debt_01", kind: "debt" },
  ],
  map: { adjacentLocationIds: {}, routes: [], locationTypes: {} },
  investigators: {}, assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};

function state() {
  const game = createLobby(["investigator"]);
  game.phase = "action";
  game.players[0]!.conditionIds = [];
  game.privateState.tokenPoolById = {
    "condition:blessed": ["condition_blessed_01", "condition_blessed_02"],
    "condition:cursed": ["condition_cursed_01"],
    "condition:debt": ["condition_debt_01"],
  };
  return game;
}

describe("Condition supply and gain lifecycle", () => {
  it("draws a physical card from the private supply without exposing remaining order", () => {
    const before = state();
    const result = gainCondition(before, "investigator", "blessed", content, createDeterministicEngineContext({ tokenIndexes: [1] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0]!.conditionIds).toEqual(["condition_blessed_02"]);
    expect(result.state.privateState.tokenPoolById["condition:blessed"]).toEqual(["condition_blessed_01"]);
    expect(before.players[0]!.conditionIds).toEqual([]);
    expect(before.privateState.tokenPoolById["condition:blessed"]).toHaveLength(2);
    expect(JSON.stringify(projectPublicState(result.state))).not.toContain("condition_blessed_01");
    expect(JSON.stringify(projectPublicState(result.state))).not.toContain("condition_blessed_02");
    expect(projectPublicState(result.state).players[0]!.conditionIds).toEqual(["condition_blessed"]);
  });

  it("discards the opposite boon or bane instead of drawing a replacement", () => {
    const before = state();
    before.players[0]!.conditionIds = ["condition_cursed_01"];
    before.privateState.tokenPoolById["condition:cursed"] = [];
    const result = gainCondition(before, "investigator", "blessed", content, createDeterministicEngineContext({}));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0]!.conditionIds).toEqual([]);
    expect(result.state.privateState.tokenPoolById["condition:cursed"]).toEqual(["condition_cursed_01"]);
    expect(result.state.privateState.tokenPoolById["condition:blessed"]).toHaveLength(2);
  });

  it("does not gain an ordinary named Condition already held", () => {
    const before = state();
    before.players[0]!.conditionIds = ["condition_debt_01"];
    before.privateState.tokenPoolById["condition:debt"] = [];
    const result = gainCondition(before, "investigator", "debt", content, createDeterministicEngineContext({}));
    expect(result).toMatchObject({ ok: true, events: [{ type: "CONDITION_GAIN_PREVENTED" }] });
  });

  it("rejects unavailable supply and unresolved same-kind flips without mutation", () => {
    const before = state();
    before.privateState.tokenPoolById["condition:debt"] = [];
    expect(gainCondition(before, "investigator", "debt", content, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "CONDITION_UNAVAILABLE" } });
    before.players[0]!.conditionIds = ["condition_blessed_01"];
    expect(gainCondition(before, "investigator", "blessed", content, createDeterministicEngineContext({})))
      .toMatchObject({ ok: false, error: { code: "CONDITION_EFFECT_UNSUPPORTED" } });
    expect(before.players[0]!.conditionIds).toEqual(["condition_blessed_01"]);
  });

  it("returns discarded copies and rejects an unheld ID", () => {
    const before = state();
    before.players[0]!.conditionIds = ["condition_debt_01"];
    before.privateState.tokenPoolById["condition:debt"] = [];
    const result = discardCondition(before, "investigator", "condition_debt_01", content);
    expect(result).toMatchObject({ ok: true, events: [{ type: "CONDITION_DISCARDED" }] });
    if (!result.ok) return;
    expect(result.state.privateState.tokenPoolById["condition:debt"]).toEqual(["condition_debt_01"]);
    expect(discardCondition(result.state, "investigator", "condition_debt_01", content))
      .toMatchObject({ ok: false, error: { code: "CONDITION_NOT_HELD" } });
  });
});

describe("atomic Condition reverse effects", () => {
  const withBacks: GameContent = {
    ...content,
    conditions: [
      { id: "condition_blessed_01", kind: "blessed", backEffect: { type: "recover_health_and_sanity_then_flip_front", amount: 2 } },
      { id: "condition_blessed_02", kind: "blessed", backEffect: { type: "gain_clues_then_flip_front", amount: 2 } },
      { id: "condition_cursed_01", kind: "cursed", backEffect: { type: "discard" } },
    ],
  };

  it("caps recovery at maximum and keeps the same Blessed copy front-side", () => {
    const before = state();
    Object.assign(before.players[0]!, { conditionIds: ["condition_blessed_01"], health: 4, maxHealth: 5, sanity: 2, maxSanity: 5 });
    const result = gainCondition(before, "investigator", "blessed", withBacks, createDeterministicEngineContext({}));
    expect(result).toMatchObject({ ok: true, events: [{ type: "CONDITION_BACK_RESOLVED", conditionId: "condition_blessed", effect: "recover_health_and_sanity_then_flip_front" }] });
    if (!result.ok) return;
    expect(result.state.players[0]).toMatchObject({ health: 5, sanity: 4, conditionIds: ["condition_blessed_01"] });
    expect(before.players[0]).toMatchObject({ health: 4, sanity: 2 });
    expect(result.state.privateState.tokenPoolById["condition:blessed"]).toHaveLength(2);
    expect(JSON.stringify(projectPublicState(result.state))).not.toContain("condition_blessed_01");
  });

  it("gains two Clues without drawing a duplicate Blessed copy", () => {
    const before = state();
    before.players[0]!.conditionIds = ["condition_blessed_02"];
    before.players[0]!.clues = 1;
    const result = gainCondition(before, "investigator", "blessed", withBacks, createDeterministicEngineContext({}));
    expect(result).toMatchObject({ ok: true, events: [{ type: "CONDITION_BACK_RESOLVED", effect: "gain_clues_then_flip_front" }] });
    if (!result.ok) return;
    expect(result.state.players[0]!.clues).toBe(3);
    expect(result.state.players[0]!.conditionIds).toEqual(["condition_blessed_02"]);
  });

  it("takes Visions of Hypnos Clues from the finite physical supply", () => {
    const before = state();
    before.players[0]!.conditionIds = ["condition_blessed_02"];
    before.privateState.tokenPoolById.clues = ["clue_arkham"];
    before.privateState.tokenPoolById.clue_discard = [];
    before.privateState.tokenPoolById["held_clues:investigator"] = [];
    const physicalContent: GameContent = { ...withBacks, clues: [{ id: "clue_arkham", locationId: "arkham" }] };
    const result = gainCondition(before, "investigator", "blessed", physicalContent, createDeterministicEngineContext({ tokenIndexes: [0] }));
    expect(result).toMatchObject({ ok: true, events: [{ type: "CONDITION_BACK_RESOLVED" }, { type: "CLUE_GAINED", amount: 1 }] });
    if (!result.ok) return;
    expect(result.state.players[0]!.clues).toBe(1);
    expect(result.state.privateState.tokenPoolById["held_clues:investigator"]).toEqual(["clue_arkham"]);
    expect(result.state.privateState.tokenPoolById.clues).toEqual([]);
    expect(result.state.players[0]!.conditionIds).toEqual(["condition_blessed_02"]);
    expect(before.players[0]!.clues).toBe(0);
  });

  it("discards the same Cursed copy when its reverse says so", () => {
    const before = state();
    before.players[0]!.conditionIds = ["condition_cursed_01"];
    before.privateState.tokenPoolById["condition:cursed"] = [];
    const result = gainCondition(before, "investigator", "cursed", withBacks, createDeterministicEngineContext({}));
    expect(result).toMatchObject({ ok: true, events: [{ type: "CONDITION_BACK_RESOLVED", effect: "discard" }, { type: "CONDITION_DISCARDED", conditionId: "condition_cursed" }] });
    if (!result.ok) return;
    expect(result.state.players[0]!.conditionIds).toEqual([]);
    expect(result.state.privateState.tokenPoolById["condition:cursed"]).toEqual(["condition_cursed_01"]);
    expect(before.players[0]!.conditionIds).toEqual(["condition_cursed_01"]);
  });
});

describe("front-side Condition Reckoning", () => {
  const testContent: GameContent = {
    ...content,
    conditions: [
      { id: "condition_leg_injury_02", kind: "leg_injury", backEffect: { type: "become_delayed_then_flip_front" } },
      { id: "condition_hallucinations_01", kind: "hallucinations", backEffect: { type: "discard_all_clues_then_discard" } },
      { id: "condition_leg_injury_01", kind: "leg_injury" },
    ],
    investigators: { akachi_onyele: { startingLocationId: "london", health: 5, sanity: 5, skills: { lore: 2, influence: 2, observation: 2, strength: 2, will: 2 }, startingAssetIds: [], startingClues: 0 } },
  };

  it("tests Strength and flips Stabbing Pain only after a failed test", () => {
    const before = state();
    before.phase = "mythos";
    Object.assign(before.players[0]!, { investigatorId: "akachi_onyele", conditionIds: ["condition_leg_injury_02"], clues: 0 });
    const failed = resolveConditionReckoning(before, "investigator", "condition_leg_injury_02", testContent,
      createDeterministicEngineContext({ dice: [2, 3], ids: ["test-fail"] }));
    expect(failed).toMatchObject({ ok: true, events: [{ type: "TEST_ROLLED", skill: "strength", successes: 0 }, { type: "TEST_RESOLVED", continuation: "condition_reckoning" }, { type: "CONDITION_BACK_RESOLVED", effect: "become_delayed_then_flip_front" }, { type: "INVESTIGATOR_DELAYED" }] });
    if (!failed.ok) return;
    expect(failed.state.players[0]).toMatchObject({ delayed: true, conditionIds: ["condition_leg_injury_02"] });
    expect(failed.state.activeTest).toBeUndefined();
    expect(before.players[0]!.delayed).toBeUndefined();
    const passed = resolveConditionReckoning(before, "investigator", "condition_leg_injury_02", testContent,
      createDeterministicEngineContext({ dice: [5, 2], ids: ["test-pass"] }));
    expect(passed).toMatchObject({ ok: true, events: [{ type: "TEST_ROLLED", skill: "strength", successes: 1 }, { type: "TEST_RESOLVED", continuation: "condition_reckoning" }] });
    if (passed.ok) expect(passed.state.players[0]!.delayed).toBeUndefined();
  });

  it("offers a Clue reroll and resolves the Will test before Delusions discards clues", () => {
    const before = state();
    before.phase = "mythos";
    Object.assign(before.players[0]!, { investigatorId: "akachi_onyele", conditionIds: ["condition_hallucinations_01"], clues: 2 });
    before.privateState.tokenPoolById.clues = [];
    before.privateState.tokenPoolById.clue_discard = [];
    before.privateState.tokenPoolById["held_clues:investigator"] = ["clue_arkham", "clue_london"];
    const started = resolveConditionReckoning(before, "investigator", "condition_hallucinations_01", testContent,
      createDeterministicEngineContext({ dice: [1, 2], ids: ["will-test", "reroll-1"] }));
    expect(started).toMatchObject({ ok: true, state: { pendingDecision: { kind: "select_rerolls", playerId: "investigator" }, activeTest: { continuation: "condition_reckoning", skill: "will" } } });
    if (!started.ok) return;
    const rerolled = executeCommand(started.state, "investigator", { type: "RESOLVE_DECISION", decisionId: "reroll-1", selectedOptionIds: ["die-0"] }, testContent,
      createDeterministicEngineContext({ dice: [1], ids: ["reroll-2"] }));
    expect(rerolled).toMatchObject({ ok: true, state: { pendingDecision: { id: "reroll-2" }, players: [{ clues: 1 }] } });
    if (!rerolled.ok) return;
    const kept = executeCommand(rerolled.state, "investigator", { type: "RESOLVE_DECISION", decisionId: "reroll-2", selectedOptionIds: [] }, testContent,
      createDeterministicEngineContext({}));
    expect(kept).toMatchObject({ ok: true, events: [{ type: "DECISION_RESOLVED" }, { type: "TEST_RESOLVED", continuation: "condition_reckoning" }, { type: "CONDITION_BACK_RESOLVED", effect: "discard_all_clues_then_discard" }, { type: "CONDITION_DISCARDED", conditionId: "condition_hallucinations" }] });
    if (!kept.ok) return;
    expect(kept.state.players[0]!.clues).toBe(0);
    expect(kept.state.privateState.tokenPoolById["held_clues:investigator"]).toEqual([]);
    expect(kept.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_arkham", "clue_london"]);
    expect(kept.state.players[0]!.conditionIds).toEqual([]);
    expect(kept.state.privateState.tokenPoolById["condition:hallucinations"]).toEqual(["condition_hallucinations_01"]);
    expect(JSON.stringify(projectPublicState(kept.state))).not.toContain("condition_hallucinations_01");
  });

  it("rejects unimplemented injury backs before consuming dice or changing state", () => {
    const before = state();
    before.phase = "mythos";
    before.players[0]!.conditionIds = ["condition_leg_injury_01"];
    const snapshot = structuredClone(before);
    expect(resolveConditionReckoning(before, "investigator", "condition_leg_injury_01", testContent,
      createDeterministicEngineContext({}))).toMatchObject({ ok: false, error: { code: "CONDITION_EFFECT_UNSUPPORTED" } });
    expect(before).toEqual(snapshot);
  });

  it.each([
    ["condition_blessed_01", 1, true], ["condition_blessed_01", 2, true],
    ["condition_blessed_01", 3, false], ["condition_cursed_01", 3, false],
    ["condition_cursed_01", 4, true], ["condition_cursed_01", 6, true],
  ] as const)("resolves %s on die %i with discard=%s", (cardId, die, discarded) => {
    const before = state();
    before.phase = "mythos";
    before.players[0]!.conditionIds = [cardId];
    const kind = cardId.includes("blessed") ? "blessed" : "cursed";
    before.privateState.tokenPoolById[`condition:${kind}`] = [];
    const result = resolveConditionReckoning(before, "investigator", cardId, content, createDeterministicEngineContext({ dice: [die] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.stateVersion).toBe(before.stateVersion + 1);
    expect(result.events[0]).toEqual({ type: "CONDITION_RECKONING_ROLLED", playerId: "investigator", conditionId: `condition_${kind}`, die, discarded });
    expect(result.state.players[0]!.conditionIds).toEqual(discarded ? [] : [cardId]);
    expect(result.state.privateState.tokenPoolById[`condition:${kind}`]).toEqual(discarded ? [cardId] : []);
    expect(before.players[0]!.conditionIds).toEqual([cardId]);
    expect(JSON.stringify(projectPublicState(result.state))).not.toContain(cardId);
  });

  it("rejects wrong phase, unheld card, pending decision, and unsupported reverses without mutation", () => {
    const before = state();
    before.players[0]!.conditionIds = ["condition_blessed_01", "condition_debt_01"];
    const snapshot = structuredClone(before);
    const context = createDeterministicEngineContext({});
    expect(resolveConditionReckoning(before, "investigator", "condition_blessed_01", content, context))
      .toMatchObject({ ok: false, error: { code: "WRONG_PHASE" } });
    before.phase = "mythos";
    expect(resolveConditionReckoning(before, "investigator", "condition_blessed_02", content, context))
      .toMatchObject({ ok: false, error: { code: "CONDITION_NOT_HELD" } });
    expect(resolveConditionReckoning(before, "investigator", "condition_debt_01", content, context))
      .toMatchObject({ ok: false, error: { code: "CONDITION_EFFECT_UNSUPPORTED" } });
    before.activeTest = { id: "test", playerId: "investigator", skill: "will", modifier: 0, dicePool: 1, dice: [5], successes: 1, successThreshold: 5, continuation: "condition_action" };
    expect(resolveConditionReckoning(before, "investigator", "condition_blessed_01", content, context))
      .toMatchObject({ ok: false, error: { code: "DECISION_PENDING" } });
    expect({ ...before, phase: snapshot.phase, activeTest: undefined }).toEqual(snapshot);
  });
});
