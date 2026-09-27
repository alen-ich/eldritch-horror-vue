import { describe, expect, it } from "vitest";
import { baseGameMysteries, mysteryIds, validateMysteryContent } from "../src/mysteries.js";

describe("base-game Mysteries", () => {
  it("contains all sixteen cards with source provenance", () => {
    expect(baseGameMysteries.map((mystery) => mystery.id)).toEqual(mysteryIds);
    expect(new Set(baseGameMysteries.map((mystery) => mystery.sourceSha256))).toEqual(new Set([
      "f17958795136f3c2ed4fe5292a6c3296490e64328f0792d3aadce4113a5c2bd8",
    ]));
    expect(() => validateMysteryContent(baseGameMysteries)).not.toThrow();
  });

  it("assigns exactly four cards to every base-game Ancient One", () => {
    for (const ancientOneId of ["cthulhu", "shub_niggurath", "yog_sothoth", "azathoth"] as const) {
      expect(baseGameMysteries.filter((mystery) => mystery.ancientOneId === ancientOneId)).toHaveLength(4);
    }
  });

  it("retains explicit review status because the source contains summaries", () => {
    expect(baseGameMysteries.every((mystery) => mystery.verification === "reference_summary_only")).toBe(true);
  });

  it("rejects duplicate and incomplete rosters", () => {
    expect(() => validateMysteryContent([...baseGameMysteries, baseGameMysteries[0]])).toThrow(/duplicate IDs/);
    expect(() => validateMysteryContent(baseGameMysteries.slice(1))).toThrow(/does not match the base-game roster/);
  });
});
