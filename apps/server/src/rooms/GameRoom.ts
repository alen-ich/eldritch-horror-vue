import { randomInt, randomUUID } from "node:crypto";
import { Client, CloseCode, Room } from "colyseus";
import { baseGameAncientOnes, baseGameMythosCards, baseGameAssets, baseGameConditions, baseGameGates, baseGameInvestigators, baseGameMap, baseGameMysteries, baseGameMonsters } from "@eldritch/content";
import { createDeterministicEngineContext, executeCommand, publicConditionId, type GameContent, type GameState, type PrivateGameState } from "@eldritch/engine";
import {
  commandErrorMessageType,
  commandMessageType,
  gameCommandMessageSchema,
  joinOptionsSchema,
  pendingDecisionMessageType,
  type AncientOneId,
  type ActiveTest,
  type InvestigatorId,
  type LocationId,
  type PendingDecision,
} from "@eldritch/protocol";
import { ActiveTestState, GameRoomState, PendingDecisionState, PlayerState } from "./schema/GameRoomState.js";
import { privateConditionBackEffectById } from "../private-condition-backs.js";
import { typedMonsterSpawnEffect } from "../private-monster-spawn-effects.js";

const RECONNECTION_SECONDS = 30;


function randomShuffleIndexes(length: number): number[] {
  return Array.from({ length: Math.max(0, length - 1) }, (_, offset) => randomInt(length - offset));
}
const baseGameContent: GameContent = {
  gates: baseGameGates.map(({ id, omenSymbol, locationId }) => ({ id, omenSymbol, locationId })),
  conditions: baseGameConditions.map(({ id, kind }) => ({ id, kind, backEffect: privateConditionBackEffectById[id] })),
  monsters: baseGameMonsters.map(({ id, type, count, horrorCheck, damageCheck, toughness, specialEffect, spawnEffect }) => ({
    id, type, count, horrorCheck, damageCheck, toughness, specialEffect,
    spawnEffect: typedMonsterSpawnEffect(id, Boolean(spawnEffect)),
  })),
  ancientOnes: Object.fromEntries(baseGameAncientOnes.map(ancient => [ancient.id, {
    startingDoom: ancient.startingDoom,
    mythosDeck: ancient.mythosDeck,
    greenOmenTokens: ancient.setup.reduce((sum, effect) => sum + (effect.type === "place_eldritch_token_on_omen" ? effect.quantity : 0), 0),
    setAsideMonsters: ancient.setup.filter(effect => effect.type === "set_aside_monster").map(({ monsterId, quantity }) => ({ monsterId, quantity })),
  }])),
  mythosCards: baseGameMythosCards,
  map: baseGameMap,
  investigators: Object.fromEntries(baseGameInvestigators.map((investigator) => [investigator.id, {
    startingLocationId: investigator.startingLocationId,
    health: investigator.health,
    sanity: investigator.sanity,
    skills: investigator.skills,
    startingAssetIds: investigator.startingAssetIds,
    startingClues: investigator.startingClues,
  }])),
  assets: baseGameAssets.map(({ id, value, engineEffects }) => ({ id, value, engineEffects })),
  mysteryIdsByAncientOne: Object.fromEntries(
    ["cthulhu", "shub_niggurath", "yog_sothoth", "azathoth"].map((ancientOneId) => [
      ancientOneId,
      baseGameMysteries.filter((mystery) => mystery.ancientOneId === ancientOneId).map((mystery) => mystery.id),
    ]),
  ),
  mysteryTargetsById: Object.fromEntries(baseGameMysteries.map((mystery) => [
    mystery.id,
    mystery.completion.metric === "epic_monster_defeated" ? "one" : mystery.completion.target,
  ])),
};

export class GameRoom extends Room<{ state: GameRoomState }> {
  maxClients = 4;
  state = new GameRoomState();

  private readonly playerIdBySession = new Map<string, string>();
  private readonly seatTokens = new Map<string, string>();
  private privateState: PrivateGameState = { deckOrderById: {}, tokenPoolById: {} };
  /** Physical copy identities must never be synchronized through PlayerState. */
  private readonly conditionIdsByPlayer = new Map<string, string[]>();
  private pendingDecision?: PendingDecision;
  private activeTest?: ActiveTest;

  messages = {
    "request-seat-token": (client: Client) => {
      const player = this.playerFor(client);
      if (player) client.send("seat-token", this.seatTokens.get(player.id));
      this.sendPendingDecision(client);
    },
    [commandMessageType]: (client: Client, payload: unknown) => this.handleCommand(client, payload),
  };

