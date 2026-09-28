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
import { buildMythosDeck, type AncientSetup, type MythosColor } from "./setup.js";
export * from "./setup.js";
export * from "./skill-tests.js";
export * from "./resources.js";

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
  clues: number;
  skillImprovements: Partial<Record<SkillId, number>>;
}

export interface PrivateGameState {
  deckOrderById: Record<string, string[]>;
  tokenPoolById: Record<string, string[]>;
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
  activeMysteryId?: string;
  mysteryProgress: number;
  mysteryTarget: number;
  completedMysteryIds: string[];
  gameResult?: "investigators_win" | "investigators_lose";
  turnNumber: number;
  actionsRemaining: number;
  performedActions: ActionType[];
  monsterLocationIds: LocationId[];
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

export interface GameContent {
  ancientOnes?: Readonly<Partial<Record<AncientOneId, AncientSetup>>>;
  mythosCards?: readonly { id: string; color: MythosColor }[];
  map: GameMap;
  investigators: Readonly<Partial<Record<InvestigatorId, InvestigatorSetup>>>;
  assets: readonly { id: string; value: number; engineEffects: readonly AssetEngineEffect[] }[];
  mysteryIdsByAncientOne: Readonly<Partial<Record<AncientOneId, readonly string[]>>>;
  mysteryTargetsById: Readonly<Record<string, "investigator_count" | "half_investigator_count" | "twice_investigator_count" | "one">>;
}

export type RuleErrorCode =
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
    monsterLocationIds: [],
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
      skillImprovements: { ...player.skillImprovements },
    })),
    performedActions: [...publicState.performedActions],
    monsterLocationIds: [...publicState.monsterLocationIds],
    reserveAssetIds: [...publicState.reserveAssetIds],
    assetDiscardIds: [...publicState.assetDiscardIds],
    completedMysteryIds: [...publicState.completedMysteryIds],
    activeTest: publicState.activeTest ? { ...publicState.activeTest, dice: [...publicState.activeTest.dice] } : undefined,
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

/** Called only after all Mythos card effects finish; no client phase-skip command. */
export function openReplacementWindow(state: GameState, content?: GameContent): CommandResult {
  if (state.phase !== "mythos" || state.pendingDefeat || state.pendingDecision || state.gameResult) return failure("WRONG_PHASE", "Mythos effects must finish first.");
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

function createAcquireAssetsDecision(state: GameState, test: ActiveTest, context: EngineContext): GameEvent[] {
  state.activeTest = undefined;
  state.pendingDecision = {
    id: context.createId(),
    kind: "select_acquired_cards",
    playerId: test.playerId,
    visibility: "owner",
    prompt: `Choose Assets with a total value of ${test.successes} or less.`,
    optionIds: [...state.reserveAssetIds],
    minSelections: 0,
    maxSelections: state.reserveAssetIds.length,
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

function beginSkillTest(
  state: GameState,
  player: EnginePlayer,
  request: { skill: SkillId; modifier: number; continuation: ActiveTest["continuation"]; itemBonuses?: readonly number[]; otherBonuses?: readonly number[] },
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
    successThreshold: 5,
    continuation: request.continuation,
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
  else events.push(...createAcquireAssetsDecision(state, test, context));
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
      skillImprovements: { ...player.skillImprovements },
    })),
    performedActions: [...state.performedActions],
    monsterLocationIds: [...state.monsterLocationIds],
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
    next.defeatedInvestigators = [...(state.defeatedInvestigators ?? []), { investigatorId: actor.investigatorId!, locationId: command.cityId, cause: command.cause, assetIds: [...actor.assetIds], clues: actor.clues, travelTickets: [...(actor.travelTickets ?? [])] }];
    actor.assetIds = [];
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
        actor.clues -= 1;
        activeTest.dice[dieIndex] = context.rollDie();
        activeTest.successes = countActiveTestSuccesses(activeTest, actor, content);
        events.push(
          { type: "CLUE_SPENT_FOR_REROLL", testId: activeTest.id, playerId: actorPlayerId, dieIndex },
          { type: "TEST_DIE_REROLLED", testId: activeTest.id, playerId: actorPlayerId, dieIndex, result: activeTest.dice[dieIndex]!, successes: activeTest.successes },
        );
      }
      if (selectedDie && actor.clues > 0) createTestRerollDecision(next, activeTest, context);
      else events.push(...createAcquireAssetsDecision(next, activeTest, context));
      return success(next, events);
    }
    if (decision.continuation === "acquire_assets_purchase") {
      const totalValue = selections.reduce((total, assetId) =>
        total + (content.assets.find(({ id }) => id === assetId)?.value ?? Number.POSITIVE_INFINITY), 0);
      if (totalValue > (decision.selectionBudget ?? 0)) {
        return failure("ASSET_PURCHASE_OVER_BUDGET", "The selected Assets cost more than the Influence test successes.");
      }
      if (selections.length === 0) {
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
        return success(next, [{
          type: "DECISION_RESOLVED",
          decisionId: decision.id,
          playerId: actorPlayerId,
          selectedOptionIds: [],
        }]);
      }
      next.pendingDecision = undefined;
      next.reserveAssetIds = next.reserveAssetIds.filter((assetId) => !selections.includes(assetId));
      refillReserve(next);
      const events: GameEvent[] = [{
        type: "DECISION_RESOLVED",
        decisionId: decision.id,
        playerId: actorPlayerId,
        selectedOptionIds: [...selections],
      }];
      for (const assetId of selections) {
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
    next.activeMysteryId = activeMysteryId;
    next.mysteryProgress = 0;
    next.mysteryTarget = mysteryTarget;
    next.completedMysteryIds = [];
    next.privateState.deckOrderById.mysteries = shuffledMysteries;
    const shuffledAssets = context.shuffle(availableAssetIds);
    next.reserveAssetIds = shuffledAssets.splice(0, 4);
    next.assetDiscardIds = [];
    next.privateState.deckOrderById.assets = shuffledAssets;
    const ancient = content.ancientOnes?.[state.ancientOneId];
    if (ancient) {
      next.doom = ancient.startingDoom;
      next.omen = 0;
      next.greenOmenTokens = ancient.greenOmenTokens;
      next.privateState.deckOrderById.mythos = buildMythosDeck(content.mythosCards ?? [], ancient.mythosDeck, context.shuffle);
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
      player.clues = setup.startingClues;
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
  if (state.actionsRemaining < 1 && command.type !== "END_ACTIONS") return failure("NO_ACTIONS_REMAINING", "This investigator has no actions remaining.");

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
