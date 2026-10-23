import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { baseGameExpeditionRules, validateExpeditionRules } from "../src/expedition-rules.js";
import { baseGameScannedTokenEncounters } from "../src/token-encounters.js";

const sourceHashes = {
  "africa-front.jpg": "baff42d5e47489ffb409442825611c4e7cf9407ef12e8628fcbe6318c0bdfc48",
  "himalayas-front.jpg": "19465a90449db6bdd3fec6cd64395252c0125eb9582af6320c10d9cb328e3370",
  "amazon-front-1.jpg": "8e346a6d113a3caf9e89fed3ad4ff9192b7ac24477f991847c4d84ffe9b4de6e",
  "amazon-front-2.jpg": "a04cf8038369d5a2d6b60022e7e2f3a051c194334b4d5f26360be5371343a611",
  "tunguska-front.jpg": "cdfe6720cf14ce2b1b0a30bc5d0bb7a3b84a85573ddaaa2c38881f3afd1c5ad6",
  "antarctica-front-1.jpg": "5158ea74658f400f9d69804ab20518c2c74549635fb811b163455b3cbcf33624",
  "antarctica-front-2.jpg": "3558d39c22b5a2a3151caf779580b94103a4866a2b8b9ac75dc63ef2b89d4bb6",
  "pyramids-front.jpg": "fda1037521024d1f01023ce6b7402cf21114dd932daa57319d1d66a7d844dd60",
};

function card(suffix: string) {
  const found = baseGameExpeditionRules.find(entry => entry.id === `encounter_expedition_${suffix}`);
  expect(found).toBeDefined();
  return found!;
}

describe("scan-verified Expedition mechanics", () => {
  it("covers each physical front once and keeps every entry non-executable", () => {
    expect(baseGameExpeditionRules).toHaveLength(18);
    expect(new Set(baseGameExpeditionRules.map(entry => entry.id)).size).toBe(18);
    for (const entry of baseGameExpeditionRules) {
      const scan = baseGameScannedTokenEncounters.find(scan => scan.id === entry.id)!;
      expect(entry.sourceScan).toBe(scan.sourceScan);
      expect(entry.sourceCellIndex).toBe(scan.sourceCellIndex);
      expect(entry.number).toBe(scan.number);
      expect(entry.effectStatus).toBe("not_executable");
      expect(entry.verification).toBe("mechanics_verified_from_scan");
      expect(entry.pass.mechanics).toContain("Test ");
      expect(entry.fail.mechanics).toContain("Test ");
    }
    for (const site of ["the_heart_of_africa", "the_himalayas", "the_amazon", "tunguska", "antarctica", "the_pyramids"]) {
      expect(baseGameExpeditionRules.filter(entry => entry.locationId === site)).toHaveLength(3);
    }
    expect(() => validateExpeditionRules(baseGameExpeditionRules)).not.toThrow();
  });

  it("preserves printed Himalayas numbering and the spawn/combat initial effect", () => {
    expect(card("the_himalayas_01").sourceCellIndex).toBe(1);
    expect(card("the_himalayas_01").initial.kind).toBe("spawn_and_encounter_monster");
    expect(card("the_himalayas_01").fail.test).toEqual({ skill: "observation", modifier: 0 });
    expect(card("the_himalayas_01").fail.mechanics).toContain("discard that Monster");
    expect(card("the_himalayas_02").sourceCellIndex).toBe(0);
    expect(card("the_himalayas_02").initial).toMatchObject({ kind: "test", skill: "observation", modifier: 0 });
    expect(card("antarctica_01").pass.test).toEqual({ skill: "will", modifier: 0 });
  });

  it("preserves unconditional rewards/losses before follow-up tests and distinct failure resources", () => {
    expect(card("the_amazon_03").pass.mechanics).toMatch(/^Gain 1 Artifact\. Test Observation \(-1\)/);
    expect(card("the_heart_of_africa_01").fail.mechanics).toMatch(/^Lose 1 Health and gain a Back Injury Condition\. Test Observation \(-1\)/);
    expect(card("the_pyramids_03").pass.mechanics).toContain("On failure, lose 1 Health.");
    expect(card("antarctica_03").pass.mechanics).toContain("On failure, lose 1 Sanity.");
    expect(card("tunguska_03").fail.mechanics).toMatch(/^Gain an Internal Injury Condition\. Test Influence \(0\)/);
  });

  for (const corruption of ["skill", "amount", "source", "status", "identity", "missing"] as const) {
    it(`rejects altered ${corruption}`, () => {
      const cards = baseGameExpeditionRules.map(entry => structuredClone(entry));
      if (corruption === "skill") cards[0]!.pass.test.skill = "will";
      if (corruption === "amount") cards[0]!.pass.mechanics = cards[0]!.pass.mechanics.replace("by 1", "by 2");
      if (corruption === "source") cards[0]!.sourceCellIndex++;
      if (corruption === "status") Object.assign(cards[0]!, { effectStatus: "executable" });
      if (corruption === "identity") cards[0]!.id = cards[1]!.id;
      if (corruption === "missing") cards.pop();
      expect(() => validateExpeditionRules(cards)).toThrow();
    });
  }

  for (const [file, expected] of Object.entries(sourceHashes)) {
    it(`pins the inspected ${file} source bytes`, () => {
      const bytes = readFileSync(new URL(`../../../source-assets/expeditions/${file}`, import.meta.url));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(expected);
    });
  }
});