  onJoin(client: Client, rawOptions: unknown): void {
    const options = joinOptionsSchema.parse(rawOptions);
    if (options.resumeToken) {
      const entry = [...this.seatTokens.entries()].find(([, token]) => token === options.resumeToken);
      const seat = entry ? this.state.players.get(entry[0]) : undefined;
      if (!seat || seat.connected) throw new Error("The requested seat is unavailable.");
      this.playerIdBySession.delete(seat.sessionId);
      seat.sessionId = client.sessionId;
      seat.connected = true;
      this.playerIdBySession.set(client.sessionId, seat.id);
      return;
    }
    if (this.state.phase !== "lobby" || this.state.players.size >= this.maxClients) throw new Error("This game is already in progress or full.");
    const playerId = randomUUID();
    const player = new PlayerState();
    player.id = playerId;
    player.sessionId = client.sessionId;
    player.displayName = options.displayName;
    player.isHost = this.state.players.size === 0;
    this.playerIdBySession.set(client.sessionId, playerId);
    this.state.players.set(playerId, player);
    this.seatTokens.set(playerId, randomUUID());
  }

  onDrop(client: Client, _code: CloseCode): void {
    const player = this.playerFor(client);
    if (player) player.connected = false;
    void this.allowReconnection(client, RECONNECTION_SECONDS).catch(() => undefined);
  }

  onReconnect(client: Client): void {
    const player = this.playerFor(client);
    if (player) {
      player.connected = true;
      player.sessionId = client.sessionId;
      this.sendPendingDecision(client);
    }
  }

  onLeave(client: Client): void {
    const playerId = this.playerIdBySession.get(client.sessionId);
    if (!playerId) return;
    if (this.state.phase !== "lobby") {
      const player = this.state.players.get(playerId);
      if (player) player.connected = false;
      return;
    }
    this.playerIdBySession.delete(client.sessionId);
    this.seatTokens.delete(playerId);
    this.state.players.delete(playerId);
    if (this.state.phase === "lobby") this.assignHost();
  }

  private handleCommand(client: Client, payload: unknown): void {
    const parsed = gameCommandMessageSchema.safeParse(payload);
    if (!parsed.success) {
      client.send(commandErrorMessageType, { code: "INVALID_COMMAND", message: "Command payload is invalid." });
      return;
    }
    const playerId = this.playerIdBySession.get(client.sessionId);
    if (!playerId) {
      client.send(commandErrorMessageType, { code: "PLAYER_NOT_FOUND", message: "No player seat is associated with this connection." });
      return;
    }
    if (parsed.data.expectedStateVersion !== this.state.stateVersion) {
      client.send(commandErrorMessageType, {
        code: "STALE_STATE",
        message: "The game changed before this command was processed. Review the current state and try again.",
      });
      return;
    }
    const context = parsed.data.command.type === "START_GAME"
      ? createDeterministicEngineContext({
          shuffleIndexes: [
            ...randomShuffleIndexes(4),
            ...randomShuffleIndexes(baseGameAssets.length - [...this.state.players.values()].reduce((count, player) => {
              const investigator = baseGameInvestigators.find(({ id }) => id === player.investigatorId);
              return count + (investigator?.startingAssetIds.length ?? 0);
            }, 0)),
            ...["green", "yellow", "blue"].flatMap(color => randomShuffleIndexes(baseGameMythosCards.filter(card => card.color === color).length)),
            ...(baseGameAncientOnes.find(ancient => ancient.id === this.state.ancientOneId)?.mythosDeck ?? []).flatMap(stage => randomShuffleIndexes(stage.green + stage.yellow + stage.blue)),
            ...randomShuffleIndexes(baseGameGates.length),
          ],
        })
        : parsed.data.command.type === "ACQUIRE_ASSETS" || parsed.data.command.type === "USE_CONDITION_ACTION"
        ? createDeterministicEngineContext({
            dice: Array.from({ length: 12 }, () => randomInt(1, 7)),
            ids: [randomUUID(), randomUUID()],
          })
        : parsed.data.command.type === "RESOLVE_DECISION" || parsed.data.command.type === "OFFER_TRADE"
          ? createDeterministicEngineContext({ dice: Array.from({ length: 12 }, () => randomInt(1, 7)), ids: [randomUUID(), randomUUID()], tokenIndexes: [randomInt(Math.max(1, this.privateState.tokenPoolById["condition:debt"]?.length ?? 0))] })
          : parsed.data.command.type === "REST"
            ? createDeterministicEngineContext({ ids: [randomUUID()] })
          : undefined;
    const result = executeCommand(this.toEngineState(), playerId, parsed.data.command, baseGameContent, context);
    if (result.ok === false) {
      client.send(commandErrorMessageType, result.error);
      return;
    }
    this.applyEngineState(result.state);
  }

