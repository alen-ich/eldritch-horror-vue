import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { locationIds } from "@eldritch/protocol";
import { baseGameClues, validateClueContent } from "../src/clues.js";

const publicDirectory = fileURLToPath(new URL("../../../apps/web/public", import.meta.url));

describe("base-game Clue tokens", () => {
  it("has one scan-verified physical token for each of the 36 board spaces", () => {
    expect(baseGameClues).toHaveLength(36);
    expect(new Set(baseGameClues.map(clue => clue.locationId))).toEqual(new Set(locationIds));
    expect(() => validateClueContent(baseGameClues)).not.toThrow();
  });

  it("links every face and the shared back to generated artwork", () => {
    expect(baseGameClues.every(({ imageUrl, backImageUrl }) =>
      existsSync(`${publicDirectory}${imageUrl}`) && existsSync(`${publicDirectory}${backImageUrl}`))).toBe(true);
  });

  it("rejects missing, duplicate, and mismapped physical tokens", () => {
    expect(() => validateClueContent(baseGameClues.slice(1))).toThrow();
    expect(() => validateClueContent([...baseGameClues.slice(0, -1), baseGameClues[0]!])).toThrow(/unique/);
    expect(() => validateClueContent([{ ...baseGameClues[0]!, imageUrl: "/tokens/clues/space_1.webp" }, ...baseGameClues.slice(1)])).toThrow(/match/);
  });
});
