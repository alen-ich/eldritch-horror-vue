import { z } from "zod";

export const locationIds = [
  "san_francisco", "arkham", "buenos_aires", "london", "rome", "istanbul",
  "shanghai", "sydney", "tokyo", "the_amazon", "the_pyramids",
  "the_heart_of_africa", "the_himalayas", "tunguska", "antarctica",
  "space_1", "space_2", "space_3", "space_4", "space_5", "space_6",
  "space_7", "space_8", "space_9", "space_10", "space_11", "space_12",
  "space_13", "space_14", "space_15", "space_16", "space_17", "space_18",
  "space_19", "space_20", "space_21",
] as const;
export const investigatorIds = [
  "akachi_onyele", "charlie_kane", "diana_stanley", "jacqueline_fine",
  "jim_culver", "leo_anderson", "lily_chen", "lola_hayes", "mark_harrigan",
  "norman_withers", "silas_marsh", "trish_scarborough",
] as const;

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
  health?: number;
  sanity?: number;
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

export interface CommandErrorMessage {
  code: string;
  message: string;
}
