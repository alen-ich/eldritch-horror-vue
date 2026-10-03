import { describe, expect, it } from "vitest";
import { baseGameAssets } from "../../content/src/assets.js";
import { pendingDecisionSchema } from "@eldritch/protocol";
import { createDeterministicEngineContext, createLobby, executeCommand, projectPublicState, type GameContent, type GameState } from "../src/index.js";

const content: GameContent = {
  assets: baseGameAssets, investigators: {}, mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
  map: { adjacentLocationIds: {}, routes: [], locationTypes: {} },
  conditions: [{ id: "condition_cursed_01", kind: "cursed" }, { id: "condition_paranoia_01", kind: "paranoia" }],
};
function fixture() {
  const state = createLobby(["host", "guest"]);
  state.phase = "action"; state.activePlayerId = "host"; state.actionsRemaining = 2;
  Object.assign(state.players[0]!, { locationId: "arkham", health: 2, maxHealth: 5, sanity: 3, maxSanity: 7, conditionIds: ["condition_cursed_01"] });
  Object.assign(state.players[1]!, { locationId: "arkham", assetIds: ["asset_witch_doctor"], health: 4, maxHealth: 7, sanity: 5, maxSanity: 5 });
  state.privateState.tokenPoolById = { "condition:cursed": [], "condition:paranoia": ["condition_paranoia_01"] };
  return state;
}
function rest(state = fixture()) {
  const result = executeCommand(state, "host", { type: "REST" }, content, createDeterministicEngineContext({ ids: ["rest-choice"] }));
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}
function choose(state: GameState, effect: string, player = "host") {
  return executeCommand(state, player, { type: "RESOLVE_DECISION", decisionId: state.pendingDecision!.id, selectedOptionIds: [`asset_witch_doctor:${effect}`] }, content);
}

