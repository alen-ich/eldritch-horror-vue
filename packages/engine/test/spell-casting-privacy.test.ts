import { describe, it, expect } from "vitest";
import { validateSpellCastingState, projectPublicState } from "../src/index.js";
import { spellState, holdSpell, spellContent } from "./spell-fixtures.js";
describe("Spell casting private validation", () => {
  it("accepts legacy inventory, rejects corrupt usage and hides private state", () => {
    const state = spellState();
    expect(validateSpellCastingState(state, spellContent)).toBeUndefined();
    state.privateState.spellCasting = { usedPhysicalIds: ["secret"] };
    expect(validateSpellCastingState(state, spellContent)).toBeTruthy();
    expect(JSON.stringify(projectPublicState(state))).not.toContain("secret");
  });
  it("rejects missing source, mismatched decision and forged stage", () => {
    const state = spellState(); holdSpell(state, "spell_feed_the_mind_01");
    state.privateState.spellCasting = { usedPhysicalIds: ["spell_feed_the_mind_01"], pending: { casterPlayerId: "host", sourcePhysicalId: "spell_feed_the_mind_01", startedTurnNumber: state.turnNumber, stage: "target", actionReserved: true, finalDice: [6], finalSuccesses: 1 } };
    expect(validateSpellCastingState(state, spellContent)).toBeTruthy();
    expect(JSON.stringify(projectPublicState(state))).not.toContain("sourcePhysicalId");
  });
});
