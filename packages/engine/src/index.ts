import type {
  GameCommand,
  GameEvent,
  GamePhase,
  InvestigatorId,
  LocationId,
} from "@eldritch/protocol";

export interface EnginePlayer {
  id: string;
  investigatorId?: InvestigatorId;
  locationId?: LocationId;
}

export interface GameState {
  phase: GamePhase;
  players: EnginePlayer[];
  activePlayerId?: string;
  turnNumber: number;
}

export type RuleErrorCode =
  | "PLAYER_NOT_FOUND"
  | "WRONG_PHASE"
  | "NOT_HOST"
  | "NOT_ENOUGH_PLAYERS"
  | "INVESTIGATOR_REQUIRED"
  | "INVESTIGATOR_TAKEN"
  | "NOT_ACTIVE_PLAYER"
  | "DESTINATION_NOT_ADJACENT";

export type CommandResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: { code: RuleErrorCode; message: string } };

export const locationGraph: Readonly<Record<LocationId, readonly LocationId[]>> = {
  london: ["rome", "arkham"],
  rome: ["london", "istanbul"],
  istanbul: ["rome", "arkham"],
  arkham: ["london", "istanbul"],
};

export function createLobby(playerIds: string[]): GameState {
  return {
    phase: "lobby",
    players: playerIds.map((id) => ({ id })),
    turnNumber: 0,
  };
}

function failure(code: RuleErrorCode, message: string): CommandResult {
  return { ok: false, error: { code, message } };
}

export function executeCommand(
  state: GameState,
  actorPlayerId: string,
  command: GameCommand,
): CommandResult {
  const actorIndex = state.players.findIndex((player) => player.id === actorPlayerId);
  if (actorIndex < 0) return failure("PLAYER_NOT_FOUND", "The acting player is not in this game.");

  const next: GameState = {
    ...state,
    players: state.players.map((player) => ({ ...player })),
  };
  const actor = next.players[actorIndex]!;

  if (command.type === "SELECT_INVESTIGATOR") {
    if (state.phase !== "lobby") return failure("WRONG_PHASE", "Investigators can only be selected in the lobby.");
    if (state.players.some((player) => player.id !== actorPlayerId && player.investigatorId === command.investigatorId)) {
      return failure("INVESTIGATOR_TAKEN", "That investigator has already been selected.");
    }
    actor.investigatorId = command.investigatorId;
    return {
      ok: true,
      state: next,
      events: [{ type: "INVESTIGATOR_SELECTED", playerId: actorPlayerId, investigatorId: command.investigatorId }],
    };
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
    next.turnNumber = 1;
    next.players = next.players.map((player) => ({ ...player, locationId: "london" }));
    return { ok: true, state: next, events: [{ type: "GAME_STARTED", activePlayerId: actorPlayerId }] };
  }

  if (state.phase !== "action") return failure("WRONG_PHASE", "That action is not available in the lobby.");
  if (state.activePlayerId !== actorPlayerId) return failure("NOT_ACTIVE_PLAYER", "It is not your turn.");

  if (command.type === "MOVE") {
    const current = actor.locationId;
    if (!current || !locationGraph[current].includes(command.destinationId)) {
      return failure("DESTINATION_NOT_ADJACENT", "The destination is not adjacent to the investigator.");
    }
    actor.locationId = command.destinationId;
    return {
      ok: true,
      state: next,
      events: [{ type: "INVESTIGATOR_MOVED", playerId: actorPlayerId, destinationId: command.destinationId }],
    };
  }

  const nextIndex = (actorIndex + 1) % next.players.length;
  next.activePlayerId = next.players[nextIndex]!.id;
  next.turnNumber += 1;
  return { ok: true, state: next, events: [{ type: "TURN_ENDED", activePlayerId: next.activePlayerId }] };
}
