import type { GameContent, GameState, EnginePlayer } from "./index.js";
import type { LocationEncounterInstruction } from "./encounter-instructions.js";

/** Urban Guide is an Ally aura, not an Item bonus. Only this interpreter's scope is wired. */
export function nonCombatEncounterAuraBonus(state: GameState, player: EnginePlayer, content: GameContent): number {
  if (!player.locationId || content.map.locationTypes[player.locationId] !== "city") return 0;
  return state.players.filter(holder => !holder.defeated && !holder.eliminated && holder.locationId === player.locationId)
    .flatMap(holder => holder.assetIds)
    .flatMap(id => {
      const asset = content.assets.find(asset => asset.id === id);
      return asset?.nonCombatEncounterSupport === "city_test_aura" ? asset.engineEffects : [];
    })
    .reduce((total, effect) => total + (effect.type === "city_test_aura" ? effect.amount : 0), 0);
}

function nodes(instruction: LocationEncounterInstruction): LocationEncounterInstruction[] {
  if (instruction.kind === "sequence") return [instruction, ...instruction.steps.flatMap(nodes)];
  if (instruction.kind === "choice") return [instruction, ...instruction.options.flatMap(nodes)];
  if (instruction.kind === "test") return [instruction, ...nodes(instruction.pass), ...nodes(instruction.fail)];
  if (instruction.kind === "optional") return [instruction, { kind: "effects", effects: instruction.cost }, ...nodes(instruction.reward)];
  if (instruction.kind === "ambush" || instruction.kind === "ambush_result") return [instruction, ...nodes(instruction.defeated), ...nodes(instruction.notDefeated)];
  return [instruction];
}

export function encounterItemAssetIds(player: EnginePlayer, content: GameContent): string[] {
  return player.assetIds.filter(id => content.assets.find(asset => asset.id === id)?.traits?.includes("item"));
}

/** Each selectable physical card must exist only in this holding, not a second pile/seat. */
export function encounterItemsAreConserved(state: GameState, player: EnginePlayer, content: GameContent): boolean {
  const physicalIds = [
    ...state.players.flatMap(holder => holder.assetIds), ...state.reserveAssetIds, ...state.assetDiscardIds,
    ...(state.privateState.deckOrderById.assets ?? []), ...(state.defeatedInvestigators ?? []).flatMap(sheet => sheet.assetIds),
  ];
  return encounterItemAssetIds(player, content).every(id => physicalIds.filter(candidate => candidate === id).length === 1);
}

/** Preflight every branch before prefix effects, dice, choices or component changes. */
export function supportsEncounterAssets(state: GameState, player: EnginePlayer, content: GameContent, instruction: LocationEncounterInstruction): boolean {
  const assets = player.assetIds.map(id => content.assets.find(asset => asset.id === id));
  if (assets.some(asset => !asset || !asset.nonCombatEncounterSupport || asset.nonCombatEncounterSupport === "unsupported")) return false;
  const all = nodes(instruction);
  if (all.some(node => node.kind === "ambush" || node.kind === "ambush_result")
    && (assets.length > 0 || nonCombatEncounterAuraBonus(state, player, content) > 0)) return false;
  if (all.some(node => node.kind === "effects" && node.effects.some(effect => effect.kind === "discard_item_assets"))
    && !encounterItemsAreConserved(state, player, content)) return false;
  return true;
}
