import { existsSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { baseGameArtifacts, validateArtifactContent } from "../src/artifacts.js";
import { baseGameScannedTokenEncounters, missingBaseGameTokenEncounterIds, tokenEncounterDeckIds, baseGameTokenEncounterCounts, validateTokenEncounterContent } from "../src/token-encounters.js";

const root = new URL("../../../", import.meta.url).pathname;

describe("remaining base-game scan import", () => {
  it("contains exactly 32 Research, 24 Other World, 18 Expedition, 12 Special, and 14 Artifacts", () => {
    for (const [family, count] of [["research", 32], ["other_world", 24], ["expedition", 18], ["special", 12]] as const) {
      expect(baseGameScannedTokenEncounters.filter(card => card.family === family)).toHaveLength(count);
    }
    expect(baseGameArtifacts).toHaveLength(14);
    expect(missingBaseGameTokenEncounterIds(baseGameScannedTokenEncounters)).toEqual([]);
    for (const deck of tokenEncounterDeckIds) {
      expect(baseGameScannedTokenEncounters.filter(card => card.deck === deck).map(card => card.number).sort((a, b) => a - b))
        .toEqual(Array.from({ length: baseGameTokenEncounterCounts[deck] }, (_, index) => index + 1));
    }
    const ids = baseGameScannedTokenEncounters.map(card => card.id);
    expect(missingBaseGameTokenEncounterIds(baseGameScannedTokenEncounters.slice(1))).toEqual([ids[0]]);
    expect(new Set([...baseGameScannedTokenEncounters, ...baseGameArtifacts].map(card => card.backImageUrl)).size).toBe(14);
  });

  it("preserves printed section types and non-sequential Himalayas numbering", () => {
    const himalayas = baseGameScannedTokenEncounters.filter(card => card.deck === "expedition_the_himalayas");
    expect(himalayas.map(card => [card.number, card.sourceCellIndex])).toEqual([[2, 0], [1, 1], [3, 2]]);
    expect(baseGameScannedTokenEncounters.find(card => card.deck === "research_cthulhu")?.sections).toEqual(["city", "wilderness", "sea"]);
    expect(himalayas[0]?.sections).toEqual(["initial", "pass", "fail"]);
    expect(baseGameScannedTokenEncounters.find(card => card.id === "encounter_other_world_24")?.name).toBe("Lost Carcosa");
  });

  it("links every card to readable generated artwork and supplied front/back sources", async () => {
    for (const card of [...baseGameScannedTokenEncounters, ...baseGameArtifacts]) {
      expect(existsSync(`${root}${card.sourceScan}`)).toBe(true);
      expect(existsSync(`${root}apps/web/public${card.backImageUrl}`)).toBe(true);
      const metadata = await sharp(`${root}apps/web/public${card.imageUrl}`).metadata();
      expect(metadata.format).toBe("webp");
      expect(metadata.width).toBeGreaterThan(250);
      expect(metadata.height).toBeGreaterThan(450);
      expect(metadata.width! / metadata.height!).toBeGreaterThan(.5);
      expect(metadata.width! / metadata.height!).toBeLessThan(.8);
    }
    for (const card of baseGameScannedTokenEncounters) {
      expect(existsSync(`${root}${card.sourceBackScan}`)).toBe(true);
      expect(card.effectStatus).toBe("not_executable");
    }
    expect(baseGameArtifacts.every(card => card.rulesStatus === "transcribed_pending_execution")).toBe(true);
    expect(baseGameArtifacts.find(card => card.id === "artifact_sword_of_saint_jerome")).toMatchObject({ traits: ["item", "weapon", "magical"] });
    expect(baseGameArtifacts.find(card => card.id === "artifact_cultes_des_goules")?.engineEffects).toEqual([{ type: "action_lore_spend_sanity_gain_clues", amount: 2 }]);
    const cultes = baseGameArtifacts.find(card => card.id === "artifact_cultes_des_goules")!;
    expect(() => validateArtifactContent([{ ...cultes, engineEffects: undefined }])).toThrow(/mapping/);
    const vermis = baseGameArtifacts.find(card => card.id === "artifact_de_vermis_mysteriis")!;
    expect(vermis.engineEffects).toEqual([{ type: "action_lore_spend_sanity_improve_skill" }]);
    expect(() => validateArtifactContent([{ ...vermis, engineEffects: undefined }])).toThrow(/mapping/);
  });

  it("rejects duplicates, expansion numbers, mismatched backs and false execution status", () => {
    const first = baseGameScannedTokenEncounters[0]!;
    expect(() => validateTokenEncounterContent([first, first])).toThrow(/duplicate IDs/);
    expect(() => validateTokenEncounterContent([{ ...first, number: 9 }])).toThrow(/mapping/);
    expect(() => validateTokenEncounterContent([{ ...first, backImageUrl: "/cards/encounters/research_cthulhu/back.webp" }])).toThrow(/mapping/);
    expect(() => validateTokenEncounterContent([{ ...first, effectStatus: "executable" } as unknown as typeof first])).toThrow();
    const artifact = baseGameArtifacts[0]!;
    expect(() => validateArtifactContent([artifact, artifact])).toThrow(/duplicate IDs/);
    expect(() => validateArtifactContent([{ ...artifact, id: "artifact_expansion" }])).toThrow(/mapping/);
    expect(() => validateArtifactContent([{ ...artifact, effectText: "Silently changed" }])).toThrow(/mapping/);
  });
});
