import { describe, expect, it } from "vitest";
import { baseGameSpells } from "../../content/src/spells.js";
import { createLobby, type EngineContext, type GameContent, type GameState } from "../src/index.js";
import { createSpellInventory, discardSpell, gainSpell } from "../src/spells.js";

const context: EngineContext = { shuffle: items => [...items], rollDie: () => 6, createId: () => "id", drawToken: pool => ({ token: pool[0]!, remaining: pool.slice(1) }) };
const content: GameContent = { spells: baseGameSpells, map: { adjacentLocationIds: {}, routes: [], locationTypes: {} }, investigators: {}, assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {} };
function state(): GameState {
  const before = createLobby(["host", "guest"]); before.phase = "action";
  before.privateState.spells = createSpellInventory(baseGameSpells, ["host", "guest"], context);
  return before;
}
function hold(before: GameState, id: string, owner = "host") {
  before.privateState.spells!.deck = before.privateState.spells!.deck.filter(card => card !== id);
  (before.privateState.spells!.heldByPlayer[owner] ??= []).push(id);
}
function gained(before: GameState, request: Parameters<typeof gainSpell>[2], rng = context) {
  const result = gainSpell(before, "host", request, content, rng);
  if (!result.ok) throw new Error(result.error.code);
  return result;
}
describe("Spell gain/discard — Reference Guide pp. 5–6 and 11", () => {
  it("random gain draws the physical bottom and leaves input and version unchanged", () => {
    const before = state(); const copy = structuredClone(before);
    const after = gained(before, { type: "random" });
    expect(after.state.privateState.spells!.heldByPlayer.host).toEqual(["spell_mists_of_releh_02"]);
    expect(after.events).toEqual([{ type: "SPELL_GAINED", playerId: "host", spellId: "spell_mists_of_releh" }]);
    expect(after.state.stateVersion).toBe(before.stateVersion); expect(before).toEqual(copy);
  });
  it("returns a random duplicate and reshuffles before retrying", () => {
    const before = state(); hold(before, "spell_mists_of_releh_01");
    const after = gained(before, { type: "random" }, { ...context, shuffle: items => [...items].reverse() });
    expect(after.state.privateState.spells!.heldByPlayer.host).toEqual(["spell_mists_of_releh_01", "spell_instill_bravery_01"]);
    expect(after.state.privateState.spells!.deck[0]).toBe("spell_mists_of_releh_02");
  });
  it("all-duplicate availability terminates without random input", () => {
    const before = state();
    baseGameSpells.filter(card => card.copy === 1).forEach(card => hold(before, card.id));
    const after = gained(before, { type: "random" }, { ...context, shuffle: () => { throw new Error("must not shuffle"); } });
    expect(after.events).toEqual([]); expect(after.state).toEqual(before);
  });
  it("named duplicate returns the new copy and retains the original", () => {
    const before = state(); hold(before, "spell_wither_01");
    const after = gained(before, { type: "kind", kind: "wither" }, { ...context, shuffle: items => [...items].reverse() });
    expect(after.state.privateState.spells!.heldByPlayer.host).toEqual(["spell_wither_01"]);
    expect(after.state.privateState.spells!.deck[0]).toBe("spell_wither_02");
    expect(after.events).toEqual([]);
  });
  it("trait search goes bottom-first and excludes already held kinds", () => {
    const before = state(); hold(before, "spell_mists_of_releh_01");
    const after = gained(before, { type: "trait", trait: "incantation" });
    expect(after.state.privateState.spells!.heldByPlayer.host).toEqual(["spell_mists_of_releh_01", "spell_wither_02"]);
  });
  it("unavailable named copies grant nothing, while empty supply is legal", () => {
    const before = state(); hold(before, "spell_wither_01"); hold(before, "spell_wither_02", "guest");
    expect(gained(before, { type: "kind", kind: "wither" }).events).toEqual([]);
    for (const card of baseGameSpells) if (before.privateState.spells!.deck.includes(card.id)) hold(before, card.id, card.copy === 1 ? "host" : "guest");
    expect(gained(before, { type: "random" }).events).toEqual([]);
  });
  it("discard returns the exact owned copy and shuffles the combined supply", () => {
    const before = state(); hold(before, "spell_wither_02");
    const after = discardSpell(before, "host", "spell_wither_02", content, { ...context, shuffle: items => [...items].reverse() });
    if (!after.ok) throw new Error(after.error.code);
    expect(after.state.privateState.spells!.heldByPlayer.host).toEqual([]);
    expect(after.state.privateState.spells!.deck).toHaveLength(20);
    expect(after.state.privateState.spells!.deck[0]).toBe("spell_wither_02");
    expect(after.events).toEqual([{ type: "SPELL_DISCARDED", playerId: "host", spellId: "spell_wither" }]);
    expect(before.privateState.spells!.heldByPlayer.host).toEqual(["spell_wither_02"]);
  });
  it.each(["lobby", "ended", "defeated", "eliminated", "missing", "duplicate", "filter", "member"])("rejects %s before RNG without mutation", kind => {
    const before = state();
    if (kind === "lobby") before.phase = "lobby";
    if (kind === "ended") before.gameResult = "investigators_lose";
    if (kind === "defeated") before.players[0]!.defeated = true;
    if (kind === "eliminated") before.players[0]!.eliminated = true;
    if (kind === "missing") delete before.privateState.spells;
    if (kind === "duplicate") before.privateState.spells!.deck.push("spell_wither_01");
    const original = structuredClone(before);
    const result = gainSpell(before, kind === "member" ? "stranger" : "host", { type: "kind", kind: kind === "filter" ? "unknown" : "wither" }, content, { ...context, shuffle: () => { throw new Error("must not shuffle"); } });
    expect(result.ok).toBe(false); expect(before).toEqual(original);
    expect(JSON.stringify(result)).not.toContain("spell_wither_01");
  });
  it("rejects colleague-owned discard", () => {
    const before = state(); hold(before, "spell_wither_01", "guest");
    expect(discardSpell(before, "host", "spell_wither_01", content, context)).toMatchObject({ ok: false, error: { code: "SPELL_NOT_HELD" } });
  });
  it("rejects exhausted randomness after duplicate without a partial transition", () => {
    const before = state(); hold(before, "spell_mists_of_releh_01"); const original = structuredClone(before);
    expect(gainSpell(before, "host", { type: "random" }, content, { ...context, shuffle: () => { throw new Error("input exhausted"); } })).toMatchObject({ ok: false, error: { code: "SPELL_RANDOM_INPUT_INVALID" } });
    expect(before).toEqual(original);
  });
  it("rejects atomically after several successful duplicate reshuffles exhaust input", () => {
    const before = state(); hold(before, "spell_mists_of_releh_01"); const original = structuredClone(before);
    let remainingShuffles = 2;
    const result = gainSpell(before, "host", { type: "random" }, content, { ...context, shuffle: items => {
      if (remainingShuffles-- === 0) throw new Error("input exhausted");
      return [...items]; // The actual bottom duplicate is drawn again twice.
    } });
    expect(result).toMatchObject({ ok: false, error: { code: "SPELL_RANDOM_INPUT_INVALID" } });
    expect(remainingShuffles).toBe(-1); expect(before).toEqual(original);
  });
});
