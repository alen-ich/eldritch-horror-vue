import type { GameState, GameContent, EngineContext } from "./index.js";
import { buildLocationEncounterDecks, locationEncounterDeckIds, type LocationEncounterDeckId } from "./setup.js";

function uniqueIds(value: unknown): value is string[] {
  return Array.isArray(value) && Array.from(value).every(id => typeof id === "string" && id.length > 0)
    && new Set(value).size === value.length;
}
export function isLocationDeck(deck: string): deck is LocationEncounterDeckId {
  return locationEncounterDeckIds.some(id => id === deck);
}
/** Optional untouched legacy snapshots remain absent; initialized zones are never repaired. */
export function validateLocationState(state: GameState, content: GameContent): string | undefined {
  const discards = state.locationDiscardIdsByDeck;
  if (discards !== undefined && (!discards || typeof discards !== "object" || Array.isArray(discards)
    || Object.keys(discards).some(key => !isLocationDeck(key)))) return "Location discard zones are invalid.";
  let configured: Record<LocationEncounterDeckId, string[]> | undefined;
  if (content.locationEncounterSetup !== undefined) {
    try { configured = buildLocationEncounterDecks(content.locationEncounterSetup, ids => [...ids]); }
    catch { return "Location physical catalog is invalid."; }
  }
  const active = state.pendingLocationEncounter;
  const pending = active && isLocationDeck(active.deck) ? active : undefined;
  if (pending?.cardRemovedFromDeck !== undefined && pending.cardRemovedFromDeck !== true) return "Location removed-card flag is invalid.";
  const initialized = locationEncounterDeckIds.some(deck => state.privateState.deckOrderById[`encounter:${deck}`] !== undefined);
  const allPhysical: string[] = [];
  for (const deck of locationEncounterDeckIds) {
    const order = state.privateState.deckOrderById[`encounter:${deck}`];
    const discarded = discards?.[deck] === undefined ? [] : discards[deck];
    const bound = pending?.deck === deck ? pending : undefined;
    const removed = bound?.cardRemovedFromDeck === true;
    if (order === undefined && !bound && uniqueIds(discarded) && !discarded.length && !(configured && initialized)) continue;
    if (!uniqueIds(order) || !uniqueIds(discarded)) return "Location physical zones are invalid.";
    const physical = [...order, ...discarded, ...(removed ? [bound!.cardId] : [])];
    const expected = configured?.[deck];
    const known = (id: string) => content.locationEncounters?.some(card => card.id === id && card.deck === deck)
      || Array.from({ length: deck === "general" ? 12 : 8 }, (_, n) => `encounter_${deck}_${String(n + 1).padStart(2, "0")}`).includes(id);
    if (!physical.length || !uniqueIds(physical) || physical.some(id => expected ? !expected.includes(id) : !known(id))
      || expected && physical.length !== expected.length
      || !order.length && !(removed && physical.length === 1)
      || bound && !removed && order[0] !== bound.cardId) return "Location inventory must conserve every physical card exactly once.";
    allPhysical.push(...physical);
  }
  return new Set(allPhysical).size === allPhysical.length ? undefined : "Location cards cannot occupy multiple families.";
}
function shuffleCards(ids: readonly string[], context: EngineContext): string[] {
  const shuffled = context.shuffle([...ids]);
  if (!uniqueIds(shuffled) || shuffled.length !== ids.length || shuffled.some(id => !ids.includes(id))) throw new Error("Invalid physical Location shuffle.");
  return [...shuffled];
}
/** Caller owns a cloned state inside the Location RNG transaction. */
export function removeLocationEncounterCard(state: GameState, content: GameContent, context: EngineContext): string | undefined {
  const pending = state.pendingLocationEncounter;
  if (!pending || !isLocationDeck(pending.deck)) return undefined;
  const invalid = validateLocationState(state, content);
  if (invalid || pending.cardRemovedFromDeck) return invalid;
  const order = state.privateState.deckOrderById[`encounter:${pending.deck}`]!;
  order.shift(); pending.cardRemovedFromDeck = true;
  state.locationDiscardIdsByDeck ??= {};
  const discarded = state.locationDiscardIdsByDeck[pending.deck] ??= [];
  if (!order.length && discarded.length) {
    state.privateState.deckOrderById[`encounter:${pending.deck}`] = shuffleCards(discarded, context);
    state.locationDiscardIdsByDeck[pending.deck] = [];
  }
  return validateLocationState(state, content);
}
/** Caller clears reveal/binding immediately after completion. */
export function finishLocationEncounterCard(state: GameState, content: GameContent, context: EngineContext): string | undefined {
  const invalid = validateLocationState(state, content), pending = state.pendingLocationEncounter;
  if (invalid) return invalid;
  if (!pending || !isLocationDeck(pending.deck) || !pending.cardRemovedFromDeck) return "Location completion requires its removed card.";
  const discards = state.locationDiscardIdsByDeck ??= {};
  discards[pending.deck] = [...(discards[pending.deck] ?? []), pending.cardId];
  if (!state.privateState.deckOrderById[`encounter:${pending.deck}`]!.length) {
    state.privateState.deckOrderById[`encounter:${pending.deck}`] = shuffleCards(discards[pending.deck]!, context);
    discards[pending.deck] = [];
  }
  return undefined;
}
