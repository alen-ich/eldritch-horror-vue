import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, executeCommand, projectPublicState, type EngineContext, type GameCommand, type GameContent, type GameState } from "../src/index.js";
import { normanContent, normanState } from "./norman-spell-fixtures.js";
import { castingContext, unwrap } from "./spell-casting-fixtures.js";
import { spellContext } from "./spell-fixtures.js";

const content: GameContent = { ...normanContent,
  clues: [{ id: "clue_a", locationId: "arkham" }, { id: "clue_b", locationId: "london" }],
  gates: [{ id: "gate_london", locationId: "london", omenSymbol: "comet" }],
  monsters: [{ id: "cultist", type: "normal", count: 3, toughness: { base: 1, perInvestigator: 0 }, horrorCheck: null, damageCheck: null },
    { id: "epic", type: "epic", count: 1, toughness: { base: 9, perInvestigator: 0 }, horrorCheck: null, damageCheck: null }],
};
function fixture(): GameState {
  const state = normanState();
  state.players[0]!.clues = 2;
  state.privateState.tokenPoolById = { clues: [], clue_discard: [], "held_clues:host": ["clue_a", "clue_b"], "held_clues:guest": [], monsters: ["cultist"] };
  state.activeGateIds = ["gate_london"];
  state.monsters = [{ id: "target", monsterId: "cultist", locationId: "london", damage: 0 }, { id: "other", monsterId: "cultist", locationId: "arkham", damage: 0 }];
  state.monsterLocationIds = ["london", "arkham"];
  return state;
}
const intent = (useSanity = false): GameCommand => ({ type: "USE_INVESTIGATOR_ACTION", monsterInstanceId: "target", useSanity });
function act(state = fixture(), useSanity = false, ctx: EngineContext = spellContext, data = content) {
  return executeCommand(state, "host", intent(useSanity), data, ctx);
}

