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
export const skillIds = ["lore", "influence", "observation", "strength", "will"] as const;
export const conditionKindIds = ["debt", "amnesia", "dark_pact", "leg_injury", "internal_injury", "paranoia", "cursed", "hallucinations", "detained", "blessed", "back_injury"] as const;

export type LocationId = (typeof locationIds)[number];
export type InvestigatorId = (typeof investigatorIds)[number];
export type AncientOneId = (typeof ancientOneIds)[number];
export type SkillId = (typeof skillIds)[number];
export type GamePhase = "lobby" | "action" | "encounter" | "mythos";
export type TravelTicketType = "train" | "ship";
export const pendingDecisionKinds = [
  "select_rerolls",
  "choose_encounter",
  "choose_monster_order",
  "spend_clues",
  "select_acquired_cards",
  "discard_reserve_card",
  "recover_conditions",
  "rest_asset_choice",
  "choose_omen_space",
  "choose_world_fights_back",
  "trade_debt_for_condition",
  "choose_desperate_times",
  "choose_that_which_consumes_gate",
  "choose_blood_flows_monster",
  "choose_tide_of_despair",
  "choose_unexpected_betrayal_ally",
  "choose_heat_wave",
  "encounter_choice",
  "artifact_target",
] as const;
export type PendingDecisionKind = (typeof pendingDecisionKinds)[number];

export const pendingDecisionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(pendingDecisionKinds),
  playerId: z.string().min(1),
  visibility: z.enum(["public", "owner"]),
  prompt: z.string().min(1),
  optionIds: z.array(z.string().min(1)).min(1),
  optionLabels: z.record(z.string(), z.string().min(1)).optional(),
  minSelections: z.number().int().nonnegative(),
  maxSelections: z.number().int().positive(),
  selectionBudget: z.number().int().nonnegative().optional(),
  continuation: z.enum(["test_reroll", "acquire_assets_purchase", "acquire_assets_discard", "condition_rest_recovery", "witch_doctor_rest", "rest_asset_effect", "mythos_omen_choice", "mythos_world_fights_back", "mythos_debt_trade", "mythos_desperate_times", "mythos_that_which_consumes", "mythos_heat_wave", "mythos_blood_flows", "mythos_tide_of_despair", "mythos_unexpected_betrayal", "location_encounter_choice"]).optional(),
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
  if (decision.optionLabels && Object.keys(decision.optionLabels).some(id => !decision.optionIds.includes(id))) {
    context.addIssue({ code: "custom", message: "Option labels must refer to available options.", path: ["optionLabels"] });
  }
});

export type PendingDecision = z.infer<typeof pendingDecisionSchema>;

export const tradeBundleSchema = z.object({
  assetIds: z.array(z.string().min(1)).max(40),
  clues: z.number().int().min(0).max(255),
  tickets: z.array(z.enum(["train", "ship"])).max(2),
}).strict();
export type TradeBundle = z.infer<typeof tradeBundleSchema>;
export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  give: TradeBundle;
  receive: TradeBundle;
}

export interface ActiveTest {
  id: string;
  playerId: string;
  skill: SkillId;
  modifier: number;
  dicePool: number;
  dice: number[];
  successes: number;
  successThreshold: number;
  /** Physical Asset reroll sources already consumed for this test. */
  usedRerollAssetIds?: string[];
  continuation: "acquire_assets" | "condition_action" | "condition_reckoning" | "location_encounter" | "artifact_action" | "rest_asset";
  sourceArtifactId?: string;
  sourceConditionId?: string;
  sourceEncounterCardId?: string;
  sourceEncounterDeck?: "general" | "america" | "europe" | "asia_australia" | "research_azathoth" | "research_cthulhu" | "research_shub_niggurath" | "research_yog_sothoth";
}

export interface PendingDecisionSummary {
  id: string;
  kind: PendingDecisionKind;
  playerId: string;
  visibility: PendingDecision["visibility"];
  prompt: string;
  optionCount: number;
  minSelections: number;
  maxSelections: number;
  selectionBudget?: number;
  continuation?: PendingDecision["continuation"];
}

