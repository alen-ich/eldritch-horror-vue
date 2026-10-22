import type { GameContent, GameState } from "./index.js";
import { validateResearchSetupCatalog } from "./research-setup.js";

/** Configured physical catalogs cannot silently fall back to partial rule fixtures. */
export function validateResearchDrawInventory(state: GameState, content: GameContent): string | undefined {
  const catalog = content.researchEncounterSetup;
  if (catalog === undefined) return undefined;
  if (validateResearchSetupCatalog(catalog)) return "Research physical catalog is invalid.";
  const deck = `research_${state.ancientOneId}`;
  const expected = new Set(catalog.filter(card => card.deck === deck).map(card => card.id));
  const order = state.privateState.deckOrderById[`encounter:${deck}`];
  if (expected.size !== 8 || !Array.isArray(order) || order.length !== expected.size
    || new Set(order).size !== expected.size || !Array.from(order).every(id => expected.has(id))) {
    return "Research inventory must contain the selected eight physical cards exactly once.";
  }
  return undefined;
}
