import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assetIds, baseGameAssets, validateAssetContent } from "../src/assets.js";
import { baseGameInvestigators } from "../src/investigators.js";

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

  it("cross-references every investigator starting Asset by stable ID", () => {
    const catalogIds = new Set(assetIds);
    const referencedIds = baseGameInvestigators.flatMap(({ startingAssetIds }) => startingAssetIds);

    expect(referencedIds).toHaveLength(10);
    expect(referencedIds.every((id) => catalogIds.has(id))).toBe(true);
    expect(baseGameInvestigators.find(({ id }) => id === "lily_chen")?.startingAssetIds).toEqual([
      "asset_protective_amulet",
      "asset_lucky_rabbits_foot",
    ]);
  });

  it("links every catalog entry to a generated front and shared back", () => {
    expect(baseGameAssets.every(({ imageUrl, backImageUrl }) =>
      existsSync(`${publicDirectory}${imageUrl}`) && existsSync(`${publicDirectory}${backImageUrl}`))).toBe(true);
  });

  it("registers values, traits, timing categories, and effect text from the supplied metadata", () => {
    expect(baseGameAssets.filter(({ value }) => value === 1)).toHaveLength(14);
    expect(baseGameAssets.filter(({ value }) => value === 2)).toHaveLength(16);
    expect(baseGameAssets.filter(({ value }) => value === 3)).toHaveLength(7);
    expect(baseGameAssets.filter(({ value }) => value === 4)).toHaveLength(3);
    expect(baseGameAssets.find(({ id }) => id === "asset_spirit_dagger")).toMatchObject({
      traits: ["item", "weapon", "magical"],
      abilityType: "passive",
      effectText: "Gain +1 [Lore] and +2 [Strength] during Combat Encounters.",
    });
    expect(baseGameAssets.every(({ rulesStatus }) => rulesStatus === "transcribed_pending_execution")).toBe(true);
  });

  it("structures only verified engine-supported effects instead of parsing card text at runtime", () => {
    expect(baseGameAssets.find(({ id }) => id === "asset_personal_assistant")?.engineEffects).toEqual([
      { type: "skill_bonus", skill: "influence", amount: 1 },
      { type: "test_reroll", skill: "influence" },
    ]);
    expect(baseGameAssets.find(({ id }) => id === "asset_fine_clothes")?.engineEffects).toEqual([
      { type: "acquire_six_counts_as_two" },
    ]);
    expect(baseGameAssets.find(({ id }) => id === "asset_king_james_bible")?.engineEffects).toEqual([
      { type: "rest_recover_additional_sanity", amount: 1 },
    ]);
    expect(baseGameAssets.find(({ id }) => id === "asset_private_care")?.engineEffects).toEqual([
      { type: "on_gain_recover_all_and_discard" },
    ]);
    expect(baseGameAssets.find(({ id }) => id === "asset_urban_guide")?.engineEffects).toEqual([{ type: "city_test_aura", amount: 1 }]);
    expect(baseGameAssets.find(({ id }) => id === "asset_lucky_rabbits_foot")?.engineEffects).toEqual([{ type: "round_test_reroll" }]);
    expect(baseGameAssets.find(({ id }) => id === "asset_lucky_rabbits_foot")?.traits).toEqual(["trinket"]);
    expect(baseGameAssets.find(({ id }) => id === "asset_hired_muscle")?.engineEffects).toEqual([
      { type: "skill_bonus", skill: "strength", amount: 1 }, { type: "test_reroll", skill: "strength" },
    ]);
    expect(baseGameAssets.find(({ id }) => id === "asset_hired_muscle")?.traits).toEqual(["ally"]);
    expect(baseGameAssets.find(({ id }) => id === "asset_bandages")?.engineEffects).toEqual([{ type: "discard_prevent_health_loss", amount: 2 }]);
    expect(baseGameAssets.find(({ id }) => id === "asset_bandages")?.traits).toEqual(["item"]);
    expect(baseGameAssets.find(({ id }) => id === "asset_whiskey")?.engineEffects).toEqual([{ type: "discard_prevent_sanity_loss", amount: 2 }]);
    expect(baseGameAssets.find(({ id }) => id === "asset_whiskey")?.traits).toEqual(["item"]);
    expect(baseGameAssets.find(({ id }) => id === "asset_lucky_cigarette_case")?.engineEffects).toEqual([{ type: "round_test_die_increment", amount: 1 }]);
    expect(baseGameAssets.find(({ id }) => id === "asset_lucky_cigarette_case")?.traits).toEqual(["trinket"]);
    expect(baseGameAssets.filter(({ engineEffects }) => engineEffects.length > 0)).toHaveLength(10);
  });

  it("explicitly scopes fourteen scan-verified Assets to non-combat encounters", () => {
    expect(baseGameAssets.filter(asset => asset.nonCombatEncounterSupport !== "unsupported")).toHaveLength(14);
    expect(baseGameAssets.find(asset => asset.id === "asset_lucky_cigarette_case")?.nonCombatEncounterSupport).toBe("skill_test");
    expect(baseGameAssets.filter(asset => asset.nonCombatEncounterSupport === "irrelevant").map(asset => asset.id).sort()).toEqual([
      "asset_38_revolver", "asset_45_automatic", "asset_arcane_manuscripts", "asset_fine_clothes", "asset_holy_cross", "asset_king_james_bible", "asset_protective_amulet",
    ]);
    expect(baseGameAssets.find(asset => asset.id === "asset_urban_guide")?.nonCombatEncounterSupport).toBe("city_test_aura");
    expect(baseGameAssets.find(asset => asset.id === "asset_personal_assistant")?.nonCombatEncounterSupport).toBe("skill_test");
    expect(baseGameAssets.find(asset => asset.id === "asset_lucky_rabbits_foot")?.nonCombatEncounterSupport).toBe("skill_test");
    expect(baseGameAssets.find(asset => asset.id === "asset_hired_muscle")?.nonCombatEncounterSupport).toBe("skill_test");
    expect(baseGameAssets.find(asset => asset.id === "asset_bandages")?.nonCombatEncounterSupport).toBe("health_prevention");
    expect(baseGameAssets.find(asset => asset.id === "asset_whiskey")?.nonCombatEncounterSupport).toBe("sanity_prevention");
  });

  it("rejects incomplete and duplicate catalogs", () => {
    expect(() => validateAssetContent(baseGameAssets.slice(1))).toThrow();
    expect(() => validateAssetContent([...baseGameAssets.slice(0, -1), baseGameAssets[0]!])).toThrow(/duplicate IDs/);
  });
});
