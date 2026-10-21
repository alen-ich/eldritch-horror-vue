import { createDeterministicEngineContext, executeCommand, type CommandResult, type GameState } from "../src/index.js";
import { spellState, spellContent, holdSpell } from "./spell-fixtures.js";
export const castingContent = {...spellContent, privateSpellCastingRules: {feedTheMindByPhysicalId: {
  spell_feed_the_mind_01: {type:"optional_sanity_loss_or_discard_then_optional_improve" as const},
  spell_feed_the_mind_02: {type:"discard_unless_final_four_else_sanity_loss" as const},
}}};
export function castingState(copy = "spell_feed_the_mind_01"): GameState { const state=spellState(); holdSpell(state,copy); state.players[1]!.locationId="arkham"; return state; }
export function castingContext(dice = [6,6]) { return createDeterministicEngineContext({dice,ids:Array.from({length:30},(_,i)=>`cast-${i}`),shuffleIndexes:Array(19).fill(0)}); }
export function unwrap(result: CommandResult): GameState { if (!result.ok) throw Error(result.error.code+": "+result.error.message); return result.state; }
export function cast(state=castingState(),dice=[6,6]): GameState { return unwrap(executeCommand(state,"host",{type:"CAST_SPELL",spellId:"spell_feed_the_mind"},castingContent,castingContext(dice))); }
export function choose(state: GameState,option: string,owner = state.pendingDecision!.playerId): CommandResult { return executeCommand(state,owner,{type:"RESOLVE_DECISION",decisionId:state.pendingDecision!.id,selectedOptionIds:[option]},castingContent,castingContext()); }
