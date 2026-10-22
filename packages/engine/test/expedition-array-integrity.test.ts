import { describe, expect, it } from "vitest";
import { executeCommand, initializeExpeditionDeck, type GameContent } from "../src/index.js";
import { startingContent, lobby } from "./starting-spell-fixtures.js";
import { spellContext } from "./spell-fixtures.js";

const sites = ["the_heart_of_africa", "the_himalayas", "the_amazon", "tunguska", "antarctica", "the_pyramids"] as const;
function content(): GameContent {
  const base = startingContent();
  return { ...base, map: { ...base.map, locationTypes: { ...base.map.locationTypes,
    ...Object.fromEntries(sites.map(site => [site, "wilderness" as const])) } },
    expeditionEncounters: sites.flatMap(locationId => [1, 2, 3].map(n => ({ id: `encounter_expedition_${locationId}_0${n}`, locationId }))),
  };
}

describe("Expedition physical array boundaries", () => {
  for (const slot of [0, 17]) {
    for (const kind of ["hole", "undefined"] as const) {
      it(`rejects catalog ${kind} at slot ${slot} before shuffle`, () => {
        const catalog = content();
        if (kind === "hole") Reflect.deleteProperty(catalog.expeditionEncounters!, slot);
        else Reflect.set(catalog.expeditionEncounters!, slot, undefined);
        const source = lobby(), before = structuredClone(source);
        let shuffles = 0;
        const result = executeCommand(source, "host", { type: "START_GAME" }, catalog, {
          ...spellContext, shuffle: items => { shuffles++; return [...items]; },
        });
        expect(result).toMatchObject({ ok: false, error: { code: "EXPEDITION_CONTENT_MISSING" } });
        expect(source).toEqual(before);
        expect(shuffles).toBe(0);
      });
    }
  }

  for (const slot of [0, 17]) {
    for (const corruption of ["hole", "undefined", "duplicate", "foreign"] as const) {
      it(`rejects ${corruption} shuffled slot ${slot} atomically`, () => {
        const source = lobby(), before = structuredClone(source);
        let rolledBack = false;
        const result = executeCommand(source, "host", { type: "START_GAME" }, content(), {
          ...spellContext,
          checkpoint: () => ({ commit() {}, rollback() { rolledBack = true; } }),
          shuffle: items => {
            const result = [...items];
            if (String(items[0]).startsWith("encounter_expedition_")) {
              if (corruption === "hole") Reflect.deleteProperty(result, slot);
              if (corruption === "undefined") Reflect.set(result, slot, undefined);
              if (corruption === "duplicate") result[slot] = result[slot === 0 ? 1 : 16]!;
              if (corruption === "foreign") Reflect.set(result, slot, "foreign");
            }
            return result;
          },
        });
        expect(result).toMatchObject({ ok: false, error: { code: "RANDOM_INPUT_REQUIRED" } });
        expect(source).toEqual(before);
        expect(rolledBack).toBe(true);
      });
    }
  }

  it("accepts all physical cards in reverse order and derives the public site", () => {
    const result = initializeExpeditionDeck(content().expeditionEncounters!, items => [...items].reverse());
    expect(result.deck).toHaveLength(18);
    expect(new Set(result.deck).size).toBe(18);
    expect(result.locationId).toBe("the_pyramids");
  });
});
