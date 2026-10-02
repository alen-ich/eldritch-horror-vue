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
    stateVersion: 2, phase: "encounter", activePlayerId: "host", leadInvestigatorId: "host", ancientOneId: "azathoth", doom: 15, omen: 0, greenOmenTokens: 1, turnNumber: 1,
    players: [{ id: "host", investigatorId: "akachi_onyele", locationId, health: 5, sanity: 7, maxHealth: 5, maxSanity: 7, assetIds: [], clues: 0, skillImprovements: {} }, { id: "guest", locationId: "london", assetIds: [], clues: 0, skillImprovements: {} }],
    actionsRemaining: 0, performedActions: [], monsterLocationIds: [], reserveAssetIds: [], assetDiscardIds: [], mysteryProgress: 0, mysteryTarget: 0, completedMysteryIds: [],
    boardClues: [{ id: "chosen", locationId }, { id: "other", locationId }],
    privateState: { deckOrderById: { "encounter:research_azathoth": [`encounter_research_azathoth_0${number}`, "encounter_research_azathoth_08"] }, tokenPoolById: { clues: ["clue_rome"], clue_discard: [], "board_clue:chosen": ["clue_arkham"], "board_clue:other": ["clue_london"], "held_clues:host": [], "held_clues:guest": [] } },
  };
}
const rng = (dice: number[]) => createDeterministicEngineContext({ dice, tokenIndexes: [0], ids: ["test", "decision", "later"] });

