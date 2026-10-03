import { describe, expect, it } from "vitest";
import { baseGameAssets } from "../../content/src/assets.js";
import { createLobby, createDeterministicEngineContext, executeCommand, resolveLocationEncounter, resolveResearchEncounter, projectStateForPlayer, type GameContent, type GameState } from "../src/index.js";
import { baseGameResearchEncounterRules } from "../../content/src/research-encounter-rules.js";

const id = "asset_lucky_cigarette_case";
const option = `asset-increment:${id}:0`;
const empty = { kind: "effects", effects: [] };
function rules(skill: "lore" | "influence" | "observation" | "strength" | "will" = "observation"): GameContent {
  return { assets: baseGameAssets, researchEncounters: baseGameResearchEncounterRules,
    clues: [{ id: "clue_arkham", locationId: "arkham" }],
    investigators: { akachi_onyele: { startingLocationId: "arkham", health: 5, sanity: 7, startingAssetIds: [], startingClues: 0, skills: { lore: 2, influence: 2, observation: 2, strength: 2, will: 2 } } },
    map: { locationTypes: { arkham: "city" }, adjacentLocationIds: {}, routes: [] }, mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
    locationEncounters: [{ id: "encounter_general_01", deck: "general", sections: { city: { kind: "test", skill, modifier: 0, pass: empty, fail: empty } } }],
  };
}
function fixture(): GameState {
  const state = createLobby(["host", "guest"]); state.phase = "encounter"; state.ancientOneId = "cthulhu"; state.doom = 12;
  state.activePlayerId = state.leadInvestigatorId = "host";
  for (const player of state.players) Object.assign(player, { investigatorId: "akachi_onyele", locationId: "arkham", health: 5, sanity: 7, clues: 0 });
  state.players[0]!.assetIds = [id]; state.privateState.deckOrderById["encounter:general"] = ["encounter_general_01"];
  return state;
}
function begin(state = fixture(), content = rules(), die = 4): GameState {
  const result = resolveLocationEncounter(state, "host", "general", content, createDeterministicEngineContext({ dice: [die, die], ids: ["test", "choice"] }));
  if (!result.ok) throw new Error(result.error.message); return result.state;
}
function choose(state: GameState, selected: string | null = option, content = rules(), die = 1, owner = "host") {
  return executeCommand(state, owner, { type: "RESOLVE_DECISION", decisionId: state.pendingDecision!.id, selectedOptionIds: selected ? [selected] : [] }, content,
    createDeterministicEngineContext({ dice: [die], ids: ["next"] }));
}
describe("Lucky Cigarette Case's round-limited die-result modification", () => {
  it.each(["lore", "influence", "observation", "strength", "will"] as const)("offers an optional modifier for %s without adding dice", skill => {
    const state = begin(fixture(), rules(skill)); expect(state.activeTest?.dicePool).toBe(2);
    expect(state.pendingDecision?.optionLabels?.[option]).toBe("Lucky Cigarette Case: add 1 to die 1 (4 → 5; no Clue)");
    const snapshot = structuredClone(state); const result = choose(state, option, rules(skill)); if (!result.ok) throw new Error(result.error.message);
    expect(state).toEqual(snapshot); expect(result.state.players[0]?.clues).toBe(0); expect(result.state.players[0]?.assetIds).toEqual([id]);
    expect(result.state.usedAssetDieModifierIds).toEqual([id]); expect(result.state.usedAssetRerollIds).toEqual([]);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "TEST_DIE_MODIFIED", dieIndex: 0, result: 5, successes: 1 }));
    expect(result.events.some(event => event.type === "TEST_DIE_REROLLED")).toBe(false);
  });
  it.each([["blessed", 3, 4], ["cursed", 5, 6]] as const)("respects %s thresholds", (condition, die, resultDie) => {
    const state = fixture(); state.players[0]!.conditionIds = [`condition_${condition}_01`];
    const result = choose(begin(state, rules(), die)); if (!result.ok) throw new Error(result.error.message);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "TEST_DIE_MODIFIED", result: resultDie, successes: 1 }));
  });
  it("declining preserves round availability", () => {
    const result = choose(begin(), null); if (!result.ok) throw new Error(result.error.message);
    expect(result.state.usedAssetDieModifierIds).toEqual([]); result.state.activePlayerId = "host";
    expect(begin(result.state).pendingDecision?.optionIds).toContain(option);
  });
  it.each([true, false])("keeps the Foot and modifier independent in either order (increment first=%s)", incrementFirst => {
    const state = fixture(); state.players[0]!.assetIds.push("asset_lucky_rabbits_foot");
    const foot = "asset-reroll:asset_lucky_rabbits_foot:0";
    const first = choose(begin(state), incrementFirst ? option : foot, rules(), 4); if (!first.ok) throw new Error(first.error.message);
    expect(first.state.pendingDecision?.optionIds).toContain(incrementFirst ? foot : option);
    const second = choose(JSON.parse(JSON.stringify(first.state)), incrementFirst ? foot : option, rules(), 1); if (!second.ok) throw new Error(second.error.message);
    expect(second.state.usedAssetDieModifierIds).toEqual([id]); expect(second.state.usedAssetRerollIds).toEqual(["asset_lucky_rabbits_foot"]);
    // A later reroll replaces the bumped result; it does not retain the +1.
    expect(second.events).toContainEqual(expect.objectContaining({ type: incrementFirst ? "TEST_DIE_REROLLED" : "TEST_DIE_MODIFIED", result: incrementFirst ? 1 : 5 }));
  });
  it("counts a bumped five as six for Fine Clothes during Acquire Assets", () => {
    const state = fixture(); state.phase = "action"; state.actionsRemaining = 2; state.players[0]!.assetIds.push("asset_fine_clothes");
    const offered = executeCommand(state, "host", { type: "ACQUIRE_ASSETS" }, rules(), createDeterministicEngineContext({ dice: [5, 1], ids: ["test", "choice"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    const result = choose(offered.state); if (!result.ok) throw new Error(result.error.message);
    expect(result.state.pendingDecision?.selectionBudget).toBe(2); expect(result.state.players[0]?.clues).toBe(0);
  });
  it("can turn a real Research failure into collection of the exact Clue", () => {
    const state = fixture(); state.boardClues = [{ id: "marker", locationId: "arkham" }];
    state.privateState.tokenPoolById = { "board_clue:marker": ["clue_arkham"], "held_clues:host": [], clues: [], clue_discard: [] };
    state.privateState.deckOrderById["encounter:research_cthulhu"] = ["encounter_research_cthulhu_01"];
    const offered = resolveResearchEncounter(state, "host", "marker", rules(), createDeterministicEngineContext({ dice: [4, 1], ids: ["test", "choice"] }));
    if (!offered.ok) throw new Error(offered.error.message);
    const result = choose(offered.state); if (!result.ok) throw new Error(result.error.message);
    expect(result.state.boardClues).toEqual([]); expect(result.state.privateState.tokenPoolById["held_clues:host"]).toEqual(["clue_arkham"]);
    expect(result.state.activePlayerId).toBe("guest");
  });
  it("uses round identity across new tests, ownership changes and next-round reset", () => {
    const used = choose(begin()); if (!used.ok) throw new Error(used.error.message);
    const state = used.state; state.activePlayerId = "host"; expect(begin(state).pendingDecision).toBeUndefined();
    state.players[0]!.assetIds = []; state.players[1]!.assetIds = [id]; state.activePlayerId = "guest";
    const guest = resolveLocationEncounter(state, "guest", "general", rules(), createDeterministicEngineContext({ dice: [4, 4], ids: ["test"] }));
    if (!guest.ok) throw new Error(guest.error.message); expect(guest.state.pendingDecision).toBeUndefined();
    state.players[0]!.assetIds = [id]; state.players[1]!.assetIds = []; state.phase = "mythos"; state.activePlayerId = "host"; state.replacementWindow = true;
    expect(executeCommand(state, "guest", { type: "BEGIN_NEXT_ROUND" }, rules()).ok).toBe(false);
    const next = executeCommand(state, "host", { type: "BEGIN_NEXT_ROUND" }, rules()); if (!next.ok) throw new Error(next.error.message);
    expect(next.state.usedAssetDieModifierIds).toEqual([]); next.state.phase = "encounter"; expect(begin(next.state).pendingDecision?.optionIds).toContain(option);
  });
  it.each(["used", "lost", "duplicate", "index", "amount"])("rejects a %s source/selection atomically", change => {
    const state = begin(); let selected = option;
    if (change === "used") state.usedAssetDieModifierIds = [id];
    if (change === "lost") state.players[0]!.assetIds = [];
    if (change === "duplicate") state.assetDiscardIds.push(id);
    if (change === "index") selected = `asset-increment:${id}:99`;
    if (change === "amount") selected = `asset-increment:${id}:0:2`;
    const snapshot = structuredClone(state); expect(choose(state, selected)).toMatchObject({ ok: false, error: { code: "INVALID_DECISION_SELECTION" } }); expect(state).toEqual(snapshot);
  });
  it("protects owner choices, supports old states and copies round usage safely", () => {
    const state = fixture(); delete state.usedAssetDieModifierIds; const offered = begin(state);
    expect(projectStateForPlayer(offered, "guest").pendingDecision).not.toHaveProperty("optionIds");
    expect(choose(offered, option, rules(), 1, "guest")).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const result = choose(JSON.parse(JSON.stringify(offered))); if (!result.ok) throw new Error(result.error.message);
    projectStateForPlayer(result.state).usedAssetDieModifierIds!.push("forged"); expect(result.state.usedAssetDieModifierIds).toEqual([id]);
  });
  it("does not offer a colleague's card or a beyond-six modification", () => {
    const state = fixture(); state.players[0]!.assetIds = []; state.players[1]!.assetIds = [id]; expect(begin(state).pendingDecision).toBeUndefined();
    expect(begin(fixture(), rules(), 6).pendingDecision).toBeUndefined();
  });
  it("rejects duplicate modifier identities before the first encounter roll", () => {
    const state = fixture(); state.reserveAssetIds.push(id); const snapshot = structuredClone(state);
    expect(resolveLocationEncounter(state, "host", "general", rules(), createDeterministicEngineContext({ dice: [4, 4] })))
      .toMatchObject({ ok: false, error: { code: "ENCOUNTER_UNSUPPORTED" } }); expect(state).toEqual(snapshot);
  });
  it("keeps physical Clue rerolls available after modification and rejects modifier replay", () => {
    const state = fixture(); state.players[0]!.clues = 1;
    state.privateState.tokenPoolById = { clues: [], "held_clues:host": ["clue_arkham"], clue_discard: [] };
    const modified = choose(begin(state)); if (!modified.ok) throw new Error(modified.error.message);
    expect(modified.state.activeTest?.dice).toEqual([5, 4]); expect(modified.state.players[0]?.clues).toBe(1);
    expect(choose(modified.state)).toMatchObject({ ok: false, error: { code: "INVALID_DECISION_SELECTION" } });
    const rerolled = choose(modified.state, "die-0", rules(), 1); if (!rerolled.ok) throw new Error(rerolled.error.message);
    expect(rerolled.state.privateState.tokenPoolById.clue_discard).toEqual(["clue_arkham"]);
    expect(rerolled.events).toContainEqual(expect.objectContaining({ type: "TEST_DIE_REROLLED", result: 1, successes: 0 }));
    expect(rerolled.state.usedAssetDieModifierIds).toEqual([id]);
  });
});
