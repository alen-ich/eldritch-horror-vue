import { describe, expect, it } from "vitest";
import { buildMythosDeck } from "../src/setup.js";

describe("staged Mythos setup", () => {
  const cards = ["green", "yellow", "blue"].flatMap(color => Array.from({ length: 4 }, (_, index) => ({ id: `${color}-${index}`, color: color as "green" | "yellow" | "blue" })));
  const stages = [{ green: 1, yellow: 0, blue: 1 }, { green: 0, yellow: 2, blue: 0 }, { green: 2, yellow: 1, blue: 0 }];
  it("preserves stage order and consumes cards without duplication", () => {
    const deck = buildMythosDeck(cards, stages, items => [...items]);
    expect(deck).toEqual(["green-0", "blue-0", "yellow-0", "yellow-1", "green-1", "green-2", "yellow-2"]);
    expect(new Set(deck).size).toBe(deck.length);
    expect(cards).toHaveLength(12);
  });
  it("shuffles each stage independently after color selection", () => {
    const deck = buildMythosDeck(cards, stages, items => [...items].reverse());
    expect(deck.slice(0, 2)).toEqual(["blue-3", "green-3"]);
    expect(deck.slice(2, 4)).toEqual(["yellow-2", "yellow-3"]);
  });
  it("rejects shortages and duplicate IDs", () => {
    expect(() => buildMythosDeck([], stages, items => [...items])).toThrow();
    expect(() => buildMythosDeck([...cards, cards[0]!], stages, items => [...items])).toThrow();
  });
});
