import { expeditionLocationIds, type ExpeditionLocationId, type GameEvent } from "@eldritch/protocol";
import type { CommandResult, EngineContext, GameContent, GameState, RuleErrorCode } from "./index.js";

export interface ExpeditionSetupCard { id: string; locationId: ExpeditionLocationId }
const canonicalLocations = new Map<string, ExpeditionLocationId>(expeditionLocationIds.flatMap(locationId =>
  [1, 2, 3].map(n => [`encounter_expedition_${locationId}_0${n}`, locationId] as const),
));

export function validateExpeditionSetupCatalog(cards: readonly ExpeditionSetupCard[], map: GameContent["map"]): string | undefined {
  if (!Array.isArray(cards) || cards.length !== 18 || new Set(cards.map(card => card?.id)).size !== 18
    || Array.from(cards).some(card => !card || !canonicalLocations.has(card.id) || canonicalLocations.get(card.id) !== card.locationId)
    || expeditionLocationIds.some(site => !map.locationTypes[site])) {
    return "Expedition setup requires all 18 canonical cards and six known board sites.";
  }
  return undefined;
}

export function initializeExpeditionDeck(
  cards: readonly ExpeditionSetupCard[], shuffle: EngineContext["shuffle"],
): { deck: string[]; locationId: ExpeditionLocationId } {
  const deck = shuffle(cards.map(card => card.id));
  if (deck.length !== 18 || new Set(deck).size !== 18 || Array.from(deck).some(id => !canonicalLocations.has(id))) {
    throw new Error("Expedition shuffle must conserve every physical card.");
  }
  return { deck: [...deck], locationId: canonicalLocations.get(deck[0]!)! };
}

/** Legacy snapshots without either field are preserved, never repaired. */
export function validateExpeditionState(state: GameState, content: GameContent): string | undefined {
  const deck = state.privateState.deckOrderById["encounter:expedition"];
  const discard = state.expeditionDiscardIds ?? [];
  const draw = state.privateState.expeditionDraw;
  if (state.expeditionDiscardIds !== undefined && !Array.isArray(state.expeditionDiscardIds)
    || draw !== undefined && (!draw || typeof draw !== "object" || Array.isArray(draw))) return "Invalid Expedition zones.";
  if (deck === undefined && state.activeExpeditionLocationId === undefined && !discard.length && !draw
    && !state.currentLocationEncounterCardId?.startsWith("encounter_expedition_")) return undefined;
  if (!content.expeditionEncounters || validateExpeditionSetupCatalog(content.expeditionEncounters, content.map)
    || !Array.isArray(deck) || !deck.length || state.phase === "lobby"
    || canonicalLocations.get(deck[0]!) !== state.activeExpeditionLocationId) {
    return "Invalid Expedition deck or active location.";
  }
  const physical = [...deck, ...discard, ...(draw ? [draw.cardId] : [])];
  if (physical.length !== 18 || new Set(physical).size !== 18 || physical.some(id => !canonicalLocations.has(id))) return "Invalid Expedition card conservation.";
  if (draw && (Object.keys(draw).length !== 3 || Object.keys(draw).some(key => !["cardId", "playerId", "locationId"].includes(key))
    || canonicalLocations.get(draw.cardId) !== draw.locationId || !state.players.some(player => player.id === draw.playerId)
    || state.currentLocationEncounterCardId !== draw.cardId || state.phase !== "encounter" && !state.gameResult)) return "Invalid Expedition draw binding.";
  if (!draw && state.currentLocationEncounterCardId?.startsWith("encounter_expedition_")) return "Missing Expedition draw binding.";
  return undefined;
}

function rejected(code: RuleErrorCode, message: string): CommandResult { return { ok: false, error: { code, message } }; }
function transition(before: GameState, next: GameState, event: GameEvent): CommandResult {
  next.stateVersion = before.stateVersion + 1;
  return { ok: true, state: next, events: [event] };
}

