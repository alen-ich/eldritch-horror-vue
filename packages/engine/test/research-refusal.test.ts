import { describe, expect, it } from "vitest";
import { baseGameResearchEncounterRules } from "../../content/src/research-encounter-rules.js";
import { baseGameConditions } from "../../content/src/conditions.js";
import { baseGameMonsters } from "../../content/src/monsters.js";
import { spellState, spellContent } from "./spell-fixtures.js";
import { bindResearchInstruction } from "../src/research-instructions.js";
import { createDeterministicEngineContext, executeCommand, resolveResearchEncounter, projectStateForPlayer, validateResearchContinuationState, type CommandResult, type GameState, type GameContent } from "../src/index.js";

const content: GameContent = { ...spellContent, researchEncounters: baseGameResearchEncounterRules, conditions: baseGameConditions, monsters: baseGameMonsters,
  map: { ...spellContent.map, adjacentLocationIds: { space_2: ["arkham"], arkham: ["space_2", "london"], london: ["arkham"] }, locationTypes: { space_2: "sea", arkham: "city", london: "city" } },
  investigators: { ...spellContent.investigators, trish_scarborough: { ...spellContent.investigators.trish_scarborough!, skills: { lore: 3, will: 4, strength: 8, influence: 2, observation: 2 } } },
  clues: [{ id: "clue_arkham", locationId: "arkham" }, { id: "clue_london", locationId: "london" }] };
function state(clues = 0): GameState {
  const s = spellState(); s.phase = "encounter"; s.ancientOneId = "cthulhu"; s.players[0]!.locationId = "space_2"; s.players[0]!.clues = clues;
  s.boardClues = [{ id: "chosen", locationId: "space_2" }, { id: "other", locationId: "space_2" }];
  s.monsters = [{ id: "physical", monsterId: "monster_star_spawn", locationId: "arkham", damage: 2, setAside: true }];
  s.privateState.deckOrderById["encounter:research_cthulhu"] = ["encounter_research_cthulhu_01", "encounter_research_cthulhu_02"];
  Object.assign(s.privateState.tokenPoolById, { "board_clue:chosen": ["clue_arkham"], "board_clue:other": ["clue_london"], "held_clues:host": clues ? ["clue_london"] : [], clues: [], monsters: ["monster_star_spawn"], "set_aside:monster_star_spawn": ["monster_star_spawn"] });
  // Keep the optional reroll Clue distinct from the second board marker.
  if (clues) { s.boardClues!.pop(); delete s.privateState.tokenPoolById["board_clue:other"]; }
  for (const c of baseGameConditions) (s.privateState.tokenPoolById[`condition:${c.kind}`] ??= []).push(c.id);
  return s;
}
function accepted(r: CommandResult): GameState { if (!r.ok) throw new Error(r.error.code + ": " + r.error.message); return r.state; }
const rng = (die = 6) => createDeterministicEngineContext({ dice: Array<number>(8).fill(die), ids: ["test", "choice", "next"], tokenIndexes: [0], shuffleIndexes: Array<number>(30).fill(0) });
function offered(s = state()): GameState { return accepted(resolveResearchEncounter(s, "host", "chosen", content, createDeterministicEngineContext({ ids: ["offer"] }))); }
function choose(s: GameState, selected: string, context = rng()): CommandResult {
  return executeCommand(s, "host", { type: "RESOLVE_DECISION", decisionId: s.pendingDecision!.id, selectedOptionIds: [selected] }, content, context);
}
function physicalUnchanged(after: GameState, before: GameState): void {
  expect(after.monsters).toEqual(before.monsters);
  for (const pool of ["monsters", "set_aside:monster_star_spawn"]) expect(after.privateState.tokenPoolById[pool]).toEqual(before.privateState.tokenPoolById[pool]);
}

