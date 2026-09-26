import type {
  GameCommand,
  GameEvent,
  GamePhase,
  InvestigatorId,
  LocationId,
  TravelTicketType,
} from "@eldritch/protocol";

export type ActionType = "travel" | "rest" | "prepare_travel" | "trade" | "acquire_assets" | "component";

export interface EnginePlayer {
  id: string;
  investigatorId?: InvestigatorId;
  locationId?: LocationId;
  health?: number;
  sanity?: number;
  maxHealth?: number;
  maxSanity?: number;
  travelTickets?: TravelTicketType[];
}

export interface GameState {
  stateVersion: number;
  phase: GamePhase;
  players: EnginePlayer[];
  activePlayerId?: string;
  leadInvestigatorId?: string;
  turnNumber: number;
  actionsRemaining: number;
  performedActions: ActionType[];
  monsterLocationIds: LocationId[];
}

export interface GameMap {
  adjacentLocationIds: Readonly<Partial<Record<LocationId, readonly LocationId[]>>>;
  routes: readonly { source: LocationId; target: LocationId; type: "train" | "ship" | "uncharted" }[];
  locationTypes: Readonly<Partial<Record<LocationId, "city" | "wilderness" | "sea">>>;
}

export interface InvestigatorSetup {
  startingLocationId: LocationId;
  health: number;
  sanity: number;
}

export interface GameContent {
  map: GameMap;
  investigators: Readonly<Partial<Record<InvestigatorId, InvestigatorSetup>>>;
}

export type RuleErrorCode =
  | "PLAYER_NOT_FOUND"
  | "WRONG_PHASE"
  | "NOT_HOST"
  | "NOT_ENOUGH_PLAYERS"
  | "INVESTIGATOR_REQUIRED"
  | "INVESTIGATOR_CONTENT_MISSING"
  | "INVESTIGATOR_TAKEN"
  | "NOT_ACTIVE_PLAYER"
  | "ACTION_ALREADY_PERFORMED"
  | "NO_ACTIONS_REMAINING"
  | "DESTINATION_NOT_ADJACENT"
  | "TRAVEL_TICKET_REQUIRED"
  | "REST_BLOCKED_BY_MONSTER"
  | "CITY_REQUIRED"
  | "ROUTE_TYPE_REQUIRED"
  | "TRAVEL_TICKET_LIMIT";

export type CommandResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: { code: RuleErrorCode; message: string } };

export function createLobby(playerIds: string[]): GameState {
  return {
    stateVersion: 0,
    phase: "lobby",
    players: playerIds.map((id) => ({ id })),
    turnNumber: 0,
    actionsRemaining: 0,
    performedActions: [],
    monsterLocationIds: [],
  };
}

function failure(code: RuleErrorCode, message: string): CommandResult {
  return { ok: false, error: { code, message } };
}

function success(state: GameState, events: GameEvent[]): CommandResult {
  state.stateVersion += 1;
  return { ok: true, state, events };
}

function routeBetween(map: GameMap, source: LocationId, target: LocationId) {
  return map.routes.find((route) => (route.source === source && route.target === target) || (route.source === target && route.target === source));
}

function advanceActionInvestigator(state: GameState, actorIndex: number, events: GameEvent[]): void {
  const nextIndex = actorIndex + 1;
  if (nextIndex < state.players.length) {
    state.activePlayerId = state.players[nextIndex]!.id;
    state.actionsRemaining = 2;
    state.performedActions = [];
    return;
  }
  state.phase = "encounter";
  state.activePlayerId = state.leadInvestigatorId;
  state.actionsRemaining = 0;
  state.performedActions = [];
  events.push({ type: "PHASE_ADVANCED", phase: "encounter", activePlayerId: state.activePlayerId });
}

function completeAction(state: GameState, actorIndex: number, action: ActionType, events: GameEvent[]): void {
  state.performedActions.push(action);
  state.actionsRemaining -= 1;
  if (state.actionsRemaining === 0) advanceActionInvestigator(state, actorIndex, events);
}

