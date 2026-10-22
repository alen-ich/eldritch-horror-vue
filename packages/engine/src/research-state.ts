import type { EngineContext, GameContent, GameState } from "./index.js";
import { validateResearchDrawInventory } from "./research-draw-integrity.js";

/** Optional uninitialized snapshots stay absent; initialized zones are never repaired. */
export function validateResearchState(state: GameState, content: GameContent): string | undefined {
  const deck = state.privateState.deckOrderById[`encounter:research_${state.ancientOneId}`];
  if (deck === undefined && !state.pendingLocationEncounter?.deck.startsWith("research_")
    && !state.currentLocationEncounterCardId?.startsWith("encounter_research_")
    && (state.researchDiscardIds === undefined || Array.isArray(state.researchDiscardIds) && state.researchDiscardIds.length === 0)) return undefined;
  return validateResearchDrawInventory(state, content);
}

function shuffleCards(ids: readonly string[], context: EngineContext): string[] {
  const shuffled = context.shuffle([...ids]);
  if (!Array.isArray(shuffled) || shuffled.length !== ids.length || new Set(shuffled).size !== ids.length
    || !Array.from(shuffled).every(id => ids.includes(id))) throw new Error("Invalid physical Research shuffle.");
  return shuffled;
}

/** Caller supplies a cloned state within the Research RNG transaction. */
export function removeResearchEncounterCard(state: GameState, content: GameContent, context: EngineContext): string | undefined {
  const pending = state.pendingLocationEncounter;
  if (!pending?.deck.startsWith("research_")) return undefined;
  const invalid = validateResearchDrawInventory(state, content);
  if (invalid || pending.cardRemovedFromDeck) return invalid;
  const order = state.privateState.deckOrderById[`encounter:${pending.deck}`]!;
  order.shift();
  pending.cardRemovedFromDeck = true;
  state.researchDiscardIds ??= [];
  if (!order.length && state.researchDiscardIds.length) {
    state.privateState.deckOrderById[`encounter:${pending.deck}`] = shuffleCards(state.researchDiscardIds, context);
    state.researchDiscardIds = [];
  }
  return validateResearchDrawInventory(state, content);
}

/** The caller clears current/pending fields immediately after physical completion. */
export function finishResearchEncounterCard(state: GameState, content: GameContent, context: EngineContext): string | undefined {
  const invalid = validateResearchDrawInventory(state, content);
  const pending = state.pendingLocationEncounter;
  if (invalid) return invalid;
  if (!pending?.deck.startsWith("research_") || !pending.cardRemovedFromDeck) return "Research completion requires its removed card.";
  state.researchDiscardIds = [...(state.researchDiscardIds ?? []), pending.cardId];
  if (!state.privateState.deckOrderById[`encounter:${pending.deck}`]!.length) {
    state.privateState.deckOrderById[`encounter:${pending.deck}`] = shuffleCards(state.researchDiscardIds, context);
    state.researchDiscardIds = [];
  }
  return undefined;
}
