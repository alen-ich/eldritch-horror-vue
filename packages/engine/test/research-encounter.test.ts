import { describe, expect, it } from "vitest";
import { baseGameResearchEncounterRules } from "../../content/src/research-encounter-rules.js";
import { bindResearchInstruction } from "../src/research-instructions.js";
import { createDeterministicEngineContext, executeCommand, projectStateForPlayer, resolveResearchEncounter, type GameContent, type GameState } from "../src/index.js";

const content: GameContent = {
  researchEncounters: baseGameResearchEncounterRules,
  clues: [{ id: "clue_arkham", locationId: "arkham" }, { id: "clue_london", locationId: "london" }, { id: "clue_rome", locationId: "rome" }],
  map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city", space_2: "sea", the_amazon: "wilderness", london: "city", rome: "city" } },
  investigators: { akachi_onyele: { startingLocationId: "arkham", health: 5, sanity: 7, skills: { lore: 3, influence: 2, observation: 2, strength: 2, will: 4 }, startingAssetIds: [], startingClues: 0 } },
  assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};
function state(number = 1, locationId = "arkham"): GameState {
  return {
    stateVersion: 2, phase: "encounter", activePlayerId: "host", leadInvestigatorId: "host", ancientOneId: "azathoth", doom: 15, turnNumber: 1,
    players: [{ id: "host", investigatorId: "akachi_onyele", locationId, health: 5, sanity: 7, maxHealth: 5, maxSanity: 7, assetIds: [], clues: 0, skillImprovements: {} }, { id: "guest", locationId: "london", assetIds: [], clues: 0, skillImprovements: {} }],
    actionsRemaining: 0, performedActions: [], monsterLocationIds: [], reserveAssetIds: [], assetDiscardIds: [], mysteryProgress: 0, mysteryTarget: 0, completedMysteryIds: [],
    boardClues: [{ id: "chosen", locationId }, { id: "other", locationId }],
    privateState: { deckOrderById: { "encounter:research_azathoth": [`encounter_research_azathoth_0${number}`, "encounter_research_azathoth_08"] }, tokenPoolById: { clues: ["clue_rome"], clue_discard: [], "board_clue:chosen": ["clue_arkham"], "board_clue:other": ["clue_london"], "held_clues:host": [], "held_clues:guest": [] } },
  };
}
const rng = (dice: number[]) => createDeterministicEngineContext({ dice, tokenIndexes: [0], ids: ["test", "decision", "later"] });

