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

  it("types only Mythos texts verified for execution", () => {
    expect(baseGameMythosCards.find(card => card.id === "mythos_green_04")?.effect).toEqual({ type: "lead_gain_condition", kind: "blessed" });
    expect(baseGameMythosCards.find(card => card.id === "mythos_yellow_13")?.effect).toEqual({ type: "move_omen_counterclockwise_then_advance_doom_for_gates" });
    expect(baseGameMythosCards.filter(card => card.effectModelStatus === "typed")).toHaveLength(2);
  });

  it("records the printed left-to-right icon sequence and blue-card token operands", () => {
    expect(baseGameMythosCards.find(card => card.id === "mythos_green_01")?.icons)
      .toEqual([{ type: "advance_omen" }, { type: "monster_surge" }, { type: "spawn_clues" }]);
    expect(baseGameMythosCards.find(card => card.id === "mythos_yellow_21")?.icons)
      .toEqual([{ type: "advance_omen" }, { type: "resolve_reckoning" }, { type: "spawn_gates" }]);
    expect(baseGameMythosCards.find(card => card.id === "mythos_blue_01")?.icons)
      .toEqual([{ type: "spawn_clues" }]);
    expect(baseGameMythosCards.find(card => card.id === "mythos_blue_02")?.icons)
      .toEqual([{ type: "spawn_clues" }, { type: "place_rumor_token", spaceId: "space_2" }, { type: "place_eldritch_tokens", count: 4 }]);
    expect(baseGameMythosCards.find(card => card.id === "mythos_blue_06")?.icons)
      .toEqual([{ type: "spawn_clues" }, { type: "place_rumor_token", spaceId: "space_11" }, { type: "place_eldritch_tokens", count: 8 }]);
    expect(baseGameMythosCards.find(card => card.id === "mythos_blue_12")?.icons)
      .toEqual([{ type: "spawn_clues" }, { type: "place_eldritch_tokens", count: 4 }]);
  });

  it("links every record to a generated English scan", () => {
    expect(baseGameMythosCards.every((card) => card.verification === "verified_from_scan")).toBe(true);
    expect(baseGameMythosCards.every((card) => existsSync(`${publicDirectory}${card.imageUrl}`))).toBe(true);
  });

  it("rejects incomplete and duplicate decks", () => {
    expect(() => validateMythosContent(baseGameMythosCards.slice(1))).toThrow(/exactly 51/);
    expect(() => validateMythosContent([...baseGameMythosCards.slice(0, -1), baseGameMythosCards[0]!])).toThrow(/duplicate IDs/);
    expect(() => validateMythosContent([baseGameMythosCards[0]!, { ...baseGameMythosCards[1]!, icons: [{ type: "spawn_clues" }] }, ...baseGameMythosCards.slice(2)])).toThrow(/Invalid icon sequence/);
  });
});
