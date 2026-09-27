import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { baseGameMysteries, mysteryIds, mysteryTargetValue, validateMysteryContent } from "../src/mysteries.js";

describe("base-game Mysteries", () => {
  it("contains the complete sixteen-card roster", () => {
    expect(baseGameMysteries.map((mystery) => mystery.id)).toEqual(mysteryIds);
    expect(() => validateMysteryContent(baseGameMysteries)).not.toThrow();
  });

  it("assigns exactly four cards to every base-game Ancient One", () => {
    for (const ancientOneId of ["cthulhu", "shub_niggurath", "yog_sothoth", "azathoth"] as const) {
      expect(baseGameMysteries.filter((mystery) => mystery.ancientOneId === ancientOneId)).toHaveLength(4);
    }
  });

  it("links every base Mystery to a generated English front and Ancient One back", () => {
    for (const mystery of baseGameMysteries) {
      expect(existsSync(path.join(process.cwd(), "../../apps/web/public", mystery.imageUrl))).toBe(true);
      expect(existsSync(path.join(process.cwd(), "../../apps/web/public", mystery.backImageUrl))).toBe(true);
    }
    expect(baseGameMysteries.filter(({ scanVerification }) => scanVerification === "supplied_english_scan")).toHaveLength(15);
    expect(baseGameMysteries.find(({ id }) => id === "azathoth_occult_research")?.scanVerification).toBe("preserved_english_scan");
  });

  it("records the current completion thresholds", () => {
    const deepOnes = baseGameMysteries.find((mystery) => mystery.id === "cthulhu_the_deep_ones_attack")!;
    expect(deepOnes.completion).toEqual({
      timing: "end_mythos",
      metric: "eldritch_tokens",
      target: "investigator_count",
      preserveBoardEldritchTokens: true,
    });
  });

  it("rounds scaled investigator targets according to the printed rule", () => {
    expect([1, 2, 3, 4].map((count) => mysteryTargetValue("half_investigator_count", count))).toEqual([1, 1, 2, 2]);
    expect(mysteryTargetValue("twice_investigator_count", 4)).toBe(8);
    expect(() => mysteryTargetValue("investigator_count", 0)).toThrow(/positive integer/);
  });

  it("rejects duplicate and incomplete rosters", () => {
    expect(() => validateMysteryContent([...baseGameMysteries, baseGameMysteries[0]])).toThrow(/duplicate IDs/);
    expect(() => validateMysteryContent(baseGameMysteries.slice(1))).toThrow(/does not match the base-game roster/);
  });
});
