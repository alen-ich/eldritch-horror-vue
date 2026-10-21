import { expect, it } from "vitest";
import { damageInvestigator, executeCommand, resolveCombatEncounter, resolveLocationEncounter, spellEffectIsUnsupported } from "../src/index.js";
import { holdSpell, spellContent, spellContext, spellState } from "./spell-fixtures.js";
it.each(["health", "sanity"] as const)("refuses %s loss for a remote colleague's protective Spell", resource => {
  const before = spellState(); holdSpell(before, resource === "health" ? "spell_flesh_ward_01" : "spell_instill_bravery_01", "guest");
  const original = structuredClone(before);
  expect(damageInvestigator(before, "host", resource === "health" ? 1 : 0, resource === "sanity" ? 1 : 0, spellContent)).toMatchObject({ ok: false, error: { code: "SPELL_EFFECT_UNSUPPORTED" } });
  expect(before).toEqual(original);
});
it.each(["spell_clairvoyance_01", "spell_mists_of_releh_02"])("guards encounter Spell %s before any draw or RNG", id => {
  const before = spellState(); before.phase = "encounter"; holdSpell(before, id);
  expect(resolveLocationEncounter(before, "host", "general", spellContent, spellContext)).toMatchObject({ ok: false, error: { code: "SPELL_EFFECT_UNSUPPORTED" } });
});
it("guards Wither before ordinary combat", () => {
  const before = spellState(); before.phase = "encounter"; holdSpell(before, "spell_wither_01");
  expect(resolveCombatEncounter(before, "host", "monster", spellContent, spellContext)).toMatchObject({ ok: false, error: { code: "SPELL_EFFECT_UNSUPPORTED" } });
});
it("ritual inventory permits unrelated commands and does not prevent costs", () => {
  const before = spellState(); holdSpell(before, "spell_blessing_of_isis_01");
  expect(spellEffectIsUnsupported(before, "host", "encounter", spellContent)).toBe(false);
  expect(spellEffectIsUnsupported(before, "host", "health_loss", spellContent)).toBe(false);
  expect(executeCommand(before, "host", { type: "TRAVEL", destinationIds: ["london"] }, spellContent, spellContext).ok).toBe(true);
  expect(executeCommand(before, "host", { type: "PREPARE_TRAVEL", ticketType: "train" }, spellContent, spellContext).ok).toBe(true);
  expect(executeCommand(before, "host", { type: "END_ACTIONS" }, spellContent, spellContext).ok).toBe(true);
});
it("restored encounter decisions recheck newly held Spells", () => {
  const before = spellState(); before.phase = "encounter"; holdSpell(before, "spell_mists_of_releh_01");
  before.pendingLocationEncounter = { playerId: "host", cardId: "card", deck: "general", queue: [], dice: [], successes: 0 };
  expect(executeCommand(before, "host", { type: "RESOLVE_DECISION", decisionId: "old", selectedOptionIds: [] }, spellContent, spellContext)).toMatchObject({ ok: false, error: { code: "SPELL_EFFECT_UNSUPPORTED" } });
});
it("a colleague's Wither does not strand the acting investigator's noncombat choice", () => {
  const before = spellState(); before.phase = "encounter"; holdSpell(before, "spell_wither_01", "guest");
  before.privateState.deckOrderById["encounter:general"] = ["optional"];
  const rules = { ...spellContent, locationEncounters: [{ id: "optional", deck: "general" as const, sections: { city: { kind: "optional", cost: [{ kind: "delay" }], reward: { kind: "effects", effects: [] } } } }] };
  const started = resolveLocationEncounter(before, "host", "general", rules, spellContext);
  if (!started.ok) throw new Error(started.error.code);
  const finished = executeCommand(JSON.parse(JSON.stringify(started.state)), "host", { type: "RESOLVE_DECISION", decisionId: started.state.pendingDecision!.id, selectedOptionIds: ["skip"] }, rules, spellContext);
  expect(finished).toMatchObject({ ok: true, state: { activePlayerId: "guest", pendingLocationEncounter: undefined } });
});
it("missing inventory in an active game is invalid when Spell content is configured", () => {
  const before = spellState(); delete before.privateState.spells;
  expect(executeCommand(before, "host", { type: "END_ACTIONS" }, spellContent)).toMatchObject({ ok: false, error: { code: "SPELL_INVENTORY_INVALID" } });
  expect(executeCommand(before, "host", { type: "END_ACTIONS" }, { ...spellContent, spells: undefined }).ok).toBe(true);
});
