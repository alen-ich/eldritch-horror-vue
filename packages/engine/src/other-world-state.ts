import type { GameContent, GameState } from "./index.js";

function uniqueIds(value: unknown): value is string[] {
  return Array.isArray(value) && Array.from(value).every(id => typeof id === "string" && id.length > 0)
    && new Set(value).size === value.length;
}

/** Validate the current top-bound lifecycle without repairing private inventory.
 * The eventual physical-discard migration must explicitly update this contract. */
export function validateOtherWorldState(state: GameState, content: GameContent): string | undefined {
  const order = state.privateState.deckOrderById["encounter:other_world"];
  const pending = state.pendingLocationEncounter?.deck === "other_world" ? state.pendingLocationEncounter : undefined;
  const revealed = state.currentLocationEncounterCardId;
  const otherWorldRevealed = typeof revealed === "string" && revealed.startsWith("encounter_other_world_");
  if (order === undefined && !pending && !otherWorldRevealed) return undefined;

  const catalog = content.otherWorldEncounterIds;
  if (!uniqueIds(catalog) || !catalog.length || !uniqueIds(order)
    || order.length !== catalog.length || order.some(id => !catalog.includes(id))) {
    return "Other World inventory must contain every known physical card exactly once.";
  }
  if (!pending) return otherWorldRevealed ? "Other World reveal has no bound encounter." : undefined;

  const owner = state.players.find(player => player.id === pending.playerId);
  const gate = content.gates?.find(gate => gate.id === pending.gateId);
  if (state.phase !== "encounter" || state.activePlayerId !== pending.playerId || !owner
    || !pending.gateLocationId || owner.locationId !== pending.gateLocationId
    || !gate || gate.locationId !== pending.gateLocationId
    || order[0] !== pending.cardId || revealed !== pending.cardId
    || pending.gateClosed !== undefined && typeof pending.gateClosed !== "boolean") {
    return "Other World encounter binding is inconsistent.";
  }
  const active = state.activeGateIds ?? [], discard = state.discardedGateIds ?? [];
  const supply = state.privateState.deckOrderById.gates;
  const gateCatalog = content.gates?.map(card => card.id);
  if (!uniqueIds(active) || !uniqueIds(discard) || !uniqueIds(supply) || !uniqueIds(gateCatalog)
    || !gateCatalog.length) return "Other World Gate inventory is invalid.";
  const physical = [...active, ...discard, ...supply];
  if (!uniqueIds(physical) || physical.length !== gateCatalog.length || physical.some(id => !gateCatalog.includes(id))
    || (pending.gateClosed === true ? active.includes(gate.id) : !active.includes(gate.id))) {
    return "Other World bound Gate must remain in its physical zone.";
  }
  return undefined;
}
