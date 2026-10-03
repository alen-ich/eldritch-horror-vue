import { describe, expect, it } from "vitest";
import { baseGameArtifacts } from "../../content/src/artifacts.js";
import { pendingDecisionSchema } from "@eldritch/protocol";
import { createLobby, executeCommand, createDeterministicEngineContext, gainNamedArtifact, projectPublicState, type GameContent, type GameState, type CommandResult } from "../src/index.js";

const tome = "artifact_de_vermis_mysteriis";
const skills = { lore: 1, influence: 1, observation: 1, strength: 1, will: 1 };
const investigator = { startingLocationId: "arkham", health: 5, sanity: 7, startingAssetIds: [], startingClues: 0, skills };
const content: GameContent = {
  artifacts: baseGameArtifacts, assets: [], investigators: { akachi_onyele: investigator, lily_chen: investigator },
  map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city" } },
  clues: [{ id: "clue_arkham", locationId: "arkham" }],
  conditions: [{ id: "condition_detained_01", kind: "detained" }],
  mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};
function fixture(): GameState {
  const state = createLobby(["host", "guest"]);
  state.phase = "action"; state.activePlayerId = state.leadInvestigatorId = "host"; state.actionsRemaining = 2;
  Object.assign(state.players[0]!, { investigatorId: "akachi_onyele", locationId: "arkham", health: 5, sanity: 7, artifactIds: [tome] });
  state.privateState.deckOrderById.artifacts = baseGameArtifacts.filter(card => card.id !== tome).map(card => card.id);
  state.privateState.tokenPoolById = { clues: ["clue_arkham"], "held_clues:host": [], clue_discard: [] };
  return state;
}
function context(dice = [6]) { return createDeterministicEngineContext({ dice, ids: ["test", "choice", "payment"] }); }
function unwrap(result: CommandResult) { if (!result.ok) throw new Error(result.error.message); return result.state; }
function begin(state = fixture(), dice = [6]) { return unwrap(executeCommand(state, "host", { type: "USE_ARTIFACT_ACTION", artifactId: tome }, content, context(dice))); }
function resolve(state: GameState, selection = ["vermis:lore:1"], owner = "host", dice = [6]) {
  return executeCommand(state, owner, { type: "RESOLVE_DECISION", decisionId: state.pendingDecision!.id, selectedOptionIds: selection }, content, context(dice));
}
describe("De Vermis Mysteriis", () => {
  it.each(["lore", "influence", "observation", "strength", "will"] as const)("improves chosen %s after optional payment, restoring without mutating input", skill => {
    const state = fixture(), snapshot = structuredClone(state), pending = begin(state);
    expect(state).toEqual(snapshot); expect(pending.actionsRemaining).toBe(2); expect(pending.players[0]?.sanity).toBe(7);
    expect(pending.pendingDecision?.kind).toBe("artifact_payment");
    expect(pendingDecisionSchema.safeParse(pending.pendingDecision).success).toBe(true);
    expect(JSON.stringify(projectPublicState(pending))).not.toContain("vermis:lore:1");
    expect(pending.pendingDecision?.optionIds).toHaveLength(6);
    const result = resolve(JSON.parse(JSON.stringify(pending)), [`vermis:${skill}:1`]), after = unwrap(result);
    expect(after.players[0]?.skillImprovements).toEqual({ [skill]: 1 });
    expect(after.players[0]?.sanity).toBe(6); expect(after.players[0]?.artifactIds).toEqual([tome]);
    expect(after.actionsRemaining).toBe(1); expect(after.usedArtifactActionIds).toEqual([tome]);
    expect(after.stateVersion).toBe(pending.stateVersion + 1); expect(after.pendingDecision).toBeUndefined();
    expect(result.ok && result.events).toContainEqual({ type: "SKILL_IMPROVED", playerId: "host", skill, improvement: 1 });
    expect(after.privateState).toEqual(pending.privateState);
    expect(executeCommand(after, "host", { type: "RESOLVE_DECISION", decisionId: pending.pendingDecision!.id, selectedOptionIds: [`vermis:${skill}:1`] }, content).ok).toBe(false);
  });
  it.each(["decline", "failed", "sanity"])("completes %s without paying or improving", variant => {
    const state = fixture(); if (variant === "sanity") state.players[0]!.sanity = 1;
    const pending = begin(state, [variant === "failed" ? 1 : 6]);
    const after = variant === "decline" ? unwrap(resolve(pending, ["vermis:skip"])) : pending;
    expect(after.players[0]?.sanity).toBe(state.players[0]?.sanity);
    expect(after.players[0]?.skillImprovements).toEqual({}); expect(after.actionsRemaining).toBe(1);
    expect(after.pendingDecision).toBeUndefined(); expect(after.activeTest).toBeUndefined();
  });
  it.each([0, 1, 2])("caps Lily's optional double improvement from +%s at +2", current => {
    const state = fixture(); state.players[0]!.investigatorId = "lily_chen"; state.players[0]!.skillImprovements.strength = current;
    const pending = begin(state); expect(pending.pendingDecision?.optionIds).toHaveLength(11);
    const after = unwrap(resolve(pending, ["vermis:strength:2"]));
    expect(after.players[0]?.skillImprovements.strength).toBe(2); expect(after.players[0]?.sanity).toBe(6);
  });
  it("lets Lily choose once instead of twice", () => {
    const state = fixture(); state.players[0]!.investigatorId = "lily_chen";
    expect(unwrap(resolve(begin(state), ["vermis:will:1"])).players[0]?.skillImprovements.will).toBe(1);
  });
  it("caps an ordinary improvement at +2, including a chosen capped skill", () => {
    const state = fixture(); state.players[0]!.skillImprovements.strength = 2;
    const after = unwrap(resolve(begin(state), ["vermis:strength:1"]));
    expect(after.players[0]?.skillImprovements.strength).toBe(2); expect(after.players[0]?.sanity).toBe(6);
  });
  it("rejects other owners, invented skills and forged double improvements", () => {
    const pending = begin(), snapshot = structuredClone(pending);
    expect(resolve(pending, ["vermis:lore:1"], "guest").ok).toBe(false);
    for (const choice of ["vermis:unknown:1", "vermis:lore:99", "vermis:lore:2", "cultes:accept"]) expect(resolve(pending, [choice]).ok).toBe(false);
    expect(pending).toEqual(snapshot);
  });
  it.each(["missing", "duplicate", "phase", "delay", "detained", "used", "actions", "assets", "unsupported", "defeated"])("guards %s before rolling and at restored payment", variant => {
    function invalidate(state: GameState) {
      if (variant === "missing") state.players[0]!.artifactIds = [];
      if (variant === "duplicate") state.privateState.deckOrderById.artifacts!.push(tome);
      if (variant === "phase") state.phase = "encounter";
      if (variant === "delay") state.players[0]!.delayed = true;
      if (variant === "detained") state.players[0]!.conditionIds = ["condition_detained_01"];
      if (variant === "used") state.usedArtifactActionIds = [tome];
      if (variant === "actions") state.actionsRemaining = 0;
      if (variant === "assets") state.players[0]!.assetIds = ["unknown"];
      if (variant === "unsupported") state.players[0]!.artifactIds!.push("artifact_necronomicon");
      if (variant === "defeated") state.players[0]!.defeated = true;
    }
    const state = fixture(); invalidate(state); const snapshot = structuredClone(state);
    expect(executeCommand(state, "host", { type: "USE_ARTIFACT_ACTION", artifactId: tome }, content, context([])).ok).toBe(false); expect(state).toEqual(snapshot);
    const pending = begin(); invalidate(pending); const restored = structuredClone(pending);
    expect(resolve(pending).ok).toBe(false); expect(pending).toEqual(restored);
  });
  it("revalidates Sanity and Lily's eligibility without consuming the pending choice", () => {
    const pending = begin(); pending.players[0]!.sanity = 1;
    expect(resolve(pending).ok).toBe(false); expect(unwrap(resolve(pending, ["vermis:skip"])).players[0]?.sanity).toBe(1);
    const state = fixture(); state.players[0]!.investigatorId = "lily_chen";
    const lily = begin(state); lily.players[0]!.investigatorId = "akachi_onyele";
    expect(resolve(lily, ["vermis:lore:2"]).ok).toBe(false);
  });
  it("uses physical-Clue rerolls and checks the original source on resumption", () => {
    const state = fixture(); state.players[0]!.clues = 1;
    state.privateState.tokenPoolById["held_clues:host"] = state.privateState.tokenPoolById.clues!.splice(0);
    const pending = begin(state, [1]);
    const lost = structuredClone(pending); lost.players[0]!.artifactIds = [];
    expect(resolve(lost, ["die-0"]).ok).toBe(false);
    const passed = unwrap(resolve(JSON.parse(JSON.stringify(pending)), ["die-0"]));
    expect(passed.players[0]?.clues).toBe(0); expect(passed.pendingDecision?.kind).toBe("artifact_payment");
    expect(passed.privateState.tokenPoolById.clue_discard).toEqual(["clue_arkham"]);
    expect(unwrap(resolve(passed)).players[0]?.skillImprovements.lore).toBe(1);
  });
  it("preserves independent Tome usage, charges once, and resets next round", () => {
    const state = fixture(); state.players[0]!.artifactIds!.push("artifact_cultes_des_goules");
    state.privateState.deckOrderById.artifacts = state.privateState.deckOrderById.artifacts!.filter(id => id !== "artifact_cultes_des_goules");
    state.usedArtifactActionIds = ["artifact_cultes_des_goules"]; state.actionsRemaining = 1;
    const pending = begin(state); expect(pending.activePlayerId).toBe("host");
    const after = unwrap(resolve(pending, ["vermis:skip"]));
    expect(after.usedArtifactActionIds).toEqual(["artifact_cultes_des_goules", tome]); expect(after.activePlayerId).not.toBe("host");
    after.phase = "mythos"; after.replacementWindow = true;
    const fresh = unwrap(executeCommand(after, "host", { type: "BEGIN_NEXT_ROUND" }, content));
    expect(fresh.usedArtifactActionIds).toEqual([]); expect(begin(fresh).pendingDecision?.kind).toBe("artifact_payment");
  });
  it("supports only the verified named gain and leaves the rest of the deck in order", () => {
    const state = fixture(); state.players[0]!.artifactIds = []; state.privateState.deckOrderById.artifacts!.push(tome);
    const after = unwrap(gainNamedArtifact(state, "host", tome, content));
    expect(after.players[0]?.artifactIds).toEqual([tome]);
    expect(after.privateState.deckOrderById.artifacts).toEqual(state.privateState.deckOrderById.artifacts!.slice(0, -1));
    expect(gainNamedArtifact(state, "host", tome, { ...content, artifacts: baseGameArtifacts.map(({ id }) => ({ id })) }).ok).toBe(false);
  });
});
