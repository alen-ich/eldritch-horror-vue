import { describe, expect, it } from "vitest";
import { buildGateStack, buildLocationEncounterDecks, buildMonsterPool, buildMythosDeck } from "../src/setup.js";

describe("private location encounter decks", () => {
  const cards = ["general", "america", "europe", "asia_australia"].flatMap(deck => [1, 2].map(number => ({ id: `${deck}-${number}`, deck: deck as "general" | "america" | "europe" | "asia_australia" })));
  it("shuffles each deck separately and retains the card catalog", () => {
    const decks = buildLocationEncounterDecks(cards, ids => [...ids].reverse());
    expect(decks.general).toEqual(["general-2", "general-1"]);
    expect(decks.europe).toEqual(["europe-2", "europe-1"]);
    expect(cards[0]?.id).toBe("general-1");
  });
  it("rejects duplicate IDs and missing decks", () => {
    expect(() => buildLocationEncounterDecks([...cards, cards[0]!], ids => [...ids])).toThrow(/unique/);
    expect(() => buildLocationEncounterDecks(cards.filter(card => card.deck !== "general"), ids => [...ids])).toThrow(/empty/);
  });
});

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

describe("private Gate stack setup", () => {
  it("shuffles each physical Gate once and treats the first result as the top", () => {
    const ids = ["gate_arkham", "gate_london", "gate_tokyo"];
    expect(buildGateStack(ids, cards => [...cards].reverse())).toEqual(["gate_tokyo", "gate_london", "gate_arkham"]);
    expect(ids).toEqual(["gate_arkham", "gate_london", "gate_tokyo"]);
  });

  it("rejects empty and duplicate Gate catalogs", () => {
    expect(() => buildGateStack([], cards => [...cards])).toThrow(/unique/);
    expect(() => buildGateStack(["gate_arkham", "gate_arkham"], cards => [...cards])).toThrow(/unique/);
  });
});

describe("finite Monster cup setup", () => {
  const catalog = [
    { id: "monster_ghoul", type: "normal" as const, count: 2 },
    { id: "monster_deep_one", type: "normal" as const, count: 1 },
    { id: "epic_monster_cthulhu", type: "epic" as const, count: 1 },
  ];

  it("excludes Epic tokens and moves Ancient One set-asides out of the normal cup", () => {
    expect(buildMonsterPool(catalog, [{ monsterId: "monster_ghoul", quantity: 2 }])).toEqual({
      cup: ["monster_deep_one"],
      setAsideById: { monster_ghoul: ["monster_ghoul", "monster_ghoul"] },
    });
    expect(buildMonsterPool(catalog, [])).toEqual({
      cup: ["monster_ghoul", "monster_ghoul", "monster_deep_one"], setAsideById: {},
    });
  });

  it("rejects over-set-aside, Epic set-aside, duplicate IDs, and invalid counts", () => {
    expect(() => buildMonsterPool(catalog, [{ monsterId: "monster_ghoul", quantity: 3 }])).toThrow(/Cannot set aside/);
    expect(() => buildMonsterPool(catalog, [{ monsterId: "epic_monster_cthulhu", quantity: 1 }])).toThrow(/Cannot set aside/);
    expect(() => buildMonsterPool([...catalog, catalog[0]!], [])).toThrow(/unique IDs/);
    expect(() => buildMonsterPool([{ ...catalog[0]!, count: 0 }], [])).toThrow(/positive/);
  });
});
