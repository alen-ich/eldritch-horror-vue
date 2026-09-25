import { describe, expect, it } from "vitest";
import { createLobby, executeCommand, type GameMap, type GameState } from "../src/index.js";

const testMap: GameMap = {
  startingLocationId: "san_francisco",
  adjacentLocationIds: {
    san_francisco: ["space_1"],
    space_1: ["san_francisco", "space_4"],
    space_4: ["space_1"],
  },
};

function startedGame(): GameState {
  return {
    phase: "action",
    activePlayerId: "host",
    turnNumber: 1,
    players: [
      { id: "host", investigatorId: "amanda_sharpe", locationId: "san_francisco" },
      { id: "guest", investigatorId: "trish_scarborough", locationId: "san_francisco" },
    ],
  };
}

describe("executeCommand", () => {
  it("starts a two-player lobby when every investigator is selected", () => {
    let state = createLobby(["host", "guest"]);
    const selectedHost = executeCommand(state, "host", { type: "SELECT_INVESTIGATOR", investigatorId: "amanda_sharpe" }, testMap);
    expect(selectedHost.ok).toBe(true);
    if (!selectedHost.ok) return;
    state = selectedHost.state;
    const selectedGuest = executeCommand(state, "guest", { type: "SELECT_INVESTIGATOR", investigatorId: "trish_scarborough" }, testMap);
    expect(selectedGuest.ok).toBe(true);
    if (!selectedGuest.ok) return;
    const started = executeCommand(selectedGuest.state, "host", { type: "START_GAME" }, testMap);
    expect(started.ok).toBe(true);
    if (started.ok) expect(started.state).toMatchObject({ phase: "action", activePlayerId: "host", turnNumber: 1 });
  });

  it("moves the active investigator to an adjacent location", () => {
    const result = executeCommand(startedGame(), "host", { type: "MOVE", destinationId: "space_1" }, testMap);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.players[0]?.locationId).toBe("space_1");
  });

  it("rejects non-adjacent and out-of-turn moves without mutating state", () => {
    const state = startedGame();
    expect(executeCommand(state, "host", { type: "MOVE", destinationId: "space_4" }, testMap)).toMatchObject({
      ok: false,
      error: { code: "DESTINATION_NOT_ADJACENT" },
    });
    expect(executeCommand(state, "guest", { type: "MOVE", destinationId: "space_1" }, testMap)).toMatchObject({
      ok: false,
      error: { code: "NOT_ACTIVE_PLAYER" },
    });
    expect(state.players[0]?.locationId).toBe("san_francisco");
  });

  it("prevents duplicate investigator selection", () => {
    const state: GameState = {
      ...createLobby(["host", "guest"]),
      players: [{ id: "host", investigatorId: "amanda_sharpe" }, { id: "guest" }],
    };
    expect(executeCommand(state, "guest", { type: "SELECT_INVESTIGATOR", investigatorId: "amanda_sharpe" }, testMap)).toMatchObject({
      ok: false,
      error: { code: "INVESTIGATOR_TAKEN" },
    });
  });
});
