import { schema, t, type SchemaType } from "@colyseus/schema";

export const PlayerState = schema({
  id: t.string(),
  displayName: t.string(),
  connected: t.boolean().default(true),
  investigatorId: t.string().default(""),
  locationId: t.string().default(""),
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
