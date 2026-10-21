import { describe, expect, it } from "vitest";
import { executeCommand, projectPublicState, type GameState } from "../src/index.js";
import { canUseNormanSpellReroll, spendNormanSpellReroll, validateInvestigatorAbilityUsage } from "../src/norman-clue-substitution.js";
import { castingContext, unwrap } from "./spell-casting-fixtures.js";
import { normanContent, normanState } from "./norman-spell-fixtures.js";
function pendingState(): GameState {
  const state = normanState();
  state.privateState.spellCasting = { usedPhysicalIds: ["spell_feed_the_mind_01"], pending: { casterPlayerId: "host", sourcePhysicalId: "spell_feed_the_mind_01", startedTurnNumber: state.turnNumber, stage: "test", actionReserved: true } };
  state.activeTest = { id: "test", playerId: "host", skill: "lore", modifier: -1, dicePool: 2, dice: [1, 2], successes: 0, successThreshold: 5, continuation: "spell_cast" };
  return state;
}
describe("Norman private ability usage", () => {
  it("normanSpendLeavesOneSanity", () => {
    const state = pendingState(); state.players[0]!.sanity = 2;
    expect(canUseNormanSpellReroll(state, "host")).toBe(true);
    expect(spendNormanSpellReroll(state, "host")).toBe(true);
    expect(state.players[0]!.sanity).toBe(1);
    expect(state.privateState.investigatorAbilityUsage!.normanClueSubstitutions).toEqual([{playerId:"host", investigatorId:"norman_withers", round:state.turnNumber}]);
    expect(spendNormanSpellReroll(state, "host")).toBe(false);
    expect(JSON.stringify(projectPublicState(state))).not.toContain("investigatorAbilityUsage");
  });
  it("rejectsUnavailableSubstitutionWithoutMutation", () => {
    for (const mutate of [
      (s:GameState) => {s.players[0]!.sanity=1;},
      (s:GameState) => {s.players[0]!.investigatorId="mark_harrigan";},
      (s:GameState) => {s.activeTest!.continuation="acquire_assets";},
      (s:GameState) => {delete s.privateState.investigatorAbilityUsage;},
    ]) {const state=pendingState();mutate(state);const before=structuredClone(state);expect(spendNormanSpellReroll(state,"host")).toBe(false);expect(state).toEqual(before);}
  });
  it("validatesUsageLedger", () => {
    const state=pendingState();expect(validateInvestigatorAbilityUsage(state)).toBeUndefined();
    const entry={playerId:"host",investigatorId:"norman_withers" as const,round:state.turnNumber};
    for(const entries of [[{...entry,round:-1}],[{...entry,playerId:"missing"}],[entry,entry]]) {
      state.privateState.investigatorAbilityUsage!.normanClueSubstitutions=entries;
      expect(validateInvestigatorAbilityUsage(state)).toBeTypeOf("string");
    }
    delete state.privateState.investigatorAbilityUsage;expect(validateInvestigatorAbilityUsage(state)).toBeTypeOf("string");
    delete state.privateState.spellCasting;delete state.activeTest;delete state.privateState.investigatorAbilityUsageVersion;expect(validateInvestigatorAbilityUsage(state)).toBeUndefined();
  });
  it("retainsUsageAcrossTransitionsAndResetsAtNewRound", () => {
    const state=normanState();state.privateState.investigatorAbilityUsage!.normanClueSubstitutions=[{playerId:"host",investigatorId:"norman_withers",round:state.turnNumber}];
    const moved=unwrap(executeCommand(state,"host",{type:"MOVE",destinationId:"london"},normanContent,castingContext()));
    expect(moved.privateState.investigatorAbilityUsage).toEqual(state.privateState.investigatorAbilityUsage);
    expect(moved.privateState.investigatorAbilityUsage).not.toBe(state.privateState.investigatorAbilityUsage);
    moved.phase="mythos";moved.replacementWindow=true;
    const next=unwrap(executeCommand(moved,"host",{type:"BEGIN_NEXT_ROUND"},normanContent,castingContext()));
    expect(next.privateState.investigatorAbilityUsage!.normanClueSubstitutions).toEqual([]);
    expect(next.turnNumber).toBe(state.turnNumber+1);
  });
  it("keepsTheLimitWhenTheSeatChangesInvestigatorOrTheSpellChangesHands", () => {
    const state=pendingState();expect(spendNormanSpellReroll(state,"host")).toBe(true);
    state.players[0]!.sanity=7;
    state.players[0]!.investigatorId="lily_chen";expect(canUseNormanSpellReroll(state,"host")).toBe(false);
    state.players[0]!.investigatorId="norman_withers";expect(canUseNormanSpellReroll(state,"host")).toBe(false);
    state.privateState.spellCasting!.pending!.sourcePhysicalId="spell_feed_the_mind_02";
    expect(canUseNormanSpellReroll(state,"host")).toBe(false);
  });
});
