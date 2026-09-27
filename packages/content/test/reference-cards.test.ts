import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  baseGameReferenceCards,
  referenceCardForPlayerCount,
  supportedPlayerCounts,
  validateReferenceCardContent,
} from "../src/reference-cards.js";

const publicDirectory = new URL("../../../apps/web/public", import.meta.url).pathname;

describe("base-game Reference cards", () => {
  it("contains one verified face for every supported player count", () => {
    expect(baseGameReferenceCards.map(({ playerCount }) => playerCount)).toEqual(supportedPlayerCounts);
    expect(() => validateReferenceCardContent(baseGameReferenceCards)).not.toThrow();
    expect(baseGameReferenceCards.every(({ imageUrl }) => existsSync(`${publicDirectory}${imageUrl}`))).toBe(true);
  });

  it("records the printed spawn table", () => {
    expect(baseGameReferenceCards.map(({ spawnGates, spawnClues, monsterSurge }) => [spawnGates, spawnClues, monsterSurge])).toEqual([
      [1, 1, 1], [1, 1, 1], [1, 2, 2], [1, 2, 2],
      [2, 3, 2], [2, 3, 2], [2, 4, 3], [2, 4, 3],
    ]);
  });

  it("selects setup values by player count and rejects unsupported counts", () => {
    expect(referenceCardForPlayerCount(5)).toMatchObject({ spawnGates: 2, spawnClues: 3, monsterSurge: 2 });
    expect(() => referenceCardForPlayerCount(0)).toThrow(/Unsupported player count/);
    expect(() => referenceCardForPlayerCount(9)).toThrow(/Unsupported player count/);
  });

  it("rejects incomplete and duplicate tables", () => {
    expect(() => validateReferenceCardContent(baseGameReferenceCards.slice(1))).toThrow();
    expect(() => validateReferenceCardContent([...baseGameReferenceCards.slice(0, -1), baseGameReferenceCards[0]!])).toThrow(/duplicate player counts/);
  });
});
