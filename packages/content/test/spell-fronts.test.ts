import { expect, it } from "vitest";
import { baseGameSpellFronts } from "../src/spells.js";
it("provides ten safe front identities without tying holdings to a reverse", () => {
  expect(baseGameSpellFronts).toHaveLength(10);
  expect(baseGameSpellFronts.find(card => card.id === "spell_wither")).toEqual({ id: "spell_wither", name: "Wither", trait: "incantation", frontImageUrl: "/cards/spells/spell_wither_01.webp" });
  expect(baseGameSpellFronts.every(card => !/_\d\d$/.test(card.id))).toBe(true);
  expect(JSON.stringify(baseGameSpellFronts)).not.toMatch(/backText|backImage|sheetSlot/);
});
