import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { baseGameSpells, spellKinds, validateSpellContent } from "../src/spells.js";

const root = new URL("../../../", import.meta.url).pathname;

describe("base-game Spells", () => {
  it("contains 20 physical cards, two copies of each of the ten printed names", () => {
    expect(baseGameSpells).toHaveLength(20);
    expect(spellKinds).toHaveLength(10);
    for (const kind of spellKinds) expect(baseGameSpells.filter(card => card.kind === kind)).toHaveLength(2);
    expect(() => validateSpellContent(baseGameSpells)).not.toThrow();
    expect(baseGameSpells.find(card => card.kind === "mists_of_releh")?.name).toBe("Mists of Releh");
  });

  it("keeps individual reverse images private and matched by sheet position", () => {
    for (const card of baseGameSpells) {
      expect(existsSync(`${root}${card.sourceFrontSheet}`)).toBe(true);
      expect(existsSync(`${root}${card.sourceBackSheet}`)).toBe(true);
      expect(existsSync(`${root}apps/web/public${card.frontImageUrl}`)).toBe(true);
      expect(existsSync(`${root}apps/server/private-card-assets/spells/${card.id}.webp`)).toBe(true);
      expect(existsSync(`${root}apps/web/public/cards/spells/${card.id}-back.webp`)).toBe(false);
      expect(card.backVisibility).toBe("server_only");
      expect(card.effectStatus).toBe("not_executable");
    }
    expect(baseGameSpells.find(card => card.id === "spell_blessing_of_isis_02")?.sheetSlot).toBe(3);
  });

  it("rejects wrong order and mismatched spell tests", () => {
    expect(() => validateSpellContent(baseGameSpells.slice(0, -1))).toThrow();
    expect(() => validateSpellContent(baseGameSpells.map((card, index) => index === 3 ? { ...card, loreModifier: 0 } : card))).toThrow();
    expect(() => validateSpellContent([baseGameSpells[1]!, baseGameSpells[0]!, ...baseGameSpells.slice(2)])).toThrow();
  });
});
