import type {
  GameCommand,
  GameEvent,
  GamePhase,
  ActiveTest,
  AncientOneId,
  InvestigatorId,
  LocationId,
  PendingDecision,
  PendingDecisionSummary,
  SkillId,
  TravelTicketType,
  TradeOffer,
  TradeBundle,
} from "@eldritch/protocol";
import { calculateDicePool, countTestSuccesses } from "./skill-tests.js";
import { loseResource, recoverResource } from "./resources.js";
import { buildArtifactDeck, buildGateStack, buildLocationEncounterDecks, buildMonsterPool, buildMythosDeck, type AncientSetup, type LocationEncounterDeckId, type EncounterDeckId, type ResearchEncounterDeckId, type MythosColor } from "./setup.js";
import { bindResearchInstruction } from "./research-instructions.js";
import { encounterItemAssetIds, encounterItemsAreConserved, encounterDamagePreventions, physicalAssetIsUnique, nonCombatEncounterAuraBonus, supportsEncounterAssets } from "./encounter-assets.js";
import { resolveStandardCombat, type CombatCheck } from "./combat.js";
import { conditionSuccessThreshold, publicConditionId, resolveBoonBaneGain } from "./conditions.js";
import { advanceOmenTrack, omenTrack } from "./omen.js";
import { parseLocationEncounterInstruction, encounterInstructionLabel, type LocationEncounterInstruction, type LocationEncounterEffect } from "./encounter-instructions.js";
export * from "./setup.js";
export * from "./skill-tests.js";
export * from "./resources.js";
export * from "./combat.js";
export * from "./conditions.js";
export * from "./omen.js";

export type ActionType = "travel" | "rest" | "prepare_travel" | "trade" | "acquire_assets" | "component" | "investigator";

export interface EngineInputSequences {
  dice?: readonly number[];
  shuffleIndexes?: readonly number[];
  tokenIndexes?: readonly number[];
  ids?: readonly string[];
}

export interface EngineContext {
  rollDie(): number;
  shuffle<T>(items: readonly T[]): T[];
  drawToken<T>(pool: readonly T[]): { token: T; remaining: T[] };
  createId(): string;
}

export function createDeterministicEngineContext(inputs: EngineInputSequences): EngineContext {
  const dice = [...(inputs.dice ?? [])];
  const shuffleIndexes = [...(inputs.shuffleIndexes ?? [])];
  const tokenIndexes = [...(inputs.tokenIndexes ?? [])];
  const ids = [...(inputs.ids ?? [])];

  function take(sequence: number[], name: string): number {
    const value = sequence.shift();
    if (value === undefined) throw new Error(`Deterministic ${name} input is exhausted.`);
    return value;
  }

  return {
    rollDie(): number {
      const result = take(dice, "die");
      if (!Number.isInteger(result) || result < 1 || result > 6) {
        throw new Error(`Deterministic die input must be an integer from 1 to 6; received ${result}.`);
      }
      return result;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const shuffled = [...items];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = take(shuffleIndexes, "shuffle index");
        if (!Number.isInteger(swapIndex) || swapIndex < 0 || swapIndex > index) {
          throw new Error(`Deterministic shuffle index must be between 0 and ${index}; received ${swapIndex}.`);
        }
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
      }
      return shuffled;
    },
    drawToken<T>(pool: readonly T[]): { token: T; remaining: T[] } {
      if (pool.length === 0) throw new Error("Cannot draw a token from an empty pool.");
      const drawIndex = take(tokenIndexes, "token index");
      if (!Number.isInteger(drawIndex) || drawIndex < 0 || drawIndex >= pool.length) {
        throw new Error(`Deterministic token index must be between 0 and ${pool.length - 1}; received ${drawIndex}.`);
      }
      const remaining = [...pool];
      const [token] = remaining.splice(drawIndex, 1);
      return { token: token!, remaining };
    },
    createId(): string {
      const id = ids.shift();
      if (!id) throw new Error("Deterministic ID input is exhausted or empty.");
      return id;
    },
  };
}

export interface EnginePlayer {
  id: string;
  defeated?: boolean;
  eliminated?: boolean;
  delayed?: boolean;
  investigatorId?: InvestigatorId;
  locationId?: LocationId;
  health?: number;
  sanity?: number;
  maxHealth?: number;
  maxSanity?: number;
  travelTickets?: TravelTicketType[];
  assetIds: string[];
  artifactIds?: string[];
  /** Public front-side physical card IDs; unrevealed backs are never projected. */
  conditionIds?: string[];
  clues: number;
  skillImprovements: Partial<Record<SkillId, number>>;
}

export interface PrivateGameState {
  deckOrderById: Record<string, string[]>;
  tokenPoolById: Record<string, string[]>;
}

export interface MonsterInstance {
  id: string;
  monsterId: string;
  locationId: LocationId;
  damage: number;
  setAside?: boolean;
}

export interface BoardClue {
  id: string;
  locationId: LocationId;
}

export interface MonsterCombatDefinition {
  id: string;
  type: "normal" | "epic";
  count?: number;
  spawnEffect?: { type: "move_to"; locationId: LocationId } | { type: "curse_lead" } | { type: "unsupported" };
  horrorCheck: CombatCheck | null | "ancient_one";
  damageCheck: CombatCheck | null | "ancient_one";
  toughness: { base: number; perInvestigator: number } | "ancient_one";
  specialEffect?: string;
  reckoningEffect?: string;
}

export interface GameState {
  /** Private continuation: every Rest trigger resolves at most once before one action is charged. */
  pendingRest?: { playerId: string; remainingAssetIds: string[]; testingAssetId?: string };
  pendingLocationEncounter?: { playerId: string; cardId: string; deck: EncounterDeckId; queue: LocationEncounterInstruction[]; dice: number[]; successes: number; gateId?: string; gateLocationId?: LocationId; gateClosed?: boolean };
  defeatedInvestigators?: { investigatorId: InvestigatorId; locationId: LocationId; cause: "health" | "sanity"; assetIds: string[]; artifactIds?: string[]; clues: number; travelTickets: TravelTicketType[] }[];
  pendingDefeat?: { playerId: string; cityIds: LocationId[]; causes: ("health" | "sanity")[] };
  pendingMythosDamage?: { cardId: string; remainingPlayerIds: string[]; healthLoss: number };
  pendingHeatWave?: { cardId: string; remainingPlayerIds: string[] };
  pendingTideOfDespair?: { cardId: string; remainingPlayerIds: string[] };
  pendingUnexpectedBetrayal?: { cardId: string; remainingPlayerIds: string[] };
  pendingFromBadToWorse?: { cardId: string; remainingPlayerIds: string[] };
  replacementWindow?: boolean;
  awakened?: boolean;
  doom?: number;
  omen?: number;
  greenOmenTokens?: number;
  tradeOffer?: TradeOffer;
  stateVersion: number;
  phase: GamePhase;
  players: EnginePlayer[];
  activePlayerId?: string;
  leadInvestigatorId?: string;
  ancientOneId?: AncientOneId;
  currentMythosCardId?: string;
  currentMythosIconIndex?: number;
  lastLocationEncounterCardId?: string;
  currentLocationEncounterCardId?: string;
  encounteredMonsterInstanceIds?: string[];
  resolvedMythosClueCardId?: string;
  activeMysteryId?: string;
  mysteryProgress: number;
  mysteryTarget: number;
  completedMysteryIds: string[];
  gameResult?: "investigators_win" | "investigators_lose";
  turnNumber: number;
  actionsRemaining: number;
  performedActions: ActionType[];
  usedConditionActionIds?: string[];
  usedArtifactActionIds?: string[];
  /** Physical Asset identities whose once-per-round test reroll has been used. */
  usedAssetRerollIds?: string[];
  /** Physical once-per-round die-result modifier sources, independent of rerolls. */
  usedAssetDieModifierIds?: string[];
  monsterLocationIds: LocationId[];
  monsters?: MonsterInstance[];
  activeGateIds?: string[];
  discardedGateIds?: string[];
  boardClues?: BoardClue[];
  reserveAssetIds: string[];
  assetDiscardIds: string[];
  pendingDecision?: PendingDecision;
  activeTest?: ActiveTest;
  privateState: PrivateGameState;
}

export type PublicEngineGameState = Omit<GameState, "privateState" | "pendingDecision" | "pendingLocationEncounter" | "pendingRest"> & {
  pendingDecision?: PendingDecision | PendingDecisionSummary;
};

export interface GameMap {
  adjacentLocationIds: Readonly<Partial<Record<LocationId, readonly LocationId[]>>>;
  routes: readonly { source: LocationId; target: LocationId; type: "train" | "ship" | "uncharted" }[];
  locationTypes: Readonly<Partial<Record<LocationId, "city" | "wilderness" | "sea">>>;
}

export interface InvestigatorSetup {
  startingLocationId: LocationId;
  health: number;
  sanity: number;
  skills: Readonly<Record<SkillId, number>>;
  startingAssetIds: readonly string[];
  startingClues: number;
}

export type AssetEngineEffect =
  | { type: "round_test_die_increment"; amount: 1 }
  | { type: "discard_prevent_sanity_loss"; amount: 2 }
  | { type: "discard_prevent_health_loss"; amount: 2 }
  | { type: "round_test_reroll" }
  | { type: "test_reroll"; skill: "influence" | "strength" }
  | { type: "city_test_aura"; amount: 1 }
  | { type: "skill_bonus"; skill: "influence" | "strength"; amount: 1 }
  | { type: "acquire_six_counts_as_two" }
  | { type: "rest_recover_additional_sanity"; amount: 1 }
  | { type: "rest_health_or_discard_cursed"; amount: 1 }
  | { type: "rest_test_gain_artifact"; skill: "observation"; modifier: -2 }
  | { type: "on_gain_recover_all_and_discard" };

/** Only verified, atomic reverse effects; supplied by the server, never public content. */
export type ConditionBackEffect =
  | { type: "discard" }
  | { type: "recover_health_and_sanity_then_flip_front"; amount: 2 }
  | { type: "gain_clues_then_flip_front"; amount: 2 }
  | { type: "become_delayed_then_flip_front" }
  | { type: "discard_all_clues_then_discard" };

export interface GameContent {
  artifacts?: readonly { id: string; engineEffects?: readonly ({ type: "action_lore_spend_sanity_gain_clues"; amount: 2 } | { type: "action_lore_spend_sanity_improve_skill" })[] }[];
  researchEncounters?: readonly { id: string; deck: ResearchEncounterDeckId; sections: Readonly<Record<string, unknown>> }[];
  otherWorldEncounters?: readonly { id: string; deck: "other_world"; sections: Readonly<Record<string, unknown>> }[];
  otherWorldEncounterIds?: readonly string[];
  locationEncounters?: readonly { id: string; deck: LocationEncounterDeckId; sections?: Readonly<Record<string, unknown>> }[];
  gates?: readonly { id: string; omenSymbol: "comet" | "constellation" | "eclipse"; locationId: LocationId }[];
  clues?: readonly { id: string; locationId: LocationId }[];
  conditions?: readonly { id: string; kind: string; trait?: "deal" | "injury" | "madness" | "restriction" | "bane" | "boon"; backEffect?: ConditionBackEffect }[];
  monsters?: readonly MonsterCombatDefinition[];
  ancientOnes?: Readonly<Partial<Record<AncientOneId, AncientSetup>>>;
  mythosCards?: readonly { id: string; color: MythosColor; icons?: readonly { type: string }[]; effect?: { type: "lead_gain_condition"; kind: "blessed" } | { type: "move_omen_counterclockwise_then_advance_doom_for_gates" } | { type: "lead_choose_omen_without_doom" } | { type: "each_investigator_choose_world_fights_back" } | { type: "lead_gain_ally_asset" } | { type: "each_investigator_trade_debt_for_condition" } | { type: "discard_matching_gates_and_advance_doom" } | { type: "doom_two_unless_lead_gains_dark_pact" } | { type: "spawn_monster_on_each_cultist_space" } | { type: "roll_each_investigator_for_bermuda_triangle" } | { type: "group_discard_gate_then_advance_doom_if_nonmatching" } | { type: "torn_asunder" } | { type: "each_investigator_choose_heat_wave" } | { type: "lead_discard_monster_lose_toughness_health" } | { type: "each_investigator_tide_of_despair" } | { type: "each_investigator_with_ally_betrayed" } | { type: "each_investigator_from_bad_to_worse" } }[];
  referenceCards?: readonly { playerCount: number; spawnClues: number; monsterSurge?: number; spawnGates?: number }[];
  map: GameMap;
  investigators: Readonly<Partial<Record<InvestigatorId, InvestigatorSetup>>>;
  assets: readonly { id: string; name?: string; value: number; traits?: readonly string[]; engineEffects: readonly AssetEngineEffect[]; nonCombatEncounterSupport?: "unsupported" | "irrelevant" | "city_test_aura" | "skill_test" | "health_prevention" | "sanity_prevention" }[];
  mysteryIdsByAncientOne: Readonly<Partial<Record<AncientOneId, readonly string[]>>>;
  mysteryTargetsById: Readonly<Record<string, "investigator_count" | "half_investigator_count" | "twice_investigator_count" | "one">>;
}

export type RuleErrorCode =
  | "ARTIFACT_CONTENT_MISSING" | "ARTIFACT_UNAVAILABLE" | "ARTIFACT_EFFECT_UNSUPPORTED"
  | "ENCOUNTER_UNSUPPORTED" | "ENCOUNTER_CONTENT_MISSING" | "ENCOUNTER_DECK_MISSING" | "ENCOUNTER_DECK_ILLEGAL"
  | "MYTHOS_CARD_ACTIVE" | "MYTHOS_DECK_MISSING" | "MYTHOS_CONTENT_MISSING"
  | "MYTHOS_EFFECT_UNSUPPORTED"
  | "CONDITION_ACTION_INVALID" | "CONDITION_RESTRICTED"
  | "CONDITION_CONTENT_MISSING" | "CONDITION_UNAVAILABLE" | "CONDITION_NOT_HELD" | "CONDITION_EFFECT_UNSUPPORTED"
  | "RECKONING_UNSUPPORTED"
  | "INVALID_COMBAT" | "MONSTER_CONTENT_MISSING" | "MONSTER_EFFECT_UNSUPPORTED" | "MONSTER_UNAVAILABLE"
  | "GATE_UNAVAILABLE" | "GATE_CONTENT_MISSING"
  | "REFERENCE_CARD_MISSING"
  | "CLUE_CONTENT_MISSING" | "CLUE_UNAVAILABLE"
  | "OMEN_CONTENT_MISSING" | "AWAKENING_UNSUPPORTED"
  | "INVALID_DEFEAT" | "INVESTIGATOR_DEFEATED" | "INVALID_DAMAGE"
  | "INVALID_TRADE"
  | "INVESTIGATOR_DELAYED"
  | "PLAYER_NOT_FOUND"
  | "WRONG_PHASE"
  | "NOT_HOST"
  | "NOT_ENOUGH_PLAYERS"
  | "INVESTIGATOR_REQUIRED"
  | "INVESTIGATOR_CONTENT_MISSING"
  | "INVESTIGATOR_TAKEN"
  | "ANCIENT_ONE_REQUIRED"
  | "MYSTERY_CONTENT_MISSING"
  | "ASSET_CONTENT_MISSING"
  | "ASSET_ACTION_BLOCKED_BY_MONSTER"
  | "ASSET_PURCHASE_OVER_BUDGET"
  | "ACTIVE_TEST_MISSING"
  | "CLUE_REQUIRED"
  | "RANDOM_INPUT_REQUIRED"
  | "MYSTERY_REQUIRED"
  | "INVALID_MYSTERY_PROGRESS"
  | "GAME_ENDED"
  | "NOT_ACTIVE_PLAYER"
  | "ACTION_ALREADY_PERFORMED"
  | "NO_ACTIONS_REMAINING"
  | "DESTINATION_NOT_ADJACENT"
  | "TRAVEL_TICKET_REQUIRED"
  | "REST_BLOCKED_BY_MONSTER"
  | "CITY_REQUIRED"
  | "ROUTE_TYPE_REQUIRED"
  | "TRAVEL_TICKET_LIMIT"
  | "DECISION_PENDING"
  | "NO_PENDING_DECISION"
  | "DECISION_ID_MISMATCH"
  | "NOT_DECISION_OWNER"
  | "INVALID_DECISION_SELECTION";

export type CommandResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: { code: RuleErrorCode; message: string } };

export function createLobby(playerIds: string[]): GameState {
  return {
    stateVersion: 0,
    phase: "lobby",
    players: playerIds.map((id): EnginePlayer => ({ id, assetIds: [], clues: 0, skillImprovements: {} })),
    turnNumber: 0,
    actionsRemaining: 0,
    performedActions: [],
    usedConditionActionIds: [],
    usedAssetRerollIds: [],
    usedAssetDieModifierIds: [],
    monsterLocationIds: [],
    activeGateIds: [],
    discardedGateIds: [],
    boardClues: [],
    reserveAssetIds: [],
    assetDiscardIds: [],
    mysteryProgress: 0,
    mysteryTarget: 0,
    completedMysteryIds: [],
    privateState: {
      deckOrderById: {},
      tokenPoolById: {},
    },
  };
}

function decisionSummary(decision: PendingDecision): PendingDecisionSummary {
  return {
    id: decision.id,
    kind: decision.kind,
    playerId: decision.playerId,
    visibility: decision.visibility,
    prompt: decision.prompt,
    optionCount: decision.optionIds.length,
    minSelections: decision.minSelections,
    maxSelections: decision.maxSelections,
    ...(decision.selectionBudget === undefined ? {} : { selectionBudget: decision.selectionBudget }),
    ...(decision.continuation === undefined ? {} : { continuation: decision.continuation }),
  };
}

function cloneDecision(decision: PendingDecision): PendingDecision {
  return { ...decision, optionIds: [...decision.optionIds], ...(decision.optionLabels ? { optionLabels: { ...decision.optionLabels } } : {}) };
}

export function projectStateForPlayer(state: GameState, viewerPlayerId?: string): PublicEngineGameState {
  const { privateState: _privateState, pendingLocationEncounter: _pendingLocationEncounter, pendingRest: _pendingRest, pendingDecision, ...publicState } = state;
  return {
    ...publicState,
    players: publicState.players.map((player) => ({
      ...player,
      travelTickets: player.travelTickets ? [...player.travelTickets] : undefined,
      assetIds: [...player.assetIds],
      ...(player.artifactIds ? { artifactIds: [...player.artifactIds] } : {}),
      ...(player.conditionIds ? { conditionIds: player.conditionIds.map(publicConditionId) } : {}),
      skillImprovements: { ...player.skillImprovements },
    })),
    performedActions: [...publicState.performedActions],
    usedConditionActionIds: [...(publicState.usedConditionActionIds ?? [])],
    usedArtifactActionIds: [...(publicState.usedArtifactActionIds ?? [])],
    usedAssetRerollIds: [...(publicState.usedAssetRerollIds ?? [])],
    usedAssetDieModifierIds: [...(publicState.usedAssetDieModifierIds ?? [])],
    monsterLocationIds: [...publicState.monsterLocationIds],
    monsters: publicState.monsters?.map(monster => ({ ...monster })),
    activeGateIds: [...(publicState.activeGateIds ?? [])],
    discardedGateIds: [...(publicState.discardedGateIds ?? [])],
    boardClues: publicState.boardClues?.map(clue => ({ ...clue })),
    reserveAssetIds: [...publicState.reserveAssetIds],
    assetDiscardIds: [...publicState.assetDiscardIds],
    completedMysteryIds: [...publicState.completedMysteryIds],
    activeTest: publicState.activeTest ? { ...publicState.activeTest, sourceConditionId: undefined, dice: [...publicState.activeTest.dice], usedRerollAssetIds: publicState.activeTest.usedRerollAssetIds?.slice() } : undefined,
    pendingDecision: pendingDecision
      ? pendingDecision.visibility === "public" || pendingDecision.playerId === viewerPlayerId
        ? cloneDecision(pendingDecision)
        : decisionSummary(pendingDecision)
      : undefined,
  };
}

export function projectPublicState(state: GameState): PublicEngineGameState {
  return projectStateForPlayer(state);
}

function conditionPoolKey(kind: string): string {
  return `condition:${kind}`;
}

const restRecoverableKinds = new Set(["amnesia", "leg_injury", "internal_injury", "paranoia", "hallucinations", "back_injury"]);

function recoverableConditionIds(player: EnginePlayer, content: GameContent): string[] {
  return (player.conditionIds ?? []).filter(id => restRecoverableKinds.has(content.conditions?.find(card => card.id === id)?.kind ?? "")).map(publicConditionId);
}

function returnConditionToPool(state: GameState, player: EnginePlayer, cardId: string, content: GameContent): boolean {
  const condition = content.conditions?.find(card => card.id === cardId);
  if (!condition || !player.conditionIds?.includes(cardId)) return false;
  player.conditionIds = player.conditionIds.filter(id => id !== cardId);
  const key = conditionPoolKey(condition.kind);
  state.privateState.tokenPoolById[key] = [...(state.privateState.tokenPoolById[key] ?? []), cardId];
  return true;
}

/** Internal rule effect. The client cannot grant itself a Condition. */
export function gainCondition(state: GameState, playerId: string, kind: string, content: GameContent, context: EngineContext): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has ended.");
  if (state.phase === "lobby") return failure("WRONG_PHASE", "Conditions cannot be gained before setup.");
  const player = state.players.find(candidate => candidate.id === playerId);
  if (!player) return failure("PLAYER_NOT_FOUND", "Investigator not found.");
  if (player.defeated || player.eliminated) return failure("INVESTIGATOR_DEFEATED", "No active investigator can gain a Condition.");
  if (kind === "madness" || kind === "injury") {
    if (kind === "injury") {
      const invalid = validateInjurySupply(state, content);
      if (invalid) return invalid;
    }
    const definitions = content.conditions?.filter(card => card.trait === kind) ?? [];
    if (!definitions.length) return failure("CONDITION_CONTENT_MISSING", "Condition traits are missing from content.");
    const kinds = [...new Set(definitions.map(card => card.kind))];
    const pool = kinds.flatMap(conditionKind => state.privateState.tokenPoolById[conditionPoolKey(conditionKind)] ?? []);
    if (!pool.length) return failure("CONDITION_UNAVAILABLE", "No matching trait Condition remains available.");
    const { token } = context.drawToken(pool);
    const definition = definitions.find(card => card.id === token);
    if (!definition) return failure("CONDITION_CONTENT_MISSING", "The drawn trait Condition is missing.");
    if (player.conditionIds?.some(id => content.conditions?.find(card => card.id === id)?.kind === definition.kind)) {
      return success(structuredClone(state), [{ type: "CONDITION_GAIN_PREVENTED", playerId, kind: definition.kind }]);
    }
    const next = structuredClone(state);
    next.privateState.tokenPoolById[conditionPoolKey(definition.kind)] = next.privateState.tokenPoolById[conditionPoolKey(definition.kind)]!.filter(id => id !== token);
    const recipient = next.players.find(candidate => candidate.id === playerId)!;
    recipient.conditionIds = [...(recipient.conditionIds ?? []), token];
    return success(next, [{ type: "CONDITION_GAINED", playerId, conditionId: publicConditionId(token) }]);
  }
  if (!content.conditions?.some(card => card.kind === kind)) return failure("CONDITION_CONTENT_MISSING", "Condition kind is missing from content.");
  const owned = player.conditionIds ?? [];
  if (kind === "blessed" || kind === "cursed") {
    const replacement = resolveBoonBaneGain(owned, kind);
    if (replacement.type === "discard_opposite") return discardCondition(state, playerId, replacement.cardId, content);
    if (replacement.type === "flip_existing") return resolveConditionFlip(state, playerId, replacement.cardId, content, context);
  } else if (owned.some(id => content.conditions?.find(card => card.id === id)?.kind === kind)) {
    return success(structuredClone(state), [{ type: "CONDITION_GAIN_PREVENTED", playerId, kind }]);
  }
  const key = conditionPoolKey(kind);
  const pool = state.privateState.tokenPoolById[key];
  if (!pool?.length) return failure("CONDITION_UNAVAILABLE", "No copy of that Condition remains available.");
  const { token, remaining } = context.drawToken(pool);
  const next = structuredClone(state);
  next.privateState.tokenPoolById[key] = remaining;
  const recipient = next.players.find(candidate => candidate.id === playerId)!;
  recipient.conditionIds = [...(recipient.conditionIds ?? []), token];
  return success(next, [{ type: "CONDITION_GAINED", playerId, conditionId: publicConditionId(token) }]);
}

/** Internal effect and cleanup path; returns the physical card to its matching supply. */
export function discardCondition(state: GameState, playerId: string, cardId: string, content: GameContent): CommandResult {
  const next = structuredClone(state);
  const player = next.players.find(candidate => candidate.id === playerId);
  if (!player) return failure("PLAYER_NOT_FOUND", "Investigator not found.");
  if (!returnConditionToPool(next, player, cardId, content)) return failure("CONDITION_NOT_HELD", "That Condition is not held by this investigator.");
  return success(next, [{ type: "CONDITION_DISCARDED", playerId, conditionId: publicConditionId(cardId) }]);
}

/** Resolves only atomic, transcribed reverse effects. The physical ID stays private. */
function resolveConditionFlip(state: GameState, playerId: string, cardId: string, content: GameContent, context: EngineContext): CommandResult {
  const definition = content.conditions?.find(card => card.id === cardId);
  const effect = definition?.backEffect;
  if (!effect) return failure("CONDITION_EFFECT_UNSUPPORTED", "This Condition's reverse effect is not executable yet.");
  const owner = state.players.find(player => player.id === playerId && player.conditionIds?.includes(cardId));
  if (!owner) return failure("CONDITION_NOT_HELD", "That Condition is not held by this investigator.");
  const next = structuredClone(state);
  return success(next, applyConditionBackEffect(next, playerId, cardId, content, effect, context));
}

function applyConditionBackEffect(state: GameState, playerId: string, cardId: string, content: GameContent, effect: ConditionBackEffect, context: EngineContext): GameEvent[] {
  const recipient = state.players.find(player => player.id === playerId)!;
  const publicId = publicConditionId(cardId);
  const clueEvents: GameEvent[] = [];
  if (effect.type === "discard" || effect.type === "discard_all_clues_then_discard") {
    if (effect.type === "discard_all_clues_then_discard") {
      if (!discardHeldClues(state, playerId, recipient.clues)) return [];
      recipient.clues = 0;
    }
    returnConditionToPool(state, recipient, cardId, content);
  }
  else if (effect.type === "recover_health_and_sanity_then_flip_front") {
    recipient.health = recoverResource(recipient.health ?? 0, recipient.maxHealth ?? recipient.health ?? 0, effect.amount).value;
    recipient.sanity = recoverResource(recipient.sanity ?? 0, recipient.maxSanity ?? recipient.sanity ?? 0, effect.amount).value;
  } else if (effect.type === "gain_clues_then_flip_front") {
    if (state.privateState.tokenPoolById.clues) {
      const gained = gainCluesFromPool(state, playerId, effect.amount, content, context);
      if (!gained.ok) return [];
      state.privateState = gained.state.privateState;
      recipient.clues = gained.state.players.find(player => player.id === playerId)!.clues;
      clueEvents.push(...gained.events);
    } else recipient.clues += effect.amount; // Legacy fixtures without physical Clue content.
  }
  else if (effect.type === "become_delayed_then_flip_front") recipient.delayed = true;
  const events: GameEvent[] = [{ type: "CONDITION_BACK_RESOLVED", playerId, conditionId: publicId, effect: effect.type }];
  events.push(...clueEvents);
  if (effect.type === "become_delayed_then_flip_front") events.push({ type: "INVESTIGATOR_DELAYED", playerId });
  if (effect.type === "discard" || effect.type === "discard_all_clues_then_discard") events.push({ type: "CONDITION_DISCARDED", playerId, conditionId: publicId });
  return events;
}

/** Internal Mythos effect, never a client command. The caller must order Reckoning triggers. */
export function resolveConditionReckoning(
  state: GameState, playerId: string, cardId: string, content: GameContent, context: EngineContext,
): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has ended.");
  if (state.phase !== "mythos") return failure("WRONG_PHASE", "Condition Reckoning resolves during Mythos.");
  if (state.pendingDecision || state.activeTest || state.pendingDefeat) return failure("DECISION_PENDING", "Finish the current resolution first.");
  const player = state.players.find(candidate => candidate.id === playerId);
  if (!player) return failure("PLAYER_NOT_FOUND", "Investigator not found.");
  if (player.defeated || player.eliminated) return failure("INVESTIGATOR_DEFEATED", "No active investigator can resolve Reckoning.");
  if (!player.conditionIds?.includes(cardId)) return failure("CONDITION_NOT_HELD", "That Condition is not held by this investigator.");
  const condition = content.conditions?.find(candidate => candidate.id === cardId);
  if (!condition) return failure("CONDITION_CONTENT_MISSING", "Condition content is missing.");
  if (["leg_injury", "internal_injury", "back_injury", "amnesia", "paranoia", "hallucinations"].includes(condition.kind)) {
    if (!condition.backEffect) return failure("CONDITION_EFFECT_UNSUPPORTED", "This Condition's reverse effect is not executable yet.");
    if (!player.investigatorId || !content.investigators[player.investigatorId]) return failure("INVESTIGATOR_CONTENT_MISSING", "Investigator skills are missing.");
    const next = structuredClone(state);
    const owner = next.players.find(candidate => candidate.id === playerId)!;
    const skill = ["leg_injury", "internal_injury", "back_injury"].includes(condition.kind) ? "strength" : "will";
    const events = beginSkillTest(next, owner, { skill, modifier: 0, continuation: "condition_reckoning", sourceConditionId: cardId }, content, context);
    return success(next, events);
  }
  if (condition.kind !== "blessed" && condition.kind !== "cursed") {
    return failure("CONDITION_EFFECT_UNSUPPORTED", "This Condition's Reckoning and reverse are not executable yet.");
  }
  const die = context.rollDie();
  const discarded = condition.kind === "blessed" ? die <= 2 : die >= 4;
  const next = structuredClone(state);
  const events: GameEvent[] = [{ type: "CONDITION_RECKONING_ROLLED", playerId, conditionId: publicConditionId(cardId), die, discarded }];
  if (discarded) {
    const owner = next.players.find(candidate => candidate.id === playerId)!;
    returnConditionToPool(next, owner, cardId, content);
    events.push({ type: "CONDITION_DISCARDED", playerId, conditionId: publicConditionId(cardId) });
  }
  return success(next, events);
}

function failure(code: RuleErrorCode, message: string): CommandResult {
  return { ok: false, error: { code, message } };
}

function success(state: GameState, events: GameEvent[]): CommandResult {
  state.stateVersion += 1;
  return { ok: true, state, events };
}

function mysteryTargetValue(target: GameContent["mysteryTargetsById"][string], investigatorCount: number): number {
  if (target === "half_investigator_count") return Math.ceil(investigatorCount / 2);
  if (target === "twice_investigator_count") return investigatorCount * 2;
  if (target === "investigator_count") return investigatorCount;
  return 1;
}

function targetForMystery(content: GameContent, mysteryId: string, investigatorCount: number): number | undefined {
  const target = content.mysteryTargetsById[mysteryId];
  return target ? mysteryTargetValue(target, investigatorCount) : undefined;
}

