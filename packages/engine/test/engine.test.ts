import { describe, expect, it } from "vitest";
import {
  createDeterministicEngineContext,
  createLobby,
  executeCommand,
  projectPublicState,
  projectStateForPlayer,
  type GameContent,
  type GameState,
} from "../src/index.js";

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
  mysteryIdsByAncientOne: {
    cthulhu: ["cthulhu_one", "cthulhu_two", "cthulhu_three", "cthulhu_four"],
    yog_sothoth: ["yog_one", "yog_two", "yog_three", "yog_four"],
  },
};

function startedGame(): GameState {
  return {
    stateVersion: 3,
    phase: "action",
    activePlayerId: "host",
    leadInvestigatorId: "host",
    ancientOneId: "cthulhu",
    turnNumber: 1,
    actionsRemaining: 2,
    performedActions: [],
    monsterLocationIds: [],
    activeMysteryId: "cthulhu_one",
    completedMysteryIds: [],
    privateState: { deckOrderById: {}, tokenPoolById: {} },
    players: [
      { id: "host", investigatorId: "akachi_onyele", locationId: "san_francisco", health: 4, sanity: 6, maxHealth: 5, maxSanity: 7, travelTickets: [] },
      { id: "guest", investigatorId: "trish_scarborough", locationId: "san_francisco", health: 7, sanity: 5, maxHealth: 7, maxSanity: 5, travelTickets: [] },
    ],
  };
}

