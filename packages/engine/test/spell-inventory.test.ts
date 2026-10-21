import { describe, expect, it } from "vitest";
import { baseGameSpells } from "../../content/src/spells.js";
import { createLobby, type EngineContext } from "../src/index.js";
import { createSpellInventory, validateSpellInventory } from "../src/spells.js";

const context: EngineContext = { shuffle: items => [...items].reverse(), rollDie: () => 6, createId: () => "id", drawToken: pool => ({ token: pool[0]!, remaining: pool.slice(1) }) };
function state() {
  const result = createLobby(["host", "guest"]);
  result.privateState.spells = createSpellInventory(baseGameSpells, ["host", "guest"], context);
  return result;
}
describe("physical Spell conservation", () => {
  it("initializes all 20 copies exactly once in injected order", () => {
    const before = state();
    expect(before.privateState.spells?.deck).toHaveLength(20);
    expect(before.privateState.spells?.deck[0]).toBe("spell_mists_of_releh_02");
    expect(before.privateState.spells?.heldByPlayer).toEqual({ host: [], guest: [] });
    expect(validateSpellInventory(before, baseGameSpells)).toBeUndefined();
  });
  it.each(["missing", "duplicate", "unknown", "owner", "cache", "kind"])("rejects %s conservation", kind => {
    const before = state(); const inventory = before.privateState.spells!;
    if (kind === "missing") inventory.deck.pop();
    if (kind === "duplicate") inventory.deck.push(inventory.deck[0]!);
    if (kind === "unknown") inventory.deck[0] = "spell_fake_01";
    if (kind === "owner") inventory.heldByPlayer.stranger = [];
    if (kind === "cache") inventory.heldByDefeatedInvestigator.stranger = [];
    if (kind === "kind") inventory.heldByPlayer.host = inventory.deck.splice(0, 2);
    expect(validateSpellInventory(before, baseGameSpells)).toBeTypeOf("string");
  });
  it("distinguishes an accounted empty supply from missing inventory", () => {
    const before = state(); const inventory = before.privateState.spells!;
    inventory.heldByPlayer.host = inventory.deck.filter(id => id.endsWith("01"));
    inventory.heldByPlayer.guest = inventory.deck.filter(id => id.endsWith("02"));
    inventory.deck = [];
    expect(validateSpellInventory(before, baseGameSpells)).toBeUndefined();
    delete before.privateState.spells;
    expect(validateSpellInventory(before, baseGameSpells)).toBeTypeOf("string");
  });
  it("rejects malformed catalogs and duplicate seats before shuffling", () => {
    expect(() => createSpellInventory(baseGameSpells.slice(1), ["host"], context)).toThrow();
    expect(() => createSpellInventory(baseGameSpells, ["host", "host"], context)).toThrow();
  });
  it.each(["heldByPlayer", "heldByDefeatedInvestigator"] as const)("rejects array-shaped %s before serialization can lose cards", key => {
    const before = state();
    before.privateState.spells![key] = [] as unknown as Record<string, string[]>;
    expect(validateSpellInventory(before, baseGameSpells)).toBeTypeOf("string");
  });
});
