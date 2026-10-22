import { validateLocationState } from "./location-state.js";
import type { GameContent, GameState } from "./index.js";
import { locationEncounterDeckIds } from "./setup.js";

/** Validate removed physical cards and legacy top-bound continuations. */
export function validateLocationContinuationState(state: GameState, content: GameContent): string | undefined {
  const pending = state.pendingLocationEncounter;
  const isLocation = (deck: string) => locationEncounterDeckIds.some(id => id === deck);
  const revealed = state.currentLocationEncounterCardId;
  if (!pending || !isLocation(pending.deck)) {
    const locationReveal = revealed && (content.locationEncounters?.some(card => card.id === revealed)
      || locationEncounterDeckIds.some(deck => revealed.startsWith(`encounter_${deck}_`)));
    return locationReveal ? "Location reveal requires its encounter binding." : undefined;
  }
  const invalid = validateLocationState(state, content);
  if (invalid) return invalid;
  if (state.phase !== "encounter" || pending.playerId !== state.activePlayerId
    || !state.players.some(player => player.id === pending.playerId)
    || revealed !== pending.cardId
    || !pending.cardRemovedFromDeck && state.privateState.deckOrderById[`encounter:${pending.deck}`]?.[0] !== pending.cardId
    || !content.locationEncounters?.some(card => card.id === pending.cardId && card.deck === pending.deck)
    || pending.gateId !== undefined || pending.gateLocationId !== undefined || pending.gateClosed !== undefined
    || pending.cardRemovedFromDeck !== undefined && pending.cardRemovedFromDeck !== true) {
    return "Location encounter binding is inconsistent.";
  }
  return undefined;
}
