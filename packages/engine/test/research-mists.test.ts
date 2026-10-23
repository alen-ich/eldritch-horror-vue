import { describe, expect, it } from "vitest";
import { baseGameResearchEncounterRules } from "../../content/src/research-encounter-rules.js";
import { baseGameConditions } from "../../content/src/conditions.js";
import { baseGameSpells } from "../../content/src/spells.js";
import { spellState, spellContent, holdSpell } from "./spell-fixtures.js";
import { createDeterministicEngineContext, executeCommand, resolveResearchEncounter, projectStateForPlayer, validateSpellInventory, type CommandResult, type GameState, type GameContent } from "../src/index.js";
import { parseLocationEncounterInstruction } from "../src/encounter-instructions.js";
import { bindResearchInstruction } from "../src/research-instructions.js";

const content: GameContent = { ...spellContent, researchEncounters: baseGameResearchEncounterRules, conditions: baseGameConditions,
  clues: [{ id: "clue_arkham", locationId: "arkham" }, { id: "clue_london", locationId: "london" }] };
const mists = baseGameSpells.filter(s => s.kind === "mists_of_releh");
function state(clues = 0): GameState {
  const s = spellState(); s.phase = "encounter"; s.ancientOneId = "cthulhu";
  s.players[0]!.clues = clues;
  s.boardClues = [{ id: "chosen", locationId: "arkham" }];
  s.privateState.deckOrderById["encounter:research_cthulhu"] = ["encounter_research_cthulhu_06", "encounter_research_cthulhu_02"];
  Object.assign(s.privateState.tokenPoolById, { "board_clue:chosen": ["clue_arkham"], "held_clues:host": clues ? ["clue_london"] : [], clues: [] });
  for (const c of baseGameConditions) (s.privateState.tokenPoolById[`condition:${c.kind}`] ??= []).push(c.id);
  return s;
}
const rng = (die = 6) => createDeterministicEngineContext({ dice: [die, die], ids: ["test", "choice", "next"], tokenIndexes: [0], shuffleIndexes: Array<number>(30).fill(0) });
function accepted(r: CommandResult): GameState { if (!r.ok) throw new Error(r.error.code + ": " + r.error.message); return r.state; }
function draw(s = state(), die = 6): GameState { return accepted(resolveResearchEncounter(s, "host", "chosen", content, rng(die))); }

