import type { GameContent, GameState } from "./index.js";
import { locationEncounterDeckIds } from "./setup.js";

/** Location cards remain top-bound until physical discard is introduced. */
export function validateLocationContinuationState(state: GameState, content: GameContent): string | undefined {
  const pending = state.pendingLocationEncounter;
  const isLocation = (deck: string) => locationEncounterDeckIds.some(id => id === deck);
  const revealed = state.currentLocationEncounterCardId;
  if (!pending || !isLocation(pending.deck)) {
    const locationReveal = revealed && (content.locationEncounters?.some(card => card.id === revealed)
      || locationEncounterDeckIds.some(deck => revealed.startsWith(`encounter_${deck}_`)));
    return locationReveal ? "Location reveal requires its encounter binding." : undefined;
  }
  if (state.phase !== "encounter" || pending.playerId !== state.activePlayerId
    || !state.players.some(player => player.id === pending.playerId)
    || revealed !== pending.cardId
    || state.privateState.deckOrderById[`encounter:${pending.deck}`]?.[0] !== pending.cardId
    || !content.locationEncounters?.some(card => card.id === pending.cardId && card.deck === pending.deck)
    || pending.gateId !== undefined || pending.gateLocationId !== undefined || pending.gateClosed !== undefined
    || pending.cardRemovedFromDeck !== undefined) {
    return "Location encounter binding is inconsistent.";
  }
  return undefined;
}