describe("Cthulhu1 Sea bound refusal", () => {
  it("offers both printed branches and accepts Dark Pact for this Clue and Mists", () => {
    const before = state(), paused = offered(before), snapshot = structuredClone(paused);
    expect(paused.pendingDecision!.optionIds).toEqual(["accept", "skip"]);
    expect(paused.pendingDecision!.optionLabels!.skip).toContain("Discard this Clue");
    const after = accepted(choose(paused, "accept"));
    expect(after.players[0]!.conditionIds?.[0]).toContain("dark_pact"); expect(after.players[0]!.clues).toBe(1);
    expect(after.privateState.spells!.heldByPlayer.host).toHaveLength(1);
    expect(after.privateState.spells!.heldByPlayer.host![0]).toContain("mists_of_releh");
    expect(after.privateState.tokenPoolById["held_clues:host"]).toEqual(["clue_arkham"]);
    expect(after.privateState.tokenPoolById.clue_discard ?? []).toEqual([]);
    expect(after.boardClues).toEqual([{ id: "other", locationId: "space_2" }]);
    expect(after.researchDiscardIds).toEqual(["encounter_research_cthulhu_01"]); expect(after.activePlayerId).toBe("guest");
    physicalUnchanged(after, before); expect(paused).toEqual(snapshot);
  });

  it.each([1, 6])("discards only this physical Clue before Star Spawn combat (die=%i)", die => {
    const before = state(), result = choose(offered(before), "skip", rng(die)), after = accepted(result);
    expect(after.privateState.tokenPoolById.clue_discard).toEqual(["clue_arkham"]);
    expect(after.privateState.tokenPoolById["board_clue:chosen"]).toBeUndefined();
    expect(after.boardClues).toEqual([{ id: "other", locationId: "space_2" }]);
    expect(after.players[0]!.clues).toBe(0); expect(after.privateState.spells!.heldByPlayer.host).toEqual([]);
    expect(after.players[0]!.conditionIds ?? []).toEqual([]);
    expect(after.players[0]!.sanity).toBe(die === 6 ? 7 : 4); expect(after.players[0]!.health).toBe(die === 6 ? 5 : 2);
    expect(after.researchDiscardIds).toEqual(["encounter_research_cthulhu_01"]); physicalUnchanged(after, before);
    if (result.ok) expect(result.events.filter(e => e.type === "CLUE_DISCARDED")).toHaveLength(1);
  });

  it.each([false, true])("automatically refuses when Dark Pact cannot be gained (owned=%s)", owned => {
    const before = state(), pact = before.privateState.tokenPoolById["condition:dark_pact"]!;
    if (owned) before.players[0]!.conditionIds = [pact[0]!];
    before.privateState.tokenPoolById["condition:dark_pact"] = owned ? pact.slice(1) : [];
    const after = accepted(resolveResearchEncounter(before, "host", "chosen", content, rng()));
    expect(after.pendingDecision).toBeUndefined(); expect(after.privateState.tokenPoolById.clue_discard).toEqual(["clue_arkham"]);
    expect(after.players[0]!.clues).toBe(0); physicalUnchanged(after, before);
  });

  it("restores Will then Strength with absent original marker and owner-only decisions", () => {
    const before = state(1), paused = accepted(choose(offered(before), "skip", createDeterministicEngineContext({ dice: [1, 1, 1], ids: ["will", "will-choice"] })));
    expect(paused.activeTest?.skill).toBe("will"); expect(paused.boardClues).toEqual([]);
    expect(paused.privateState.tokenPoolById.clue_discard).toEqual(["clue_arkham"]);
    expect(validateResearchContinuationState(paused, content)).toBeUndefined();
    expect("optionIds" in projectStateForPlayer(paused, "guest").pendingDecision!).toBe(false);
    const restored = JSON.parse(JSON.stringify(paused)) as GameState;
    const command = { type: "RESOLVE_DECISION" as const, decisionId: restored.pendingDecision!.id, selectedOptionIds: ["die-0"] };
    expect(executeCommand(restored, "guest", command, content, rng())).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const after = accepted(executeCommand(restored, "host", command, content, rng()));
    expect(after.privateState.tokenPoolById.clue_discard).toEqual(["clue_arkham", "clue_london"]);
    expect(after.players[0]!.sanity).toBe(5); expect(after.privateState.spells!.heldByPlayer.host).toEqual([]);
    expect(after.pendingLocationEncounter).toBeUndefined(); physicalUnchanged(after, before);
  });

  it("stops on Horror defeat after discarding the Clue without Strength RNG or reward", () => {
    const before = state(); before.players[0]!.sanity = 3;
    const after = accepted(choose(offered(before), "skip", createDeterministicEngineContext({ dice: [1, 1, 1] })));
    expect(after.pendingDefeat?.causes).toEqual(["sanity"]); expect(after.pendingLocationEncounter).toBeUndefined();
    expect(after.privateState.tokenPoolById.clue_discard).toEqual(["clue_arkham"]); expect(after.players[0]!.clues).toBe(0);
    physicalUnchanged(after, before);
  });

  it("restores the Strength checkpoint after declining the Will reroll without repeating discard", () => {
    const will = accepted(choose(offered(state(1)), "skip", rng()));
    const strength = accepted(executeCommand(will, "host", { type: "RESOLVE_DECISION", decisionId: will.pendingDecision!.id, selectedOptionIds: [] }, content, rng()));
    expect(strength.activeTest?.skill).toBe("strength"); expect(strength.players[0]!.sanity).toBe(7);
    const restored = JSON.parse(JSON.stringify(strength)) as GameState;
    const after = accepted(executeCommand(restored, "host", { type: "RESOLVE_DECISION", decisionId: restored.pendingDecision!.id, selectedOptionIds: [] }, content, rng()));
    expect(after.privateState.tokenPoolById.clue_discard).toEqual(["clue_arkham"]);
    expect(after.players[0]!.clues).toBe(1); expect(after.activePlayerId).toBe("guest");
  });

  it("rolls back discard and consumed dice on incomplete ambush randomness", () => {
    const paused = offered(), snapshot = structuredClone(paused), context = createDeterministicEngineContext({ dice: [6] });
    expect(choose(paused, "skip", context)).toMatchObject({ ok: false, error: { code: "RANDOM_INPUT_REQUIRED" } });
    expect(paused).toEqual(snapshot); expect(context.rollDie()).toBe(6);
  });

  it("rejects tampered discard references before removing another marker", () => {
    const paused = offered(), queue = paused.pendingLocationEncounter!.queue[0]!;
    if (queue.kind !== "optional" || queue.decline?.kind !== "sequence" || queue.decline.steps[0]?.kind !== "effects") throw new Error("Missing authored refusal");
    const discard = queue.decline.steps[0].effects[0]!;
    Reflect.set(discard, "markerId", "other"); const snapshot = structuredClone(paused);
    expect(choose(paused, "skip")).toMatchObject({ ok: false, error: { code: "ENCOUNTER_CONTENT_MISSING" } });
    expect(paused).toEqual(snapshot);
  });

  it("rejects replacement physical identity at the original marker before refusal", () => {
    const paused = offered(); paused.privateState.tokenPoolById["board_clue:chosen"] = ["clue_london"];
    const snapshot = structuredClone(paused);
    expect(choose(paused, "skip")).toMatchObject({ ok: false, error: { code: "ENCOUNTER_CONTENT_MISSING" } });
    expect(paused).toEqual(snapshot);
  });

  it("rejects unsupported decline or prebound discard injection rather than dropping it", () => {
    const empty = { kind: "effects", effects: [] };
    expect(bindResearchInstruction({ kind: "optional", cost: [], reward: empty, decline: { kind: "unknown" } }, "chosen")).toBeUndefined();
    expect(bindResearchInstruction({ kind: "effects", effects: [{ kind: "discard_encountered_clue", markerId: "other" }] }, "chosen")).toBeUndefined();
  });
});
