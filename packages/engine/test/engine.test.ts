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
    routes: [
      { source: "san_francisco", target: "space_1", type: "ship" },
      { source: "space_1", target: "space_4", type: "uncharted" },
      { source: "space_15", target: "space_10", type: "uncharted" },
      { source: "space_16", target: "space_14", type: "train" },
    ],
    locationTypes: { san_francisco: "city", space_1: "city", space_4: "wilderness", space_15: "city", space_16: "wilderness" },
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
    leadInvestigatorId: "host",
    turnNumber: 1,
    actionsRemaining: 2,
    performedActions: [],
    monsterLocationIds: [],
    players: [
      { id: "host", investigatorId: "akachi_onyele", locationId: "san_francisco", health: 4, sanity: 6, maxHealth: 5, maxSanity: 7, travelTickets: [] },
      { id: "guest", investigatorId: "trish_scarborough", locationId: "san_francisco", health: 7, sanity: 5, maxHealth: 7, maxSanity: 5, travelTickets: [] },
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
      phase: "action", activePlayerId: "host", leadInvestigatorId: "host", turnNumber: 1, actionsRemaining: 2,
      players: [
        { locationId: "space_15", health: 5, sanity: 7 },
        { locationId: "space_16", health: 7, sanity: 5 },
      ],
    });
  });

  it("spends one of two actions to travel to an adjacent location", () => {
    const result = executeCommand(startedGame(), "host", { type: "TRAVEL", destinationIds: ["space_1"] }, testContent);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state).toMatchObject({ actionsRemaining: 1, performedActions: ["travel"] });
      expect(result.state.players[0]?.locationId).toBe("space_1");
    }
  });

  it("rejects non-adjacent and out-of-turn moves without mutating state", () => {
    const state = startedGame();
    expect(executeCommand(state, "host", { type: "TRAVEL", destinationIds: ["space_4"] }, testContent)).toMatchObject({
      ok: false,
      error: { code: "DESTINATION_NOT_ADJACENT" },
    });
    expect(executeCommand(state, "guest", { type: "TRAVEL", destinationIds: ["space_1"] }, testContent)).toMatchObject({
      ok: false,
      error: { code: "NOT_ACTIVE_PLAYER" },
    });
    expect(state.players[0]?.locationId).toBe("san_francisco");
  });

  it("uses matching tickets for extra travel and rejects uncharted ticket movement", () => {
    const state = startedGame();
    state.players[0]!.travelTickets = ["ship"];
    const traveled = executeCommand(state, "host", { type: "TRAVEL", destinationIds: ["space_1"] }, testContent);
    expect(traveled.ok).toBe(true);
    if (!traveled.ok) return;
    expect(executeCommand(traveled.state, "host", { type: "TRAVEL", destinationIds: ["space_4"] }, testContent)).toMatchObject({ ok: false, error: { code: "ACTION_ALREADY_PERFORMED" } });
    expect(executeCommand(state, "host", { type: "TRAVEL", destinationIds: ["space_1", "space_4"] }, testContent)).toMatchObject({ ok: false, error: { code: "TRAVEL_TICKET_REQUIRED" } });
  });

  it("rests once, respects maximums, and cannot rest with a Monster", () => {
    const rested = executeCommand(startedGame(), "host", { type: "REST" }, testContent);
    expect(rested.ok).toBe(true);
    if (!rested.ok) return;
    expect(rested.state.players[0]).toMatchObject({ health: 5, sanity: 7 });
    expect(executeCommand(rested.state, "host", { type: "REST" }, testContent)).toMatchObject({ ok: false, error: { code: "ACTION_ALREADY_PERFORMED" } });
    const blocked = startedGame();
    blocked.monsterLocationIds = ["san_francisco"];
    expect(executeCommand(blocked, "host", { type: "REST" }, testContent)).toMatchObject({ ok: false, error: { code: "REST_BLOCKED_BY_MONSTER" } });
  });

  it("gains valid travel tickets and advances to the Encounter phase after all investigators act", () => {
    let result = executeCommand(startedGame(), "host", { type: "PREPARE_TRAVEL", ticketType: "ship" }, testContent);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0]?.travelTickets).toEqual(["ship"]);
    result = executeCommand(result.state, "host", { type: "END_ACTIONS" }, testContent);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.activePlayerId).toBe("guest");
    result = executeCommand(result.state, "guest", { type: "END_ACTIONS" }, testContent);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state).toMatchObject({ phase: "encounter", activePlayerId: "host", actionsRemaining: 0 });
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
