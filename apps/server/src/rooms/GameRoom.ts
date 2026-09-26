import { randomUUID } from "node:crypto";
import { Client, CloseCode, Room } from "colyseus";
import { baseGameInvestigators, baseGameMap } from "@eldritch/content";
import { executeCommand, type GameContent, type GameState } from "@eldritch/engine";
import {
  commandErrorMessageType,
  commandMessageType,
  gameCommandMessageSchema,
  joinOptionsSchema,
  type InvestigatorId,
  type LocationId,
} from "@eldritch/protocol";
import { GameRoomState, PlayerState } from "./schema/GameRoomState.js";

const RECONNECTION_SECONDS = 30;
const baseGameContent: GameContent = {
  map: baseGameMap,
  investigators: Object.fromEntries(baseGameInvestigators.map((investigator) => [investigator.id, {
    startingLocationId: investigator.startingLocationId,
    health: investigator.health,
    sanity: investigator.sanity,
  }])),
};

export class GameRoom extends Room<{ state: GameRoomState }> {
  maxClients = 4;
  state = new GameRoomState();

  private readonly playerIdBySession = new Map<string, string>();

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
    const result = executeCommand(this.toEngineState(), playerId, parsed.data.command, baseGameContent);
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
      turnNumber: this.state.turnNumber,
      actionsRemaining: this.state.actionsRemaining,
      performedActions: this.state.performedActions ? this.state.performedActions.split(",") as GameState["performedActions"] : [],
      monsterLocationIds: [],
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
    this.state.stateVersion = engineState.stateVersion;
    this.state.phase = engineState.phase;
    this.state.activePlayerId = engineState.activePlayerId ?? "";
    this.state.leadInvestigatorId = engineState.leadInvestigatorId ?? "";
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
