import type { GameContent, GameState } from "./index.js";
import { validateResearchSetupCatalog } from "./research-setup.js";

/** Configured physical catalogs cannot silently fall back to partial rule fixtures. */
export function validateResearchDrawInventory(state: GameState, content: GameContent): string | undefined {
  const catalog = content.researchEncounterSetup;
  if (catalog !== undefined && validateResearchSetupCatalog(catalog)) return "Research physical catalog is invalid.";
  const deck = `research_${state.ancientOneId}`;
  const order = state.privateState.deckOrderById[`encounter:${deck}`];
  const discard = state.researchDiscardIds === undefined ? [] : state.researchDiscardIds;
  const pending = state.pendingLocationEncounter?.deck.startsWith("research_") ? state.pendingLocationEncounter : undefined;
  const removed = pending?.cardRemovedFromDeck === true;
  if (!Array.isArray(order) || !Array.isArray(discard)
    || pending?.cardRemovedFromDeck !== undefined && !removed) return "Research physical zones are invalid.";
  const physical = [...order, ...discard, ...(removed ? [pending!.cardId] : [])];
  const expected = catalog && new Set(catalog.filter(card => card.deck === deck).map(card => card.id));
  const canonical = new Set(Array.from({ length: 8 }, (_, i) => `encounter_${deck}_0${i + 1}`));
  if (!state.ancientOneId || !physical.length || new Set(physical).size !== physical.length
    || physical.some(id => typeof id !== "string" || !canonical.has(id))
    || expected && (expected.size !== 8 || physical.length !== 8 || physical.some(id => !expected.has(id)))
    || !order.length && !(removed && physical.length === 1)
    || pending && (pending.deck !== deck || !removed && order[0] !== pending.cardId)) {
    return "Research inventory must conserve every selected physical card exactly once.";
  }
  return undefined;
}
