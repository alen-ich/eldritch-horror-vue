import { describe, expect, it } from "vitest";
import { buildLocationEncounterDecks, locationEncounterDeckIds } from "../src/setup.js";
import { createDeterministicEngineContext, executeCommand, type GameContent } from "../src/index.js";
import { spellContent, spellState, spellContext } from "./spell-fixtures.js";

const catalog = () => locationEncounterDeckIds.flatMap(deck => [1, 2].map(n => ({ id: `${deck}-${n}`, deck })));

describe("Location setup physical integrity", () => {
  it("rejects malformed Location shuffle through a bare START_GAME boundary", () => {
    const state = spellState(); state.phase = "lobby"; delete state.privateState.spells;
    const before = structuredClone(state), content: GameContent = { ...spellContent, spells: undefined, locationEncounters: catalog() };
    expect(executeCommand(state, "host", { type: "START_GAME" }, content, { ...spellContext,
      shuffle: items => String(items[0]).startsWith("general-") ? [] : [...items],
    })).toMatchObject({ ok: false, error: { code: "RANDOM_INPUT_REQUIRED" } });
    expect(state).toEqual(before);
  });
  it("restores partial setup random input without unrelated starting grants", () => {
    const state = spellState(); state.phase = "lobby"; delete state.privateState.spells;
    const before = structuredClone(state), context = createDeterministicEngineContext({ shuffleIndexes: Array(6).fill(0) });
    const content: GameContent = { ...spellContent, spells: undefined, locationEncounters: catalog() };
    expect(executeCommand(state, "host", { type: "START_GAME" }, content, context)).toMatchObject({ ok: false, error: { code: "RANDOM_INPUT_REQUIRED" } });
    expect(state).toEqual(before); expect(context.shuffle([1, 2])).toEqual([2, 1]);
  });
  it.each(["hole", "null", "non-string ID", "empty ID", "duplicate", "unknown deck", "missing deck"])("rejects %s catalog before shuffle", corruption => {
    const cards = catalog();
    if (corruption === "hole") Reflect.deleteProperty(cards, 0);
    if (corruption === "null") Reflect.set(cards, 0, null);
    if (corruption === "non-string ID") Reflect.set(cards[0]!, "id", 123);
    if (corruption === "empty ID") cards[0]!.id = "";
    if (corruption === "duplicate") cards[0]!.id = cards[1]!.id;
    if (corruption === "unknown deck") Reflect.set(cards[0]!, "deck", "private-deck");
    if (corruption === "missing deck") cards.splice(4, 2);
    const before = structuredClone(cards);
    let shuffles = 0;
    expect(() => buildLocationEncounterDecks(cards, items => { shuffles++; return [...items]; })).toThrow(/Location/);
    expect(shuffles).toBe(0);
    expect(cards).toEqual(before);
  });

  it.each(["duplicate", "foreign", "truncated", "sparse", "other deck"])("rejects %s shuffled output without mutating the catalog", corruption => {
    const cards = catalog(), before = structuredClone(cards);
    expect(() => buildLocationEncounterDecks(cards, items => {
      const output = [...items];
      if (corruption === "duplicate") output[0] = output[1]!;
      if (corruption === "foreign") Reflect.set(output, 0, "private-foreign-card");
      if (corruption === "other deck") Reflect.set(output, 0, "europe-1");
      if (corruption === "truncated") output.pop();
      if (corruption === "sparse") Reflect.deleteProperty(output, 0);
      return output;
    })).toThrow(/Location/);
    expect(cards).toEqual(before);
  });

  it.each([false, true])("conserves four independent partial decks with in-place=%s", inPlace => {
    const cards = catalog(), before = structuredClone(cards);
    const decks = buildLocationEncounterDecks(cards, <T>(items: readonly T[]) => inPlace ? (items as T[]).reverse() : [...items].reverse());
    expect(decks).toEqual({ general: ["general-2", "general-1"], america: ["america-2", "america-1"], europe: ["europe-2", "europe-1"], asia_australia: ["asia_australia-2", "asia_australia-1"] });
    expect(cards).toEqual(before);
  });
  it("owns each deck even when the shuffler reuses an output buffer", () => {
    const buffer: unknown[] = [];
    const decks = buildLocationEncounterDecks(catalog(), <T>(items: readonly T[]) => {
      buffer.splice(0, buffer.length, ...items);
      return buffer as T[];
    });
    expect(decks.general).toEqual(["general-1", "general-2"]);
    expect(decks.europe).toEqual(["europe-1", "europe-2"]);
    buffer.length = 0;
    expect(decks.asia_australia).toEqual(["asia_australia-1", "asia_australia-2"]);
  });
});