describe("internal scan-backed Research encounters", () => {
  it("supports exactly 12 verified Azathoth sections and rejects all other branches up front", () => {
    const supported = baseGameResearchEncounterRules.flatMap(card => Object.entries(card.sections)
      .filter(([, instruction]) => bindResearchInstruction(instruction, "marker"))
      .map(([section]) => `${card.number}:${section}`));
    expect(supported).toEqual(["1:city", "1:sea", "2:wilderness", "2:sea", "3:city", "4:city", "4:wilderness", "7:city", "7:wilderness", "7:sea", "8:city", "8:wilderness"]);
  });
  it("gains the exact encountered Clue plus an additional supply Clue and cycles once", () => {
    const before = state();
    const result = resolveResearchEncounter(before, "host", "chosen", content, rng([6]));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]?.clues).toBe(2);
    expect(result.state.privateState.tokenPoolById["held_clues:host"]).toEqual(["clue_arkham", "clue_rome"]);
    expect(result.state.boardClues).toEqual([{ id: "other", locationId: "arkham" }]);
    expect(result.state.privateState.deckOrderById["encounter:research_azathoth"]).toEqual(["encounter_research_azathoth_08", "encounter_research_azathoth_01"]);
    expect(result.state.activePlayerId).toBe("guest");
    expect(result.state.stateVersion).toBe(3);
    expect(result.events).toContainEqual({ type: "RESEARCH_ENCOUNTER_RESOLVED", playerId: "host", cardId: "encounter_research_azathoth_01", deck: "research_azathoth", dice: [6], successes: 1 });
    expect(before.players[0]?.clues).toBe(0);
  });
  it("retains the board Clue after a failed collection test", () => {
    const before = state();
    const result = resolveResearchEncounter(before, "host", "chosen", content, rng([1]));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.boardClues).toEqual(before.boardClues);
    expect(result.state.players[0]?.clues).toBe(0);
    expect(result.state.activePlayerId).toBe("guest");
  });
  it("persists owner-only rerolls and resumes the exact collection after serialization", () => {
    const before = state();
    before.players[0]!.clues = 1;
    before.privateState.tokenPoolById["held_clues:host"] = ["clue_rome"];
    before.privateState.tokenPoolById.clues = [];
    const started = resolveResearchEncounter(before, "host", "chosen", content, rng([1]));
    if (!started.ok) throw new Error(started.error.message);
    expect(started.state.boardClues).toHaveLength(2);
    expect(projectStateForPlayer(started.state, "guest").pendingDecision).not.toHaveProperty("optionIds");
    expect(projectStateForPlayer(started.state, "host")).not.toHaveProperty("pendingLocationEncounter");
    const decisionId = started.state.pendingDecision!.id;
    expect(executeCommand(started.state, "guest", { type: "RESOLVE_DECISION", decisionId, selectedOptionIds: ["die-0"] }, content, rng([6])).ok).toBe(false);
    const rerolled = executeCommand(JSON.parse(JSON.stringify(started.state)), "host", { type: "RESOLVE_DECISION", decisionId, selectedOptionIds: ["die-0"] }, content, rng([6]));
    if (!rerolled.ok) throw new Error(rerolled.error.message);
    expect(rerolled.state.players[0]?.clues).toBe(2);
    expect(rerolled.state.activePlayerId).toBe("guest");
    expect(rerolled.state.boardClues).toHaveLength(1);
  });
  it("keeps unconditional collection before a failed later test", () => {
    const started = resolveResearchEncounter(state(2, "space_2"), "host", "chosen", content, rng([1, 1]));
    if (!started.ok) throw new Error(started.error.message);
    expect(started.state.players[0]?.clues).toBe(1);
    expect(started.state.boardClues).toHaveLength(1);
    // The newly gained Clue is available for the subsequent test's reroll.
    const finished = executeCommand(started.state, "host", { type: "RESOLVE_DECISION", decisionId: started.state.pendingDecision!.id, selectedOptionIds: [] }, content, rng([]));
    if (!finished.ok) throw new Error(finished.error.message);
    expect(finished.state.players[0]).toMatchObject({ clues: 1, health: 3 });
    expect(finished.state.activePlayerId).toBe("guest");
  });
  it("preflights unsupported branches before any card, token, or RNG consumption", () => {
    const before = state(1, "the_amazon");
    const snapshot = structuredClone(before);
    const context = createDeterministicEngineContext({});
    expect(resolveResearchEncounter(before, "host", "chosen", content, context)).toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } });
    expect(before).toEqual(snapshot);
    const artifact = state(5, "space_2");
    expect(resolveResearchEncounter(artifact, "host", "chosen", content, context).ok).toBe(false);
  });
  it("rejects wrong owner, remote or missing markers, wrong Ancient One, assets and inconsistent tokens", () => {
    const before = state();
    expect(resolveResearchEncounter(before, "guest", "chosen", content, rng([])).ok).toBe(false);
    expect(resolveResearchEncounter(before, "host", "missing", content, rng([])).ok).toBe(false);
    before.boardClues![0]!.locationId = "london";
    expect(resolveResearchEncounter(before, "host", "chosen", content, rng([])).ok).toBe(false);
    before.boardClues![0]!.locationId = "arkham";
    before.ancientOneId = "cthulhu";
    expect(resolveResearchEncounter(before, "host", "chosen", content, rng([])).ok).toBe(false);
    before.ancientOneId = "azathoth";
    before.players[0]!.assetIds = ["asset_weapon"];
    expect(resolveResearchEncounter(before, "host", "chosen", content, rng([])).ok).toBe(false);
    before.players[0]!.assetIds = [];
    before.privateState.tokenPoolById["board_clue:chosen"] = [];
    expect(resolveResearchEncounter(before, "host", "chosen", content, rng([])).ok).toBe(false);
  });
});
