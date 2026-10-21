import { describe, expect, it } from "vitest";
import { baseGameAssets } from "../../content/src/assets.js";
import { baseGameArtifacts } from "../../content/src/artifacts.js";
import { spellTestItemBonuses, validateSpellTestApplicability } from "../src/spell-test-assets.js";
import { spellState, spellContent } from "./spell-fixtures.js";
describe("Spell test Asset scope", () => {
  it("allows verified irrelevant combat/Encounter possessions but blocks Spell modifiers", () => {
    const state=spellState();state.players[0]!.assetIds=["asset_kerosene"];state.players[0]!.artifactIds=["artifact_pallid_mask"];
    const content={...spellContent,assets:baseGameAssets,artifacts:baseGameArtifacts};
    state.privateState.deckOrderById.artifacts=baseGameArtifacts.filter(card=>card.id!=="artifact_pallid_mask").map(card=>card.id);
    expect(validateSpellTestApplicability(state,"host",content)).toBeUndefined();
    state.players[0]!.artifactIds=["artifact_glass_of_mortlan"];
    expect(validateSpellTestApplicability(state,"host",content)?.ok).toBe(false);
  });
  it("uses the verified Manuscripts bonus, preserving physical uniqueness", () => {
    const state=spellState(); state.players[0]!.assetIds=["asset_arcane_manuscripts"];
    const content={...spellContent, assets:baseGameAssets};
    expect(spellTestItemBonuses(state,"host",content)).toEqual([1]);
    expect(validateSpellTestApplicability(state,"host",content)).toBeUndefined();
    state.assetDiscardIds.push("asset_arcane_manuscripts");
    expect(validateSpellTestApplicability(state,"host",content)?.ok).toBe(false);
  });
  it("blocks unknown effects but permits scoped Norman substitution", () => {
    const state=spellState(); state.players[0]!.assetIds=["unknown"];
    expect(validateSpellTestApplicability(state,"host",spellContent)?.ok).toBe(false);
    state.players[0]!.assetIds=[]; state.players[0]!.investigatorId="norman_withers";
    expect(validateSpellTestApplicability(state,"host",spellContent)).toBeUndefined();
  });
});
