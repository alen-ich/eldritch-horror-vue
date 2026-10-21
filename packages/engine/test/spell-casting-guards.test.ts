import { describe, expect, it } from "vitest";
import { baseGameAssets } from "../../content/src/assets.js";
import { createDeterministicEngineContext, executeCommand, validateSpellCastingState } from "../src/index.js";
import { cast, castingState, castingContent, castingContext, choose, unwrap } from "./spell-casting-fixtures.js";
describe("Spell casting continuation guards",()=>{
  it.each(["leo_anderson","lola_hayes","silas_marsh"] as const)("rejects applicable unsupported %s test ability",investigatorId=>{
    const state=castingState();state.players[0]!.investigatorId="mark_harrigan";state.players[1]!.investigatorId=investigatorId;
    const type=investigatorId==="silas_marsh"?"sea":investigatorId==="leo_anderson"?"wilderness":"city";
    const content={...castingContent,map:{...castingContent.map,locationTypes:{arkham:type as "sea"|"city"|"wilderness",london:"city" as const}}};
    expect(executeCommand(state,"host",{type:"CAST_SPELL",spellId:"spell_feed_the_mind"},content,castingContext()).ok).toBe(false);
  });
  it("rejects restored reroll choices marked public or containing forged options",()=>{
    const state=castingState();state.players[0]!.assetIds=["asset_lucky_rabbits_foot"];
    const content={...castingContent,assets:baseGameAssets};
    const pending=unwrap(executeCommand(state,"host",{type:"CAST_SPELL",spellId:"spell_feed_the_mind"},content,castingContext([4,2])));
    const forged=structuredClone(pending);forged.pendingDecision!.visibility="public";forged.pendingDecision!.optionIds=["forged"];
    expect(validateSpellCastingState(forged,content)).toBeTruthy();
  });
  it("rejects corrupt physical inventory before resumed rewards",()=>{
    const state=cast();state.privateState.spells!.deck.push("spell_feed_the_mind_01");
    const before=structuredClone(state);expect(choose(state,"guest").ok).toBe(false);expect(state).toEqual(before);
  });
  it("rejects a Clue duplicated between the private supply and holding",()=>{
    const state=castingState();state.players[0]!.investigatorId="mark_harrigan";state.players[0]!.clues=1;
    state.privateState.tokenPoolById={clues:["clue_arkham"],"held_clues:host":["clue_arkham"],clue_discard:[]};
    const content={...castingContent,clues:[{id:"clue_arkham",locationId:"arkham" as const}]};
    expect(executeCommand(state,"host",{type:"CAST_SPELL",spellId:"spell_feed_the_mind"},content,castingContext()).ok).toBe(false);
  });
  it("rejects forged result, source kind and decision options on restoration",()=>{
    const target=cast();
    for(const corrupt of [(s:typeof target)=>{s.privateState.spellCasting!.pending!.finalSuccesses=0;},(s:typeof target)=>{s.pendingDecision!.optionIds=["remote"];},(s:typeof target)=>{s.privateState.spellCasting!.pending!.finalDice=[2,2];}]){
      const state=structuredClone(target);corrupt(state);expect(validateSpellCastingState(state,castingContent)).toBeTruthy();
    }
  });
  it("rejects unrelated actions while pending, without randomness",()=>{
    const state=cast(),ctx=castingContext([4]);
    expect(executeCommand(state,"host",{type:"END_ACTIONS"},castingContent,ctx).ok).toBe(false);expect(ctx.rollDie()).toBe(4);
  });
  it("round-trips every decision with exact outcomes and used source",()=>{
    let state=cast(castingState(),[2,2]);const clone=JSON.parse(JSON.stringify(state));
    expect(choose(clone,"discard_spell")).toEqual(choose(state,"discard_spell"));
    state=unwrap(choose(state,"discard_spell"));const id="spell_feed_the_mind_01";
    state.privateState.spells!.deck=state.privateState.spells!.deck.filter(card=>card!==id);state.privateState.spells!.heldByPlayer.host=[id];
    expect(executeCommand(state,"host",{type:"CAST_SPELL",spellId:"spell_feed_the_mind"},castingContent,castingContext()).ok).toBe(false);
    state.phase="mythos";state.replacementWindow=true;state.currentMythosCardId=undefined;state.leadInvestigatorId="host";
    const reset=unwrap(executeCommand(state,"host",{type:"BEGIN_NEXT_ROUND"},castingContent));expect(reset.privateState.spellCasting!.usedPhysicalIds).toEqual([]);
  });
  it("guards Trish's unimplemented two-die Clue reroll aura",()=>{
    const state=castingState();state.players[1]!.investigatorId="trish_scarborough";state.players[0]!.investigatorId="mark_harrigan";
    state.players[0]!.clues=1;state.privateState.tokenPoolById["held_clues:host"]=["clue_arkham"];
    const content={...castingContent,clues:[{id:"clue_arkham",locationId:"arkham" as const}]};
    expect(executeCommand(state,"host",{type:"CAST_SPELL",spellId:"spell_feed_the_mind"},content,castingContext()).ok).toBe(false);
  });
  it("uses modified final four and restores a test between decisions",()=>{
    const state=castingState("spell_feed_the_mind_02");state.players[0]!.investigatorId="mark_harrigan";state.players[0]!.assetIds=["asset_lucky_cigarette_case"];
    const content={...castingContent,assets:baseGameAssets};
    let next=unwrap(executeCommand(state,"host",{type:"CAST_SPELL",spellId:"spell_feed_the_mind"},content,castingContext([3,2])));
    const selected=next.pendingDecision!.optionIds.find(id=>id.startsWith("asset-increment:")&&id.endsWith(":0"))!;
    next=unwrap(executeCommand(JSON.parse(JSON.stringify(next)),"host",{type:"RESOLVE_DECISION",decisionId:next.pendingDecision!.id,selectedOptionIds:[selected]},content,castingContext()));
    expect(next.privateState.spells!.heldByPlayer.host).toEqual(["spell_feed_the_mind_02"]);expect(next.actionsRemaining).toBe(1);
  });
  it("spends a physical Clue to replace final four, then discards the failed Spell",()=>{
    const state=castingState("spell_feed_the_mind_02");state.players[0]!.investigatorId="mark_harrigan";state.players[0]!.clues=1;
    state.privateState.tokenPoolById={clues:[],"held_clues:host":["clue_arkham"],clue_discard:[]};
    const content={...castingContent,clues:[{id:"clue_arkham",locationId:"arkham" as const}]};
    const pending=unwrap(executeCommand(state,"host",{type:"CAST_SPELL",spellId:"spell_feed_the_mind"},content,castingContext([4,2])));
    const next=unwrap(executeCommand(pending,"host",{type:"RESOLVE_DECISION",decisionId:pending.pendingDecision!.id,selectedOptionIds:["die-0"]},content,castingContext([2])));
    expect(next.players[0]!.clues).toBe(0);expect(next.privateState.tokenPoolById.clue_discard).toEqual(["clue_arkham"]);
    expect(next.privateState.spells!.heldByPlayer.host).toEqual([]);expect(next.actionsRemaining).toBe(1);
  });
  it.each([["condition_blessed_01",4,true],["condition_cursed_01",5,false]] as const)("applies %s threshold before reverse",(condition,die,passes)=>{
    const state=castingState("spell_feed_the_mind_02");state.players[0]!.conditionIds=[condition];
    const next=cast(state,[die,2]);expect(next.pendingDecision?.kind).toBe(passes?"spell_target":undefined);
  });
  it("combines Manuscripts, improvement and City aura without making a generic Lore bonus",()=>{
    const state=castingState();state.players[0]!.assetIds=["asset_arcane_manuscripts"];state.players[0]!.skillImprovements.lore=1;state.players[1]!.assetIds=["asset_urban_guide"];
    const content={...castingContent,assets:baseGameAssets};
    const next=unwrap(executeCommand(state,"host",{type:"CAST_SPELL",spellId:"spell_feed_the_mind"},content,castingContext([6,6,6,6,6])));
    expect(next.privateState.spellCasting!.pending!.finalDice).toHaveLength(5);expect(next.pendingDecision?.kind).toBe("spell_target");
  });
  it("rolls back exhausted dice and ID queues without publishing a cast",()=>{
    const state=castingState(),before=structuredClone(state),ctx=createDeterministicEngineContext({dice:[6],ids:["first"]});
    expect(executeCommand(state,"host",{type:"CAST_SPELL",spellId:"spell_feed_the_mind"},castingContent,ctx)).toMatchObject({ok:false,error:{code:"SPELL_RANDOM_INPUT_INVALID"}});
    expect(state).toEqual(before);expect(ctx.rollDie()).toBe(6);expect(ctx.createId()).toBe("first");
  });
});
