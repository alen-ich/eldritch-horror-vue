import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assetIds, baseGameAssets, validateAssetContent } from "../src/assets.js";

const publicDirectory = new URL("../../../apps/web/public", import.meta.url).pathname;

describe("base-game Asset cards", () => {
  it("contains the complete forty-card front roster", () => {
    expect(baseGameAssets).toHaveLength(40);
    expect(baseGameAssets.map(({ id }) => id)).toEqual(assetIds);
    expect(() => validateAssetContent(baseGameAssets)).not.toThrow();
  });

  it("registers investigator starting Assets by their printed English titles", () => {
    for (const name of ["Personal Assistant", "Arcane Manuscripts", "Fishing Net", "Hired Muscle", "Protective Amulet", "Lucky Rabbit's Foot", ".18 Derringer", ".38 Revolver", "Kerosene", ".45 Automatic"]) {
      expect(baseGameAssets.some((asset) => asset.name === name), name).toBe(true);
    }
  });

  it("links every catalog entry to a generated front and shared back", () => {
    expect(baseGameAssets.every(({ imageUrl, backImageUrl }) =>
      existsSync(`${publicDirectory}${imageUrl}`) && existsSync(`${publicDirectory}${backImageUrl}`))).toBe(true);
  });

  it("keeps rules transcription explicitly incomplete", () => {
    expect(baseGameAssets.every(({ rulesStatus }) => rulesStatus === "pending_verified_transcription")).toBe(true);
  });

  it("rejects incomplete and duplicate catalogs", () => {
    expect(() => validateAssetContent(baseGameAssets.slice(1))).toThrow();
    expect(() => validateAssetContent([...baseGameAssets.slice(0, -1), baseGameAssets[0]!])).toThrow(/duplicate IDs/);
  });
});