describe("Witch Doctor Rest bonus", () => {
  it("offers the resting investigator a colleague's bonus without consuming an action yet", () => {
    const before = fixture(); const snapshot = structuredClone(before); const state = rest(before);
    expect(before).toEqual(snapshot);
    expect(state.players[0]).toMatchObject({ health: 3, sanity: 4 });
    expect(state.pendingDecision).toMatchObject({ kind: "rest_asset_choice", playerId: "host", visibility: "owner", minSelections: 1, maxSelections: 1 });
    expect(state.actionsRemaining).toBe(2); expect(state.performedActions).toEqual([]);
    expect(state.pendingDecision!.optionIds).toEqual(["asset_witch_doctor:health", "asset_witch_doctor:discard-cursed", "asset_witch_doctor:skip"]);
    expect(pendingDecisionSchema.parse(state.pendingDecision)).toEqual(state.pendingDecision);
    expect(JSON.stringify(projectPublicState(state))).not.toContain("discard-cursed");
  });
  it.each(["health", "discard-cursed", "skip"])("resolves %s once after JSON restoration", effect => {
    const paused = JSON.parse(JSON.stringify(rest())) as GameState;
    const result = choose(paused, effect); expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.state.players[0]).toMatchObject({ health: effect === "health" ? 4 : 3, sanity: 4, clues: 0 });
    expect(result.state.players[0]!.conditionIds).toEqual(effect === "discard-cursed" ? [] : ["condition_cursed_01"]);
    expect(result.state.privateState.tokenPoolById["condition:cursed"]).toEqual(effect === "discard-cursed" ? ["condition_cursed_01"] : []);
    expect(result.state.players[1]!.assetIds).toEqual(["asset_witch_doctor"]);
    expect(result.state.actionsRemaining).toBe(1); expect(result.state.performedActions).toEqual(["rest"]);
    expect(result.state.pendingDecision).toBeUndefined();
    expect(JSON.stringify(result.events)).not.toContain("condition_cursed_01");
    expect(executeCommand(result.state, "host", { type: "REST" }, content)).toMatchObject({ ok: false, error: { code: "ACTION_ALREADY_PERFORMED" } });
    expect(choose({ ...result.state, pendingDecision: paused.pendingDecision }, effect)).toMatchObject({ ok: false });
  });
  it("caps Health, retains Bible recovery, and offers the holder their own bonus", () => {
    const state = fixture();
    state.players[0]!.assetIds = ["asset_witch_doctor", "asset_king_james_bible"]; state.players[1]!.assetIds = [];
    state.players[0]!.health = 5; state.players[0]!.sanity = 6;
    const result = choose(rest(state), "health"); expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.state.players[0]).toMatchObject({ health: 5, sanity: 7 });
  });
  it.each(["remote", "defeated", "eliminated"])("does not offer a %s holder's bonus", exclusion => {
    const state = fixture();
    if (exclusion === "remote") state.players[1]!.locationId = "london";
    else if (exclusion === "defeated") state.players[1]!.defeated = true;
    else state.players[1]!.eliminated = true;
    const after = rest(state); expect(after.pendingDecision).toBeUndefined(); expect(after.actionsRemaining).toBe(1);
  });
  it("does not offer Cursed discard when Cursed is not held", () => {
    const state = fixture(); state.players[0]!.conditionIds = []; state.privateState.tokenPoolById["condition:cursed"] = ["condition_cursed_01"];
    const paused = rest(state);
    expect(paused.pendingDecision!.optionIds).toEqual(["asset_witch_doctor:health", "asset_witch_doctor:skip"]);
    expect(pendingDecisionSchema.parse(paused.pendingDecision)).toEqual(paused.pendingDecision);
    expect(choose(paused, "discard-cursed")).toMatchObject({ ok: false, error: { code: "INVALID_DECISION_SELECTION" } });
  });
  it.each([1, 6])("runs Condition recovery (%s) before the bonus and consumes exactly one action", die => {
    const state = fixture(); state.players[0]!.conditionIds!.push("condition_paranoia_01"); state.privateState.tokenPoolById["condition:paranoia"] = [];
    const paused = rest(state); expect(paused.pendingDecision!.kind).toBe("recover_conditions");
    const rolled = executeCommand(paused, "host", { type: "RESOLVE_DECISION", decisionId: paused.pendingDecision!.id, selectedOptionIds: ["condition_paranoia"] }, content, createDeterministicEngineContext({ dice: [die], ids: ["bonus"] }));
    expect(rolled.ok).toBe(true); if (!rolled.ok) return;
    expect(rolled.state.pendingDecision!.kind).toBe("rest_asset_choice"); expect(rolled.state.actionsRemaining).toBe(2);
    expect(rolled.state.players[0]!.conditionIds!.includes("condition_paranoia_01")).toBe(die < 5);
    const result = choose(rolled.state, "discard-cursed"); expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.state.actionsRemaining).toBe(1); expect(result.state.performedActions).toEqual(["rest"]);
  });
  it("rejects missing decision context without mutation", () => {
    const state = fixture(); const before = structuredClone(state);
    expect(executeCommand(state, "host", { type: "REST" }, content)).toMatchObject({ ok: false, error: { code: "RANDOM_INPUT_REQUIRED" } });
    expect(state).toEqual(before);
  });
  it.each(["asset", "condition"])("rejects duplicated physical %s before ordinary recovery", kind => {
    const state = fixture();
    if (kind === "asset") state.assetDiscardIds = ["asset_witch_doctor"];
    else state.privateState.tokenPoolById["condition:cursed"] = ["condition_cursed_01"];
    const before = structuredClone(state);
    expect(executeCommand(state, "host", { type: "REST" }, content)).toMatchObject({ ok: false, error: { code: kind === "asset" ? "ASSET_CONTENT_MISSING" : "CONDITION_CONTENT_MISSING" } });
    expect(state).toEqual(before);
  });
  it.each(["remote", "discarded", "curse-lost", "monster", "wrong-phase"])("rechecks %s after restoration without mutation", change => {
    const state = rest();
    if (change === "remote") state.players[1]!.locationId = "london";
    if (change === "discarded") { state.players[1]!.assetIds = []; state.assetDiscardIds = ["asset_witch_doctor"]; }
    if (change === "curse-lost") state.players[0]!.conditionIds = [];
    if (change === "monster") state.monsterLocationIds = ["arkham"];
    if (change === "wrong-phase") state.phase = "encounter";
    const before = structuredClone(state); expect(choose(state, "discard-cursed")).toMatchObject({ ok: false }); expect(state).toEqual(before);
  });
  it("rejects other owners, invalid selections and a second Rest while pending", () => {
    const state = rest();
    expect(choose(state, "health", "guest")).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    expect(choose(state, "unknown")).toMatchObject({ ok: false, error: { code: "INVALID_DECISION_SELECTION" } });
    expect(executeCommand(state, "host", { type: "REST" }, content)).toMatchObject({ ok: false });
  });
  it("keeps ordinary Monster-blocked Rest atomic", () => {
    const state = fixture(); state.monsterLocationIds = ["arkham"]; const before = structuredClone(state);
    expect(executeCommand(state, "host", { type: "REST" }, content)).toMatchObject({ ok: false, error: { code: "REST_BLOCKED_BY_MONSTER" } }); expect(state).toEqual(before);
  });
  it("hands off a final action and lets the colleague use the same Ally on their Rest", () => {
    const state = fixture(); state.actionsRemaining = 1;
    const first = choose(rest(state), "health"); expect(first.ok).toBe(true); if (!first.ok) return;
    expect(first.state.activePlayerId).toBe("guest"); expect(first.state.actionsRemaining).toBe(2);
    const second = executeCommand(first.state, "guest", { type: "REST" }, content, createDeterministicEngineContext({ ids: ["guest-rest"] }));
    expect(second.ok).toBe(true); if (!second.ok) return;
    expect(second.state.pendingDecision).toMatchObject({ kind: "rest_asset_choice", playerId: "guest" });
    expect(second.state.players[1]!.assetIds).toEqual(["asset_witch_doctor"]);
  });
  it("rejects a duplicated Cursed copy on acceptance", () => {
    const state = rest(); state.privateState.tokenPoolById["condition:cursed"] = ["condition_cursed_01"];
    const before = structuredClone(state);
    expect(choose(state, "discard-cursed")).toMatchObject({ ok: false, error: { code: "CONDITION_CONTENT_MISSING" } });
    expect(state).toEqual(before);
  });
});
