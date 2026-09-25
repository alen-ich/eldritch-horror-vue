import { describe, expect, it } from "vitest";
import { createLobby, executeCommand, type GameState } from "../src/index.js";

function startedGame(): GameState {
  return {
    phase: "action",
    activePlayerId: "host",
    turnNumber: 1,
    players: [
      { id: "host", investigatorId: "amanda_sharpe", locationId: "london" },
      { id: "guest", investigatorId: "trish_scarborough", locationId: "london" },
    ],
  };
}

describe("executeCommand", () => {
  it("starts a two-player lobby when every investigator is selected", () => {
    let state = createLobby(["host", "guest"]);
    const selectedHost = executeCommand(state, "host", { type: "SELECT_INVESTIGATOR", investigatorId: "amanda_sharpe" });
    expect(selectedHost.ok).toBe(true);
    if (!selectedHost.ok) return;
    state = selectedHost.state;
    const selectedGuest = executeCommand(state, "guest", { type: "SELECT_INVESTIGATOR", investigatorId: "trish_scarborough" });
    expect(selectedGuest.ok).toBe(true);
    if (!selectedGuest.ok) return;
    const started = executeCommand(selectedGuest.state, "host", { type: "START_GAME" });
    expect(started.ok).toBe(true);
    if (started.ok) expect(started.state).toMatchObject({ phase: "action", activePlayerId: "host", turnNumber: 1 });
  });

  it("moves the active investigator to an adjacent location", () => {
    const result = executeCommand(startedGame(), "host", { type: "MOVE", destinationId: "rome" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.players[0]?.locationId).toBe("rome");
  });

  it("rejects non-adjacent and out-of-turn moves without mutating state", () => {
    const state = startedGame();
    expect(executeCommand(state, "host", { type: "MOVE", destinationId: "istanbul" })).toMatchObject({
      ok: false,
      error: { code: "DESTINATION_NOT_ADJACENT" },
    });
    expect(executeCommand(state, "guest", { type: "MOVE", destinationId: "rome" })).toMatchObject({
      ok: false,
      error: { code: "NOT_ACTIVE_PLAYER" },
    });
    expect(state.players[0]?.locationId).toBe("london");
  });

  it("prevents duplicate investigator selection", () => {
    const state: GameState = {
      ...createLobby(["host", "guest"]),
      players: [{ id: "host", investigatorId: "amanda_sharpe" }, { id: "guest" }],
    };
    expect(executeCommand(state, "guest", { type: "SELECT_INVESTIGATOR", investigatorId: "amanda_sharpe" })).toMatchObject({
      ok: false,
      error: { code: "INVESTIGATOR_TAKEN" },
    });
  });
});