  private toEngineState(): GameState {
    const monsters = JSON.parse(this.state.monsters) as NonNullable<GameState["monsters"]>;
    return {
      ...JSON.parse(this.state.investigatorLifecycle) as Pick<GameState, "pendingDefeat" | "defeatedInvestigators" | "replacementWindow" | "awakened">,
      doom: this.state.doom,
      omen: this.state.omen,
      greenOmenTokens: this.state.greenOmenTokens,
      tradeOffer: this.state.tradeOffer ? JSON.parse(this.state.tradeOffer) as GameState["tradeOffer"] : undefined,
      stateVersion: this.state.stateVersion,
      phase: this.state.phase as GameState["phase"],
      activePlayerId: this.state.activePlayerId || undefined,
      leadInvestigatorId: this.state.leadInvestigatorId || undefined,
      ancientOneId: (this.state.ancientOneId || undefined) as AncientOneId | undefined,
      currentMythosCardId: this.state.currentMythosCardId || undefined,
      activeMysteryId: this.state.activeMysteryId || undefined,
      mysteryProgress: this.state.mysteryProgress,
      mysteryTarget: this.state.mysteryTarget,
      completedMysteryIds: this.state.completedMysteryIds ? this.state.completedMysteryIds.split(",") : [],
      gameResult: (this.state.gameResult || undefined) as GameState["gameResult"],
      turnNumber: this.state.turnNumber,
      actionsRemaining: this.state.actionsRemaining,
      performedActions: this.state.performedActions ? this.state.performedActions.split(",") as GameState["performedActions"] : [],
      usedConditionActionIds: this.state.usedConditionActionIds ? this.state.usedConditionActionIds.split(",") : [],
      monsterLocationIds: [...new Set(monsters.map(monster => monster.locationId))],
      monsters,
      reserveAssetIds: this.state.reserveAssetIds ? this.state.reserveAssetIds.split(",") : [],
      assetDiscardIds: this.state.assetDiscardIds ? this.state.assetDiscardIds.split(",") : [],
      pendingDecision: this.pendingDecision,
      activeTest: this.activeTest,
      privateState: this.privateState,
      players: [...this.state.players.values()].map((player) => ({
        id: player.id,
        delayed: player.delayed,
        defeated: player.defeated,
        eliminated: player.eliminated,
        investigatorId: (player.investigatorId || undefined) as InvestigatorId | undefined,
        locationId: (player.locationId || undefined) as LocationId | undefined,
        health: player.health,
        sanity: player.sanity,
        maxHealth: player.maxHealth || undefined,
        maxSanity: player.maxSanity || undefined,
        travelTickets: [
          ...Array.from({ length: player.trainTickets }, () => "train" as const),
          ...Array.from({ length: player.shipTickets }, () => "ship" as const),
        ],
        assetIds: player.assetIds ? player.assetIds.split(",") : [],
        conditionIds: [...(this.conditionIdsByPlayer.get(player.id) ?? [])],
        clues: player.clues,
        skillImprovements: {
          lore: player.loreImprovement,
          influence: player.influenceImprovement,
          observation: player.observationImprovement,
          strength: player.strengthImprovement,
          will: player.willImprovement,
        },
      })),
    };
  }