/** Internal physical draw only. A future encounter handler must preflight effects first. */
export function drawExpeditionCard(state: GameState, playerId: string, content: GameContent, context: EngineContext): CommandResult {
  return withExpeditionSetupRandomTransaction(context, () => {
    if (state.gameResult) return rejected("GAME_ENDED", "The game has ended.");
    if (state.phase !== "encounter" || state.activePlayerId !== playerId) return rejected("WRONG_PHASE", "Only the active Encounter investigator may draw.");
    const player = state.players.find(player => player.id === playerId);
    if (!player) return rejected("PLAYER_NOT_FOUND", "Investigator not found.");
    if (player.defeated || player.eliminated) return rejected("INVESTIGATOR_DEFEATED", "A defeated investigator cannot draw.");
    if (state.privateState.expeditionDraw || state.pendingLocationEncounter || state.pendingDecision || state.activeTest || state.pendingDefeat || state.currentLocationEncounterCardId) {
      return rejected("DECISION_PENDING", "Finish the active encounter or decision before drawing.");
    }
    const invalid = validateExpeditionState(state, content);
    if (invalid || !state.privateState.deckOrderById["encounter:expedition"]) return rejected("ENCOUNTER_CONTENT_MISSING", invalid ?? "The Expedition deck is not initialized.");
    if (player.locationId !== state.activeExpeditionLocationId
      || state.monsters?.some(monster => monster.locationId === player.locationId)
      || player.conditionIds?.some(id => content.conditions?.some(card => card.id === id && card.kind === "detained"))) {
      return rejected("ENCOUNTER_DECK_ILLEGAL", "This investigator cannot encounter the Active Expedition.");
    }
    const next = structuredClone(state);
    let deck = next.privateState.deckOrderById["encounter:expedition"]!;
    const cardId = deck.shift()!;
    next.privateState.expeditionDraw = { cardId, playerId, locationId: state.activeExpeditionLocationId! };
    next.currentLocationEncounterCardId = cardId;
    if (!deck.length) {
      deck = context.shuffle(next.expeditionDiscardIds ?? []);
      next.privateState.deckOrderById["encounter:expedition"] = deck;
      next.expeditionDiscardIds = [];
    }
    next.activeExpeditionLocationId = canonicalLocations.get(deck[0]!);
    const invalidNext = validateExpeditionState(next, content);
    if (invalidNext) return rejected("ENCOUNTER_CONTENT_MISSING", invalidNext);
    return transition(state, next, { type: "EXPEDITION_CARD_DRAWN", playerId, cardId });
  });
}

/** Physical cleanup only, including after an encounter ends through defeat. */
export function discardExpeditionCard(state: GameState, playerId: string, content: GameContent, context: EngineContext): CommandResult {
  return withExpeditionSetupRandomTransaction(context, () => {
    const invalid = validateExpeditionState(state, content);
    if (invalid) return rejected("ENCOUNTER_CONTENT_MISSING", invalid);
    const draw = state.privateState.expeditionDraw;
    if (!draw || draw.playerId !== playerId) return rejected("INVALID_DECISION_SELECTION", "Only the bound investigator can finish this draw.");
    const next = structuredClone(state);
    next.expeditionDiscardIds = [...(next.expeditionDiscardIds ?? []), draw.cardId];
    delete next.privateState.expeditionDraw;
    delete next.currentLocationEncounterCardId;
    next.lastLocationEncounterCardId = draw.cardId;
    return transition(state, next, { type: "EXPEDITION_CARD_DISCARDED", playerId, cardId: draw.cardId });
  });
}

export function withExpeditionSetupRandomTransaction(context: EngineContext, run: () => CommandResult): CommandResult {
  const checkpoint = context.checkpoint?.();
  try {
    const result = run();
    if (result.ok) checkpoint?.commit(); else checkpoint?.rollback();
    return result;
  } catch {
    checkpoint?.rollback();
    return { ok: false, error: { code: "RANDOM_INPUT_REQUIRED", message: "Expedition transitions require valid deterministic random input." } };
  }
}
