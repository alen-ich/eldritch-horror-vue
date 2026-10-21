import type { CommandResult, GameContent, GameState } from "./index.js";
import { physicalAssetIsUnique, encounterDamagePreventions } from "./encounter-assets.js";
import { spellEffectIsUnsupported } from "./spells.js";
import { normanHasSubstitutionAvailable } from "./norman-clue-substitution.js";
export function spellTestItemBonuses(state: GameState, playerId: string, content: GameContent): number[] {
  return (state.players.find(player => player.id === playerId)?.assetIds ?? []).flatMap(id =>
    content.assets.find(card => card.id === id)?.engineEffects.flatMap(effect => effect.type === "spell_lore_bonus" ? [effect.amount] : []) ?? []);
}
export function validateSpellTestApplicability(state: GameState, playerId: string, content: GameContent): CommandResult | undefined {
  const player = state.players.find(candidate => candidate.id === playerId);
  const reject = (): CommandResult => ({ok:false, error:{code:"SPELL_EFFECT_UNSUPPORTED", message:"An applicable Spell test or loss effect is not supported."}});
  if (!player) return reject();
  const spaceType = player.locationId ? content.map.locationTypes[player.locationId] : undefined;
  if (state.players.some(holder => !holder.defeated && !holder.eliminated && holder.locationId === player.locationId
    && (holder.investigatorId === "lola_hayes" || holder.investigatorId === "leo_anderson" && spaceType === "wilderness"
      || holder.investigatorId === "silas_marsh" && spaceType === "sea"))) return reject();
  if ((player.clues > 0 || normanHasSubstitutionAvailable(state, playerId)) && state.players.some(holder => !holder.defeated && !holder.eliminated && holder.locationId === player.locationId && holder.investigatorId === "trish_scarborough")) return reject();
  if (spellEffectIsUnsupported(state, playerId, "sanity_loss", content) || encounterDamagePreventions(state,player,content).some(source => source.resource === "sanity")) return reject();
  // Existing verified non-combat classification covers irrelevant weapons/Rest
  // cards as well as supported generic test effects; missing metadata fails shut.
  for (const id of player.assetIds) {
    const asset = content.assets.find(card => card.id === id);
    if (!asset || !asset.nonCombatEncounterSupport || asset.nonCombatEncounterSupport === "unsupported" && id !== "asset_kerosene" || !physicalAssetIsUnique(state,id)) return reject();
  }
  for (const holder of state.players.filter(p => !p.defeated && !p.eliminated && p.locationId === player.locationId)) {
    for (const id of holder.assetIds) if (content.assets.find(card => card.id === id)?.engineEffects.some(effect => effect.type === "city_test_aura") && !physicalAssetIsUnique(state,id)) return reject();
  }
  // Pallid Mask only replaces Encounter selection; it cannot affect this Action test.
  // Other Artifact Spell modifiers/reactions remain guarded.
  if (player.artifactIds?.length) {
    const physical = [...(state.privateState.deckOrderById.artifacts ?? []), ...state.players.flatMap(holder => holder.artifactIds ?? []), ...(state.defeatedInvestigators ?? []).flatMap(holder => holder.artifactIds ?? [])];
    if (player.artifactIds.some(id => id !== "artifact_pallid_mask" || !content.artifacts?.some(card => card.id === id) || physical.filter(copy => copy === id).length !== 1)) return reject();
  }
  if (player.clues > 0) {
    const held = state.privateState.tokenPoolById[`held_clues:${playerId}`];
    const physical = Object.entries(state.privateState.tokenPoolById).filter(([key])=>key==="clues"||key==="clue_discard"||key.startsWith("held_clues:")||key.startsWith("board_clue:")||key.startsWith("defeated_clues:")).flatMap(([,ids])=>ids);
    if (!state.privateState.tokenPoolById.clues || !held || held.length !== player.clues || new Set(held).size !== held.length || held.some(id => !content.clues?.some(clue => clue.id === id) || physical.filter(copy=>copy===id).length!==1)) return {ok:false,error:{code:"CLUE_CONTENT_MISSING",message:"Physical test Clues are inconsistent."}};
  }
  const possibleSanityPayment = normanHasSubstitutionAvailable(state, playerId) ? 1 : 0;
  if ((state.doom ?? 0) <= 1 && (player.sanity ?? 0) <= 2 + possibleSanityPayment && state.ancientOneId !== "azathoth") return {ok:false,error:{code:"AWAKENING_UNSUPPORTED",message:"This Spell could require unsupported awakening."}};
  return undefined;
}
