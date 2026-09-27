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
export const ancientOneIds = ["cthulhu", "shub_niggurath", "yog_sothoth", "azathoth"] as const;

export type LocationId = (typeof locationIds)[number];
export type InvestigatorId = (typeof investigatorIds)[number];
export type AncientOneId = (typeof ancientOneIds)[number];
export type GamePhase = "lobby" | "action" | "encounter" | "mythos";
export type TravelTicketType = "train" | "ship";
export const pendingDecisionKinds = [
  "select_rerolls",
  "choose_encounter",
  "choose_monster_order",
  "spend_clues",
  "select_acquired_cards",
] as const;
export type PendingDecisionKind = (typeof pendingDecisionKinds)[number];

export const pendingDecisionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(pendingDecisionKinds),
  playerId: z.string().min(1),
  visibility: z.enum(["public", "owner"]),
  prompt: z.string().min(1),
  optionIds: z.array(z.string().min(1)).min(1),
  minSelections: z.number().int().nonnegative(),
  maxSelections: z.number().int().positive(),
}).strict().superRefine((decision, context) => {
  if (new Set(decision.optionIds).size !== decision.optionIds.length) {
    context.addIssue({ code: "custom", message: "Decision option IDs must be unique.", path: ["optionIds"] });
  }
  if (decision.minSelections > decision.maxSelections) {
    context.addIssue({ code: "custom", message: "Minimum selections cannot exceed maximum selections.", path: ["minSelections"] });
  }
  if (decision.maxSelections > decision.optionIds.length) {
    context.addIssue({ code: "custom", message: "Maximum selections cannot exceed the option count.", path: ["maxSelections"] });
  }
});

export type PendingDecision = z.infer<typeof pendingDecisionSchema>;

export interface PendingDecisionSummary {
  id: string;
  kind: PendingDecisionKind;
  playerId: string;
  visibility: PendingDecision["visibility"];
  prompt: string;
  optionCount: number;
  minSelections: number;
  maxSelections: number;
}

export const gameCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SELECT_INVESTIGATOR"), investigatorId: z.enum(investigatorIds) }).strict(),
  z.object({ type: z.literal("SELECT_ANCIENT_ONE"), ancientOneId: z.enum(ancientOneIds) }).strict(),
  z.object({ type: z.literal("START_GAME") }).strict(),
  z.object({ type: z.literal("TRAVEL"), destinationIds: z.array(z.enum(locationIds)).min(1).max(3) }).strict(),
  z.object({ type: z.literal("REST") }).strict(),
  z.object({ type: z.literal("PREPARE_TRAVEL"), ticketType: z.enum(["train", "ship"]) }).strict(),
  z.object({ type: z.literal("END_ACTIONS") }).strict(),
  z.object({
    type: z.literal("RESOLVE_DECISION"),
    decisionId: z.string().min(1),
    selectedOptionIds: z.array(z.string().min(1)).max(20),
  }).strict(),
]);

export type GameCommand = z.infer<typeof gameCommandSchema>;

export const gameCommandMessageSchema = z.object({
  expectedStateVersion: z.number().int().nonnegative(),
  command: gameCommandSchema,
}).strict();

export type GameCommandMessage = z.infer<typeof gameCommandMessageSchema>;

export type GameEvent =
  | { type: "INVESTIGATOR_SELECTED"; playerId: string; investigatorId: InvestigatorId }
  | { type: "ANCIENT_ONE_SELECTED"; ancientOneId: AncientOneId }
  | { type: "GAME_STARTED"; activePlayerId: string }
  | { type: "MYSTERY_REVEALED"; mysteryId: string }
  | { type: "INVESTIGATOR_TRAVELED"; playerId: string; destinationId: LocationId; spentTickets: TravelTicketType[] }
  | { type: "INVESTIGATOR_RESTED"; playerId: string; health: number; sanity: number }
  | { type: "TRAVEL_TICKET_GAINED"; playerId: string; ticketType: TravelTicketType }
  | { type: "ACTIONS_ENDED"; playerId: string }
  | { type: "DECISION_RESOLVED"; decisionId: string; playerId: string; selectedOptionIds: string[] }
  | { type: "PHASE_ADVANCED"; phase: GamePhase; activePlayerId?: string };

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
  stateVersion: number;
  phase: GamePhase;
  activePlayerId?: string;
  turnNumber: number;
  ancientOneId?: AncientOneId;
  activeMysteryId?: string;
  completedMysteryIds: string[];
  players: PublicPlayerState[];
}

export const joinOptionsSchema = z.object({
  displayName: z.string().trim().min(1).max(32).default("Investigator"),
}).strict();

export const commandMessageType = "command" as const;
export const commandErrorMessageType = "command-error" as const;
export const pendingDecisionMessageType = "pending-decision" as const;

export interface CommandErrorMessage {
  code: string;
  message: string;
}