export const gameCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("RESOLVE_DEFEAT"), cityId: z.enum(locationIds), cause: z.enum(["health", "sanity"]), leadPlayerId: z.string().optional() }).strict(),
  z.object({ type: z.literal("REPLACE_INVESTIGATOR"), investigatorId: z.enum(investigatorIds) }).strict(),
  z.object({ type: z.literal("OFFER_TRADE"), targetPlayerId: z.string().min(1), give: tradeBundleSchema, receive: tradeBundleSchema }).strict(),
  z.object({ type: z.literal("ANSWER_TRADE"), offerId: z.string().min(1), accept: z.boolean() }).strict(),
  z.object({ type: z.literal("SELECT_INVESTIGATOR"), investigatorId: z.enum(investigatorIds) }).strict(),
  z.object({ type: z.literal("SELECT_ANCIENT_ONE"), ancientOneId: z.enum(ancientOneIds) }).strict(),
  z.object({ type: z.literal("START_GAME") }).strict(),
  z.object({ type: z.literal("TRAVEL"), destinationIds: z.array(z.enum(locationIds)).min(1).max(3) }).strict(),
  z.object({ type: z.literal("REST") }).strict(),
  z.object({ type: z.literal("PREPARE_TRAVEL"), ticketType: z.enum(["train", "ship"]) }).strict(),
  z.object({ type: z.literal("ACQUIRE_ASSETS") }).strict(),
  z.object({ type: z.literal("USE_CONDITION_ACTION"), targetPlayerId: z.string().min(1), conditionKind: z.enum(conditionKindIds) }).strict(),
  z.object({ type: z.literal("USE_ARTIFACT_ACTION"), artifactId: z.literal("artifact_ttka_halot") }).strict(),
  z.object({ type: z.literal("USE_INVESTIGATOR_ACTION") }).strict(),
  z.object({ type: z.literal("END_ACTIONS") }).strict(),
  z.object({ type: z.literal("ADVANCE_MYTHOS") }).strict(),
  z.object({ type: z.literal("BEGIN_NEXT_ROUND") }).strict(),
  z.object({ type: z.literal("RESOLVE_LOCATION_ENCOUNTER"), deck: z.enum(["general", "america", "europe", "asia_australia"]) }).strict(),
  z.object({ type: z.literal("RESOLVE_RESEARCH_ENCOUNTER"), clueId: z.string().min(1).max(128) }).strict(),
  z.object({ type: z.literal("FIGHT_MONSTER"), monsterInstanceId: z.string().min(1) }).strict(),
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
  | { type: "LOCATION_ENCOUNTER_RESOLVED"; playerId: string; cardId: string; deck: "general" | "america" | "europe" | "asia_australia"; dice: number[]; successes: number }
  | { type: "RESEARCH_ENCOUNTER_RESOLVED"; playerId: string; cardId: string; deck: "research_azathoth" | "research_cthulhu" | "research_shub_niggurath" | "research_yog_sothoth"; dice: number[]; successes: number }
  | { type: "MYTHOS_CARD_REVEALED"; cardId: string }
  | { type: "BERMUDA_TRIANGLE_ROLLED"; playerId: string; die: number; moved: boolean }
  | { type: "CONDITION_BACK_RESOLVED"; playerId: string; conditionId: string; effect: "discard" | "recover_health_and_sanity_then_flip_front" | "gain_clues_then_flip_front" | "become_delayed_then_flip_front" | "discard_all_clues_then_discard" }
  | { type: "CONDITION_RECKONING_ROLLED"; playerId: string; conditionId: string; die: number; discarded: boolean }
  | { type: "CONDITION_RECOVERY_ROLLED"; playerId: string; conditionId: string; die: number; discarded: boolean }
  | { type: "CONDITION_GAIN_PREVENTED"; playerId: string; kind: string }
  | { type: "CONDITION_GAINED" | "CONDITION_DISCARDED"; playerId: string; conditionId: string }
  | { type: "COMBAT_RESOLVED"; playerId: string; monsterInstanceId: string; horrorDice: number[]; strengthDice: number[]; sanityLost: number; healthLost: number; monsterHealthLost: number }
  | { type: "MONSTER_DEFEATED"; monsterInstanceId: string; monsterId: string }
  | { type: "DOOM_RETREATED"; amount: number; doom: number }
  | { type: "NAMED_MONSTER_AMBUSH_RESOLVED"; playerId: string; monsterId: string; successes: number; healthLost: number; defeated: boolean }
  | { type: "MONSTER_DISCARDED"; monsterInstanceId: string; monsterId: string }
  | { type: "MONSTER_SPAWNED"; monsterInstanceId: string; monsterId: string; locationId: LocationId; spawnLocationId: LocationId }
  | { type: "GATE_OPENED"; gateId: string; locationId: LocationId }
  | { type: "GATE_DISCARDED"; gateId: string; locationId: LocationId }
  | { type: "DOOM_ADVANCED"; amount: number; newDoom: number }
  | { type: "CLUE_SPAWNED"; clueId: string; locationId: LocationId }
  | { type: "CLUE_GAINED"; playerId: string; amount: number }
  | { type: "CLUES_DISCARDED"; playerId: string; amount: number }
  | { type: "CLUE_COLLECTED"; clueId: string; playerId: string; locationId: LocationId }
  | { type: "CLUE_RELOCATED"; clueId: string; fromLocationId: LocationId; locationId: LocationId }
  | { type: "CLUE_DISCARDED"; clueId: string; locationId: LocationId }
  | { type: "OMEN_ADVANCED"; position: number; symbol: "comet" | "constellation" | "eclipse"; doomAdvance: number }
  | { type: "OMEN_ELDRITCH_CHANGED"; position: 0; amount: number; tokens: number }
  | { type: "OMEN_MOVED"; position: number; symbol: "comet" | "constellation" | "eclipse"; direction: "counterclockwise" | "chosen"; doomAdvance: number }
  | { type: "INVESTIGATOR_DAMAGED"; playerId: string; healthLost: number; sanityLost: number }
  | { type: "INVESTIGATOR_RECOVERED"; playerId: string; healthRecovered: number; sanityRecovered: number }
  | { type: "INVESTIGATOR_DEFEATED" | "INVESTIGATOR_REPLACED"; playerId: string; investigatorId: InvestigatorId }
  | { type: "TRADE_OFFERED" | "TRADE_ACCEPTED" | "TRADE_DECLINED"; offerId: string; playerId: string }
  | { type: "INVESTIGATOR_DELAYED" | "INVESTIGATOR_STOOD_UP"; playerId: string }
  | { type: "SKILL_IMPROVED"; playerId: string; skill: SkillId; improvement: number }
  | { type: "INVESTIGATOR_SELECTED"; playerId: string; investigatorId: InvestigatorId }
  | { type: "ANCIENT_ONE_SELECTED"; ancientOneId: AncientOneId }
  | { type: "GAME_STARTED"; activePlayerId: string }
  | { type: "ASSET_GAINED"; playerId: string; assetId: string; source: "setup" | "reserve" | "mythos" }
  | { type: "ASSET_DISCARDED"; playerId: string; assetId: string; reason: "rest" | "on_gain_effect" | "mythos" | "encounter" }
  | { type: "TEST_ROLLED"; testId: string; playerId: string; skill: SkillId; modifier: number; dice: number[]; successes: number }
  | { type: "CLUE_SPENT_FOR_REROLL"; testId: string; playerId: string; dieIndex: number }
  | { type: "TEST_DIE_REROLLED"; testId: string; playerId: string; dieIndex: number; result: number; successes: number }
  | { type: "TEST_DIE_MODIFIED"; testId: string; playerId: string; assetId: string; dieIndex: number; result: number; successes: number }
  | { type: "TEST_RESOLVED"; testId: string; playerId: string; successes: number; continuation: ActiveTest["continuation"] }
  | { type: "RESERVE_ASSET_DISCARDED"; assetId: string }
  | { type: "RESERVE_REFILLED"; assetIds: string[] }
  | { type: "MYSTERY_REVEALED"; mysteryId: string }
  | { type: "MYSTERY_PROGRESS_ADDED"; mysteryId: string; amount: number; progress: number }
  | { type: "MYSTERY_SOLVED"; mysteryId: string }
  | { type: "ARTIFACT_GAINED"; playerId: string; artifactId: string }
  | { type: "MYSTERY_RETURNED_TO_DECK"; mysteryId: string }
  | { type: "GAME_ENDED"; result: "investigators_win" | "investigators_lose"; reason: string }
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
  assetIds: string[];
  conditionIds?: string[];
  clues: number;
  skillImprovements: Partial<Record<SkillId, number>>;
  isHost: boolean;
}

export interface PublicGameState {
  stateVersion: number;
  phase: GamePhase;
  activePlayerId?: string;
  turnNumber: number;
  ancientOneId?: AncientOneId;
  currentMythosCardId?: string;
  lastLocationEncounterCardId?: string;
  currentLocationEncounterCardId?: string;
  activeMysteryId?: string;
  mysteryProgress: number;
  mysteryTarget: number;
  completedMysteryIds: string[];
  reserveAssetIds: string[];
  assetDiscardIds: string[];
  gameResult?: "investigators_win" | "investigators_lose";
  players: PublicPlayerState[];
}

export const joinOptionsSchema = z.object({
  resumeToken: z.string().uuid().optional(),
  displayName: z.string().trim().min(1).max(32).default("Investigator"),
}).strict();

export const commandMessageType = "command" as const;
export const commandErrorMessageType = "command-error" as const;
export const pendingDecisionMessageType = "pending-decision" as const;

export interface CommandErrorMessage {
  code: string;
  message: string;
}