describe("named Mists Research reward", () => {
  it("collects this Clue and one named physical Spell, conserving the rest of the supply", () => {
    const before = state(), snapshot = structuredClone(before), after = draw(before);
    expect(after.players[0]!.clues).toBe(1); expect(after.boardClues).toEqual([]);
    const held = after.privateState.spells!.heldByPlayer.host!;
    expect(held).toHaveLength(1); expect(mists.map(s => s.id)).toContain(held[0]);
    expect(after.privateState.spells!.deck).toHaveLength(baseGameSpells.length - 1);
    expect(validateSpellInventory(after, baseGameSpells)).toBeUndefined();
    expect(after.researchDiscardIds).toEqual(["encounter_research_cthulhu_06"]); expect(after.activePlayerId).toBe("guest");
    expect(before).toEqual(snapshot);
  });

  it("fails Observation into Paranoia without gaining or searching Spells", () => {
    const before = state(), after = draw(before, 1);
    expect(after.players[0]!.clues).toBe(0); expect(after.players[0]!.conditionIds?.[0]).toContain("paranoia");
    expect(after.boardClues).toEqual(before.boardClues); expect(after.privateState.spells).toEqual(before.privateState.spells);
  });

  it("completes the Clue reward when every Mists copy is unavailable", () => {
    const before = state();
    before.players.push({ ...before.players[1]!, id: "third" });
    before.privateState.spells!.heldByPlayer.third = [];
    holdSpell(before, mists[0]!.id, "guest"); holdSpell(before, mists[1]!.id, "third");
    // Guest's optional encounter Spell cannot affect the active investigator.
    const after = draw(before);
    expect(after.players[0]!.clues).toBe(1); expect(after.privateState.spells!.heldByPlayer.host).toEqual([]);
    expect(after.privateState.spells!.heldByPlayer.guest).toEqual([mists[0]!.id]);
    expect(after.privateState.spells!.heldByPlayer.third).toEqual([mists[1]!.id]);
    expect(validateSpellInventory(after, baseGameSpells)).toBeUndefined();
  });

  it("keeps the conservative encounter guard for an investigator already holding Mists", () => {
    const before = state(); holdSpell(before, mists[0]!.id); const snapshot = structuredClone(before);
    expect(resolveResearchEncounter(before, "host", "chosen", content, rng())).toMatchObject({ ok: false, error: { code: "SPELL_EFFECT_UNSUPPORTED" } });
    expect(before).toEqual(snapshot);
  });

  it("restores owner-only Observation reroll and grants the reward once with no private back leakage", () => {
    const paused = accepted(resolveResearchEncounter(state(1), "host", "chosen", content, rng(1)));
    expect(paused.activeTest?.skill).toBe("observation");
    const restored = JSON.parse(JSON.stringify(paused)) as GameState;
    const command = { type: "RESOLVE_DECISION" as const, decisionId: restored.pendingDecision!.id, selectedOptionIds: ["die-0"] };
    expect(executeCommand(restored, "guest", command, content, rng())).toMatchObject({ ok: false, error: { code: "NOT_DECISION_OWNER" } });
    const after = accepted(executeCommand(restored, "host", command, content, rng()));
    expect(after.players[0]!.clues).toBe(1); expect(after.privateState.spells!.heldByPlayer.host).toHaveLength(1);
    const physical = after.privateState.spells!.heldByPlayer.host![0]!;
    expect(JSON.stringify(projectStateForPlayer(after, "guest"))).not.toContain(physical);
    expect(JSON.stringify(projectStateForPlayer(after, "host"))).not.toContain("deckOrderById");
    expect(executeCommand(after, "host", command, content, rng()).ok).toBe(false);
  });

  it("rolls back Clue gain and consumed test dice if the required Spell search shuffle is unavailable", () => {
    const before = state(), snapshot = structuredClone(before), context = createDeterministicEngineContext({ dice: [6, 6] });
    expect(resolveResearchEncounter(before, "host", "chosen", content, context)).toMatchObject({ ok: false, error: { code: "SPELL_RANDOM_INPUT_INVALID" } });
    expect(before).toEqual(snapshot); expect(context.rollDie()).toBe(6);
  });

  it.each(["missing-content", "missing-kind", "invalid-inventory"])("preflights %s before dice or effects", mode => {
    const before = state(), bad = { ...content };
    if (mode === "missing-content") delete bad.spells;
    if (mode === "missing-kind") bad.spells = baseGameSpells.filter(s => s.kind !== "mists_of_releh");
    if (mode === "invalid-inventory") before.privateState.spells!.deck.pop();
    const snapshot = structuredClone(before);
    const result = resolveResearchEncounter(before, "host", "chosen", bad, createDeterministicEngineContext({}));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).not.toBe("RANDOM_INPUT_REQUIRED");
    expect(before).toEqual(snapshot);
  });

  it("admits only the named reward and keeps the unsupported card1 Sea refusal blocked", () => {
    expect(parseLocationEncounterInstruction({ kind: "effects", effects: [{ kind: "spell", id: "spell_mists_of_releh" }] })).toBeDefined();
    for (const id of ["spell_feed_the_mind", "mists_of_releh", "", null]) expect(parseLocationEncounterInstruction({ kind: "effects", effects: [{ kind: "spell", id }] })).toBeUndefined();
    const card = baseGameResearchEncounterRules.find(c => c.deck === "research_cthulhu" && c.number === 1)!;
    expect(bindResearchInstruction(card.sections.sea, "chosen")).toBeUndefined();
  });
});
