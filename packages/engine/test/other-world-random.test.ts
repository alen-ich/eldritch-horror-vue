import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, executeCommand, resolveOtherWorldEncounter, type CommandResult, type EngineContext, type GameContent, type GameState } from "../src/index.js";

const card = "encounter_other_world_02";
const empty = { kind: "effects", effects: [] };
const rules: GameContent = {
  otherWorldEncounterIds: [card, "encounter_other_world_03"],
  otherWorldEncounters: [{ id: card, deck: "other_world", sections: { initial: { kind: "test", skill: "will", modifier: 0, pass: empty, fail: empty } } }],
  gates: [{ id: "gate_arkham", locationId: "arkham", omenSymbol: "eclipse" }, { id: "gate_london", locationId: "london", omenSymbol: "constellation" }],
  clues: [{ id: "clue_a", locationId: "arkham" }, { id: "clue_b", locationId: "london" }],
  map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city", london: "city" } },
  investigators: { trish_scarborough: { startingLocationId: "arkham", health: 7, sanity: 5, skills: { lore: 1, influence: 1, observation: 1, strength: 1, will: 2 }, startingAssetIds: [], startingClues: 0 } },
  assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};
function fixture(clues = 0): GameState {
  return {
    stateVersion: 2, phase: "encounter", activePlayerId: "host", leadInvestigatorId: "host", ancientOneId: "azathoth", doom: 15, turnNumber: 1,
    players: [{ id: "host", investigatorId: "trish_scarborough", locationId: "arkham", health: 7, sanity: 5, maxHealth: 7, maxSanity: 5, assetIds: [], clues, skillImprovements: {} }, { id: "guest", locationId: "london", assetIds: [], clues: 0, skillImprovements: {} }],
    actionsRemaining: 0, performedActions: [], monsterLocationIds: [], reserveAssetIds: [], assetDiscardIds: [], mysteryProgress: 0, mysteryTarget: 0, completedMysteryIds: [],
    activeGateIds: ["gate_arkham"], discardedGateIds: [],
    privateState: { deckOrderById: { "encounter:other_world": [...rules.otherWorldEncounterIds!], gates: ["gate_london"] }, tokenPoolById: { clues: clues ? [] : ["clue_a", "clue_b"], clue_discard: [], "held_clues:host": clues ? ["clue_a", "clue_b"] : [], "held_clues:guest": [] } },
  };
}
function accepted(result: CommandResult): GameState {
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}
function draw(state: GameState, context: EngineContext, viaCommand: boolean): CommandResult {
  return viaCommand ? executeCommand(state, "host", { type: "RESOLVE_OTHER_WORLD_ENCOUNTER", gateId: "gate_arkham" }, rules, context)
    : resolveOtherWorldEncounter(state, "host", "gate_arkham", rules, context);
}

describe("Other World atomic randomness", () => {
  it.each([false, true])("returns a rule error and restores partial dice (command=%s)", viaCommand => {
    const state = fixture(), before = structuredClone(state), context = createDeterministicEngineContext({ dice: [6] });
    expect(draw(state, context, viaCommand)).toMatchObject({ ok: false, error: { code: "RANDOM_INPUT_REQUIRED" } });
    expect(state).toEqual(before);
    expect(context.rollDie()).toBe(6);
  });
  it("restores a paid reroll and its die after a later decision ID failure", () => {
    const initial = accepted(draw(fixture(2), createDeterministicEngineContext({ dice: [1, 1], ids: ["test", "choice"] }), false));
    const state = JSON.parse(JSON.stringify(initial)) as GameState, before = structuredClone(state);
    const context = createDeterministicEngineContext({ dice: [6] });
    expect(executeCommand(state, "host", { type: "RESOLVE_DECISION", decisionId: state.pendingDecision!.id, selectedOptionIds: ["die-0"] }, rules, context))
      .toMatchObject({ ok: false, error: { code: "RANDOM_INPUT_REQUIRED" } });
    expect(state).toEqual(before);
    expect(state.players[0]!.clues).toBe(2);
    expect(context.rollDie()).toBe(6);
  });
  it("keeps successful consumption and allows a valid retained-context continuation", () => {
    const context = createDeterministicEngineContext({ dice: [1, 1, 6, 4], ids: ["test", "choice", "reroll"] });
    const initial = accepted(draw(fixture(2), context, true));
    const next = accepted(executeCommand(initial, "host", { type: "RESOLVE_DECISION", decisionId: initial.pendingDecision!.id, selectedOptionIds: ["die-0"] }, rules, context));
    expect(next.players[0]!.clues).toBe(1);
    expect(next.activeTest!.dice).toEqual([6, 1]);
    expect(context.rollDie()).toBe(4);
  });
  it("rejects another owner without consuming the retained input", () => {
    const initial = accepted(draw(fixture(2), createDeterministicEngineContext({ dice: [1, 1], ids: ["test", "choice"] }), false));
    const before = structuredClone(initial), context = createDeterministicEngineContext({ dice: [6] });
    expect(executeCommand(initial, "guest", { type: "RESOLVE_DECISION", decisionId: initial.pendingDecision!.id, selectedOptionIds: ["die-0"] }, rules, context).ok).toBe(false);
    expect(initial).toEqual(before); expect(context.rollDie()).toBe(6);
  });
  it("keeps contexts without checkpoint compatible", () => {
    const context = createDeterministicEngineContext({ dice: [6, 6] }); delete context.checkpoint;
    expect(draw(fixture(), context, false).ok).toBe(true);
  });
});

// Pin all sequence kinds for the reusable family boundary, including future reshuffles.
import { withOtherWorldRandomTransaction } from "../src/other-world-random.js";

describe("Other World random transaction boundary", () => {
  it.each(["rejected", "throw"])("restores dice, IDs, token draws and shuffle input on %s", outcome => {
    const context = createDeterministicEngineContext({ dice: [6], ids: ["kept"], tokenIndexes: [1], shuffleIndexes: [0] });
    const result = withOtherWorldRandomTransaction(context, () => {
      expect(context.rollDie()).toBe(6); expect(context.createId()).toBe("kept");
      expect(context.drawToken(["a", "b"]).token).toBe("b"); expect(context.shuffle([1, 2])).toEqual([2, 1]);
      if (outcome === "throw") throw new Error("private random input details");
      return { ok: false, error: { code: "ENCOUNTER_CONTENT_MISSING", message: "Missing content." } };
    });
    expect(result).toMatchObject({ ok: false, error: { code: outcome === "throw" ? "RANDOM_INPUT_REQUIRED" : "ENCOUNTER_CONTENT_MISSING" } });
    expect(JSON.stringify(result)).not.toContain("private random input details");
    expect(context.rollDie()).toBe(6); expect(context.createId()).toBe("kept");
    expect(context.drawToken(["a", "b"]).token).toBe("b"); expect(context.shuffle([1, 2])).toEqual([2, 1]);
  });
  it("converts exceptions without requiring a checkpoint implementation", () => {
    const context = createDeterministicEngineContext({ dice: [6] }); delete context.checkpoint;
    expect(withOtherWorldRandomTransaction(context, () => { context.rollDie(); throw new Error("exhausted"); }))
      .toMatchObject({ ok: false, error: { code: "RANDOM_INPUT_REQUIRED" } });
  });
});
