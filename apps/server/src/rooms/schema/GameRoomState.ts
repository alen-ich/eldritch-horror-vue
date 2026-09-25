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
  isHost: t.boolean().default(false),
});
export type PlayerState = SchemaType<typeof PlayerState>;

export const GameRoomState = schema({
  phase: t.string().default("lobby"),
  activePlayerId: t.string().default(""),
  turnNumber: t.uint16().default(0),
  players: t.map(PlayerState),
});
export type GameRoomState = SchemaType<typeof GameRoomState>;