describe("executeCommand", () => {
  it("increments the state version exactly once for an accepted command", () => {
    const result = executeCommand(startedGame(), "host", { type: "REST" }, testContent);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.stateVersion).toBe(4);
  });

  it("does not mutate or advance state for a rejected command", () => {
    const state = startedGame();
    const snapshot = structuredClone(state);
    const result = executeCommand(state, "guest", { type: "REST" }, testContent);
    expect(result).toMatchObject({ ok: false, error: { code: "NOT_ACTIVE_PLAYER" } });
    expect(state).toEqual(snapshot);
  });

  it("starts a two-player lobby when every investigator is selected", () => {
    let state = createLobby(["host", "guest"]);
    const selectedHost = executeCommand(state, "host", { type: "SELECT_INVESTIGATOR", investigatorId: "akachi_onyele" }, testContent);
    expect(selectedHost.ok).toBe(true);
    if (!selectedHost.ok) return;
    state = selectedHost.state;
    const selectedGuest = executeCommand(state, "guest", { type: "SELECT_INVESTIGATOR", investigatorId: "trish_scarborough" }, testContent);
    expect(selectedGuest.ok).toBe(true);
    if (!selectedGuest.ok) return;
    const selectedAncientOne = executeCommand(selectedGuest.state, "host", { type: "SELECT_ANCIENT_ONE", ancientOneId: "cthulhu" }, testContent);
    expect(selectedAncientOne.ok).toBe(true);
    if (!selectedAncientOne.ok) return;
    const context = createDeterministicEngineContext({ shuffleIndexes: [0, 1, 0] });
    const started = executeCommand(selectedAncientOne.state, "host", { type: "START_GAME" }, testContent, context);
    expect(started.ok).toBe(true);
    if (started.ok) expect(started.state).toMatchObject({
      phase: "action", activePlayerId: "host", leadInvestigatorId: "host", turnNumber: 1, actionsRemaining: 2,
      players: [
        { locationId: "space_15", health: 5, sanity: 7 },
        { locationId: "space_16", health: 7, sanity: 5 },
      ],
      activeMysteryId: "cthulhu_three",
      completedMysteryIds: [],
    });
    if (started.ok) {
      expect(started.state.privateState.deckOrderById.mysteries).toEqual(["cthulhu_four", "cthulhu_two", "cthulhu_one"]);
      expect(started.events.at(-1)).toEqual({ type: "MYSTERY_REVEALED", mysteryId: "cthulhu_three" });
    }
  });

  it("requires complete Mystery content and explicit random input before starting", () => {
    const state = createLobby(["host", "guest"]);
    state.ancientOneId = "cthulhu";
    state.players[0]!.investigatorId = "akachi_onyele";
    state.players[1]!.investigatorId = "trish_scarborough";
    expect(executeCommand(state, "host", { type: "START_GAME" }, { ...testContent, mysteryIdsByAncientOne: {} })).toMatchObject({
      ok: false, error: { code: "MYSTERY_CONTENT_MISSING" },
    });
    expect(executeCommand(state, "host", { type: "START_GAME" }, testContent)).toMatchObject({
      ok: false, error: { code: "RANDOM_INPUT_REQUIRED" },
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

  it("allows only the host to select an Ancient One in the lobby", () => {
    const state = createLobby(["host", "guest"]);
    expect(executeCommand(state, "guest", { type: "SELECT_ANCIENT_ONE", ancientOneId: "cthulhu" }, testContent)).toMatchObject({
      ok: false,
      error: { code: "NOT_HOST" },
    });
    const selected = executeCommand(state, "host", { type: "SELECT_ANCIENT_ONE", ancientOneId: "yog_sothoth" }, testContent);
    expect(selected.ok).toBe(true);
    if (selected.ok) expect(selected.state.ancientOneId).toBe("yog_sothoth");
  });

  it("requires an Ancient One before the host can start", () => {
    const state = createLobby(["host", "guest"]);
    state.players[0]!.investigatorId = "akachi_onyele";
    state.players[1]!.investigatorId = "trish_scarborough";
    expect(executeCommand(state, "host", { type: "START_GAME" }, testContent)).toMatchObject({
      ok: false,
      error: { code: "ANCIENT_ONE_REQUIRED" },
    });
  });
});

describe("projectPublicState", () => {
  it("removes hidden deck and token order from the synchronized projection", () => {
    const state = startedGame();
    state.privateState = {
      deckOrderById: { mythos: ["mythos_03", "mythos_01"], mysteries: ["hidden_mystery"] },
      tokenPoolById: { gates: ["gate_rome", "gate_tokyo"] },
    };

    const projection = projectPublicState(state);

    expect(projection).not.toHaveProperty("privateState");
    expect(JSON.stringify(projection)).not.toContain("mythos_03");
    expect(JSON.stringify(projection)).not.toContain("gate_rome");
    expect(JSON.stringify(projection)).not.toContain("hidden_mystery");
    expect(projection.activeMysteryId).toBe("cthulhu_one");
  });

  it("returns detached public collections", () => {
    const state = startedGame();
    const projection = projectPublicState(state);

    projection.players[0]!.travelTickets!.push("ship");
    projection.performedActions.push("rest");
    projection.monsterLocationIds.push("rome");

    expect(state.players[0]!.travelTickets).toEqual([]);
    expect(state.performedActions).toEqual([]);
    expect(state.monsterLocationIds).toEqual([]);
  });

  it("shows owner-only options to the owner but only a summary to other players", () => {
    const state = startedGame();
    state.pendingDecision = {
      id: "decision-1",
      kind: "select_rerolls",
      playerId: "host",
      visibility: "owner",
      prompt: "Choose a die to reroll.",
      optionIds: ["die-1", "die-2"],
      minSelections: 0,
      maxSelections: 1,
    };

    expect(projectStateForPlayer(state, "host").pendingDecision).toHaveProperty("optionIds", ["die-1", "die-2"]);
    expect(projectStateForPlayer(state, "guest").pendingDecision).toEqual({
      id: "decision-1",
      kind: "select_rerolls",
      playerId: "host",
      visibility: "owner",
      prompt: "Choose a die to reroll.",
      optionCount: 2,
      minSelections: 0,
      maxSelections: 1,
    });
    expect(projectPublicState(state).pendingDecision).not.toHaveProperty("optionIds");
  });
});

describe("pending decisions", () => {
  function stateWithDecision(): GameState {
    const state = startedGame();
    state.pendingDecision = {
      id: "decision-1",
      kind: "choose_encounter",
      playerId: "host",
      visibility: "owner",
      prompt: "Choose an encounter deck.",
      optionIds: ["city", "research"],
      minSelections: 1,
      maxSelections: 1,
    };
    return state;
  }

  it("serializes and resolves an interrupted decision", () => {
    const restored = JSON.parse(JSON.stringify(stateWithDecision())) as GameState;
    const result = executeCommand(restored, "host", {
      type: "RESOLVE_DECISION",
      decisionId: "decision-1",
      selectedOptionIds: ["research"],
    }, testContent);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.pendingDecision).toBeUndefined();
    expect(result.state.stateVersion).toBe(4);
    expect(result.events).toEqual([{
      type: "DECISION_RESOLVED",
      decisionId: "decision-1",
      playerId: "host",
      selectedOptionIds: ["research"],
    }]);
  });

  it("blocks unrelated commands while a decision is pending", () => {
    const state = stateWithDecision();
    expect(executeCommand(state, "host", { type: "REST" }, testContent)).toMatchObject({
      ok: false,
      error: { code: "DECISION_PENDING" },
    });
  });

  it.each([
    ["guest", "decision-1", ["city"], "NOT_DECISION_OWNER"],
    ["host", "old-decision", ["city"], "DECISION_ID_MISMATCH"],
    ["host", "decision-1", [], "INVALID_DECISION_SELECTION"],
    ["host", "decision-1", ["unknown"], "INVALID_DECISION_SELECTION"],
    ["host", "decision-1", ["city", "city"], "INVALID_DECISION_SELECTION"],
  ])("rejects an invalid resolution without mutation", (playerId, decisionId, selections, errorCode) => {
    const state = stateWithDecision();
    const snapshot = structuredClone(state);
    const result = executeCommand(state, playerId as string, {
      type: "RESOLVE_DECISION",
      decisionId: decisionId as string,
      selectedOptionIds: selections as string[],
    }, testContent);

    expect(result).toMatchObject({ ok: false, error: { code: errorCode } });
    expect(state).toEqual(snapshot);
  });

  it("rejects resolution when no decision exists", () => {
    expect(executeCommand(startedGame(), "host", {
      type: "RESOLVE_DECISION",
      decisionId: "decision-1",
      selectedOptionIds: [],
    }, testContent)).toMatchObject({ ok: false, error: { code: "NO_PENDING_DECISION" } });
  });
});

describe("createDeterministicEngineContext", () => {
  it("replays identical random inputs as identical outcomes", () => {
    const inputs = {
      dice: [6, 2],
      shuffleIndexes: [1, 0],
      tokenIndexes: [2],
      ids: ["decision-001"],
    } as const;

    const run = () => {
      const context = createDeterministicEngineContext(inputs);
      return {
        dice: [context.rollDie(), context.rollDie()],
        shuffled: context.shuffle(["a", "b", "c"]),
        tokenDraw: context.drawToken(["gate-a", "gate-b", "gate-c"]),
        id: context.createId(),
      };
    };

    expect(run()).toEqual(run());
    expect(run()).toEqual({
      dice: [6, 2],
      shuffled: ["c", "a", "b"],
      tokenDraw: { token: "gate-c", remaining: ["gate-a", "gate-b"] },
      id: "decision-001",
    });
  });

  it("fails clearly on exhausted or out-of-range inputs", () => {
    expect(() => createDeterministicEngineContext({}).rollDie()).toThrow("die input is exhausted");
    expect(() => createDeterministicEngineContext({ dice: [0] }).rollDie()).toThrow("integer from 1 to 6");
    expect(() => createDeterministicEngineContext({ shuffleIndexes: [2] }).shuffle(["a", "b"])).toThrow("between 0 and 1");
    expect(() => createDeterministicEngineContext({ tokenIndexes: [1] }).drawToken(["only"])).toThrow("between 0 and 0");
    expect(() => createDeterministicEngineContext({ ids: [""] }).createId()).toThrow("exhausted or empty");
  });

  it("does not mutate source collections", () => {
    const cards = ["a", "b", "c"];
    const tokens = ["one", "two"];
    const context = createDeterministicEngineContext({ shuffleIndexes: [1, 0], tokenIndexes: [0] });

    context.shuffle(cards);
    context.drawToken(tokens);

    expect(cards).toEqual(["a", "b", "c"]);
    expect(tokens).toEqual(["one", "two"]);
  });
});
