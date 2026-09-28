import { schema, t, type SchemaType } from "@colyseus/schema";

export const PlayerState = schema({
  id: t.string(),
  /** Ephemeral connection identity used only to find the client's stable seat. */
  sessionId: t.string(),
  displayName: t.string(),
  connected: t.boolean().default(true),
  delayed: t.boolean().default(false),
  investigatorId: t.string().default(""),
  locationId: t.string().default(""),
  health: t.uint8().default(0),
  sanity: t.uint8().default(0),
  maxHealth: t.uint8().default(0),
  maxSanity: t.uint8().default(0),
  trainTickets: t.uint8().default(0),
  shipTickets: t.uint8().default(0),
  assetIds: t.string().default(""),
  clues: t.uint8().default(0),
  loreImprovement: t.uint8().default(0),
  influenceImprovement: t.uint8().default(0),
  observationImprovement: t.uint8().default(0),
  strengthImprovement: t.uint8().default(0),
  willImprovement: t.uint8().default(0),
  isHost: t.boolean().default(false),
});
export type PlayerState = SchemaType<typeof PlayerState>;

export const PendingDecisionState = schema({
  id: t.string(),
  kind: t.string(),
  playerId: t.string(),
  visibility: t.string(),
  prompt: t.string(),
  optionCount: t.uint8(),
  minSelections: t.uint8(),
  maxSelections: t.uint8(),
  selectionBudget: t.uint8().default(0),
  continuation: t.string().default(""),
});
export type PendingDecisionState = SchemaType<typeof PendingDecisionState>;

export const ActiveTestState = schema({
  id: t.string(),
  playerId: t.string(),
  skill: t.string(),
  modifier: t.int8(),
  dicePool: t.uint8(),
  dice: t.string(),
  successes: t.uint8(),
  successThreshold: t.uint8(),
  continuation: t.string(),
});
export type ActiveTestState = SchemaType<typeof ActiveTestState>;

export const GameRoomState = schema({
  tradeOffer: t.string().default(""),
  stateVersion: t.uint32().default(0),
  phase: t.string().default("lobby"),
  activePlayerId: t.string().default(""),
  leadInvestigatorId: t.string().default(""),
  ancientOneId: t.string().default(""),
  activeMysteryId: t.string().default(""),
  mysteryProgress: t.uint16().default(0),
  mysteryTarget: t.uint16().default(0),
  completedMysteryIds: t.string().default(""),
  gameResult: t.string().default(""),
  turnNumber: t.uint16().default(0),
  actionsRemaining: t.uint8().default(0),
  performedActions: t.string().default(""),
  reserveAssetIds: t.string().default(""),
  assetDiscardIds: t.string().default(""),
  pendingDecision: t.ref(PendingDecisionState).optional(),
  activeTest: t.ref(ActiveTestState).optional(),
  players: t.map(PlayerState),
});
export type GameRoomState = SchemaType<typeof GameRoomState>;
