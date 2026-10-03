import { describe, expect, it } from "vitest";
import { baseGameAssets } from "../../content/src/assets.js";
import { baseGameArtifacts } from "../../content/src/artifacts.js";
import { pendingDecisionSchema } from "@eldritch/protocol";
import { createLobby, createDeterministicEngineContext, executeCommand, projectPublicState, type GameState, type GameContent, type CommandResult } from "../src/index.js";

const box = "asset_puzzle_box", tome = "artifact_ttka_halot";
const content: GameContent = {
  assets: baseGameAssets, artifacts: baseGameArtifacts,
  investigators: { akachi_onyele: { startingLocationId: "arkham", health: 5, sanity: 7, startingAssetIds: [], startingClues: 0, skills: { lore: 2, influence: 2, observation: 2, strength: 2, will: 2 } } },
  map: { locationTypes: { arkham: "city", london: "city" }, adjacentLocationIds: {}, routes: [] },
  mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
  conditions: [{ id: "condition_cursed_01", kind: "cursed" }, { id: "condition_blessed_01", kind: "blessed" }, { id: "condition_paranoia_01", kind: "paranoia" }],
  clues: [{ id: "clue_arkham", locationId: "arkham" }],
};
function fixture(): GameState {
  const state = createLobby(["host", "guest"]); state.phase = "action"; state.activePlayerId = state.leadInvestigatorId = "host"; state.actionsRemaining = 2;
  Object.assign(state.players[0]!, { investigatorId: "akachi_onyele", locationId: "arkham", health: 2, maxHealth: 5, sanity: 3, maxSanity: 7, assetIds: [box], artifactIds: [], conditionIds: [] });
  Object.assign(state.players[1]!, { investigatorId: "akachi_onyele", locationId: "arkham", health: 5, sanity: 7, assetIds: [] });
  state.privateState.deckOrderById.artifacts = [tome, ...baseGameArtifacts.filter(card => card.id !== tome).map(card => card.id)];
  state.privateState.tokenPoolById = { clues: ["clue_arkham"], clue_discard: [], "held_clues:host": [], "condition:cursed": ["condition_cursed_01"], "condition:blessed": ["condition_blessed_01"], "condition:paranoia": ["condition_paranoia_01"] };
  return state;
}
function context(dice: number[] = []) { return createDeterministicEngineContext({ dice, ids: Array.from({ length: 20 }, (_, i) => `decision-${i}`) }); }
function unwrap(result: CommandResult) { expect(result.ok).toBe(true); if (!result.ok) throw new Error(result.error.message); return result.state; }
function rest(state = fixture()) { return unwrap(executeCommand(state, "host", { type: "REST" }, content, context())); }
function resolve(state: GameState, selection: string[], dice: number[] = [], actor = "host") {
  return executeCommand(state, actor, { type: "RESOLVE_DECISION", decisionId: state.pendingDecision!.id, selectedOptionIds: selection }, content, context(dice));
}
function attempt(state = rest(), dice = [6]) { return resolve(state, [`${box}:attempt`], dice); }
function withClue(state = fixture()) {
  state.players[0]!.clues = 1; state.privateState.tokenPoolById.clues = []; state.privateState.tokenPoolById["held_clues:host"] = ["clue_arkham"]; return state;
}

