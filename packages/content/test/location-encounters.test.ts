import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  baseGameScannedLocationEncounters,
  missingBaseGameLocationEncounterIds,
  validateLocationEncounterContent,
} from "../src/location-encounters.js";

const root = new URL("../../../", import.meta.url).pathname;

describe("base-game scanned location encounters", () => {
  it("has complete General, Europe, and Asia/Australia decks with stable card numbers", () => {
    for (const [deck, count] of [["general", 12], ["europe", 8], ["asia_australia", 8]] as const) {
      expect(baseGameScannedLocationEncounters.filter(card => card.deck === deck).map(card => card.number).sort((a, b) => a - b))
        .toEqual(Array.from({ length: count }, (_, index) => index + 1));
    }
    expect(baseGameScannedLocationEncounters).toHaveLength(28);
    expect(() => validateLocationEncounterContent(baseGameScannedLocationEncounters)).not.toThrow();
  });

  it("identifies exactly the missing eight America cards", () => {
    expect(missingBaseGameLocationEncounterIds(baseGameScannedLocationEncounters))
      .toEqual(Array.from({ length: 8 }, (_, index) => `encounter_america_${String(index + 1).padStart(2, "0")}`));
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
