import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  baseGameEpicMonsters,
  baseGameMonsters,
  baseGameNormalMonsters,
  validateMonsterContent,
} from "../src/monsters.js";

describe("base-game Monster content", () => {
  it("contains the complete Core roster and token counts", () => {
    expect(baseGameNormalMonsters).toHaveLength(28);
    expect(baseGameEpicMonsters).toHaveLength(9);
    expect(baseGameNormalMonsters.reduce((total, monster) => total + monster.count, 0)).toBe(34);
    expect(baseGameEpicMonsters.reduce((total, monster) => total + monster.count, 0)).toBe(9);
    expect(() => validateMonsterContent(baseGameMonsters)).not.toThrow();
  });

  it("preserves representative printed combat statistics", () => {
    expect(baseGameMonsters.find((monster) => monster.id === "monster_dark_young")).toMatchObject({
      horrorCheck: { skill: "will", modifier: -1, damage: 3 },
      damageCheck: { skill: "strength", modifier: -3, damage: 3 },
      toughness: { base: 5, perInvestigator: 0 },
    });
    expect(baseGameMonsters.find((monster) => monster.id === "epic_monster_cthulhu")?.toughness).toEqual({ base: 3, perInvestigator: 1 });
    expect(baseGameMonsters.find((monster) => monster.id === "monster_cultist")?.toughness).toBe("ancient_one");
  });

  it("links every entry to a local token asset and its wiki page", () => {
    expect(baseGameMonsters.every((monster) => monster.imageUrl === `/monsters/${monster.id}.webp`)).toBe(true);
    expect(baseGameMonsters.every((monster) => monster.wikiPageUrl.startsWith("https://eldritchhorror.fandom.com/wiki/"))).toBe(true);
    const publicDirectory = fileURLToPath(new URL("../../../apps/web/public", import.meta.url));
    expect(baseGameMonsters.every((monster) => existsSync(`${publicDirectory}${monster.imageUrl}`))).toBe(true);
  });

  it("rejects duplicate entries and incorrect Core token totals", () => {
    expect(() => validateMonsterContent([...baseGameMonsters, baseGameMonsters[0]!])).toThrow(/duplicate IDs/);
    expect(() => validateMonsterContent(baseGameMonsters.slice(1))).toThrow(/34 normal and 9 epic/);
  });
});
