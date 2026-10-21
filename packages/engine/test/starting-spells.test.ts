import { describe, expect, it } from "vitest";
import { executeCommand, projectPublicState, validateSpellInventory, validateStartingSpells, type CommandResult, type GameContent, type GameState, type EngineContext } from "../src/index.js";
import { spellContent, spellState, spellContext, holdSpell } from "./spell-fixtures.js";

import { startingContent, lobby } from "./starting-spell-fixtures.js";

function accepted(result: CommandResult): GameState {
  if (!result.ok) throw new Error(result.error.code);
  return result.state;
}

describe("starting Spell grants", () => {
  for (const reverse of [false, true]) {
    it(`starts Norman with a conserved copy ${reverse ? "01" : "02"}`, () => {
      const before = lobby(), content = startingContent();
      const context: EngineContext = { ...spellContext, shuffle: items => reverse ? [...items].reverse() : [...items] };
      const result = executeCommand(before, "host", { type: "START_GAME" }, content, context);
      const state = accepted(result);
      expect(state.privateState.spells!.heldByPlayer.host).toEqual([reverse ? "spell_feed_the_mind_01" : "spell_feed_the_mind_02"]);
      expect(state.privateState.spells!.deck).toHaveLength(19);
      expect(projectPublicState(state).players[0]!.spellIds).toEqual(["spell_feed_the_mind"]);
      expect(projectPublicState(state).players[1]!.spellIds).toEqual([]);
      expect(validateSpellInventory(state, content.spells!)).toBeUndefined();
      expect(state.stateVersion).toBe(before.stateVersion + 1);
      expect(state.actionsRemaining).toBe(2);
      expect(state.privateState.spellCasting!.usedPhysicalIds).toEqual([]);
      expect(result).toMatchObject({ events: expect.arrayContaining([{ type: "SPELL_GAINED", playerId: "host", spellId: "spell_feed_the_mind" }]) });
      const control = accepted(executeCommand(before, "host", { type: "START_GAME" }, spellContentWithNormanWithoutGrant(), context));
      expect(state.reserveAssetIds).toEqual(control.reserveAssetIds);
      expect(state.activeMysteryId).toEqual(control.activeMysteryId);
      expect(before).toEqual(lobby());
    });
  }

  it("does not change no-grant setup or repeat start", () => {
    const before = lobby(); before.players[0]!.investigatorId = "trish_scarborough";
    const state = accepted(executeCommand(before, "host", { type: "START_GAME" }, startingContent(), spellContext));
    expect(state.privateState.spells!.deck).toHaveLength(20);
    const snapshot = structuredClone(state);
    expect(executeCommand(state, "host", { type: "START_GAME" }, startingContent(), spellContext).ok).toBe(false);
    expect(state).toEqual(snapshot);
  });

  for (const available of [2, 1, 0]) {
    it(`replacement searches only supply with ${available} copies available`, () => {
      const before = spellState(); before.players[0]!.defeated = true;
      before.replacementWindow = true;
      before.privateState.spellCasting = { usedPhysicalIds: ["spell_feed_the_mind_01"] };
      before.privateState.investigatorAbilityUsageVersion = 1;
      before.privateState.investigatorAbilityUsage = { schemaVersion: 1, normanClueSubstitutions: [{ playerId: "host", investigatorId: "norman_withers", round: before.turnNumber }] };
      if (available < 2) holdSpell(before, "spell_feed_the_mind_01", "guest");
      if (available === 0) {
        before.privateState.spells!.deck = before.privateState.spells!.deck.filter(id => id !== "spell_feed_the_mind_02");
        before.defeatedInvestigators = [{ investigatorId: "jim_culver", locationId: "arkham", cause: "health", clues: 0, travelTickets: [], assetIds: [], artifactIds: [] }];
        before.privateState.spells!.heldByDefeatedInvestigator.jim_culver = ["spell_feed_the_mind_02"];
      }
      const state = accepted(executeCommand(before, "host", { type: "REPLACE_INVESTIGATOR", investigatorId: "norman_withers" }, startingContent(), spellContext));
      expect(state.players[0]!.investigatorId).toBe("norman_withers");
      expect(state.privateState.spells!.heldByPlayer.host).toHaveLength(available > 0 ? 1 : 0);
      expect(state.privateState.spells!.heldByPlayer.guest).toEqual(before.privateState.spells!.heldByPlayer.guest);
      expect(state.privateState.spells!.heldByDefeatedInvestigator).toEqual(before.privateState.spells!.heldByDefeatedInvestigator);
      expect(validateSpellInventory(state, startingContent().spells!)).toBeUndefined();
      expect(state.privateState.spellCasting).toEqual(before.privateState.spellCasting);
      expect(state.privateState.investigatorAbilityUsage).toEqual(before.privateState.investigatorAbilityUsage);
      expect(state.stateVersion).toBe(before.stateVersion + 1);
    });
  }

  it("allows replacement with a fully exhausted conserved supply and leaves Lily empty", () => {
    const state = spellState(); state.players[0]!.defeated = true; state.replacementWindow = true;
    const cards = [...state.privateState.spells!.deck];
    state.privateState.spells!.deck = [];
    state.privateState.spells!.heldByPlayer.guest = cards.filter(id => id.endsWith("_01"));
    state.defeatedInvestigators = [{ investigatorId: "jim_culver", locationId: "arkham", cause: "health", clues: 0, travelTickets: [], assetIds: [] }];
    state.privateState.spells!.heldByDefeatedInvestigator.jim_culver = cards.filter(id => id.endsWith("_02"));
    for (const investigatorId of ["norman_withers", "lily_chen"] as const) {
      const result = accepted(executeCommand(state, "host", { type: "REPLACE_INVESTIGATOR", investigatorId }, startingContent(), spellContext));
      expect(result.privateState.spells).toEqual(state.privateState.spells);
      expect(result.players[0]!.investigatorId).toBe(investigatorId);
      expect(validateSpellInventory(result, startingContent().spells!)).toBeUndefined();
    }
  });
});

function spellContentWithNormanWithoutGrant(): GameContent {
  const content = startingContent();
  delete content.investigators.norman_withers!.startingSpellIds;
  return content;
}

describe("starting Spell configuration", () => {
  it("allows minimal content without executable grants or a catalog", () => {
    expect(validateStartingSpells({ ...spellContent, spells: undefined })).toBeUndefined();
    expect(validateStartingSpells(startingContent())).toBeUndefined();
  });
  for (const ids of [["spell_unknown"], ["spell_wither"], ["spell_feed_the_mind", "spell_feed_the_mind"], "spell_feed_the_mind", null]) {
    it(`rejects runtime starting mapping ${JSON.stringify(ids)}`, () => {
      const content = startingContent();
      Object.assign(content.investigators.norman_withers!, { startingSpellIds: ids });
      expect(validateStartingSpells(content)).toBeDefined();
    });
  }
  it("rejects a supported front on the wrong investigator and missing catalog", () => {
    const content = startingContent();
    content.investigators.mark_harrigan = { ...content.investigators.mark_harrigan!, startingSpellIds: ["spell_feed_the_mind"] };
    expect(validateStartingSpells(content)).toBeDefined();
    expect(validateStartingSpells({ ...startingContent(), spells: undefined })).toBeDefined();
    expect(validateStartingSpells({ ...startingContent(), spells: spellContent.spells!.filter(card => card.kind !== "feed_the_mind") })).toBeDefined();
  });
});
