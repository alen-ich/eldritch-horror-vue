import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { baseGameMythosCards, validateMythosContent } from "../src/mythos.js";

const publicDirectory = new URL("../../../apps/web/public", import.meta.url).pathname;

describe("base-game Mythos cards", () => {
  it("contains the complete color composition", () => {
    expect(baseGameMythosCards).toHaveLength(51);
    expect(baseGameMythosCards.filter((card) => card.color === "green")).toHaveLength(18);
    expect(baseGameMythosCards.filter((card) => card.color === "yellow")).toHaveLength(21);
    expect(baseGameMythosCards.filter((card) => card.color === "blue")).toHaveLength(12);
  });

  it("records the scan-backed titles and card kinds", () => {
    expect(baseGameMythosCards[0]?.title).toBe("Secrets of the Past");
    expect(baseGameMythosCards.find((card) => card.title === "Strange Sightings")?.kind).toBe("ongoing");
    expect(baseGameMythosCards.filter((card) => card.kind === "rumor")).toHaveLength(12);
    expect(() => validateMythosContent(baseGameMythosCards)).not.toThrow();
  });

  it("links every record to a generated English scan", () => {
    expect(baseGameMythosCards.every((card) => card.verification === "verified_from_scan")).toBe(true);
    expect(baseGameMythosCards.every((card) => existsSync(`${publicDirectory}${card.imageUrl}`))).toBe(true);
  });

  it("rejects incomplete and duplicate decks", () => {
    expect(() => validateMythosContent(baseGameMythosCards.slice(1))).toThrow(/exactly 51/);
    expect(() => validateMythosContent([...baseGameMythosCards.slice(0, -1), baseGameMythosCards[0]!])).toThrow(/duplicate IDs/);
  });
});