/** Internal named transfer only. No public grant command or printed Artifact effects. */
export function gainNamedArtifact(state: GameState, playerId: string, artifactId: string, content: GameContent): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has ended.");
  if (state.phase === "lobby") return failure("WRONG_PHASE", "Artifacts cannot be gained before setup.");
  const player = state.players.find(player => player.id === playerId);
  if (!player) return failure("PLAYER_NOT_FOUND", "Investigator not found.");
  if (player.defeated || player.eliminated) return failure("INVESTIGATOR_DEFEATED", "This investigator cannot gain an Artifact.");
  if (!supportedArtifact(artifactId, content)) return failure("ARTIFACT_EFFECT_UNSUPPORTED", "This Artifact's printed gain/effects are not supported.");
  const catalog = content.artifacts?.map(card => card.id);
  const deck = state.privateState.deckOrderById.artifacts;
  const physical = [...(deck ?? []), ...state.players.flatMap(player => player.artifactIds ?? []), ...(state.defeatedInvestigators ?? []).flatMap(player => player.artifactIds ?? [])];
  if (!catalog || !deck || new Set(catalog).size !== catalog.length || new Set(physical).size !== physical.length || physical.some(id => !catalog.includes(id)) || physical.length !== catalog.length) return failure("ARTIFACT_CONTENT_MISSING", "The physical Artifact supply is inconsistent.");
  if (!deck.includes(artifactId)) return failure("ARTIFACT_UNAVAILABLE", "The named Artifact is not in the supply.");
  const next = structuredClone(state);
  next.privateState.deckOrderById.artifacts = deck.filter(id => id !== artifactId);
  const recipient = next.players.find(player => player.id === playerId)!;
  recipient.artifactIds = [...(recipient.artifactIds ?? []), artifactId];
  return success(next, [{ type: "ARTIFACT_GAINED", playerId, artifactId }]);
}

export function applyMysteryProgress(state: GameState, amount: number, content: GameContent): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has already ended.");
  if (!state.activeMysteryId) return failure("MYSTERY_REQUIRED", "There is no active Mystery.");
  if (!Number.isInteger(amount) || amount < 1) return failure("INVALID_MYSTERY_PROGRESS", "Mystery progress must be a positive integer.");
  const solvedId = state.activeMysteryId;
  const next = structuredClone(state);
  next.mysteryProgress = Math.min(next.mysteryTarget, next.mysteryProgress + amount);
  const events: GameEvent[] = [{ type: "MYSTERY_PROGRESS_ADDED", mysteryId: solvedId, amount, progress: next.mysteryProgress }];
  if (next.mysteryProgress < next.mysteryTarget) return success(next, events);
  next.completedMysteryIds.push(solvedId);
  events.push({ type: "MYSTERY_SOLVED", mysteryId: solvedId });
  if (next.completedMysteryIds.length >= 3) {
    next.activeMysteryId = undefined;
    next.mysteryProgress = 0;
    next.mysteryTarget = 0;
    next.gameResult = "investigators_win";
    events.push({ type: "GAME_ENDED", result: "investigators_win", reason: "three_mysteries_solved" });
    return success(next, events);
  }
  const nextMysteryId = next.privateState.deckOrderById.mysteries?.shift();
  if (!nextMysteryId) return failure("MYSTERY_CONTENT_MISSING", "The Mystery deck is empty before three Mysteries are solved.");
  const target = targetForMystery(content, nextMysteryId, next.players.length);
  if (!target) return failure("MYSTERY_CONTENT_MISSING", `Mystery target is missing for ${nextMysteryId}.`);
  next.activeMysteryId = nextMysteryId;
  next.mysteryProgress = 0;
  next.mysteryTarget = target;
  events.push({ type: "MYSTERY_REVEALED", mysteryId: nextMysteryId });
  return success(next, events);
}

export function nearestCities(map: GameMap, origin: LocationId): LocationId[] {
  const visited = new Set<LocationId>();
  let frontier = [origin];
  while (frontier.length) {
    const cities = frontier.filter(id => map.locationTypes[id] === "city");
    if (cities.length) return cities;
    frontier.forEach(id => visited.add(id));
    frontier = [...new Set(frontier.flatMap(id => map.adjacentLocationIds[id] ?? []))].filter(id => !visited.has(id));
  }
  return [];
}

/** Internal effect transition; clients cannot assign damage. */
export function damageInvestigator(state: GameState, playerId: string, health: number, sanity: number, content: GameContent): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has ended.");
  if (state.pendingDefeat) return failure("INVALID_DEFEAT", "Resolve the current defeat first.");
  if (![health, sanity].every(value => Number.isInteger(value) && value >= 0)) return failure("INVALID_DAMAGE", "Damage must be nonnegative integers.");
  const index = state.players.findIndex(player => player.id === playerId);
  const original = state.players[index];
  if (!original) return failure("PLAYER_NOT_FOUND", "Investigator not found.");
  if (original.defeated || original.eliminated || !original.investigatorId || !original.locationId) return failure("INVESTIGATOR_DEFEATED", "No active investigator.");
  const next = structuredClone(state);
  const player = next.players[index]!;
  const lostHealth = loseResource(player.health ?? 0, health);
  const lostSanity = loseResource(player.sanity ?? 0, sanity);
  player.health = lostHealth.value;
  player.sanity = lostSanity.value;
  const events: GameEvent[] = [{ type: "INVESTIGATOR_DAMAGED", playerId, healthLost: lostHealth.amount, sanityLost: lostSanity.amount }];
  if (player.health === 0 || player.sanity === 0) {
    const cityIds = nearestCities(content.map, original.locationId);
    if (!cityIds.length) return failure("INVALID_DEFEAT", "No nearest City exists in map data.");
    player.defeated = true;
    player.delayed = false;
    player.eliminated = state.awakened ?? false;
    next.doom = Math.max(0, (state.doom ?? content.ancientOnes?.[state.ancientOneId!]?.startingDoom ?? 1) - 1);
    if (next.doom === 0) {
      next.awakened = true;
      if (state.ancientOneId === "azathoth") next.gameResult = "investigators_lose";
    }
    next.pendingDefeat = { playerId, cityIds, causes: [...(player.health === 0 ? ["health" as const] : []), ...(player.sanity === 0 ? ["sanity" as const] : [])] };
    if (next.pendingDecision?.playerId === playerId) next.pendingDecision = undefined;
    if (next.activeTest?.playerId === playerId) next.activeTest = undefined;
    if (next.tradeOffer && [next.tradeOffer.fromPlayerId, next.tradeOffer.toPlayerId].includes(playerId)) next.tradeOffer = undefined;
    events.push({ type: "INVESTIGATOR_DEFEATED", playerId, investigatorId: original.investigatorId });
    if (next.players.every(p => p.eliminated)) next.gameResult = "investigators_lose";
    if (next.gameResult) events.push({ type: "GAME_ENDED", result: next.gameResult, reason: "defeat" });
  }
  return success(next, events);
}

/** Internal combat transition for Monsters without combat-specific card text. */
/** Internal draw effect. The chosen physical token and its post-spawn move are server-owned. */
export function spawnMonsterFromCup(state: GameState, spawnLocationId: LocationId, content: GameContent, context: EngineContext): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has ended.");
  if (state.phase === "lobby") return failure("WRONG_PHASE", "Monsters cannot spawn before setup.");
  if (!content.map.locationTypes[spawnLocationId]) return failure("MONSTER_CONTENT_MISSING", "The spawn space is not on the map.");
  const cup = state.privateState.tokenPoolById.monsters;
  if (!cup?.length) return failure("MONSTER_UNAVAILABLE", "No normal Monster token remains in the cup.");
  const { token: monsterId, remaining } = context.drawToken(cup);
  const definition = content.monsters?.find(monster => monster.id === monsterId && monster.type === "normal");
  if (!definition) return failure("MONSTER_CONTENT_MISSING", "The drawn Monster is missing from the normal catalog.");
  if (definition.spawnEffect?.type === "unsupported") return failure("MONSTER_EFFECT_UNSUPPORTED", "The drawn Monster requires an unimplemented spawn effect.");
  const locationId = definition.spawnEffect?.type === "move_to" ? definition.spawnEffect.locationId : spawnLocationId;
  if (!content.map.locationTypes[locationId]) return failure("MONSTER_CONTENT_MISSING", "The Monster's spawn destination is not on the map.");
  const monsterInstanceId = context.createId();
  if (state.monsters?.some(monster => monster.id === monsterInstanceId)) return failure("MONSTER_CONTENT_MISSING", "The generated Monster instance ID is already in use.");
  let next = structuredClone(state);
  const events: GameEvent[] = [];
  if (definition.spawnEffect?.type === "curse_lead") {
    if (!next.leadInvestigatorId) return failure("PLAYER_NOT_FOUND", "The Lead Investigator is missing.");
    const gained = gainCondition(next, next.leadInvestigatorId, "cursed", content, context);
    if (gained.ok === false) {
      if (gained.error.code !== "CONDITION_UNAVAILABLE") return gained;
    } else {
      next = gained.state;
      next.stateVersion = state.stateVersion;
      events.push(...gained.events);
    }
  }
  next.privateState.tokenPoolById.monsters = remaining;
  next.monsters = [...(next.monsters ?? []), { id: monsterInstanceId, monsterId, locationId, damage: 0 }];
  next.monsterLocationIds = [...new Set(next.monsters.map(monster => monster.locationId))];
  events.unshift({ type: "MONSTER_SPAWNED", monsterInstanceId, monsterId, locationId, spawnLocationId });
  return success(next, events);
}

/** Draw the top physical Gate, then resolve its required Monster spawn atomically. */
export function openGateFromStack(state: GameState, content: GameContent, context: EngineContext): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has ended.");
  if (state.phase === "lobby") return failure("WRONG_PHASE", "Gates cannot open before setup.");
  const next = structuredClone(state);
  const stack = next.privateState.deckOrderById.gates;
  if (!stack) return failure("GATE_CONTENT_MISSING", "The Gate stack is not initialized.");
  if (!stack.length && next.discardedGateIds?.length) {
    next.privateState.deckOrderById.gates = context.shuffle(next.discardedGateIds);
    next.discardedGateIds = [];
  }
  const gateId = next.privateState.deckOrderById.gates[0];
  if (!gateId) return failure("GATE_UNAVAILABLE", "No Gate remains in the stack.");
  const gate = content.gates?.find(candidate => candidate.id === gateId);
  if (!gate || !content.map.locationTypes[gate.locationId] || state.activeGateIds?.includes(gateId)) {
    return failure("GATE_CONTENT_MISSING", "The next Gate is missing, misplaced, or already active.");
  }
  next.privateState.deckOrderById.gates.shift();
  if (!next.privateState.deckOrderById.gates.length && next.discardedGateIds?.length) {
    next.privateState.deckOrderById.gates = context.shuffle(next.discardedGateIds);
    next.discardedGateIds = [];
  }
  let opened = next;
  const events: GameEvent[] = [{ type: "GATE_OPENED", gateId, locationId: gate.locationId }];
  if (opened.privateState.tokenPoolById.monsters?.length) {
    const spawned = spawnMonsterFromCup(opened, gate.locationId, content, context);
    if (!spawned.ok) return spawned;
    opened = spawned.state;
    opened.stateVersion = state.stateVersion;
    events.push(...spawned.events);
  }
  opened.activeGateIds = [...(opened.activeGateIds ?? []), gateId];
  return success(opened, events);
}

/** Internal Clue effect; a location override supports effects that ignore the token's printed space. */
export function spawnClueFromPool(state: GameState, content: GameContent, context: EngineContext, atLocationId?: LocationId): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has ended.");
  if (state.phase === "lobby") return failure("WRONG_PHASE", "Clues cannot spawn before setup.");
  if (atLocationId && !content.map.locationTypes[atLocationId]) return failure("CLUE_CONTENT_MISSING", "The specified Clue space is not on the board.");
  const pool = state.privateState.tokenPoolById.clues;
  const discard = state.privateState.tokenPoolById.clue_discard ?? [];
  if (!pool) return failure("CLUE_CONTENT_MISSING", "The Clue pool is not initialized.");
  if (!pool.length && !discard.length) return failure("CLUE_UNAVAILABLE", "No Clue token remains available.");
  const available = pool.length ? pool : context.shuffle(discard);
  const { token: clueId, remaining } = context.drawToken(available);
  const token = content.clues?.find(clue => clue.id === clueId);
  if (!token) return failure("CLUE_CONTENT_MISSING", "The drawn Clue is missing from the token catalog.");
  const locationId = atLocationId ?? token.locationId;
  if (!content.map.locationTypes[locationId]) return failure("CLUE_CONTENT_MISSING", "The Clue's printed space is not on the board.");
  const id = context.createId();
  if (state.boardClues?.some(clue => clue.id === id)) return failure("CLUE_CONTENT_MISSING", "The Clue marker ID is already in use.");
  const next = structuredClone(state);
  next.privateState.tokenPoolById.clues = remaining;
  if (!pool.length) next.privateState.tokenPoolById.clue_discard = [];
  next.privateState.tokenPoolById[`board_clue:${id}`] = [clueId];
  next.boardClues = [...(next.boardClues ?? []), { id, locationId }];
  return success(next, [{ type: "CLUE_SPAWNED", clueId: id, locationId }]);
}

/** Internal Mythos icon step; the caller must resolve preceding printed icons first. */
export function spawnMythosClues(state: GameState, content: GameContent, context: EngineContext): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has ended.");
  if (state.phase !== "mythos" || !state.currentMythosCardId || state.pendingDecision || state.activeTest || state.pendingDefeat) {
    return failure("WRONG_PHASE", "A revealed Mythos card is required to spawn Clues.");
  }
  if (state.resolvedMythosClueCardId === state.currentMythosCardId) return failure("MYTHOS_CARD_ACTIVE", "This card's Clue icon has already resolved.");
  const card = content.mythosCards?.find(candidate => candidate.id === state.currentMythosCardId);
  if (!card?.icons?.some(icon => icon.type === "spawn_clues")) return failure("MYTHOS_CONTENT_MISSING", "The revealed card has no verified Clue icon.");
  if (card.icons.findIndex(icon => icon.type === "spawn_clues") !== (state.currentMythosIconIndex ?? 0)) {
    return failure("MYTHOS_CARD_ACTIVE", "Resolve preceding Mythos icons first.");
  }
  const count = content.referenceCards?.find(reference => reference.playerCount === state.players.length)?.spawnClues;
  if (!count || !Number.isSafeInteger(count)) return failure("MYTHOS_CONTENT_MISSING", "The Clue icon count is missing from the reference card.");
  let next = structuredClone(state);
  const events: GameEvent[] = [];
  for (let index = 0; index < count; index += 1) {
    if (!next.privateState.tokenPoolById.clues?.length && !next.privateState.tokenPoolById.clue_discard?.length) break;
    const spawned = spawnClueFromPool(next, content, context);
    if (!spawned.ok) return spawned;
    next = spawned.state;
    events.push(...spawned.events);
  }
  next.resolvedMythosClueCardId = state.currentMythosCardId;
  next.currentMythosIconIndex = (state.currentMythosIconIndex ?? 0) + 1;
  next.stateVersion = state.stateVersion;
  return success(next, events);
}

/** Internal second green Mythos icon: each matching Gate surges, or one Gate opens. */
export function resolveMythosMonsterSurge(state: GameState, content: GameContent, context: EngineContext): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has ended.");
  if (state.phase !== "mythos" || !state.currentMythosCardId || state.pendingDecision || state.activeTest || state.pendingDefeat) {
    return failure("WRONG_PHASE", "A revealed Mythos card is required for Monster Surge.");
  }
  const card = content.mythosCards?.find(candidate => candidate.id === state.currentMythosCardId);
  if (card?.icons?.[1]?.type !== "monster_surge") return failure("MYTHOS_CONTENT_MISSING", "The revealed card has no verified Monster Surge icon at this position.");
  if (state.currentMythosIconIndex !== 1) return failure("MYTHOS_CARD_ACTIVE", "Resolve preceding Mythos icons first.");
  const omen = state.omen === undefined ? undefined : omenTrack[state.omen];
  if (!omen) return failure("OMEN_CONTENT_MISSING", "The current Omen is unavailable.");
  const activeGates = (state.activeGateIds ?? []).map(id => content.gates?.find(gate => gate.id === id));
  if (activeGates.some(gate => !gate)) return failure("GATE_CONTENT_MISSING", "An active Gate is missing from content.");
  const matchingGates = activeGates.filter(gate => gate?.omenSymbol === omen);
  let next = structuredClone(state);
  const events: GameEvent[] = [];
  if (!matchingGates.length) {
    const opened = openGateFromStack(next, content, context);
    if (!opened.ok) return opened;
    next = opened.state;
    events.push(...opened.events);
  } else {
    const count = content.referenceCards?.find(reference => reference.playerCount === state.players.length)?.monsterSurge;
    if (!count || !Number.isSafeInteger(count)) return failure("MYTHOS_CONTENT_MISSING", "The Monster Surge count is missing from the reference card.");
    for (const gate of matchingGates) {
      for (let index = 0; index < count; index += 1) {
        if (!next.privateState.tokenPoolById.monsters?.length) break;
        const spawned = spawnMonsterFromCup(next, gate!.locationId, content, context);
        if (!spawned.ok) return spawned;
        next = spawned.state;
        events.push(...spawned.events);
      }
    }
  }
  next.currentMythosIconIndex = 2;
  next.stateVersion = state.stateVersion;
  return success(next, events);
}

/** Internal third yellow Mythos icon; Reckoning must advance the cursor first. */
export function resolveMythosSpawnGates(state: GameState, content: GameContent, context: EngineContext): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has ended.");
  if (state.phase !== "mythos" || !state.currentMythosCardId || state.pendingDecision || state.activeTest || state.pendingDefeat) {
    return failure("WRONG_PHASE", "A revealed Mythos card is required to spawn Gates.");
  }
  const card = content.mythosCards?.find(candidate => candidate.id === state.currentMythosCardId);
  if (card?.icons?.[2]?.type !== "spawn_gates") return failure("MYTHOS_CONTENT_MISSING", "The revealed card has no verified Spawn Gates icon at this position.");
  if (state.currentMythosIconIndex !== 2) return failure("MYTHOS_CARD_ACTIVE", "Resolve preceding Mythos icons first.");
  const count = content.referenceCards?.find(reference => reference.playerCount === state.players.length)?.spawnGates;
  if (!count || !Number.isSafeInteger(count)) return failure("MYTHOS_CONTENT_MISSING", "The Gate spawn count is missing from the reference card.");
  if (!state.privateState.deckOrderById.gates) return failure("GATE_CONTENT_MISSING", "The Gate stack is not initialized.");
  let next = structuredClone(state);
  const events: GameEvent[] = [];
  for (let index = 0; index < count; index += 1) {
    if (!next.privateState.deckOrderById.gates?.length) break;
    const opened = openGateFromStack(next, content, context);
    if (!opened.ok) return opened;
    next = opened.state;
    events.push(...opened.events);
  }
  next.currentMythosIconIndex = 3;
  next.stateVersion = state.stateVersion;
  return success(next, events);
}

/** Internal yellow Reckoning slice; refuses every effect category not yet executable. */
export function resolveMythosReckoning(state: GameState, content: GameContent, context: EngineContext): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has ended.");
  if (state.phase !== "mythos" || !state.currentMythosCardId || state.pendingDecision || state.activeTest || state.pendingDefeat) {
    return failure("WRONG_PHASE", "A revealed Mythos card is required for Reckoning.");
  }
  const card = content.mythosCards?.find(candidate => candidate.id === state.currentMythosCardId);
  if (card?.icons?.[1]?.type !== "resolve_reckoning") return failure("MYTHOS_CONTENT_MISSING", "The revealed card has no verified Reckoning icon at this position.");
  if (state.currentMythosIconIndex !== 1) return failure("MYTHOS_CARD_ACTIVE", "Resolve preceding Mythos icons first.");
  const ancient = state.ancientOneId ? content.ancientOnes?.[state.ancientOneId] : undefined;
  if (!ancient || !ancient.reckoningEffectIds || ancient.reckoningEffectIds.length || state.awakened) {
    return failure("RECKONING_UNSUPPORTED", "The Ancient One's Reckoning is not executable yet.");
  }
  for (const instance of state.monsters ?? []) {
    const monster = content.monsters?.find(candidate => candidate.id === instance.monsterId);
    if (!monster) return failure("MONSTER_CONTENT_MISSING", "An on-board Monster is missing from content.");
    if (monster.reckoningEffect) return failure("RECKONING_UNSUPPORTED", "An on-board Monster has an unsupported Reckoning effect.");
  }
  if (!state.leadInvestigatorId) return failure("PLAYER_NOT_FOUND", "The Lead Investigator is missing.");
  const leadIndex = state.players.findIndex(player => player.id === state.leadInvestigatorId);
  if (leadIndex < 0) return failure("PLAYER_NOT_FOUND", "The Lead Investigator is missing.");
  const ordered = [...state.players.slice(leadIndex), ...state.players.slice(0, leadIndex)].filter(player => !player.defeated && !player.eliminated);
  for (const player of ordered) {
    if (player.assetIds.length) return failure("RECKONING_UNSUPPORTED", "Possession Reckoning effects are not executable yet.");
    const held = player.conditionIds ?? [];
    if (held.length > 1) return failure("RECKONING_UNSUPPORTED", "Multiple Conditions require investigator-selected Reckoning order.");
    for (const id of held) {
      const condition = content.conditions?.find(candidate => candidate.id === id);
      if (!condition) return failure("CONDITION_CONTENT_MISSING", "A held Condition is missing from content.");
      if (condition.kind !== "blessed" && condition.kind !== "cursed") {
        return failure("RECKONING_UNSUPPORTED", "A held Condition's Reckoning is not executable yet.");
      }
    }
  }
  let next = structuredClone(state);
  const events: GameEvent[] = [];
  for (const player of ordered) {
    const cardId = player.conditionIds?.[0];
    if (!cardId) continue;
    const resolved = resolveConditionReckoning(next, player.id, cardId, content, context);
    if (!resolved.ok) return resolved;
    next = resolved.state;
    events.push(...resolved.events);
  }
  next.currentMythosIconIndex = 2;
  next.stateVersion = state.stateVersion;
  return success(next, events);
}

/** Internal effect for gaining Clues from supply; never a client command. */
export function gainCluesFromPool(state: GameState, playerId: string, amount: number, content: GameContent, context: EngineContext): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has ended.");
  if (state.phase === "lobby") return failure("WRONG_PHASE", "Clues cannot be gained before setup.");
  const player = state.players.find(candidate => candidate.id === playerId);
  if (!player) return failure("PLAYER_NOT_FOUND", "Investigator not found.");
  if (player.defeated || player.eliminated) return failure("INVESTIGATOR_DEFEATED", "No active investigator can gain Clues.");
  if (!Number.isSafeInteger(amount) || amount < 1) return failure("CLUE_CONTENT_MISSING", "Clue gain must be a positive integer.");
  const pool = state.privateState.tokenPoolById.clues;
  const held = state.privateState.tokenPoolById[heldClueKey(playerId)];
  if (!pool || !held || held.length !== player.clues) return failure("CLUE_CONTENT_MISSING", "Physical Clue holdings are inconsistent.");
  const next = structuredClone(state);
  let gained = 0;
  for (let index = 0; index < amount; index += 1) {
    const available = next.privateState.tokenPoolById.clues;
    const discard = next.privateState.tokenPoolById.clue_discard ?? [];
    if (!available.length && !discard.length) break;
    const recycled = available.length === 0;
    const source = recycled ? context.shuffle(discard) : available;
    const { token, remaining } = context.drawToken(source);
    if (!content.clues?.some(clue => clue.id === token)) return failure("CLUE_CONTENT_MISSING", "The drawn Clue is missing from content.");
    next.privateState.tokenPoolById.clues = remaining;
    if (recycled) next.privateState.tokenPoolById.clue_discard = [];
    next.privateState.tokenPoolById[heldClueKey(playerId)]!.push(token);
    gained += 1;
  }
  next.players.find(candidate => candidate.id === playerId)!.clues += gained;
  return success(next, gained ? [{ type: "CLUE_GAINED", playerId, amount: gained }] : []);
}

/** Internal encounter effect: take one opaque marker at this investigator's space. */
/** Internal printed encounter effect; never accepts a client-authored outcome. */
export function resolveBoardClueEffect(state: GameState, markerId: string, effect: { kind: "discard" } | { kind: "relocate"; locationId: LocationId }, content: GameContent): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has ended.");
  if (state.phase !== "encounter") return failure("WRONG_PHASE", "Research Clue effects resolve during encounters.");
  const marker = state.boardClues?.find(clue => clue.id === markerId);
  if (!marker) return failure("CLUE_UNAVAILABLE", "The encountered Clue is no longer on the board.");
  const physical = state.privateState.tokenPoolById[`board_clue:${markerId}`];
  if (!physical || physical.length !== 1 || !content.clues?.some(clue => clue.id === physical[0])) return failure("CLUE_CONTENT_MISSING", "The encountered physical Clue is unavailable.");
  if (effect.kind === "relocate" && !content.map.locationTypes[effect.locationId]) return failure("CLUE_CONTENT_MISSING", "The destination is not on the board.");
  const next = structuredClone(state);
  if (effect.kind === "relocate") {
    next.boardClues!.find(clue => clue.id === markerId)!.locationId = effect.locationId;
    return success(next, [{ type: "CLUE_RELOCATED", clueId: markerId, fromLocationId: marker.locationId, locationId: effect.locationId }]);
  }
  next.boardClues = next.boardClues!.filter(clue => clue.id !== markerId);
  next.privateState.tokenPoolById.clue_discard = [...(next.privateState.tokenPoolById.clue_discard ?? []), physical[0]!];
  delete next.privateState.tokenPoolById[`board_clue:${markerId}`];
  return success(next, [{ type: "CLUE_DISCARDED", clueId: markerId, locationId: marker.locationId }]);
}

export function collectBoardClue(state: GameState, playerId: string, markerId: string): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has ended.");
  if (state.phase !== "encounter") return failure("WRONG_PHASE", "Board Clues are collected during encounters.");
  const player = state.players.find(candidate => candidate.id === playerId);
  if (!player) return failure("PLAYER_NOT_FOUND", "Investigator not found.");
  if (player.defeated || player.eliminated) return failure("INVESTIGATOR_DEFEATED", "This investigator cannot collect a Clue.");
  const marker = state.boardClues?.find(clue => clue.id === markerId);
  if (!marker || marker.locationId !== player.locationId) return failure("CLUE_UNAVAILABLE", "No Clue is available at this investigator's space.");
  const physical = state.privateState.tokenPoolById[`board_clue:${markerId}`];
  const held = state.privateState.tokenPoolById[heldClueKey(playerId)];
  if (!physical || physical.length !== 1 || !held || held.length !== player.clues) return failure("CLUE_CONTENT_MISSING", "Physical Clue holdings are inconsistent.");
  const next = structuredClone(state);
  next.boardClues = next.boardClues!.filter(clue => clue.id !== markerId);
  next.privateState.tokenPoolById[heldClueKey(playerId)]!.push(physical[0]!);
  delete next.privateState.tokenPoolById[`board_clue:${markerId}`];
  next.players.find(candidate => candidate.id === playerId)!.clues += 1;
  return success(next, [{ type: "CLUE_COLLECTED", clueId: markerId, playerId, locationId: marker.locationId }]);
}

/** Internal Mythos Omen effect; Ancient One awakening remains explicit, never inferred by the client. */
export function advanceOmen(state: GameState, content: GameContent): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has ended.");
  if (state.phase !== "mythos") return failure("WRONG_PHASE", "Omen advances during Mythos resolution.");
  return resolveOmenAdvanceEffect(state, content);
}

/** Shared internal printed effect; callers enforce Mythos/Encounter timing. */
function resolveOmenAdvanceEffect(state: GameState, content: GameContent): CommandResult {
  if (state.omen === undefined || state.doom === undefined || !state.ancientOneId) return failure("OMEN_CONTENT_MISSING", "Omen, Doom, or Ancient One setup is missing.");
  if (!Number.isInteger(state.omen) || state.omen < 0 || state.omen >= omenTrack.length || !Number.isSafeInteger(state.greenOmenTokens ?? 0) || (state.greenOmenTokens ?? 0) < 0) return failure("OMEN_CONTENT_MISSING", "The Omen position or Eldritch count is invalid.");
  const activeGateSymbols = (state.activeGateIds ?? []).map(id => content.gates?.find(gate => gate.id === id)?.omenSymbol);
  if (activeGateSymbols.some(symbol => symbol === undefined)) return failure("GATE_CONTENT_MISSING", "An active Gate is missing its Omen symbol.");
  const result = advanceOmenTrack(state.omen, 1, activeGateSymbols as ("comet" | "constellation" | "eclipse")[]);
  const azathothGreenDoom = state.ancientOneId === "azathoth" && result.position === 0 ? state.greenOmenTokens ?? 0 : 0;
  const doomAdvance = result.doomAdvanceFromGates + azathothGreenDoom;
  if (doomAdvance >= state.doom && state.ancientOneId !== "azathoth") return failure("AWAKENING_UNSUPPORTED", "Ancient One awakening is not implemented yet.");
  const next = structuredClone(state);
  next.omen = result.position;
  next.doom = Math.max(0, state.doom - doomAdvance);
  const events: GameEvent[] = [{ type: "OMEN_ADVANCED", position: result.position, symbol: result.symbol, doomAdvance }];
  if (next.doom === 0 && state.ancientOneId === "azathoth") {
    next.gameResult = "investigators_lose";
    events.push({ type: "GAME_ENDED", result: "investigators_lose", reason: "azathoth_awakened" });
  }
  return success(next, events);
}

/** Printed Perplexing Stars text: move, rather than advance, Omen before counting matching Gates. */
function resolveCounterclockwiseOmenCard(state: GameState, content: GameContent): CommandResult {
  if (state.phase !== "mythos" || state.omen === undefined || !Number.isInteger(state.omen) || state.omen < 0 || state.omen >= omenTrack.length
    || state.doom === undefined || !state.ancientOneId) return failure("OMEN_CONTENT_MISSING", "Omen, Doom, or Ancient One setup is missing.");
  const gateSymbols = (state.activeGateIds ?? []).map(id => content.gates?.find(gate => gate.id === id)?.omenSymbol);
  if (gateSymbols.some(symbol => symbol === undefined)) return failure("GATE_CONTENT_MISSING", "An active Gate is missing its Omen symbol.");
  const position = (state.omen + omenTrack.length - 1) % omenTrack.length;
  const symbol = omenTrack[position]!;
  const doomAdvance = gateSymbols.filter(gateSymbol => gateSymbol === symbol).length;
  if (doomAdvance >= state.doom && state.ancientOneId !== "azathoth") return failure("AWAKENING_UNSUPPORTED", "Ancient One awakening is not implemented yet.");
  const next = structuredClone(state);
  next.omen = position;
  next.doom = Math.max(0, state.doom - doomAdvance);
  const events: GameEvent[] = [{ type: "OMEN_MOVED", position, symbol, direction: "counterclockwise", doomAdvance }];
  if (next.doom === 0 && state.ancientOneId === "azathoth") {
    next.gameResult = "investigators_lose";
    events.push({ type: "GAME_ENDED", result: "investigators_lose", reason: "azathoth_awakened" });
  }
  return success(next, events);
}

