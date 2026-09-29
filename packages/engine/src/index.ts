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
import { buildGateStack, buildMonsterPool, buildMythosDeck, type AncientSetup, type MythosColor } from "./setup.js";
import { resolveStandardCombat, type CombatCheck } from "./combat.js";
import { conditionSuccessThreshold, publicConditionId, resolveBoonBaneGain } from "./conditions.js";
import { advanceOmenTrack } from "./omen.js";
export * from "./setup.js";
export * from "./skill-tests.js";
export * from "./resources.js";
export * from "./combat.js";
export * from "./conditions.js";
export * from "./omen.js";

export type ActionType = "travel" | "rest" | "prepare_travel" | "trade" | "acquire_assets" | "component";

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
}

export interface GameState {
  defeatedInvestigators?: { investigatorId: InvestigatorId; locationId: LocationId; cause: "health" | "sanity"; assetIds: string[]; clues: number; travelTickets: TravelTicketType[] }[];
  pendingDefeat?: { playerId: string; cityIds: LocationId[]; causes: ("health" | "sanity")[] };
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
  activeMysteryId?: string;
  mysteryProgress: number;
  mysteryTarget: number;
  completedMysteryIds: string[];
  gameResult?: "investigators_win" | "investigators_lose";
  turnNumber: number;
  actionsRemaining: number;
  performedActions: ActionType[];
  usedConditionActionIds?: string[];
  monsterLocationIds: LocationId[];
  monsters?: MonsterInstance[];
  activeGateIds?: string[];
  boardClues?: BoardClue[];
  reserveAssetIds: string[];
  assetDiscardIds: string[];
  pendingDecision?: PendingDecision;
  activeTest?: ActiveTest;
  privateState: PrivateGameState;
}

export type PublicEngineGameState = Omit<GameState, "privateState" | "pendingDecision"> & {
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
  | { type: "skill_bonus"; skill: "influence"; amount: 1 }
  | { type: "acquire_six_counts_as_two" }
  | { type: "rest_recover_additional_sanity"; amount: 1 }
  | { type: "on_gain_recover_all_and_discard" };

/** Only verified, atomic reverse effects; supplied by the server, never public content. */
export type ConditionBackEffect =
  | { type: "discard" }
  | { type: "recover_health_and_sanity_then_flip_front"; amount: 2 }
  | { type: "gain_clues_then_flip_front"; amount: 2 }
  | { type: "become_delayed_then_flip_front" }
  | { type: "discard_all_clues_then_discard" };

export interface GameContent {
  gates?: readonly { id: string; omenSymbol: "comet" | "constellation" | "eclipse"; locationId: LocationId }[];
  clues?: readonly { id: string; locationId: LocationId }[];
  conditions?: readonly { id: string; kind: string; backEffect?: ConditionBackEffect }[];
  monsters?: readonly MonsterCombatDefinition[];
  ancientOnes?: Readonly<Partial<Record<AncientOneId, AncientSetup>>>;
  mythosCards?: readonly { id: string; color: MythosColor }[];
  map: GameMap;
  investigators: Readonly<Partial<Record<InvestigatorId, InvestigatorSetup>>>;
  assets: readonly { id: string; value: number; engineEffects: readonly AssetEngineEffect[] }[];
  mysteryIdsByAncientOne: Readonly<Partial<Record<AncientOneId, readonly string[]>>>;
  mysteryTargetsById: Readonly<Record<string, "investigator_count" | "half_investigator_count" | "twice_investigator_count" | "one">>;
}

export type RuleErrorCode =
  | "MYTHOS_CARD_ACTIVE" | "MYTHOS_DECK_MISSING" | "MYTHOS_CONTENT_MISSING"
  | "CONDITION_ACTION_INVALID" | "CONDITION_RESTRICTED"
  | "CONDITION_CONTENT_MISSING" | "CONDITION_UNAVAILABLE" | "CONDITION_NOT_HELD" | "CONDITION_EFFECT_UNSUPPORTED"
  | "INVALID_COMBAT" | "MONSTER_CONTENT_MISSING" | "MONSTER_EFFECT_UNSUPPORTED" | "MONSTER_UNAVAILABLE"
  | "GATE_UNAVAILABLE" | "GATE_CONTENT_MISSING"
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
    monsterLocationIds: [],
    activeGateIds: [],
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
  return { ...decision, optionIds: [...decision.optionIds] };
}

