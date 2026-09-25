import { randomUUID } from "node:crypto";
import { Client, CloseCode, Room } from "colyseus";
import { executeCommand, type GameState } from "@eldritch/engine";
import {
  commandErrorMessageType,
  commandMessageType,
  gameCommandSchema,
  joinOptionsSchema,
  type GameCommand,
  type InvestigatorId,
  type LocationId,
} from "@eldritch/protocol";
import { GameRoomState, PlayerState } from "./schema/GameRoomState.js";

const RECONNECTION_SECONDS = 30;

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
    const parsed = gameCommandSchema.safeParse(payload);
    if (!parsed.success) {
      client.send(commandErrorMessageType, { code: "INVALID_COMMAND", message: "Command payload is invalid." });
      return;
    }
    const playerId = this.playerIdBySession.get(client.sessionId);
    if (!playerId) {
      client.send(commandErrorMessageType, { code: "PLAYER_NOT_FOUND", message: "No player seat is associated with this connection." });
      return;
    }
    const result = executeCommand(this.toEngineState(), playerId, parsed.data);
    if (result.ok === false) {
      client.send(commandErrorMessageType, result.error);
      return;
    }
    this.applyEngineState(result.state);
  }

  private toEngineState(): GameState {
    return {
      phase: this.state.phase as GameState["phase"],
      activePlayerId: this.state.activePlayerId || undefined,
      turnNumber: this.state.turnNumber,
      players: [...this.state.players.values()].map((player) => ({
        id: player.id,
        investigatorId: (player.investigatorId || undefined) as InvestigatorId | undefined,
        locationId: (player.locationId || undefined) as LocationId | undefined,
      })),
    };
  }

  private applyEngineState(engineState: GameState): void {
    this.state.phase = engineState.phase;
    this.state.activePlayerId = engineState.activePlayerId ?? "";
    this.state.turnNumber = engineState.turnNumber;
    for (const enginePlayer of engineState.players) {
      const player = this.state.players.get(enginePlayer.id);
      if (!player) continue;
      player.investigatorId = enginePlayer.investigatorId ?? "";
      player.locationId = enginePlayer.locationId ?? "";
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