describe("internal scan-backed Research encounters", () => {
  const exchangeContent: GameContent = { ...content, artifacts: [{ id: "artifact_ttka_halot" }], conditions: [{ id: "condition_dark_pact_01", kind: "dark_pact", trait: "deal" }] };
  function exchangeState() {
    const before = state(5, "space_2");
    before.privateState.deckOrderById.artifacts = ["artifact_ttka_halot"];
    before.privateState.tokenPoolById["condition:dark_pact"] = ["condition_dark_pact_01"];
    return before;
  }
  function exchangeChoice(before: GameState, selected: string, owner = "host") {
    const offered = resolveResearchEncounter(before, "host", "chosen", exchangeContent, rng([]));
    if (!offered.ok) throw new Error(offered.error.message);
    const serialized: GameState = JSON.parse(JSON.stringify(offered.state));
    return executeCommand(serialized, owner, { type: "RESOLVE_DECISION", decisionId: serialized.pendingDecision!.id, selectedOptionIds: [selected] }, exchangeContent, rng([]));
  }
  it("accepts the scan-authored exchange with exact physical costs and rewards", () => {
    const before = exchangeState(); const snapshot = structuredClone(before);
    const result = exchangeChoice(before, "accept");
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]).toMatchObject({ conditionIds: ["condition_dark_pact_01"], artifactIds: ["artifact_ttka_halot"], clues: 1 });
    expect(result.state.privateState.tokenPoolById["held_clues:host"]).toEqual(["clue_arkham"]);
    expect(result.state.privateState.deckOrderById.artifacts).toEqual([]);
    expect(result.state.boardClues?.map(clue => clue.id)).toEqual(["other"]);
    expect(result.state.activePlayerId).toBe("guest");
    expect(result.state.privateState.deckOrderById["encounter:research_azathoth"]).toEqual(["encounter_research_azathoth_08", "encounter_research_azathoth_05"]);
    expect(before).toEqual(snapshot);
  });
  it("allows refusal and rejects another investigator's acceptance", () => {
    expect(exchangeChoice(exchangeState(), "accept", "guest")).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const result = exchangeChoice(exchangeState(), "skip");
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]?.clues).toBe(0);
    expect(result.state.players[0]?.conditionIds ?? []).toEqual([]);
    expect(result.state.boardClues).toHaveLength(2);
    expect(result.state.privateState.deckOrderById.artifacts).toEqual(["artifact_ttka_halot"]);
  });
  it("cannot pay an unavailable or already held Dark Pact", () => {
    for (const owned of [false, true]) {
      const before = exchangeState(); before.privateState.tokenPoolById["condition:dark_pact"] = [];
      if (owned) before.players[0]!.conditionIds = ["condition_dark_pact_01"];
      const result = resolveResearchEncounter(before, "host", "chosen", exchangeContent, rng([]));
      if (!result.ok) throw new Error(result.error.message);
      expect(result.state.pendingDecision).toBeUndefined(); expect(result.state.players[0]?.clues).toBe(0);
      expect(result.state.privateState.deckOrderById.artifacts).toEqual(["artifact_ttka_halot"]);
    }
  });
  it("never duplicates an unavailable named Artifact but still grants the printed Clue", () => {
    const before = exchangeState(); before.privateState.deckOrderById.artifacts = []; before.players[1]!.artifactIds = ["artifact_ttka_halot"];
    const result = exchangeChoice(before, "accept");
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players[0]).toMatchObject({ clues: 1, conditionIds: ["condition_dark_pact_01"] });
    expect(result.state.players[0]?.artifactIds ?? []).toEqual([]);
    expect(result.state.players[1]?.artifactIds).toEqual(["artifact_ttka_halot"]);
  });
  it("rejects inconsistent Artifact supply before offering or paying the exchange", () => {
    const before = exchangeState(); before.privateState.deckOrderById.artifacts!.push("artifact_ttka_halot");
    const snapshot = structuredClone(before);
    expect(resolveResearchEncounter(before, "host", "chosen", exchangeContent, rng([]))).toMatchObject({ ok: false, error: { code: "ARTIFACT_CONTENT_MISSING" } });
    expect(before).toEqual(snapshot);
  });
  function mysteryState(): GameState {
    const before = state(5);
    before.completedMysteryIds = ["solved_a", "solved_b"];
    before.activeMysteryId = "active";
    before.mysteryProgress = 1; before.mysteryTarget = 2;
    before.privateState.deckOrderById.mysteries = ["undrawn"];
    return before;
  }
  const mysteryContent: GameContent = { ...content, mysteryIdsByAncientOne: { azathoth: ["solved_a", "solved_b", "active", "undrawn"] } };
  it("randomly returns exactly one solved Mystery and shuffles privately without resetting active progress", () => {
    for (const tokenIndex of [0, 1]) {
      const before = mysteryState();
      const result = resolveResearchEncounter(before, "host", "chosen", mysteryContent,
        createDeterministicEngineContext({ dice: [1, 1], tokenIndexes: [tokenIndex], shuffleIndexes: [0] }));
      if (!result.ok) throw new Error(result.error.message);
      const returned = before.completedMysteryIds[tokenIndex]!;
      expect(result.state.completedMysteryIds).toEqual(before.completedMysteryIds.filter(id => id !== returned));
      expect(new Set(result.state.privateState.deckOrderById.mysteries)).toEqual(new Set(["undrawn", returned]));
      expect(result.state).toMatchObject({ activeMysteryId: "active", mysteryProgress: 1, mysteryTarget: 2, activePlayerId: "guest", stateVersion: 3 });
      expect(result.events).toContainEqual({ type: "MYSTERY_RETURNED_TO_DECK", mysteryId: returned });
      expect(result.state.boardClues).toEqual(before.boardClues);
      expect(JSON.stringify(projectStateForPlayer(result.state, "guest"))).not.toContain("undrawn");
      expect(before.completedMysteryIds).toEqual(["solved_a", "solved_b"]);
    }
  });
  it("does nothing when no Mystery is solved, without requiring deck or random selection input", () => {
    const result = resolveResearchEncounter(state(5), "host", "chosen", content, rng([1, 1]));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.completedMysteryIds).toEqual([]);
    expect(result.events.some(event => event.type === "MYSTERY_RETURNED_TO_DECK")).toBe(false);
    expect(result.state.doom).toBe(15);
  });
  it("does not return a Mystery after a passed City test", () => {
    const before = mysteryState();
    const result = resolveResearchEncounter(before, "host", "chosen", mysteryContent, rng([6, 1]));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.completedMysteryIds).toEqual(before.completedMysteryIds);
    expect(result.state.privateState.deckOrderById.mysteries).toEqual(["undrawn"]);
    expect(result.state.players[0]?.clues).toBe(2);
  });
  it("rejects duplicate, unknown, or absent Mystery supply atomically", () => {
    for (const invalid of ["duplicate", "unknown", "missing"] as const) {
      const before = mysteryState();
      if (invalid === "duplicate") before.privateState.deckOrderById.mysteries = ["solved_a"];
      if (invalid === "unknown") before.completedMysteryIds = ["expansion_mystery"];
      if (invalid === "missing") delete before.privateState.deckOrderById.mysteries;
      const snapshot = structuredClone(before);
      expect(resolveResearchEncounter(before, "host", "chosen", mysteryContent, rng([1, 1]))).toMatchObject({ ok: false, error: { code: "MYSTERY_CONTENT_MISSING" } });
      expect(before).toEqual(snapshot);
    }
  });
  function choose(before: GameState, option: string[] = []) {
    return executeCommand(JSON.parse(JSON.stringify(before)), "host", { type: "RESOLVE_DECISION", decisionId: before.pendingDecision!.id, selectedOptionIds: option }, content, rng([]));
  }
  it("offers each physical Omen space privately, including repeated symbols, with no Doom", () => {
    for (const position of [0, 1, 2, 3]) {
      const before = state(1, "the_amazon");
      before.omen = 3; before.doom = 1; before.greenOmenTokens = 4;
      before.activeGateIds = ["missing_gate"]; // No matching-Gate lookup for movement without Doom.
      const started = resolveResearchEncounter(before, "host", "chosen", content, rng([6]));
      if (!started.ok) throw new Error(started.error.message);
      expect(started.state.pendingDecision?.optionIds).toEqual(["omen-0", "omen-1", "omen-2", "omen-3"]);
      expect(started.state.players[0]?.clues).toBe(1);
      expect(projectStateForPlayer(started.state, "guest").pendingDecision).not.toHaveProperty("optionIds");
      expect(choose(started.state, ["omen-4"]).ok).toBe(false);
      const finished = choose(started.state, [`omen-${position}`]);
      if (!finished.ok) throw new Error(finished.error.message);
      expect(finished.state).toMatchObject({ omen: position, doom: 1, greenOmenTokens: 4, activePlayerId: "guest" });
      expect(finished.state.gameResult).toBeUndefined();
    }
  });
  it("places green Eldritch tokens without immediate Doom loss, even on the current green space", () => {
    const result = resolveResearchEncounter(state(2), "host", "chosen", content, rng([1, 1, 1]));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state).toMatchObject({ omen: 0, greenOmenTokens: 2, doom: 15 });
    expect(result.state.boardClues).toHaveLength(2); // Failed City test does not collect.
    expect(result.events).toContainEqual({ type: "OMEN_ELDRITCH_CHANGED", position: 0, amount: 1, tokens: 2 });
  });
  it("removes one existing green token after an unconditional Clue grant, or does nothing at zero", () => {
    for (const tokens of [0, 3]) {
      const before = state(5, "the_amazon"); before.greenOmenTokens = tokens;
      const started = resolveResearchEncounter(before, "host", "chosen", content, rng([6, 1]));
      if (!started.ok) throw new Error(started.error.message);
      const finished = choose(started.state);
      if (!finished.ok) throw new Error(finished.error.message);
      expect(finished.state.greenOmenTokens).toBe(Math.max(0, tokens - 1));
      expect(finished.state.players[0]?.clues).toBe(1);
      expect(finished.state.doom).toBe(15);
    }
  });
  it("advances through matching Gates and includes Azathoth tokens when entering green", () => {
    const before = state(6); before.omen = 3; before.greenOmenTokens = 2;
    before.activeGateIds = ["green_gate"];
    const rules = { ...content, gates: [{ id: "green_gate", locationId: "arkham" as const, omenSymbol: "comet" as const }] };
    const result = resolveResearchEncounter(before, "host", "chosen", rules, rng([1, 1]));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state).toMatchObject({ omen: 0, doom: 12 });
    expect(result.events).toContainEqual({ type: "OMEN_ADVANCED", position: 0, symbol: "comet", doomAdvance: 3 });
    expect(result.state.boardClues).toHaveLength(2);
  });
  it("ends the game and cycles the Research card once when Omen advancement awakens Azathoth", () => {
    const before = state(6); before.omen = 3; before.doom = 1;
    const result = resolveResearchEncounter(before, "host", "chosen", content, rng([1, 1]));
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.gameResult).toBe("investigators_lose");
    expect(result.state.pendingLocationEncounter).toBeUndefined();
    expect(result.state.privateState.deckOrderById["encounter:research_azathoth"]).toEqual(["encounter_research_azathoth_08", "encounter_research_azathoth_06"]);
    expect(result.state.activePlayerId).toBe("host");
  });
  it("rejects missing Omen data atomically instead of throwing or consuming the deck", () => {
    for (const omen of [undefined, -1, 4, 1.5]) {
      const before = state(6); before.omen = omen;
      const snapshot = structuredClone(before);
      expect(resolveResearchEncounter(before, "host", "chosen", content, rng([1, 1])).ok).toBe(false);
      expect(before).toEqual(snapshot);
    }
  });
  it("supports all 24 verified Azathoth sections", () => {
    const supported = baseGameResearchEncounterRules.filter(card => card.deck === "research_azathoth").flatMap(card => Object.entries(card.sections)
      .filter(([, instruction]) => bindResearchInstruction(instruction, "marker"))
      .map(([section]) => `${card.number}:${section}`));
    expect(supported).toHaveLength(24);
    expect(supported).toContain("5:city");
    expect(supported).toContain("5:sea");
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
    const before = state(5, "space_2"); before.players[0]!.assetIds = ["unsupported_asset"];
    const snapshot = structuredClone(before);
    const context = createDeterministicEngineContext({});
    expect(resolveResearchEncounter(before, "host", "chosen", content, context)).toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } });
    expect(before).toEqual(snapshot);
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