export function projectStateForPlayer(state: GameState, viewerPlayerId?: string): PublicEngineGameState {
  const { privateState: _privateState, pendingDecision, ...publicState } = state;
  return {
    ...publicState,
    players: publicState.players.map((player) => ({
      ...player,
      travelTickets: player.travelTickets ? [...player.travelTickets] : undefined,
      assetIds: [...player.assetIds],
      ...(player.conditionIds ? { conditionIds: player.conditionIds.map(publicConditionId) } : {}),
      skillImprovements: { ...player.skillImprovements },
    })),
    performedActions: [...publicState.performedActions],
    usedConditionActionIds: [...(publicState.usedConditionActionIds ?? [])],
    monsterLocationIds: [...publicState.monsterLocationIds],
    monsters: publicState.monsters?.map(monster => ({ ...monster })),
    activeGateIds: [...(publicState.activeGateIds ?? [])],
    boardClues: publicState.boardClues?.map(clue => ({ ...clue })),
    reserveAssetIds: [...publicState.reserveAssetIds],
    assetDiscardIds: [...publicState.assetDiscardIds],
    completedMysteryIds: [...publicState.completedMysteryIds],
    activeTest: publicState.activeTest ? { ...publicState.activeTest, sourceConditionId: undefined, dice: [...publicState.activeTest.dice] } : undefined,
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
  if (!content.conditions?.some(card => card.kind === kind)) return failure("CONDITION_CONTENT_MISSING", "Condition kind is missing from content.");
  const owned = player.conditionIds ?? [];
  if (kind === "blessed" || kind === "cursed") {
    const replacement = resolveBoonBaneGain(owned, kind);
    if (replacement.type === "discard_opposite") return discardCondition(state, playerId, replacement.cardId, content);
    if (replacement.type === "flip_existing") return resolveConditionFlip(state, playerId, replacement.cardId, content);
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
function resolveConditionFlip(state: GameState, playerId: string, cardId: string, content: GameContent): CommandResult {
  const definition = content.conditions?.find(card => card.id === cardId);
  const effect = definition?.backEffect;
  if (!effect) return failure("CONDITION_EFFECT_UNSUPPORTED", "This Condition's reverse effect is not executable yet.");
  const owner = state.players.find(player => player.id === playerId && player.conditionIds?.includes(cardId));
  if (!owner) return failure("CONDITION_NOT_HELD", "That Condition is not held by this investigator.");
  const next = structuredClone(state);
  return success(next, applyConditionBackEffect(next, playerId, cardId, content, effect));
}

function applyConditionBackEffect(state: GameState, playerId: string, cardId: string, content: GameContent, effect: ConditionBackEffect): GameEvent[] {
  const recipient = state.players.find(player => player.id === playerId)!;
  const publicId = publicConditionId(cardId);
  if (effect.type === "discard" || effect.type === "discard_all_clues_then_discard") {
    if (effect.type === "discard_all_clues_then_discard") recipient.clues = 0;
    returnConditionToPool(state, recipient, cardId, content);
  }
  else if (effect.type === "recover_health_and_sanity_then_flip_front") {
    recipient.health = recoverResource(recipient.health ?? 0, recipient.maxHealth ?? recipient.health ?? 0, effect.amount).value;
    recipient.sanity = recoverResource(recipient.sanity ?? 0, recipient.maxSanity ?? recipient.sanity ?? 0, effect.amount).value;
  } else if (effect.type === "gain_clues_then_flip_front") recipient.clues += effect.amount;
  else if (effect.type === "become_delayed_then_flip_front") recipient.delayed = true;
  const events: GameEvent[] = [{ type: "CONDITION_BACK_RESOLVED", playerId, conditionId: publicId, effect: effect.type }];
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
  const gateId = state.privateState.deckOrderById.gates?.[0];
  if (!gateId) return failure("GATE_UNAVAILABLE", "No Gate remains in the stack.");
  const gate = content.gates?.find(candidate => candidate.id === gateId);
  if (!gate || !content.map.locationTypes[gate.locationId] || state.activeGateIds?.includes(gateId)) {
    return failure("GATE_CONTENT_MISSING", "The next Gate is missing, misplaced, or already active.");
  }
  let next = structuredClone(state);
  next.privateState.deckOrderById.gates.shift();
  const events: GameEvent[] = [{ type: "GATE_OPENED", gateId, locationId: gate.locationId }];
  if (next.privateState.tokenPoolById.monsters?.length) {
    const spawned = spawnMonsterFromCup(next, gate.locationId, content, context);
    if (!spawned.ok) return spawned;
    next = spawned.state;
    next.stateVersion = state.stateVersion;
    events.push(...spawned.events);
  }
  next.activeGateIds = [...(next.activeGateIds ?? []), gateId];
  return success(next, events);
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

/** Internal Mythos Omen effect; Ancient One awakening remains explicit, never inferred by the client. */
export function advanceOmen(state: GameState, content: GameContent): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has ended.");
  if (state.phase !== "mythos") return failure("WRONG_PHASE", "Omen advances during Mythos resolution.");
  if (state.omen === undefined || state.doom === undefined || !state.ancientOneId) return failure("OMEN_CONTENT_MISSING", "Omen, Doom, or Ancient One setup is missing.");
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

export function resolveCombatEncounter(state: GameState, playerId: string, monsterInstanceId: string, content: GameContent, context: EngineContext): CommandResult {
  if (state.gameResult) return failure("GAME_ENDED", "The game has ended.");
  if (state.phase !== "encounter" || state.activePlayerId !== playerId || state.pendingDecision || state.pendingDefeat) {
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

/** Draws the top private card, revealing only that card. Its icons and text must be resolved separately. */
export function drawMythosCard(state: GameState, content: GameContent): CommandResult {
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
  if (!content.mythosCards?.some(card => card.id === topId)) return failure("MYTHOS_CONTENT_MISSING", "The next Mythos card is missing from content.");
  const next = structuredClone(state);
  next.currentMythosCardId = next.privateState.deckOrderById.mythos!.shift();
  return success(next, [{ type: "MYTHOS_CARD_REVEALED", cardId: topId }]);
}

function routeBetween(map: GameMap, source: LocationId, target: LocationId) {
  return map.routes.find((route) => (route.source === source && route.target === target) || (route.source === target && route.target === source));
}

function advanceActionInvestigator(state: GameState, actorIndex: number, events: GameEvent[]): void {
  const nextIndex = actorIndex + 1;
  if (nextIndex < state.players.length) {
    const player = state.players[nextIndex]!;
    if (player.defeated || player.eliminated) {
      advanceActionInvestigator(state, nextIndex, events);
      return;
    }
    if (player.delayed) {
      player.delayed = false;
      events.push({ type: "INVESTIGATOR_STOOD_UP", playerId: player.id });
      advanceActionInvestigator(state, nextIndex, events);
      return;
    }
    state.activePlayerId = state.players[nextIndex]!.id;
    state.actionsRemaining = 2;
    state.performedActions = [];
    return;
  }
  state.phase = "encounter";
  state.activePlayerId = state.leadInvestigatorId;
  state.actionsRemaining = 0;
  state.performedActions = [];
  events.push({ type: "PHASE_ADVANCED", phase: "encounter", activePlayerId: state.activePlayerId });
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

function createTestRerollDecision(state: GameState, test: ActiveTest, context: EngineContext): void {
  state.pendingDecision = {
    id: context.createId(),
    kind: "select_rerolls",
    playerId: test.playerId,
    visibility: "owner",
    prompt: "Spend 1 Clue to reroll one die, or keep the current result.",
    optionIds: test.dice.map((_, index) => `die-${index}`),
    minSelections: 0,
    maxSelections: 1,
    continuation: "test_reroll",
  };
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

function finishSkillTest(state: GameState, test: ActiveTest, content: GameContent, context: EngineContext): GameEvent[] {
  if (test.continuation === "acquire_assets") return createAcquireAssetsDecision(state, test, content, context);
  state.activeTest = undefined;
  const conditionId = test.sourceConditionId;
  const owner = conditionId ? state.players.find(player => player.conditionIds?.includes(conditionId)) : undefined;
  const events: GameEvent[] = [{ type: "TEST_RESOLVED", testId: test.id, playerId: test.playerId, successes: test.successes, continuation: test.continuation }];
  if (test.continuation === "condition_reckoning") {
    if (conditionId && owner && test.successes === 0) {
      const effect = content.conditions?.find(card => card.id === conditionId)?.backEffect;
      if (effect) events.push(...applyConditionBackEffect(state, owner.id, conditionId, content, effect));
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
  request: { skill: SkillId; modifier: number; continuation: ActiveTest["continuation"]; sourceConditionId?: string; itemBonuses?: readonly number[]; otherBonuses?: readonly number[] },
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
  if (player.clues > 0) createTestRerollDecision(state, test, context);
  else events.push(...finishSkillTest(state, test, content, context));
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

  const next: GameState = {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      travelTickets: player.travelTickets ? [...player.travelTickets] : undefined,
      assetIds: [...player.assetIds],
      ...(player.conditionIds ? { conditionIds: [...player.conditionIds] } : {}),
      skillImprovements: { ...player.skillImprovements },
    })),
    performedActions: [...state.performedActions],
    usedConditionActionIds: [...(state.usedConditionActionIds ?? [])],
    monsterLocationIds: [...state.monsterLocationIds],
    activeGateIds: [...(state.activeGateIds ?? [])],
    boardClues: state.boardClues?.map(clue => ({ ...clue })),
    reserveAssetIds: [...state.reserveAssetIds],
    assetDiscardIds: [...state.assetDiscardIds],
    completedMysteryIds: [...state.completedMysteryIds],
    pendingDecision: state.pendingDecision ? cloneDecision(state.pendingDecision) : undefined,
    activeTest: state.activeTest ? { ...state.activeTest, dice: [...state.activeTest.dice] } : undefined,
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
    next.defeatedInvestigators = [...(state.defeatedInvestigators ?? []), { investigatorId: actor.investigatorId!, locationId: command.cityId, cause: command.cause, assetIds: [...actor.assetIds], clues: actor.clues, travelTickets: [...(actor.travelTickets ?? [])] }];
    actor.assetIds = [];
    for (const id of [...(actor.conditionIds ?? [])]) returnConditionToPool(next, actor, id, content);
    actor.clues = 0;
    actor.travelTickets = [];
    actor.skillImprovements = {};
    actor.health = 0;
    actor.sanity = 0;
    actor.locationId = command.cityId;
    next.pendingDefeat = undefined;
    if (state.leadInvestigatorId === actorPlayerId) next.leadInvestigatorId = command.leadPlayerId ?? survivors[0]?.id;
    const events: GameEvent[] = [];
    if (state.phase === "action" && state.activePlayerId === actorPlayerId) advanceActionInvestigator(next, actorIndex, events);
    else if (state.activePlayerId === actorPlayerId) next.activePlayerId = next.leadInvestigatorId;
    return success(next, events);
  }
  if (state.pendingDefeat) return failure("INVALID_DEFEAT", "Resolve the pending defeat first.");
  if (command.type === "REPLACE_INVESTIGATOR") {
    if (!state.replacementWindow || !actor.defeated || actor.eliminated || state.awakened) return failure("WRONG_PHASE", "Replacement is available at the end of Mythos before awakening.");
    if (state.players.some(player => player.investigatorId === command.investigatorId) || state.defeatedInvestigators?.some(player => player.investigatorId === command.investigatorId)) return failure("INVESTIGATOR_TAKEN", "That investigator is unavailable.");
    const setup = content.investigators[command.investigatorId];
    if (!setup) return failure("INVESTIGATOR_CONTENT_MISSING", "Investigator setup is missing.");
    actor.investigatorId = command.investigatorId;
    actor.defeated = false;
    actor.delayed = false;
    actor.health = actor.maxHealth = setup.health;
    actor.sanity = actor.maxSanity = setup.sanity;
    actor.locationId = setup.startingLocationId;
    actor.clues = setup.startingClues;
    actor.skillImprovements = {};
    actor.travelTickets = [];
    actor.assetIds = [];
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
    if (decision.continuation === "test_reroll") {
      const test = state.activeTest;
      if (!test || test.playerId !== actorPlayerId) {
        return failure("ACTIVE_TEST_MISSING", "The skill test for this reroll is no longer active.");
      }
      if (!context) return failure("RANDOM_INPUT_REQUIRED", "Resolving a test reroll requires deterministic dice and ID input.");
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
        if (actor.clues < 1) return failure("CLUE_REQUIRED", "A Clue is required to reroll a test die.");
        const dieIndex = Number.parseInt(selectedDie.slice("die-".length), 10);
        if (!discardHeldClues(next, actorPlayerId, 1)) return failure("CLUE_CONTENT_MISSING", "The physical Clue for this reroll is unavailable.");
        actor.clues -= 1;
        activeTest.dice[dieIndex] = context.rollDie();
        activeTest.successes = countActiveTestSuccesses(activeTest, actor, content);
        events.push(
          { type: "CLUE_SPENT_FOR_REROLL", testId: activeTest.id, playerId: actorPlayerId, dieIndex },
          { type: "TEST_DIE_REROLLED", testId: activeTest.id, playerId: actorPlayerId, dieIndex, result: activeTest.dice[dieIndex]!, successes: activeTest.successes },
        );
      }
      if (selectedDie && actor.clues > 0) createTestRerollDecision(next, activeTest, context);
      else events.push(...finishSkillTest(next, activeTest, content, context));
      return success(next, events);
    }
    if (decision.continuation === "condition_rest_recovery") {
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
      completeAction(next, actorIndex, "rest", events);
      return success(next, events);
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
    next.activeMysteryId = activeMysteryId;
    next.mysteryProgress = 0;
    next.mysteryTarget = mysteryTarget;
    next.completedMysteryIds = [];
    next.privateState.deckOrderById.mysteries = shuffledMysteries;
    const shuffledAssets = context.shuffle(availableAssetIds);
    next.reserveAssetIds = shuffledAssets.splice(0, 4);
    next.assetDiscardIds = [];
    next.privateState.deckOrderById.assets = shuffledAssets;
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
    if (content.monsters?.some(monster => monster.count !== undefined)) {
      if (!ancient) return failure("ANCIENT_ONE_REQUIRED", "Ancient One setup is required for the Monster cup.");
      if (content.monsters.some(monster => monster.count === undefined)) return failure("MONSTER_CONTENT_MISSING", "Every Monster requires a token count to build the cup.");
      const pool = buildMonsterPool(content.monsters.filter((monster): monster is typeof monster & { count: number } => monster.count !== undefined), ancient.setAsideMonsters ?? []);
      next.privateState.tokenPoolById.monsters = pool.cup;
      for (const [id, tokens] of Object.entries(pool.setAsideById)) next.privateState.tokenPoolById[`set_aside:${id}`] = tokens;
    }
    const events: GameEvent[] = [
      { type: "GAME_STARTED", activePlayerId: actorPlayerId },
      { type: "MYSTERY_REVEALED", mysteryId: activeMysteryId },
    ];
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
    return success(next, events);
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
    completeAction(next, actorIndex, "rest", events);
    return success(next, events);
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
