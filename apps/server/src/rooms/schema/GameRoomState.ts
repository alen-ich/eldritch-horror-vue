import { schema, t, type SchemaType } from "@colyseus/schema";

export const PlayerState = schema({
  id: t.string(),
  /** Ephemeral connection identity used only to find the client's stable seat. */
  sessionId: t.string(),
  displayName: t.string(),
  connected: t.boolean().default(true),
  investigatorId: t.string().default(""),
  locationId: t.string().default(""),
  health: t.uint8().default(0),
  sanity: t.uint8().default(0),
  maxHealth: t.uint8().default(0),
  maxSanity: t.uint8().default(0),
  trainTickets: t.uint8().default(0),
  shipTickets: t.uint8().default(0),
  isHost: t.boolean().default(false),
});
export type PlayerState = SchemaType<typeof PlayerState>;

export const GameRoomState = schema({
  stateVersion: t.uint32().default(0),
  phase: t.string().default("lobby"),
  activePlayerId: t.string().default(""),
  leadInvestigatorId: t.string().default(""),
  turnNumber: t.uint16().default(0),
  actionsRemaining: t.uint8().default(0),
  performedActions: t.string().default(""),
  players: t.map(PlayerState),
});
export type GameRoomState = SchemaType<typeof GameRoomState>;