export function resolveCombatEncounter(state: GameState, playerId: string, monsterInstanceId: string, content: GameContent, context: EngineContext): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has ended.");
  if (state.phase !== "encounter" || state.activePlayerId !== playerId || state.pendingDecision || state.pendingDefeat || state.activeTest) {
    return failure("WRONG_PHASE", "Combat is unavailable during this resolution.");
  }
  const player = state.players.find(candidate => candidate.id === playerId);
  if (!player || player.defeated || player.eliminated || !player.investigatorId || !player.locationId) {
    return failure("INVESTIGATOR_DEFEATED", "No active investigator can fight.");
  }
  const instance = state.monsters?.find(monster => monster.id === monsterInstanceId);
  if (!instance || instance.locationId !== player.locationId || instance.damage < 0) {
    return failure("INVALID_COMBAT", "That Monster is not on the investigator's space.");
  }
  const monster = content.monsters?.find(candidate => candidate.id === instance.monsterId);
  if (!monster) return failure("MONSTER_CONTENT_MISSING", "The Monster's combat statistics are unavailable.");
  if (monster.specialEffect || monster.horrorCheck === "ancient_one" || monster.damageCheck === "ancient_one" || monster.toughness === "ancient_one") {
    return failure("MONSTER_EFFECT_UNSUPPORTED", "This Monster requires a card-specific combat handler.");
  }
  // Possession combat bonuses and abilities must be typed before this transition can be
  // exposed as a general client command. Never silently ignore a carried Asset.
  if (player.assetIds.length) return failure("MONSTER_EFFECT_UNSUPPORTED", "Combat effects on possessions are not executable yet.");
  const investigator = content.investigators[player.investigatorId];
  if (!investigator) return failure("INVESTIGATOR_CONTENT_MISSING", "Investigator skills are missing.");
  const toughness = monster.toughness.base + monster.toughness.perInvestigator * state.players.filter(candidate => !candidate.defeated && !candidate.eliminated).length;
  const combat = resolveStandardCombat({
    will: investigator.skills.will,
    strength: investigator.skills.strength,
    willImprovement: player.skillImprovements.will,
    strengthImprovement: player.skillImprovements.strength,
    successThreshold: conditionSuccessThreshold(player.conditionIds ?? []),
    currentHealth: player.health ?? 0,
    currentSanity: player.sanity ?? 0,
    monsterDamage: instance.damage,
    monsterToughness: toughness,
    horrorCheck: monster.horrorCheck,
    damageCheck: monster.damageCheck,
  }, context.rollDie);
  const next = structuredClone(state);
  const target = next.monsters!.find(candidate => candidate.id === monsterInstanceId)!;
  target.damage += combat.monsterHealthLost;
  const events: GameEvent[] = [{
    type: "COMBAT_RESOLVED", playerId, monsterInstanceId,
    horrorDice: combat.horrorTest?.dice ?? [], strengthDice: combat.strengthTest?.dice ?? [],
    sanityLost: combat.sanityLost, healthLost: combat.healthLost, monsterHealthLost: combat.monsterHealthLost,
  }];
  if (combat.monsterDefeated) {
    next.monsters = next.monsters!.filter(candidate => candidate.id !== monsterInstanceId);
    next.monsterLocationIds = [...new Set(next.monsters.map(candidate => candidate.locationId))];
    if (monster.type === "normal" && !instance.setAside) {
      next.privateState.tokenPoolById.monsters = [...(next.privateState.tokenPoolById.monsters ?? []), instance.monsterId];
    }
    events.push({ type: "MONSTER_DEFEATED", monsterInstanceId, monsterId: monster.id });
  }
  if (combat.healthLost || combat.sanityLost) {
    const damaged = damageInvestigator(next, playerId, combat.healthLost, combat.sanityLost, content);
    if (!damaged.ok) return damaged;
    return success(damaged.state, [...events, ...damaged.events]);
  }
  return success(next, events);
}

/** Called only after all Mythos card effects finish; no client phase-skip command. */
export function openReplacementWindow(state: GameState, content?: GameContent): CommandResult {
  if (state.phase !== "mythos" || state.pendingDefeat || state.pendingDecision || state.currentMythosCardId || state.gameResult) return failure("WRONG_PHASE", "Mythos effects must finish first.");
  const next = structuredClone(state);
  next.replacementWindow = true;
  const used = new Set([...next.players.map(p => p.investigatorId), ...(next.defeatedInvestigators ?? []).map(p => p.investigatorId)]);
  const available = content ? Object.keys(content.investigators).filter(id => !used.has(id as InvestigatorId)) : [];
  if (content && !available.length) for (const player of next.players) if (player.defeated) player.eliminated = true;
  if (next.players.every(player => player.eliminated)) {
    next.gameResult = "investigators_lose";
    return success(next, [{ type: "GAME_ENDED", result: "investigators_lose", reason: "all_players_eliminated" }]);
  }
  return success(next, []);
}

/** Draws the top private card and resolves its first printed icon atomically. */
export function drawMythosCard(state: GameState, content: GameContent, context?: EngineContext): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has ended.");
  if (state.phase !== "mythos" || state.pendingDecision || state.activeTest || state.pendingDefeat || state.replacementWindow) {
    return failure("WRONG_PHASE", "Finish the current resolution before drawing Mythos.");
  }
  if (state.currentMythosCardId) return failure("MYTHOS_CARD_ACTIVE", "Resolve the revealed Mythos card before drawing another.");
  const deck = state.privateState.deckOrderById.mythos;
  if (!deck) return failure("MYTHOS_DECK_MISSING", "The Mythos deck has not been initialized.");
  if (deck.length === 0) {
    const next = structuredClone(state);
    next.gameResult = "investigators_lose";
    return success(next, [{ type: "GAME_ENDED", result: "investigators_lose", reason: "mythos_deck_exhausted" }]);
  }
  const topId = deck[0]!;
  const card = content.mythosCards?.find(candidate => candidate.id === topId);
  if (!card) return failure("MYTHOS_CONTENT_MISSING", "The next Mythos card is missing from content.");
  if (card.color === "blue" && card.icons?.[0]?.type !== "spawn_clues") return failure("MYTHOS_CONTENT_MISSING", "The blue card's first Clue icon is missing.");
  if (card.color !== "blue" && card.icons?.[0]?.type !== "advance_omen") return failure("MYTHOS_CONTENT_MISSING", "The card's first Omen icon is missing.");
  if (card.color === "blue" && !context) return failure("RANDOM_INPUT_REQUIRED", "The Clue icon requires server randomness.");
  const next = structuredClone(state);
  next.currentMythosCardId = next.privateState.deckOrderById.mythos!.shift();
  next.currentMythosIconIndex = 0;
  if (card.color === "blue") {
    const spawned = spawnMythosClues(next, content, context!);
    if (!spawned.ok) return spawned;
    spawned.state.stateVersion = state.stateVersion;
    return success(spawned.state, [{ type: "MYTHOS_CARD_REVEALED", cardId: topId }, ...spawned.events]);
  }
  const advanced = advanceOmen(next, content);
  if (!advanced.ok) return advanced;
  advanced.state.currentMythosIconIndex = 1;
  advanced.state.stateVersion = state.stateVersion;
  return success(advanced.state, [{ type: "MYTHOS_CARD_REVEALED", cardId: topId }, ...advanced.events]);
}

/** Resolve exactly one verified printed icon; card text is never skipped. */
export function advanceMythosIcon(state: GameState, content: GameContent, context: EngineContext): CommandResult {
  if (state.phase !== "mythos") return failure("WRONG_PHASE", "Mythos icons resolve only during Mythos.");
  if (!state.currentMythosCardId) return drawMythosCard(state, content, context);
  const card = content.mythosCards?.find(candidate => candidate.id === state.currentMythosCardId);
  if (!card?.icons) return failure("MYTHOS_CONTENT_MISSING", "The revealed card's printed icons are unavailable.");
  const icon = card.icons[state.currentMythosIconIndex ?? 0];
  if (!icon) {
    if (!card.effect || !state.leadInvestigatorId || state.pendingDecision || state.pendingDefeat || state.activeTest) return failure("MYTHOS_EFFECT_UNSUPPORTED", "The revealed card's printed text is not executable yet.");
    if (card.effect.type === "lead_choose_omen_without_doom") {
      if (state.omen === undefined || !Number.isInteger(state.omen) || state.omen < 0 || state.omen >= omenTrack.length) return failure("OMEN_CONTENT_MISSING", "The current Omen space is unavailable.");
      const next = structuredClone(state);
      next.pendingDecision = {
        id: context.createId(), kind: "choose_omen_space", playerId: state.leadInvestigatorId, visibility: "owner",
        prompt: "Omen of Good Fortune: move the Omen to any space, or leave it where it is, without advancing Doom.",
        optionIds: ["stay", ...omenTrack.map((_, position) => `omen_${position}`)],
        minSelections: 1, maxSelections: 1, continuation: "mythos_omen_choice",
      };
      return success(next, []);
    }
    if (card.effect.type === "each_investigator_choose_world_fights_back") {
      const ordered = mythosInvestigatorOrder(state);
      if (!ordered.length) return finishMythosEvent(state, structuredClone(state), [], content);
      const next = structuredClone(state);
      next.pendingDecision = worldFightsBackDecision(next, ordered[0]!, content, context);
      return success(next, []);
    }
    if (card.effect.type === "lead_gain_ally_asset") {
      const gained = gainAllyAssetFromDeck(state, state.leadInvestigatorId, content, context);
      if (!gained.ok) return gained;
      return finishMythosEvent(state, gained.state, gained.events, content);
    }
    if (card.effect.type === "each_investigator_trade_debt_for_condition") {
      const ordered = mythosInvestigatorOrder(state);
      if (!ordered.length) return finishMythosEvent(state, structuredClone(state), [], content);
      const next = structuredClone(state);
      next.pendingDecision = debtTradeDecision(next, ordered[0]!, content, context);
      return success(next, []);
    }
    if (card.effect.type === "discard_matching_gates_and_advance_doom") {
      const resolved = resolveDimensionalInstability(state, content, context);
      if (!resolved.ok || resolved.state.gameResult) return resolved;
      return finishMythosEvent(state, resolved.state, resolved.events, content);
    }
    if (card.effect.type === "doom_two_unless_lead_gains_dark_pact") {
      if (state.doom === undefined || !state.ancientOneId) return failure("OMEN_CONTENT_MISSING", "Doom or Ancient One setup is missing.");
      if (!canLeadGainDarkPact(state, content)) {
        const advanced = advanceDesperateTimesDoom(state);
        if (!advanced.ok || advanced.state.gameResult) return advanced;
        return finishMythosEvent(state, advanced.state, advanced.events, content);
      }
      const next = structuredClone(state);
      next.pendingDecision = {
        id: context.createId(), kind: "choose_desperate_times", playerId: state.leadInvestigatorId, visibility: "owner",
        prompt: "Desperate Times: gain a Dark Pact Condition, or advance Doom by 2.",
        optionIds: ["gain_dark_pact", "advance_doom"], minSelections: 1, maxSelections: 1,
        continuation: "mythos_desperate_times",
      };
      return success(next, []);
    }
    if (card.effect.type === "spawn_monster_on_each_cultist_space") {
      const resolved = resolveCallingTheElderThings(state, content, context);
      if (!resolved.ok) return resolved;
      return finishMythosEvent(state, resolved.state, resolved.events, content);
    }
    if (card.effect.type === "roll_each_investigator_for_bermuda_triangle") {
      const resolved = resolveBermudaTriangle(state, content, context);
      if (!resolved.ok) return resolved;
      return finishMythosEvent(state, resolved.state, resolved.events, content);
    }
    if (card.effect.type === "group_discard_gate_then_advance_doom_if_nonmatching") {
      if (state.omen === undefined || !Number.isInteger(state.omen) || state.omen < 0 || state.omen >= omenTrack.length
        || state.doom === undefined || !state.ancientOneId) return failure("OMEN_CONTENT_MISSING", "Omen, Doom, or Ancient One setup is missing.");
      if (!state.privateState.deckOrderById.gates) return failure("GATE_CONTENT_MISSING", "The Gate stack is not initialized.");
      if ((state.activeGateIds ?? []).some(id => !content.gates?.some(gate => gate.id === id && content.map.locationTypes[gate.locationId]))) {
        return failure("GATE_CONTENT_MISSING", "An active Gate is missing from content.");
      }
      if (!state.activeGateIds?.length) return finishMythosEvent(state, structuredClone(state), [], content);
      const next = structuredClone(state);
      next.pendingDecision = {
        id: context.createId(), kind: "choose_that_which_consumes_gate", playerId: state.leadInvestigatorId, visibility: "owner",
        prompt: "That Which Consumes: agree as a group on one Gate to discard. A Gate not matching the current Omen advances Doom by 1.",
        optionIds: [...state.activeGateIds], minSelections: 1, maxSelections: 1, continuation: "mythos_that_which_consumes",
      };
      return success(next, []);
    }
    if (card.effect.type === "torn_asunder") return resolveTornAsunder(state, content);
    if (card.effect.type === "lead_discard_monster_lose_toughness_health") {
      const eligible = (state.monsters ?? []).filter(instance => content.monsters?.some(monster => monster.id === instance.monsterId && monster.type === "normal" && monster.toughness !== "ancient_one"));
      if ((state.monsters ?? []).some(instance => !content.monsters?.some(monster => monster.id === instance.monsterId))) {
        return failure("MONSTER_CONTENT_MISSING", "An on-board Monster is missing from content.");
      }
      if (!eligible.length) return finishMythosEvent(state, structuredClone(state), [], content);
      const next = structuredClone(state);
      next.pendingDecision = {
        id: context.createId(), kind: "choose_blood_flows_monster", playerId: state.leadInvestigatorId, visibility: "owner",
        prompt: "Blood Flows: discard one non-Epic Monster anywhere on the board and lose Health equal to its printed toughness.",
        optionIds: eligible.map(instance => instance.id), minSelections: 1, maxSelections: 1, continuation: "mythos_blood_flows",
      };
      return success(next, []);
    }
    if (card.effect.type === "each_investigator_choose_heat_wave") {
      const ordered = mythosInvestigatorOrder(state);
      if (!ordered.length) return finishMythosEvent(state, structuredClone(state), [], content);
      const next = structuredClone(state);
      next.pendingHeatWave = { cardId: state.currentMythosCardId, remainingPlayerIds: ordered.slice(1) };
      next.pendingDecision = heatWaveDecision(next, ordered[0]!, context);
      return success(next, []);
    }
    if (card.effect.type === "each_investigator_tide_of_despair") {
      const ordered = mythosInvestigatorOrder(state);
      if (!ordered.length) return finishMythosEvent(state, structuredClone(state), [], content);
      const next = structuredClone(state);
      next.pendingTideOfDespair = { cardId: state.currentMythosCardId, remainingPlayerIds: ordered.slice(1) };
      next.pendingDecision = tideOfDespairDecision(next, ordered[0]!, content, context);
      return success(next, []);
    }
    if (card.effect.type === "each_investigator_with_ally_betrayed") {
      const ordered = mythosInvestigatorOrder(state);
      if (ordered.some(playerId => state.players.find(player => player.id === playerId)!.assetIds.some(id => !content.assets.some(asset => asset.id === id && asset.traits)))) {
        return failure("ASSET_CONTENT_MISSING", "An investigator's Asset lacks trait content.");
      }
      const affected = ordered.filter(playerId => allyAssetsHeld(state, playerId, content).length);
      if (!affected.length) return finishMythosEvent(state, structuredClone(state), [], content);
      const next = structuredClone(state);
      next.pendingUnexpectedBetrayal = { cardId: state.currentMythosCardId, remainingPlayerIds: affected.slice(1) };
      next.pendingDecision = unexpectedBetrayalDecision(next, affected[0]!, content, context);
      return success(next, []);
    }
    if (card.effect.type === "each_investigator_from_bad_to_worse") return resolveFromBadToWorse(state, content);
    const resolved = card.effect.type === "lead_gain_condition"
      ? gainCondition(state, state.leadInvestigatorId, card.effect.kind, content, context)
      : resolveCounterclockwiseOmenCard(state, content);
    if (!resolved.ok || resolved.state.gameResult) return resolved;
    return finishMythosEvent(state, resolved.state, resolved.events, content);
  }
  if (!icon) return failure("MYTHOS_EFFECT_UNSUPPORTED", "The revealed card's printed text is not executable yet.");
  if (icon.type === "monster_surge") return resolveMythosMonsterSurge(state, content, context);
  if (icon.type === "resolve_reckoning") return resolveMythosReckoning(state, content, context);
  if (icon.type === "spawn_clues") return spawnMythosClues(state, content, context);
  if (icon.type === "spawn_gates") return resolveMythosSpawnGates(state, content, context);
  return failure("MYTHOS_EFFECT_UNSUPPORTED", "This printed Mythos icon is not executable yet.");
}

function heatWaveDecision(state: GameState, playerId: string, context: EngineContext): PendingDecision {
  const player = state.players.find(candidate => candidate.id === playerId)!;
  return {
    id: context.createId(), kind: "choose_heat_wave", playerId, visibility: "owner",
    prompt: "Heat Wave Singes the Globe: lose 3 Health unless you become Delayed.",
    optionIds: player.delayed ? ["lose_health"] : ["become_delayed", "lose_health"],
    minSelections: 1, maxSelections: 1, continuation: "mythos_heat_wave",
  };
}

function tideOfDespairDecision(state: GameState, playerId: string, content: GameContent, context: EngineContext): PendingDecision {
  const player = state.players.find(candidate => candidate.id === playerId)!;
  const hasBlessed = (player.conditionIds ?? []).some(id => content.conditions?.find(card => card.id === id)?.kind === "blessed");
  return {
    id: context.createId(), kind: "choose_tide_of_despair", playerId, visibility: "owner",
    prompt: "Tide of Despair: discard your Blessed Condition or lose 2 Health and 2 Sanity.",
    optionIds: hasBlessed ? ["discard_blessed", "lose_health_and_sanity"] : ["lose_health_and_sanity"],
    minSelections: 1, maxSelections: 1, continuation: "mythos_tide_of_despair",
  };
}

function continueTideOfDespair(state: GameState, content: GameContent, context?: EngineContext): CommandResult {
  const pending = state.pendingTideOfDespair;
  const card = content.mythosCards?.find(candidate => candidate.id === state.currentMythosCardId);
  if (state.phase !== "mythos" || state.pendingDefeat || state.pendingDecision || !pending || pending.cardId !== state.currentMythosCardId
    || card?.effect?.type !== "each_investigator_tide_of_despair" || state.currentMythosIconIndex !== card.icons?.length) {
    return failure("MYTHOS_CONTENT_MISSING", "The remaining choices are no longer attached to Tide of Despair.");
  }
  const next = structuredClone(state);
  const following = next.pendingTideOfDespair!.remainingPlayerIds.shift();
  if (following) {
    if (!context) return failure("RANDOM_INPUT_REQUIRED", "The next Tide of Despair choice requires a server-generated ID.");
    next.pendingDecision = tideOfDespairDecision(next, following, content, context);
    return success(next, []);
  }
  next.pendingTideOfDespair = undefined;
  return finishMythosEvent(state, next, [], content);
}

function allyAssetsHeld(state: GameState, playerId: string, content: GameContent): string[] {
  const player = state.players.find(candidate => candidate.id === playerId);
  return (player?.assetIds ?? []).filter(id => content.assets.some(asset => asset.id === id && asset.traits?.includes("ally")));
}

function unexpectedBetrayalDecision(state: GameState, playerId: string, content: GameContent, context: EngineContext): PendingDecision {
  return {
    id: context.createId(), kind: "choose_unexpected_betrayal_ally", playerId, visibility: "owner",
    prompt: "Unexpected Betrayal: lose 3 Health, then discard one of your Ally Assets.",
    optionIds: allyAssetsHeld(state, playerId, content), minSelections: 1, maxSelections: 1,
    continuation: "mythos_unexpected_betrayal",
  };
}

function continueUnexpectedBetrayal(state: GameState, content: GameContent, context?: EngineContext): CommandResult {
  const pending = state.pendingUnexpectedBetrayal;
  const card = content.mythosCards?.find(candidate => candidate.id === state.currentMythosCardId);
  if (state.phase !== "mythos" || state.pendingDefeat || state.pendingDecision || !pending || pending.cardId !== state.currentMythosCardId
    || card?.effect?.type !== "each_investigator_with_ally_betrayed" || state.currentMythosIconIndex !== card.icons?.length) {
    return failure("MYTHOS_CONTENT_MISSING", "The remaining choices are no longer attached to Unexpected Betrayal.");
  }
  const next = structuredClone(state);
  const following = next.pendingUnexpectedBetrayal!.remainingPlayerIds.shift();
  if (following) {
    if (!context) return failure("RANDOM_INPUT_REQUIRED", "The next Unexpected Betrayal choice requires a server-generated ID.");
    next.pendingDecision = unexpectedBetrayalDecision(next, following, content, context);
    return success(next, []);
  }
  next.pendingUnexpectedBetrayal = undefined;
  return finishMythosEvent(state, next, [], content);
}

function continueHeatWave(state: GameState, content: GameContent, context?: EngineContext): CommandResult {
  const pending = state.pendingHeatWave;
  const card = content.mythosCards?.find(candidate => candidate.id === state.currentMythosCardId);
  if (state.phase !== "mythos" || state.pendingDefeat || state.pendingDecision || !pending || pending.cardId !== state.currentMythosCardId
    || card?.effect?.type !== "each_investigator_choose_heat_wave" || state.currentMythosIconIndex !== card.icons?.length) {
    return failure("MYTHOS_CONTENT_MISSING", "The remaining choices are no longer attached to Heat Wave.");
  }
  const next = structuredClone(state);
  const following = next.pendingHeatWave!.remainingPlayerIds.shift();
  if (following) {
    if (!context) return failure("RANDOM_INPUT_REQUIRED", "The next Heat Wave choice requires a server-generated ID.");
    next.pendingDecision = heatWaveDecision(next, following, context);
    return success(next, []);
  }
  next.pendingHeatWave = undefined;
  return finishMythosEvent(state, next, [], content);
}

function resolveTornAsunder(state: GameState, content: GameContent): CommandResult {
  if (state.omen === undefined || !Number.isInteger(state.omen) || state.omen < 0 || state.omen >= omenTrack.length
    || state.doom === undefined || !state.ancientOneId) return failure("OMEN_CONTENT_MISSING", "Omen, Doom, or Ancient One setup is missing.");
  const activeGates = (state.activeGateIds ?? []).map(id => content.gates?.find(gate => gate.id === id));
  if (activeGates.some(gate => !gate || !content.map.locationTypes[gate.locationId])) return failure("GATE_CONTENT_MISSING", "An active Gate is missing from content.");
  const healthLoss = activeGates.filter(gate => gate?.omenSymbol === omenTrack[state.omen!]).length;
  if (healthLoss === 0) {
    const advanced = advanceOmen(state, content);
    if (!advanced.ok || advanced.state.gameResult) return advanced;
    return finishMythosEvent(state, advanced.state, advanced.events, content);
  }
  const ordered = mythosInvestigatorOrder(state);
  const affected = ordered.map(id => state.players.find(player => player.id === id)!);
  if (affected.some(player => !player.investigatorId || !player.locationId || player.health === undefined || player.sanity === undefined)) {
    return failure("INVESTIGATOR_CONTENT_MISSING", "An affected investigator is missing Health or location setup.");
  }
  if (state.ancientOneId !== "azathoth" && affected.filter(player => player.health! <= healthLoss).length >= state.doom) {
    return failure("AWAKENING_UNSUPPORTED", "Ancient One awakening is not implemented yet.");
  }
  const next = structuredClone(state);
  next.pendingMythosDamage = { cardId: state.currentMythosCardId!, remainingPlayerIds: ordered, healthLoss };
  return continueMythosDamage(next, content);
}

function continueMythosDamage(state: GameState, content: GameContent): CommandResult {
  const pending = state.pendingMythosDamage;
  const card = content.mythosCards?.find(candidate => candidate.id === state.currentMythosCardId);
  if (state.phase !== "mythos" || state.pendingDefeat || !pending || pending.cardId !== state.currentMythosCardId
    || card?.effect?.type !== "torn_asunder" || state.currentMythosIconIndex !== card.icons?.length) {
    return failure("MYTHOS_CONTENT_MISSING", "The remaining damage is no longer attached to Torn Asunder.");
  }
  let next = structuredClone(state);
  const events: GameEvent[] = [];
  while (next.pendingMythosDamage?.remainingPlayerIds.length) {
    const playerId = next.pendingMythosDamage.remainingPlayerIds.shift()!;
    const damaged = damageInvestigator(next, playerId, pending.healthLoss, 0, content);
    if (!damaged.ok) return damaged;
    next = damaged.state;
    next.stateVersion = state.stateVersion;
    events.push(...damaged.events);
    if (next.pendingDefeat || next.gameResult) return success(next, events);
  }
  next.pendingMythosDamage = undefined;
  return finishMythosEvent(state, next, events, content);
}

function fromBadToWorseLosses(player: EnginePlayer, content: GameContent): { health: number; sanity: number; clues: number } | undefined {
  const conditions = (player.conditionIds ?? []).map(id => content.conditions?.find(card => card.id === id));
  if (conditions.some(condition => !condition?.trait)) return undefined;
  return {
    health: conditions.filter(condition => condition?.trait === "injury").length,
    sanity: conditions.filter(condition => condition?.trait === "madness").length,
    clues: conditions.filter(condition => condition?.trait === "deal").length,
  };
}

function resolveFromBadToWorse(state: GameState, content: GameContent): CommandResult {
  if (state.doom === undefined || !state.ancientOneId) return failure("OMEN_CONTENT_MISSING", "Doom or Ancient One setup is missing.");
  const ordered = mythosInvestigatorOrder(state);
  const affected = ordered.map(id => state.players.find(player => player.id === id)!);
  if (affected.some(player => !player.investigatorId || !player.locationId || player.health === undefined || player.sanity === undefined)) {
    return failure("INVESTIGATOR_CONTENT_MISSING", "An affected investigator is missing Health or location setup.");
  }
  const losses = affected.map(player => fromBadToWorseLosses(player, content));
  if (losses.some(loss => !loss)) return failure("CONDITION_CONTENT_MISSING", "A held Condition lacks a verified trait.");
  if (state.privateState.tokenPoolById.clues && affected.some(player => (state.privateState.tokenPoolById[heldClueKey(player.id)]?.length ?? 0) !== player.clues)) {
    return failure("CLUE_CONTENT_MISSING", "An investigator's physical Clues are unavailable.");
  }
  if (state.ancientOneId !== "azathoth" && affected.filter((player, index) =>
    player.health! <= losses[index]!.health || player.sanity! <= losses[index]!.sanity).length >= state.doom) {
    return failure("AWAKENING_UNSUPPORTED", "Ancient One awakening is not implemented yet.");
  }
  const next = structuredClone(state);
  next.pendingFromBadToWorse = { cardId: state.currentMythosCardId!, remainingPlayerIds: ordered };
  return continueFromBadToWorse(next, content);
}

function continueFromBadToWorse(state: GameState, content: GameContent): CommandResult {
  const pending = state.pendingFromBadToWorse;
  const card = content.mythosCards?.find(candidate => candidate.id === state.currentMythosCardId);
  if (state.phase !== "mythos" || state.pendingDefeat || !pending || pending.cardId !== state.currentMythosCardId
    || card?.effect?.type !== "each_investigator_from_bad_to_worse" || state.currentMythosIconIndex !== card.icons?.length) {
    return failure("MYTHOS_CONTENT_MISSING", "The remaining losses are no longer attached to From Bad to Worse.");
  }
  let next = structuredClone(state);
  const events: GameEvent[] = [];
  while (next.pendingFromBadToWorse?.remainingPlayerIds.length) {
    const playerId = next.pendingFromBadToWorse.remainingPlayerIds.shift()!;
    const player = next.players.find(candidate => candidate.id === playerId);
    if (!player || player.defeated || player.eliminated) continue;
    const losses = fromBadToWorseLosses(player, content);
    if (!losses) return failure("CONDITION_CONTENT_MISSING", "A held Condition lacks a verified trait.");
    if (next.ancientOneId !== "azathoth" && (player.health! <= losses.health || player.sanity! <= losses.sanity) && (next.doom ?? 0) <= 1) {
      return failure("AWAKENING_UNSUPPORTED", "Ancient One awakening is not implemented yet.");
    }
    const damaged = damageInvestigator(next, playerId, losses.health, losses.sanity, content);
    if (!damaged.ok) return damaged;
    next = damaged.state;
    next.stateVersion = state.stateVersion;
    events.push(...damaged.events);
    const discarded = Math.min(player.clues, losses.clues);
    if (discarded) {
      if (!discardHeldClues(next, playerId, discarded)) return failure("CLUE_CONTENT_MISSING", "The physical Clues to discard are unavailable.");
      next.players.find(candidate => candidate.id === playerId)!.clues -= discarded;
      events.push({ type: "CLUES_DISCARDED", playerId, amount: discarded });
    }
    if (next.pendingDefeat || next.gameResult) return success(next, events);
  }
  next.pendingFromBadToWorse = undefined;
  return finishMythosEvent(state, next, events, content);
}

function resolveBermudaTriangle(state: GameState, content: GameContent, context: EngineContext): CommandResult {
  if (!content.map.locationTypes.space_8) return failure("MYTHOS_CONTENT_MISSING", "The Bermuda Triangle destination is missing from the map.");
  const next = structuredClone(state);
  const events: GameEvent[] = [];
  for (const playerId of mythosInvestigatorOrder(state)) {
    const die = context.rollDie();
    const moved = die <= 2;
    events.push({ type: "BERMUDA_TRIANGLE_ROLLED", playerId, die, moved });
    if (moved) {
      const player = next.players.find(candidate => candidate.id === playerId)!;
      player.locationId = "space_8";
      player.delayed = true;
      events.push({ type: "INVESTIGATOR_DELAYED", playerId });
    }
  }
  next.stateVersion = state.stateVersion;
  return success(next, events);
}

function resolveCallingTheElderThings(state: GameState, content: GameContent, context: EngineContext): CommandResult {
  const cultistSpaces = [...new Set((state.monsters ?? [])
    .filter(monster => monster.monsterId === "monster_cultist")
    .map(monster => monster.locationId))];
  let next = structuredClone(state);
  const events: GameEvent[] = [];
  for (const locationId of cultistSpaces) {
    if (!next.privateState.tokenPoolById.monsters?.length) break;
    const spawned = spawnMonsterFromCup(next, locationId, content, context);
    if (!spawned.ok) return spawned;
    next = spawned.state;
    events.push(...spawned.events);
  }
  next.stateVersion = state.stateVersion;
  return success(next, events);
}

function canLeadGainDarkPact(state: GameState, content: GameContent): boolean {
  const lead = state.players.find(player => player.id === state.leadInvestigatorId && !player.defeated && !player.eliminated);
  return Boolean(lead && content.conditions?.some(condition => condition.kind === "dark_pact")
    && state.privateState.tokenPoolById[conditionPoolKey("dark_pact")]?.length
    && !(lead.conditionIds ?? []).some(id => content.conditions?.find(condition => condition.id === id)?.kind === "dark_pact"));
}

function advanceDesperateTimesDoom(state: GameState): CommandResult {
  if (state.doom === undefined || !state.ancientOneId) return failure("OMEN_CONTENT_MISSING", "Doom or Ancient One setup is missing.");
  if (state.doom <= 2 && state.ancientOneId !== "azathoth") return failure("AWAKENING_UNSUPPORTED", "Ancient One awakening is not implemented yet.");
  const next = structuredClone(state);
  next.doom = Math.max(0, state.doom - 2);
  const events: GameEvent[] = [{ type: "DOOM_ADVANCED", amount: 2, newDoom: next.doom }];
  if (next.doom === 0 && state.ancientOneId === "azathoth") {
    next.gameResult = "investigators_lose";
    events.push({ type: "GAME_ENDED", result: "investigators_lose", reason: "azathoth_awakened" });
  }
  return success(next, events);
}

