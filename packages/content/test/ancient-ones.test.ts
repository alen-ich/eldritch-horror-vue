import { describe, expect, it } from "vitest";
import { ancientOneIds, baseGameAncientOnes, validateAncientOneContent } from "../src/ancient-ones.js";

describe("base-game Ancient Ones", () => {
  it("contains the complete four-sheet roster with stable source provenance", () => {
    expect(baseGameAncientOnes.map((ancientOne) => ancientOne.id)).toEqual(ancientOneIds);
    expect(baseGameAncientOnes.every((ancientOne) => ancientOne.sourceSha256.length === 64)).toBe(true);
    expect(() => validateAncientOneContent(baseGameAncientOnes)).not.toThrow();
  });

  it("records printed Doom and three-stage Mythos compositions", () => {
    expect(baseGameAncientOnes.map(({ id, startingDoom }) => [id, startingDoom])).toEqual([
      ["cthulhu", 12],
      ["shub_niggurath", 13],
      ["yog_sothoth", 14],
      ["azathoth", 15],
    ]);
    expect(baseGameAncientOnes.find((ancientOne) => ancientOne.id === "cthulhu")?.mythosDeck).toEqual([
      { green: 0, yellow: 2, blue: 2 },
      { green: 1, yellow: 3, blue: 0 },
      { green: 3, yellow: 4, blue: 0 },
    ]);
  });

  it("keeps setup dependencies as stable component references", () => {
    const shub = baseGameAncientOnes.find((ancientOne) => ancientOne.id === "shub_niggurath")!;
    expect(shub.setup).toEqual([
      { type: "set_aside_monster", monsterId: "monster_ghoul", quantity: 2 },
      { type: "set_aside_monster", monsterId: "monster_goat_spawn", quantity: 2 },
      { type: "set_aside_monster", monsterId: "monster_dark_young", quantity: 1 },
    ]);
  });

  it("models different awakened victory and loss conditions explicitly", () => {
    expect(baseGameAncientOnes.find((ancientOne) => ancientOne.id === "cthulhu")?.finalMystery).toMatchObject({
      type: "defeat_epic_monster",
      monsterId: "epic_monster_cthulhu",
    });
    expect(baseGameAncientOnes.find((ancientOne) => ancientOne.id === "yog_sothoth")?.finalMystery).toMatchObject({
      type: "special_encounter_progress",
      target: "half_investigators",
    });
    expect(baseGameAncientOnes.find((ancientOne) => ancientOne.id === "azathoth")?.finalMystery).toEqual({
      type: "immediate_loss",
    });
  });

  it("rejects duplicate or incomplete rosters", () => {
    expect(() => validateAncientOneContent([...baseGameAncientOnes, baseGameAncientOnes[0]])).toThrow(/duplicate IDs/);
    expect(() => validateAncientOneContent(baseGameAncientOnes.slice(1))).toThrow(/does not match the base-game roster/);
  });
});
