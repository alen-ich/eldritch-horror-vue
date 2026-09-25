import { describe, expect, it } from "vitest";
import { createLobby, executeCommand, type GameContent, type GameState } from "../src/index.js";

const testContent: GameContent = {
  map: {
    adjacentLocationIds: {
      san_francisco: ["space_1"],
      space_1: ["san_francisco", "space_4"],
      space_4: ["space_1"],
      space_15: ["space_10"],
      space_16: ["space_14"],
    },
  },
  investigators: {
    akachi_onyele: { startingLocationId: "space_15", health: 5, sanity: 7 },
    trish_scarborough: { startingLocationId: "space_16", health: 7, sanity: 5 },
  },
};

function startedGame(): GameState {
  return {
    phase: "action",
    activePlayerId: "host",
    turnNumber: 1,
    players: [
      { id: "host", investigatorId: "akachi_onyele", locationId: "san_francisco" },
      { id: "guest", investigatorId: "trish_scarborough", locationId: "san_francisco" },
    ],
  };
}

describe("executeCommand", () => {
  it("starts a two-player lobby when every investigator is selected", () => {
    let state = createLobby(["host", "guest"]);
    const selectedHost = executeCommand(state, "host", { type: "SELECT_INVESTIGATOR", investigatorId: "akachi_onyele" }, testContent);
    expect(selectedHost.ok).toBe(true);
    if (!selectedHost.ok) return;
    state = selectedHost.state;
    const selectedGuest = executeCommand(state, "guest", { type: "SELECT_INVESTIGATOR", investigatorId: "trish_scarborough" }, testContent);
    expect(selectedGuest.ok).toBe(true);
    if (!selectedGuest.ok) return;
    const started = executeCommand(selectedGuest.state, "host", { type: "START_GAME" }, testContent);
    expect(started.ok).toBe(true);
    if (started.ok) expect(started.state).toMatchObject({
      phase: "action", activePlayerId: "host", turnNumber: 1,
      players: [
        { locationId: "space_15", health: 5, sanity: 7 },
        { locationId: "space_16", health: 7, sanity: 5 },
      ],
    });
  });

  it("moves the active investigator to an adjacent location", () => {
    const result = executeCommand(startedGame(), "host", { type: "MOVE", destinationId: "space_1" }, testContent);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.players[0]?.locationId).toBe("space_1");
  });

  it("rejects non-adjacent and out-of-turn moves without mutating state", () => {
    const state = startedGame();
    expect(executeCommand(state, "host", { type: "MOVE", destinationId: "space_4" }, testContent)).toMatchObject({
      ok: false,
      error: { code: "DESTINATION_NOT_ADJACENT" },
    });
    expect(executeCommand(state, "guest", { type: "MOVE", destinationId: "space_1" }, testContent)).toMatchObject({
      ok: false,
      error: { code: "NOT_ACTIVE_PLAYER" },
    });
    expect(state.players[0]?.locationId).toBe("san_francisco");
  });

  it("prevents duplicate investigator selection", () => {
    const state: GameState = {
      ...createLobby(["host", "guest"]),
      players: [{ id: "host", investigatorId: "akachi_onyele" }, { id: "guest" }],
    };
    expect(executeCommand(state, "guest", { type: "SELECT_INVESTIGATOR", investigatorId: "akachi_onyele" }, testContent)).toMatchObject({
      ok: false,
      error: { code: "INVESTIGATOR_TAKEN" },
    });
  });
});