function resolveDimensionalInstability(state: GameState, content: GameContent, context: EngineContext): CommandResult {
  if (state.omen === undefined || !Number.isInteger(state.omen) || state.omen < 0 || state.omen >= omenTrack.length
    || state.doom === undefined || !state.ancientOneId) return failure("OMEN_CONTENT_MISSING", "Omen, Doom, or Ancient One setup is missing.");
  const activeGates = (state.activeGateIds ?? []).map(id => content.gates?.find(gate => gate.id === id));
  if (activeGates.some(gate => !gate || !content.map.locationTypes[gate.locationId])) return failure("GATE_CONTENT_MISSING", "An active Gate is missing from content.");
  if (!state.privateState.deckOrderById.gates) return failure("GATE_CONTENT_MISSING", "The Gate stack is not initialized.");
  const matching = activeGates.filter(gate => gate!.omenSymbol === omenTrack[state.omen!]);
  const doomAdvance = matching.length;
  if (doomAdvance >= state.doom && state.ancientOneId !== "azathoth") return failure("AWAKENING_UNSUPPORTED", "Ancient One awakening is not implemented yet.");
  const next = structuredClone(state);
  const discardedIds = matching.map(gate => gate!.id);
  next.activeGateIds = (next.activeGateIds ?? []).filter(id => !discardedIds.includes(id));
  next.discardedGateIds = [...(next.discardedGateIds ?? []), ...discardedIds];
  next.doom = Math.max(0, state.doom - doomAdvance);
  const events: GameEvent[] = matching.map(gate => ({ type: "GATE_DISCARDED", gateId: gate!.id, locationId: gate!.locationId }));
  if (!next.privateState.deckOrderById.gates.length && next.discardedGateIds.length) {
    next.privateState.deckOrderById.gates = context.shuffle(next.discardedGateIds);
    next.discardedGateIds = [];
  }
  if (next.doom === 0 && state.ancientOneId === "azathoth") {
    next.gameResult = "investigators_lose";
    events.push({ type: "GAME_ENDED", result: "investigators_lose", reason: "azathoth_awakened" });
  }
  return success(next, events);
}

function gainAllyAssetFromDeck(state: GameState, playerId: string, content: GameContent, context: EngineContext): CommandResult {
  const lead = state.players.find(player => player.id === playerId && !player.defeated && !player.eliminated);
  if (!lead) return failure("INVESTIGATOR_DEFEATED", "The Lead Investigator is unavailable to gain an Ally.");
  const deck = state.privateState.deckOrderById.assets;
  if (!deck) return failure("ASSET_CONTENT_MISSING", "The Asset deck is not initialized.");
  const isAlly = (id: string) => content.assets.find(asset => asset.id === id)?.traits?.includes("ally") ?? false;
  if ([...deck, ...state.assetDiscardIds].some(id => !content.assets.some(asset => asset.id === id && asset.traits))) {
    return failure("ASSET_CONTENT_MISSING", "An Asset in the deck or discard pile lacks trait content.");
  }
  const deckIndex = deck.findIndex(isAlly);
  const discardIndex = state.assetDiscardIds.findIndex(isAlly);
  const next = structuredClone(state);
  const assetId = deckIndex >= 0 ? next.privateState.deckOrderById.assets!.splice(deckIndex, 1)[0]
    : discardIndex >= 0 ? next.assetDiscardIds.splice(discardIndex, 1)[0] : undefined;
  if (!assetId) return success(next, []);
  next.privateState.deckOrderById.assets = context.shuffle(next.privateState.deckOrderById.assets!);
  next.players.find(player => player.id === playerId)!.assetIds.push(assetId);
  return success(next, [{ type: "ASSET_GAINED", playerId, assetId, source: "mythos" }]);
}

function mythosInvestigatorOrder(state: GameState): string[] {
  const leadIndex = state.players.findIndex(player => player.id === state.leadInvestigatorId);
  if (leadIndex < 0) return [];
  return [...state.players.slice(leadIndex), ...state.players.slice(0, leadIndex)]
    .filter(player => !player.defeated && !player.eliminated).map(player => player.id);
}

function worldFightsBackDecision(state: GameState, playerId: string, content: GameContent, context: EngineContext): PendingDecision {
  const player = state.players.find(candidate => candidate.id === playerId)!;
  const discardable = (state.monsters ?? []).filter(instance => instance.locationId === player.locationId
    && content.monsters?.some(monster => monster.id === instance.monsterId && monster.type === "normal"));
  return {
    id: context.createId(), kind: "choose_world_fights_back", playerId, visibility: "owner",
    prompt: "The World Fights Back: recover 2 Health, recover 2 Sanity, discard one non-Epic Monster on your space, or skip.",
    optionIds: ["recover_health", "recover_sanity", ...discardable.map(instance => `monster:${instance.id}`), "skip"],
    minSelections: 1, maxSelections: 1, continuation: "mythos_world_fights_back",
  };
}

function debtTradeDecision(state: GameState, playerId: string, content: GameContent, context: EngineContext): PendingDecision {
  const player = state.players.find(candidate => candidate.id === playerId)!;
  const held = (player.conditionIds ?? []).map(id => ({ id, definition: content.conditions?.find(card => card.id === id) }));
  const canGainDebt = Boolean(state.privateState.tokenPoolById[conditionPoolKey("debt")]?.length)
    && !held.some(({ definition }) => definition?.kind === "debt");
  const discardOptions = canGainDebt
    ? held.filter(({ definition }) => definition && definition.kind !== "debt").map(({ id }) => publicConditionId(id)) : [];
  return {
    id: context.createId(), kind: "trade_debt_for_condition", playerId, visibility: "owner",
    prompt: "Everyone Has a Price: gain a Debt Condition to discard one of your Conditions, or skip.",
    optionIds: [...discardOptions, "skip"], minSelections: 1, maxSelections: 1, continuation: "mythos_debt_trade",
  };
}

function finishMythosEvent(previous: GameState, resolved: GameState, events: GameEvent[], content: GameContent): CommandResult {
  resolved.currentMythosCardId = undefined;
  resolved.currentMythosIconIndex = undefined;
  resolved.stateVersion = previous.stateVersion;
  const opened = openReplacementWindow(resolved, content);
  if (!opened.ok) return opened;
  opened.state.stateVersion = previous.stateVersion;
  return success(opened.state, events.concat(opened.events));
}

function routeBetween(map: GameMap, source: LocationId, target: LocationId) {
  return map.routes.find((route) => (route.source === source && route.target === target) || (route.source === target && route.target === source));
}

function advanceActionInvestigator(state: GameState, actorIndex: number, events: GameEvent[]): void {
  const leadIndex = state.players.findIndex(player => player.id === state.leadInvestigatorId);
  const ordered = [...state.players.slice(Math.max(0, leadIndex)), ...state.players.slice(0, Math.max(0, leadIndex))];
  const activeIndex = ordered.findIndex(player => player.id === state.players[actorIndex]?.id);
  for (const player of ordered.slice(activeIndex + 1)) {
    if (player.defeated || player.eliminated) {
      continue;
    }
    if (player.delayed) {
      player.delayed = false;
      events.push({ type: "INVESTIGATOR_STOOD_UP", playerId: player.id });
      continue;
    }
    state.activePlayerId = player.id;
    state.actionsRemaining = 2;
    state.performedActions = [];
    return;
  }
  state.phase = "encounter";
  state.encounteredMonsterInstanceIds = [];
  state.activePlayerId = ordered
    .find(player => !player.defeated && !player.eliminated)?.id;
  state.actionsRemaining = 0;
  state.performedActions = [];
  events.push({ type: "PHASE_ADVANCED", phase: "encounter", activePlayerId: state.activePlayerId });
}

const regionalEncounterDeckByCity: Readonly<Partial<Record<LocationId, LocationEncounterDeckId>>> = {
  arkham: "america", san_francisco: "america", buenos_aires: "america",
  london: "europe", rome: "europe", istanbul: "europe",
  shanghai: "asia_australia", tokyo: "asia_australia", sydney: "asia_australia",
};

/** Location deck choices; mandatory combat is not bypassed by this helper. */
export function legalLocationEncounterDecks(state: GameState, playerId: string, content: GameContent): LocationEncounterDeckId[] {
  if (state.phase !== "encounter" || state.activePlayerId !== playerId || state.pendingDecision || state.pendingDefeat || state.activeTest) return [];
  const player = state.players.find(candidate => candidate.id === playerId);
  if (!player?.locationId || player.defeated || player.eliminated || state.monsters?.some(monster => monster.locationId === player.locationId)) return [];
  const spaceType = content.map.locationTypes[player.locationId];
  if (!spaceType) return [];
  const regional = regionalEncounterDeckByCity[player.locationId];
  return regional ? ["general", regional] : ["general"];
}

/** Internal continuation after a fully resolved encounter, never a skip command. */
export function advanceEncounterInvestigator(state: GameState, playerId: string): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has ended.");
  if (state.phase !== "encounter" || state.activePlayerId !== playerId || state.pendingDecision || state.pendingDefeat || state.activeTest) {
    return failure("WRONG_PHASE", "Finish the active encounter before advancing.");
  }
  if (!state.players.some(player => player.id === playerId)) return failure("PLAYER_NOT_FOUND", "The active investigator is missing.");
  const next = structuredClone(state);
  const leadIndex = next.players.findIndex(player => player.id === next.leadInvestigatorId);
  if (leadIndex < 0) return failure("PLAYER_NOT_FOUND", "The Lead Investigator is missing.");
  const ordered = [...next.players.slice(leadIndex), ...next.players.slice(0, leadIndex)];
  const activeIndex = ordered.findIndex(player => player.id === playerId);
  const following = ordered.slice(activeIndex + 1).find(player => !player.defeated && !player.eliminated);
  if (following) next.activePlayerId = following.id;
  else { next.phase = "mythos"; next.activePlayerId = next.leadInvestigatorId; }
  next.encounteredMonsterInstanceIds = [];
  return success(next, [{ type: "PHASE_ADVANCED", phase: next.phase, activePlayerId: next.activePlayerId }]);
}

function applyLocationEncounterEffects(
  state: GameState, playerId: string, effects: LocationEncounterEffect[], content: GameContent, context: EngineContext,
): CommandResult {
  let next = structuredClone(state);
  next.activeTest = undefined;
  next.pendingDecision = undefined;
  const events: GameEvent[] = [];
  const player = next.players.find(candidate => candidate.id === playerId);
  if (!player) return failure("PLAYER_NOT_FOUND", "The encounter investigator is missing.");
  for (let index = 0; index < effects.length; index++) {
    const effect = effects[index]!;
    if (effect.kind === "doom_advance") {
      const invalid = validateEncounterDoomAdvance(next);
      if (invalid) return invalid;
      next.doom = next.doom! - effect.amount;
      events.push({ type: "DOOM_ADVANCED", amount: effect.amount, newDoom: next.doom });
      if (next.doom === 0) {
        next.gameResult = "investigators_lose";
        events.push({ type: "GAME_ENDED", result: "investigators_lose", reason: "azathoth_awakened" });
        break;
      }
      continue;
    }
    if (effect.kind === "close_encountered_gate") {
      const pending = next.pendingLocationEncounter;
      if (pending?.deck !== "other_world" || pending.playerId !== playerId || !pending.gateId || pending.gateClosed || !otherWorldBindingIsValid(next, content)) return failure("ENCOUNTER_CONTENT_MISSING", "Gate closure requires the original bound Other World encounter.");
      next.activeGateIds = next.activeGateIds!.filter(id => id !== pending.gateId);
      next.discardedGateIds = [...(next.discardedGateIds ?? []), pending.gateId];
      if (next.privateState.deckOrderById.gates?.length === 0) {
        next.privateState.deckOrderById.gates = context.shuffle(next.discardedGateIds);
        next.discardedGateIds = [];
      }
      pending.gateClosed = true;
      events.push({ type: "GATE_CLOSED", playerId, gateId: pending.gateId });
      continue;
    }
    if ("amount" in effect && effect.amount === 0) continue;
    if (effect.kind === "ambush_horror") {
      const loss = Math.max(0, effect.damage - (next.pendingLocationEncounter?.successes ?? 0));
      if (loss >= (player.sanity ?? 0) && (next.doom ?? 0) <= 1 && next.ancientOneId !== "azathoth") return failure("AWAKENING_UNSUPPORTED", "Ambush defeat requires unsupported awakening.");
      const damaged = damageInvestigator(next, playerId, 0, loss, content);
      if (!damaged.ok) return damaged;
      next = damaged.state; events.push(...damaged.events);
      if (next.pendingDefeat || next.gameResult) break;
      continue;
    }
    if (effect.kind === "doom_retreat") {
      if (!Number.isSafeInteger(next.doom) || next.doom! < 0 || next.doom! > 20) return failure("ENCOUNTER_CONTENT_MISSING", "The Doom track is invalid.");
      if (next.doom! < 20) { next.doom = next.doom! + 1; events.push({ type: "DOOM_RETREATED", amount: 1, doom: next.doom }); }
      continue;
    }
    if (effect.kind === "discard_item_assets") {
      if (encounterItemAssetIds(player, content).length) return failure("ENCOUNTER_CONTENT_MISSING", "Choose the Item Asset to discard first.");
      continue;
    }
    if (effect.kind === "relocate_encountered_clue") {
      if (!effect.locationId) return failure("ENCOUNTER_CONTENT_MISSING", "Choose the nearest Sea destination first.");
      const moved = resolveBoardClueEffect(next, effect.markerId, { kind: "relocate", locationId: effect.locationId as LocationId }, content);
      if (!moved.ok) return moved;
      next = moved.state; events.push(...moved.events); continue;
    }
    if (effect.kind === "artifact") {
      const gained = gainNamedArtifact(next, playerId, effect.id, content);
      if (gained.ok === false) {
        if (gained.error.code === "ARTIFACT_UNAVAILABLE") continue;
        return gained;
      }
      next = gained.state;
      events.push(...gained.events);
      continue;
    }
    if (effect.kind === "return_solved_mystery") {
      if (!next.completedMysteryIds.length) continue;
      const deck = next.privateState.deckOrderById.mysteries;
      const catalog = next.ancientOneId && content.mysteryIdsByAncientOne[next.ancientOneId];
      const physicalIds = [...next.completedMysteryIds, ...(deck ?? []), ...(next.activeMysteryId ? [next.activeMysteryId] : [])];
      if (!deck || !catalog || new Set(physicalIds).size !== physicalIds.length || physicalIds.some(id => !catalog.includes(id))) return failure("MYSTERY_CONTENT_MISSING", "The physical Mystery deck is inconsistent.");
      const drawn = context.drawToken(next.completedMysteryIds);
      next.completedMysteryIds = drawn.remaining;
      next.privateState.deckOrderById.mysteries = context.shuffle([...deck, drawn.token]);
      events.push({ type: "MYSTERY_RETURNED_TO_DECK", mysteryId: drawn.token });
    } else if (effect.kind === "omen_advance") {
      const advanced = resolveOmenAdvanceEffect(next, content);
      if (!advanced.ok) return advanced;
      next = advanced.state;
      events.push(...advanced.events);
    } else if (effect.kind === "omen_move") {
      if (effect.position === undefined || !Number.isInteger(effect.position) || effect.position < 0 || effect.position >= omenTrack.length) return failure("ENCOUNTER_UNSUPPORTED", "Choose the Omen destination first.");
      next.omen = effect.position;
      events.push({ type: "OMEN_MOVED", position: effect.position, symbol: omenTrack[effect.position]!, direction: "chosen", doomAdvance: 0 });
    } else if (effect.kind === "omen_eldritch") {
      const tokens = next.greenOmenTokens ?? 0;
      if (!Number.isSafeInteger(tokens) || tokens < 0) return failure("OMEN_CONTENT_MISSING", "The Omen Eldritch count is invalid.");
      // Base Azathoth sources place tokens only on green; it is the only occupied Omen space.
      const amount = effect.operation === "place" ? 1 : tokens > 0 ? -1 : 0;
      next.greenOmenTokens = tokens + amount;
      if (amount) events.push({ type: "OMEN_ELDRITCH_CHANGED", position: 0, amount, tokens: next.greenOmenTokens });
    } else if (effect.kind === "condition") {
      const gained = gainCondition(next, playerId, effect.condition, content, context);
      if (gained.ok === false) {
        if (gained.error.code === "CONDITION_UNAVAILABLE") continue;
        return gained;
      }
      next = gained.state;
      events.push(...gained.events);
    } else if (effect.kind === "collect_encountered_clue") {
      const collected = collectBoardClue(next, playerId, effect.markerId);
      if (!collected.ok) return collected;
      next = collected.state;
      events.push(...collected.events);
    } else if (effect.kind === "discard") {
      return failure("ENCOUNTER_UNSUPPORTED", "Choose the printed Condition to discard first.");
    } else if (effect.kind === "delay") {
      const delayed = delayInvestigator(next, playerId);
      if (!delayed.ok) return delayed;
      next = delayed.state;
      events.push(...delayed.events);
    } else if (effect.kind === "improve") {
      if (effect.skill === "chosen") return failure("ENCOUNTER_UNSUPPORTED", "Choose the skill to improve first.");
      const recipient = next.players.find(candidate => candidate.id === playerId)!;
      const improvement = Math.min(2, (recipient.skillImprovements[effect.skill] ?? 0) + (effect.amount ?? 1));
      recipient.skillImprovements[effect.skill] = improvement;
      events.push({ type: "SKILL_IMPROVED", playerId, skill: effect.skill, improvement });
    } else if (effect.kind === "spawn_clues") {
      if (effect.target) return failure("ENCOUNTER_UNSUPPORTED", "Choose the Clue's space first.");
      for (let count = 0; count < effect.amount; count++) {
        const spawned = spawnClueFromPool(next, content, context);
        if (spawned.ok === false) {
          if (spawned.error.code === "CLUE_UNAVAILABLE") break;
          return spawned;
        }
        next = spawned.state;
        events.push(...spawned.events);
      }
    } else if (effect.kind === "clues") {
      if (effect.amount < 0) {
        const recipient = next.players.find(candidate => candidate.id === playerId)!;
        const amount = Math.min(recipient.clues, -effect.amount);
        if (!discardHeldClues(next, playerId, amount)) return failure("CLUE_CONTENT_MISSING", "The physical Clues to discard are missing.");
        recipient.clues -= amount;
        if (amount) events.push({ type: "CLUES_DISCARDED", playerId, amount });
        continue;
      }
      const gained = gainCluesFromPool(next, playerId, effect.amount, content, context);
      if (!gained.ok) return gained;
      next = gained.state;
      events.push(...gained.events);
    } else if (effect.kind === "health" || effect.kind === "sanity") {
      let healthLoss = effect.kind === "health" ? -effect.amount : 0;
      let sanityLoss = effect.kind === "sanity" ? -effect.amount : 0;
      // One printed loss of Health and Sanity is simultaneous. A depleted
      // investigator stops resolving the encounter, including later effects.
      while (effects[index + 1]?.kind === "health" || effects[index + 1]?.kind === "sanity") {
        const additional = effects[++index]!;
        if (additional.kind === "health") healthLoss -= additional.amount;
        else if (additional.kind === "sanity") sanityLoss -= additional.amount;
      }
      const recipient = next.players.find(candidate => candidate.id === playerId)!;
      const lethal = (healthLoss > 0 && healthLoss >= (recipient.health ?? 0)) || (sanityLoss > 0 && sanityLoss >= (recipient.sanity ?? 0));
      if (lethal && (next.doom ?? 1) <= 1 && next.ancientOneId !== "azathoth") {
        return failure("AWAKENING_UNSUPPORTED", "This defeat requires an unimplemented Ancient One awakening.");
      }
      const damaged = damageInvestigator(next, playerId, healthLoss, sanityLoss, content);
      if (!damaged.ok) return damaged;
      next = damaged.state;
      events.push(...damaged.events);
      if (next.pendingDefeat || next.gameResult) break;
    } else {
      const recipient = next.players.find(candidate => candidate.id === playerId)!;
      const resource = effect.kind === "recover_health" ? "health" : "sanity";
      const maximum = resource === "health" ? recipient.maxHealth : recipient.maxSanity;
      if (maximum === undefined) return failure("ENCOUNTER_CONTENT_MISSING", "The investigator's resource maximum is missing.");
      const recovered = recoverResource(recipient[resource] ?? 0, maximum, effect.amount);
      recipient[resource] = recovered.value;
      events.push({ type: "INVESTIGATOR_RECOVERED", playerId, healthRecovered: resource === "health" ? recovered.amount : 0, sanityRecovered: resource === "sanity" ? recovered.amount : 0 });
    }
  }
  next.stateVersion = state.stateVersion;
  return success(next, events);
}

function canPayEncounterCost(state: GameState, player: EnginePlayer, cost: LocationEncounterEffect[], content: GameContent): boolean {
  if (cost.length === 1 && cost[0]?.kind === "discard_item_assets" && cost[0].amount === 1) return encounterItemsAreConserved(state, player, content) && encounterItemAssetIds(player, content).length > 0;
  const total = (kind: "clues" | "health" | "sanity") => cost.reduce((sum, effect) => sum + (effect.kind === kind ? -effect.amount : 0), 0);
  if (total("clues") > player.clues || total("health") >= (player.health ?? 0) || total("sanity") >= (player.sanity ?? 0)) return false;
  return cost.every(effect => {
    if (effect.kind === "delay") return !player.delayed;
    if (effect.kind === "condition") return !(player.conditionIds ?? []).some(id => content.conditions?.find(card => card.id === id)?.kind === effect.condition)
      && Boolean(state.privateState.tokenPoolById[conditionPoolKey(effect.condition)]?.length);
    return (effect.kind === "clues" || effect.kind === "health" || effect.kind === "sanity") && effect.amount <= 0;
  });
}

function createEncounterChoice(state: GameState, context: EngineContext, prompt: string, options: [string, string][]): void {
  const pending = state.pendingLocationEncounter!;
  state.pendingDecision = { id: context.createId(), kind: "encounter_choice", playerId: pending.playerId, visibility: "owner", prompt,
    optionIds: options.map(([id]) => id), optionLabels: Object.fromEntries(options), minSelections: 1, maxSelections: 1, continuation: "location_encounter_choice" };
}

function nearestSeaSpaces(state: GameState, markerId: string, content: GameContent): LocationId[] {
  const origin = state.boardClues?.find(clue => clue.id === markerId)?.locationId;
  if (!origin) return [];
  const visited = new Set<LocationId>([origin]);
  let frontier: LocationId[] = [origin];
  while (frontier.length) {
    const sea = frontier.filter(id => content.map.locationTypes[id] === "sea");
    if (sea.length) return sea;
    frontier = frontier.flatMap(id => content.map.adjacentLocationIds[id] ?? []).filter(id => {
      if (visited.has(id)) return false;
      visited.add(id); return true;
    });
  }
  return [];
}

/** Validate state-dependent printed mechanics before dice or restored payments. */
function validateInjurySupply(state: GameState, content: GameContent): CommandResult | undefined {
  const definitions = content.conditions?.filter(card => card.trait === "injury") ?? [];
  if (!definitions.length || new Set(definitions.map(card => card.id)).size !== definitions.length) return failure("CONDITION_CONTENT_MISSING", "Injury definitions are missing or duplicated.");
  const kinds = [...new Set(definitions.map(card => card.kind))];
  const physical: string[] = [];
  for (const kind of kinds) {
    const pool = state.privateState.tokenPoolById[conditionPoolKey(kind)];
    if (!pool || pool.some(id => !definitions.some(card => card.id === id && card.kind === kind))) return failure("CONDITION_CONTENT_MISSING", "Injury supply is inconsistent.");
    physical.push(...pool);
  }
  for (const player of state.players) for (const id of player.conditionIds ?? []) {
    const card = content.conditions?.find(card => card.id === id);
    if (!card) return failure("CONDITION_CONTENT_MISSING", "A held Condition is unknown.");
    if (card.trait === "injury") physical.push(id);
  }
  if (new Set(physical).size !== physical.length) return failure("CONDITION_CONTENT_MISSING", "Injury supply overlaps holdings.");
  return undefined;
}

function validateEncounterDynamicInstructions(state: GameState, nodes: readonly LocationEncounterInstruction[], content: GameContent): CommandResult | undefined {
  for (const node of nodes) {
    if (node.kind === "effects" && node.effects.some(effect => effect.kind === "condition" && effect.condition === "injury")) {
      const invalid = validateInjurySupply(state, content);
      if (invalid) return invalid;
    }
    if (node.kind === "test" && node.diceBonus === "held_clues") {
      if (state.players.some(player => !Number.isSafeInteger(player.clues) || player.clues < 0)) return failure("CLUE_CONTENT_MISSING", "Clue counts must be nonnegative integers.");
      const invalid = validateArtifactClues(state, content);
      if (invalid) return invalid;
    }
    for (const kind of ["hallucinations", "amnesia", "paranoia"] as const) {
      if (node.kind !== "effects" || !node.effects.some(effect => effect.kind === "condition" && effect.condition === kind)) continue;
      const catalog = content.conditions?.filter(card => card.kind === kind).map(card => card.id);
      const pool = state.privateState.tokenPoolById[conditionPoolKey(kind)];
      const owned = state.players.flatMap(player => player.conditionIds ?? []).filter(id => catalog?.includes(id));
      const physical = [...(pool ?? []), ...owned];
      if (!catalog?.length || new Set(catalog).size !== catalog.length || !pool || pool.some(id => !catalog.includes(id)) || new Set(physical).size !== physical.length) return failure("CONDITION_CONTENT_MISSING", `${kind} supply or holdings are inconsistent.`);
    }
    const children = node.kind === "test" ? [node.pass, node.fail] : node.kind === "sequence" ? node.steps : node.kind === "choice" ? node.options
      : node.kind === "optional" ? [node.reward, ...(node.decline ? [node.decline] : [])] : node.kind === "ambush" || node.kind === "ambush_result" ? [node.defeated, node.notDefeated] : [];
    const invalid = validateEncounterDynamicInstructions(state, children, content);
    if (invalid) return invalid;
  }
  return undefined;
}

