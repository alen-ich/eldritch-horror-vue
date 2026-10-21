import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, executeCommand, validateSpellCastingState, type GameState, type GameContent } from "../src/index.js";
import { baseGameAssets } from "../../content/src/assets.js";
import { castingContext, unwrap } from "./spell-casting-fixtures.js";
import { normanContent, normanState } from "./norman-spell-fixtures.js";
function cast(state=normanState(),dice=[1,2]):GameState { return unwrap(executeCommand(state,"host",{type:"CAST_SPELL",spellId:"spell_feed_the_mind"},normanContent,castingContext(dice))); }
function choose(state:GameState,option?:string,dice=[6],content:GameContent=normanContent,owner="host") {
  return executeCommand(state,owner,{type:"RESOLVE_DECISION",decisionId:state.pendingDecision!.id,selectedOptionIds:option?[option]:[]},content,castingContext(dice));
}
function finishFront(state:GameState):GameState { return unwrap(choose(unwrap(choose(state,"host")),"improve:will:1")); }
describe("Norman Spell casting",()=>{
  it("offersSanityRerollWithoutPhysicalClues",()=>{
    const initial=normanState();delete initial.privateState.investigatorAbilityUsage;delete initial.privateState.investigatorAbilityUsageVersion;
    const state=cast(initial);expect(state.pendingDecision?.optionIds).toEqual(["norman-sanity:0","norman-sanity:1"]);
    expect(state.privateState.investigatorAbilityUsage).toEqual({schemaVersion:1,normanClueSubstitutions:[]});
  });
  it("doesNotOfferLastSanityOrAbilityForAnotherInvestigator",()=>{
    const state=normanState();state.players[0]!.sanity=1;
    expect(cast(state).pendingDecision?.optionIds).not.toContain("norman-sanity:0");
    state.players[0]!.investigatorId="mark_harrigan";state.players[0]!.sanity=7;
    expect(cast(state).pendingDecision?.optionIds).not.toContain("norman-sanity:0");
  });
  it("guardsTrishAuraWithZeroCluesBeforeRolling",()=>{
    const state=normanState();state.players[1]!.investigatorId="trish_scarborough";
    const before=structuredClone(state);
    expect(executeCommand(state,"host",{type:"CAST_SPELL",spellId:"spell_feed_the_mind"},normanContent,castingContext())).toMatchObject({ok:false,error:{code:"SPELL_EFFECT_UNSUPPORTED"}});
    expect(state).toEqual(before);
    state.players[1]!.locationId="london";expect(()=>cast(state)).not.toThrow();
  });
  it.each(["spell_feed_the_mind_01","spell_feed_the_mind_02"])("paysOnceAndCompletesBothCopies: %s",copy=>{
    const pending=cast(normanState(copy));const before=structuredClone(pending);
    const result=choose(pending,"norman-sanity:0");const state=unwrap(result);
    expect(pending).toEqual(before);expect(state.players[0]!.sanity).toBe(6);
    expect(state.privateState.tokenPoolById).toEqual(before.privateState.tokenPoolById);
    expect(state.players[0]!.clues).toBe(0);expect(state.stateVersion).toBe(before.stateVersion+1);
    if(!result.ok)throw Error("expected accepted");
    expect(result.events).toContainEqual({type:"SANITY_SPENT_FOR_REROLL",testId:before.activeTest!.id,playerId:"host",dieIndex:0,amount:1});
    expect(result.events.some(event=>event.type==="CLUE_SPENT_FOR_REROLL")).toBe(false);
    expect(state.privateState.spellCasting?.pending?.finalDice).toEqual([6,2]);
    let done=finishFront(state);if(done.pendingDecision)done=unwrap(choose(done,"discard_spell"));
    expect(done.actionsRemaining).toBe(1);expect(done.privateState.spellCasting?.pending).toBeUndefined();
    expect(done.privateState.investigatorAbilityUsage!.normanClueSubstitutions).toHaveLength(1);
  });
  it.each([4,2])("usesFinalFourAfterPaidFailedReroll: %i",die=>{
    const pending=cast(normanState("spell_feed_the_mind_02"));const state=unwrap(choose(pending,"norman-sanity:0",[die]));
    expect(state.privateState.spells!.heldByPlayer.host).toHaveLength(die===4?1:0);
    expect(state.actionsRemaining).toBe(1);expect(state.players[0]!.sanity).toBe(6);
  });
  it("spendThenReverseLossDefeatsNormally",()=>{
    const initial=normanState("spell_feed_the_mind_02");initial.players[0]!.sanity=2;initial.actionsRemaining=1;
    const paid=unwrap(choose(cast(initial),"norman-sanity:0"));expect(paid.players[0]!.sanity).toBe(1);expect(paid.pendingDefeat).toBeUndefined();
    const done=finishFront(paid);expect(done.pendingDefeat?.playerId).toBe("host");expect(done.actionsRemaining).toBe(0);
    expect(done.privateState.spellCasting?.pending).toBeUndefined();expect(done.pendingDecision).toBeUndefined();
  });
  it.each([true,false])("realClueAndSanityPaymentsRemainIndependent: sanityFirst=%s",sanityFirst=>{
    const initial=normanState();initial.players[0]!.clues=1;
    initial.privateState.tokenPoolById={clues:[],clue_discard:[],"held_clues:host":["clue_arkham"]};
    const content={...normanContent,clues:[{id:"clue_arkham",locationId:"arkham" as const}]};
    let state=unwrap(executeCommand(initial,"host",{type:"CAST_SPELL",spellId:"spell_feed_the_mind"},content,castingContext([1,2])));
    expect(state.pendingDecision!.optionIds).toEqual(["die-0","die-1","norman-sanity:0","norman-sanity:1"]);
    state=unwrap(choose(state,sanityFirst?"norman-sanity:0":"die-0",[4],content));
    expect(state.privateState.investigatorAbilityUsage!.normanClueSubstitutions).toHaveLength(sanityFirst?1:0);
    state=unwrap(choose(state,sanityFirst?"die-0":"norman-sanity:0",[6],content));
    expect(state.players[0]!.clues).toBe(0);expect(state.players[0]!.sanity).toBe(6);
    expect(state.privateState.tokenPoolById.clue_discard).toEqual(["clue_arkham"]);
    expect(state.pendingDecision?.optionIds).not.toContain("norman-sanity:0");
  });
  it("declineDoesNotConsumeAbility",()=>{
    const done=unwrap(choose(unwrap(choose(cast(),undefined)),"discard_spell"));
    expect(done.players[0]!.sanity).toBe(7);expect(done.privateState.investigatorAbilityUsage!.normanClueSubstitutions).toEqual([]);
  });
  it("freeRerollAndSanityPaymentRemainIndependent",()=>{
    const initial=normanState();initial.players[0]!.assetIds=["asset_lucky_rabbits_foot","asset_lucky_cigarette_case"];
    const content={...normanContent,assets:baseGameAssets};
    let state=unwrap(executeCommand(initial,"host",{type:"CAST_SPELL",spellId:"spell_feed_the_mind"},content,castingContext([1,2])));
    state=unwrap(choose(state,"asset-reroll:asset_lucky_rabbits_foot:0",[3],content));
    expect(state.privateState.investigatorAbilityUsage!.normanClueSubstitutions).toEqual([]);
    state=unwrap(choose(state,"norman-sanity:0",[4],content));
    expect(state.pendingDecision!.optionIds).not.toContain("norman-sanity:0");
    expect(state.pendingDecision!.optionIds).toContain("asset-increment:asset_lucky_cigarette_case:0");
    state=unwrap(choose(state,"asset-increment:asset_lucky_cigarette_case:0",[],content));
    expect(state.privateState.spellCasting?.pending?.finalDice).toEqual([5,2]);
  });
  it.each([["condition_blessed_01",4,true],["condition_cursed_01",5,false]] as const)("usesFinalThresholdFor%s",(condition,die,pass)=>{
    const initial=normanState("spell_feed_the_mind_02");initial.players[0]!.conditionIds=[condition];
    const state=unwrap(choose(cast(initial),"norman-sanity:0",[die]));
    expect(state.pendingDecision?.kind).toBe(pass?"spell_target":undefined);
  });
  it("guardsTrishAuraOnResumptionWithoutConsumingInput",()=>{
    const state=cast();state.players[1]!.investigatorId="trish_scarborough";
    const before=structuredClone(state),ctx=castingContext([6]);
    expect(executeCommand(state,"host",{type:"RESOLVE_DECISION",decisionId:state.pendingDecision!.id,selectedOptionIds:["norman-sanity:0"]},normanContent,ctx)).toMatchObject({ok:false,error:{code:"SPELL_EFFECT_UNSUPPORTED"}});
    expect(state).toEqual(before);expect(ctx.rollDie()).toBe(6);
  });
  it("rejectsForgedDuplicateAndUnaffordableResponsesAtomically",()=>{
    const pending=cast(),before=structuredClone(pending);
    for(const [owner,option] of [["guest","norman-sanity:0"],["host","norman-sanity:2"],["host","norman-sanity:-1"],["host","forged"]])expect(choose(pending,option,[6],normanContent,owner).ok).toBe(false);
    expect(pending).toEqual(before);
    const paid=unwrap(choose(pending,"norman-sanity:0")),paidBefore=structuredClone(paid);
    expect(executeCommand(paid,"host",{type:"RESOLVE_DECISION",decisionId:pending.pendingDecision!.id,selectedOptionIds:["norman-sanity:0"]},normanContent,castingContext()).ok).toBe(false);
    expect(paid).toEqual(paidBefore);
    const poor=structuredClone(pending);poor.players[0]!.sanity=1;expect(choose(poor,"norman-sanity:0").ok).toBe(false);
    const used=structuredClone(pending);used.privateState.investigatorAbilityUsage!.normanClueSubstitutions=[{playerId:"host",investigatorId:"norman_withers",round:used.turnNumber}];
    expect(choose(used,"norman-sanity:0").ok).toBe(false);
  });
  it("rejectsPublicOrForgedNormanRerollSnapshots",()=>{
    for(const mutate of [(s:GameState)=>{s.pendingDecision!.visibility="public";},(s:GameState)=>{s.pendingDecision!.optionIds=["norman-sanity:99"];},(s:GameState)=>{s.pendingDecision!.optionIds.push("norman-sanity:0");}]){
      const state=cast();mutate(state);expect(validateSpellCastingState(state,normanContent)).toBeTruthy();
    }
  });
  it("rollsBackPaymentAndRandomQueuesOnFailure",()=>{
    const pending=cast(),before=structuredClone(pending);
    for(const input of [{dice:[],ids:["unused"]},{dice:[7],ids:["unused"]}]){
      const ctx=createDeterministicEngineContext(input);
      expect(executeCommand(pending,"host",{type:"RESOLVE_DECISION",decisionId:pending.pendingDecision!.id,selectedOptionIds:["norman-sanity:0"]},normanContent,ctx)).toMatchObject({ok:false,error:{code:"SPELL_RANDOM_INPUT_INVALID"}});
      expect(pending).toEqual(before);expect(ctx.createId()).toBe("unused");
    }
    // With a free reroll remaining, rebuilding the decision exhausts IDs after the paid roll.
    const initial=normanState();initial.players[0]!.assetIds=["asset_lucky_rabbits_foot"];
    const content={...normanContent,assets:baseGameAssets};const state=unwrap(executeCommand(initial,"host",{type:"CAST_SPELL",spellId:"spell_feed_the_mind"},content,castingContext([1,2])));
    const ctx=createDeterministicEngineContext({dice:[6],ids:[]}),snap=structuredClone(state);
    expect(executeCommand(state,"host",{type:"RESOLVE_DECISION",decisionId:state.pendingDecision!.id,selectedOptionIds:["norman-sanity:0"]},content,ctx).ok).toBe(false);
    expect(state).toEqual(snap);expect(ctx.rollDie()).toBe(6);
    expect(choose(state,"norman-sanity:0",[6],content)).toEqual(choose(JSON.parse(JSON.stringify(snap)) as GameState,"norman-sanity:0",[6],content));
  });
  it("rejectsTheCombinedPaymentAndReverseAwakeningBoundaryBeforeRolling",()=>{
    const state=normanState();state.ancientOneId="cthulhu";state.doom=1;state.players[0]!.sanity=3;
    const before=structuredClone(state),ctx=castingContext([1,2]);
    expect(executeCommand(state,"host",{type:"CAST_SPELL",spellId:"spell_feed_the_mind"},normanContent,ctx)).toMatchObject({ok:false,error:{code:"AWAKENING_UNSUPPORTED"}});
    expect(state).toEqual(before);expect(ctx.rollDie()).toBe(1);
    // No substitution remains, so this otherwise safe three-Sanity cast can complete.
    state.privateState.investigatorAbilityUsage!.normanClueSubstitutions=[{playerId:"host",investigatorId:"norman_withers",round:state.turnNumber}];
    expect(executeCommand(state,"host",{type:"CAST_SPELL",spellId:"spell_feed_the_mind"},normanContent,castingContext([1,2])).ok).toBe(true);
  });
  it("rejectsStrippedCompletedCastLedgerInsteadOfGrantingAnotherUse",()=>{
    let state=unwrap(choose(cast(normanState("spell_feed_the_mind_02")),"norman-sanity:0",[2]));
    expect(state.privateState.spellCasting?.pending).toBeUndefined();
    state.privateState.spells!.deck=state.privateState.spells!.deck.filter(id=>id!=="spell_feed_the_mind_01");
    state.privateState.spells!.heldByPlayer.host=["spell_feed_the_mind_01"];
    expect(cast(state).pendingDecision?.optionIds.some(option=>option.startsWith("norman-sanity:"))).not.toBe(true);
    state=structuredClone(state);delete state.privateState.investigatorAbilityUsage;
    const before=structuredClone(state),ctx=castingContext([1,2]);
    expect(executeCommand(state,"host",{type:"CAST_SPELL",spellId:"spell_feed_the_mind"},normanContent,ctx).ok).toBe(false);
    expect(state).toEqual(before);expect(ctx.rollDie()).toBe(1);
  });
});
