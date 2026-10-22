import type { GameContent, GameState } from "./index.js";
import { validateResearchDrawInventory } from "./research-draw-integrity.js";

/** Validate physical/owner binding before executing any restored Research work. */
export function validateResearchContinuationState(state: GameState, content: GameContent): string | undefined {
  const pending = state.pendingLocationEncounter;
  if (!pending?.deck.startsWith("research_")) {
    return state.currentLocationEncounterCardId?.startsWith("encounter_research_")
      ? "Research reveal requires its encounter binding." : undefined;
  }
  const invalid = validateResearchDrawInventory(state, content);
  if (invalid) return invalid;
  if (state.phase !== "encounter" || !state.ancientOneId || pending.deck !== `research_${state.ancientOneId}`
    || pending.playerId !== state.activePlayerId || !state.players.some(player => player.id === pending.playerId)
    || state.currentLocationEncounterCardId !== pending.cardId
    || !pending.cardRemovedFromDeck && state.privateState.deckOrderById[`encounter:${pending.deck}`]?.[0] !== pending.cardId
    || pending.gateId !== undefined || pending.gateLocationId !== undefined || pending.gateClosed !== undefined
    ) {
    return "Research encounter binding is inconsistent.";
  }
  return undefined;
}
