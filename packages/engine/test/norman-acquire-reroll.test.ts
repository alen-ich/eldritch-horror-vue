import { describe, expect, it } from "vitest";
import { executeCommand, createDeterministicEngineContext, projectPublicState, type GameState, type GameCommand } from "../src/index.js";
import { spendNormanClueSubstitution, canUseNormanSpellReroll } from "../src/norman-clue-substitution.js";
import { normanState, normanContent } from "./norman-spell-fixtures.js";
import { castingContext, unwrap } from "./spell-casting-fixtures.js";

function fixture(): GameState {
  const state = normanState();
  state.reserveAssetIds = ["a", "b", "c", "d"];
  state.privateState.deckOrderById.assets = [];
  return state;
}
function acquire(state = fixture(), dice = [1, 2]): GameState {
  return unwrap(executeCommand(state, "host", { type: "ACQUIRE_ASSETS" }, normanContent, castingContext(dice)));
}
function resolve(state: GameState, ids: string[], dice = [6], actor = "host") {
  return executeCommand(state, actor, { type: "RESOLVE_DECISION", decisionId: state.pendingDecision!.id, selectedOptionIds: ids }, normanContent, castingContext(dice));
}

describe("Norman acquisition rerolls", () => {
  it("offers a zero-Clue payment and recalculates purchase strength without moving physical Clues", () => {
    const original = fixture(), state = acquire(original);
    expect(state.pendingDecision?.optionIds).toContain("norman-sanity:0");
    expect(state.pendingDecision?.visibility).toBe("owner");
    const next = unwrap(resolve(state, ["norman-sanity:0"]));
    expect(next.players[0]!.sanity).toBe(6);
    expect(next.players[0]!.clues).toBe(0);
    expect(next.privateState.tokenPoolById).toEqual(original.privateState.tokenPoolById);
    expect(next.pendingDecision?.continuation).toBe("acquire_assets_purchase");
    expect(next.pendingDecision?.selectionBudget).toBe(1);
    expect(next.stateVersion).toBe(original.stateVersion + 2);
    expect(next.actionsRemaining).toBe(2);
    expect(spendNormanClueSubstitution(next, "host")).toBe(false); // same price ledger as Norman's action
    expect(original.players[0]!.sanity).toBe(7);
    expect(JSON.stringify(projectPublicState(next))).not.toMatch(/investigatorAbilityUsage|normanClueSubstitutions/);
  });
  it("spends the penultimate but never the final Sanity", () => {
    for (const sanity of [1, 2]) {
      const state = fixture(); state.players[0]!.sanity = sanity;
      const next = acquire(state);
      expect(next.pendingDecision?.optionIds.includes("norman-sanity:0") ?? false).toBe(sanity === 2);
      if (sanity === 2) expect(unwrap(resolve(next, ["norman-sanity:0"])).players[0]!.sanity).toBe(1);
    }
  });
  it("declines and then completes the action exactly once", () => {
    let state = unwrap(resolve(acquire(), []));
    expect(state.players[0]!.sanity).toBe(7);
    state = unwrap(resolve(state, [])); // buy nothing
    state = unwrap(resolve(state, [])); // discard nothing
    expect(state.actionsRemaining).toBe(1);
    expect(state.performedActions).toContain("acquire_assets");
    expect(state.privateState.investigatorAbilityUsage!.normanClueSubstitutions).toEqual([]);
  });
  it("shares already-spent action or Spell payment and preserves it through acquisition", () => {
    const state = fixture(); expect(spendNormanClueSubstitution(state, "host")).toBe(true);
    const next = acquire(state);
    expect(next.pendingDecision?.optionIds).not.toContain("norman-sanity:0");
    expect(next.privateState.investigatorAbilityUsage).toEqual(state.privateState.investigatorAbilityUsage);
  });
  it("blocks the later Spell payment after acquisition", () => {
    let state = unwrap(resolve(acquire(), ["norman-sanity:1"]));
    state = unwrap(resolve(state, [])); state = unwrap(resolve(state, []));
    state = unwrap(executeCommand(state, "host", { type: "CAST_SPELL", spellId: "spell_feed_the_mind" }, normanContent, castingContext([1, 2])));
    expect(state.pendingDecision?.optionIds).not.toContain("norman-sanity:0");
    expect(canUseNormanSpellReroll(state, "host")).toBe(false);
  });
  it("initializes genuine legacy state without resetting marked usage", () => {
    const state = fixture(); delete state.privateState.investigatorAbilityUsage; delete state.privateState.investigatorAbilityUsageVersion;
    const next = acquire(state);
    expect(next.privateState.investigatorAbilityUsageVersion).toBe(1);
    expect(next.privateState.investigatorAbilityUsage?.normanClueSubstitutions).toEqual([]);
    expect(next.pendingDecision?.optionIds).toContain("norman-sanity:0");
  });
  it("initializes a restored legacy acquisition before regenerating its next reroll choices", () => {
    const source = fixture(); source.players[0]!.clues = 1;
    source.privateState.tokenPoolById.clues = ["clue_london"];
    source.privateState.tokenPoolById["held_clues:host"] = ["clue_arkham"];
    const legacy = acquire(source);
    delete legacy.privateState.investigatorAbilityUsage; delete legacy.privateState.investigatorAbilityUsageVersion;
    legacy.pendingDecision!.optionIds = legacy.pendingDecision!.optionIds.filter(id => !id.startsWith("norman-sanity:"));
    const resumed = unwrap(resolve(legacy, ["die-0"], [1]));
    expect(resumed.privateState.investigatorAbilityUsageVersion).toBe(1);
    expect(resumed.privateState.investigatorAbilityUsage?.normanClueSubstitutions).toEqual([]);
    expect(unwrap(resolve(resumed, ["norman-sanity:0"], [6])).players[0]!.sanity).toBe(6);
  });
  it("rejects wrong owner, replay and final-Sanity stale options without mutation", () => {
    const state = acquire(), before = structuredClone(state);
    expect(resolve(state, ["norman-sanity:0"], [6], "guest").ok).toBe(false);
    expect(state).toEqual(before);
    const paid = unwrap(resolve(state, ["norman-sanity:0"]));
    expect(resolve(paid, ["norman-sanity:0"]).ok).toBe(false);
    const stale = structuredClone(state); stale.players[0]!.sanity = 1;
    expect(resolve(stale, ["norman-sanity:0"]).ok).toBe(false);
    expect(stale.players[0]!.sanity).toBe(1);
  });
  it("refuses Trish's unsupported interaction before initial dice or resumed payment", () => {
    const state = fixture(); state.players[1]!.investigatorId = "trish_scarborough"; state.players[1]!.locationId = "arkham";
    const ctx = castingContext([1, 2]), before = structuredClone(state);
    expect(executeCommand(state, "host", { type: "ACQUIRE_ASSETS" }, normanContent, ctx).ok).toBe(false);
    expect(state).toEqual(before); expect(ctx.rollDie()).toBe(1);
    const pending = acquire(); pending.players[1]!.investigatorId = "trish_scarborough"; pending.players[1]!.locationId = "arkham";
    expect(resolve(pending, ["norman-sanity:0"]).ok).toBe(false);
    expect(pending.players[0]!.sanity).toBe(7);
  });
  it("does not enable unrelated investigators or encounter tests", () => {
    const state = fixture(); state.players[0]!.investigatorId = "mark_harrigan";
    expect(acquire(state).pendingDecision?.optionIds).not.toContain("norman-sanity:0");
    const pending = acquire(); pending.activeTest!.continuation = "location_encounter";
    expect(resolve(pending, ["norman-sanity:0"]).ok).toBe(false);
  });
  it("rejects a missing ledger or forged acquisition decision", () => {
    const state = acquire(); delete state.privateState.investigatorAbilityUsage;
    expect(resolve(state, []).ok).toBe(false);
    const forged = acquire(); forged.pendingDecision!.optionIds.push("norman-sanity:99");
    expect(resolve(forged, []).ok).toBe(false);
  });
  it("rejects corrupted derived test values before they can inflate the purchase budget", () => {
    for (const corrupt of [
      (s: GameState) => { s.activeTest!.successes = 99; },
      (s: GameState) => { s.activeTest!.successThreshold = 2; },
      (s: GameState) => { s.activeTest!.dicePool = 99; },
      (s: GameState) => { s.activeTest!.modifier = 99; },
      (s: GameState) => { s.pendingDecision!.kind = "select_acquired_cards"; },
    ]) {
      const state = acquire(); corrupt(state); const before = structuredClone(state);
      expect(resolve(state, []).ok).toBe(false); expect(state).toEqual(before);
    }
  });
  it("validates legitimate six-doubling acquisition Assets without losing their purchase value", () => {
    const content = { ...normanContent, assets: normanContent.assets.map(asset => asset.id === "a"
      ? { ...asset, engineEffects: [{ type: "acquire_six_counts_as_two" as const }] } : asset) };
    const state = fixture(); state.reserveAssetIds = ["b", "c", "d"]; state.players[0]!.assetIds = ["a"];
    const started = unwrap(executeCommand(state, "host", { type: "ACQUIRE_ASSETS" }, content, castingContext([6, 6])));
    expect(started.activeTest!.successes).toBe(4);
    const next = unwrap(executeCommand(started, "host", { type: "RESOLVE_DECISION", decisionId: started.pendingDecision!.id, selectedOptionIds: [] }, content, castingContext()));
    expect(next.pendingDecision!.selectionBudget).toBe(4);
  });
  it("keeps ordinary physical Clue rerolls independent in either payment order", () => {
    for (const sanityFirst of [false, true]) {
      const source = fixture(); source.players[0]!.clues = 1;
      source.privateState.tokenPoolById.clues = ["clue_london"];
      source.privateState.tokenPoolById["held_clues:host"] = ["clue_arkham"];
      const started = acquire(source);
      let next = unwrap(resolve(started, [sanityFirst ? "norman-sanity:0" : "die-0"], [1]));
      expect(next.players[0]!.clues).toBe(sanityFirst ? 1 : 0);
      expect(next.pendingDecision?.optionIds).toContain(sanityFirst ? "die-0" : "norman-sanity:0");
      next = unwrap(resolve(next, [sanityFirst ? "die-0" : "norman-sanity:0"], [6]));
      expect(next.players[0]!.clues).toBe(0); expect(next.players[0]!.sanity).toBe(6);
      expect(next.privateState.tokenPoolById.clue_discard).toEqual(["clue_arkham"]);
      expect(next.pendingDecision?.selectionBudget).toBe(1);
    }
  });
  it("rolls back exhausted deterministic input and leaves canonical payment untouched", () => {
    const state = fixture(), before = structuredClone(state);
    const ctx = createDeterministicEngineContext({ dice: [1], ids: ["test", "choice"] });
    expect(() => executeCommand(state, "host", { type: "ACQUIRE_ASSETS" }, normanContent, ctx)).not.toThrow();
    expect(state).toEqual(before); expect(ctx.rollDie()).toBe(1);
    const pending = acquire(), pendingBefore = structuredClone(pending);
    const exhausted = createDeterministicEngineContext({ dice: [], ids: ["unused"] });
    const command: GameCommand = { type: "RESOLVE_DECISION", decisionId: pending.pendingDecision!.id, selectedOptionIds: ["norman-sanity:0"] };
    expect(() => executeCommand(pending, "host", command, normanContent, exhausted)).not.toThrow();
    expect(executeCommand(pending, "host", command, normanContent, exhausted).ok).toBe(false);
    expect(pending).toEqual(pendingBefore); expect(exhausted.createId()).toBe("unused");
  });
});
