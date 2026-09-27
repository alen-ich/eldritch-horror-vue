import { randomInt, randomUUID } from "node:crypto";
import { Client, CloseCode, Room } from "colyseus";
import { baseGameInvestigators, baseGameMap, baseGameMysteries } from "@eldritch/content";
import { createDeterministicEngineContext, executeCommand, type GameContent, type GameState, type PrivateGameState } from "@eldritch/engine";
import {
  commandErrorMessageType,
  commandMessageType,
  gameCommandMessageSchema,
  joinOptionsSchema,
  pendingDecisionMessageType,
  type AncientOneId,
  type InvestigatorId,
  type LocationId,
  type PendingDecision,
} from "@eldritch/protocol";
import { GameRoomState, PendingDecisionState, PlayerState } from "./schema/GameRoomState.js";

const RECONNECTION_SECONDS = 30;
const baseGameContent: GameContent = {
  map: baseGameMap,
  investigators: Object.fromEntries(baseGameInvestigators.map((investigator) => [investigator.id, {
    startingLocationId: investigator.startingLocationId,
    health: investigator.health,
    sanity: investigator.sanity,
  }])),
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
  private privateState: PrivateGameState = { deckOrderById: {}, tokenPoolById: {} };
  private pendingDecision?: PendingDecision;

  messages = {
    [commandMessageType]: (client: Client, payload: unknown) => this.handleCommand(client, payload),
  };

  onJoin(client: Client, rawOptions: unknown): void {
    const options = joinOptionsSchema.parse(rawOptions);
    const playerId = randomUUID();
    const player = new PlayerState();
    player.id = playerId;
    player.sessionId = client.sessionId;
    player.displayName = options.displayName;
    player.isHost = this.state.players.size === 0;
    this.playerIdBySession.set(client.sessionId, playerId);
    this.state.players.set(playerId, player);
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
    this.playerIdBySession.delete(client.sessionId);
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
      ? createDeterministicEngineContext({ shuffleIndexes: [randomInt(4), randomInt(3), randomInt(2)] })
      : undefined;
    const result = executeCommand(this.toEngineState(), playerId, parsed.data.command, baseGameContent, context);
    if (result.ok === false) {
      client.send(commandErrorMessageType, result.error);
      return;
    }
    this.applyEngineState(result.state);
  }

  private toEngineState(): GameState {
    return {
      stateVersion: this.state.stateVersion,
      phase: this.state.phase as GameState["phase"],
      activePlayerId: this.state.activePlayerId || undefined,
      leadInvestigatorId: this.state.leadInvestigatorId || undefined,
      ancientOneId: (this.state.ancientOneId || undefined) as AncientOneId | undefined,
      activeMysteryId: this.state.activeMysteryId || undefined,
      mysteryProgress: this.state.mysteryProgress,
      mysteryTarget: this.state.mysteryTarget,
      completedMysteryIds: this.state.completedMysteryIds ? this.state.completedMysteryIds.split(",") : [],
      gameResult: (this.state.gameResult || undefined) as GameState["gameResult"],
      turnNumber: this.state.turnNumber,
      actionsRemaining: this.state.actionsRemaining,
      performedActions: this.state.performedActions ? this.state.performedActions.split(",") as GameState["performedActions"] : [],
      monsterLocationIds: [],
      pendingDecision: this.pendingDecision,
      privateState: this.privateState,
      players: [...this.state.players.values()].map((player) => ({
        id: player.id,
        investigatorId: (player.investigatorId || undefined) as InvestigatorId | undefined,
        locationId: (player.locationId || undefined) as LocationId | undefined,
        health: player.health || undefined,
        sanity: player.sanity || undefined,
        maxHealth: player.maxHealth || undefined,
        maxSanity: player.maxSanity || undefined,
        travelTickets: [
          ...Array.from({ length: player.trainTickets }, () => "train" as const),
          ...Array.from({ length: player.shipTickets }, () => "ship" as const),
        ],
      })),
    };
  }

  private applyEngineState(engineState: GameState): void {
    this.privateState = engineState.privateState;
    this.pendingDecision = engineState.pendingDecision;
    this.syncPendingDecisionSummary();
    this.state.stateVersion = engineState.stateVersion;
    this.state.phase = engineState.phase;
    this.state.activePlayerId = engineState.activePlayerId ?? "";
    this.state.leadInvestigatorId = engineState.leadInvestigatorId ?? "";
    this.state.ancientOneId = engineState.ancientOneId ?? "";
    this.state.activeMysteryId = engineState.activeMysteryId ?? "";
    this.state.mysteryProgress = engineState.mysteryProgress;
    this.state.mysteryTarget = engineState.mysteryTarget;
    this.state.completedMysteryIds = engineState.completedMysteryIds.join(",");
    this.state.gameResult = engineState.gameResult ?? "";
    this.state.turnNumber = engineState.turnNumber;
    this.state.actionsRemaining = engineState.actionsRemaining;
    this.state.performedActions = engineState.performedActions.join(",");
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
    this.state.pendingDecision = summary;
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
