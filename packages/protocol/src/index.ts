import { z } from "zod";

export const locationIds = ["london", "rome", "istanbul", "arkham"] as const;
export const investigatorIds = ["amanda_sharpe", "trish_scarborough"] as const;

export type LocationId = (typeof locationIds)[number];
export type InvestigatorId = (typeof investigatorIds)[number];
export type GamePhase = "lobby" | "action";

export const gameCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SELECT_INVESTIGATOR"), investigatorId: z.enum(investigatorIds) }).strict(),
  z.object({ type: z.literal("START_GAME") }).strict(),
  z.object({ type: z.literal("MOVE"), destinationId: z.enum(locationIds) }).strict(),
  z.object({ type: z.literal("END_TURN") }).strict(),
]);

export type GameCommand = z.infer<typeof gameCommandSchema>;

export type GameEvent =
  | { type: "INVESTIGATOR_SELECTED"; playerId: string; investigatorId: InvestigatorId }
  | { type: "GAME_STARTED"; activePlayerId: string }
  | { type: "INVESTIGATOR_MOVED"; playerId: string; destinationId: LocationId }
  | { type: "TURN_ENDED"; activePlayerId: string };

export interface PublicPlayerState {
  id: string;
  displayName: string;
  connected: boolean;
  investigatorId?: InvestigatorId;
  locationId?: LocationId;
  isHost: boolean;
}

export interface PublicGameState {
  phase: GamePhase;
  activePlayerId?: string;
  turnNumber: number;
  players: PublicPlayerState[];
}

export const joinOptionsSchema = z.object({
  displayName: z.string().trim().min(1).max(32).default("Investigator"),
}).strict();

export const commandMessageType = "command" as const;
export const commandErrorMessageType = "command-error" as const;
export const seatMessageType = "seat" as const;

export interface CommandErrorMessage {
  code: string;
  message: string;
}

export interface SeatMessage {
  playerId: string;
}
