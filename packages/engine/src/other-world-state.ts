import type { EngineContext, GameContent, GameState } from "./index.js";

function uniqueIds(value: unknown): value is string[] {
  return Array.isArray(value) && Array.from(value).every(id => typeof id === "string" && id.length > 0)
    && new Set(value).size === value.length;
}

/** Validate physical zones, including legacy top-bound continuations, without repair. */
export function validateOtherWorldState(state: GameState, content: GameContent): string | undefined {
  const order = state.privateState.deckOrderById["encounter:other_world"];
  const pending = state.pendingLocationEncounter?.deck === "other_world" ? state.pendingLocationEncounter : undefined;
  const revealed = state.currentLocationEncounterCardId;
  const otherWorldRevealed = typeof revealed === "string" && revealed.startsWith("encounter_other_world_");
  const discarded = state.otherWorldDiscardIds ?? [];
  if (state.otherWorldDiscardIds !== undefined && !uniqueIds(state.otherWorldDiscardIds)) return "Other World discard inventory is invalid.";
  if (order === undefined && !pending && !otherWorldRevealed && !discarded.length) return undefined;

  const catalog = content.otherWorldEncounterIds;
  const removed = pending?.cardRemovedFromDeck === true;
  if (pending?.cardRemovedFromDeck !== undefined && !removed) return "Other World removed-card flag is invalid.";
  const physical = [...(Array.isArray(order) ? order : []), ...discarded, ...(removed ? [pending!.cardId] : [])];
  if (!uniqueIds(catalog) || !catalog.length || !uniqueIds(order)
    || !uniqueIds(physical) || physical.length !== catalog.length || physical.some(id => !catalog.includes(id))
    || !order.length && !(removed && catalog.length === 1)
    || pending && !removed && (discarded.length > 0 || order[0] !== pending.cardId)) {
    return "Other World inventory must contain every known physical card exactly once.";
  }
  if (!pending) return otherWorldRevealed ? "Other World reveal has no bound encounter." : undefined;

  const owner = state.players.find(player => player.id === pending.playerId);
  const gate = content.gates?.find(gate => gate.id === pending.gateId);
  if (state.phase !== "encounter" || state.activePlayerId !== pending.playerId || !owner
    || !pending.gateLocationId || owner.locationId !== pending.gateLocationId
    || !gate || gate.locationId !== pending.gateLocationId
    || revealed !== pending.cardId
    || pending.gateClosed !== undefined && typeof pending.gateClosed !== "boolean") {
    return "Other World encounter binding is inconsistent.";
  }
  const active = state.activeGateIds ?? [], discard = state.discardedGateIds ?? [];
  const supply = state.privateState.deckOrderById.gates;
  const gateCatalog = content.gates?.map(card => card.id);
  if (!uniqueIds(active) || !uniqueIds(discard) || !uniqueIds(supply) || !uniqueIds(gateCatalog)
    || !gateCatalog.length) return "Other World Gate inventory is invalid.";
  const physicalGates = [...active, ...discard, ...supply];
  if (!uniqueIds(physicalGates) || physicalGates.length !== gateCatalog.length || physicalGates.some(id => !gateCatalog.includes(id))
    || (pending.gateClosed === true ? active.includes(gate.id) : !active.includes(gate.id))) {
    return "Other World bound Gate must remain in its physical zone.";
  }
  return undefined;
}

/** Caller owns a clone and an RNG transaction; legacy active cards migrate once. */
export function removeOtherWorldEncounterCard(state: GameState, content: GameContent, context: EngineContext): string | undefined {
  const pending = state.pendingLocationEncounter;
  if (pending?.deck !== "other_world" || pending.cardRemovedFromDeck) return undefined;
  const order = state.privateState.deckOrderById["encounter:other_world"]!;
  if (order[0] !== pending.cardId) return "Other World legacy card is no longer on top.";
  order.shift();
  pending.cardRemovedFromDeck = true;
  state.otherWorldDiscardIds ??= [];
  if (!order.length && state.otherWorldDiscardIds.length) {
    state.privateState.deckOrderById["encounter:other_world"] = context.shuffle(state.otherWorldDiscardIds);
    state.otherWorldDiscardIds = [];
  }
  return validateOtherWorldState(state, content);
}
