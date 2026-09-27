import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { baseGameLocations } from "../src/map.js";
import { baseGameGates, gateIds, validateGateContent } from "../src/gates.js";

const publicDirectory = new URL("../../../apps/web/public", import.meta.url).pathname;

describe("base-game Gate tokens", () => {
  it("contains the complete nine-token roster", () => {
    expect(baseGameGates.map(({ id }) => id)).toEqual(gateIds);
    expect(() => validateGateContent(baseGameGates)).not.toThrow();
  });

  it("maps every Gate to a unique board city", () => {
    const cityIds = new Set(baseGameLocations.filter(({ type }) => type === "city").map(({ id }) => id));
    expect(baseGameGates.every(({ locationId }) => cityIds.has(locationId))).toBe(true);
    expect(new Set(baseGameGates.map(({ locationId }) => locationId)).size).toBe(9);
  });

  it("records the scan-backed Omen distribution", () => {
    expect(baseGameGates.filter(({ omenSymbol }) => omenSymbol === "constellation")).toHaveLength(3);
    expect(baseGameGates.filter(({ omenSymbol }) => omenSymbol === "comet")).toHaveLength(2);
    expect(baseGameGates.filter(({ omenSymbol }) => omenSymbol === "eclipse")).toHaveLength(4);
  });

  it("links every token to a generated face and shared back", () => {
    expect(baseGameGates.every(({ imageUrl, backImageUrl }) =>
      existsSync(`${publicDirectory}${imageUrl}`) && existsSync(`${publicDirectory}${backImageUrl}`))).toBe(true);
  });

  it("rejects incomplete and duplicate pools", () => {
    expect(() => validateGateContent(baseGameGates.slice(1))).toThrow();
    expect(() => validateGateContent([...baseGameGates.slice(0, -1), baseGameGates[0]!])).toThrow(/duplicate IDs/);
  });
});