  private applyEngineState(engineState: GameState): void {
    if (engineState.phase !== "lobby") this.autoDispose = false;
    this.state.investigatorLifecycle = JSON.stringify({ pendingDefeat: engineState.pendingDefeat, defeatedInvestigators: engineState.defeatedInvestigators, replacementWindow: engineState.replacementWindow, awakened: engineState.awakened });
    this.state.doom = engineState.doom ?? 0;
    this.state.omen = engineState.omen ?? 0;
    this.state.greenOmenTokens = engineState.greenOmenTokens ?? 0;
    this.state.tradeOffer = engineState.tradeOffer ? JSON.stringify(engineState.tradeOffer) : "";
    this.privateState = engineState.privateState;
    this.pendingDecision = engineState.pendingDecision;
    this.activeTest = engineState.activeTest;
    this.syncPendingDecisionSummary();
    this.syncActiveTest();
    this.state.stateVersion = engineState.stateVersion;
    this.state.phase = engineState.phase;
    this.state.activePlayerId = engineState.activePlayerId ?? "";
    this.state.leadInvestigatorId = engineState.leadInvestigatorId ?? "";
    this.state.ancientOneId = engineState.ancientOneId ?? "";
    this.state.currentMythosCardId = engineState.currentMythosCardId ?? "";
    this.state.activeMysteryId = engineState.activeMysteryId ?? "";
    this.state.mysteryProgress = engineState.mysteryProgress;
    this.state.mysteryTarget = engineState.mysteryTarget;
    this.state.completedMysteryIds = engineState.completedMysteryIds.join(",");
    this.state.gameResult = engineState.gameResult ?? "";
    this.state.turnNumber = engineState.turnNumber;
    this.state.actionsRemaining = engineState.actionsRemaining;
    this.state.performedActions = engineState.performedActions.join(",");
    this.state.usedConditionActionIds = (engineState.usedConditionActionIds ?? []).join(",");
    this.state.monsters = JSON.stringify(engineState.monsters ?? []);
    this.state.reserveAssetIds = engineState.reserveAssetIds.join(",");
    this.state.assetDiscardIds = engineState.assetDiscardIds.join(",");
    for (const enginePlayer of engineState.players) {
      const player = this.state.players.get(enginePlayer.id);
      if (!player) continue;
      player.investigatorId = enginePlayer.investigatorId ?? "";
      player.locationId = enginePlayer.locationId ?? "";
      player.health = enginePlayer.health ?? 0;
      player.sanity = enginePlayer.sanity ?? 0;
      player.maxHealth = enginePlayer.maxHealth ?? 0;
      player.maxSanity = enginePlayer.maxSanity ?? 0;
      player.trainTickets = enginePlayer.travelTickets?.filter((ticket) => ticket === "train").length ?? 0;
      player.shipTickets = enginePlayer.travelTickets?.filter((ticket) => ticket === "ship").length ?? 0;
      player.assetIds = enginePlayer.assetIds.join(",");
      this.conditionIdsByPlayer.set(enginePlayer.id, [...(enginePlayer.conditionIds ?? [])]);
      player.conditionIds = (enginePlayer.conditionIds ?? []).map(publicConditionId).join(",");
      player.clues = enginePlayer.clues;
      player.delayed = enginePlayer.delayed ?? false;
      player.defeated = enginePlayer.defeated ?? false;
      player.eliminated = enginePlayer.eliminated ?? false;
      player.loreImprovement = enginePlayer.skillImprovements.lore ?? 0;
      player.influenceImprovement = enginePlayer.skillImprovements.influence ?? 0;
      player.observationImprovement = enginePlayer.skillImprovements.observation ?? 0;
      player.strengthImprovement = enginePlayer.skillImprovements.strength ?? 0;
      player.willImprovement = enginePlayer.skillImprovements.will ?? 0;
    }
    for (const client of this.clients) this.sendPendingDecision(client);
  }

  private syncPendingDecisionSummary(): void {
    if (!this.pendingDecision) {
      this.state.pendingDecision = undefined;
      return;
    }
    const summary = new PendingDecisionState();
    summary.id = this.pendingDecision.id;
    summary.kind = this.pendingDecision.kind;
    summary.playerId = this.pendingDecision.playerId;
    summary.visibility = this.pendingDecision.visibility;
    summary.prompt = this.pendingDecision.prompt;
    summary.optionCount = this.pendingDecision.optionIds.length;
    summary.minSelections = this.pendingDecision.minSelections;
    summary.maxSelections = this.pendingDecision.maxSelections;
    summary.selectionBudget = this.pendingDecision.selectionBudget ?? 0;
    summary.continuation = this.pendingDecision.continuation ?? "";
    this.state.pendingDecision = summary;
  }

  private syncActiveTest(): void {
    if (!this.activeTest) {
      this.state.activeTest = undefined;
      return;
    }
    const test = new ActiveTestState();
    test.id = this.activeTest.id;
    test.playerId = this.activeTest.playerId;
    test.skill = this.activeTest.skill;
    test.modifier = this.activeTest.modifier;
    test.dicePool = this.activeTest.dicePool;
    test.dice = this.activeTest.dice.join(",");
    test.successes = this.activeTest.successes;
    test.successThreshold = this.activeTest.successThreshold;
    test.continuation = this.activeTest.continuation;
    this.state.activeTest = test;
  }

  private sendPendingDecision(client: Client): void {
    if (!this.pendingDecision) return;
    const playerId = this.playerIdBySession.get(client.sessionId);
    if (this.pendingDecision.visibility === "public" || this.pendingDecision.playerId === playerId) {
      client.send(pendingDecisionMessageType, this.pendingDecision);
    }
  }

  private playerFor(client: Client): PlayerState | undefined {
    const playerId = this.playerIdBySession.get(client.sessionId);
    return playerId ? this.state.players.get(playerId) : undefined;
  }

  private assignHost(): void {
    const players = [...this.state.players.values()];
    players.forEach((player, index) => { player.isHost = index === 0; });
  }
}