/** Resume the printed instruction queue from server-only canonical state. */
function continueLocationEncounter(state: GameState, content: GameContent, context: EngineContext, events: GameEvent[] = []): CommandResult {
  if (state.pendingLocationEncounter?.deck === "other_world" && !otherWorldBindingIsValid(state, content)) return failure("ENCOUNTER_CONTENT_MISSING", "The bound Gate or Other World deck changed.");
  const invalidDoom = validateEncounterDoomInstructions(state, state.pendingLocationEncounter?.queue ?? []);
  if (invalidDoom) return invalidDoom;
  const invalidDynamic = validateEncounterDynamicInstructions(state, state.pendingLocationEncounter?.queue ?? [], content);
  if (invalidDynamic) return invalidDynamic;
  let next = structuredClone(state);
  while (next.pendingLocationEncounter?.queue.length) {
    const pending = next.pendingLocationEncounter;
    const node = pending.queue[0]!;
    const player = next.players.find(candidate => candidate.id === pending.playerId);
    if (!player) return failure("PLAYER_NOT_FOUND", "The encounter investigator is missing.");
    if (player.defeated || player.eliminated || next.gameResult) { pending.queue = []; break; }
    if (node.kind === "damage_reaction") {
      const source = encounterDamagePreventions(next, player, content).find(candidate =>
        (candidate.resource === "health" ? node.healthLoss : node.sanityLoss) > 0
        && !node.declinedPlayerIds.includes(candidate.playerId) && !node.declinedAssetIds?.includes(candidate.assetId));
      if (source) {
        if (!physicalAssetIsUnique(next, source.assetId)) return failure("ENCOUNTER_CONTENT_MISSING", "The prevention Asset identity is inconsistent.");
        const name = content.assets.find(asset => asset.id === source.assetId)?.name ?? source.assetId;
        const loss = source.resource === "health" ? node.healthLoss : node.sanityLoss;
        const resourceLabel = source.resource === "health" ? "Health" : "Sanity";
        const options: [string, string][] = [[source.assetId, `Discard ${name}: prevent ${Math.min(source.amount, loss)} ${resourceLabel} loss`]];
        if (loss > 1) options.push([`${source.assetId}:prevent-1`, `Discard ${name}: prevent 1 ${resourceLabel} loss`]);
        options.push(["skip", "Decline prevention"]);
        createEncounterChoice(next, context, `${player.investigatorId?.replaceAll("_", " ") ?? player.id} would lose ${node.healthLoss} Health and ${node.sanityLoss} Sanity. You may discard ${name} to prevent up to ${source.amount} ${resourceLabel} loss.`, options);
        next.pendingDecision!.playerId = source.playerId;
        next.stateVersion = state.stateVersion;
        return success(next, events);
      }
      pending.queue.shift();
      const applied = applyLocationEncounterEffects(next, player.id, [{ kind: "health", amount: -node.healthLoss }, { kind: "sanity", amount: -node.sanityLoss }], content, context);
      if (!applied.ok) return applied;
      next = applied.state; events.push(...applied.events);
      continue;
    }
    if (node.kind === "ambush") {
      const monster = content.monsters?.find(card => card.id === node.monsterId);
      if (!monster || monster.type !== "normal" || monster.specialEffect || !monster.horrorCheck || monster.horrorCheck === "ancient_one" || !monster.damageCheck || monster.damageCheck === "ancient_one" || monster.toughness === "ancient_one") return failure("MONSTER_CONTENT_MISSING", "The named Monster's combat statistics are unavailable.");
      if (player.assetIds.length || player.artifactIds?.length) return failure("MONSTER_EFFECT_UNSUPPORTED", "Ambush possession bonuses are not supported.");
      const result: LocationEncounterInstruction = { kind: "ambush_result", monsterId: node.monsterId, damage: monster.damageCheck.damage, toughness: monster.toughness.base + monster.toughness.perInvestigator * next.players.filter(player => !player.defeated && !player.eliminated).length, defeated: node.defeated, notDefeated: node.notDefeated };
      const horror: LocationEncounterInstruction = { kind: "effects", effects: [{ kind: "ambush_horror", damage: monster.horrorCheck.damage }] };
      pending.queue.splice(0, 1,
        { kind: "test", skill: "will", modifier: monster.horrorCheck.modifier, pass: horror, fail: horror },
        { kind: "test", skill: "strength", modifier: monster.damageCheck.modifier, pass: result, fail: result });
      continue;
    }
    if (node.kind === "ambush_result") {
      const loss = Math.max(0, node.damage - pending.successes);
      if (loss >= (player.health ?? 0) && (next.doom ?? 0) <= 1 && next.ancientOneId !== "azathoth") return failure("AWAKENING_UNSUPPORTED", "Ambush defeat requires unsupported awakening.");
      const defeated = pending.successes >= node.toughness;
      events.push({ type: "NAMED_MONSTER_AMBUSH_RESOLVED", playerId: player.id, monsterId: node.monsterId, successes: pending.successes, healthLost: Math.min(player.health ?? 0, loss), defeated });
      pending.queue.splice(0, 1, defeated ? node.defeated : node.notDefeated);
      const damaged = damageInvestigator(next, player.id, loss, 0, content);
      if (!damaged.ok) return damaged;
      next = damaged.state; events.push(...damaged.events);
      continue;
    }
    if (node.kind === "sequence") { pending.queue.splice(0, 1, ...node.steps); continue; }
    if (node.kind === "choice") {
      createEncounterChoice(next, context, "Choose the printed encounter outcome.", node.options.map((option, index) => [`option-${index}`, encounterInstructionLabel(option)]));
      next.stateVersion = state.stateVersion;
      return success(next, events);
    }
    if (node.kind === "optional") {
      if (!canPayEncounterCost(next, player, node.cost, content)) {
        if (node.decline) pending.queue.splice(0, 1, node.decline);
        else pending.queue.shift();
        continue;
      }
      if (node.reward.kind === "effects") {
        for (const effect of node.reward.effects) {
          if (effect.kind !== "artifact") continue;
          const probe = gainNamedArtifact(next, player.id, effect.id, content);
          if (probe.ok === false && probe.error.code !== "ARTIFACT_UNAVAILABLE") return probe;
        }
      }
      if (node.cost.length === 1 && node.cost[0]?.kind === "discard_item_assets") {
        createEncounterChoice(next, context, "Discard one of your Item Assets to pay, or decline.", [
          ...encounterItemAssetIds(player, content).map(id => [id, `Discard ${content.assets.find(card => card.id === id)?.name ?? id}; then ${encounterInstructionLabel(node.reward)}`] as [string, string]),
          ["skip", node.decline ? `Decline: ${encounterInstructionLabel(node.decline)}` : "Decline"],
        ]);
        next.stateVersion = state.stateVersion;
        return success(next, events);
      }
      createEncounterChoice(next, context, "You may pay the printed cost to resolve this encounter effect.", [
        ["accept", `${encounterInstructionLabel({ kind: "effects", effects: node.cost })}; then ${encounterInstructionLabel(node.reward)}`], ["skip", node.decline ? `Decline: ${encounterInstructionLabel(node.decline)}` : "Decline"],
      ]);
      next.stateVersion = state.stateVersion;
      return success(next, events);
    }
    if (node.kind === "test") {
      const investigator = player.investigatorId && content.investigators[player.investigatorId];
      if (!investigator) return failure("INVESTIGATOR_CONTENT_MISSING", "Investigator skills are unavailable.");
      const dicePool = calculateDicePool({ skill: node.skill, baseSkill: investigator.skills[node.skill], improvement: player.skillImprovements[node.skill], modifier: node.modifier,
        otherBonuses: [node.diceBonus === "held_clues" ? player.clues : 0, nonCombatEncounterAuraBonus(next, player, content), ...assetEffectsForPlayer(player, content).flatMap(effect => effect.type === "skill_bonus" && effect.skill === node.skill ? [effect.amount] : [])] }).dicePool;
      const dice = Array.from({ length: dicePool }, () => context.rollDie());
      const successes = countTestSuccesses(dice, conditionSuccessThreshold(player.conditionIds ?? []));
      pending.dice = dice;
      pending.successes = successes;
      if (player.clues > 0 || player.assetIds.some(id => canUseAssetTestReroll(next, player, node.skill, id, content)
        || canUseAssetDieIncrement(next, player, id, content))) {
        const test: ActiveTest = { id: context.createId(), playerId: player.id, skill: node.skill, modifier: node.modifier, dicePool, dice, successes,
          successThreshold: conditionSuccessThreshold(player.conditionIds ?? []), continuation: "location_encounter", sourceEncounterCardId: pending.cardId, sourceEncounterDeck: pending.deck };
        if (createTestRerollDecision(next, test, content, context)) {
          next.activeTest = test;
          next.stateVersion = state.stateVersion;
          return success(next, [...events, { type: "TEST_ROLLED", testId: test.id, playerId: player.id, skill: test.skill, modifier: test.modifier, dice, successes }]);
        }
      }
      pending.queue.splice(0, 1, successes ? node.pass : node.fail);
      continue;
    }
    const firstEffect = node.effects[0];
    if (!firstEffect) { pending.queue.shift(); continue; }
    if (firstEffect.kind === "discard_item_assets") {
      if (!encounterItemsAreConserved(next, player, content)) return failure("ENCOUNTER_CONTENT_MISSING", "Item Asset identities are inconsistent.");
      const targets = encounterItemAssetIds(player, content);
      if (!targets.length) { node.effects.shift(); continue; }
      createEncounterChoice(next, context, `Choose an Item Asset to discard (${firstEffect.amount} remaining).`, targets.map(id => [id, `Discard ${id.slice("asset_".length).replaceAll("_", " ")}`]));
      next.stateVersion = state.stateVersion;
      return success(next, events);
    }
    if (firstEffect.kind === "relocate_encountered_clue" && !firstEffect.locationId) {
      const targets = nearestSeaSpaces(next, firstEffect.markerId, content);
      if (!targets.length) return failure("ENCOUNTER_CONTENT_MISSING", "No reachable Sea space exists for this Clue.");
      if (targets.length === 1) { firstEffect.locationId = targets[0]!; continue; }
      createEncounterChoice(next, context, "Choose among the equally nearest Sea spaces for this Clue.", targets.map(id => [id, id.replaceAll("_", " ")]));
      next.stateVersion = state.stateVersion; return success(next, events);
    }
    if (firstEffect.kind === "omen_move" && firstEffect.position === undefined) {
      if (next.omen === undefined || !Number.isInteger(next.omen) || next.omen < 0 || next.omen >= omenTrack.length) return failure("OMEN_CONTENT_MISSING", "The current Omen space is unavailable.");
      createEncounterChoice(next, context, "Choose an Omen space; Doom will not advance.", omenTrack.map((symbol, position) => [`omen-${position}`, `${position}: ${symbol}`]));
      next.stateVersion = state.stateVersion;
      return success(next, events);
    }
    if (firstEffect.kind === "discard") {
      const targets = (player.conditionIds ?? []).filter(id => {
        const card = content.conditions?.find(candidate => candidate.id === id);
        return firstEffect.target === "madness" ? card?.trait === "madness" : card?.kind === "blessed";
      });
      if (!targets.length) { node.effects.shift(); continue; }
      createEncounterChoice(next, context, "Choose the printed Condition to discard.", targets.map(id => [id, publicConditionId(id).replaceAll("_", " ")]));
      next.stateVersion = state.stateVersion;
      return success(next, events);
    }
    if (player.investigatorId === "mark_harrigan"
      && (firstEffect.kind === "delay" || firstEffect.kind === "condition" && firstEffect.condition === "detained") && !firstEffect.accepted) {
      createEncounterChoice(next, context, "Mark may refuse becoming Delayed or Detained.", [["accept", "Accept the effect"], ["refuse", "Use Mark's ability to refuse"]]);
      next.stateVersion = state.stateVersion;
      return success(next, events);
    }
    if (firstEffect.kind === "improve" && firstEffect.skill === "chosen") {
      createEncounterChoice(next, context, "Choose a skill to improve.", ["lore", "influence", "observation", "strength", "will"].map(skill => [skill, `Improve ${skill}`]));
      next.stateVersion = state.stateVersion;
      return success(next, events);
    }
    if (firstEffect.kind === "improve" && player.investigatorId === "lily_chen" && !firstEffect.amount) {
      createEncounterChoice(next, context, "Lily may improve this skill twice instead of once.", [["once", "Improve once"], ["twice", "Improve twice"]]);
      next.stateVersion = state.stateVersion;
      return success(next, events);
    }
    if (firstEffect.kind === "spawn_clues" && firstEffect.target === "chosen_space") {
      createEncounterChoice(next, context, "Choose a space for the Clue.", Object.keys(content.map.locationTypes).map(id => [id, id.replaceAll("_", " ")]));
      next.stateVersion = state.stateVersion;
      return success(next, events);
    }
    const effects = [node.effects.shift()!];
    if (firstEffect.kind === "health" || firstEffect.kind === "sanity") {
      while (node.effects[0]?.kind === "health" || node.effects[0]?.kind === "sanity") effects.push(node.effects.shift()!);
      const healthLoss = effects.reduce((sum, effect) => sum + (effect.kind === "health" ? -effect.amount : 0), 0);
      const sanityLoss = effects.reduce((sum, effect) => sum + (effect.kind === "sanity" ? -effect.amount : 0), 0);
      if (encounterDamagePreventions(next, player, content).some(source => (source.resource === "health" ? healthLoss : sanityLoss) > 0)) {
        pending.queue.unshift({ kind: "damage_reaction", healthLoss, sanityLoss, declinedPlayerIds: [], declinedAssetIds: [] });
        continue;
      }
    }
    const applied = applyLocationEncounterEffects(next, player.id, effects, content, context);
    if (!applied.ok) return applied;
    next = applied.state;
    events.push(...applied.events);
  }
  const pending = next.pendingLocationEncounter;
  if (!pending) return failure("ENCOUNTER_CONTENT_MISSING", "The encounter continuation is missing.");
  const order = next.privateState.deckOrderById[`encounter:${pending.deck}`];
  if (order?.[0] !== pending.cardId) return failure("ENCOUNTER_DECK_MISSING", "The active encounter is no longer on top of its deck.");
  next.privateState.deckOrderById[`encounter:${pending.deck}`] = [...order.slice(1), pending.cardId];
  next.lastLocationEncounterCardId = pending.cardId;
  next.currentLocationEncounterCardId = undefined;
  next.pendingLocationEncounter = undefined;
  const resolved: GameEvent = pending.deck === "other_world"
    ? { type: "OTHER_WORLD_ENCOUNTER_RESOLVED", playerId: pending.playerId, cardId: pending.cardId, gateId: pending.gateId!, dice: pending.dice, successes: pending.successes }
    : pending.deck.startsWith("research_")
    ? { type: "RESEARCH_ENCOUNTER_RESOLVED", playerId: pending.playerId, cardId: pending.cardId, deck: pending.deck as ResearchEncounterDeckId, dice: pending.dice, successes: pending.successes }
    : { type: "LOCATION_ENCOUNTER_RESOLVED", playerId: pending.playerId, cardId: pending.cardId, deck: pending.deck as LocationEncounterDeckId, dice: pending.dice, successes: pending.successes };
  if (!next.pendingDefeat && !next.gameResult) {
    const advanced = advanceEncounterInvestigator(next, pending.playerId);
    if (!advanced.ok) return advanced;
    next = advanced.state;
    events.push(...advanced.events);
  }
  next.stateVersion = state.stateVersion;
  return success(next, [resolved, ...events]);
}

function encounterAmbushes(instruction: LocationEncounterInstruction): Extract<LocationEncounterInstruction, { kind: "ambush" }>[] {
  if (instruction.kind === "ambush") return [instruction, ...encounterAmbushes(instruction.defeated), ...encounterAmbushes(instruction.notDefeated)];
  if (instruction.kind === "sequence") return instruction.steps.flatMap(encounterAmbushes);
  if (instruction.kind === "choice") return instruction.options.flatMap(encounterAmbushes);
  if (instruction.kind === "test") return [...encounterAmbushes(instruction.pass), ...encounterAmbushes(instruction.fail)];
  if (instruction.kind === "optional") return [...encounterAmbushes(instruction.reward), ...(instruction.decline ? encounterAmbushes(instruction.decline) : [])];
  return [];
}

function validateEncounterDoomAdvance(state: GameState): CommandResult | undefined {
  if (!state.ancientOneId || !Number.isSafeInteger(state.doom) || state.doom! < 1 || state.doom! > 20) return failure("OMEN_CONTENT_MISSING", "Encounter Doom advancement requires a valid Doom track and Ancient One.");
  if (state.awakened || (state.doom === 1 && state.ancientOneId !== "azathoth")) return failure("AWAKENING_UNSUPPORTED", "Encounter awakening or awakened Doom replacement is not implemented.");
  return undefined;
}

/** Check all remaining branches before dice, payment, or prefix effects. */
function validateEncounterDoomInstructions(state: GameState, instructions: readonly LocationEncounterInstruction[]): CommandResult | undefined {
  for (const node of instructions) {
    if (node.kind === "effects" && node.effects.some(effect => effect.kind === "doom_advance") || node.kind === "optional" && node.cost.some(effect => effect.kind === "doom_advance")) {
      const invalid = validateEncounterDoomAdvance(state);
      if (invalid) return invalid;
    }
    const children = node.kind === "sequence" ? node.steps : node.kind === "choice" ? node.options : node.kind === "test" ? [node.pass, node.fail]
      : node.kind === "optional" ? [node.reward, ...(node.decline ? [node.decline] : [])] : node.kind === "ambush" || node.kind === "ambush_result" ? [node.defeated, node.notDefeated] : [];
    const invalid = validateEncounterDoomInstructions(state, children);
    if (invalid) return invalid;
  }
  return undefined;
}

/** Only scan-verified irrelevant Assets are admitted; applicable reactions and all Artifacts stay guarded. */
function otherWorldPossessionsAreSupported(state: GameState, player: EnginePlayer, content: GameContent): boolean {
  return !state.players.some(holder => holder.locationId === player.locationId && !holder.defeated && !holder.eliminated &&
    (holder.artifactIds?.length || holder.assetIds.some(id => content.assets.find(card => card.id === id)?.nonCombatEncounterSupport !== "irrelevant" || !physicalAssetIsUnique(state, id))));
}

function otherWorldBindingIsValid(state: GameState, content: GameContent): boolean {
  const pending = state.pendingLocationEncounter;
  if (!pending || pending.deck !== "other_world" || !pending.gateId || !pending.gateLocationId) return false;
  const player = state.players.find(player => player.id === pending.playerId);
  const gate = content.gates?.find(gate => gate.id === pending.gateId);
  const catalog = content.otherWorldEncounterIds;
  const order = state.privateState.deckOrderById["encounter:other_world"];
  const physicalGates = [...(state.activeGateIds ?? []), ...(state.discardedGateIds ?? []), ...(state.privateState.deckOrderById.gates ?? [])];
  return state.phase === "encounter" && state.activePlayerId === pending.playerId && state.currentLocationEncounterCardId === pending.cardId && player?.locationId === pending.gateLocationId && gate?.locationId === pending.gateLocationId
    && player.investigatorId !== "akachi_onyele" && state.ancientOneId !== "yog_sothoth"
    && otherWorldPossessionsAreSupported(state, player, content)
    && Boolean(catalog?.length && new Set(catalog).size === catalog.length && order?.length && order[0] === pending.cardId && order.length === catalog.length && new Set(order).size === order.length && order.every(id => catalog.includes(id)))
    && Boolean(state.privateState.deckOrderById.gates && content.gates?.length && new Set(content.gates.map(gate => gate.id)).size === content.gates.length && physicalGates.length === content.gates.length && new Set(physicalGates).size === physicalGates.length && physicalGates.every(id => content.gates!.some(gate => gate.id === id)))
    && (pending.gateClosed === true ? !state.activeGateIds?.includes(pending.gateId) : Boolean(state.activeGateIds?.includes(pending.gateId)));
}

/** Draw the actual private top card, binding every continuation to a physical Gate. */
export function resolveOtherWorldEncounter(state: GameState, playerId: string, gateId: string, content: GameContent, context: EngineContext): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has ended.");
  if (!legalLocationEncounterDecks(state, playerId, content).length || state.pendingLocationEncounter) return failure("WRONG_PHASE", "This investigator cannot resolve an Other World encounter now.");
  const player = state.players.find(player => player.id === playerId)!;
  if (state.monsterLocationIds.includes(player.locationId!) || state.monsters?.some(monster => monster.locationId === player.locationId)) return failure("ENCOUNTER_UNSUPPORTED", "Monsters must be encountered before Other Worlds.");
  if (!state.activeGateIds?.includes(gateId) || !content.gates?.some(gate => gate.id === gateId && gate.locationId === player.locationId)) return failure("GATE_UNAVAILABLE", "No such Gate is on this investigator's space.");
  if (player.investigatorId === "akachi_onyele" || state.ancientOneId === "yog_sothoth" || !otherWorldPossessionsAreSupported(state, player, content)) return failure("ENCOUNTER_UNSUPPORTED", "Applicable Other World possession effects, Akachi's closure ability, and Yog-Sothoth closure interactions are not executable yet.");
  const cardId = state.privateState.deckOrderById["encounter:other_world"]?.[0];
  const card = content.otherWorldEncounters?.find(card => card.id === cardId);
  const instruction = parseLocationEncounterInstruction(card?.sections.initial);
  if (!cardId || !instruction) return failure("ENCOUNTER_UNSUPPORTED", "The actual top Other World card has unsupported or untranscribed effects.");
  const next = structuredClone(state);
  next.currentLocationEncounterCardId = cardId;
  next.pendingLocationEncounter = { playerId, cardId, deck: "other_world", gateId, gateLocationId: player.locationId!, gateClosed: false, queue: [instruction], dice: [], successes: 0 };
  return continueLocationEncounter(next, content, context);
}

/** Authoritative Research draw; marker identity and outcomes remain server-owned. */
export function resolveResearchEncounter(state: GameState, playerId: string, markerId: string, content: GameContent, context: EngineContext): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has ended.");
  if (!legalLocationEncounterDecks(state, playerId, content).length || state.pendingLocationEncounter) return failure("WRONG_PHASE", "This investigator cannot resolve Research now.");
  const player = state.players.find(candidate => candidate.id === playerId)!;
  const marker = state.boardClues?.find(clue => clue.id === markerId && clue.locationId === player.locationId);
  if (!marker) return failure("CLUE_UNAVAILABLE", "No such Clue is on this investigator's space.");
  const physical = state.privateState.tokenPoolById[`board_clue:${markerId}`];
  const held = state.privateState.tokenPoolById[heldClueKey(playerId)];
  if (!physical || physical.length !== 1 || !content.clues?.some(clue => clue.id === physical[0]) || !held || held.length !== player.clues) return failure("CLUE_CONTENT_MISSING", "Research requires consistent physical Clue holdings.");
  if (!state.ancientOneId) return failure("ANCIENT_ONE_REQUIRED", "Research requires the selected Ancient One.");
  const deck: ResearchEncounterDeckId = `research_${state.ancientOneId}`;
  const order = state.privateState.deckOrderById[`encounter:${deck}`];
  if (!order?.length) return failure("ENCOUNTER_DECK_MISSING", "The selected Ancient One's Research deck is unavailable.");
  const cardId = order[0]!;
  const card = content.researchEncounters?.find(card => card.id === cardId && card.deck === deck);
  const section = content.map.locationTypes[player.locationId!];
  const instruction = bindResearchInstruction(card?.sections[section ?? ""], markerId);
  if (!instruction || !supportsEncounterAssets(state, player, content, instruction)) return failure("ENCOUNTER_UNSUPPORTED", "This Research section needs unsupported effects or possession bonuses.");
  const ambushes = encounterAmbushes(instruction);
  if (ambushes.length && player.artifactIds?.length) return failure("MONSTER_EFFECT_UNSUPPORTED", "Ambush Artifact bonuses are not implemented.");
  for (const ambush of ambushes) {
    const definition = content.monsters?.find(monster => monster.id === ambush.monsterId);
    if (!definition || definition.type !== "normal" || definition.specialEffect || !definition.horrorCheck || definition.horrorCheck === "ancient_one" || !definition.damageCheck || definition.damageCheck === "ancient_one" || definition.toughness === "ancient_one") return failure("MONSTER_CONTENT_MISSING", "The named Monster's statistics are missing or unsupported.");
  }
  const next = structuredClone(state);
  next.currentLocationEncounterCardId = cardId;
  next.pendingLocationEncounter = { playerId, cardId, deck, queue: [instruction], dice: [], successes: 0 };
  return continueLocationEncounter(next, content, context);
}

/** Draws a modeled location encounter and resolves until a choice, test, or defeat. */
export function resolveLocationEncounter(state: GameState, playerId: string, deck: LocationEncounterDeckId, content: GameContent, context: EngineContext): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has ended.");
  if (state.phase !== "encounter" || state.activePlayerId !== playerId || state.pendingDecision || state.pendingDefeat || state.activeTest) {
    return failure("WRONG_PHASE", "This investigator cannot resolve a location encounter now.");
  }
  if (!legalLocationEncounterDecks(state, playerId, content).includes(deck)) return failure("ENCOUNTER_DECK_ILLEGAL", "That encounter deck is not legal on this space.");
  const order = state.privateState.deckOrderById[`encounter:${deck}`];
  if (!order?.length) return failure("ENCOUNTER_DECK_MISSING", "The private encounter deck is unavailable.");
  const cardId = order[0]!;
  const card = content.locationEncounters?.find(candidate => candidate.id === cardId && candidate.deck === deck);
  const player = state.players.find(candidate => candidate.id === playerId)!;
  if (!card || !player.locationId) return failure("ENCOUNTER_CONTENT_MISSING", "The top encounter card or location is missing.");
  const section = regionalEncounterDeckByCity[player.locationId] === deck ? player.locationId : content.map.locationTypes[player.locationId];
  const instruction = parseLocationEncounterInstruction(card.sections?.[section ?? ""]);
  if (!instruction || !supportsEncounterAssets(state, player, content, instruction)) {
    return failure("ENCOUNTER_UNSUPPORTED", "This encounter needs effects or possession bonuses that are not executable yet.");
  }
  const next = structuredClone(state);
  next.currentLocationEncounterCardId = cardId;
  next.pendingLocationEncounter = { playerId, cardId, deck, queue: [instruction], dice: [], successes: 0 };
  return continueLocationEncounter(next, content, context);
}

/** Called by verified effects, never exposed as a client command. */
export function delayInvestigator(state: GameState, playerId: string): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has ended.");
  const index = state.players.findIndex(player => player.id === playerId);
  if (index < 0) return failure("PLAYER_NOT_FOUND", "Investigator not found.");
  if (state.players[index]!.defeated || state.players[index]!.eliminated) return failure("INVESTIGATOR_DEFEATED", "Defeated investigators are not affected.");
  if (state.phase === "lobby") return failure("WRONG_PHASE", "The game has not started.");
  const next = structuredClone(state);
  const events: GameEvent[] = [{ type: "INVESTIGATOR_DELAYED", playerId }];
  if (next.phase === "action" && next.activePlayerId === playerId) {
    if (next.pendingDecision?.playerId === playerId) next.pendingDecision = undefined;
    if (next.activeTest?.playerId === playerId) next.activeTest = undefined;
    advanceActionInvestigator(next, index, events);
  } else next.players[index]!.delayed = true;
  return success(next, events);
}

function completeAction(state: GameState, actorIndex: number, action: ActionType, events: GameEvent[]): void {
  state.performedActions.push(action);
  state.actionsRemaining -= 1;
  if (state.actionsRemaining === 0) advanceActionInvestigator(state, actorIndex, events);
}

function restAssetSources(state: GameState, actor: EnginePlayer, content: GameContent): string[] {
  return state.players.filter(player => !player.defeated && !player.eliminated && !!actor.locationId && player.locationId === actor.locationId)
    .flatMap(player => player.assetIds.filter(id => content.assets.find(card => card.id === id)?.engineEffects?.some(effect =>
      effect.type === "rest_health_or_discard_cursed" || effect.type === "rest_test_gain_artifact" && player.id === actor.id)));
}

function restCursedId(actor: EnginePlayer, content: GameContent): string | undefined {
  return actor.conditionIds?.find(id => content.conditions?.find(card => card.id === id)?.kind === "cursed");
}

function validateRestAssets(state: GameState, actor: EnginePlayer, content: GameContent): CommandResult | undefined {
  const sources = restAssetSources(state, actor, content);
  if (sources.some(id => !physicalAssetIsUnique(state, id))) return failure("ASSET_CONTENT_MISSING", "The Rest Ally identity is inconsistent.");
  if (sources.length) {
    const cursed = restCursedId(actor, content);
    if (cursed && [...state.players.flatMap(player => player.conditionIds ?? []), ...Object.values(state.privateState.tokenPoolById).flat()].filter(id => id === cursed).length !== 1) {
      return failure("CONDITION_CONTENT_MISSING", "The Cursed identity is inconsistent.");
    }
  }
  return undefined;
}

function prepareRestContinuation(state: GameState, actorIndex: number, content: GameContent, context: EngineContext | undefined, events: GameEvent[]): CommandResult | undefined {
  const actor = state.players[actorIndex]!;
  const invalid = validateRestAssets(state, actor, content);
  if (invalid) return invalid;
  const eligible = restAssetSources(state, actor, content);
  const rest = state.pendingRest ?? { playerId: actor.id, remainingAssetIds: eligible };
  if (rest.playerId !== actor.id || rest.remainingAssetIds.some(id => !eligible.includes(id))) return failure("ASSET_CONTENT_MISSING", "A remaining Rest source is no longer available.");
  if (rest.remainingAssetIds.length) {
    if (!context) return failure("RANDOM_INPUT_REQUIRED", "The Rest bonus requires a decision ID.");
    state.pendingRest = rest;
    const optionLabels: Record<string, string> = {};
    for (const source of rest.remainingAssetIds) {
      if (content.assets.find(card => card.id === source)?.engineEffects.some(effect => effect.type === "rest_test_gain_artifact")) {
        optionLabels[`${source}:attempt`] = "Puzzle Box: attempt Observation −2";
        optionLabels[`${source}:skip`] = "Skip Puzzle Box";
      } else {
        optionLabels[`${source}:health`] = "Recover 1 additional Health";
        if (restCursedId(actor, content)) optionLabels[`${source}:discard-cursed`] = "Discard Cursed";
        optionLabels[`${source}:skip`] = "Skip bonus";
      }
    }
    state.pendingDecision = {
      id: context.createId(), kind: "rest_asset_choice", continuation: "rest_asset_effect",
      playerId: actor.id, visibility: "owner", prompt: "Choose a Rest effect to resolve next, or skip that source.",
      optionIds: Object.keys(optionLabels), optionLabels,
      minSelections: 1, maxSelections: 1,
    };
  } else {
    state.pendingRest = undefined;
    completeAction(state, actorIndex, "rest", events);
  }
  return undefined;
}

function finishRest(state: GameState, actorIndex: number, content: GameContent, context: EngineContext | undefined, events: GameEvent[]): CommandResult {
  return prepareRestContinuation(state, actorIndex, content, context, events) ?? success(state, events);
}

/** Do not discard the Box, peek publicly, or search past an unsupported draw. */
function validatePuzzleBoxTest(state: GameState, actor: EnginePlayer, source: string, content: GameContent): CommandResult | undefined {
  if (state.phase !== "action" || state.activePlayerId !== actor.id || actor.defeated || actor.eliminated || actor.delayed
    || state.actionsRemaining < 1 || state.performedActions.includes("rest") || (actor.locationId && state.monsterLocationIds.includes(actor.locationId))
    || actor.conditionIds?.some(id => content.conditions?.find(card => card.id === id)?.kind === "detained")
    || !actor.investigatorId || !content.investigators[actor.investigatorId]?.skills
    || !actor.assetIds.includes(source) || !physicalAssetIsUnique(state, source)
    || !content.assets.find(card => card.id === source)?.engineEffects.some(effect => effect.type === "rest_test_gain_artifact")) {
    return failure("ASSET_CONTENT_MISSING", "The Puzzle Box Rest test is no longer available.");
  }
  const auraSources = content.map.locationTypes[actor.locationId!] === "city"
    ? state.players.filter(holder => !holder.defeated && !holder.eliminated && holder.locationId === actor.locationId)
      .flatMap(holder => holder.assetIds.filter(id => content.assets.find(card => card.id === id)?.engineEffects.some(effect => effect.type === "city_test_aura")))
    : [];
  if ([...actor.assetIds, ...auraSources].some(id => !physicalAssetIsUnique(state, id))) return failure("ASSET_CONTENT_MISSING", "The test possession identities are inconsistent.");
  if (actor.assetIds.some(id => !content.assets.find(card => card.id === id)?.nonCombatEncounterSupport || content.assets.find(card => card.id === id)?.nonCombatEncounterSupport === "unsupported")
    || actor.artifactIds?.some(id => !supportedArtifact(id, content))) return failure("ARTIFACT_EFFECT_UNSUPPORTED", "Carried possessions have unsupported test effects.");
  const catalog = content.artifacts?.map(card => card.id);
  const deck = state.privateState.deckOrderById.artifacts;
  const physical = [...(deck ?? []), ...state.players.flatMap(player => player.artifactIds ?? []), ...(state.defeatedInvestigators ?? []).flatMap(player => player.artifactIds ?? [])];
  if (!catalog || !deck || new Set(catalog).size !== catalog.length || new Set(physical).size !== physical.length || physical.length !== catalog.length || physical.some(id => !catalog.includes(id))) {
    return failure("ARTIFACT_CONTENT_MISSING", "The physical Artifact supply is inconsistent.");
  }
  if (deck.length && !supportedArtifact(deck[0]!, content)) return failure("ARTIFACT_EFFECT_UNSUPPORTED", "The next Artifact's gain/effects are not implemented; skip Puzzle Box to finish Rest.");
  return undefined;
}

function remainingTickets(player: EnginePlayer, bundle: TradeBundle): TravelTicketType[] | undefined {
  const tickets = [...(player.travelTickets ?? [])];
  for (const ticket of bundle.tickets) {
    const index = tickets.indexOf(ticket);
    if (index < 0) return undefined;
    tickets.splice(index, 1);
  }
  return tickets;
}

function ownsBundle(player: EnginePlayer, bundle: TradeBundle): boolean {
  return Number.isInteger(bundle.clues) && bundle.clues >= 0 && player.clues >= bundle.clues
    && new Set(bundle.assetIds).size === bundle.assetIds.length
    && bundle.assetIds.every(id => player.assetIds.includes(id))
    && remainingTickets(player, bundle) !== undefined;
}

function canTrade(a: EnginePlayer, b: EnginePlayer, give: TradeBundle, receive: TradeBundle): boolean {
  return !a.defeated && !b.defeated && !a.eliminated && !b.eliminated && a.id !== b.id && !!a.locationId && a.locationId === b.locationId
    && ownsBundle(a, give) && ownsBundle(b, receive)
    && (a.travelTickets?.length ?? 0) - give.tickets.length + receive.tickets.length <= 2
    && (b.travelTickets?.length ?? 0) - receive.tickets.length + give.tickets.length <= 2;
}

function exchangePossessions(a: EnginePlayer, b: EnginePlayer, give: TradeBundle, receive: TradeBundle): void {
  a.assetIds = [...a.assetIds.filter(id => !give.assetIds.includes(id)), ...receive.assetIds];
  b.assetIds = [...b.assetIds.filter(id => !receive.assetIds.includes(id)), ...give.assetIds];
  a.clues += receive.clues - give.clues;
  b.clues += give.clues - receive.clues;
  a.travelTickets = [...remainingTickets(a, give)!, ...receive.tickets];
  b.travelTickets = [...remainingTickets(b, receive)!, ...give.tickets];
}

function heldClueKey(playerId: string): string { return `held_clues:${playerId}`; }

function discardHeldClues(state: GameState, playerId: string, amount: number): boolean {
  if (!state.privateState.tokenPoolById.clues) return true; // Legacy fixtures without physical Clue content.
  const held = state.privateState.tokenPoolById[heldClueKey(playerId)];
  if (!held || held.length < amount) return false;
  (state.privateState.tokenPoolById.clue_discard ??= []).push(...held.splice(0, amount));
  return true;
}

function transferHeldClues(state: GameState, fromId: string, toId: string, amount: number): boolean {
  if (!state.privateState.tokenPoolById.clues || amount === 0) return true;
  const from = state.privateState.tokenPoolById[heldClueKey(fromId)];
  const to = state.privateState.tokenPoolById[heldClueKey(toId)];
  if (!from || !to || from.length < amount) return false;
  to.push(...from.splice(0, amount));
  return true;
}

function refillReserve(state: GameState): string[] {
  const drawn: string[] = [];
  const deck = state.privateState.deckOrderById.assets ?? [];
  while (state.reserveAssetIds.length < 4 && deck.length > 0) {
    const assetId = deck.shift()!;
    state.reserveAssetIds.push(assetId);
    drawn.push(assetId);
  }
  return drawn;
}

function assetEffectsForPlayer(player: EnginePlayer, content: GameContent): AssetEngineEffect[] {
  return player.assetIds.flatMap((assetId) => content.assets.find(({ id }) => id === assetId)?.engineEffects ?? []);
}

function countActiveTestSuccesses(test: ActiveTest, player: EnginePlayer, content: GameContent): number {
  const doubleSixes = test.continuation === "acquire_assets"
    && assetEffectsForPlayer(player, content).some(({ type }) => type === "acquire_six_counts_as_two");
  return doubleSixes
    ? test.dice.reduce((total, die) => total + (die === 6 ? 2 : die >= test.successThreshold ? 1 : 0), 0)
    : countTestSuccesses(test.dice, test.successThreshold);
}

function canUseAssetTestReroll(state: GameState, player: EnginePlayer, skill: SkillId, assetId: string, content: GameContent, usedTestSources: readonly string[] = []): boolean {
  if (!player.assetIds.includes(assetId) || usedTestSources.includes(assetId)) return false;
  return content.assets.find(asset => asset.id === assetId)?.engineEffects.some(effect =>
    effect.type === "test_reroll" && effect.skill === skill
    || effect.type === "round_test_reroll" && !state.usedAssetRerollIds?.includes(assetId)) ?? false;
}

