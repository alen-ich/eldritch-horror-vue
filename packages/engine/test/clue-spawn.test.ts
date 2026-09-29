import { describe, expect, it } from "vitest";
import { createDeterministicEngineContext, projectPublicState, spawnClueFromPool, type GameContent, type GameState } from "../src/index.js";

const content: GameContent = {
  clues: [{ id: "clue_arkham", locationId: "arkham" }, { id: "clue_london", locationId: "london" }],
  map: { adjacentLocationIds: {}, routes: [], locationTypes: { arkham: "city", london: "city" } },
  investigators: {}, assets: [], mysteryIdsByAncientOne: {}, mysteryTargetsById: {},
};

function state(pool = ["clue_arkham", "clue_london"]): GameState {
  return {
    stateVersion: 5, phase: "mythos", players: [], turnNumber: 1, actionsRemaining: 0,
    performedActions: [], monsterLocationIds: [], reserveAssetIds: [], assetDiscardIds: [],
    mysteryProgress: 0, mysteryTarget: 0, completedMysteryIds: [], boardClues: [],
    privateState: { deckOrderById: {}, tokenPoolById: { clues: pool, clue_discard: [] } },
  };
}

describe("internal Clue spawn", () => {
  it("draws one physical Clue and places an opaque public marker at its printed space", () => {
    const before = state();
    const result = spawnClueFromPool(before, content, createDeterministicEngineContext({ tokenIndexes: [1], ids: ["marker-1"] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.boardClues).toEqual([{ id: "marker-1", locationId: "london" }]);
    expect(result.state.privateState.tokenPoolById.clues).toEqual(["clue_arkham"]);
    expect(result.state.privateState.tokenPoolById["board_clue:marker-1"]).toEqual(["clue_london"]);
    expect(result.events).toEqual([{ type: "CLUE_SPAWNED", clueId: "marker-1", locationId: "london" }]);
    expect(JSON.stringify(projectPublicState(result.state))).not.toContain("clue_london");
    expect(result.state.stateVersion).toBe(6);
    expect(before.boardClues).toEqual([]);
  });

  it("keeps the printed face private when an effect specifies another space", () => {
    const result = spawnClueFromPool(state(["clue_arkham"]), content,
      createDeterministicEngineContext({ tokenIndexes: [0], ids: ["marker-2"] }), "london");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.boardClues).toEqual([{ id: "marker-2", locationId: "london" }]);
    expect(result.state.privateState.tokenPoolById["board_clue:marker-2"]).toEqual(["clue_arkham"]);
    expect(JSON.stringify(projectPublicState(result.state))).not.toContain("clue_arkham");
  });

  it("recycles and randomizes the faceup discard pile only when the pool is empty", () => {
    const before = state([]);
    before.privateState.tokenPoolById.clue_discard = ["clue_arkham", "clue_london"];
    const result = spawnClueFromPool(before, content,
      createDeterministicEngineContext({ shuffleIndexes: [0], tokenIndexes: [0], ids: ["marker-3"] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.privateState.tokenPoolById.clues).toHaveLength(1);
    expect(result.state.privateState.tokenPoolById.clue_discard).toEqual([]);
    expect(before.privateState.tokenPoolById.clue_discard).toHaveLength(2);
  });

  it("rejects empty, uninitialized, unknown, and duplicate-marker draws without mutation", () => {
    const empty = state([]);
    expect(spawnClueFromPool(empty, content, createDeterministicEngineContext({}))).toMatchObject({ ok: false, error: { code: "CLUE_UNAVAILABLE" } });
    const uninitialized = state(); delete uninitialized.privateState.tokenPoolById.clues;
    expect(spawnClueFromPool(uninitialized, content, createDeterministicEngineContext({}))).toMatchObject({ ok: false, error: { code: "CLUE_CONTENT_MISSING" } });
    const unknown = state(["clue_missing"]);
    expect(spawnClueFromPool(unknown, content, createDeterministicEngineContext({ tokenIndexes: [0] }))).toMatchObject({ ok: false, error: { code: "CLUE_CONTENT_MISSING" } });
    expect(unknown.privateState.tokenPoolById.clues).toEqual(["clue_missing"]);
    const duplicate = state(["clue_arkham"]);
    duplicate.boardClues = [{ id: "marker-1", locationId: "london" }];
    expect(spawnClueFromPool(duplicate, content, createDeterministicEngineContext({ tokenIndexes: [0], ids: ["marker-1"] }))).toMatchObject({ ok: false, error: { code: "CLUE_CONTENT_MISSING" } });
    expect(duplicate.boardClues).toHaveLength(1);
  });
});
