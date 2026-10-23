import { describe, expect, it } from "vitest";
import { baseGameExpeditionSetup, validateExpeditionSetupContent } from "../src/expeditions.js";

describe("base-game Expedition setup catalog", () => {
  it("contains all 18 physical cards, three for each canonical site", () => {
    expect(baseGameExpeditionSetup).toHaveLength(18);
    expect(new Set(baseGameExpeditionSetup.map(card => card.id)).size).toBe(18);
    for (const site of ["the_heart_of_africa", "the_himalayas", "the_amazon", "tunguska", "antarctica", "the_pyramids"]) {
      expect(baseGameExpeditionSetup.filter(card => card.locationId === site)).toHaveLength(3);
    }
    expect(baseGameExpeditionSetup.find(card => card.id === "encounter_expedition_the_himalayas_01")?.locationId).toBe("the_himalayas");
    expect(() => validateExpeditionSetupContent(baseGameExpeditionSetup)).not.toThrow();
  });

  for (const corruption of ["duplicate", "missing", "foreign", "wrong site", "unknown property"] as const) {
    it(`rejects ${corruption} without changing the catalog`, () => {
      const cards = baseGameExpeditionSetup.map(card => ({ ...card }));
      if (corruption === "duplicate") cards[0] = { ...cards[1]! };
      if (corruption === "missing") cards.pop();
      if (corruption === "foreign") cards[0]!.id = "encounter_expedition_foreign_01";
      if (corruption === "wrong site") cards[0]!.locationId = "antarctica";
      if (corruption === "unknown property") Object.assign(cards[0]!, { hiddenOutcome: "not setup metadata" });
      expect(() => validateExpeditionSetupContent(cards)).toThrow();
      expect(baseGameExpeditionSetup).toHaveLength(18);
    });
  }
});
