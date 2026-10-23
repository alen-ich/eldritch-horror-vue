import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, executeCommand, projectPublicState, type GameContent, type GameState, type ResearchEncounterDeckId } from "../src/index.js";
import { startingContent, lobby } from "./starting-spell-fixtures.js";
import { spellContext } from "./spell-fixtures.js";
const ancientIds = ["azathoth", "cthulhu", "shub_niggurath", "yog_sothoth"] as const;
const cards = ancientIds.flatMap(ancient => Array.from({ length: 8 }, (_, n) => ({ id: `encounter_research_${ancient}_0${n + 1}`, deck: `research_${ancient}` as ResearchEncounterDeckId })));
function fixture(ancient: typeof ancientIds[number] = "azathoth") {
  const state = lobby(); state.ancientOneId = ancient;
  const base = startingContent();
  const content = { ...base, researchEncounterSetup: cards.map(card => ({ ...card })), mysteryIdsByAncientOne: Object.fromEntries(ancientIds.map(id => [id, base.mysteryIdsByAncientOne.azathoth!])) };
  return { state, content };
}
function started(state: GameState, content: GameContent) {
  const result = executeCommand(state, "host", { type: "START_GAME" }, content, { ...spellContext, shuffle: items => [...items].reverse() });
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}
describe("physical Research setup", () => {
  it.each(ancientIds)("initializes the selected %s physical eight without executable rules", ancient => {
    const { state, content } = fixture(ancient), before = structuredClone(state), next = started(state, content);
    const deck = `research_${ancient}`, expected = cards.filter(card => card.deck === deck).map(card => card.id).reverse();
    expect(next.privateState.deckOrderById[`encounter:${deck}`]).toEqual(expected);
    for (const other of ancientIds.filter(id => id !== ancient)) expect(next.privateState.deckOrderById[`encounter:research_${other}`]).toBeUndefined();
    expect(next.currentLocationEncounterCardId).toBeUndefined();
    expect(JSON.stringify(projectPublicState(next))).not.toMatch(/encounter_research_|deckOrderById/);
    expect(state).toEqual(before);
  });
  it.each(["missing", "duplicate", "foreign", "wrong deck", "sparse"])("rejects %s catalog before random use", corrupt => {
    const { state, content } = fixture();
    if (corrupt === "missing") content.researchEncounterSetup.pop();
    if (corrupt === "duplicate") content.researchEncounterSetup[0] = content.researchEncounterSetup[1]!;
    if (corrupt === "foreign") content.researchEncounterSetup[0]!.id = "foreign";
    if (corrupt === "wrong deck") content.researchEncounterSetup[0]!.deck = "research_cthulhu";
    if (corrupt === "sparse") delete content.researchEncounterSetup[1];
    const before = structuredClone(state); let randomCalls = 0;
    const context = { ...spellContext, shuffle: <T>(items: readonly T[]): T[] => { randomCalls++; return [...items]; } };
    expect(executeCommand(state, "host", { type: "START_GAME" }, content, context)).toMatchObject({ ok: false, error: { code: "ENCOUNTER_CONTENT_MISSING" } });
    expect(state).toEqual(before); expect(randomCalls).toBe(0);
  });
  it("rejects a non-conserving selected shuffle without mutating state", () => {
    const { state, content } = fixture(), before = structuredClone(state);
    const result = executeCommand(state, "host", { type: "START_GAME" }, content, { ...spellContext, shuffle: items => typeof items[0] === "string" && items[0].startsWith("encounter_research_") ? [] : [...items] });
    expect(result).toMatchObject({ ok: false, error: { code: "RANDOM_INPUT_REQUIRED" } }); expect(state).toEqual(before);
  });
  it("rejects a shuffle that mutates its input to bypass conservation", () => {
    const { state, content } = fixture(), before = structuredClone(state), catalog = structuredClone(content.researchEncounterSetup);
    const result = executeCommand(state, "host", { type: "START_GAME" }, content, {
      ...spellContext, shuffle: <T>(items: readonly T[]): T[] => {
        if (typeof items[0] === "string" && items[0].startsWith("encounter_research_")) {
          const mutated = items as T[]; mutated[0] = "foreign" as T; return mutated;
        }
        return [...items];
      },
    });
    expect(result).toMatchObject({ ok: false, error: { code: "RANDOM_INPUT_REQUIRED" } });
    expect(state).toEqual(before); expect(content.researchEncounterSetup).toEqual(catalog);
  });
  it("rolls back retained input when setup shuffle exhausts", () => {
    const { state, content } = fixture(), before = structuredClone(state);
    const context = createDeterministicEngineContext({ shuffleIndexes: [0] });
    expect(executeCommand(state, "host", { type: "START_GAME" }, content, context).ok).toBe(false);
    expect(state).toEqual(before); expect(context.shuffle([1, 2])).toEqual([2, 1]);
  });
  it("preserves legacy callers without the optional physical setup catalog", () => {
    const state = lobby(), next = started(state, startingContent());
    expect(next.privateState.deckOrderById["encounter:research_azathoth"]).toBeUndefined();
  });
});
