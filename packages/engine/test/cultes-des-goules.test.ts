import { describe, expect, it } from "vitest";
import { baseGameArtifacts } from "../../content/src/artifacts.js";
import { pendingDecisionSchema } from "@eldritch/protocol";
import { createLobby, executeCommand, createDeterministicEngineContext, gainNamedArtifact, projectPublicState, type GameContent, type GameState, type CommandResult } from "../src/index.js";

const tome = "artifact_cultes_des_goules";
const content: GameContent = {
  artifacts: baseGameArtifacts, assets: [],
  map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city" } },
  investigators: { akachi_onyele: { startingLocationId: "arkham", health: 5, sanity: 7, startingAssetIds: [], startingClues: 0, skills: { lore: 1, influence: 1, observation: 1, strength: 1, will: 1 } } },
  clues: ["arkham", "london", "rome"].map(locationId => ({ id: `clue_${locationId}`, locationId })),
  conditions: [{ id: "condition_detained", kind: "detained" }, { id: "condition_blessed", kind: "blessed" }, { id: "condition_cursed", kind: "cursed" }],
  mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};
function fixture(): GameState {
  const state = createLobby(["host", "guest"]);
  state.phase = "action"; state.activePlayerId = state.leadInvestigatorId = "host"; state.actionsRemaining = 2;
  Object.assign(state.players[0]!, { investigatorId: "akachi_onyele", locationId: "arkham", health: 5, sanity: 7, artifactIds: [tome] });
  state.privateState.deckOrderById.artifacts = baseGameArtifacts.filter(card => card.id !== tome).map(card => card.id);
  state.privateState.tokenPoolById = { clues: content.clues!.map(card => card.id), clue_discard: [], "held_clues:host": [], "held_clues:guest": [] };
  return state;
}
function context(dice = [6]) { return createDeterministicEngineContext({ dice, ids: ["test", "choice", "payment"], tokenIndexes: [0, 0], shuffleIndexes: [0, 0] }); }
function unwrap(result: CommandResult) { if (!result.ok) throw new Error(result.error.message); return result.state; }
function begin(state = fixture(), dice = [6]) { return unwrap(executeCommand(state, "host", { type: "USE_ARTIFACT_ACTION", artifactId: tome }, content, context(dice))); }
function resolve(state: GameState, selection = ["cultes:accept"], actor = "host", dice = [6]) {
  return executeCommand(state, actor, { type: "RESOLVE_DECISION", decisionId: state.pendingDecision!.id, selectedOptionIds: selection }, content, context(dice));
}