export function executeCommand(
  state: GameState,
  actorPlayerId: string,
  command: GameCommand,
  content: GameContent,
): CommandResult {
  const actorIndex = state.players.findIndex((player) => player.id === actorPlayerId);
  if (actorIndex < 0) return failure("PLAYER_NOT_FOUND", "The acting player is not in this game.");

  const next: GameState = {
    ...state,
    players: state.players.map((player) => ({ ...player })),
    performedActions: [...state.performedActions],
    monsterLocationIds: [...state.monsterLocationIds],
  };
  const actor = next.players[actorIndex]!;

  if (command.type === "SELECT_INVESTIGATOR") {
    if (state.phase !== "lobby") return failure("WRONG_PHASE", "Investigators can only be selected in the lobby.");
    if (state.players.some((player) => player.id !== actorPlayerId && player.investigatorId === command.investigatorId)) {
      return failure("INVESTIGATOR_TAKEN", "That investigator has already been selected.");
    }
    actor.investigatorId = command.investigatorId;
    return success(next, [
      { type: "INVESTIGATOR_SELECTED", playerId: actorPlayerId, investigatorId: command.investigatorId },
    ]);
  }

  if (command.type === "START_GAME") {
    if (state.phase !== "lobby") return failure("WRONG_PHASE", "The game has already started.");
    if (state.players[0]?.id !== actorPlayerId) return failure("NOT_HOST", "Only the host can start the game.");
    if (state.players.length < 2) return failure("NOT_ENOUGH_PLAYERS", "At least two players are required.");
    if (state.players.some((player) => !player.investigatorId)) {
      return failure("INVESTIGATOR_REQUIRED", "Every player must select an investigator.");
    }
    next.phase = "action";
    next.activePlayerId = actorPlayerId;
    next.leadInvestigatorId = actorPlayerId;
    next.turnNumber = 1;
    next.actionsRemaining = 2;
    next.performedActions = [];
    for (const player of next.players) {
      const setup = content.investigators[player.investigatorId!];
      if (!setup) return failure("INVESTIGATOR_CONTENT_MISSING", "The selected investigator has no setup data.");
      player.locationId = setup.startingLocationId;
      player.health = setup.health;
      player.sanity = setup.sanity;
      player.maxHealth = setup.health;
      player.maxSanity = setup.sanity;
      player.travelTickets = [];
    }
    return success(next, [{ type: "GAME_STARTED", activePlayerId: actorPlayerId }]);
  }

  if (state.phase !== "action") return failure("WRONG_PHASE", "That action is not available in the lobby.");
  if (state.activePlayerId !== actorPlayerId) return failure("NOT_ACTIVE_PLAYER", "It is not your turn.");
  if (state.actionsRemaining < 1 && command.type !== "END_ACTIONS") return failure("NO_ACTIONS_REMAINING", "This investigator has no actions remaining.");

  if (command.type === "TRAVEL") {
    if (state.performedActions.includes("travel")) return failure("ACTION_ALREADY_PERFORMED", "Travel can be performed only once per round.");
    let current = actor.locationId;
    if (!current) return failure("DESTINATION_NOT_ADJACENT", "The investigator has no current location.");
    const tickets = [...(actor.travelTickets ?? [])];
    const spentTickets: TravelTicketType[] = [];
    for (const [index, destinationId] of command.destinationIds.entries()) {
      const route = routeBetween(content.map, current, destinationId);
      if (!route) return failure("DESTINATION_NOT_ADJACENT", "Every travel step must lead to an adjacent space.");
      if (index > 0) {
        if (route.type === "uncharted") return failure("TRAVEL_TICKET_REQUIRED", "Travel tickets cannot be spent on an uncharted path.");
        const ticketIndex = tickets.indexOf(route.type);
        if (ticketIndex < 0) return failure("TRAVEL_TICKET_REQUIRED", `A ${route.type} ticket is required for that additional movement.`);
        tickets.splice(ticketIndex, 1);
        spentTickets.push(route.type);
      }
      current = destinationId;
    }
    actor.locationId = current;
    actor.travelTickets = tickets;
    const events: GameEvent[] = [{ type: "INVESTIGATOR_TRAVELED", playerId: actorPlayerId, destinationId: current, spentTickets }];
    completeAction(next, actorIndex, "travel", events);
    return success(next, events);
  }

  if (command.type === "REST") {
    if (state.performedActions.includes("rest")) return failure("ACTION_ALREADY_PERFORMED", "Rest can be performed only once per round.");
    if (actor.locationId && state.monsterLocationIds.includes(actor.locationId)) return failure("REST_BLOCKED_BY_MONSTER", "An investigator cannot rest on a space containing a Monster.");
    actor.health = Math.min(actor.maxHealth ?? actor.health ?? 0, (actor.health ?? 0) + 1);
    actor.sanity = Math.min(actor.maxSanity ?? actor.sanity ?? 0, (actor.sanity ?? 0) + 1);
    const events: GameEvent[] = [{ type: "INVESTIGATOR_RESTED", playerId: actorPlayerId, health: actor.health, sanity: actor.sanity }];
    completeAction(next, actorIndex, "rest", events);
    return success(next, events);
  }

  if (command.type === "PREPARE_TRAVEL") {
    if (state.performedActions.includes("prepare_travel")) return failure("ACTION_ALREADY_PERFORMED", "Prepare for Travel can be performed only once per round.");
    if (!actor.locationId || content.map.locationTypes[actor.locationId] !== "city") return failure("CITY_REQUIRED", "Prepare for Travel requires a City space.");
    if (!content.map.routes.some((route) => route.type === command.ticketType && (route.source === actor.locationId || route.target === actor.locationId))) {
      return failure("ROUTE_TYPE_REQUIRED", `This City has no connected ${command.ticketType} path.`);
    }
    if ((actor.travelTickets?.length ?? 0) >= 2) return failure("TRAVEL_TICKET_LIMIT", "An investigator cannot have more than two travel tickets.");
    actor.travelTickets = [...(actor.travelTickets ?? []), command.ticketType];
    const events: GameEvent[] = [{ type: "TRAVEL_TICKET_GAINED", playerId: actorPlayerId, ticketType: command.ticketType }];
    completeAction(next, actorIndex, "prepare_travel", events);
    return success(next, events);
  }

  const events: GameEvent[] = [{ type: "ACTIONS_ENDED", playerId: actorPlayerId }];
  advanceActionInvestigator(next, actorIndex, events);
  return success(next, events);
}
