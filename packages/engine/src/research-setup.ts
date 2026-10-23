import type { CommandResult, EngineContext } from "./index.js";
import type { ResearchEncounterDeckId } from "./setup.js";

export interface ResearchSetupCard { id: string; deck: ResearchEncounterDeckId }
const decks: readonly ResearchEncounterDeckId[] = ["research_azathoth", "research_cthulhu", "research_shub_niggurath", "research_yog_sothoth"];
const canonicalDecks = new Map<string, ResearchEncounterDeckId>(decks.flatMap(deck => Array.from({ length: 8 }, (_, n) => [`encounter_${deck}_0${n + 1}`, deck] as const)));

export function validateResearchSetupCatalog(cards: readonly ResearchSetupCard[]): string | undefined {
  if (!Array.isArray(cards) || cards.length !== 32
    || !Array.from(cards).every(card => card && canonicalDecks.has(card.id) && canonicalDecks.get(card.id) === card.deck)
    || new Set(cards.map(card => card.id)).size !== 32) return "Research setup requires all 32 canonical physical cards in their printed decks.";
  return undefined;
}

export function initializeResearchDeck(cards: readonly ResearchSetupCard[], deck: ResearchEncounterDeckId, shuffle: EngineContext["shuffle"]): string[] {
  const ids = cards.filter(card => card.deck === deck).map(card => card.id);
  const order = shuffle(ids);
  if (!Array.isArray(order) || order.length !== 8 || new Set(order).size !== 8
    || !Array.from(order).every(id => canonicalDecks.get(id) === deck)) throw new Error("Research shuffle must conserve the selected eight physical cards.");
  return [...order];
}

export function withResearchSetupRandomTransaction(context: EngineContext, run: () => CommandResult): CommandResult {
  const checkpoint = context.checkpoint?.();
  try {
    const result = run();
    if (result.ok) checkpoint?.commit(); else checkpoint?.rollback();
    return result;
  } catch {
    checkpoint?.rollback();
    return { ok: false, error: { code: "RANDOM_INPUT_REQUIRED", message: "Research setup requires valid deterministic random input." } };
  }
}
