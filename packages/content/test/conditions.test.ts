import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { baseGameConditions, conditionKinds, validateConditionContent } from "../src/conditions.js";

const root = new URL("../../../", import.meta.url).pathname;

describe("base-game Conditions", () => {
  it("contains all 36 physical cards with the printed copy counts", () => {
    expect(baseGameConditions).toHaveLength(36);
    expect(conditionKinds).toHaveLength(11);
    expect(baseGameConditions.filter(card => card.kind === "debt")).toHaveLength(6);
    for (const kind of conditionKinds.filter(kind => kind !== "debt")) {
      expect(baseGameConditions.filter(card => card.kind === kind)).toHaveLength(3);
    }
    expect(() => validateConditionContent(baseGameConditions)).not.toThrow();
  });

  it("pairs every front with a private, non-public reverse by physical sheet slot", () => {
    for (const card of baseGameConditions) {
      expect(existsSync(`${root}${card.sourceFrontSheet}`)).toBe(true);
      expect(existsSync(`${root}${card.sourceBackSheet}`)).toBe(true);
      expect(existsSync(`${root}apps/web/public${card.frontImageUrl}`)).toBe(true);
      expect(existsSync(`${root}apps/server/private-card-assets/conditions/${card.id}.webp`)).toBe(true);
      expect(existsSync(`${root}apps/web/public/cards/conditions/${card.id}-back.webp`)).toBe(false);
      expect(card.backVisibility).toBe("server_only");
      expect(card.backTextStatus).toBe("verified");
      expect(card.effectStatus).toBe("not_executable");
    }
    expect(baseGameConditions.find(card => card.id === "condition_blessed_03")?.sourceFrontSheet).toBe("source-assets/conditions/front-2.jpg");
    expect(baseGameConditions.find(card => card.id === "condition_back_injury_01")?.sheetSlot).toBe(1);
  });

  it("rejects duplicates, wrong copy counts, and mispaired sheet slots", () => {
    const first = baseGameConditions[0]!;
    expect(() => validateConditionContent([...baseGameConditions.slice(0, -1), first])).toThrow();
    expect(() => validateConditionContent(baseGameConditions.slice(0, -1))).toThrow();
    expect(() => validateConditionContent(baseGameConditions.map((card, index) => index === 32 ? { ...card, sheetSlot: 7 } : card))).toThrow();
  });
});