function canUseAssetDieIncrement(state: GameState, player: EnginePlayer, assetId: string, content: GameContent): boolean {
  return player.assetIds.includes(assetId) && !state.usedAssetDieModifierIds?.includes(assetId)
    && physicalAssetIsUnique(state, assetId)
    && (content.assets.find(asset => asset.id === assetId)?.engineEffects.some(effect => effect.type === "round_test_die_increment") ?? false);
}

function createTestRerollDecision(state: GameState, test: ActiveTest, content: GameContent, context: EngineContext): boolean {
  const player = state.players.find(player => player.id === test.playerId);
  if (!player) return false;
  const optionIds = player.clues > 0 ? test.dice.map((_, index) => `die-${index}`) : [];
  const optionLabels: Record<string, string> = Object.fromEntries(optionIds.map((id, index) => [id, `Spend 1 Clue: reroll die ${index + 1}`]));
  for (const assetId of player.assetIds) {
    if (canUseAssetDieIncrement(state, player, assetId, content)) {
      const assetName = content.assets.find(asset => asset.id === assetId)?.name ?? assetId;
      test.dice.forEach((die, index) => {
        // Only modeled six-sided results: above-six effects need separate rules.
        if (die < 1 || die >= 6) return;
        const id = `asset-increment:${assetId}:${index}`;
        optionIds.push(id); optionLabels[id] = `${assetName}: add 1 to die ${index + 1} (${die} → ${die + 1}; no Clue)`;
      });
    }
    if (!canUseAssetTestReroll(state, player, test.skill, assetId, content, test.usedRerollAssetIds)) continue;
    const assetName = content.assets.find(asset => asset.id === assetId)?.name ?? assetId;
    test.dice.forEach((_, index) => {
      const id = `asset-reroll:${assetId}:${index}`;
      optionIds.push(id); optionLabels[id] = `${assetName}: reroll die ${index + 1} (no Clue)`;
    });
  }
  if (!optionIds.length) return false;
  state.pendingDecision = {
    id: context.createId(),
    kind: "select_rerolls",
    playerId: test.playerId,
    visibility: "owner",
    prompt: "Choose a test die effect and die, or keep the current result.",
    optionIds, optionLabels,
    minSelections: 0,
    maxSelections: 1,
    continuation: "test_reroll",
  };
  return true;
}

function createAcquireAssetsDecision(state: GameState, test: ActiveTest, content: GameContent, context: EngineContext): GameEvent[] {
  state.activeTest = undefined;
  const player = state.players.find(candidate => candidate.id === test.playerId);
  const hasDebt = player?.conditionIds?.some(id => content.conditions?.find(card => card.id === id)?.kind === "debt") ?? false;
  const bankLoanAvailable = !hasDebt && (state.privateState.tokenPoolById[conditionPoolKey("debt")]?.length ?? 0) > 0;
  state.pendingDecision = {
    id: context.createId(),
    kind: "select_acquired_cards",
    playerId: test.playerId,
    visibility: "owner",
    prompt: `Choose Assets with a total value of ${test.successes} or less.${bankLoanAvailable ? " You may take a Bank Loan (gain Debt) for 2 extra successes." : ""}`,
    optionIds: [...state.reserveAssetIds, ...(bankLoanAvailable ? ["bank-loan"] : [])],
    minSelections: 0,
    maxSelections: state.reserveAssetIds.length + (bankLoanAvailable ? 1 : 0),
    selectionBudget: test.successes,
    continuation: "acquire_assets_purchase",
  };
  return [{
    type: "TEST_RESOLVED",
    testId: test.id,
    playerId: test.playerId,
    successes: test.successes,
    continuation: test.continuation,
  }];
}

function artifactTargets(state: GameState, player: EnginePlayer, content: GameContent): MonsterInstance[] {
  return (state.monsters ?? []).filter(instance => {
    const definition = content.monsters?.find(card => card.id === instance.monsterId);
    // Special defeat/damage abilities need their own handlers before this action can target them.
    return instance.locationId === player.locationId && definition && !definition.specialEffect && definition.toughness !== "ancient_one";
  });
}

function supportedArtifact(id: string, content: GameContent): boolean {
  const effects = content.artifacts?.find(card => card.id === id)?.engineEffects;
  return id === "artifact_ttka_halot"
    || id === "artifact_cultes_des_goules" && !!effects?.some(effect => effect.type === "action_lore_spend_sanity_gain_clues" && effect.amount === 2)
    || id === "artifact_de_vermis_mysteriis" && !!effects?.some(effect => effect.type === "action_lore_spend_sanity_improve_skill");
}

/** Revalidate the original physical source on every restored/resumed command. */
function validateTomeAction(state: GameState, player: EnginePlayer, content: GameContent, source: string): CommandResult | undefined {
  const physical = [...(state.privateState.deckOrderById.artifacts ?? []), ...state.players.flatMap(holder => holder.artifactIds ?? []), ...(state.defeatedInvestigators ?? []).flatMap(holder => holder.artifactIds ?? [])];
  if (!supportedArtifact(source, content) || !player.artifactIds?.includes(source) || physical.filter(id => id === source).length !== 1
    || state.phase !== "action" || state.activePlayerId !== player.id || state.actionsRemaining < 1 || player.defeated || player.eliminated || player.delayed
    || player.conditionIds?.some(id => content.conditions?.find(card => card.id === id)?.kind === "detained")
    || state.usedArtifactActionIds?.includes(source)) return failure("ARTIFACT_UNAVAILABLE", "The original Tome action is no longer available.");
  return validateArtifactTestAssets(state, player, content);
}

/** Explicit non-combat applicability, not an empty-effect-list whitelist.
 * Sanity paid by these actions is a cost, not preventable ordinary damage.
 */
function validateArtifactTestAssets(state: GameState, player: EnginePlayer, content: GameContent): CommandResult | undefined {
  if (player.artifactIds?.some(id => !supportedArtifact(id, content))
    || player.assetIds.some(id => {
      const asset = content.assets.find(card => card.id === id);
      return !asset?.nonCombatEncounterSupport || asset.nonCombatEncounterSupport === "unsupported";
    })) return failure("ARTIFACT_EFFECT_UNSUPPORTED", "Carried possessions have unsupported Artifact test effects.");
  const auraSources = player.locationId && content.map.locationTypes[player.locationId] === "city"
    ? state.players.filter(holder => !holder.defeated && !holder.eliminated && holder.locationId === player.locationId)
      .flatMap(holder => holder.assetIds.filter(id => content.assets.find(card => card.id === id)?.engineEffects.some(effect => effect.type === "city_test_aura")))
    : [];
  if ([...player.assetIds, ...auraSources].some(id => !physicalAssetIsUnique(state, id))) return failure("ASSET_CONTENT_MISSING", "The Artifact test possession identities are inconsistent.");
  return undefined;
}

/** One owner choice combines the optional payment and its reward, including Lily's option. */
function vermisImprovementOptions(player: EnginePlayer): [string, string][] {
  return ["lore", "influence", "observation", "strength", "will"].flatMap(skill =>
    (player.investigatorId === "lily_chen" ? [1, 2] : [1]).map(amount =>
      [`vermis:${skill}:${amount}`, `Spend 1 Sanity: improve ${skill}${amount === 2 ? " twice (Lily)" : " once"}`] as [string, string]));
}

function validateArtifactClues(state: GameState, content: GameContent): CommandResult | undefined {
  const pools = state.privateState.tokenPoolById;
  const physical = Object.entries(pools).filter(([key]) => key === "clues" || key === "clue_discard" || key.startsWith("held_clues:") || key.startsWith("board_clue:") || key.startsWith("defeated_clues:")).flatMap(([, ids]) => ids);
  if (!pools.clues || !content.clues || new Set(content.clues.map(card => card.id)).size !== content.clues.length || physical.length !== content.clues.length
    || new Set(physical).size !== physical.length || physical.some(id => !content.clues!.some(card => card.id === id))
    || state.players.some(player => (pools[heldClueKey(player.id)]?.length ?? 0) !== player.clues)) return failure("CLUE_CONTENT_MISSING", "Physical Clue supply or holdings are inconsistent.");
  return undefined;
}

function completeArtifactAction(state: GameState, playerId: string, events: GameEvent[], artifactId = "artifact_ttka_halot"): void {
  state.usedArtifactActionIds = [...(state.usedArtifactActionIds ?? []), artifactId];
  completeAction(state, state.players.findIndex(player => player.id === playerId), "component", events);
}

function finishSkillTest(state: GameState, test: ActiveTest, content: GameContent, context: EngineContext): GameEvent[] {
  if (test.continuation === "acquire_assets") return createAcquireAssetsDecision(state, test, content, context);
  if (test.continuation === "rest_asset") {
    const rest = state.pendingRest!;
    const source = rest.testingAssetId!;
    const player = state.players.find(candidate => candidate.id === test.playerId)!;
    state.activeTest = undefined;
    state.pendingDecision = undefined;
    const events: GameEvent[] = [{ type: "TEST_RESOLVED", testId: test.id, playerId: player.id, successes: test.successes, continuation: test.continuation }];
    if (test.successes > 0) {
      player.assetIds = player.assetIds.filter(id => id !== source);
      state.assetDiscardIds.push(source);
      events.push({ type: "ASSET_DISCARDED", playerId: player.id, assetId: source, reason: "rest" });
      const artifact = state.privateState.deckOrderById.artifacts![0];
      if (artifact) {
        // Acceptance and every resumed test command preflight this exact top card.
        state.privateState.deckOrderById.artifacts!.shift();
        player.artifactIds = [...(player.artifactIds ?? []), artifact];
        events.push({ type: "ARTIFACT_GAINED", playerId: player.id, artifactId: artifact });
      }
    }
    rest.testingAssetId = undefined;
    rest.remainingAssetIds = rest.remainingAssetIds.filter(id => id !== source);
    const invalid = prepareRestContinuation(state, state.players.findIndex(candidate => candidate.id === player.id), content, context, events);
    if (invalid) throw new Error("Validated Rest continuation became inconsistent.");
    return events;
  }
  if (test.continuation === "artifact_action") {
    state.activeTest = undefined;
    const player = state.players.find(candidate => candidate.id === test.playerId)!;
    const events: GameEvent[] = [{ type: "TEST_RESOLVED", testId: test.id, playerId: player.id, successes: test.successes, continuation: test.continuation }];
    if (test.sourceArtifactId === "artifact_de_vermis_mysteriis") {
      if (test.successes > 0 && (player.sanity ?? 0) > 1) {
        const options = [...vermisImprovementOptions(player), ["vermis:skip", "Decline"] as [string, string]];
        state.pendingDecision = { id: context.createId(), kind: "artifact_payment", playerId: player.id, visibility: "owner", prompt: "De Vermis Mysteriis: spend 1 Sanity to improve a skill of your choice, or decline.", optionIds: options.map(([id]) => id), optionLabels: Object.fromEntries(options), minSelections: 1, maxSelections: 1 };
      } else completeArtifactAction(state, player.id, events, test.sourceArtifactId);
      return events;
    }
    if (test.sourceArtifactId === "artifact_cultes_des_goules") {
      if (test.successes > 0 && (player.sanity ?? 0) > 1) {
        state.pendingDecision = { id: context.createId(), kind: "artifact_payment", playerId: player.id, visibility: "owner", prompt: "Cultes des Goules: spend 1 Sanity to gain 2 Clues, or decline.", optionIds: ["cultes:accept", "cultes:skip"], optionLabels: { "cultes:accept": "Spend 1 Sanity: gain 2 Clues", "cultes:skip": "Decline" }, minSelections: 1, maxSelections: 1 };
      } else completeArtifactAction(state, player.id, events, test.sourceArtifactId);
      return events;
    }
    const targets = artifactTargets(state, player, content);
    if (test.successes > 0 && (player.sanity ?? 0) > 1 && targets.length) {
      state.pendingDecision = { id: context.createId(), kind: "artifact_target", playerId: player.id, visibility: "owner", prompt: "T'tka Halot: spend 1 Sanity for a Monster on your space to lose 3 Health, or decline.", optionIds: ["skip", ...targets.map(instance => instance.id)], optionLabels: Object.fromEntries([["skip", "Decline"], ...targets.map(instance => [instance.id, instance.monsterId])]), minSelections: 1, maxSelections: 1 };
    } else completeArtifactAction(state, player.id, events);
    return events;
  }
  state.activeTest = undefined;
  const conditionId = test.sourceConditionId;
  const owner = conditionId ? state.players.find(player => player.conditionIds?.includes(conditionId)) : undefined;
  const events: GameEvent[] = [{ type: "TEST_RESOLVED", testId: test.id, playerId: test.playerId, successes: test.successes, continuation: test.continuation }];
  if (test.continuation === "condition_reckoning") {
    if (conditionId && owner && test.successes === 0) {
      const effect = content.conditions?.find(card => card.id === conditionId)?.backEffect;
      if (effect) events.push(...applyConditionBackEffect(state, owner.id, conditionId, content, effect, context));
    }
    return events;
  }
  if (conditionId && owner && test.successes > 0) {
    if (returnConditionToPool(state, owner, conditionId, content)) {
      events.push({ type: "CONDITION_DISCARDED", playerId: owner.id, conditionId: publicConditionId(conditionId) });
    }
  }
  if (conditionId && owner) state.usedConditionActionIds = [...(state.usedConditionActionIds ?? []), `condition_action:${owner.id}:${publicConditionId(conditionId)}`];
  const actorIndex = state.players.findIndex(player => player.id === test.playerId);
  completeAction(state, actorIndex, "component", events);
  return events;
}

function beginSkillTest(
  state: GameState,
  player: EnginePlayer,
  request: { skill: SkillId; modifier: number; continuation: ActiveTest["continuation"]; sourceConditionId?: string; sourceArtifactId?: string; itemBonuses?: readonly number[]; otherBonuses?: readonly number[] },
  content: GameContent,
  context: EngineContext,
): GameEvent[] {
  if (!player.investigatorId) throw new Error("Cannot begin a test without an investigator.");
  const investigator = content.investigators[player.investigatorId];
  if (!investigator) throw new Error("Cannot begin a test without investigator content.");
  const assetBonuses = assetEffectsForPlayer(player, content).flatMap((effect) =>
    effect.type === "skill_bonus" && effect.skill === request.skill ? [effect.amount] : []);
  const calculation = calculateDicePool({
    skill: request.skill,
    baseSkill: investigator.skills[request.skill],
    improvement: player.skillImprovements[request.skill],
    modifier: request.modifier,
    itemBonuses: request.itemBonuses,
    otherBonuses: [...(request.otherBonuses ?? []), ...assetBonuses],
  });
  const test: ActiveTest = {
    id: context.createId(),
    playerId: player.id,
    skill: request.skill,
    modifier: request.modifier,
    dicePool: calculation.dicePool,
    dice: Array.from({ length: calculation.dicePool }, () => context.rollDie()),
    successes: 0,
    successThreshold: conditionSuccessThreshold(player.conditionIds ?? []),
    continuation: request.continuation,
    sourceConditionId: request.sourceConditionId,
    sourceArtifactId: request.sourceArtifactId,
  };
  test.successes = countActiveTestSuccesses(test, player, content);
  state.activeTest = test;
  const events: GameEvent[] = [{
    type: "TEST_ROLLED",
    testId: test.id,
    playerId: player.id,
    skill: test.skill,
    modifier: test.modifier,
    dice: [...test.dice],
    successes: test.successes,
  }];
  if (!createTestRerollDecision(state, test, content, context)) events.push(...finishSkillTest(state, test, content, context));
  return events;
}

