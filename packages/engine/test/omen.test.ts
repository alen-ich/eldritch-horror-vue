import { describe, expect, it } from "vitest";
import { advanceOmenTrack, omenTrack } from "../src/omen.js";

describe("Omen track", () => {
  it("follows the printed comet, constellation, eclipse, constellation clockwise order", () => {
    expect(omenTrack).toEqual(["comet", "constellation", "eclipse", "constellation"]);
    expect(advanceOmenTrack(0, 1, ["constellation", "constellation", "comet"]))
      .toEqual({ position: 1, symbol: "constellation", enteredSymbols: ["constellation"], doomAdvanceFromGates: 2 });
  });

  it("counts each entered space, including both constellation spaces and a wrap to green", () => {
    expect(advanceOmenTrack(0, 4, ["comet", "constellation", "eclipse"]))
      .toEqual({ position: 0, symbol: "comet", enteredSymbols: ["constellation", "eclipse", "constellation", "comet"], doomAdvanceFromGates: 4 });
    expect(advanceOmenTrack(3, 1, ["comet"])).toMatchObject({ position: 0, doomAdvanceFromGates: 1 });
    expect(advanceOmenTrack(2, 0, ["eclipse"])).toMatchObject({ position: 2, enteredSymbols: [], doomAdvanceFromGates: 0 });
  });

  it("does not advance Doom without a matching active Gate", () => {
    expect(advanceOmenTrack(0, 1, ["comet", "eclipse"]).doomAdvanceFromGates).toBe(0);
  });

  it("rejects invalid positions and step counts", () => {
    expect(() => advanceOmenTrack(-1, 1, [])).toThrow(/position/);
    expect(() => advanceOmenTrack(4, 1, [])).toThrow(/position/);
    expect(() => advanceOmenTrack(0, -1, [])).toThrow(/nonnegative/);
    expect(() => advanceOmenTrack(0, 1.5, [])).toThrow(/nonnegative/);
  });
});
