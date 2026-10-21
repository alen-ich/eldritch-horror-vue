import { expect, it } from "vitest";
import { executeCommand, projectPublicState, projectStateForPlayer, validateSpellInventory } from "../src/index.js";
import { holdSpell, spellContent, spellContext, spellState } from "./spell-fixtures.js";
it("sets up all 20 Spells after existing setup randomness and increments once", () => {
  const before = spellState(); before.phase = "lobby"; delete before.privateState.spells;
  const withSpells = executeCommand(before, "host", { type: "START_GAME" }, spellContent, spellContext);
  const without = executeCommand(before, "host", { type: "START_GAME" }, { ...spellContent, spells: undefined }, spellContext);
  if (!withSpells.ok || !without.ok) throw new Error("setup failed");
  expect(withSpells.state.privateState.spells?.deck).toHaveLength(20);
  expect(withSpells.state.stateVersion).toBe(before.stateVersion + 1);
  expect(withSpells.state.reserveAssetIds).toEqual(without.state.reserveAssetIds);
  expect(withSpells.state.activeMysteryId).toEqual(without.state.activeMysteryId);
});
it("projects identical fronts for either copy and isolates projected arrays", () => {
  const first = spellState(); const second = spellState();
  holdSpell(first, "spell_wither_01"); holdSpell(second, "spell_wither_02");
  const publicFirst = projectPublicState(first); const publicSecond = projectPublicState(second);
  expect(publicFirst.players[0]!.spellIds).toEqual(["spell_wither"]);
  expect(publicFirst.players[0]!.spellIds).toEqual(publicSecond.players[0]!.spellIds);
  expect(publicFirst.spellSupplyTopId).toBe("spell_instill_bravery");
  for (const projected of [publicFirst, projectStateForPlayer(first, "host")]) {
    expect(JSON.stringify(projected)).not.toMatch(/spell_[a-z_]+_0[12]|heldByPlayer|heldByDefeatedInvestigator|private-card-assets/);
  }
  publicFirst.players[0]!.spellIds.push("spell_fake");
  expect(projectPublicState(first).players[0]!.spellIds).toEqual(["spell_wither"]);
});
it("caches exact copies on defeat once and keeps replacement inventory empty", () => {
  const before = spellState(); holdSpell(before, "spell_wither_02"); before.players[0]!.defeated = true;
  before.pendingDefeat = { playerId: "host", causes: ["health"], cityIds: ["arkham"] };
  const result = executeCommand(before, "host", { type: "RESOLVE_DEFEAT", cityId: "arkham", cause: "health", leadPlayerId: "guest" }, spellContent);
  if (!result.ok) throw new Error(result.error.code);
  expect(result.state.privateState.spells!.heldByPlayer.host).toEqual([]);
  expect(result.state.privateState.spells!.heldByDefeatedInvestigator.trish_scarborough).toEqual(["spell_wither_02"]);
  expect(projectPublicState(result.state).defeatedInvestigators?.[0]?.spellIds).toEqual(["spell_wither"]);
  expect(validateSpellInventory(result.state, spellContent.spells!)).toBeUndefined();
  expect(result.state.stateVersion).toBe(before.stateVersion + 1);
  expect(executeCommand(result.state, "host", { type: "RESOLVE_DEFEAT", cityId: "arkham", cause: "health", leadPlayerId: "guest" }, spellContent).ok).toBe(false);
  result.state.replacementWindow = true;
  const replaced = executeCommand(result.state, "host", { type: "REPLACE_INVESTIGATOR", investigatorId: "lily_chen" }, spellContent);
  if (!replaced.ok) throw new Error(replaced.error.code);
  expect(replaced.state.privateState.spells).toEqual(result.state.privateState.spells);
  expect(projectPublicState(replaced.state).players[0]!.spellIds).toEqual([]);
  projectPublicState(result.state).defeatedInvestigators![0]!.spellIds.push("spell_fake");
  expect(projectPublicState(result.state).defeatedInvestigators![0]!.spellIds).toEqual(["spell_wither"]);
});
it("does not alias private inventories on unrelated commands", () => {
  const before = spellState(); const result = executeCommand(before, "host", { type: "END_ACTIONS" }, spellContent);
  if (!result.ok) throw new Error(result.error.code);
  result.state.privateState.spells!.deck.pop();
  expect(before.privateState.spells!.deck).toHaveLength(20);
});
