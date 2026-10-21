import type { ActiveTest, GameCommand, GameEvent, PendingDecision, SkillId } from "@eldritch/protocol";
import type { ActionType, CommandResult, EngineContext, EnginePlayer, GameContent, GameState } from "./index.js";
import { testRerollDecisionIsValid } from "./index.js";
import { discardSpell, validateSpellInventory } from "./spells.js";
import { spellTestItemBonuses, validateSpellTestApplicability } from "./spell-test-assets.js";
import { nonCombatEncounterAuraBonus } from "./encounter-assets.js";
import { conditionSuccessThreshold } from "./conditions.js";

export type FeedTheMindBackRule = { type: "optional_sanity_loss_or_discard_then_optional_improve" } | { type: "discard_unless_final_four_else_sanity_loss" };
export interface PrivateSpellCastingRules { feedTheMindByPhysicalId: Readonly<Record<string, FeedTheMindBackRule>> }
export type SpellCastStage = "test" | "target" | "front_improve" | "reverse_loss_choice" | "reverse_improve";
export interface PendingSpellCast {
  casterPlayerId: string; sourcePhysicalId: string; startedTurnNumber: number;
  stage: SpellCastStage; actionReserved: true; recipientPlayerId?: string;
  finalDice?: number[]; finalSuccesses?: number;
}
export interface PrivateSpellCastingState { usedPhysicalIds: string[]; pending?: PendingSpellCast }
export interface SpellCastingAdapters {
  beginTest(state: GameState, player: EnginePlayer, request: { skill: SkillId; modifier: number; continuation: ActiveTest["continuation"]; itemBonuses?: readonly number[]; otherBonuses?: readonly number[] }, content: GameContent, context: EngineContext): GameEvent[];
  damage(state: GameState, playerId: string, health: number, sanity: number, content: GameContent): CommandResult;
  completeAction(state: GameState, actorIndex: number, action: ActionType, events: GameEvent[]): void;
}
const kinds = ["spell_target", "spell_improvement", "spell_reverse_choice"];
const skills: SkillId[] = ["lore", "influence", "observation", "strength", "will"];
function rejected(message: string): CommandResult { return {ok:false,error:{code:"SPELL_CAST_INVALID",message}}; }
function accepted(state: GameState, events: GameEvent[] = []): CommandResult { return {ok:true,state,events}; }
function rulesValid(content: GameContent): boolean {
  const rules = content.privateSpellCastingRules?.feedTheMindByPhysicalId;
  return !!rules && Object.keys(rules).length === 2 && ["01","02"].every(copy => {
    const rule = rules[`spell_feed_the_mind_${copy}`];
    return rule && Object.keys(rule).length === 1 && ["optional_sanity_loss_or_discard_then_optional_improve","discard_unless_final_four_else_sanity_loss"].includes(rule.type);
  });
}
export function canCastFeedTheMind(state: GameState, playerId: string, content: GameContent): boolean {
  const caster=state.players.find(player=>player.id===playerId);
  const source=state.privateState.spells?.heldByPlayer[playerId]?.find(id=>content.spells?.some(card=>card.id===id&&card.kind==="feed_the_mind"));
  return !!caster && !!caster.investigatorId && !!caster.locationId && !!content.investigators[caster.investigatorId] && !!source
    && state.phase==="action" && state.activePlayerId===playerId && state.actionsRemaining>0 && !caster.defeated && !caster.eliminated && !caster.delayed
    && !caster.conditionIds?.some(id=>content.conditions?.some(card=>card.id===id&&card.kind==="detained"))
    && !state.gameResult && !state.pendingDefeat && !state.pendingDecision && !state.activeTest && !state.pendingRest && !state.pendingLocationEncounter && !state.tradeOffer
    && !state.privateState.spellCasting?.pending && !state.privateState.spellCasting?.usedPhysicalIds.includes(source)
    && !validateSpellInventory(state,content.spells??[]) && rulesValid(content) && !validateSpellTestApplicability(state,playerId,content);
}
function decision(state: GameState, stage: SpellCastStage, owner: string, options: [string,string][], context: EngineContext): void {
  state.privateState.spellCasting!.pending!.stage=stage;
  state.pendingDecision={id:context.createId(),kind:stage==="target"?"spell_target":stage==="reverse_loss_choice"?"spell_reverse_choice":"spell_improvement",playerId:owner,visibility:"owner",prompt:stage==="target"?"Choose an investigator on your space.":stage==="reverse_loss_choice"?"Resolve the Spell effect.":"Choose a skill to improve.",optionIds:options.map(([id])=>id),optionLabels:Object.fromEntries(options),minSelections:1,maxSelections:1,continuation:"spell_cast_choice"};
}
function improvementOptions(player: EnginePlayer, optional=false): [string,string][] {
  const choices: [string,string][]=skills.flatMap(skill=>(player.investigatorId==="lily_chen"?[1,2]:[1]).map(amount=>[`improve:${skill}:${amount}`,`Improve ${skill}${amount===2?" twice (Lily)":" once"}`] as [string,string]));
  return optional?[...choices,["decline","Decline"]]:choices;
}
function finish(state: GameState, events: GameEvent[], adapters: SpellCastingAdapters): CommandResult {
  const cast=state.privateState.spellCasting!.pending!;
  delete state.privateState.spellCasting!.pending;state.activeTest=undefined;state.pendingDecision=undefined;
  const index=state.players.findIndex(p=>p.id===cast.casterPlayerId);
  if(state.pendingDefeat||state.gameResult){state.actionsRemaining-=1;state.performedActions.push("component");}
  else adapters.completeAction(state,index,"component",events);
  return accepted(state,events);
}
function applyLoss(state: GameState, amount: number, content: GameContent, adapters: SpellCastingAdapters, events: GameEvent[]): CommandResult {
  const result=adapters.damage(state,state.privateState.spellCasting!.pending!.casterPlayerId,0,amount,content);
  if(!result.ok)return result;
  result.state.stateVersion=state.stateVersion;
  return finish(result.state,[...events,...result.events],adapters);
}
function reverse(state: GameState, content: GameContent, context: EngineContext, adapters: SpellCastingAdapters, events: GameEvent[]): CommandResult {
  const cast=state.privateState.spellCasting!.pending!;
  const rule=content.privateSpellCastingRules!.feedTheMindByPhysicalId[cast.sourcePhysicalId]!;
  if(rule.type==="optional_sanity_loss_or_discard_then_optional_improve"){
    if(cast.finalSuccesses!<3)decision(state,"reverse_loss_choice",cast.casterPlayerId,[["lose_sanity","Lose 2 Sanity"],["discard_spell","Discard Spell"]],context);
    else {const recipient=state.players.find(p=>p.id===cast.recipientPlayerId)!;decision(state,"reverse_improve",recipient.id,improvementOptions(recipient,true),context);}
    return accepted(state,events);
  }
  if(cast.finalSuccesses!>0)return applyLoss(state,1,content,adapters,events);
  if(!cast.finalDice!.includes(4)){
    const result=discardSpell(state,cast.casterPlayerId,cast.sourcePhysicalId,content,context);
    if(!result.ok)return result;return finish(result.state,[...events,...result.events],adapters);
  }
  return finish(state,events,adapters);
}
export function beginSpellCast(state: GameState, casterId: string, content: GameContent, context: EngineContext, adapters: SpellCastingAdapters): CommandResult {
  if(!canCastFeedTheMind(state,casterId,content))return rejected("This Spell cannot be cast now.");
  const next=structuredClone(state),caster=next.players.find(p=>p.id===casterId)!;
  if (caster.investigatorId === "norman_withers") {
    next.privateState.investigatorAbilityUsageVersion = 1;
    next.privateState.investigatorAbilityUsage ??= { schemaVersion: 1, normanClueSubstitutions: [] };
  }
  const source=next.privateState.spells!.heldByPlayer[casterId]!.find(id=>content.spells!.some(card=>card.id===id&&card.kind==="feed_the_mind"))!;
  const casting=next.privateState.spellCasting??={usedPhysicalIds:[]};casting.usedPhysicalIds.push(source);
  casting.pending={casterPlayerId:casterId,sourcePhysicalId:source,startedTurnNumber:next.turnNumber,stage:"test",actionReserved:true};
  const events=adapters.beginTest(next,caster,{skill:"lore",modifier:-1,continuation:"spell_cast",itemBonuses:spellTestItemBonuses(next,casterId,content),otherBonuses:[nonCombatEncounterAuraBonus(next,caster,content)]},content,context);
  if(next.pendingDecision)return accepted(next,events);
  const result=finishSpellCastTest(next,next.activeTest!,content,context,adapters);
  return result.ok?accepted(result.state,[...events,...result.events]):result;
}
export function finishSpellCastTest(state: GameState, test: ActiveTest, content: GameContent, context: EngineContext, adapters: SpellCastingAdapters): CommandResult {
  const next=structuredClone(state),cast=next.privateState.spellCasting?.pending;
  if(!cast||cast.casterPlayerId!==test.playerId||cast.stage!=="test")return rejected("The Spell test source is missing.");
  cast.finalDice=[...test.dice];cast.finalSuccesses=test.successes;next.activeTest=undefined;next.pendingDecision=undefined;
  const events:GameEvent[]=[{type:"TEST_RESOLVED",testId:test.id,playerId:test.playerId,successes:test.successes,continuation:"spell_cast"}];
  if(test.successes>0){const caster=next.players.find(p=>p.id===cast.casterPlayerId)!;decision(next,"target",caster.id,next.players.filter(p=>!p.defeated&&!p.eliminated&&p.investigatorId&&p.locationId===caster.locationId).map(p=>[p.id,p.investigatorId!]),context);return accepted(next,events);}
  return reverse(next,content,context,adapters,events);
}
export function resolveSpellCastDecision(state:GameState,actorId:string,command:Extract<GameCommand,{type:"RESOLVE_DECISION"}>,content:GameContent,context:EngineContext,adapters:SpellCastingAdapters):CommandResult{
  const invalid=validateSpellCastingState(state,content);if(invalid)return rejected(invalid);
  const choice=state.pendingDecision!,selection=command.selectedOptionIds[0];
  if(choice.id!==command.decisionId||choice.playerId!==actorId||command.selectedOptionIds.length!==1||!selection||!choice.optionIds.includes(selection))return rejected("Only the assigned owner may select an available Spell option.");
  const next=structuredClone(state),cast=next.privateState.spellCasting!.pending!;
  const events:GameEvent[]=[{type:"DECISION_RESOLVED",decisionId:choice.id,playerId:actorId,selectedOptionIds:[selection]}];
  next.pendingDecision=undefined;
  if(cast.stage==="target"){
    const recipient=next.players.find(p=>p.id===selection),caster=next.players.find(p=>p.id===cast.casterPlayerId)!;
    if(!recipient||recipient.defeated||recipient.eliminated||recipient.locationId!==caster.locationId)return rejected("Invalid Spell recipient.");
    cast.recipientPlayerId=recipient.id;decision(next,"front_improve",recipient.id,improvementOptions(recipient),context);return accepted(next,events);
  }
  if(cast.stage==="front_improve"||cast.stage==="reverse_improve"){
    const optional=cast.stage==="reverse_improve",recipient=next.players.find(p=>p.id===cast.recipientPlayerId)!;
    if(!improvementOptions(recipient,optional).some(([id])=>id===selection))return rejected("Invalid improvement.");
    if(selection!=="decline"){
      const [,skill,amount]=selection.split(":");const id=skill as SkillId;
      recipient.skillImprovements[id]=Math.min(2,(recipient.skillImprovements[id]??0)+Number(amount));
      events.push({type:"SKILL_IMPROVED",playerId:recipient.id,skill:id,improvement:recipient.skillImprovements[id]!});
    }
    return optional?finish(next,events,adapters):reverse(next,content,context,adapters,events);
  }
  if(cast.stage==="reverse_loss_choice"){
    if(selection==="lose_sanity")return applyLoss(next,2,content,adapters,events);
    if(selection!=="discard_spell")return rejected("Invalid reverse choice.");
    const result=discardSpell(next,cast.casterPlayerId,cast.sourcePhysicalId,content,context);
    return result.ok?finish(result.state,[...events,...result.events],adapters):result;
  }
  return rejected("Invalid Spell stage.");
}
export function withSpellRandomTransaction(context: EngineContext, run: () => CommandResult): CommandResult {
  if (!context.checkpoint) return {ok:false,error:{code:"RANDOM_INPUT_REQUIRED",message:"Spell casting requires transactional random input."}};
  const checkpoint = context.checkpoint();
  try { const result = run(); if (result.ok) checkpoint.commit(); else checkpoint.rollback(); return result; }
  catch { checkpoint.rollback(); return {ok:false,error:{code:"SPELL_RANDOM_INPUT_INVALID",message:"Spell random input is unavailable or invalid."}}; }
}
export function validateSpellCastingState(state: GameState, content: GameContent): string | undefined {
  const casting = state.privateState.spellCasting;
  const orphan = state.activeTest?.continuation === "spell_cast" || kinds.includes(state.pendingDecision?.kind ?? "");
  if (!casting) return orphan ? "Missing Spell casting state." : undefined;
  if (!Array.isArray(casting.usedPhysicalIds) || Object.keys(casting).some(k => !["usedPhysicalIds", "pending"].includes(k))
    || new Set(casting.usedPhysicalIds).size !== casting.usedPhysicalIds.length
    || casting.usedPhysicalIds.some(id => !content.spells?.some(card => card.id === id && card.kind === "feed_the_mind"))) return "Invalid Spell usage.";
  const pending = casting.pending;
  if (!pending) return orphan ? "Missing pending Spell cast." : undefined;
  if(!rulesValid(content)) return "Missing private Spell rules.";
  if (Object.keys(pending).some(k => !["casterPlayerId", "sourcePhysicalId", "startedTurnNumber", "stage", "actionReserved", "recipientPlayerId", "finalDice", "finalSuccesses"].includes(k))) return "Invalid Spell fields.";
  const caster = state.players.find(player => player.id === pending.casterPlayerId);
  if (!caster || caster.defeated || caster.eliminated || state.gameResult || state.pendingDefeat || state.phase !== "action"
    || state.activePlayerId !== caster.id || pending.startedTurnNumber !== state.turnNumber || pending.actionReserved !== true
    || state.actionsRemaining < 1 || !casting.usedPhysicalIds.includes(pending.sourcePhysicalId)
    || !state.privateState.spells?.heldByPlayer[caster.id]?.includes(pending.sourcePhysicalId)
    || !["test", "target", "front_improve", "reverse_loss_choice", "reverse_improve"].includes(pending.stage)) return "Invalid Spell source or phase.";
  if (state.pendingLocationEncounter || state.pendingRest || state.tradeOffer) return "Conflicting Spell continuation.";
  if (pending.stage === "test") {
    if (pending.finalDice !== undefined || pending.finalSuccesses !== undefined || pending.recipientPlayerId !== undefined
      || state.activeTest?.continuation !== "spell_cast" || state.activeTest.playerId !== caster.id
      || state.pendingDecision?.continuation !== "test_reroll" || state.pendingDecision.kind !== "select_rerolls" || state.pendingDecision.playerId !== caster.id
      || state.activeTest.skill !== "lore" || state.activeTest.modifier !== -1
      || !Array.isArray(state.activeTest.dice) || !state.activeTest.dice.length || state.activeTest.dice.length !== state.activeTest.dicePool
      || state.activeTest.dice.some(die => !Number.isInteger(die)||die<1||die>6)
      || state.activeTest.successThreshold !== conditionSuccessThreshold(caster.conditionIds??[])
      || state.activeTest.successes !== state.activeTest.dice.filter(die=>die>=state.activeTest!.successThreshold).length
      || !testRerollDecisionIsValid(state, content)) return "Invalid Spell test.";
    return undefined;
  }
  if (state.activeTest || !Array.isArray(pending.finalDice) || !pending.finalDice.length
    || pending.finalDice.some(die => !Number.isInteger(die) || die < 1 || die > 6)
    || !Number.isInteger(pending.finalSuccesses) || pending.finalSuccesses! < 0 || pending.finalSuccesses! > pending.finalDice.length) return "Invalid final Spell dice.";
  if(pending.finalSuccesses!==pending.finalDice.filter(die=>die>=conditionSuccessThreshold(caster.conditionIds??[])).length) return "Spell result differs from final dice.";
  const recipient = state.players.find(player => player.id === pending.recipientPlayerId);
  if (pending.stage === "target" ? pending.recipientPlayerId !== undefined || pending.finalSuccesses === 0
    : pending.stage === "front_improve" || pending.stage === "reverse_improve"
      ? !recipient || recipient.defeated || recipient.eliminated || recipient.locationId !== caster.locationId || !pending.finalSuccesses
      : pending.recipientPlayerId !== undefined && (!recipient || recipient.defeated || recipient.eliminated || recipient.locationId !== caster.locationId)) return "Invalid Spell recipient.";
  const decision = state.pendingDecision;
  const owner = pending.stage === "front_improve" || pending.stage === "reverse_improve" ? recipient?.id : caster.id;
  const kind = pending.stage === "target" ? "spell_target" : pending.stage === "reverse_loss_choice" ? "spell_reverse_choice" : "spell_improvement";
  if (!decision || decision.continuation !== "spell_cast_choice" || decision.kind !== kind || decision.playerId !== owner || decision.visibility !== "owner") return "Invalid Spell decision.";
  const rule=content.privateSpellCastingRules!.feedTheMindByPhysicalId[pending.sourcePhysicalId]!;
  if((pending.stage==="reverse_loss_choice" || pending.stage==="reverse_improve")
    && (rule.type!=="optional_sanity_loss_or_discard_then_optional_improve" || (pending.stage==="reverse_improve" ? pending.finalSuccesses!<3 : pending.finalSuccesses!>=3))) return "Invalid reverse branch.";
  const expected=pending.stage==="target" ? state.players.filter(p=>!p.defeated&&!p.eliminated&&p.investigatorId&&p.locationId===caster.locationId).map(p=>p.id)
    : pending.stage==="reverse_loss_choice" ? ["lose_sanity","discard_spell"] : improvementOptions(recipient!,pending.stage==="reverse_improve").map(([id])=>id);
  if(!Array.isArray(decision.optionIds)||decision.minSelections!==1||decision.maxSelections!==1||decision.optionIds.length!==expected.length||new Set(decision.optionIds).size!==expected.length||decision.optionIds.some(id=>!expected.includes(id)))return "Invalid Spell options.";
  return undefined;
}