describe("Puzzle Box Rest test", () => {
  it("draws Cultes des Goules only when it is the true supported top card", () => {
    const state = fixture(); const cultes = "artifact_cultes_des_goules";
    state.privateState.deckOrderById.artifacts = [cultes, ...baseGameArtifacts.filter(card => card.id !== cultes).map(card => card.id)];
    const after = unwrap(attempt(rest(state)));
    expect(after.players[0]?.artifactIds).toEqual([cultes]);
    expect(after.privateState.deckOrderById.artifacts).toEqual(state.privateState.deckOrderById.artifacts!.slice(1));
    expect(after.assetDiscardIds).toEqual([box]);
  });
  it("offers an optional owner-only test without changing hidden order or charging Rest yet", () => {
    const before = fixture(), snapshot = structuredClone(before), paused = rest(before);
    expect(before).toEqual(snapshot);
    expect(paused.players[0]).toMatchObject({ health: 3, sanity: 4 });
    expect(paused.pendingRest).toEqual({ playerId: "host", remainingAssetIds: [box] });
    expect(pendingDecisionSchema.parse(paused.pendingDecision)).toEqual(paused.pendingDecision);
    expect(paused.pendingDecision?.optionIds).toEqual([`${box}:attempt`, `${box}:skip`]);
    expect(JSON.stringify(projectPublicState(paused))).not.toContain("pendingRest");
    expect(JSON.stringify(projectPublicState(paused))).not.toContain("artifact_grotesque_statue");
    expect(paused.actionsRemaining).toBe(2);
  });
  it("declines without dice, card discard, draw or a second recovery", () => {
    const state = rest(), after = unwrap(resolve(state, [`${box}:skip`]));
    expect(after.players[0]).toMatchObject({ health: 3, sanity: 4, assetIds: [box], artifactIds: [] });
    expect(after.privateState.deckOrderById.artifacts).toEqual(state.privateState.deckOrderById.artifacts);
    expect(after.actionsRemaining).toBe(1); expect(after.performedActions).toEqual(["rest"]); expect(after.pendingRest).toBeUndefined();
  });
  it.each([1, 6])("resolves roll %s with modifier −2 and a minimum one die", die => {
    const state = rest(), snapshot = structuredClone(state), result = attempt(state, [die]), after = unwrap(result);
    expect(state).toEqual(snapshot);
    expect(after.stateVersion).toBe(state.stateVersion + 1);
    expect(result.ok && result.events.find(event => event.type === "TEST_ROLLED")).toMatchObject({ skill: "observation", modifier: -2, dice: [die] });
    expect(after.players[0]!.assetIds).toEqual(die === 6 ? [] : [box]);
    expect(after.assetDiscardIds).toEqual(die === 6 ? [box] : []);
    expect(after.players[0]!.artifactIds).toEqual(die === 6 ? [tome] : []);
    expect(after.privateState.deckOrderById.artifacts).toEqual(die === 6 ? state.privateState.deckOrderById.artifacts!.slice(1) : state.privateState.deckOrderById.artifacts);
    expect(after.actionsRemaining).toBe(1); expect(after.activeTest).toBeUndefined(); expect(after.pendingRest).toBeUndefined();
  });
  it("uses improvements and the colleague's City aura before minimum dice", () => {
    const state = fixture(); state.players[0]!.skillImprovements.observation = 2; state.players[1]!.assetIds = ["asset_urban_guide"];
    const result = attempt(rest(state), [6, 1, 1]); expect(result.ok && result.events.find(event => event.type === "TEST_ROLLED")).toMatchObject({ dice: [6, 1, 1] });
  });
  it.each([["condition_blessed_01", 4, true], ["condition_cursed_01", 5, false]] as const)("uses %s threshold", (id, die, pass) => {
    const state = fixture(); state.players[0]!.conditionIds = [id]; state.privateState.tokenPoolById[id.includes("blessed") ? "condition:blessed" : "condition:cursed"] = [];
    const after = unwrap(attempt(rest(state), [die])); expect(after.players[0]!.artifactIds).toEqual(pass ? [tome] : []);
  });
  it("spends a physical Clue on a serialized reroll, then finalizes once", () => {
    const rolled = unwrap(attempt(rest(withClue()), [1]));
    expect(rolled.activeTest).toMatchObject({ continuation: "rest_asset", dice: [1] });
    expect(rolled.pendingRest?.testingAssetId).toBe(box);
    const restored = JSON.parse(JSON.stringify(rolled)) as GameState;
    const rerolled = unwrap(resolve(restored, ["die-0"], [6]));
    expect(rerolled.stateVersion).toBe(restored.stateVersion + 1);
    expect(rerolled.players[0]).toMatchObject({ clues: 0, artifactIds: [tome], assetIds: [] });
    expect(rerolled.privateState.tokenPoolById.clue_discard).toEqual(["clue_arkham"]); expect(rerolled.actionsRemaining).toBe(1);
  });
  it.each(["asset_lucky_rabbits_foot", "asset_lucky_cigarette_case"])("supports %s without charging a Clue", id => {
    const state = fixture(); state.players[0]!.assetIds.push(id);
    const rolled = unwrap(attempt(rest(state), [id.includes("cigarette") ? 4 : 1]));
    const option = id.includes("cigarette") ? `asset-increment:${id}:0` : `asset-reroll:${id}:0`;
    const changed = unwrap(resolve(rolled, [option], id.includes("cigarette") ? [] : [6]));
    expect(changed.players[0]).toMatchObject({ clues: 0, artifactIds: [tome], assetIds: [id] });
    expect(id.includes("cigarette") ? changed.usedAssetDieModifierIds : changed.usedAssetRerollIds).toEqual([id]);
  });
  it("lets Witch Doctor remove Cursed before Puzzle Box or after a failed test", () => {
    for (const first of ["witch", "box"]) {
      const state = fixture(); state.players[0]!.conditionIds = ["condition_cursed_01"]; state.privateState.tokenPoolById["condition:cursed"] = [];
      state.players[1]!.assetIds = ["asset_witch_doctor"];
      const paused = rest(state); expect(paused.pendingDecision!.optionIds).toContain(`${box}:attempt`);
      const middle = first === "witch" ? unwrap(resolve(paused, ["asset_witch_doctor:discard-cursed"])) : unwrap(attempt(paused, [5]));
      expect(middle.actionsRemaining).toBe(2);
      const after = first === "witch" ? unwrap(attempt(middle, [5])) : unwrap(resolve(middle, ["asset_witch_doctor:discard-cursed"]));
      expect(after.players[0]!.artifactIds).toEqual(first === "witch" ? [tome] : []);
      expect(after.players[0]!.conditionIds).toEqual([]); expect(after.actionsRemaining).toBe(1); expect(after.performedActions).toEqual(["rest"]);
    }
  });
  it("resolves Injury/Madness recovery first without repeating base Rest recovery", () => {
    const state = fixture(); state.players[0]!.conditionIds = ["condition_paranoia_01"]; state.privateState.tokenPoolById["condition:paranoia"] = [];
    const paused = rest(state); expect(paused.pendingDecision!.kind).toBe("recover_conditions");
    const middle = unwrap(resolve(paused, ["condition_paranoia"], [6]));
    const after = unwrap(attempt(middle, [6]));
    expect(after.players[0]).toMatchObject({ health: 3, sanity: 4, conditionIds: [], artifactIds: [tome] }); expect(after.actionsRemaining).toBe(1);
  });
  it("does not offer a colleague's Puzzle Box", () => {
    const state = fixture(); state.players[0]!.assetIds = []; state.players[1]!.assetIds = [box];
    const after = rest(state); expect(after.pendingRest).toBeUndefined(); expect(after.pendingDecision).toBeUndefined();
  });
  it("rejects ownership, forged choices and missing test context atomically", () => {
    const paused = rest(), before = structuredClone(paused);
    expect(resolve(paused, [`${box}:attempt`], [], "guest")).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    expect(resolve(paused, [`${box}:health`])).toMatchObject({ ok: false, error: { code: "INVALID_DECISION_SELECTION" } });
    expect(executeCommand(paused, "host", { type: "RESOLVE_DECISION", decisionId: paused.pendingDecision!.id, selectedOptionIds: [`${box}:attempt`] }, content)).toMatchObject({ ok: false, error: { code: "RANDOM_INPUT_REQUIRED" } });
    expect(paused).toEqual(before);
  });
  it.each(["unknown-top", "missing", "duplicate", "missing-card"])("guards %s Artifact supply before dice or Box discard", change => {
    const paused = rest();
    if (change === "unknown-top") paused.privateState.deckOrderById.artifacts!.reverse();
    if (change === "missing") delete paused.privateState.deckOrderById.artifacts;
    if (change === "duplicate") paused.players[1]!.artifactIds = [tome];
    if (change === "missing-card") paused.privateState.deckOrderById.artifacts!.pop();
    const before = structuredClone(paused), result = attempt(paused, []);
    expect(result).toMatchObject({ ok: false, error: { code: change === "unknown-top" ? "ARTIFACT_EFFECT_UNSUPPORTED" : "ARTIFACT_CONTENT_MISSING" } });
    expect(JSON.stringify(result)).not.toContain("mi_go_brain_case"); expect(paused).toEqual(before);
    if (change === "unknown-top") expect(unwrap(resolve(paused, [`${box}:skip`])).actionsRemaining).toBe(1);
  });
  it.each(["box-lost", "duplicate-box", "deck-changed", "rest-missing", "wrong-player", "monster"])("rejects %s during restored rerolls before spending a Clue", change => {
    const paused = unwrap(attempt(rest(withClue()), [1]));
    if (change === "box-lost") paused.players[0]!.assetIds = [];
    if (change === "duplicate-box") paused.assetDiscardIds.push(box);
    if (change === "deck-changed") paused.privateState.deckOrderById.artifacts!.reverse();
    if (change === "rest-missing") paused.pendingRest = undefined;
    if (change === "wrong-player") paused.pendingRest!.playerId = "guest";
    if (change === "monster") paused.monsterLocationIds = ["arkham"];
    const before = structuredClone(paused); expect(resolve(paused, ["die-0"], [])).toMatchObject({ ok: false }); expect(paused).toEqual(before);
  });
  it("does not duplicate an Artifact when the conserved supply is empty", () => {
    const state = fixture(); state.players[1]!.artifactIds = [...state.privateState.deckOrderById.artifacts!]; state.privateState.deckOrderById.artifacts = [];
    const after = unwrap(attempt(rest(state), [6]));
    expect(after.players[0]!.artifactIds).toEqual([]); expect(after.assetDiscardIds).toEqual([box]); expect(after.actionsRemaining).toBe(1);
  });
  it("hands off the last action and rejects replay or a second Rest", () => {
    const state = fixture(); state.actionsRemaining = 1; const paused = rest(state); const after = unwrap(attempt(paused, [6]));
    expect(after.activePlayerId).toBe("guest"); expect(after.actionsRemaining).toBe(2); expect(after.pendingRest).toBeUndefined();
    expect(attempt({ ...after, pendingDecision: paused.pendingDecision }, [])).toMatchObject({ ok: false });
  });
  it("accepts an older Witch Doctor checkpoint without the new private Rest continuation", () => {
    const state = fixture(); state.players[0]!.assetIds = []; state.players[1]!.assetIds = ["asset_witch_doctor"];
    const paused = rest(state); paused.pendingRest = undefined; paused.pendingDecision!.continuation = "witch_doctor_rest";
    const after = unwrap(resolve(paused, ["asset_witch_doctor:health"])); expect(after.actionsRemaining).toBe(1);
  });
});