describe("Cultes des Goules", () => {
  it("offers the optional payment only after passing; restores and draws two physical Clues once", () => {
    const before = fixture(), snapshot = structuredClone(before), pending = begin(before);
    expect(before).toEqual(snapshot);
    expect(pending.pendingDecision?.kind).toBe("artifact_payment");
    expect(pendingDecisionSchema.safeParse(pending.pendingDecision).success).toBe(true);
    expect(pending.actionsRemaining).toBe(2); expect(pending.players[0]?.sanity).toBe(7);
    const result = resolve(JSON.parse(JSON.stringify(pending)));
    const after = unwrap(result);
    expect(after.stateVersion).toBe(pending.stateVersion + 1);
    expect(after.players[0]).toMatchObject({ clues: 2, sanity: 6, artifactIds: [tome] });
    expect(after.privateState.tokenPoolById["held_clues:host"]).toEqual(["clue_arkham", "clue_london"]);
    expect(after.privateState.tokenPoolById.clues).toEqual(["clue_rome"]);
    expect(after.actionsRemaining).toBe(1); expect(after.usedArtifactActionIds).toEqual([tome]);
    expect(after.pendingDecision).toBeUndefined(); expect(after.activeTest).toBeUndefined();
    expect(result.ok && result.events).toContainEqual({ type: "CLUE_GAINED", playerId: "host", amount: 2 });
    expect(JSON.stringify(projectPublicState(after))).not.toContain("clue_london");
    expect(executeCommand(after, "host", { type: "RESOLVE_DECISION", decisionId: pending.pendingDecision!.id, selectedOptionIds: ["cultes:accept"] }, content, context()).ok).toBe(false);
  });
  it("declines without spending, even if supply is unavailable", () => {
    const pending = begin(); delete pending.privateState.tokenPoolById.clues;
    const after = unwrap(resolve(pending, ["cultes:skip"]));
    expect(after.players[0]).toMatchObject({ sanity: 7, clues: 0 }); expect(after.actionsRemaining).toBe(1);
  });
  it.each(["failed", "last-sanity"])("finishes %s without reward or optional choice", variant => {
    const state = fixture(); if (variant === "last-sanity") state.players[0]!.sanity = 1;
    const after = begin(state, [variant === "failed" ? 1 : 6]);
    expect(after.pendingDecision).toBeUndefined(); expect(after.actionsRemaining).toBe(1);
    expect(after.players[0]?.sanity).toBe(state.players[0]?.sanity); expect(after.players[0]?.clues).toBe(0);
  });
  it.each([0, 1])("gains only available supply (%s) without inventing tokens", available => {
    const pending = begin();
    pending.privateState.tokenPoolById["held_clues:guest"] = pending.privateState.tokenPoolById.clues!.splice(available);
    pending.players[1]!.clues = 3 - available;
    const after = unwrap(resolve(pending));
    expect(after.players[0]).toMatchObject({ clues: available, sanity: 6 });
    expect(after.privateState.tokenPoolById.clues).toEqual([]);
  });
  it("recycles discards and leaves board Clues untouched", () => {
    const pending = begin(); pending.boardClues = [{ id: "marker", locationId: "arkham" }];
    pending.privateState.tokenPoolById.clues = [];
    pending.privateState.tokenPoolById.clue_discard = ["clue_london", "clue_rome"];
    pending.privateState.tokenPoolById["board_clue:marker"] = ["clue_arkham"];
    const after = unwrap(resolve(pending));
    expect(after.players[0]?.clues).toBe(2); expect(after.boardClues).toEqual(pending.boardClues);
    expect(after.privateState.tokenPoolById["board_clue:marker"]).toEqual(["clue_arkham"]);
    expect(after.privateState.tokenPoolById.clue_discard).toEqual([]);
  });
  it("uses ordinary physical-Clue rerolls before offering payment", () => {
    const state = fixture(); state.players[0]!.clues = 1;
    state.privateState.tokenPoolById["held_clues:host"] = [state.privateState.tokenPoolById.clues!.shift()!];
    const pending = begin(state, [1]); expect(pending.pendingDecision?.continuation).toBe("test_reroll");
    const paidTest = unwrap(resolve(pending, ["die-0"]));
    expect(paidTest.players[0]?.clues).toBe(0); expect(paidTest.pendingDecision?.kind).toBe("artifact_payment");
    expect(unwrap(resolve(paidTest)).players[0]?.clues).toBe(2);
  });
  it.each(["phase", "delay", "detained", "source", "duplicate", "used", "actions", "assets", "unsupported"])("guards %s before rolling and on restored payment", variant => {
    function invalidate(state: GameState) {
      if (variant === "phase") state.phase = "encounter";
      if (variant === "delay") state.players[0]!.delayed = true;
      if (variant === "detained") state.players[0]!.conditionIds = ["condition_detained"];
      if (variant === "source") state.players[0]!.artifactIds = [];
      if (variant === "duplicate") state.privateState.deckOrderById.artifacts!.push(tome);
      if (variant === "used") state.usedArtifactActionIds = [tome];
      if (variant === "actions") state.actionsRemaining = 0;
      if (variant === "assets") state.players[0]!.assetIds = ["unknown"];
      if (variant === "unsupported") state.players[0]!.artifactIds!.push("artifact_necronomicon");
    }
    const state = fixture(); invalidate(state); const snapshot = structuredClone(state);
    expect(executeCommand(state, "host", { type: "USE_ARTIFACT_ACTION", artifactId: tome }, content, context([])).ok).toBe(false); expect(state).toEqual(snapshot);
    const pending = begin(); invalidate(pending); const checkpoint = structuredClone(pending);
    expect(resolve(pending).ok).toBe(false); expect(pending).toEqual(checkpoint);
  });
  it.each(["duplicate", "missing", "unknown", "count", "sanity"])("rejects malformed %s at payment atomically", variant => {
    const pending = begin();
    if (variant === "duplicate") pending.privateState.tokenPoolById.clue_discard = ["clue_arkham"];
    if (variant === "missing") pending.privateState.tokenPoolById.clues!.pop();
    if (variant === "unknown") pending.privateState.tokenPoolById.clues![0] = "unknown";
    if (variant === "count") pending.players[0]!.clues = 9;
    if (variant === "sanity") pending.players[0]!.sanity = 1;
    const snapshot = structuredClone(pending); expect(resolve(pending).ok).toBe(false); expect(pending).toEqual(snapshot);
  });
  it("rejects unauthorized and invented choices and validates a resumed test's source", () => {
    const pending = begin(); expect(resolve(pending, ["cultes:accept"], "guest").ok).toBe(false);
    expect(resolve(pending, ["invented"]).ok).toBe(false);
    const state = fixture(); state.players[0]!.clues = 1;
    state.privateState.tokenPoolById["held_clues:host"] = [state.privateState.tokenPoolById.clues!.shift()!];
    const test = begin(state, [1]); test.players[0]!.artifactIds = [];
    const snapshot = structuredClone(test); expect(resolve(test, ["die-0"]).ok).toBe(false); expect(test).toEqual(snapshot);
  });
  it("uses improvements and Blessed/Cursed thresholds", () => {
    const improved = fixture(); improved.players[0]!.skillImprovements.lore = 1;
    expect(begin(improved, [1, 6]).pendingDecision?.kind).toBe("artifact_payment");
    const blessed = fixture(); blessed.players[0]!.conditionIds = ["condition_blessed_01"];
    expect(begin(blessed, [4]).pendingDecision?.kind).toBe("artifact_payment");
    const cursed = fixture(); cursed.players[0]!.conditionIds = ["condition_cursed_01"];
    expect(begin(cursed, [5]).pendingDecision).toBeUndefined();
  });
  it("tracks action-only Tomes independently and hands off after the final choice", () => {
    const state = fixture(); state.players[0]!.artifactIds!.push("artifact_ttka_halot");
    state.privateState.deckOrderById.artifacts = state.privateState.deckOrderById.artifacts!.filter(id => id !== "artifact_ttka_halot");
    state.usedArtifactActionIds = ["artifact_ttka_halot"]; state.actionsRemaining = 1;
    const pending = begin(state); expect(pending.activePlayerId).toBe("host");
    const after = unwrap(resolve(pending, ["cultes:skip"]));
    expect(after.usedArtifactActionIds).toEqual(["artifact_ttka_halot", tome]); expect(after.activePlayerId).not.toBe("host");
  });
  it("allows named physical transfer only with verified executable metadata", () => {
    const state = fixture(); state.players[0]!.artifactIds = []; state.privateState.deckOrderById.artifacts!.push(tome);
    expect(unwrap(gainNamedArtifact(state, "host", tome, content)).players[0]?.artifactIds).toEqual([tome]);
    expect(gainNamedArtifact(state, "host", tome, { ...content, artifacts: baseGameArtifacts.map(({ id }) => ({ id })) }).ok).toBe(false);
  });
  it("rejects another use this round and resets usage at the next round", () => {
    const after = unwrap(resolve(begin(), ["cultes:skip"]));
    expect(executeCommand(after, "host", { type: "USE_ARTIFACT_ACTION", artifactId: tome }, content, context([])).ok).toBe(false);
    after.phase = "mythos"; after.replacementWindow = true;
    const fresh = unwrap(executeCommand(after, "host", { type: "BEGIN_NEXT_ROUND" }, content));
    expect(fresh.usedArtifactActionIds).toEqual([]);
    expect(begin(fresh).pendingDecision?.kind).toBe("artifact_payment");
  });
});
