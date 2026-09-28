import type {
  GameCommand,
  GameEvent,
  GamePhase,
  AncientOneId,
  InvestigatorId,
  LocationId,
  PendingDecision,
  PendingDecisionSummary,
  TravelTicketType,
} from "@eldritch/protocol";

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
  investigatorId?: InvestigatorId;
  locationId?: LocationId;
  health?: number;
  sanity?: number;
  maxHealth?: number;
  maxSanity?: number;
  travelTickets?: TravelTicketType[];
  assetIds: string[];
}

export interface PrivateGameState {
  deckOrderById: Record<string, string[]>;
  tokenPoolById: Record<string, string[]>;
}

export interface GameState {
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
  influence: number;
  startingAssetIds: readonly string[];
}

export interface GameContent {
  map: GameMap;
  investigators: Readonly<Partial<Record<InvestigatorId, InvestigatorSetup>>>;
  assets: readonly { id: string; value: number }[];
  mysteryIdsByAncientOne: Readonly<Partial<Record<AncientOneId, readonly string[]>>>;
  mysteryTargetsById: Readonly<Record<string, "investigator_count" | "half_investigator_count" | "twice_investigator_count" | "one">>;
}

export type RuleErrorCode =
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
    players: playerIds.map((id): EnginePlayer => ({ id, assetIds: [] })),
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
    })),
    performedActions: [...publicState.performedActions],
    monsterLocationIds: [...publicState.monsterLocationIds],
    reserveAssetIds: [...publicState.reserveAssetIds],
    assetDiscardIds: [...publicState.assetDiscardIds],
    completedMysteryIds: [...publicState.completedMysteryIds],
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

function routeBetween(map: GameMap, source: LocationId, target: LocationId) {
  return map.routes.find((route) => (route.source === source && route.target === target) || (route.source === target && route.target === source));
}

function advanceActionInvestigator(state: GameState, actorIndex: number, events: GameEvent[]): void {
  const nextIndex = actorIndex + 1;
  if (nextIndex < state.players.length) {
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

function completeAction(state: GameState, actorIndex: number, action: ActionType, events: GameEvent[]): void {
  state.performedActions.push(action);
  state.actionsRemaining -= 1;
  if (state.actionsRemaining === 0) advanceActionInvestigator(state, actorIndex, events);
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
    })),
    performedActions: [...state.performedActions],
    monsterLocationIds: [...state.monsterLocationIds],
    reserveAssetIds: [...state.reserveAssetIds],
    assetDiscardIds: [...state.assetDiscardIds],
    completedMysteryIds: [...state.completedMysteryIds],
    pendingDecision: state.pendingDecision ? cloneDecision(state.pendingDecision) : undefined,
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
      actor.assetIds.push(...selections);
      next.reserveAssetIds = next.reserveAssetIds.filter((assetId) => !selections.includes(assetId));
      refillReserve(next);
      const events: GameEvent[] = [{
        type: "DECISION_RESOLVED",
        decisionId: decision.id,
        playerId: actorPlayerId,
        selectedOptionIds: [...selections],
      }];
      events.push(...selections.map((assetId) => ({ type: "ASSET_GAINED" as const, playerId: actorPlayerId, assetId, source: "reserve" as const })));
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
  if (state.actionsRemaining < 1 && command.type !== "END_ACTIONS") return failure("NO_ACTIONS_REMAINING", "This investigator has no actions remaining.");

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
    actor.health = Math.min(actor.maxHealth ?? actor.health ?? 0, (actor.health ?? 0) + 1);
    actor.sanity = Math.min(actor.maxSanity ?? actor.sanity ?? 0, (actor.sanity ?? 0) + 1);
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
    const dice = Array.from({ length: investigator.influence }, () => context.rollDie());
    const successes = dice.filter((die) => die >= 5).length;
    next.pendingDecision = {
      id: context.createId(),
      kind: "select_acquired_cards",
      playerId: actorPlayerId,
      visibility: "owner",
      prompt: `Choose Assets with a total value of ${successes} or less.`,
      optionIds: [...next.reserveAssetIds],
      minSelections: 0,
      maxSelections: next.reserveAssetIds.length,
      selectionBudget: successes,
      continuation: "acquire_assets_purchase",
    };
    return success(next, [{ type: "ACQUIRE_ASSETS_TESTED", playerId: actorPlayerId, dice, successes }]);
  }

  const events: GameEvent[] = [{ type: "ACTIONS_ENDED", playerId: actorPlayerId }];
  advanceActionInvestigator(next, actorIndex, events);
  return success(next, events);
}
