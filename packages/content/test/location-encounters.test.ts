import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  baseGameScannedLocationEncounters,
  missingBaseGameLocationEncounterIds,
  validateLocationEncounterContent,
} from "../src/location-encounters.js";

const root = new URL("../../../", import.meta.url).pathname;

describe("base-game scanned location encounters", () => {
  it("has all four complete base-game location decks with stable card numbers", () => {
    for (const [deck, count] of [["general", 12], ["america", 8], ["europe", 8], ["asia_australia", 8]] as const) {
      expect(baseGameScannedLocationEncounters.filter(card => card.deck === deck).map(card => card.number).sort((a, b) => a - b))
        .toEqual(Array.from({ length: count }, (_, index) => index + 1));
    }
    expect(baseGameScannedLocationEncounters).toHaveLength(36);
    expect(() => validateLocationEncounterContent(baseGameScannedLocationEncounters)).not.toThrow();
  });

  it("has no missing location cards and preserves America's printed section order", () => {
    expect(missingBaseGameLocationEncounterIds(baseGameScannedLocationEncounters)).toEqual([]);
    expect(baseGameScannedLocationEncounters.find(card => card.id === "encounter_america_01")?.sections)
      .toEqual(["arkham", "san_francisco", "buenos_aires"]);
  });

  it("links each card to a generated face, shared back, and supplied source sheet", () => {
    for (const card of baseGameScannedLocationEncounters) {
      expect(existsSync(`${root}apps/web/public${card.imageUrl}`)).toBe(true);
      expect(existsSync(`${root}apps/web/public${card.backImageUrl}`)).toBe(true);
      expect(existsSync(`${root}${card.sourceScan}`)).toBe(true);
      expect(card.effectStatus).toBe("not_executable");
    }
  });

  it("rejects duplicate, mismatched, and expansion-numbered records", () => {
    const first = baseGameScannedLocationEncounters[0]!;
    expect(() => validateLocationEncounterContent([...baseGameScannedLocationEncounters, first])).toThrow(/duplicate IDs/);
    expect(() => validateLocationEncounterContent([{ ...first, sections: ["london", "rome", "istanbul"] }])).toThrow(/mapping/);
    expect(() => validateLocationEncounterContent([{ ...first, number: 13, id: "encounter_general_13", imageUrl: "/cards/encounters/general/13.webp" }])).toThrow(/mapping/);
  });
});