describe("Norman's action", () => {
  it.each([false, true])("pays exactly the chosen cost and discards a remote target: Sanity=%s", useSanity => {
    const before = fixture(), snapshot = structuredClone(before);
    const result = act(before, useSanity), state = unwrap(result);
    expect(before).toEqual(snapshot);
    expect(state.players[0]!.clues).toBe(useSanity ? 1 : 0);
    expect(state.players[0]!.sanity).toBe(useSanity ? 6 : 7);
    expect(state.privateState.tokenPoolById.clue_discard).toEqual(useSanity ? ["clue_a"] : ["clue_a", "clue_b"]);
    expect(state.privateState.tokenPoolById.monsters).toEqual(["cultist", "cultist"]);
    expect(state.monsters).toEqual([snapshot.monsters![1]]);
    expect(state.monsterLocationIds).toEqual(["arkham"]);
    expect(state.activeGateIds).toEqual(["gate_london"]);
    expect(state.mysteryProgress).toBe(0);
    expect(state.actionsRemaining).toBe(1);
    expect(state.performedActions).toEqual(["investigator"]);
    expect(state.stateVersion).toBe(before.stateVersion + 1);
    expect(state.privateState.investigatorAbilityUsage!.normanClueSubstitutions).toHaveLength(useSanity ? 1 : 0);
    if (!result.ok) throw Error("expected success");
    expect(result.events).toContainEqual({ type: "MONSTER_DISCARDED", monsterInstanceId: "target", monsterId: "cultist" });
    expect(result.events).toContainEqual({ type: "INVESTIGATOR_ACTION_PAID", playerId: "host", cluesSpent: useSanity ? 1 : 2, sanitySpent: useSanity ? 1 : 0 });
    expect(JSON.stringify(projectPublicState(state))).not.toMatch(/normanClueSubstitutions|held_clues|clue_a|clue_b/);
  });
  it("accepts one real Clue plus Sanity and genuine legacy usage", () => {
    const before = fixture(); before.players[0]!.clues = 1;
    before.privateState.tokenPoolById["held_clues:host"] = ["clue_a"];
    before.privateState.tokenPoolById.clues = ["clue_b"];
    delete before.privateState.investigatorAbilityUsage; delete before.privateState.investigatorAbilityUsageVersion;
    expect(unwrap(act(before, true)).players[0]!.clues).toBe(0);
  });
  it("returns set-aside Monsters to their own reserve without shuffling the cup", () => {
    const before = fixture(); before.monsters![0]!.setAside = true;
    before.privateState.tokenPoolById.monsters = [];
    before.privateState.tokenPoolById["set_aside:cultist"] = ["cultist"];
    const after = unwrap(act(before, false, { ...spellContext, shuffle: () => { throw Error("must not shuffle"); } }));
    expect(after.privateState.tokenPoolById.monsters).toEqual([]);
    expect(after.privateState.tokenPoolById["set_aside:cultist"]).toEqual(["cultist", "cultist"]);
  });
  const mutations: [string, (state: GameState) => void][] = [
    ["last Sanity", s => { s.players[0]!.sanity = 1; }],
    ["zero Clues", s => { s.players[0]!.clues = 0; s.privateState.tokenPoolById["held_clues:host"] = []; }],
    ["no Gate", s => { s.activeGateIds = []; }],
    ["unknown Gate", s => { s.activeGateIds = ["unknown"]; }],
    ["missing target", s => { s.monsters!.shift(); }],
    ["Epic target", s => { s.monsters![0]!.monsterId = "epic"; }],
    ["unknown Monster", s => { s.monsters![0]!.monsterId = "unknown"; }],
    ["duplicate instance", s => { s.monsters!.push({ ...s.monsters![0]! }); }],
    ["missing cup", s => { delete s.privateState.tokenPoolById.monsters; }],
    ["inflated count", s => { s.players[0]!.clues = 3; }],
    ["duplicate held Clues", s => { s.privateState.tokenPoolById["held_clues:host"] = ["clue_a", "clue_a"]; }],
    ["Clue in two zones", s => { s.privateState.tokenPoolById.clues = ["clue_a"]; }],
    ["unknown physical Clue", s => { s.privateState.tokenPoolById["held_clues:host"] = ["fake", "clue_b"]; }],
    ["missing physical Clues", s => { delete s.privateState.tokenPoolById["held_clues:host"]; }],
    ["already used substitution", s => { s.privateState.investigatorAbilityUsage!.normanClueSubstitutions.push({ playerId: "host", investigatorId: "norman_withers", round: s.turnNumber }); }],
    ["already used action", s => { s.performedActions = ["investigator"]; }],
    ["guest turn", s => { s.activePlayerId = "guest"; }],
    ["wrong phase", s => { s.phase = "encounter"; }],
    ["no actions", s => { s.actionsRemaining = 0; }],
    ["Delayed", s => { s.players[0]!.delayed = true; }],
    ["defeated", s => { s.players[0]!.defeated = true; }],
    ["terminal game", s => { s.gameResult = "investigators_lose"; }],
  ];
  it.each(mutations)("rejects %s atomically", (_name, mutate) => {
    const before = fixture(); mutate(before); const snapshot = structuredClone(before);
    expect(act(before, true).ok).toBe(false); expect(before).toEqual(snapshot);
  });
  it.each([undefined, "unknown"])("requires a target: %s", monsterInstanceId => {
    expect(executeCommand(fixture(), "host", { type: "USE_INVESTIGATOR_ACTION", monsterInstanceId }, content, spellContext).ok).toBe(false);
  });
  it("rejects Norman-specific fields for Jim", () => {
    const before = fixture(); before.players[0]!.investigatorId = "jim_culver";
    expect(act(before).ok).toBe(false);
  });
  it("rejects invalid shuffle output without paying", () => {
    const before = fixture(), snapshot = structuredClone(before);
    expect(act(before, true, { ...spellContext, shuffle: () => [] }).ok).toBe(false);
    expect(before).toEqual(snapshot);
  });
  it("rolls back retained RNG after a partially consumed shuffle", () => {
    const before = fixture(), ctx = createDeterministicEngineContext({ shuffleIndexes: [0, 99] });
    before.privateState.tokenPoolById.monsters!.push("cultist");
    const data = { ...content, monsters: content.monsters!.map(m => ({ ...m, count: 4 })) };
    expect(act(before, true, ctx, data).ok).toBe(false);
    expect(ctx.shuffle(["a", "b"])).toEqual(["b", "a"]);
  });
  it("shares usage with Spell rerolls after restoring the action result", () => {
    const after = structuredClone(unwrap(act(fixture(), true)));
    const casting = unwrap(executeCommand(after, "host", { type: "CAST_SPELL", spellId: "spell_feed_the_mind" }, content, castingContext([1, 2])));
    expect(casting.pendingDecision?.optionIds).not.toContain("norman-sanity:0");
  });
  it("a Spell payment blocks only the alternate action price", () => {
    const cast = unwrap(executeCommand(fixture(), "host", { type: "CAST_SPELL", spellId: "spell_feed_the_mind" }, content, castingContext([1, 2])));
    const paid = unwrap(executeCommand(cast, "host", { type: "RESOLVE_DECISION", decisionId: cast.pendingDecision!.id, selectedOptionIds: ["norman-sanity:0"] }, content, castingContext([2])));
    // Finish zero-success reverse after declining the remaining physical-Clue rerolls.
    const done = unwrap(executeCommand(paid, "host", { type: "RESOLVE_DECISION", decisionId: paid.pendingDecision!.id, selectedOptionIds: [] }, content, castingContext()));
    const next = done.pendingDecision ? unwrap(executeCommand(done, "host", { type: "RESOLVE_DECISION", decisionId: done.pendingDecision.id, selectedOptionIds: ["discard_spell"] }, content, castingContext())) : done;
    expect(act(next, true).ok).toBe(false);
    expect(act(next, false).ok).toBe(true);
  });
  it("ordinary payment leaves substitution available for a Spell test", () => {
    const after = unwrap(act());
    const cast = unwrap(executeCommand(after, "host", { type: "CAST_SPELL", spellId: "spell_feed_the_mind" }, content, castingContext([1, 2])));
    expect(cast.pendingDecision?.optionIds).toContain("norman-sanity:0");
  });
  it("resets action payment usage only at the actual next-round transition", () => {
    const after = unwrap(act(fixture(), true));
    after.phase = "mythos"; after.replacementWindow = true;
    const next = unwrap(executeCommand(after, "host", { type: "BEGIN_NEXT_ROUND" }, content, spellContext));
    expect(next.turnNumber).toBe(after.turnNumber + 1);
    expect(next.privateState.investigatorAbilityUsage!.normanClueSubstitutions).toEqual([]);
    expect(next.performedActions).toEqual([]);
    const cast = unwrap(executeCommand(next, "host", { type: "CAST_SPELL", spellId: "spell_feed_the_mind" }, content, castingContext([1, 2])));
    expect(cast.pendingDecision?.optionIds).toContain("norman-sanity:0");
  });
  it("requires context and sufficient real Clues for the ordinary price", () => {
    expect(executeCommand(fixture(), "host", intent(), content).ok).toBe(false);
    const state = fixture(); state.players[0]!.clues = 1;
    state.privateState.tokenPoolById["held_clues:host"] = ["clue_a"];
    state.privateState.tokenPoolById.clues = ["clue_b"];
    expect(act(state).ok).toBe(false);
    expect(act(state, true).ok).toBe(true);
  });
});
