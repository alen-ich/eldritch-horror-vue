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
    expect(baseGameMythosCards.find(card => card.id === "mythos_yellow_08")?.effect).toEqual({ type: "lead_choose_omen_without_doom" });
    expect(baseGameMythosCards.find(card => card.id === "mythos_yellow_07")?.effect).toEqual({ type: "each_investigator_choose_world_fights_back" });
    expect(baseGameMythosCards.find(card => card.id === "mythos_yellow_05")?.effect).toEqual({ type: "lead_gain_ally_asset" });
    expect(baseGameMythosCards.find(card => card.id === "mythos_yellow_06")?.effect).toEqual({ type: "each_investigator_trade_debt_for_condition" });
    expect(baseGameMythosCards.find(card => card.id === "mythos_green_14")?.effect).toEqual({ type: "discard_matching_gates_and_advance_doom" });
    expect(baseGameMythosCards.find(card => card.id === "mythos_yellow_10")?.effect).toEqual({ type: "doom_two_unless_lead_gains_dark_pact" });
    expect(baseGameMythosCards.find(card => card.id === "mythos_green_18")?.effect).toEqual({ type: "spawn_monster_on_each_cultist_space" });
    expect(baseGameMythosCards.find(card => card.id === "mythos_yellow_20")?.effect).toEqual({ type: "roll_each_investigator_for_bermuda_triangle" });
    expect(baseGameMythosCards.find(card => card.id === "mythos_green_03")?.effect).toEqual({ type: "group_discard_gate_then_advance_doom_if_nonmatching" });
    expect(baseGameMythosCards.find(card => card.id === "mythos_green_08")?.effect).toEqual({ type: "torn_asunder" });
    expect(baseGameMythosCards.find(card => card.id === "mythos_yellow_14")?.effect).toEqual({ type: "each_investigator_choose_heat_wave" });
    expect(baseGameMythosCards.filter(card => card.effectModelStatus === "typed")).toHaveLength(13);
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
