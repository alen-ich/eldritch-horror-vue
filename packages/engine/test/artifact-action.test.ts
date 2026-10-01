import { describe, expect, it } from "vitest";
import { createLobby, executeCommand, createDeterministicEngineContext, type GameContent, type GameState } from "../src/index.js";

const content: GameContent = {
  artifacts: [{ id: "artifact_ttka_halot" }],
  map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city" } },
  investigators: { akachi_onyele: { startingLocationId: "arkham", health: 5, sanity: 7, startingAssetIds: [], startingClues: 0, skills: { lore: 1, influence: 1, observation: 1, strength: 1, will: 1 } } },
  assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
  monsters: [{ id: "monster", type: "normal", horrorCheck: null, damageCheck: null, toughness: { base: 3, perInvestigator: 0 } }, { id: "epic", type: "epic", horrorCheck: null, damageCheck: null, toughness: { base: 5, perInvestigator: 0 } }],
};
function state(): GameState {
  const value = createLobby(["host", "guest"]);
  value.phase = "action"; value.activePlayerId = value.leadInvestigatorId = "host"; value.actionsRemaining = 2;
  value.players[0] = { ...value.players[0]!, investigatorId: "akachi_onyele", locationId: "arkham", sanity: 7, health: 5, artifactIds: ["artifact_ttka_halot"] };
  value.monsters = [{ id: "target", monsterId: "monster", locationId: "arkham", damage: 0 }];
  return value;
}
function begin(value = state(), die = 6) {
  const result = executeCommand(value, "host", { type: "USE_ARTIFACT_ACTION", artifactId: "artifact_ttka_halot" }, content, createDeterministicEngineContext({ dice: [die], ids: ["test", "choice"] }));
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}
function choose(value: GameState, selected: string, owner = "host") {
  return executeCommand(value, owner, { type: "RESOLVE_DECISION", decisionId: value.pendingDecision!.id, selectedOptionIds: [selected] }, content);
}
describe("T'tka Halot component action", () => {
  it("defeats an on-space Monster without combat and conserves its token", () => {
    const before = state(); const pending = begin(before);
    expect(before.players[0]?.sanity).toBe(7);
    expect(pending.actionsRemaining).toBe(2);
    expect(pending.pendingDecision?.kind).toBe("artifact_target");
    const result = choose(JSON.parse(JSON.stringify(pending)), "target");
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]?.sanity).toBe(6);
    expect(result.state.monsters).toEqual([]);
    expect(result.state.privateState.tokenPoolById.monsters).toEqual(["monster"]);
    expect(result.state.actionsRemaining).toBe(1);
    expect(result.state.usedArtifactActionIds).toEqual(["artifact_ttka_halot"]);
    expect(result.events.some(event => event.type === "COMBAT_RESOLVED")).toBe(false);
    expect(executeCommand(result.state, "host", { type: "USE_ARTIFACT_ACTION", artifactId: "artifact_ttka_halot" }, content).ok).toBe(false);
  });
  it("allows refusal, failure, no targets and insufficient spendable Sanity", () => {
    const refused = choose(begin(), "skip");
    expect(refused).toMatchObject({ ok: true, state: { actionsRemaining: 1 } });
    if (!refused.ok) throw new Error(refused.error.message);
    expect(refused.state.players[0]?.sanity).toBe(7);
    for (const variant of ["failed", "empty", "sanity", "unsupported"] as const) {
      const before = state();
      if (variant === "empty") before.monsters = [];
      if (variant === "sanity") before.players[0]!.sanity = 1;
      if (variant === "unsupported") before.monsters![0]!.monsterId = "unknown";
      const after = begin(before, variant === "failed" ? 1 : 6);
      expect(after.pendingDecision).toBeUndefined(); expect(after.actionsRemaining).toBe(1);
      expect(after.players[0]?.sanity).toBe(before.players[0]?.sanity);
    }
  });
  it("rejects another owner and a relocated target without spending or consuming the choice", () => {
    const pending = begin(); expect(choose(pending, "target", "guest").ok).toBe(false);
    pending.monsters![0]!.locationId = "remote";
    const snapshot = structuredClone(pending);
    expect(choose(pending, "target").ok).toBe(false); expect(pending).toEqual(snapshot);
  });
  it("retains damage on surviving Monsters and never returns set-aside tokens", () => {
    const before = state(); before.monsters![0]!.monsterId = "epic";
    const pending = begin(before);
    const snapshot = structuredClone(pending);
    const partial = choose(pending, "target");
    expect(partial).toMatchObject({ ok: true, state: { monsters: [{ damage: 3 }] } });
    expect(pending).toEqual(snapshot);
    const setAside = begin(); setAside.monsters![0]!.setAside = true;
    const result = choose(setAside, "target");
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.privateState.tokenPoolById.monsters ?? []).toEqual([]);
  });
  it("spends exact held Clues on rerolls before offering the optional payment", () => {
    const before = state(); before.players[0]!.clues = 1; before.privateState.tokenPoolById["held_clues:host"] = ["clue_arkham"];
    const pending = begin(before, 1);
    const result = executeCommand(pending, "host", { type: "RESOLVE_DECISION", decisionId: pending.pendingDecision!.id, selectedOptionIds: ["die-0"] }, content, createDeterministicEngineContext({ dice: [6], ids: ["target-choice"] }));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]?.clues).toBe(0); expect(result.state.pendingDecision?.kind).toBe("artifact_target");
    expect(result.state.players[0]?.sanity).toBe(7);
  });
  it("guards phase, ownership, delay, possessions and action availability before rolling", () => {
    for (const variant of ["phase", "owner", "delay", "assets", "actions", "used"] as const) {
      const before = state();
      if (variant === "phase") before.phase = "encounter";
      if (variant === "owner") before.players[0]!.artifactIds = [];
      if (variant === "delay") before.players[0]!.delayed = true;
      if (variant === "assets") before.players[0]!.assetIds = ["asset"];
      if (variant === "actions") before.actionsRemaining = 0;
      if (variant === "used") before.usedArtifactActionIds = ["artifact_ttka_halot"];
      const snapshot = structuredClone(before);
      expect(executeCommand(before, "host", { type: "USE_ARTIFACT_ACTION", artifactId: "artifact_ttka_halot" }, content, createDeterministicEngineContext({})).ok).toBe(false);
      expect(before).toEqual(snapshot);
    }
  });
  it("advances the turn only after the final optional choice", () => {
    const before = state(); before.actionsRemaining = 1;
    const pending = begin(before);
    expect(pending.activePlayerId).toBe("host");
    const result = choose(pending, "skip");
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.activePlayerId).not.toBe("host");
    expect(result.state.usedArtifactActionIds).toEqual(["artifact_ttka_halot"]);
  });
});