export function executeCommand(
  state: GameState,
  actorPlayerId: string,
  command: GameCommand,
  content: GameContent,
  context?: EngineContext,
): CommandResult {
  const actorIndex = state.players.findIndex((player) => player.id === actorPlayerId);
  if (actorIndex < 0) return failure("PLAYER_NOT_FOUND", "The acting player is not in this game.");
  if (state.gameResult) return failure("GAME_ENDED", "The game has already ended.");
  if (command.type === "FIGHT_MONSTER") {
    if (state.phase !== "encounter" || state.activePlayerId !== actorPlayerId || state.encounteredMonsterInstanceIds?.includes(command.monsterInstanceId)) {
      return failure("INVALID_COMBAT", "This Monster cannot be encountered again by this investigator.");
    }
    if (!context) return failure("RANDOM_INPUT_REQUIRED", "Combat requires server dice.");
    const fought = resolveCombatEncounter(state, actorPlayerId, command.monsterInstanceId, content, context);
    if (!fought.ok) return fought;
    const nextCombat = fought.state;
    nextCombat.stateVersion = state.stateVersion + 1;
    nextCombat.encounteredMonsterInstanceIds = [...(state.encounteredMonsterInstanceIds ?? []), command.monsterInstanceId];
    if (nextCombat.pendingDefeat || nextCombat.gameResult) return fought;
    const player = nextCombat.players.find(candidate => candidate.id === actorPlayerId);
    const remaining = nextCombat.monsters?.filter(monster => monster.locationId === player?.locationId) ?? [];
    if (remaining.length && remaining.every(monster => nextCombat.encounteredMonsterInstanceIds?.includes(monster.id))) {
      const advanced = advanceEncounterInvestigator(nextCombat, actorPlayerId);
      if (!advanced.ok) return advanced;
      advanced.state.stateVersion = state.stateVersion;
      return success(advanced.state, [...fought.events, ...advanced.events]);
    }
    return fought;
  }
  if (command.type === "RESOLVE_LOCATION_ENCOUNTER") {
    if (!context) return failure("RANDOM_INPUT_REQUIRED", "Encounter resolution requires server randomness.");
    return resolveLocationEncounter(state, actorPlayerId, command.deck, content, context);
  }
  if (command.type === "RESOLVE_RESEARCH_ENCOUNTER") {
    if (!context) return failure("RANDOM_INPUT_REQUIRED", "Research encounters require server randomness.");
    return resolveResearchEncounter(state, actorPlayerId, command.clueId, content, context);
  }
  if (command.type === "RESOLVE_OTHER_WORLD_ENCOUNTER") {
    if (!context) return failure("RANDOM_INPUT_REQUIRED", "Other World encounters require server randomness.");
    return resolveOtherWorldEncounter(state, actorPlayerId, command.gateId, content, context);
  }
  if (command.type === "RESOLVE_DECISION" && state.pendingLocationEncounter?.deck === "other_world" && !otherWorldBindingIsValid(state, content)) return failure("ENCOUNTER_CONTENT_MISSING", "The bound Gate or Other World deck changed.");
  if (command.type === "RESOLVE_DECISION" && state.pendingLocationEncounter) {
    const invalidDynamic = validateEncounterDynamicInstructions(state, state.pendingLocationEncounter.queue, content);
    if (invalidDynamic) return invalidDynamic;
    const invalid = validateEncounterDoomInstructions(state, state.pendingLocationEncounter.queue);
    if (invalid) return invalid;
  }
  if (command.type === "ADVANCE_MYTHOS") {
    if (state.phase !== "mythos" || actorPlayerId !== state.leadInvestigatorId) return failure("WRONG_PHASE", "Only the Lead Investigator can advance the Mythos phase.");
    if (!context) return failure("RANDOM_INPUT_REQUIRED", "Mythos resolution requires server randomness.");
    return advanceMythosIcon(state, content, context);
  }
  if (command.type === "BEGIN_NEXT_ROUND") {
    if (state.phase !== "mythos" || state.leadInvestigatorId !== actorPlayerId || !state.replacementWindow || state.currentMythosCardId || state.pendingDecision || state.pendingDefeat || state.activeTest) {
      return failure("WRONG_PHASE", "Only the Lead Investigator can begin the next round after Mythos and replacement choices.");
    }
    const nextRound = structuredClone(state);
    const leadIndex = nextRound.players.findIndex(player => player.id === nextRound.leadInvestigatorId);
    const first = [...nextRound.players.slice(leadIndex), ...nextRound.players.slice(0, leadIndex)]
      .find(player => !player.defeated && !player.eliminated);
    if (!first) return failure("INVESTIGATOR_DEFEATED", "No investigator remains to begin the round.");
    nextRound.phase = "action";
    nextRound.activePlayerId = first.id;
    nextRound.turnNumber += 1;
    nextRound.actionsRemaining = 2;
    nextRound.performedActions = [];
    nextRound.usedConditionActionIds = [];
    nextRound.usedArtifactActionIds = [];
    nextRound.usedAssetRerollIds = [];
    nextRound.usedAssetDieModifierIds = [];
    nextRound.replacementWindow = false;
    nextRound.encounteredMonsterInstanceIds = [];
    return success(nextRound, [{ type: "PHASE_ADVANCED", phase: "action", activePlayerId: first.id }]);
  }

  const next: GameState = {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      travelTickets: player.travelTickets ? [...player.travelTickets] : undefined,
      assetIds: [...player.assetIds],
      ...(player.artifactIds ? { artifactIds: [...player.artifactIds] } : {}),
      ...(player.conditionIds ? { conditionIds: [...player.conditionIds] } : {}),
      skillImprovements: { ...player.skillImprovements },
    })),
    performedActions: [...state.performedActions],
    usedConditionActionIds: [...(state.usedConditionActionIds ?? [])],
    usedArtifactActionIds: [...(state.usedArtifactActionIds ?? [])],
    usedAssetRerollIds: [...(state.usedAssetRerollIds ?? [])],
    usedAssetDieModifierIds: [...(state.usedAssetDieModifierIds ?? [])],
    monsterLocationIds: [...state.monsterLocationIds],
    monsters: state.monsters?.map(monster => ({ ...monster })),
    activeGateIds: [...(state.activeGateIds ?? [])],
    discardedGateIds: [...(state.discardedGateIds ?? [])],
    boardClues: state.boardClues?.map(clue => ({ ...clue })),
    reserveAssetIds: [...state.reserveAssetIds],
    assetDiscardIds: [...state.assetDiscardIds],
    completedMysteryIds: [...state.completedMysteryIds],
    pendingDecision: state.pendingDecision ? cloneDecision(state.pendingDecision) : undefined,
    activeTest: state.activeTest ? { ...state.activeTest, dice: [...state.activeTest.dice], usedRerollAssetIds: state.activeTest.usedRerollAssetIds?.slice() } : undefined,
    pendingLocationEncounter: state.pendingLocationEncounter ? structuredClone(state.pendingLocationEncounter) : undefined,
    pendingRest: state.pendingRest ? structuredClone(state.pendingRest) : undefined,
    privateState: {
      deckOrderById: Object.fromEntries(
        Object.entries(state.privateState.deckOrderById).map(([id, cards]) => [id, [...cards]]),
      ),
      tokenPoolById: Object.fromEntries(
        Object.entries(state.privateState.tokenPoolById).map(([id, tokens]) => [id, [...tokens]]),
      ),
    },
  };
  const actor = next.players[actorIndex]!;

  if (command.type === "RESOLVE_DEFEAT") {
    const defeat = state.pendingDefeat;
    if (!defeat || defeat.playerId !== actorPlayerId || !defeat.cityIds.includes(command.cityId) || !defeat.causes.includes(command.cause)) return failure("INVALID_DEFEAT", "Choose a legal defeat location and cause.");
    const survivors = next.players.filter(player => !player.defeated && !player.eliminated);
    if (state.leadInvestigatorId === actorPlayerId && survivors.length && !survivors.some(player => player.id === command.leadPlayerId)) return failure("INVALID_DEFEAT", "Choose a surviving lead investigator.");
    if (next.privateState.tokenPoolById.clues) {
      const held = next.privateState.tokenPoolById[heldClueKey(actorPlayerId)];
      if (!held || held.length !== actor.clues) return failure("CLUE_CONTENT_MISSING", "The defeated investigator's physical Clues are unavailable.");
      next.privateState.tokenPoolById[`defeated_clues:${actor.investigatorId}`] = held.splice(0);
    }
    next.defeatedInvestigators = [...(state.defeatedInvestigators ?? []), { investigatorId: actor.investigatorId!, locationId: command.cityId, cause: command.cause, assetIds: [...actor.assetIds], artifactIds: [...(actor.artifactIds ?? [])], clues: actor.clues, travelTickets: [...(actor.travelTickets ?? [])] }];
    actor.assetIds = [];
    actor.artifactIds = [];
    for (const id of [...(actor.conditionIds ?? [])]) returnConditionToPool(next, actor, id, content);
    actor.clues = 0;
    actor.travelTickets = [];
    actor.skillImprovements = {};
    actor.health = 0;
    actor.sanity = 0;
    actor.locationId = command.cityId;
    next.pendingDefeat = undefined;
    const newLeadInvestigatorId = state.leadInvestigatorId === actorPlayerId ? command.leadPlayerId ?? survivors[0]?.id ?? state.leadInvestigatorId : next.leadInvestigatorId;
    const events: GameEvent[] = [];
    if (state.phase === "encounter" && state.activePlayerId === actorPlayerId) {
      const advanced = advanceEncounterInvestigator(next, actorPlayerId);
      if (!advanced.ok) return advanced;
      next.phase = advanced.state.phase;
      next.activePlayerId = next.phase === "mythos" ? newLeadInvestigatorId : advanced.state.activePlayerId;
      next.encounteredMonsterInstanceIds = [];
      events.push({ type: "PHASE_ADVANCED", phase: next.phase, activePlayerId: next.activePlayerId });
    } else if (state.phase === "action" && state.activePlayerId === actorPlayerId) {
      next.leadInvestigatorId = newLeadInvestigatorId;
      advanceActionInvestigator(next, actorIndex, events);
    } else if (state.activePlayerId === actorPlayerId) next.activePlayerId = newLeadInvestigatorId;
    next.leadInvestigatorId = newLeadInvestigatorId;
    if (next.pendingMythosDamage) {
      next.stateVersion = state.stateVersion;
      const continued = continueMythosDamage(next, content);
      if (!continued.ok) return continued;
      return { ...continued, events: [...events, ...continued.events] };
    }
    if (next.pendingFromBadToWorse) {
      next.stateVersion = state.stateVersion;
      const continued = continueFromBadToWorse(next, content);
      if (!continued.ok) return continued;
      return { ...continued, events: [...events, ...continued.events] };
    }
    if (next.pendingHeatWave) {
      next.stateVersion = state.stateVersion;
      const continued = continueHeatWave(next, content, context);
      if (!continued.ok) return continued;
      return { ...continued, events: [...events, ...continued.events] };
    }
    if (next.pendingTideOfDespair) {
      next.stateVersion = state.stateVersion;
      const continued = continueTideOfDespair(next, content, context);
      if (!continued.ok) return continued;
      return { ...continued, events: [...events, ...continued.events] };
    }
    if (next.pendingUnexpectedBetrayal) {
      next.stateVersion = state.stateVersion;
      const continued = continueUnexpectedBetrayal(next, content, context);
      if (!continued.ok) return continued;
      return { ...continued, events: [...events, ...continued.events] };
    }
    if (state.phase === "mythos" && content.mythosCards?.find(card => card.id === state.currentMythosCardId)?.effect?.type === "lead_discard_monster_lose_toughness_health") {
      return finishMythosEvent(state, next, events, content);
    }
    return success(next, events);
  }
  if (state.pendingDefeat) return failure("INVALID_DEFEAT", "Resolve the pending defeat first.");
  if (command.type === "REPLACE_INVESTIGATOR") {
    if (!state.replacementWindow || !actor.defeated || actor.eliminated || state.awakened) return failure("WRONG_PHASE", "Replacement is available at the end of Mythos before awakening.");
    if (state.players.some(player => player.investigatorId === command.investigatorId) || state.defeatedInvestigators?.some(player => player.investigatorId === command.investigatorId)) return failure("INVESTIGATOR_TAKEN", "That investigator is unavailable.");
    const setup = content.investigators[command.investigatorId];
    if (!setup) return failure("INVESTIGATOR_CONTENT_MISSING", "Investigator setup is missing.");
    if (next.privateState.tokenPoolById.clues) {
      const held = next.privateState.tokenPoolById[heldClueKey(actorPlayerId)];
      if (!held || held.length !== 0) return failure("CLUE_CONTENT_MISSING", "The previous investigator's Clues were not set aside.");
      let available = next.privateState.tokenPoolById.clues;
      const discard = next.privateState.tokenPoolById.clue_discard ?? [];
      if (available.length < setup.startingClues && discard.length) {
        if (!context) return failure("RANDOM_INPUT_REQUIRED", "Recycling Clues requires server randomness.");
        available = [...available, ...context.shuffle(discard)];
        next.privateState.tokenPoolById.clue_discard = [];
      }
      const drawn = available.splice(0, Math.min(setup.startingClues, available.length));
      if (drawn.some(id => !content.clues?.some(clue => clue.id === id))) return failure("CLUE_CONTENT_MISSING", "A starting Clue is missing from content.");
      next.privateState.tokenPoolById.clues = available;
      next.privateState.tokenPoolById[heldClueKey(actorPlayerId)] = drawn;
      actor.clues = drawn.length;
    } else actor.clues = setup.startingClues;
    actor.investigatorId = command.investigatorId;
    actor.defeated = false;
    actor.delayed = false;
    actor.health = actor.maxHealth = setup.health;
    actor.sanity = actor.maxSanity = setup.sanity;
    actor.locationId = setup.startingLocationId;
    actor.skillImprovements = {};
    actor.travelTickets = [];
    actor.assetIds = [];
    actor.artifactIds = [];
    actor.conditionIds = [];
    for (const id of setup.startingAssetIds) {
      const piles = [next.privateState.deckOrderById.assets ?? [], next.assetDiscardIds, next.reserveAssetIds];
      const pile = piles.find(cards => cards.includes(id));
      if (pile) { pile.splice(pile.indexOf(id), 1); actor.assetIds.push(id); }
    }
    refillReserve(next);
    return success(next, [{ type: "INVESTIGATOR_REPLACED", playerId: actorPlayerId, investigatorId: command.investigatorId }]);
  }
  if (actor.defeated || actor.eliminated) return failure("INVESTIGATOR_DEFEATED", "This investigator cannot act.");

  if (command.type === "ANSWER_TRADE") {
    const offer = state.tradeOffer;
    if (!offer || offer.id !== command.offerId || (actorPlayerId !== offer.toPlayerId && !(actorPlayerId === offer.fromPlayerId && !command.accept))) {
      return failure("INVALID_TRADE", "Only the recipient can accept a current offer; either participant can cancel.");
    }
    next.tradeOffer = undefined;
    if (!command.accept) return success(next, [{ type: "TRADE_DECLINED", offerId: offer.id, playerId: actorPlayerId }]);
    const giverIndex = next.players.findIndex(player => player.id === offer.fromPlayerId);
    const giver = next.players[giverIndex];
    if (!giver || !canTrade(giver, actor, offer.give, offer.receive)) return failure("INVALID_TRADE", "The offered possessions or locations changed.");
    if (next.privateState.tokenPoolById.clues) {
      const giverHeld = next.privateState.tokenPoolById[heldClueKey(giver.id)];
      const recipientHeld = next.privateState.tokenPoolById[heldClueKey(actor.id)];
      if (!giverHeld || !recipientHeld || giverHeld.length < offer.give.clues || recipientHeld.length < offer.receive.clues) {
        return failure("CLUE_CONTENT_MISSING", "The physical Clues offered in this trade are unavailable.");
      }
      transferHeldClues(next, giver.id, actor.id, offer.give.clues);
      transferHeldClues(next, actor.id, giver.id, offer.receive.clues);
    }
    exchangePossessions(giver, actor, offer.give, offer.receive);
    const events: GameEvent[] = [{ type: "TRADE_ACCEPTED", offerId: offer.id, playerId: actorPlayerId }];
    completeAction(next, giverIndex, "trade", events);
    return success(next, events);
  }
  if (state.tradeOffer) return failure("INVALID_TRADE", "Resolve the trade offer first.");

  if (command.type === "RESOLVE_DECISION") {
    const decision = state.pendingDecision;
    if (!decision) return failure("NO_PENDING_DECISION", "There is no decision waiting to be resolved.");
    if (command.decisionId !== decision.id) return failure("DECISION_ID_MISMATCH", "That decision is no longer current.");
    if (decision.playerId !== actorPlayerId) return failure("NOT_DECISION_OWNER", "Only the assigned player can resolve this decision.");
    const selections = command.selectedOptionIds;
    if (
      new Set(selections).size !== selections.length
      || selections.length < decision.minSelections
      || selections.length > decision.maxSelections
      || selections.some((selection) => !decision.optionIds.includes(selection))
    ) {
      return failure("INVALID_DECISION_SELECTION", "The selected options are not legal for this decision.");
    }
    if (decision.continuation === "mythos_omen_choice") {
      const card = content.mythosCards?.find(candidate => candidate.id === state.currentMythosCardId);
      if (state.phase !== "mythos" || state.leadInvestigatorId !== actorPlayerId || card?.effect?.type !== "lead_choose_omen_without_doom"
        || state.currentMythosIconIndex !== card.icons?.length || state.omen === undefined || !Number.isInteger(state.omen)
        || state.omen < 0 || state.omen >= omenTrack.length) return failure("MYTHOS_CONTENT_MISSING", "The Omen choice is no longer attached to its Mythos card.");
      const choice = selections[0]!;
      const position = choice === "stay" ? state.omen : Number.parseInt(choice.slice("omen_".length), 10);
      if (choice !== "stay" && (!/^omen_[0-3]$/.test(choice) || position >= omenTrack.length)) return failure("INVALID_DECISION_SELECTION", "That Omen space is invalid.");
      next.pendingDecision = undefined;
      const events: GameEvent[] = [{ type: "DECISION_RESOLVED", decisionId: decision.id, playerId: actorPlayerId, selectedOptionIds: [choice] }];
      if (position !== state.omen) {
        next.omen = position;
        events.push({ type: "OMEN_MOVED", position, symbol: omenTrack[position]!, direction: "chosen", doomAdvance: 0 });
      }
      return finishMythosEvent(state, next, events, content);
    }
    if (decision.continuation === "mythos_world_fights_back") {
      const card = content.mythosCards?.find(candidate => candidate.id === state.currentMythosCardId);
      const order = mythosInvestigatorOrder(state);
      const position = order.indexOf(actorPlayerId);
      if (state.phase !== "mythos" || card?.effect?.type !== "each_investigator_choose_world_fights_back"
        || state.currentMythosIconIndex !== card.icons?.length || position < 0 || !context) {
        return failure("MYTHOS_CONTENT_MISSING", "The choice is no longer attached to its Mythos card.");
      }
      const choice = selections[0]!;
      const events: GameEvent[] = [{ type: "DECISION_RESOLVED", decisionId: decision.id, playerId: actorPlayerId, selectedOptionIds: [choice] }];
      if (choice === "recover_health" || choice === "recover_sanity") {
        const resource = choice === "recover_health" ? "health" : "sanity";
        const maximum = actor[resource === "health" ? "maxHealth" : "maxSanity"] ?? actor[resource] ?? 0;
        const recovered = recoverResource(actor[resource] ?? 0, maximum, 2);
        actor[resource] = recovered.value;
        events.push({ type: "INVESTIGATOR_RECOVERED", playerId: actorPlayerId, healthRecovered: resource === "health" ? recovered.amount : 0, sanityRecovered: resource === "sanity" ? recovered.amount : 0 });
      } else if (choice.startsWith("monster:")) {
        const monsterInstanceId = choice.slice("monster:".length);
        const instance = next.monsters?.find(candidate => candidate.id === monsterInstanceId && candidate.locationId === actor.locationId);
        const definition = content.monsters?.find(candidate => candidate.id === instance?.monsterId);
        if (!instance || definition?.type !== "normal") return failure("INVALID_DECISION_SELECTION", "That Monster cannot be discarded from this space.");
        const poolKey = instance.setAside ? `set_aside:${instance.monsterId}` : "monsters";
        if (!next.privateState.tokenPoolById[poolKey]) return failure("MONSTER_CONTENT_MISSING", "The Monster token pool is unavailable.");
        next.monsters = next.monsters!.filter(candidate => candidate.id !== instance.id);
        next.monsterLocationIds = [...new Set(next.monsters.map(candidate => candidate.locationId))];
        const pool = [...next.privateState.tokenPoolById[poolKey]!, instance.monsterId];
        next.privateState.tokenPoolById[poolKey] = instance.setAside ? pool : context.shuffle(pool);
        events.push({ type: "MONSTER_DISCARDED", monsterInstanceId: instance.id, monsterId: instance.monsterId });
      } else if (choice !== "skip") return failure("INVALID_DECISION_SELECTION", "That Mythos choice is invalid.");
      next.pendingDecision = undefined;
      const followingPlayerId = order[position + 1];
      if (followingPlayerId) {
        next.pendingDecision = worldFightsBackDecision(next, followingPlayerId, content, context);
        return success(next, events);
      }
      return finishMythosEvent(state, next, events, content);
    }
    if (decision.continuation === "mythos_debt_trade") {
      const card = content.mythosCards?.find(candidate => candidate.id === state.currentMythosCardId);
      const order = mythosInvestigatorOrder(state);
      const position = order.indexOf(actorPlayerId);
      if (state.phase !== "mythos" || card?.effect?.type !== "each_investigator_trade_debt_for_condition"
        || state.currentMythosIconIndex !== card.icons?.length || position < 0 || !context) {
        return failure("MYTHOS_CONTENT_MISSING", "The Debt exchange is no longer attached to its Mythos card.");
      }
      const choice = selections[0]!;
      const events: GameEvent[] = [{ type: "DECISION_RESOLVED", decisionId: decision.id, playerId: actorPlayerId, selectedOptionIds: [choice] }];
      if (choice !== "skip") {
        const cardId = actor.conditionIds?.find(id => publicConditionId(id) === choice && content.conditions?.find(card => card.id === id)?.kind !== "debt");
        if (!cardId || actor.conditionIds?.some(id => content.conditions?.find(card => card.id === id)?.kind === "debt")) {
          return failure("INVALID_DECISION_SELECTION", "That Condition is not eligible for a Debt exchange.");
        }
        const gained = gainCondition(next, actorPlayerId, "debt", content, context);
        if (!gained.ok) return gained;
        if (!gained.events.some(event => event.type === "CONDITION_GAINED")) return failure("CONDITION_UNAVAILABLE", "A Debt Condition could not be gained.");
        const discarded = discardCondition(gained.state, actorPlayerId, cardId, content);
        if (!discarded.ok) return discarded;
        next.players = discarded.state.players;
        next.privateState = discarded.state.privateState;
        events.push(...gained.events, ...discarded.events);
      }
      next.pendingDecision = undefined;
      const followingPlayerId = order[position + 1];
      if (followingPlayerId) {
        next.pendingDecision = debtTradeDecision(next, followingPlayerId, content, context);
        return success(next, events);
      }
      return finishMythosEvent(state, next, events, content);
    }
    if (decision.continuation === "mythos_desperate_times") {
      const card = content.mythosCards?.find(candidate => candidate.id === state.currentMythosCardId);
      if (state.phase !== "mythos" || card?.effect?.type !== "doom_two_unless_lead_gains_dark_pact"
        || state.currentMythosIconIndex !== card.icons?.length || state.leadInvestigatorId !== actorPlayerId || !context) {
        return failure("MYTHOS_CONTENT_MISSING", "The choice is no longer attached to its Mythos card.");
      }
      const choice = selections[0]!;
      let resolved: CommandResult;
      if (choice === "gain_dark_pact") {
        if (!canLeadGainDarkPact(state, content)) return failure("CONDITION_UNAVAILABLE", "The Lead cannot gain a Dark Pact.");
        resolved = gainCondition(state, actorPlayerId, "dark_pact", content, context);
      } else if (choice === "advance_doom") {
        resolved = advanceDesperateTimesDoom(state);
      } else return failure("INVALID_DECISION_SELECTION", "That Mythos choice is invalid.");
      if (!resolved.ok) return resolved;
      resolved.state.pendingDecision = undefined;
      const events: GameEvent[] = [{ type: "DECISION_RESOLVED", decisionId: decision.id, playerId: actorPlayerId, selectedOptionIds: [choice] }, ...resolved.events];
      if (resolved.state.gameResult) {
        resolved.state.stateVersion = state.stateVersion;
        return success(resolved.state, events);
      }
      return finishMythosEvent(state, resolved.state, events, content);
    }
    if (decision.continuation === "mythos_that_which_consumes") {
      const card = content.mythosCards?.find(candidate => candidate.id === state.currentMythosCardId);
      if (state.phase !== "mythos" || card?.effect?.type !== "group_discard_gate_then_advance_doom_if_nonmatching"
        || state.currentMythosIconIndex !== card.icons?.length || state.leadInvestigatorId !== actorPlayerId || !context
        || state.omen === undefined || !Number.isInteger(state.omen) || state.omen < 0 || state.omen >= omenTrack.length
        || state.doom === undefined || !state.ancientOneId) {
        return failure("MYTHOS_CONTENT_MISSING", "The Gate choice is no longer attached to its Mythos card.");
      }
      const gateId = selections[0]!;
      const gate = content.gates?.find(candidate => candidate.id === gateId);
      if (!state.activeGateIds?.includes(gateId) || !gate || !content.map.locationTypes[gate.locationId]) {
        return failure("GATE_CONTENT_MISSING", "The chosen Gate is no longer active or is missing from content.");
      }
      if (!next.privateState.deckOrderById.gates) return failure("GATE_CONTENT_MISSING", "The Gate stack is not initialized.");
      const advancesDoom = gate.omenSymbol !== omenTrack[state.omen];
      if (advancesDoom && state.doom <= 1 && state.ancientOneId !== "azathoth") {
        return failure("AWAKENING_UNSUPPORTED", "Ancient One awakening is not implemented yet.");
      }
      next.activeGateIds = next.activeGateIds!.filter(id => id !== gateId);
      next.discardedGateIds = [...(next.discardedGateIds ?? []), gateId];
      const events: GameEvent[] = [
        { type: "DECISION_RESOLVED", decisionId: decision.id, playerId: actorPlayerId, selectedOptionIds: [gateId] },
        { type: "GATE_DISCARDED", gateId, locationId: gate.locationId },
      ];
      if (!next.privateState.deckOrderById.gates.length) {
        next.privateState.deckOrderById.gates = context.shuffle(next.discardedGateIds);
        next.discardedGateIds = [];
      }
      next.pendingDecision = undefined;
      if (advancesDoom) {
        next.doom = Math.max(0, state.doom - 1);
        events.push({ type: "DOOM_ADVANCED", amount: 1, newDoom: next.doom });
        if (next.doom === 0 && state.ancientOneId === "azathoth") {
          next.gameResult = "investigators_lose";
          events.push({ type: "GAME_ENDED", result: "investigators_lose", reason: "azathoth_awakened" });
          next.stateVersion = state.stateVersion;
          return success(next, events);
        }
      }
      return finishMythosEvent(state, next, events, content);
    }
    if (decision.continuation === "mythos_blood_flows") {
      const card = content.mythosCards?.find(candidate => candidate.id === state.currentMythosCardId);
      if (state.phase !== "mythos" || card?.effect?.type !== "lead_discard_monster_lose_toughness_health"
        || state.currentMythosIconIndex !== card.icons?.length || state.leadInvestigatorId !== actorPlayerId || !context) {
        return failure("MYTHOS_CONTENT_MISSING", "The choice is no longer attached to Blood Flows.");
      }
      const monsterInstanceId = selections[0]!;
      const instance = next.monsters?.find(candidate => candidate.id === monsterInstanceId);
      const definition = content.monsters?.find(candidate => candidate.id === instance?.monsterId);
      if (!instance || definition?.type !== "normal" || definition.toughness === "ancient_one") {
        return failure("INVALID_DECISION_SELECTION", "That Monster cannot be discarded.");
      }
      const poolKey = instance.setAside ? `set_aside:${instance.monsterId}` : "monsters";
      const pool = next.privateState.tokenPoolById[poolKey];
      if (!pool) return failure("MONSTER_CONTENT_MISSING", "The Monster token pool is unavailable.");
      const toughness = definition.toughness.base + definition.toughness.perInvestigator * next.players.filter(player => !player.defeated && !player.eliminated).length;
      if (!actor.investigatorId) return failure("INVESTIGATOR_CONTENT_MISSING", "The Lead Investigator is unavailable.");
      if ((actor.health ?? 0) <= toughness && (state.doom ?? 0) <= 1 && state.ancientOneId !== "azathoth") {
        return failure("AWAKENING_UNSUPPORTED", "The Lead's defeat would cause unsupported Ancient One awakening.");
      }
      next.monsters = next.monsters!.filter(candidate => candidate.id !== monsterInstanceId);
      next.monsterLocationIds = [...new Set(next.monsters.map(candidate => candidate.locationId))];
      next.privateState.tokenPoolById[poolKey] = instance.setAside ? [...pool, instance.monsterId] : context.shuffle([...pool, instance.monsterId]);
      next.pendingDecision = undefined;
      const damaged = damageInvestigator(next, actorPlayerId, toughness, 0, content);
      if (!damaged.ok) return damaged;
      damaged.state.stateVersion = state.stateVersion;
      const events: GameEvent[] = [
        { type: "DECISION_RESOLVED", decisionId: decision.id, playerId: actorPlayerId, selectedOptionIds: [monsterInstanceId] },
        { type: "MONSTER_DISCARDED", monsterInstanceId, monsterId: instance.monsterId },
        ...damaged.events,
      ];
      if (damaged.state.pendingDefeat || damaged.state.gameResult) return success(damaged.state, events);
      return finishMythosEvent(state, damaged.state, events, content);
    }
    if (decision.continuation === "mythos_heat_wave") {
      const card = content.mythosCards?.find(candidate => candidate.id === state.currentMythosCardId);
      if (state.phase !== "mythos" || card?.effect?.type !== "each_investigator_choose_heat_wave"
        || state.currentMythosIconIndex !== card.icons?.length || state.pendingHeatWave?.cardId !== state.currentMythosCardId) {
        return failure("MYTHOS_CONTENT_MISSING", "The choice is no longer attached to Heat Wave.");
      }
      const choice = selections[0]!;
      if (choice === "become_delayed" && actor.delayed) return failure("INVALID_DECISION_SELECTION", "An already Delayed investigator cannot choose to become Delayed again.");
      if (choice === "lose_health" && !actor.investigatorId) return failure("INVESTIGATOR_CONTENT_MISSING", "The investigator's Health setup is missing.");
      if (choice === "lose_health" && (actor.health ?? 0) <= 3 && (state.doom ?? 0) <= 1 && state.ancientOneId !== "azathoth") {
        return failure("AWAKENING_UNSUPPORTED", "Ancient One awakening is not implemented yet.");
      }
      const resolved = choice === "become_delayed" ? delayInvestigator(next, actorPlayerId)
        : choice === "lose_health" ? damageInvestigator(next, actorPlayerId, 3, 0, content)
          : failure("INVALID_DECISION_SELECTION", "That Heat Wave choice is invalid.");
      if (!resolved.ok) return resolved;
      resolved.state.pendingDecision = undefined;
      resolved.state.stateVersion = state.stateVersion;
      const events: GameEvent[] = [{ type: "DECISION_RESOLVED", decisionId: decision.id, playerId: actorPlayerId, selectedOptionIds: [choice] }, ...resolved.events];
      if (resolved.state.pendingDefeat || resolved.state.gameResult) return success(resolved.state, events);
      const continued = continueHeatWave(resolved.state, content, context);
      if (!continued.ok) return continued;
      continued.state.stateVersion = state.stateVersion + 1;
      return { ...continued, events: [...events, ...continued.events] };
    }
    if (decision.continuation === "mythos_tide_of_despair") {
      const card = content.mythosCards?.find(candidate => candidate.id === state.currentMythosCardId);
      if (state.phase !== "mythos" || card?.effect?.type !== "each_investigator_tide_of_despair"
        || state.currentMythosIconIndex !== card.icons?.length || state.pendingTideOfDespair?.cardId !== state.currentMythosCardId) {
        return failure("MYTHOS_CONTENT_MISSING", "The choice is no longer attached to Tide of Despair.");
      }
      const choice = selections[0]!;
      let resolved: CommandResult;
      if (choice === "discard_blessed") {
        const conditionId = actor.conditionIds?.find(id => content.conditions?.find(card => card.id === id)?.kind === "blessed");
        if (!conditionId || !returnConditionToPool(next, actor, conditionId, content)) {
          return failure("CONDITION_NOT_HELD", "A Blessed Condition is no longer held.");
        }
        resolved = success(next, [{ type: "CONDITION_DISCARDED", playerId: actorPlayerId, conditionId: publicConditionId(conditionId) }]);
      } else if (choice === "lose_health_and_sanity") {
        if ((actor.health ?? 0) <= 2 || (actor.sanity ?? 0) <= 2) {
          if ((state.doom ?? 0) <= 1 && state.ancientOneId !== "azathoth") return failure("AWAKENING_UNSUPPORTED", "Ancient One awakening is not implemented yet.");
        }
        resolved = damageInvestigator(next, actorPlayerId, 2, 2, content);
      } else return failure("INVALID_DECISION_SELECTION", "That Tide of Despair choice is invalid.");
      if (!resolved.ok) return resolved;
      resolved.state.pendingDecision = undefined;
      resolved.state.stateVersion = state.stateVersion;
      const events: GameEvent[] = [{ type: "DECISION_RESOLVED", decisionId: decision.id, playerId: actorPlayerId, selectedOptionIds: [choice] }, ...resolved.events];
      if (resolved.state.pendingDefeat || resolved.state.gameResult) return success(resolved.state, events);
      const continued = continueTideOfDespair(resolved.state, content, context);
      if (!continued.ok) return continued;
      continued.state.stateVersion = state.stateVersion + 1;
      return { ...continued, events: [...events, ...continued.events] };
    }
    if (decision.continuation === "mythos_unexpected_betrayal") {
      const card = content.mythosCards?.find(candidate => candidate.id === state.currentMythosCardId);
      if (state.phase !== "mythos" || card?.effect?.type !== "each_investigator_with_ally_betrayed"
        || state.currentMythosIconIndex !== card.icons?.length || state.pendingUnexpectedBetrayal?.cardId !== state.currentMythosCardId) {
        return failure("MYTHOS_CONTENT_MISSING", "The choice is no longer attached to Unexpected Betrayal.");
      }
      const assetId = selections[0]!;
      if (!allyAssetsHeld(state, actorPlayerId, content).includes(assetId)) {
        return failure("INVALID_DECISION_SELECTION", "That Ally is no longer held.");
      }
      if (!actor.investigatorId) return failure("INVESTIGATOR_CONTENT_MISSING", "The investigator's Health setup is missing.");
      if ((actor.health ?? 0) <= 3 && (state.doom ?? 0) <= 1 && state.ancientOneId !== "azathoth") {
        return failure("AWAKENING_UNSUPPORTED", "Ancient One awakening is not implemented yet.");
      }
      const damaged = damageInvestigator(next, actorPlayerId, 3, 0, content);
      if (!damaged.ok) return damaged;
      const damagedActor = damaged.state.players.find(player => player.id === actorPlayerId)!;
      damagedActor.assetIds = damagedActor.assetIds.filter(id => id !== assetId);
      damaged.state.assetDiscardIds.push(assetId);
      damaged.state.pendingDecision = undefined;
      damaged.state.stateVersion = state.stateVersion;
      const events: GameEvent[] = [
        { type: "DECISION_RESOLVED", decisionId: decision.id, playerId: actorPlayerId, selectedOptionIds: [assetId] },
        ...damaged.events,
        { type: "ASSET_DISCARDED", playerId: actorPlayerId, assetId, reason: "mythos" },
      ];
      if (damaged.state.pendingDefeat || damaged.state.gameResult) return success(damaged.state, events);
      const continued = continueUnexpectedBetrayal(damaged.state, content, context);
      if (!continued.ok) return continued;
      continued.state.stateVersion = state.stateVersion + 1;
      return { ...continued, events: [...events, ...continued.events] };
    }
    if (decision.kind === "artifact_payment") {
      const selected = selections[0]!;
      const isVermis = decision.optionIds.every(id => id.startsWith("vermis:"));
      const source = isVermis ? "artifact_de_vermis_mysteriis" : "artifact_cultes_des_goules";
      const invalid = validateTomeAction(next, actor, content, source);
      if (invalid) return invalid;
      if (isVermis) {
        const events: GameEvent[] = [{ type: "DECISION_RESOLVED", decisionId: decision.id, playerId: actorPlayerId, selectedOptionIds: [...selections] }];
        if (selected !== "vermis:skip") {
          if (!vermisImprovementOptions(actor).some(([id]) => id === selected) || (actor.sanity ?? 0) <= 1) return failure("INVALID_DECISION_SELECTION", "That skill improvement or Sanity payment is no longer available.");
          const [, skill, amount] = selected.split(":");
          const skillId = skill as SkillId;
          const improvement = Math.min(2, (actor.skillImprovements[skillId] ?? 0) + Number(amount));
          actor.skillImprovements[skillId] = improvement;
          actor.sanity = actor.sanity! - 1;
          events.push({ type: "SKILL_IMPROVED", playerId: actor.id, skill: skillId, improvement });
        }
        next.pendingDecision = undefined;
        completeArtifactAction(next, actor.id, events, source);
        return success(next, events);
      }
      if (selected !== "cultes:accept" && selected !== "cultes:skip") return failure("INVALID_DECISION_SELECTION", "Unknown Artifact payment.");
      const events: GameEvent[] = [{ type: "DECISION_RESOLVED", decisionId: decision.id, playerId: actorPlayerId, selectedOptionIds: [...selections] }];
      if (selected === "cultes:accept") {
        if ((actor.sanity ?? 0) <= 1) return failure("INVALID_DECISION_SELECTION", "Not enough spendable Sanity.");
        if (!context) return failure("RANDOM_INPUT_REQUIRED", "Clue gain requires server token draws.");
        const inconsistent = validateArtifactClues(next, content);
        if (inconsistent) return inconsistent;
        const gained = gainCluesFromPool(next, actor.id, 2, content, context);
        if (!gained.ok) return gained;
        next.privateState = gained.state.privateState;
        actor.clues = gained.state.players.find(player => player.id === actor.id)!.clues;
        actor.sanity = actor.sanity! - 1;
        events.push(...gained.events);
      }
      next.pendingDecision = undefined;
      completeArtifactAction(next, actor.id, events, "artifact_cultes_des_goules");
      return success(next, events);
    }
    if (decision.kind === "artifact_target") {
      const invalid = validateTomeAction(next, actor, content, "artifact_ttka_halot");
      if (invalid) return invalid;
      const selected = selections[0]!;
      const events: GameEvent[] = [{ type: "DECISION_RESOLVED", decisionId: decision.id, playerId: actorPlayerId, selectedOptionIds: [...selections] }];
      if (selected !== "skip") {
        const instance = artifactTargets(next, actor, content).find(monster => monster.id === selected);
        const definition = content.monsters?.find(monster => monster.id === instance?.monsterId);
        if (!instance || !definition || definition.toughness === "ancient_one" || (actor.sanity ?? 0) <= 1) return failure("INVALID_DECISION_SELECTION", "That Monster or Sanity payment is no longer available.");
        actor.sanity = actor.sanity! - 1;
        instance.damage += 3;
        const toughness = definition.toughness.base + definition.toughness.perInvestigator * next.players.filter(player => !player.defeated && !player.eliminated).length;
        if (instance.damage >= toughness) {
          next.monsters = next.monsters!.filter(monster => monster.id !== instance.id);
          next.monsterLocationIds = [...new Set(next.monsters.map(monster => monster.locationId))];
          if (definition.type === "normal" && !instance.setAside) next.privateState.tokenPoolById.monsters = [...(next.privateState.tokenPoolById.monsters ?? []), instance.monsterId];
          events.push({ type: "MONSTER_DEFEATED", monsterInstanceId: instance.id, monsterId: instance.monsterId });
        }
      }
      next.pendingDecision = undefined;
      completeArtifactAction(next, actorPlayerId, events);
      return success(next, events);
    }
    if (decision.continuation === "location_encounter_choice") {
      if (!context) return failure("RANDOM_INPUT_REQUIRED", "Encounter choices require server randomness.");
      const pending = next.pendingLocationEncounter;
      const node = pending?.queue[0];
      if (!pending || !node || (node.kind !== "damage_reaction" && pending.playerId !== actorPlayerId) || next.currentLocationEncounterCardId !== pending.cardId) {
        return failure("ENCOUNTER_CONTENT_MISSING", "The encounter choice no longer matches its card.");
      }
      const selected = selections[0]!;
      const events: GameEvent[] = [{ type: "DECISION_RESOLVED", decisionId: decision.id, playerId: actorPlayerId, selectedOptionIds: [...selections] }];
      next.pendingDecision = undefined;
      if (node.kind === "damage_reaction") {
        const recipient = next.players.find(player => player.id === pending.playerId);
        // Bind even a decline to the exact card originally offered, not another
        // card belonging to the same holder after checkpoint restoration.
        const source = recipient ? encounterDamagePreventions(next, recipient, content).find(source =>
          source.playerId === actorPlayerId && decision.optionIds.includes(source.assetId)
          && !node.declinedPlayerIds.includes(source.playerId) && !node.declinedAssetIds?.includes(source.assetId)
          && (source.resource === "health" ? node.healthLoss : node.sanityLoss) > 0) : undefined;
        if (!recipient || recipient.defeated || recipient.eliminated || !source || !physicalAssetIsUnique(next, source.assetId)) return failure("INVALID_DECISION_SELECTION", "This damage prevention is no longer available.");
        if (selected === "skip") (node.declinedAssetIds ??= []).push(source.assetId);
        else {
          if (selected !== source.assetId && selected !== `${source.assetId}:prevent-1`) return failure("INVALID_DECISION_SELECTION", "That physical prevention Asset is unavailable.");
          actor.assetIds.splice(actor.assetIds.indexOf(source.assetId), 1);
          next.assetDiscardIds.push(source.assetId);
          const lossKey = source.resource === "health" ? "healthLoss" : "sanityLoss";
          node[lossKey] = Math.max(0, node[lossKey] - (selected.endsWith(":prevent-1") ? 1 : source.amount));
          events.push({ type: "ASSET_DISCARDED", playerId: actorPlayerId, assetId: source.assetId, reason: "encounter" });
        }
      } else if (node.kind === "choice") {
        const option = node.options[Number(selected.slice("option-".length))];
        if (!option) return failure("INVALID_DECISION_SELECTION", "The printed choice is unavailable.");
        pending.queue.splice(0, 1, option);
      } else if (node.kind === "optional") {
        if (node.cost.length === 1 && node.cost[0]?.kind === "discard_item_assets" && selected !== "skip") {
          if (!canPayEncounterCost(next, actor, node.cost, content) || !encounterItemAssetIds(actor, content).includes(selected)) return failure("INVALID_DECISION_SELECTION", "Choose one conserved Item Asset you own.");
          actor.assetIds.splice(actor.assetIds.indexOf(selected), 1);
          next.assetDiscardIds.push(selected);
          events.push({ type: "ASSET_DISCARDED", playerId: actorPlayerId, assetId: selected, reason: "encounter" });
          pending.queue.splice(0, 1, node.reward);
        } else if (selected === "accept") {
          if (!canPayEncounterCost(next, actor, node.cost, content)) return failure("INVALID_DECISION_SELECTION", "The printed cost cannot be paid in full.");
          pending.queue.splice(0, 1, { kind: "effects", effects: node.cost.map(effect => effect.kind === "delay" || effect.kind === "condition" ? { ...effect, accepted: true } : effect) }, node.reward);
        } else if (selected === "skip") {
          if (node.decline) pending.queue.splice(0, 1, node.decline);
          else pending.queue.shift();
        }
        else return failure("INVALID_DECISION_SELECTION", "Choose whether to pay the printed cost.");
      } else if (node.kind === "effects" && node.effects[0]?.kind === "discard_item_assets") {
        if (!encounterItemAssetIds(actor, content).includes(selected) || !encounterItemsAreConserved(next, actor, content)) return failure("INVALID_DECISION_SELECTION", "That physical Item Asset cannot satisfy this discard.");
        actor.assetIds.splice(actor.assetIds.indexOf(selected), 1);
        next.assetDiscardIds.push(selected);
        if (node.effects[0].amount === 2) node.effects[0].amount = 1;
        else node.effects.shift();
        events.push({ type: "ASSET_DISCARDED", playerId: actorPlayerId, assetId: selected, reason: "encounter" });
      } else if (node.kind === "effects" && node.effects[0]?.kind === "discard") {
        const effect = node.effects[0];
        const definition = content.conditions?.find(card => card.id === selected);
        if (!definition || (effect.target === "madness" ? definition.trait !== "madness" : definition.kind !== "blessed")
          || !returnConditionToPool(next, actor, selected, content)) return failure("INVALID_DECISION_SELECTION", "That Condition cannot satisfy this discard.");
        node.effects.shift();
        events.push({ type: "CONDITION_DISCARDED", playerId: actorPlayerId, conditionId: publicConditionId(selected) });
      } else if (node.kind === "effects" && actor.investigatorId === "mark_harrigan"
        && (node.effects[0]?.kind === "delay" || node.effects[0]?.kind === "condition" && node.effects[0].condition === "detained") && !node.effects[0].accepted) {
        if (selected === "refuse") node.effects.shift();
        else if (selected === "accept") node.effects[0].accepted = true;
        else return failure("INVALID_DECISION_SELECTION", "Choose whether to accept the effect.");
      } else if (node.kind === "effects" && node.effects[0]?.kind === "relocate_encountered_clue") {
        if (!nearestSeaSpaces(next, node.effects[0].markerId, content).includes(selected as LocationId)) return failure("INVALID_DECISION_SELECTION", "Choose a nearest Sea space.");
        node.effects[0].locationId = selected;
      } else if (node.kind === "effects" && node.effects[0]?.kind === "omen_move" && node.effects[0].position === undefined) {
        const position = Number(selected.slice("omen-".length));
        if (!/^omen-[0-3]$/.test(selected)) return failure("INVALID_DECISION_SELECTION", "Choose a physical Omen space.");
        node.effects[0].position = position;
      } else if (node.kind === "effects" && node.effects[0]?.kind === "improve" && node.effects[0].skill === "chosen") {
        if (!["lore", "influence", "observation", "strength", "will"].includes(selected)) return failure("INVALID_DECISION_SELECTION", "Choose an available skill.");
        node.effects[0] = { kind: "improve", skill: selected as SkillId };
      } else if (node.kind === "effects" && node.effects[0]?.kind === "improve" && actor.investigatorId === "lily_chen" && !node.effects[0].amount) {
        if (selected !== "once" && selected !== "twice") return failure("INVALID_DECISION_SELECTION", "Choose the number of improvements.");
        node.effects[0].amount = selected === "twice" ? 2 : 1;
      } else if (node.kind === "effects" && node.effects[0]?.kind === "spawn_clues" && node.effects[0].target === "chosen_space") {
        if (!content.map.locationTypes[selected as LocationId]) return failure("INVALID_DECISION_SELECTION", "Choose a board space.");
        const effect = node.effects.shift()!;
        if (effect.kind !== "spawn_clues") return failure("ENCOUNTER_CONTENT_MISSING", "The Clue placement instruction is missing.");
        for (let count = 0; count < effect.amount; count++) {
          const spawned = spawnClueFromPool(next, content, context, selected as LocationId);
          if (spawned.ok === false) {
            if (spawned.error.code === "CLUE_UNAVAILABLE") break;
            return spawned;
          }
          next.privateState = spawned.state.privateState;
          next.boardClues = spawned.state.boardClues;
          events.push(...spawned.events);
        }
      } else return failure("ENCOUNTER_CONTENT_MISSING", "This encounter choice has no modeled continuation.");
      return continueLocationEncounter(next, content, context, events);
    }
    if (decision.continuation === "test_reroll") {
      const test = state.activeTest;
      if (!test || test.playerId !== actorPlayerId) {
        return failure("ACTIVE_TEST_MISSING", "The skill test for this reroll is no longer active.");
      }
      if (!context) return failure("RANDOM_INPUT_REQUIRED", "Resolving a test reroll requires deterministic dice and ID input.");
      if (test.continuation === "artifact_action") {
        if (!test.sourceArtifactId) return failure("ARTIFACT_UNAVAILABLE", "The original Artifact test source is missing.");
        const invalid = validateTomeAction(next, actor, content, test.sourceArtifactId);
        if (invalid) return invalid;
      }
      if (test.continuation === "rest_asset") {
        const rest = next.pendingRest;
        if (!rest || rest.playerId !== actorPlayerId || !rest.testingAssetId || !rest.remainingAssetIds.includes(rest.testingAssetId)) return failure("ASSET_CONTENT_MISSING", "The Rest test continuation is missing.");
        const invalid = validatePuzzleBoxTest(next, actor, rest.testingAssetId, content) ?? validateRestAssets(next, actor, content);
        if (invalid) return invalid;
        if (rest.remainingAssetIds.some(id => !restAssetSources(next, actor, content).includes(id))) return failure("ASSET_CONTENT_MISSING", "A remaining Rest source is unavailable.");
      }
      const events: GameEvent[] = [{
        type: "DECISION_RESOLVED",
        decisionId: decision.id,
        playerId: actorPlayerId,
        selectedOptionIds: [...selections],
      }];
      next.pendingDecision = undefined;
      const activeTest = next.activeTest!;
      const selectedDie = selections[0];
      if (selectedDie) {
        const increment = selectedDie.startsWith("asset-increment:");
        const assetChoice = increment || selectedDie.startsWith("asset-reroll:") ? selectedDie.split(":") : undefined;
        const dieIndex = Number(assetChoice ? assetChoice[2] : selectedDie.slice("die-".length));
        if (!Number.isInteger(dieIndex) || dieIndex < 0 || dieIndex >= activeTest.dice.length) return failure("INVALID_DECISION_SELECTION", "That test die is unavailable.");
        if (increment && assetChoice) {
          const assetId = assetChoice[1]!;
          const die = activeTest.dice[dieIndex]!;
          if (!canUseAssetDieIncrement(next, actor, assetId, content) || die < 1 || die >= 6) return failure("INVALID_DECISION_SELECTION", "That die-result modifier is unavailable.");
          next.usedAssetDieModifierIds = [...(next.usedAssetDieModifierIds ?? []), assetId];
          activeTest.dice[dieIndex] = die + 1;
        } else if (assetChoice) {
          const assetId = assetChoice[1]!;
          if (!canUseAssetTestReroll(next, actor, activeTest.skill, assetId, content, activeTest.usedRerollAssetIds)) return failure("INVALID_DECISION_SELECTION", "That Asset reroll is unavailable for this test.");
          activeTest.usedRerollAssetIds = [...(activeTest.usedRerollAssetIds ?? []), assetId];
          if (content.assets.find(asset => asset.id === assetId)?.engineEffects.some(effect => effect.type === "round_test_reroll")) next.usedAssetRerollIds = [...(next.usedAssetRerollIds ?? []), assetId];
        } else {
          if (actor.clues < 1) return failure("CLUE_REQUIRED", "A Clue is required to reroll a test die.");
          if (!discardHeldClues(next, actorPlayerId, 1)) return failure("CLUE_CONTENT_MISSING", "The physical Clue for this reroll is unavailable.");
          actor.clues -= 1;
          events.push({ type: "CLUE_SPENT_FOR_REROLL", testId: activeTest.id, playerId: actorPlayerId, dieIndex });
        }
        if (!increment) activeTest.dice[dieIndex] = context.rollDie();
        activeTest.successes = countActiveTestSuccesses(activeTest, actor, content);
        events.push(
          increment
            ? { type: "TEST_DIE_MODIFIED", testId: activeTest.id, playerId: actorPlayerId, assetId: assetChoice![1]!, dieIndex, result: activeTest.dice[dieIndex]!, successes: activeTest.successes }
            : { type: "TEST_DIE_REROLLED", testId: activeTest.id, playerId: actorPlayerId, dieIndex, result: activeTest.dice[dieIndex]!, successes: activeTest.successes },
        );
      }
      if (selectedDie && createTestRerollDecision(next, activeTest, content, context)) { /* Keep the authoritative test open. */ }
      else if (activeTest.continuation === "location_encounter") {
        const pending = next.pendingLocationEncounter;
        const instruction = pending?.queue[0];
        if (!pending || pending.playerId !== actorPlayerId || instruction?.kind !== "test" || activeTest.sourceEncounterCardId !== pending.cardId || activeTest.sourceEncounterDeck !== pending.deck) {
          return failure("ENCOUNTER_CONTENT_MISSING", "The active encounter test is missing its continuation.");
        }
        pending.dice = [...activeTest.dice];
        pending.successes = activeTest.successes;
        pending.queue.splice(0, 1, activeTest.successes ? instruction.pass : instruction.fail);
        next.activeTest = undefined;
        return continueLocationEncounter(next, content, context, [...events, { type: "TEST_RESOLVED", testId: activeTest.id, playerId: actorPlayerId, successes: activeTest.successes, continuation: "location_encounter" }]);
      } else events.push(...finishSkillTest(next, activeTest, content, context));
      return success(next, events);
    }
    if (decision.continuation === "condition_rest_recovery") {
      const invalid = validateRestAssets(next, actor, content);
      if (invalid) return invalid;
      if (!context && selections.length) return failure("RANDOM_INPUT_REQUIRED", "Condition recovery requires deterministic dice input.");
      next.pendingDecision = undefined;
      const events: GameEvent[] = [{ type: "DECISION_RESOLVED", decisionId: decision.id, playerId: actorPlayerId, selectedOptionIds: [...selections] }];
      for (const conditionId of selections) {
        const physicalId = actor.conditionIds?.find(id => publicConditionId(id) === conditionId);
        if (!physicalId) return failure("CONDITION_NOT_HELD", "That Condition is no longer held.");
        const die = context!.rollDie();
        const discarded = die >= 5;
        if (discarded) returnConditionToPool(next, actor, physicalId, content);
        events.push({ type: "CONDITION_RECOVERY_ROLLED", playerId: actorPlayerId, conditionId, die, discarded });
        if (discarded) events.push({ type: "CONDITION_DISCARDED", playerId: actorPlayerId, conditionId });
      }
      return finishRest(next, actorIndex, content, context, events);
    }
    if (decision.continuation === "witch_doctor_rest" || decision.continuation === "rest_asset_effect") {
      if (decision.kind !== "rest_asset_choice" || next.phase !== "action" || next.activePlayerId !== actorPlayerId
        || actor.defeated || actor.eliminated || next.actionsRemaining < 1 || next.performedActions.includes("rest")
        || (actor.locationId && next.monsterLocationIds.includes(actor.locationId))) {
        return failure("INVALID_DECISION_SELECTION", "This Rest bonus is no longer available.");
      }
      const invalid = validateRestAssets(next, actor, content);
      if (invalid) return invalid;
      const choice = selections[0]!;
      const [source, effect] = choice.split(":");
      if (!source || !restAssetSources(next, actor, content).includes(source) || !["health", "discard-cursed", "skip", "attempt"].includes(effect ?? "")) {
        return failure("INVALID_DECISION_SELECTION", "The offered Rest source is no longer available.");
      }
      const rest = next.pendingRest ?? { playerId: actorPlayerId, remainingAssetIds: restAssetSources(next, actor, content) };
      if (rest.playerId !== actorPlayerId || rest.testingAssetId || !rest.remainingAssetIds.includes(source)
        || rest.remainingAssetIds.some(id => !restAssetSources(next, actor, content).includes(id))) return failure("ASSET_CONTENT_MISSING", "The Rest source continuation is inconsistent.");
      const events: GameEvent[] = [{ type: "DECISION_RESOLVED", decisionId: decision.id, playerId: actorPlayerId, selectedOptionIds: [...selections] }];
      if (effect === "attempt") {
        const invalid = validatePuzzleBoxTest(next, actor, source, content);
        if (invalid) return invalid;
        if (!context) return failure("RANDOM_INPUT_REQUIRED", "Puzzle Box requires server dice and decision IDs.");
        next.pendingRest = rest;
        rest.testingAssetId = source;
        next.pendingDecision = undefined;
        events.push(...beginSkillTest(next, actor, { skill: "observation", modifier: -2, continuation: "rest_asset", otherBonuses: [nonCombatEncounterAuraBonus(next, actor, content)] }, content, context));
        return success(next, events);
      }
      if (effect === "health") {
        const recovery = recoverResource(actor.health ?? 0, actor.maxHealth ?? actor.health ?? 0, 1);
        actor.health = recovery.value;
        events.push({ type: "INVESTIGATOR_RECOVERED", playerId: actorPlayerId, healthRecovered: recovery.value - (state.players[actorIndex]!.health ?? 0), sanityRecovered: 0 });
      } else if (effect === "discard-cursed") {
        const cursed = restCursedId(actor, content);
        if (!cursed || !returnConditionToPool(next, actor, cursed, content)) return failure("CONDITION_NOT_HELD", "Cursed is no longer held.");
        events.push({ type: "CONDITION_DISCARDED", playerId: actorPlayerId, conditionId: publicConditionId(cursed) });
      }
      next.pendingDecision = undefined;
      rest.remainingAssetIds = rest.remainingAssetIds.filter(id => id !== source);
      next.pendingRest = rest;
      return finishRest(next, actorIndex, content, context, events);
    }
    if (decision.continuation === "acquire_assets_purchase") {
      const takesLoan = selections.includes("bank-loan");
      const assetSelections = selections.filter(id => id !== "bank-loan");
      const totalValue = selections.reduce((total, assetId) =>
        total + (assetId === "bank-loan" ? 0 : content.assets.find(({ id }) => id === assetId)?.value ?? Number.POSITIVE_INFINITY), 0);
      if (totalValue > (decision.selectionBudget ?? 0) + (takesLoan ? 2 : 0)) {
        return failure("ASSET_PURCHASE_OVER_BUDGET", "The selected Assets cost more than the Influence test successes.");
      }
      if (takesLoan && !context) return failure("RANDOM_INPUT_REQUIRED", "Taking a Bank Loan requires a deterministic Condition draw.");
      const events: GameEvent[] = [{
        type: "DECISION_RESOLVED", decisionId: decision.id, playerId: actorPlayerId, selectedOptionIds: [...selections],
      }];
      if (takesLoan) {
        const pool = next.privateState.tokenPoolById[conditionPoolKey("debt")];
        if (!pool?.length || actor.conditionIds?.some(id => content.conditions?.find(card => card.id === id)?.kind === "debt")) {
          return failure("CONDITION_UNAVAILABLE", "A Bank Loan cannot be taken while holding Debt or without a Debt card.");
        }
        const { token, remaining } = context!.drawToken(pool);
        next.privateState.tokenPoolById[conditionPoolKey("debt")] = remaining;
        actor.conditionIds = [...(actor.conditionIds ?? []), token];
        events.push({ type: "CONDITION_GAINED", playerId: actorPlayerId, conditionId: publicConditionId(token) });
      }
      if (assetSelections.length === 0) {
        if (!context) return failure("RANDOM_INPUT_REQUIRED", "Continuing the Acquire Assets action requires deterministic ID input.");
        next.pendingDecision = {
          id: context.createId(),
          kind: "discard_reserve_card",
          playerId: actorPlayerId,
          visibility: "owner",
          prompt: "You bought nothing. You may discard one Asset from the Reserve.",
          optionIds: [...next.reserveAssetIds],
          minSelections: 0,
          maxSelections: 1,
          continuation: "acquire_assets_discard",
        };
        return success(next, events);
      }
      next.pendingDecision = undefined;
      next.reserveAssetIds = next.reserveAssetIds.filter((assetId) => !assetSelections.includes(assetId));
      refillReserve(next);
      for (const assetId of assetSelections) {
        events.push({ type: "ASSET_GAINED", playerId: actorPlayerId, assetId, source: "reserve" });
        const asset = content.assets.find(({ id }) => id === assetId);
        if (asset?.engineEffects.some(({ type }) => type === "on_gain_recover_all_and_discard")) {
          const maximumHealth = actor.maxHealth ?? actor.health ?? 0;
          const maximumSanity = actor.maxSanity ?? actor.sanity ?? 0;
          actor.health = recoverResource(actor.health ?? 0, maximumHealth, maximumHealth).value;
          actor.sanity = recoverResource(actor.sanity ?? 0, maximumSanity, maximumSanity).value;
          next.assetDiscardIds.push(assetId);
          events.push({ type: "ASSET_DISCARDED", playerId: actorPlayerId, assetId, reason: "on_gain_effect" });
        } else {
          actor.assetIds.push(assetId);
        }
      }
      events.push({ type: "RESERVE_REFILLED", assetIds: [...next.reserveAssetIds] });
      completeAction(next, actorIndex, "acquire_assets", events);
      return success(next, events);
    }
    if (decision.continuation === "acquire_assets_discard") {
      next.pendingDecision = undefined;
      const events: GameEvent[] = [{
        type: "DECISION_RESOLVED",
        decisionId: decision.id,
        playerId: actorPlayerId,
        selectedOptionIds: [...selections],
      }];
      const discardedAssetId = selections[0];
      if (discardedAssetId) {
        next.reserveAssetIds = next.reserveAssetIds.filter((assetId) => assetId !== discardedAssetId);
        next.assetDiscardIds.push(discardedAssetId);
        events.push({ type: "RESERVE_ASSET_DISCARDED", assetId: discardedAssetId });
      }
      refillReserve(next);
      events.push({ type: "RESERVE_REFILLED", assetIds: [...next.reserveAssetIds] });
      completeAction(next, actorIndex, "acquire_assets", events);
      return success(next, events);
    }
    next.pendingDecision = undefined;
    return success(next, [{
      type: "DECISION_RESOLVED",
      decisionId: decision.id,
      playerId: actorPlayerId,
      selectedOptionIds: [...selections],
    }]);
  }

  if (state.pendingDecision) {
    return failure("DECISION_PENDING", "Resolve the pending decision before sending another command.");
  }

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

  if (command.type === "SELECT_ANCIENT_ONE") {
    if (state.phase !== "lobby") return failure("WRONG_PHASE", "The Ancient One can only be selected in the lobby.");
    if (state.players[0]?.id !== actorPlayerId) return failure("NOT_HOST", "Only the host can select the Ancient One.");
    next.ancientOneId = command.ancientOneId;
    return success(next, [{ type: "ANCIENT_ONE_SELECTED", ancientOneId: command.ancientOneId }]);
  }

  if (command.type === "START_GAME") {
    if (state.phase !== "lobby") return failure("WRONG_PHASE", "The game has already started.");
    if (state.players[0]?.id !== actorPlayerId) return failure("NOT_HOST", "Only the host can start the game.");
    if (!state.ancientOneId) return failure("ANCIENT_ONE_REQUIRED", "Select an Ancient One before starting the game.");
    if (state.players.length < 2) return failure("NOT_ENOUGH_PLAYERS", "At least two players are required.");
    if (state.players.some((player) => !player.investigatorId)) {
      return failure("INVESTIGATOR_REQUIRED", "Every player must select an investigator.");
    }
    const mysteryIds = content.mysteryIdsByAncientOne[state.ancientOneId];
    if (!mysteryIds || mysteryIds.length !== 4) {
      return failure("MYSTERY_CONTENT_MISSING", "The selected Ancient One must have exactly four Mysteries.");
    }
    const assetCatalogIds = content.assets.map(({ id }) => id);
    if (new Set(assetCatalogIds).size !== assetCatalogIds.length) {
      return failure("ASSET_CONTENT_MISSING", "The Asset catalog contains duplicate IDs.");
    }
    const startingAssetIds = next.players.flatMap((player) =>
      content.investigators[player.investigatorId!]?.startingAssetIds ?? [],
    );
    if (startingAssetIds.some((id) => !assetCatalogIds.includes(id))) {
      return failure("ASSET_CONTENT_MISSING", "An investigator starting Asset is missing from the Asset catalog.");
    }
    const availableAssetIds = assetCatalogIds.filter((id) => !startingAssetIds.includes(id));
    if (availableAssetIds.length < 4) {
      return failure("ASSET_CONTENT_MISSING", "At least four Assets must remain after granting starting possessions.");
    }
    if (!context) return failure("RANDOM_INPUT_REQUIRED", "Starting the game requires deterministic random input.");
    const shuffledMysteries = context.shuffle(mysteryIds);
    const activeMysteryId = shuffledMysteries.shift()!;
    const mysteryTarget = targetForMystery(content, activeMysteryId, state.players.length);
    if (!mysteryTarget) return failure("MYSTERY_CONTENT_MISSING", `Mystery target is missing for ${activeMysteryId}.`);
    next.phase = "action";
    next.activePlayerId = actorPlayerId;
    next.leadInvestigatorId = actorPlayerId;
    next.turnNumber = 1;
    next.actionsRemaining = 2;
    next.performedActions = [];
    next.usedConditionActionIds = [];
    next.usedArtifactActionIds = [];
    next.usedAssetRerollIds = [];
    next.usedAssetDieModifierIds = [];
    next.activeMysteryId = activeMysteryId;
    next.mysteryProgress = 0;
    next.mysteryTarget = mysteryTarget;
    next.completedMysteryIds = [];
    next.privateState.deckOrderById.mysteries = shuffledMysteries;
    const shuffledAssets = context.shuffle(availableAssetIds);
    next.reserveAssetIds = shuffledAssets.splice(0, 4);
    next.assetDiscardIds = [];
    next.privateState.deckOrderById.assets = shuffledAssets;
    if (content.artifacts?.length) {
      next.privateState.deckOrderById.artifacts = buildArtifactDeck(content.artifacts.map(card => card.id), context.shuffle);
      for (const player of next.players) player.artifactIds = [];
    }
    for (const condition of content.conditions ?? []) {
      const key = conditionPoolKey(condition.kind);
      (next.privateState.tokenPoolById[key] ??= []).push(condition.id);
    }
    const ancient = content.ancientOnes?.[state.ancientOneId];
    if (ancient) {
      next.doom = ancient.startingDoom;
      next.omen = 0;
      next.greenOmenTokens = ancient.greenOmenTokens;
      next.privateState.deckOrderById.mythos = buildMythosDeck(content.mythosCards ?? [], ancient.mythosDeck, context.shuffle);
    }
    if (content.gates?.length) next.privateState.deckOrderById.gates = buildGateStack(content.gates.map(gate => gate.id), context.shuffle);
    if (content.clues?.length) {
      const clueIds = content.clues.map(clue => clue.id);
      if (new Set(clueIds).size !== clueIds.length || new Set(content.clues.map(clue => clue.locationId)).size !== content.clues.length
        || content.clues.some(clue => !content.map.locationTypes[clue.locationId])
        || clueIds.length < next.players.reduce((sum, player) => sum + (content.investigators[player.investigatorId!]?.startingClues ?? 0), 0)) {
        return failure("CLUE_CONTENT_MISSING", "Clue tokens must uniquely map to board spaces and cover starting Clues.");
      }
      next.privateState.tokenPoolById.clues = context.shuffle(clueIds);
      next.privateState.tokenPoolById.clue_discard = [];
    }
    if (content.locationEncounters?.length) {
      const decks = buildLocationEncounterDecks(content.locationEncounters, context.shuffle);
      for (const [deck, cards] of Object.entries(decks)) next.privateState.deckOrderById[`encounter:${deck}`] = cards;
    }
    if (content.researchEncounters?.length && next.ancientOneId) {
      const deck: ResearchEncounterDeckId = `research_${next.ancientOneId}`;
      const ids = content.researchEncounters.filter(card => card.deck === deck).map(card => card.id);
      if (new Set(ids).size !== ids.length) return failure("ENCOUNTER_CONTENT_MISSING", "Research card IDs must be unique.");
      if (ids.length) next.privateState.deckOrderById[`encounter:${deck}`] = context.shuffle(ids);
    }
    if (content.otherWorldEncounterIds?.length) {
      const ids = content.otherWorldEncounterIds;
      if (new Set(ids).size !== ids.length) return failure("ENCOUNTER_CONTENT_MISSING", "Other World card IDs must be unique.");
      next.privateState.deckOrderById["encounter:other_world"] = context.shuffle(ids);
    }
    if (content.monsters?.some(monster => monster.count !== undefined)) {
      if (!ancient) return failure("ANCIENT_ONE_REQUIRED", "Ancient One setup is required for the Monster cup.");
      if (content.monsters.some(monster => monster.count === undefined)) return failure("MONSTER_CONTENT_MISSING", "Every Monster requires a token count to build the cup.");
      const pool = buildMonsterPool(content.monsters.filter((monster): monster is typeof monster & { count: number } => monster.count !== undefined), ancient.setAsideMonsters ?? []);
      next.privateState.tokenPoolById.monsters = pool.cup;
      for (const [id, tokens] of Object.entries(pool.setAsideById)) next.privateState.tokenPoolById[`set_aside:${id}`] = tokens;
    }
    const events: GameEvent[] = [{ type: "GAME_STARTED", activePlayerId: actorPlayerId }];
    for (const player of next.players) {
      const setup = content.investigators[player.investigatorId!];
      if (!setup) return failure("INVESTIGATOR_CONTENT_MISSING", "The selected investigator has no setup data.");
      player.locationId = setup.startingLocationId;
      player.health = setup.health;
      player.sanity = setup.sanity;
      player.maxHealth = setup.health;
      player.maxSanity = setup.sanity;
      player.travelTickets = [];
      player.assetIds = [...setup.startingAssetIds];
      player.conditionIds = [];
      player.clues = setup.startingClues;
      if (content.clues?.length) next.privateState.tokenPoolById[`held_clues:${player.id}`] = next.privateState.tokenPoolById.clues.splice(0, setup.startingClues);
      player.skillImprovements = {};
      events.push(...player.assetIds.map((assetId) => ({
        type: "ASSET_GAINED" as const,
        playerId: player.id,
        assetId,
        source: "setup" as const,
      })));
    }
    events.push({ type: "RESERVE_REFILLED", assetIds: [...next.reserveAssetIds] });
    const reference = content.referenceCards?.find(card => card.playerCount === next.players.length);
    const startingGates = content.gates?.length ? reference?.spawnGates : 0;
    const startingClues = content.clues?.length ? reference?.spawnClues : 0;
    if (startingGates === undefined || startingClues === undefined || startingGates < 1 && Boolean(content.gates?.length)
      || startingClues < 1 && Boolean(content.clues?.length)) {
      return failure("REFERENCE_CARD_MISSING", "The player-count Reference card must define starting Gate and Clue counts.");
    }
    if (startingGates > 0 && !next.privateState.tokenPoolById.monsters?.length) {
      return failure("MONSTER_CONTENT_MISSING", "Starting Gates require a populated Monster cup.");
    }
    let setupState = next;
    for (let index = 0; index < startingGates; index++) {
      const opened = openGateFromStack(setupState, content, context);
      if (!opened.ok) return opened;
      setupState = opened.state;
      setupState.stateVersion = next.stateVersion;
      events.push(...opened.events);
    }
    for (let index = 0; index < startingClues; index++) {
      const spawned = spawnClueFromPool(setupState, content, context);
      if (!spawned.ok) return spawned;
      setupState = spawned.state;
      setupState.stateVersion = next.stateVersion;
      events.push(...spawned.events);
    }
    events.push({ type: "MYSTERY_REVEALED", mysteryId: activeMysteryId });
    return success(setupState, events);
  }

  if (state.phase !== "action") return failure("WRONG_PHASE", "That action is not available in the lobby.");
  if (state.activePlayerId !== actorPlayerId) return failure("NOT_ACTIVE_PLAYER", "It is not your turn.");
  if (actor.delayed) {
    if (command.type !== "END_ACTIONS") return failure("INVESTIGATOR_DELAYED", "Stand up instead of taking actions.");
    actor.delayed = false;
    const events: GameEvent[] = [{ type: "INVESTIGATOR_STOOD_UP", playerId: actorPlayerId }];
    advanceActionInvestigator(next, actorIndex, events);
    return success(next, events);
  }
  if (actor.conditionIds?.some(id => content.conditions?.find(card => card.id === id)?.kind === "detained")
    && command.type !== "USE_CONDITION_ACTION" && command.type !== "END_ACTIONS") {
    return failure("CONDITION_RESTRICTED", "A Detained investigator cannot perform other actions.");
  }
  if (state.actionsRemaining < 1 && command.type !== "END_ACTIONS") return failure("NO_ACTIONS_REMAINING", "This investigator has no actions remaining.");

  if (command.type === "USE_INVESTIGATOR_ACTION") {
    if (state.performedActions.includes("investigator")) return failure("ACTION_ALREADY_PERFORMED", "The investigator action can be performed only once per round.");
    const events: GameEvent[] = [];
    if (actor.investigatorId === "jim_culver") {
      for (const recipient of next.players) {
        if (recipient.defeated || recipient.eliminated || recipient.locationId !== actor.locationId) continue;
        const recovered = recoverResource(recipient.sanity ?? 0, recipient.maxSanity ?? content.investigators[recipient.investigatorId!]?.sanity ?? 0, 1);
        recipient.sanity = recovered.value;
        events.push({ type: "INVESTIGATOR_RECOVERED", playerId: recipient.id, healthRecovered: 0, sanityRecovered: recovered.amount });
      }
    } else if (actor.investigatorId === "trish_scarborough") {
      if (actor.clues !== 0) return failure("CONDITION_RESTRICTED", "Trish must have no Clues to use this action.");
      if (!context) return failure("RANDOM_INPUT_REQUIRED", "The Clue draw requires server-owned randomness.");
      const gained = gainCluesFromPool(next, actorPlayerId, 1, content, context);
      if (!gained.ok) return gained;
      next.privateState = gained.state.privateState;
      actor.clues = gained.state.players[actorIndex]!.clues;
      events.push(...gained.events);
    } else return failure("ENCOUNTER_UNSUPPORTED", "This investigator action is not executable yet.");
    completeAction(next, actorIndex, "investigator", events);
    return success(next, events);
  }

  if (command.type === "USE_CONDITION_ACTION") {
    const owner = next.players.find(player => player.id === command.targetPlayerId);
    const conditionId = owner?.conditionIds?.find(id => content.conditions?.find(card => card.id === id)?.kind === command.conditionKind);
    const kind = command.conditionKind;
    if (!owner || !conditionId || !owner.locationId || owner.locationId !== actor.locationId || (kind !== "debt" && kind !== "detained")
      || next.usedConditionActionIds?.includes(`condition_action:${owner.id}:condition_${kind}`)) {
      return failure("CONDITION_ACTION_INVALID", "The local Condition action is not available on this space or was already used this round.");
    }
    if (actor.conditionIds?.some(id => content.conditions?.find(card => card.id === id)?.kind === "detained") && (kind !== "detained" || owner.id !== actor.id)) {
      return failure("CONDITION_RESTRICTED", "A Detained investigator can use only the action on Detained.");
    }
    if (!context) return failure("RANDOM_INPUT_REQUIRED", "The Condition action requires deterministic dice and ID input.");
    return success(next, beginSkillTest(next, actor, { skill: "influence", modifier: 0, continuation: "condition_action", sourceConditionId: conditionId }, content, context));
  }

  if (command.type === "USE_ARTIFACT_ACTION") {
    const invalid = validateTomeAction(next, actor, content, command.artifactId);
    if (invalid) return invalid;
    if (!actor.artifactIds?.includes(command.artifactId) || !content.artifacts?.some(card => card.id === command.artifactId)) return failure("ARTIFACT_UNAVAILABLE", "The investigator does not hold this Artifact.");
    if (next.usedArtifactActionIds?.includes(command.artifactId)) return failure("ACTION_ALREADY_PERFORMED", "This Artifact action was already performed this round.");
    if (!actor.investigatorId || !content.investigators[actor.investigatorId]) return failure("INVESTIGATOR_CONTENT_MISSING", "The investigator's Lore is missing.");
    if (!context) return failure("RANDOM_INPUT_REQUIRED", "The Artifact action requires server dice.");
    return success(next, beginSkillTest(next, actor, { skill: "lore", modifier: 0, continuation: "artifact_action", sourceArtifactId: command.artifactId, otherBonuses: [nonCombatEncounterAuraBonus(next, actor, content)] }, content, context));
  }

  if (command.type === "OFFER_TRADE") {
    if (state.performedActions.includes("trade")) return failure("ACTION_ALREADY_PERFORMED", "Trade can be performed only once per round.");
    const target = next.players.find(player => player.id === command.targetPlayerId);
    if (!target || !canTrade(actor, target, command.give, command.receive)) return failure("INVALID_TRADE", "Trade requires owned possessions, shared location, and at most two tickets each.");
    if (!context) return failure("RANDOM_INPUT_REQUIRED", "Trade requires an offer ID.");
    const id = context.createId();
    next.tradeOffer = structuredClone({ id, fromPlayerId: actorPlayerId, toPlayerId: target.id, give: command.give, receive: command.receive });
    return success(next, [{ type: "TRADE_OFFERED", offerId: id, playerId: actorPlayerId }]);
  }

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
    const invalid = validateRestAssets(next, actor, content);
    if (invalid) return invalid;
    const additionalSanity = assetEffectsForPlayer(actor, content).reduce((total, effect) =>
      total + (effect.type === "rest_recover_additional_sanity" ? effect.amount : 0), 0);
    actor.health = recoverResource(actor.health ?? 0, actor.maxHealth ?? actor.health ?? 0, 1).value;
    actor.sanity = recoverResource(actor.sanity ?? 0, actor.maxSanity ?? actor.sanity ?? 0, 1 + additionalSanity).value;
    const events: GameEvent[] = [{ type: "INVESTIGATOR_RESTED", playerId: actorPlayerId, health: actor.health, sanity: actor.sanity }];
    const recoverable = recoverableConditionIds(actor, content);
    if (recoverable.length) {
      if (!context) return failure("RANDOM_INPUT_REQUIRED", "Resting with Conditions requires a decision ID.");
      next.pendingDecision = {
        id: context.createId(), kind: "recover_conditions", playerId: actorPlayerId, visibility: "owner",
        prompt: "Choose which Injury or Madness Conditions to roll to discard (5 or 6).",
        optionIds: recoverable, minSelections: 0, maxSelections: recoverable.length,
        continuation: "condition_rest_recovery",
      };
      return success(next, events);
    }
    return finishRest(next, actorIndex, content, context, events);
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

  if (command.type === "ACQUIRE_ASSETS") {
    if (state.performedActions.includes("acquire_assets")) return failure("ACTION_ALREADY_PERFORMED", "Acquire Assets can be performed only once per round.");
    if (!actor.locationId || content.map.locationTypes[actor.locationId] !== "city") return failure("CITY_REQUIRED", "Acquire Assets requires a City space.");
    if (state.monsterLocationIds.includes(actor.locationId)) return failure("ASSET_ACTION_BLOCKED_BY_MONSTER", "An investigator cannot acquire Assets on a space containing a Monster.");
    if (!actor.investigatorId) return failure("INVESTIGATOR_REQUIRED", "The player has no investigator.");
    const investigator = content.investigators[actor.investigatorId];
    if (!investigator) return failure("INVESTIGATOR_CONTENT_MISSING", "The selected investigator has no setup data.");
    if (!context) return failure("RANDOM_INPUT_REQUIRED", "Acquire Assets requires deterministic dice and ID input.");
    return success(next, beginSkillTest(next, actor, {
      skill: "influence",
      modifier: 0,
      continuation: "acquire_assets",
    }, content, context));
  }

  const events: GameEvent[] = [{ type: "ACTIONS_ENDED", playerId: actorPlayerId }];
  advanceActionInvestigator(next, actorIndex, events);
  return success(next, events);
}
